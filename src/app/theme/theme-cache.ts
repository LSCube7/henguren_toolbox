export const themeSettingsKey = "henguren-v3-settings";
export const themeStyleCacheKey = "henguren-v3-theme-style-m3e-2025";

export type CachedThemeStyle = {
  seed: string;
  mode: "light" | "dark";
  properties: Record<string, string>;
};
