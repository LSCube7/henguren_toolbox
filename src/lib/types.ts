import { defaultLocale, type AppLocale } from "../i18n/config.ts";

export type UserSession = {
  id: string;
  name: string;
  email?: string;
  avatarUrl?: string;
};

export type WrongBookAttempt = {
  id: string;
  testNo?: string;
  batchName?: string;
  clientId: string;
  createdAt: string;
};

export type WrongBookTombstone = {
  id: string;
  clientId: string;
  deletedAt: string;
  /** Attempt ids observed and removed by this deletion. */
  deletedAttemptIds?: string[];
  /** Per-client timestamp fallbacks retained for tombstones written before observed-remove metadata. */
  legacyDeletionCutoffs?: Record<string, string>;
  /** @deprecated Read-only compatibility with snapshots created during the v3.1.0 release cycle. */
  legacyDeletedAt?: string;
};

export type WrongBookRecord = {
  id: string;
  /** Historical ids retained so mastery data and deletion tombstones can follow canonical id migrations. */
  aliases?: string[];
  word: string;
  sourceName: string;
  sourceTitle?: string;
  definitions?: string[];
  zhDefinitions?: string[];
  wrongCount: number;
  wrongAttempts?: WrongBookAttempt[];
  /** Legacy v1 fields retained for import compatibility. */
  testNos?: string[];
  /** Legacy v1 field retained for import compatibility. */
  batchNames?: string[];
  createdAt: string;
  updatedAt: string;
};

export type WrongBookSnapshot = {
  schemaVersion: 2;
  userId: string;
  clientId: string;
  updatedAt: string;
  records: WrongBookRecord[];
  deletedRecords: WrongBookTombstone[];
  deletedBatches: WrongBookTombstone[];
};

export type VocabDefinitionLanguage = "en" | "zh";

export type ToolboxSettings = {
  schemaVersion: 1;
  theme: "classic" | "ink" | "garden" | "ocean";
  themePreset?: string;
  themeSeedColor?: string;
  colorMode?: "light" | "dark" | "system";
  developerMode?: boolean;
  showTranslationKeys?: boolean;
  locale: AppLocale;
  showHint: boolean;
  enableSlipDetection: boolean;
  defaultTestCount: number;
  vocabDefinitionLanguages: VocabDefinitionLanguage[];
  syncStrategy: "manual";
  updatedAt: string;
};

export type VocabWord = {
  word: string;
  en_definition: string[];
  zh_definition: string[];
  sourceName?: string;
  sourceTitle?: string;
};

export type WrongBookBatch = {
  testNo: string;
  batchName?: string;
  createdAt: string;
  sourceName: string;
  syncedCount: number;
};

export const defaultSettings: ToolboxSettings = {
  schemaVersion: 1,
  theme: "classic",
  themePreset: "default-blue",
  colorMode: "system",
  developerMode: false,
  showTranslationKeys: false,
  locale: defaultLocale,
  showHint: true,
  enableSlipDetection: false,
  defaultTestCount: 20,
  vocabDefinitionLanguages: ["en", "zh"],
  syncStrategy: "manual",
  updatedAt: new Date(0).toISOString()
};

export function defaultSettingsForLocale(locale: AppLocale): ToolboxSettings {
  return locale === defaultSettings.locale ? defaultSettings : { ...defaultSettings, locale };
}

export function normalizeToolboxSettings(value: unknown, fallbackSettings = defaultSettings): ToolboxSettings {
  const saved = value && typeof value === "object" ? (value as Partial<ToolboxSettings>) : {};
  return {
    ...fallbackSettings,
    ...saved,
    schemaVersion: 1,
    syncStrategy: "manual"
  };
}
