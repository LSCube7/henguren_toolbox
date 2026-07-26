"use client";

import { createContext, useCallback, useContext, useEffect, useMemo } from "react";
import {
  defaultLocale,
  isAppLocale,
  translate,
  type AppLocale,
  type MessageKey,
  type MessageValues
} from "@/i18n/config";
import { useClientSettings } from "@/lib/client-settings";
import { defaultSettings } from "@/lib/types";

type I18nContextValue = {
  locale: AppLocale;
  showTranslationKeys: boolean;
  t: (key: MessageKey, values?: MessageValues) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function AppI18nProvider({ children, initialLocale }: { children: React.ReactNode; initialLocale: AppLocale }) {
  const fallbackSettings = useMemo(() => ({ ...defaultSettings, locale: initialLocale }), [initialLocale]);
  const settings = useClientSettings(fallbackSettings);
  const locale = isAppLocale(settings.locale) ? settings.locale : defaultLocale;
  const showTranslationKeys = settings.developerMode === true && settings.showTranslationKeys === true;

  useEffect(() => {
    document.documentElement.lang = locale;
    document.title = showTranslationKeys ? "app.name" : translate(locale, "app.name");
  }, [locale, showTranslationKeys]);

  const t = useCallback(
    (key: MessageKey, values?: MessageValues) => (showTranslationKeys ? key : translate(locale, key, values)),
    [locale, showTranslationKeys]
  );
  const value = useMemo(() => ({ locale, showTranslationKeys, t }), [locale, showTranslationKeys, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const value = useContext(I18nContext);
  if (!value) throw new Error("useI18n must be used within AppI18nProvider.");
  return value;
}
