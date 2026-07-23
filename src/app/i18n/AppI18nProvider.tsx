"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useSyncExternalStore } from "react";
import {
  defaultLocale,
  isAppLocale,
  translate,
  type AppLocale,
  type MessageKey,
  type MessageValues
} from "@/i18n/config";
import { useClientSettings } from "@/lib/client-settings";

type I18nContextValue = {
  locale: AppLocale;
  showTranslationKeys: boolean;
  t: (key: MessageKey, values?: MessageValues) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function AppI18nProvider({ children }: { children: React.ReactNode }) {
  const settings = useClientSettings();
  const locale = isAppLocale(settings.locale) ? settings.locale : defaultLocale;
  const showTranslationKeys = settings.developerMode === true && settings.showTranslationKeys === true;
  const mounted = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false
  );

  useEffect(() => {
    document.documentElement.lang = locale;
    document.title = showTranslationKeys ? "app.name" : translate(locale, "app.name");
  }, [locale, showTranslationKeys]);

  const t = useCallback(
    (key: MessageKey, values?: MessageValues) => (showTranslationKeys ? key : translate(locale, key, values)),
    [locale, showTranslationKeys]
  );
  const value = useMemo(() => ({ locale, showTranslationKeys, t }), [locale, showTranslationKeys, t]);

  if (!mounted) return null;

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const value = useContext(I18nContext);
  if (!value) throw new Error("useI18n must be used within AppI18nProvider.");
  return value;
}
