export type UserSession = {
  id: string;
  name: string;
  email?: string;
  avatarUrl?: string;
};

export type WrongBookRecord = {
  id: string;
  word: string;
  sourceName: string;
  sourceTitle?: string;
  definitions?: string[];
  zhDefinitions?: string[];
  wrongCount: number;
  testNos?: string[];
  batchNames?: string[];
  createdAt: string;
  updatedAt: string;
};

export type WrongBookSnapshot = {
  schemaVersion: 1;
  userId: string;
  clientId: string;
  updatedAt: string;
  records: WrongBookRecord[];
};

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
  syncStrategy: "manual",
  updatedAt: new Date(0).toISOString()
};
