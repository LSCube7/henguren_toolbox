"use client";

import { useEffect, useMemo } from "react";
import { localizePath, resolveClientLocale } from "@/lib/localized-routing";
import { toolboxSettingsKey } from "@/lib/client-settings";
import { isAppLocale, supportedLocales, type AppLocale } from "@/i18n/config";

function readSavedLocale(): AppLocale | null {
  try {
    const serialized = localStorage.getItem(toolboxSettingsKey);
    if (!serialized) return null;
    const parsed = JSON.parse(serialized) as { locale?: unknown };
    return isAppLocale(parsed.locale) ? parsed.locale : null;
  } catch {
    return null;
  }
}

function browserLanguages() {
  if (typeof navigator === "undefined") return [];
  return Array.from(new Set([...(navigator.languages ?? []), navigator.language].filter(Boolean)));
}

export function LocaleRedirect({ logicalPath }: { logicalPath: string }) {
  const fallbackLinks = useMemo(
    () => supportedLocales.map((locale) => ({ locale, href: localizePath(locale, logicalPath) })),
    [logicalPath]
  );

  useEffect(() => {
    const locale = readSavedLocale() ?? resolveClientLocale(null, browserLanguages());
    const target = localizePath(locale, `${logicalPath}${window.location.search}${window.location.hash}`);
    if (window.location.pathname !== target.split(/[?#]/, 1)[0]) {
      window.location.replace(target);
    }
  }, [logicalPath]);

  return (
    <main className="locale-redirect" aria-labelledby="locale-redirect-title">
      <div className="locale-redirect__card">
        <h1 id="locale-redirect-title">Henguren Toolbox</h1>
        <p>Choose a language / 请选择语言</p>
        <nav aria-label="Language / 语言">
          {fallbackLinks.map(({ locale, href }) => (
            <a href={href} key={locale}>
              {locale === "zh-CN" ? "简体中文" : "English"}
            </a>
          ))}
        </nav>
      </div>
    </main>
  );
}

export function LegacyLocaleRedirectPage({ logicalPath }: { logicalPath: string }) {
  return <LocaleRedirect logicalPath={logicalPath} />;
}
