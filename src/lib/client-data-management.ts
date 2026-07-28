"use client";

import { getClientId, importWrongBookSnapshot, readLocalWrongBook } from "./client-wrongbook";
import { mergeMasteryRecords, readMasteryRecords, reconcileMasteryRecords } from "./client-mastery";
import { readClientSettings, writeClientSettings } from "./client-settings";
import { editionStorageKey, writeEdition, type Edition } from "./edition";
import type { MasteryRecord } from "./mastery";
import { onboardingChangeEvent, onboardingStorageKey, readOnboardingState, type OnboardingState } from "./onboarding";
import { defaultSettings, normalizeToolboxSettings, type ToolboxSettings, type WrongBookSnapshot } from "./types";

export type BackupMasteryRecord = MasteryRecord;

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

export async function createToolboxBackup(fallbackSettings = defaultSettings): Promise<ToolboxBackup> {
  const edition = localStorage.getItem(editionStorageKey) === "senior" ? "senior" : "junior";
  const [wrongbook, masteryRecords] = await Promise.all([readLocalWrongBook(getClientId()), readMasteryRecords()]);
  const settings = readClientSettings(fallbackSettings);
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

export function parseToolboxBackup(raw: string, fallbackSettings = defaultSettings): ToolboxBackup {
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
    settings: normalizeToolboxSettings(parsed.settings, fallbackSettings),
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

export async function importToolboxBackup(backup: ToolboxBackup, fallbackSettings = defaultSettings) {
  const [wrongbook] = await Promise.all([importWrongBookSnapshot(backup.wrongbook), mergeMasteryRecords(backup.masteryRecords)]);
  await reconcileMasteryRecords(wrongbook.records, wrongbook.deletedRecords);
  const currentSettings = readClientSettings(fallbackSettings);
  writeClientSettings({
    ...backup.settings,
    developerMode: currentSettings.developerMode,
    updatedAt: new Date().toISOString()
  });
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
