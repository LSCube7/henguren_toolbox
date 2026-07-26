import type { AppLocale } from "./config";

export function resolveRequestLocale(acceptLanguage: string | null): AppLocale {
  const preferredLanguage = acceptLanguage?.split(",", 1)[0]?.split(";", 1)[0]?.trim().toLowerCase();
  return preferredLanguage === "zh" || preferredLanguage?.startsWith("zh-") ? "zh-CN" : "en-US";
}
