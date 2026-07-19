"use client";

import { getClientId, importWrongBookSnapshot, readLocalWrongBook } from "./client-wrongbook";
import { readDeveloperSyncSource, readDeveloperWrongBook, writeDeveloperWrongBook } from "./developer-sync-source";
import { isOnline } from "./offline-cache";
import type { UserSession, WrongBookSnapshot } from "./types";
import { emptyWrongBook, mergeWrongBooks, normalizeWrongBook } from "./wrongbook";

export type SyncStatus = "signed-out" | "offline" | "ready" | "syncing" | "synced" | "error";

export type WrongBookSyncSummary = {
  status: SyncStatus;
  user: UserSession | null;
  localCount: number;
  cloudCount?: number;
  message: string;
};

async function readUser() {
  const response = await fetch("/api/me");
  const data = (await response.json()) as { authenticated: boolean; user: UserSession | null };
  return data.user;
}

export async function readWrongBookSyncSummary(): Promise<WrongBookSyncSummary> {
  const clientId = getClientId();
  const local = await readLocalWrongBook(clientId);
  if (!isOnline()) {
    return {
      status: "offline",
      user: null,
      localCount: local.records.length,
      message: `当前离线，云端错题本不可用；本地错题本仍可使用（${local.records.length} 词）。`
    };
  }

  const developerSource = readDeveloperSyncSource();
  if (developerSource) {
    try {
      const cloud = await readDeveloperWrongBook(developerSource);
      return {
        status: "ready",
        user: null,
        localCount: local.records.length,
        cloudCount: cloud?.records.length ?? 0,
        message: `使用自定义同步源：本地 ${local.records.length} 词，云端 ${cloud?.records.length ?? 0} 词。`
      };
    } catch {
      return {
        status: "error",
        user: null,
        localCount: local.records.length,
        message: "自定义同步源暂时不可用，请检查 R2 配置与 CORS 设置。"
      };
    }
  }

  let user: UserSession | null = null;
  try {
    user = await readUser();
  } catch {
    return {
      status: "offline",
      user: null,
      localCount: local.records.length,
      message: `当前无法连接服务器；本地错题本仍可使用（${local.records.length} 词）。`
    };
  }

  if (!user) {
    return {
      status: "signed-out",
      user: null,
      localCount: local.records.length,
      message: "未登录，错题本仅保存在本地。"
    };
  }

  let response: Response;
  try {
    response = await fetch("/api/wrongbook");
  } catch {
    return {
      status: "offline",
      user,
      localCount: local.records.length,
      message: `当前离线或网络不可用；本地错题本仍可使用（${local.records.length} 词）。`
    };
  }

  if (!response.ok) {
    return {
      status: "error",
      user,
      localCount: local.records.length,
      message: "云端错题本暂时不可用。"
    };
  }

  const cloud = (await response.json()) as WrongBookSnapshot;
  return {
    status: "ready",
    user,
    localCount: local.records.length,
    cloudCount: cloud.records.length,
    message: `本地 ${local.records.length} 词，云端 ${cloud.records.length} 词。`
  };
}

export async function pullAndMergeWrongBook() {
  if (!isOnline()) throw new Error("当前离线，无法拉取云端错题本；本地错题本仍可使用。");
  const developerSource = readDeveloperSyncSource();
  if (developerSource) {
    const cloud = (await readDeveloperWrongBook(developerSource)) ?? emptyWrongBook(developerSource.profileId, getClientId());
    await importWrongBookSnapshot(cloud);
    return;
  }
  const response = await fetch("/api/wrongbook");
  if (!response.ok) throw new Error("需要登录后才能拉取云端错题本。");
  await importWrongBookSnapshot((await response.json()) as WrongBookSnapshot);
}

export async function overwriteCloudWrongBook() {
  if (!isOnline()) throw new Error("当前离线，无法上传错题本；本地错题本仍可使用。");
  const developerSource = readDeveloperSyncSource();
  if (developerSource) {
    const snapshot = normalizeWrongBook(await readLocalWrongBook(getClientId()), developerSource.profileId);
    await writeDeveloperWrongBook(developerSource, snapshot);
    return snapshot;
  }
  const response = await fetch("/api/wrongbook", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(await readLocalWrongBook(getClientId()))
  });
  if (!response.ok) throw new Error("需要登录后才能上传错题本。");
  return (await response.json()) as WrongBookSnapshot;
}

export async function mergeUploadWrongBook() {
  if (!isOnline()) throw new Error("当前离线，无法合并上传错题本；本地错题本仍可使用。");
  const developerSource = readDeveloperSyncSource();
  if (developerSource) {
    const cloud = await readDeveloperWrongBook(developerSource);
    const local = normalizeWrongBook(await readLocalWrongBook(getClientId()), developerSource.profileId);
    const merged = mergeWrongBooks(developerSource.profileId, cloud, local);
    await writeDeveloperWrongBook(developerSource, merged);
    await importWrongBookSnapshot(merged);
    return merged;
  }
  const response = await fetch("/api/wrongbook/merge", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(await readLocalWrongBook(getClientId()))
  });
  if (!response.ok) throw new Error("需要登录后才能合并上传错题本。");
  const merged = (await response.json()) as WrongBookSnapshot;
  await importWrongBookSnapshot(merged);
  return merged;
}
