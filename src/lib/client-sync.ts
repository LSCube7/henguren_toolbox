"use client";

import { getClientId } from "./client-wrongbook";
import { developerSyncSourceIdentity, readDeveloperSyncSource } from "./developer-sync-config";
import { isOnline } from "./offline-cache";
import { withLearningSyncLock, currentLearningOwner, initializeLearningStorage, observeAuthenticatedLearningUser, readLearningPartition, updateLearningPartition } from "./client-learning-storage";
import { saveVocabSnapshot } from "./vocab-sync-store";
import { mergeVocabSnapshots } from "./vocab-sync";
import type { UserSession } from "./types";
import { emptyWrongBook } from "./wrongbook";
import { parseVocabSnapshot, SyncOperationError, type VocabSyncSnapshot } from "./vocab-sync";
export { SyncOperationError } from "./vocab-sync";

export type SyncStatus = "signed-out" | "offline" | "ready" | "syncing" | "synced" | "error";
export type SyncSource = "local" | "account" | "custom";
export type SyncUnavailableReason = "browser-offline" | "server-unavailable" | "source-unavailable" | "session-expired";
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

let requestController = new AbortController();
export function cancelSyncRequests() { requestController.abort(); requestController = new AbortController(); }
async function syncFetch(url: string, init?: RequestInit) {
  let response: Response;
  try { response = await fetch(url, { ...init, cache: "no-store", signal: AbortSignal.any([AbortSignal.timeout(30000), requestController.signal]) }); }
  catch { throw new SyncOperationError("NETWORK_ERROR", 503); }
  if (!response.ok) {
    if (response.status === 401) expireSyncSession();
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

async function readLocalSnapshot(owner?: string) {
  await initializeLearningStorage();
  const partition = await readLearningPartition(owner ?? currentLearningOwner());
  return parseVocabSnapshot({ ...partition.wrongbook, clientId: getClientId(), masteryRecords: partition.masteryRecords }, "local");
}

async function applySyncedLearning(snapshot: VocabSyncSnapshot, owner: string, mode: "pull" | "merge" | "overwrite", accountSync: boolean, sentVersion = 0, cloudVersion?: string) {
  const accountUpload = accountSync && mode !== "pull";
  try {
    await updateLearningPartition(owner, (partition) => {
      const sync = accountUpload ? { ...(partition.sync ?? { enabled: false, localVersion: 0, confirmedVersion: -1 }), confirmedVersion: sentVersion, lastSuccessAt: new Date().toISOString(), lastCloudVersion: cloudVersion, lastCheckAt: Date.now() } : partition.sync;
      if (mode === "overwrite") return { partition: { ...partition, sync, uploaded: accountUpload ? snapshot : partition.uploaded }, result: undefined };
      const local = parseVocabSnapshot({ ...partition.wrongbook, masteryRecords: partition.masteryRecords }, "local");
      const merged = mergeVocabSnapshots("local", local, snapshot);
      return { partition: { ...partition, wrongbook: merged,
        masteryRecords: [...merged.masteryRecords, ...partition.masteryRecords.filter((record) => !local.masteryRecords.some((entry) => entry.id === record.id) && !merged.records.some((entry) => entry.id === record.id))],
        sync, uploaded: accountUpload ? snapshot : partition.uploaded }, result: undefined };
    }, accountSync);
  } catch { throw new SyncOperationError("LOCAL_APPLY_FAILED"); }
}

async function loadWrongBookSyncSummary(): Promise<WrongBookSyncSummary> {
  let authenticatedUser: UserSession | null | undefined;
  if (isOnline()) {
    try { authenticatedUser = await readUser(); }
    catch (error) { authenticatedUser = error instanceof SyncOperationError && error.code === "UNAUTHORIZED" ? null : undefined; }
    if (authenticatedUser) await observeAuthenticatedLearningUser(authenticatedUser.id);
  }
  const local = await readLocalSnapshot();
  const developerSource = readDeveloperSyncSource();
  const base = { localCount: local.records.length, localMasteryCount: local.masteryRecords.length, user: authenticatedUser ?? (!isOnline() ? cachedSyncSummary()?.user ?? null : null) };
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
  try { user = authenticatedUser === undefined ? await readUser() : authenticatedUser; }
  catch { return { ...base, status: "error", source: "account", unavailableReason: "server-unavailable" }; }
  if (!user) return { ...base, status: "signed-out", source: "local" };
  try {
    const response = await syncFetch("/api/wrongbook", { headers: { "X-Sync-User": user.id } });
    const cloudVersion = response.headers.get("X-Sync-Version");
    if (!cloudVersion) throw new SyncOperationError("INVALID_RESPONSE");
    const cloud = parseVocabSnapshot(await response.json(), user.id);
    return { ...base, user, status: "ready", source: "account", cloudCount: cloud.records.length, cloudMasteryCount: cloud.masteryRecords.length, cloudVersion };
  } catch (error) {
    if (error instanceof SyncOperationError && error.code === "UNAUTHORIZED") return { ...base, user: null, status: "signed-out", source: "local", unavailableReason: "session-expired" };
    return { ...base, user, status: "error", source: "account", unavailableReason: "source-unavailable" };
  }
}

async function runSync(mode: "pull" | "merge" | "overwrite", expectedTarget?: string, expectedVersion?: string) {
  if (!isOnline()) throw new SyncOperationError("OFFLINE");
  const source = readDeveloperSyncSource();
  let owner = currentLearningOwner();
  let snapshot: VocabSyncSnapshot;
  let sentVersion = 0;
  let cloudVersion: string | undefined;
  try {
    if (source) {
      if (expectedTarget && developerSyncSourceIdentity(source) !== expectedTarget) throw new SyncOperationError("TARGET_CHANGED", 409);
      const { developerVocabStore } = await loadDeveloperSyncSource();
      const store = developerVocabStore(source);
      if (mode === "pull") {
        const stored = await store.read();
        cloudVersion = stored.etag ?? "missing";
        snapshot = parseVocabSnapshot(stored.value ?? emptyWrongBook(source.profileId), source.profileId);
      } else {
        const expected = mode === "overwrite" ? expectedVersion === "missing" ? null : expectedVersion ?? (await developerVocabStore(source).read()).etag : undefined;
        snapshot = await saveVocabSnapshot(store, source.profileId, await readLocalSnapshot(), mode, expected);
        cloudVersion = store.getVersion?.() ?? "missing";
      }
    } else {
      const user = await readUser();
      if (!user) throw new SyncOperationError("UNAUTHORIZED", 401);
      if (expectedTarget && `account:${user.id}` !== expectedTarget) throw new SyncOperationError("TARGET_CHANGED", 409);
      await observeAuthenticatedLearningUser(user.id);
      owner = currentLearningOwner();
      if (mode === "pull") {
        const response = await syncFetch("/api/wrongbook", { headers: { "X-Sync-User": user.id } });
        cloudVersion = response.headers.get("X-Sync-Version") ?? undefined;
        snapshot = parseVocabSnapshot(await response.json(), user.id);
      } else {
        const version = mode === "overwrite" ? expectedVersion ?? (await syncFetch("/api/wrongbook", { headers: { "X-Sync-User": user.id } })).headers.get("X-Sync-Version") : null;
        if (mode === "overwrite" && !version) throw new SyncOperationError("INVALID_RESPONSE");
        const partition = await readLearningPartition(owner);
        sentVersion = partition.sync?.localVersion ?? 0;
        const response = await syncFetch(mode === "merge" ? "/api/wrongbook/merge" : "/api/wrongbook", {
          method: mode === "merge" ? "POST" : "PUT",
          headers: { "Content-Type": "application/json", "X-Sync-User": user.id, ...(version ? { "X-Sync-Version": version } : {}) },
          body: JSON.stringify(parseVocabSnapshot({ ...partition.wrongbook, clientId: getClientId(), masteryRecords: partition.masteryRecords }, "local"))
        });
        cloudVersion = response.headers.get("X-Sync-Version") ?? undefined;
        snapshot = parseVocabSnapshot(await response.json(), user.id);
      }
    }
  } catch (error) {
    if (error instanceof SyncOperationError) throw error;
    throw new SyncOperationError(source ? "SOURCE_UNAVAILABLE" : "INVALID_RESPONSE", 503);
  }
  await applySyncedLearning(snapshot, owner, mode, !source, sentVersion, cloudVersion);
  const prior = summaryCache;
  const local = await readLearningPartition(owner);
  if (prior) {
    summaryCache = { ...prior, at: Date.now(), value: { ...prior.value, status: "ready", localCount: local.wrongbook.records.length, localMasteryCount: local.masteryRecords.length, cloudCount: snapshot.records.length, cloudMasteryCount: snapshot.masteryRecords.length, cloudVersion } };
    summaryListeners.forEach((listener) => listener());
  }
  return snapshot;
}

let manualSyncCount = 0;
async function manualSync(mode: "pull" | "merge" | "overwrite", target?: string, version?: string) {
  manualSyncCount++;
  window.dispatchEvent(new CustomEvent("henguren-v3-sync-activity", { detail: true }));
  try { return await withLearningSyncLock(() => runSync(mode, target, version)); }
  finally { manualSyncCount--; window.dispatchEvent(new CustomEvent("henguren-v3-sync-activity", { detail: manualSyncCount > 0 })); }
}
export function pullAndMergeWrongBook() { return manualSync("pull"); }
export function overwriteCloudWrongBook(expectedTarget?: string, expectedVersion?: string) { return manualSync("overwrite", expectedTarget, expectedVersion); }
export function mergeUploadWrongBook() { return manualSync("merge"); }

let summaryCache: { value: WrongBookSyncSummary; at: number; identity: string } | undefined;
let summaryRequest: Promise<WrongBookSyncSummary> | undefined;
let summaryRequestIdentity: string | undefined;
const summaryListeners = new Set<() => void>();
export function subscribeSyncSummary(listener: () => void) { summaryListeners.add(listener); return () => { summaryListeners.delete(listener); }; }
function expireSyncSession() {
  if (!summaryCache) return;
  summaryCache = { ...summaryCache, at: Date.now(), value: { ...summaryCache.value, user: null, status: "signed-out", source: "local", unavailableReason: "session-expired", cloudCount: undefined, cloudMasteryCount: undefined, cloudVersion: undefined } };
  summaryListeners.forEach((listener) => listener());
}
export function cachedSyncSummary() { return summaryCache?.value ?? null; }
export function invalidateSyncSummary() { summaryCache = undefined; }
function syncSummaryIdentity() {
  const source = readDeveloperSyncSource();
  return currentLearningOwner() + ":" + (source ? developerSyncSourceIdentity(source) : "account") + ":" + isOnline();
}
export function readWrongBookSyncSummary(options: { force?: boolean } = {}): Promise<WrongBookSyncSummary> {
  const identity = syncSummaryIdentity();
  if (summaryRequest) {
    const requestIdentity = summaryRequestIdentity;
    return summaryRequest.then((value) => requestIdentity === syncSummaryIdentity() ? value : readWrongBookSyncSummary(options));
  }
  if (!options.force && summaryCache?.identity === identity && Date.now() - summaryCache.at < 60000) return Promise.resolve(summaryCache.value);
  summaryRequestIdentity = identity;
  summaryRequest = loadWrongBookSyncSummary().then((value) => {
    if (identity === syncSummaryIdentity()) {
      summaryCache = { value, at: Date.now(), identity };
      summaryListeners.forEach((listener) => listener());
    }
    return value;
  }).finally(() => { summaryRequest = undefined; summaryRequestIdentity = undefined; });
  return summaryRequest.then((value) => identity === syncSummaryIdentity() ? value : readWrongBookSyncSummary(options));
}
export async function automaticLearningSync(options: { force?: boolean } = {}) {
  return withLearningSyncLock(async () => {
    const owner = currentLearningOwner();
    const partition = await readLearningPartition(owner);
    if (!partition.sync?.enabled || readDeveloperSyncSource() || owner === "guest" || !isOnline()) return;
    if (partition.sync.localVersion !== partition.sync.confirmedVersion) { await runSync("merge", "account:" + JSON.parse(owner.slice("account:".length))); return; }
    if (partition.sync.lastCheckAt && Date.now() - partition.sync.lastCheckAt < (options.force ? 60000 : 300000)) return;
    const user = await readUser();
    if (!user) throw new SyncOperationError("UNAUTHORIZED", 401);
    if (owner !== "account:" + JSON.stringify(user.id)) { await observeAuthenticatedLearningUser(user.id); throw new SyncOperationError("TARGET_CHANGED", 409); }
    const response = await syncFetch("/api/wrongbook?versionOnly=1", { headers: { "X-Sync-User": user.id } });
    const body: unknown = await response.json();
    if (!body || typeof body !== "object" || !("version" in body) || typeof body.version !== "string") throw new SyncOperationError("INVALID_RESPONSE");
    const version = body.version;
    if (version !== partition.sync.lastCloudVersion) await runSync("pull", "account:" + user.id);
    await updateLearningPartition(owner, (latest) => ({ partition: { ...latest, sync: { ...latest.sync!, lastCloudVersion: version, lastCheckAt: Date.now(), lastSuccessAt: new Date().toISOString() } }, result: undefined }), true);
  });
}
