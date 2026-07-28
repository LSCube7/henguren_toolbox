"use client";

import { canonicalizeLocalWrongBookRecordIds, getClientId, importWrongBookSnapshot, readLocalWrongBook } from "./client-wrongbook";
import { reconcileMasteryRecords } from "./client-mastery";
import { readDeveloperSyncSource } from "./developer-sync-config";
import { isOnline } from "./offline-cache";
import type { UserSession, WrongBookSnapshot } from "./types";
import { emptyWrongBook, mergeWrongBooks, normalizeWrongBook } from "./wrongbook";

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
};

function loadDeveloperSyncSource() {
  return import("./developer-sync-source");
}

async function readUser() {
  const response = await fetch("/api/me");
  const data = (await response.json()) as { authenticated: boolean; user: UserSession | null };
  return data.user;
}

async function importSyncedWrongBook(snapshot: Partial<WrongBookSnapshot>) {
  const local = await importWrongBookSnapshot(snapshot);
  await reconcileMasteryRecords(local.records, local.deletedRecords);
  return local;
}

export async function readWrongBookSyncSummary(): Promise<WrongBookSyncSummary> {
  const clientId = getClientId();
  const local = await readLocalWrongBook(clientId);
  const developerSource = readDeveloperSyncSource();
  if (!isOnline()) {
    return {
      status: "offline",
      source: developerSource ? "custom" : "local",
      unavailableReason: "browser-offline",
      user: null,
      localCount: local.records.length
    };
  }

  if (developerSource) {
    try {
      const { readDeveloperWrongBook } = await loadDeveloperSyncSource();
      const cloud = await readDeveloperWrongBook(developerSource);
      return {
        status: "ready",
        source: "custom",
        user: null,
        localCount: local.records.length,
        cloudCount: cloud?.records.length ?? 0
      };
    } catch {
      return {
        status: "error",
        source: "custom",
        unavailableReason: "source-unavailable",
        user: null,
        localCount: local.records.length
      };
    }
  }

  let user: UserSession | null = null;
  try {
    user = await readUser();
  } catch {
    return {
      status: "offline",
      source: "account",
      unavailableReason: "server-unavailable",
      user: null,
      localCount: local.records.length
    };
  }

  if (!user) {
    return {
      status: "signed-out",
      source: "local",
      user: null,
      localCount: local.records.length
    };
  }

  let response: Response;
  try {
    response = await fetch("/api/wrongbook");
  } catch {
    return {
      status: "offline",
      source: "account",
      unavailableReason: "server-unavailable",
      user,
      localCount: local.records.length
    };
  }

  if (!response.ok) {
    return {
      status: "error",
      source: "account",
      unavailableReason: "source-unavailable",
      user,
      localCount: local.records.length
    };
  }

  const cloud = (await response.json()) as WrongBookSnapshot;
  return {
    status: "ready",
    source: "account",
    user,
    localCount: local.records.length,
    cloudCount: cloud.records.length
  };
}

export async function pullAndMergeWrongBook() {
  if (!isOnline()) throw new Error("当前离线，无法拉取云端错题本；本地错题本仍可使用。");
  const developerSource = readDeveloperSyncSource();
  if (developerSource) {
    const { readDeveloperWrongBook } = await loadDeveloperSyncSource();
    const cloud = (await readDeveloperWrongBook(developerSource)) ?? emptyWrongBook(developerSource.profileId, getClientId());
    await importSyncedWrongBook(cloud);
    return;
  }
  const response = await fetch("/api/wrongbook");
  if (!response.ok) throw new Error("需要登录后才能拉取云端错题本。");
  await importSyncedWrongBook((await response.json()) as WrongBookSnapshot);
}

export async function overwriteCloudWrongBook() {
  if (!isOnline()) throw new Error("当前离线，无法上传错题本；本地错题本仍可使用。");
  const local = await canonicalizeLocalWrongBookRecordIds(getClientId());
  const developerSource = readDeveloperSyncSource();
  if (developerSource) {
    const { writeDeveloperWrongBook } = await loadDeveloperSyncSource();
    const snapshot = normalizeWrongBook(local, developerSource.profileId);
    await writeDeveloperWrongBook(developerSource, snapshot);
    return snapshot;
  }
  const response = await fetch("/api/wrongbook", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(local)
  });
  if (!response.ok) throw new Error("需要登录后才能上传错题本。");
  return (await response.json()) as WrongBookSnapshot;
}

export async function mergeUploadWrongBook() {
  if (!isOnline()) throw new Error("当前离线，无法合并上传错题本；本地错题本仍可使用。");
  const developerSource = readDeveloperSyncSource();
  if (developerSource) {
    const { readDeveloperWrongBook, writeDeveloperWrongBook } = await loadDeveloperSyncSource();
    const cloud = await readDeveloperWrongBook(developerSource);
    const local = normalizeWrongBook(await readLocalWrongBook(getClientId()), developerSource.profileId);
    const merged = mergeWrongBooks(developerSource.profileId, cloud, local);
    await writeDeveloperWrongBook(developerSource, merged);
    await importSyncedWrongBook(merged);
    return merged;
  }
  const response = await fetch("/api/wrongbook/merge", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(await readLocalWrongBook(getClientId()))
  });
  if (!response.ok) throw new Error("需要登录后才能合并上传错题本。");
  const merged = (await response.json()) as WrongBookSnapshot;
  await importSyncedWrongBook(merged);
  return merged;
}
