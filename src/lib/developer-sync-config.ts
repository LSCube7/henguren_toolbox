"use client";

import "client-only";

import { defaultSettings, type ToolboxSettings } from "./types";

export type DeveloperSyncSource = {
  type: "r2";
  accountId: string;
  bucketName: string;
  accessKeyId: string;
  secretAccessKey: string;
  keyPrefix: string;
  profileId: string;
  updatedAt: string;
};

const settingsKey = "henguren-v3-settings";
const sourceKey = "henguren-v3-dev-sync-source";

function readSettings() {
  try {
    const saved = localStorage.getItem(settingsKey);
    return saved ? ({ ...defaultSettings, ...JSON.parse(saved) } as ToolboxSettings) : defaultSettings;
  } catch {
    return defaultSettings;
  }
}

function cleanPrefix(value: string) {
  return value.trim().replace(/^\/+|\/+$/g, "");
}

export function readDeveloperSyncSource(): DeveloperSyncSource | null {
  if (typeof window === "undefined") return null;
  if (!readSettings().developerMode) return null;
  try {
    const parsed = JSON.parse(localStorage.getItem(sourceKey) ?? "null") as Partial<DeveloperSyncSource> | null;
    if (!parsed || parsed.type !== "r2") return null;
    const source: DeveloperSyncSource = {
      type: "r2",
      accountId: String(parsed.accountId ?? "").trim(),
      bucketName: String(parsed.bucketName ?? "").trim(),
      accessKeyId: String(parsed.accessKeyId ?? "").trim(),
      secretAccessKey: String(parsed.secretAccessKey ?? ""),
      keyPrefix: cleanPrefix(String(parsed.keyPrefix ?? "henguren-toolbox")),
      profileId: String(parsed.profileId ?? "").trim(),
      updatedAt: String(parsed.updatedAt ?? new Date(0).toISOString())
    };
    return isDeveloperSyncSourceReady(source) ? source : null;
  } catch {
    return null;
  }
}

export function readDeveloperSyncSourceDraft(): DeveloperSyncSource {
  if (typeof window === "undefined") return emptyDeveloperSyncSource();
  try {
    const parsed = JSON.parse(localStorage.getItem(sourceKey) ?? "null") as Partial<DeveloperSyncSource> | null;
    return {
      ...emptyDeveloperSyncSource(),
      ...parsed,
      type: "r2",
      keyPrefix: cleanPrefix(String(parsed?.keyPrefix ?? "henguren-toolbox")),
      updatedAt: String(parsed?.updatedAt ?? new Date(0).toISOString())
    };
  } catch {
    return emptyDeveloperSyncSource();
  }
}

export function writeDeveloperSyncSource(source: DeveloperSyncSource) {
  localStorage.setItem(
    sourceKey,
    JSON.stringify({
      ...source,
      keyPrefix: cleanPrefix(source.keyPrefix || "henguren-toolbox"),
      updatedAt: new Date().toISOString()
    })
  );
}

export function clearDeveloperSyncSource() {
  localStorage.removeItem(sourceKey);
}

export function isDeveloperSyncSourceReady(source: DeveloperSyncSource) {
  return Boolean(source.accountId && source.bucketName && source.accessKeyId && source.secretAccessKey && source.profileId);
}

export function emptyDeveloperSyncSource(): DeveloperSyncSource {
  return {
    type: "r2",
    accountId: "",
    bucketName: "",
    accessKeyId: "",
    secretAccessKey: "",
    keyPrefix: "henguren-toolbox",
    profileId: "",
    updatedAt: new Date(0).toISOString()
  };
}

function objectKey(source: DeveloperSyncSource, suffix: string) {
  const prefix = cleanPrefix(source.keyPrefix);
  return prefix ? `${prefix}/${suffix}` : suffix;
}

export function developerWrongBookKey(source: DeveloperSyncSource) {
  return objectKey(source, `wrongbooks/${source.profileId}/current.json`);
}

export function developerWrongBookBackupKey(source: DeveloperSyncSource, timestamp: string) {
  return objectKey(source, `wrongbooks/${source.profileId}/backups/${timestamp}.json`);
}

export function developerSettingsKey(source: DeveloperSyncSource) {
  return objectKey(source, `settings/${source.profileId}/current.json`);
}
