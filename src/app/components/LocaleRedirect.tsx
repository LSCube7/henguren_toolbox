"use client";

import { useEffect } from "react";
import { legacyLocaleChoiceParam, localizePath, resolveClientLocale } from "@/lib/localized-routing";
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

export function LocaleRedirect({ logicalPath, queryEntries }: { logicalPath: string; queryEntries: Array<[string, string]> }) {
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
          <form method="get">
            {queryEntries.map(([name, value], index) => <input type="hidden" name={name} value={value} key={index} />)}
            {supportedLocales.map((locale) => (
              <button type="submit" name={legacyLocaleChoiceParam} value={locale} key={locale}>
                {locale === "zh-CN" ? "简体中文" : "English"}
              </button>
            ))}
          </form>
        </nav>
      </div>
    </main>
  );
}
