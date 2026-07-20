"use client";

import { getClientId, importWrongBookSnapshot, readLocalWrongBook } from "./client-wrongbook";
import { editionStorageKey, writeEdition, type Edition } from "./edition";
import { onboardingChangeEvent, onboardingStorageKey, readOnboardingState, type OnboardingState } from "./onboarding";
import { defaultSettings, type ToolboxSettings, type WrongBookSnapshot } from "./types";

const settingsKey = "henguren-v3-settings";
const masteryDbName = "henguren-v3-mastery";
const masteryStoreName = "records";

export type BackupMasteryRecord = {
  id: string;
  level: "learning" | "reviewing" | "mastered";
  correctStreak: number;
  reviewCount: number;
  lastReviewedAt: string;
  nextReviewAt: string;
  updatedAt: string;
};

export type ToolboxBackup = {
  app: "henguren-toolbox-v3";
  schemaVersion: 1;
  exportedAt: string;
  settings: ToolboxSettings;
  edition: Edition;
  onboarding: OnboardingState;
  wrongbook: WrongBookSnapshot;
  masteryRecords: BackupMasteryRecord[];
};

function openMasteryDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(masteryDbName, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(masteryStoreName)) db.createObjectStore(masteryStoreName, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function readMasteryRecords(): Promise<BackupMasteryRecord[]> {
  const db = await openMasteryDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(masteryStoreName, "readonly");
    const request = transaction.objectStore(masteryStoreName).getAll();
    request.onsuccess = () => resolve(request.result as BackupMasteryRecord[]);
    request.onerror = () => reject(request.error);
  });
}

async function mergeMasteryRecords(records: BackupMasteryRecord[]) {
  if (records.length === 0) return;
  const db = await openMasteryDb();
  const existing = await readMasteryRecords();
  const existingById = new Map(existing.map((record) => [record.id, record]));
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(masteryStoreName, "readwrite");
    const store = transaction.objectStore(masteryStoreName);
    records.forEach((record) => {
      const current = existingById.get(record.id);
      if (!current || current.updatedAt < record.updatedAt) store.put(record);
    });
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

function readSettings() {
  try {
    const saved = localStorage.getItem(settingsKey);
    return saved ? ({ ...defaultSettings, ...(JSON.parse(saved) as Partial<ToolboxSettings>) } as ToolboxSettings) : defaultSettings;
  } catch {
    return defaultSettings;
  }
}

export async function createToolboxBackup(): Promise<ToolboxBackup> {
  const edition = localStorage.getItem(editionStorageKey) === "senior" ? "senior" : "junior";
  const [wrongbook, masteryRecords] = await Promise.all([readLocalWrongBook(getClientId()), readMasteryRecords()]);
  const settings = readSettings();
  return {
    app: "henguren-toolbox-v3",
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    settings: { ...settings, developerMode: false },
    edition,
    onboarding: readOnboardingState(),
    wrongbook,
    masteryRecords
  };
}

export function parseToolboxBackup(raw: string): ToolboxBackup {
  const parsed = JSON.parse(raw) as Partial<ToolboxBackup>;
  if (!parsed || parsed.app !== "henguren-toolbox-v3" || parsed.schemaVersion !== 1) {
    throw new Error("这不是受支持的恨古人工具箱备份文件。");
  }
  if (!parsed.settings || typeof parsed.settings !== "object" || !parsed.wrongbook || !Array.isArray(parsed.wrongbook.records)) {
    throw new Error("备份文件缺少设置或错题本数据。");
  }
  const masteryRecords = Array.isArray(parsed.masteryRecords)
    ? parsed.masteryRecords
        .filter((record): record is BackupMasteryRecord => {
          if (!record || typeof record !== "object" || typeof record.id !== "string") return false;
          if (!(["learning", "reviewing", "mastered"] as const).includes(record.level)) return false;
          return !Number.isNaN(Date.parse(record.updatedAt)) && !Number.isNaN(Date.parse(record.nextReviewAt));
        })
        .map((record) => ({
          ...record,
          correctStreak: Math.max(0, Number(record.correctStreak) || 0),
          reviewCount: Math.max(0, Number(record.reviewCount) || 0)
        }))
    : [];
  return {
    app: "henguren-toolbox-v3",
    schemaVersion: 1,
    exportedAt: String(parsed.exportedAt ?? new Date(0).toISOString()),
    settings: { ...defaultSettings, ...parsed.settings, schemaVersion: 1 },
    edition: parsed.edition === "senior" ? "senior" : "junior",
    onboarding: {
      completed: Boolean(parsed.onboarding?.completed),
      version: 1,
      completedAt: parsed.onboarding?.completedAt
    },
    wrongbook: parsed.wrongbook,
    masteryRecords
  };
}

export async function importToolboxBackup(backup: ToolboxBackup) {
  await Promise.all([importWrongBookSnapshot(backup.wrongbook), mergeMasteryRecords(backup.masteryRecords)]);
  const currentSettings = readSettings();
  localStorage.setItem(
    settingsKey,
    JSON.stringify({ ...defaultSettings, ...backup.settings, developerMode: currentSettings.developerMode, schemaVersion: 1, updatedAt: new Date().toISOString() })
  );
  writeEdition(backup.edition);
  localStorage.setItem(onboardingStorageKey, JSON.stringify(backup.onboarding));
  window.dispatchEvent(new Event("henguren-theme-change"));
  window.dispatchEvent(new Event(onboardingChangeEvent));
  return { wrongbookCount: backup.wrongbook.records.length, masteryCount: backup.masteryRecords.length };
}

export function downloadToolboxBackup(backup: ToolboxBackup) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: "application/json;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `henguren_backup_${backup.exportedAt.replaceAll(":", "-").replaceAll(".", "-")}.json`;
  link.click();
  URL.revokeObjectURL(url);
}
