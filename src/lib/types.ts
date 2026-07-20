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
};

export type WrongBookRecord = {
  id: string;
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
  showHint: boolean;
  enableSlipDetection: boolean;
  defaultTestCount: number;
  vocabDefinitionLanguages: VocabDefinitionLanguage[];
  syncStrategy: "manual" | "auto";
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
  showHint: true,
  enableSlipDetection: false,
  defaultTestCount: 20,
  vocabDefinitionLanguages: ["en", "zh"],
  syncStrategy: "manual",
  updatedAt: new Date(0).toISOString()
};
