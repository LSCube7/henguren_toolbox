"use client";

import { canonicalizeLocalWrongBookRecordIds, getClientId, importWrongBookSnapshot, readLocalWrongBook } from "./client-wrongbook";
import { mergeMasteryRecords, readMasteryRecords, reconcileMasteryRecords } from "./client-mastery";
import { developerSyncSourceIdentity, readDeveloperSyncSource } from "./developer-sync-config";
import { isOnline } from "./offline-cache";
import type { UserSession } from "./types";
import { emptyWrongBook } from "./wrongbook";
import { parseVocabSnapshot, SyncOperationError, type VocabSyncSnapshot } from "./vocab-sync";
export { SyncOperationError } from "./vocab-sync";

export type SyncStatus = "signed-out" | "offline" | "ready" | "syncing" | "synced" | "error";
export type SyncSource = "local" | "account" | "custom";
export type SyncUnavailableReason = "browser-offline" | "server-unavailable" | "source-unavailable";
export type WrongBookSyncSummary = {
  status: SyncStatus;
  source: SyncSource;
  unavailableReason?: SyncUnavailableReason;
  user: UserSession | null;
  localCount: number;
  cloudCount?: number;
  localMasteryCount?: number;
  cloudMasteryCount?: number;
  cloudVersion?: string;
};

function loadDeveloperSyncSource() { return import("./developer-sync-source"); }

async function syncFetch(url: string, init?: RequestInit) {
  let response: Response;
  try { response = await fetch(url, { ...init, cache: "no-store" }); }
  catch { throw new SyncOperationError("NETWORK_ERROR", 503); }
  if (!response.ok) {
    const codes: Record<number, string> = { 401: "UNAUTHORIZED", 400: "INVALID_SNAPSHOT", 409: "SYNC_CONFLICT", 413: "SNAPSHOT_TOO_LARGE", 503: "CLOUD_UNAVAILABLE" };
    let code = codes[response.status] ?? "SERVER_ERROR";
    try {
      const data: unknown = await response.json();
      const allowed = ["BACKUP_FAILED", "INVALID_JSON", "INVALID_MASTERY", "INVALID_DELETIONS", "INVALID_WRONGBOOK", "UNSUPPORTED_VERSION", "TARGET_CHANGED"];
      if (data && typeof data === "object" && "error" in data && typeof data.error === "string" && allowed.includes(data.error)) code = data.error;
    } catch { /* HTTP status is sufficient when the server has no JSON error. */ }
    throw new SyncOperationError(code, response.status);
  }
  return response;
}

async function readUser(): Promise<UserSession | null> {
  const data: unknown = await (await syncFetch("/api/me")).json();
  if (!data || typeof data !== "object" || !("authenticated" in data) || !("user" in data)) throw new SyncOperationError("INVALID_RESPONSE");
  if (data.authenticated === false) return null;
  if (!data.user || typeof data.user !== "object" || !("id" in data.user) || typeof data.user.id !== "string") throw new SyncOperationError("INVALID_RESPONSE");
  return data.user as UserSession;
}

async function readLocalSnapshot() {
  const wrongbook = await canonicalizeLocalWrongBookRecordIds(getClientId());
  const masteryRecords = await readMasteryRecords();
  return parseVocabSnapshot({ ...wrongbook, masteryRecords }, "local");
}

async function importSyncedWrongBook(snapshot: VocabSyncSnapshot) {
  try {
    await importWrongBookSnapshot(snapshot);
    // Merge with fresh local data rather than replacing the pre-request snapshot.
    const local = await readLocalWrongBook(getClientId());
    await mergeMasteryRecords(snapshot.masteryRecords, local);
    const latest = await readLocalWrongBook(getClientId());
    await reconcileMasteryRecords(latest.records, latest.deletedRecords);
  } catch { throw new SyncOperationError("LOCAL_APPLY_FAILED"); }
}

