import type { AppLocale } from "./config";

export function resolveRequestLocale(acceptLanguage: string | null): AppLocale {
  const preferredLanguage = acceptLanguage
    ?.split(",")
    .map((entry, index) => {
      const [language, ...parameters] = entry.split(";");
      const qualityParameter = parameters.find((parameter) => parameter.trim().toLowerCase().startsWith("q="));
      const parsedQuality = qualityParameter ? Number.parseFloat(qualityParameter.split("=", 2)[1]) : 1;
      const quality = Number.isFinite(parsedQuality) && parsedQuality >= 0 && parsedQuality <= 1 ? parsedQuality : 0;
      return { language: language.trim().toLowerCase(), quality, index };
    })
    .filter(({ language, quality }) => language.length > 0 && quality > 0)
    .sort((left, right) => right.quality - left.quality || left.index - right.index)[0]?.language;
  return preferredLanguage === "zh" || preferredLanguage?.startsWith("zh-") ? "zh-CN" : "en-US";
}
