"use client";

import "client-only";

import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { defaultSettings, type ToolboxSettings, type WrongBookSnapshot } from "./types";

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

function createClient(source: DeveloperSyncSource) {
  return new S3Client({
    region: "auto",
    endpoint: `https://${source.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: source.accessKeyId,
      secretAccessKey: source.secretAccessKey
    }
  });
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

export async function readDeveloperJson<T>(source: DeveloperSyncSource, key: string): Promise<T | null> {
  try {
    const response = await createClient(source).send(new GetObjectCommand({ Bucket: source.bucketName, Key: key }));
    const body = await response.Body?.transformToString();
    return body ? (JSON.parse(body) as T) : null;
  } catch (error) {
    const name = error instanceof Error ? error.name : "";
    if (name === "NoSuchKey" || name === "NotFound") return null;
    throw error;
  }
}

export async function writeDeveloperJson(source: DeveloperSyncSource, key: string, value: unknown) {
  await createClient(source).send(
    new PutObjectCommand({
      Bucket: source.bucketName,
      Key: key,
      Body: JSON.stringify(value, null, 2),
      ContentType: "application/json; charset=utf-8"
    })
  );
}

export async function readDeveloperWrongBook(source: DeveloperSyncSource) {
  return readDeveloperJson<WrongBookSnapshot>(source, developerWrongBookKey(source));
}

export async function writeDeveloperWrongBook(source: DeveloperSyncSource, snapshot: WrongBookSnapshot) {
  await writeDeveloperJson(source, developerWrongBookKey(source), snapshot);
  await writeDeveloperJson(source, developerWrongBookBackupKey(source, snapshot.updatedAt.replaceAll(":", "-")), snapshot);
}

export async function readDeveloperSettings(source: DeveloperSyncSource) {
  return readDeveloperJson<ToolboxSettings>(source, developerSettingsKey(source));
}

export async function writeDeveloperSettings(source: DeveloperSyncSource, settings: ToolboxSettings) {
  await writeDeveloperJson(source, developerSettingsKey(source), settings);
}

export async function testDeveloperSyncSource(source: DeveloperSyncSource) {
  if (!isDeveloperSyncSourceReady(source)) {
    throw new Error("请先填写完整的 R2 账户、桶、访问密钥和配置 ID。");
  }
  await readDeveloperJson<unknown>(source, developerSettingsKey(source));
}
