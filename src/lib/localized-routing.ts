import { defaultLocale, isAppLocale, type AppLocale } from "../i18n/config.ts";

/**
 * Return the locale encoded in a pathname, or null when the pathname is a
 * legacy/unprefixed route.
 */
export function getLocaleFromPathname(pathname: string): AppLocale | null {
  const match = pathname.match(/^\/([^/?#]+)(?=\/|$)/);
  return match && isAppLocale(match[1]) ? match[1] : null;
}

/**
 * Remove a locale prefix while preserving query parameters and hash fragments.
 */
export function stripLocalePrefix(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  const splitAt = normalized.search(/[?#]/);
  const pathname = splitAt >= 0 ? normalized.slice(0, splitAt) : normalized;
  const suffix = splitAt >= 0 ? normalized.slice(splitAt) : "";
  const match = pathname.match(/^\/([^/]+)(?=\/|$)/);
  if (!match || !isAppLocale(match[1])) return `${pathname || "/"}${suffix}`;
  const rest = pathname.slice(match[0].length);
  return `${rest || "/"}${suffix}`;
}

/**
 * Add or replace the locale prefix on an internal path. Existing prefixes are
 * replaced so callers can safely pass either logical or already-localized
 * paths.
 */
export function localizePath(locale: AppLocale, path: string): string {
  const logicalPath = stripLocalePrefix(path || "/");
  const splitAt = logicalPath.search(/[?#]/);
  const pathname = splitAt >= 0 ? logicalPath.slice(0, splitAt) : logicalPath;
  const suffix = splitAt >= 0 ? logicalPath.slice(splitAt) : "";
  const normalizedPath = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return `/${locale}${normalizedPath === "/" ? "" : normalizedPath}${suffix}`;
}

/**
 * Resolve a browser-side locale without a request-time header read. A saved
 * setting wins over browser preferences, then the application default.
 */
export function resolveClientLocale(savedLocale: unknown, languages: readonly string[] = []): AppLocale {
  if (isAppLocale(savedLocale)) return savedLocale;

  for (const language of languages) {
    const normalized = language.toLowerCase();
    if (normalized === "zh" || normalized.startsWith("zh-")) return "zh-CN";
    if (normalized === "en" || normalized.startsWith("en-")) return "en-US";
  }

  return defaultLocale;
}

export function pathWithoutLocale(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  const splitAt = normalized.search(/[?#]/);
  return splitAt >= 0 ? normalized.slice(0, splitAt) : normalized;
}