export async function readWrongBookSyncSummary(): Promise<WrongBookSyncSummary> {
  const local = await readLocalSnapshot();
  const developerSource = readDeveloperSyncSource();
  const base = { localCount: local.records.length, localMasteryCount: local.masteryRecords.length, user: null };
  if (!isOnline()) return { ...base, status: "offline", source: developerSource ? "custom" : "local", unavailableReason: "browser-offline" };
  if (developerSource) {
    try {
      const { developerVocabStore } = await loadDeveloperSyncSource();
      const stored = await developerVocabStore(developerSource).read();
      const cloud = parseVocabSnapshot(stored.value ?? emptyWrongBook(developerSource.profileId), developerSource.profileId);
      return { ...base, status: "ready", source: "custom", cloudCount: cloud.records.length, cloudMasteryCount: cloud.masteryRecords.length, cloudVersion: stored.etag ?? "missing" };
    } catch { return { ...base, status: "error", source: "custom", unavailableReason: "source-unavailable" }; }
  }
  let user: UserSession | null;
  try { user = await readUser(); }
  catch { return { ...base, status: "error", source: "account", unavailableReason: "server-unavailable" }; }
  if (!user) return { ...base, status: "signed-out", source: "local" };
  try {
    const response = await syncFetch("/api/wrongbook", { headers: { "X-Sync-User": user.id } });
    const cloudVersion = response.headers.get("X-Sync-Version");
    if (!cloudVersion) throw new SyncOperationError("INVALID_RESPONSE");
    const cloud = parseVocabSnapshot(await response.json(), user.id);
    return { ...base, user, status: "ready", source: "account", cloudCount: cloud.records.length, cloudMasteryCount: cloud.masteryRecords.length, cloudVersion };
  } catch (error) {
    if (error instanceof SyncOperationError && error.code === "UNAUTHORIZED") return { ...base, status: "signed-out", source: "local" };
    return { ...base, user, status: "error", source: "account", unavailableReason: "source-unavailable" };
  }
}

async function runSync(mode: "pull" | "merge" | "overwrite", expectedTarget?: string, expectedVersion?: string) {
  if (!isOnline()) throw new SyncOperationError("OFFLINE");
  const source = readDeveloperSyncSource();
  let snapshot: VocabSyncSnapshot;
  try {
    if (source) {
      if (expectedTarget && developerSyncSourceIdentity(source) !== expectedTarget) throw new SyncOperationError("TARGET_CHANGED", 409);
      const { developerVocabStore, saveDeveloperVocab } = await loadDeveloperSyncSource();
      if (mode === "pull") {
        const stored = await developerVocabStore(source).read();
        snapshot = parseVocabSnapshot(stored.value ?? emptyWrongBook(source.profileId), source.profileId);
      } else {
        const expected = mode === "overwrite" ? expectedVersion === "missing" ? null : expectedVersion ?? (await developerVocabStore(source).read()).etag : undefined;
        snapshot = await saveDeveloperVocab(source, await readLocalSnapshot(), mode, expected);
      }
    } else {
      const user = await readUser();
      if (!user) throw new SyncOperationError("UNAUTHORIZED", 401);
      if (expectedTarget && `account:${user.id}` !== expectedTarget) throw new SyncOperationError("TARGET_CHANGED", 409);
      if (mode === "pull") {
        snapshot = parseVocabSnapshot(await (await syncFetch("/api/wrongbook", { headers: { "X-Sync-User": user.id } })).json(), user.id);
      } else {
        const version = mode === "overwrite" ? expectedVersion ?? (await syncFetch("/api/wrongbook", { headers: { "X-Sync-User": user.id } })).headers.get("X-Sync-Version") : null;
        if (mode === "overwrite" && !version) throw new SyncOperationError("INVALID_RESPONSE");
        const response = await syncFetch(mode === "merge" ? "/api/wrongbook/merge" : "/api/wrongbook", {
          method: mode === "merge" ? "POST" : "PUT",
          headers: { "Content-Type": "application/json", "X-Sync-User": user.id, ...(version ? { "X-Sync-Version": version } : {}) },
          body: JSON.stringify(await readLocalSnapshot())
        });
        snapshot = parseVocabSnapshot(await response.json(), user.id);
      }
    }
  } catch (error) {
    if (error instanceof SyncOperationError) throw error;
    throw new SyncOperationError(source ? "SOURCE_UNAVAILABLE" : "INVALID_RESPONSE", 503);
  }
  if (mode !== "overwrite") await importSyncedWrongBook(snapshot);
  return snapshot;
}

export function pullAndMergeWrongBook() { return runSync("pull"); }
export function overwriteCloudWrongBook(expectedTarget?: string, expectedVersion?: string) { return runSync("overwrite", expectedTarget, expectedVersion); }
export function mergeUploadWrongBook() { return runSync("merge"); }
