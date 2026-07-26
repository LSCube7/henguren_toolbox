import type { AppLocale } from "./config";

export function resolveRequestLocale(acceptLanguage: string | null): AppLocale {
  const preferences = acceptLanguage
    ?.split(",")
    .map((entry, index) => {
      const [language, ...parameters] = entry.split(";");
      const qualityParameter = parameters.find((parameter) => parameter.trim().toLowerCase().startsWith("q="));
      const parsedQuality = qualityParameter ? Number.parseFloat(qualityParameter.split("=", 2)[1]) : 1;
      const quality = Number.isFinite(parsedQuality) && parsedQuality >= 0 && parsedQuality <= 1 ? parsedQuality : 0;
      return { language: language.trim().toLowerCase(), quality, index };
    })
    .filter(({ language }) => language.length > 0) ?? [];
  const wildcardPreferences = preferences.filter(({ language }) => language === "*");
  const preferredLocale = ([
    { locale: "en-US", prefix: "en", defaultOrder: 0 },
    { locale: "zh-CN", prefix: "zh", defaultOrder: 1 }
  ] as const)
    .flatMap(({ locale, prefix, defaultOrder }) => {
      const explicitPreferences = preferences.filter(({ language }) => language === prefix || language.startsWith(`${prefix}-`));
      const matches = explicitPreferences.length > 0 ? explicitPreferences : wildcardPreferences;
      const preferredMatch = [...matches].sort((left, right) => right.quality - left.quality || left.index - right.index)[0];
      return preferredMatch && preferredMatch.quality > 0
        ? [{ locale, quality: preferredMatch.quality, index: preferredMatch.index, defaultOrder }]
        : [];
    })
    .sort((left, right) => right.quality - left.quality || left.index - right.index || left.defaultOrder - right.defaultOrder)[0]?.locale;
  return preferredLocale ?? "en-US";
}
