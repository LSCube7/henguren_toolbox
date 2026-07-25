"use client";

import "client-only";

import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import type { ToolboxSettings, WrongBookSnapshot } from "./types";
import {
  developerSettingsKey,
  developerWrongBookBackupKey,
  developerWrongBookKey,
  isDeveloperSyncSourceReady,
  type DeveloperSyncSource
} from "./developer-sync-config";

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
