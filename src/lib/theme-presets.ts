export type ThemePreset = {
  id: string;
  name: string;
  description: string;
  seedColor: string;
  group: "standard" | "pride";
  prideFlag?: string;
};

export const defaultThemeSeed = "#4f7cff";
export const customThemePresetId = "custom";

export const prideThemeFlags = [
  { id: "trans", name: "Trans" },
  { id: "non-binary", name: "Non-binary" },
  { id: "bisexual", name: "Bisexual" },
  { id: "pansexual", name: "Pansexual" },
  { id: "lesbian", name: "Lesbian" },
  { id: "gay", name: "Gay" },
  { id: "asexual", name: "Asexual" },
  { id: "aromantic", name: "Aromantic" },
  { id: "genderfluid", name: "Genderfluid" },
  { id: "genderqueer", name: "Genderqueer" },
  { id: "intersex", name: "Intersex" },
  { id: "aroace", name: "Aroace" }
] as const;

export const themePresets: ThemePreset[] = [
  { id: "default-blue", name: "浅蓝", description: "默认学习工具箱配色", seedColor: defaultThemeSeed, group: "standard" },
  { id: "red", name: "红", description: "普通红色", seedColor: "#ba1a1a", group: "standard" },
  { id: "orange", name: "橙", description: "普通橙色", seedColor: "#b65d00", group: "standard" },
  { id: "yellow", name: "黄", description: "普通黄色", seedColor: "#7d5700", group: "standard" },
  { id: "green", name: "绿", description: "普通绿色", seedColor: "#2f6f4e", group: "standard" },
  { id: "cyan", name: "青", description: "普通青色", seedColor: "#006b5f", group: "standard" },
  { id: "blue", name: "蓝", description: "普通蓝色", seedColor: "#006a97", group: "standard" },
  { id: "purple", name: "紫", description: "普通紫色", seedColor: "#7257b8", group: "standard" },
  { id: "graphite", name: "灰", description: "普通灰色", seedColor: "#5f6368", group: "standard" },
  { id: "trans-blue", name: "Trans 蓝", description: "Trans Pride Color", seedColor: "#5bcefa", group: "pride", prideFlag: "trans" },
  { id: "trans-pink", name: "Trans 粉", description: "Trans Pride Color", seedColor: "#f5a9b8", group: "pride", prideFlag: "trans" },
  { id: "non-binary-yellow", name: "Non-binary 黄", description: "Non-binary Pride Color", seedColor: "#fff430", group: "pride", prideFlag: "non-binary" },
  { id: "non-binary-purple", name: "Non-binary 紫", description: "Non-binary Pride Color", seedColor: "#9c59d1", group: "pride", prideFlag: "non-binary" },
  { id: "bisexual-pink", name: "Bisexual 粉", description: "Bisexual Pride Color", seedColor: "#d60270", group: "pride", prideFlag: "bisexual" },
  { id: "bisexual-purple", name: "Bisexual 紫", description: "Bisexual Pride Color", seedColor: "#9b4f96", group: "pride", prideFlag: "bisexual" },
  { id: "bisexual-blue", name: "Bisexual 蓝", description: "Bisexual Pride Color", seedColor: "#0038a8", group: "pride", prideFlag: "bisexual" },
  { id: "pansexual-magenta", name: "Pansexual 洋红", description: "Pansexual Pride Color", seedColor: "#ff218c", group: "pride", prideFlag: "pansexual" },
  { id: "pansexual-yellow", name: "Pansexual 黄", description: "Pansexual Pride Color", seedColor: "#ffd800", group: "pride", prideFlag: "pansexual" },
  { id: "pansexual-cyan", name: "Pansexual 青", description: "Pansexual Pride Color", seedColor: "#21b1ff", group: "pride", prideFlag: "pansexual" },
  { id: "lesbian-orange", name: "Lesbian 橙", description: "Lesbian Pride Color", seedColor: "#d52d00", group: "pride", prideFlag: "lesbian" },
  { id: "lesbian-rose", name: "Lesbian 玫红", description: "Lesbian Pride Color", seedColor: "#a30262", group: "pride", prideFlag: "lesbian" },
  { id: "gay-green", name: "Gay 绿", description: "Gay Pride Color", seedColor: "#00a170", group: "pride", prideFlag: "gay" },
  { id: "gay-teal", name: "Gay 蓝绿", description: "Gay Pride Color", seedColor: "#00b9b4", group: "pride", prideFlag: "gay" },
  { id: "gay-blue", name: "Gay 蓝", description: "Gay Pride Color", seedColor: "#3d1a78", group: "pride", prideFlag: "gay" },
  { id: "asexual-purple", name: "Asexual 紫", description: "Asexual Pride Color", seedColor: "#800080", group: "pride", prideFlag: "asexual" },
  { id: "asexual-gray", name: "Asexual 灰", description: "Asexual Pride Color", seedColor: "#a3a3a3", group: "pride", prideFlag: "asexual" },
  { id: "aromantic-green", name: "Aromantic 绿", description: "Aromantic Pride Color", seedColor: "#3da542", group: "pride", prideFlag: "aromantic" },
  { id: "aromantic-mint", name: "Aromantic 薄荷", description: "Aromantic Pride Color", seedColor: "#a7d379", group: "pride", prideFlag: "aromantic" },
  { id: "genderfluid-pink", name: "Genderfluid 粉", description: "Genderfluid Pride Color", seedColor: "#ff76a4", group: "pride", prideFlag: "genderfluid" },
  { id: "genderfluid-purple", name: "Genderfluid 紫", description: "Genderfluid Pride Color", seedColor: "#c011d7", group: "pride", prideFlag: "genderfluid" },
  { id: "genderfluid-blue", name: "Genderfluid 蓝", description: "Genderfluid Pride Color", seedColor: "#2f3cbe", group: "pride", prideFlag: "genderfluid" },
  { id: "genderqueer-lavender", name: "Genderqueer 淡紫", description: "Genderqueer Pride Color", seedColor: "#b57edc", group: "pride", prideFlag: "genderqueer" },
  { id: "genderqueer-green", name: "Genderqueer 绿", description: "Genderqueer Pride Color", seedColor: "#4a8123", group: "pride", prideFlag: "genderqueer" },
  { id: "intersex-yellow", name: "Intersex 黄", description: "Intersex Pride Color", seedColor: "#ffd800", group: "pride", prideFlag: "intersex" },
  { id: "intersex-purple", name: "Intersex 紫", description: "Intersex Pride Color", seedColor: "#7902aa", group: "pride", prideFlag: "intersex" },
  { id: "aroace-orange", name: "Aroace 橙", description: "Aroace Pride Color", seedColor: "#e28c00", group: "pride", prideFlag: "aroace" },
  { id: "aroace-blue", name: "Aroace 蓝", description: "Aroace Pride Color", seedColor: "#203856", group: "pride", prideFlag: "aroace" }
];

export function isValidHexColor(value: string | undefined): value is string {
  return Boolean(value && /^#[0-9a-fA-F]{6}$/.test(value));
}

export function normalizeHexColor(value: string | undefined) {
  if (!value) return "";
  const trimmed = value.trim();
  if (/^[0-9a-fA-F]{6}$/.test(trimmed)) return `#${trimmed}`;
  return trimmed;
}

export function resolveThemeSeed(seedColor: string | undefined) {
  return isValidHexColor(seedColor) ? seedColor : defaultThemeSeed;
}

export function inferThemePreset(seedColor: string | undefined) {
  const seed = resolveThemeSeed(seedColor).toLowerCase();
  return themePresets.find((preset) => preset.seedColor.toLowerCase() === seed)?.id ?? customThemePresetId;
}
