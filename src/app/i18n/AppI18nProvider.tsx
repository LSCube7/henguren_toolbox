"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import {
  defaultLocale,
  isAppLocale,
  translate,
  type AppLocale,
  type MessageKey,
  type MessageValues
} from "@/i18n/config";

const settingsKey = "henguren-v3-settings";
export const languageChangeEvent = "henguren-language-change";

type I18nContextValue = {
  locale: AppLocale;
  showTranslationKeys: boolean;
  t: (key: MessageKey, values?: MessageValues) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

type StoredI18nState = {
  locale: AppLocale;
  showTranslationKeys: boolean;
};

function readStoredI18nState(): StoredI18nState {
  const fallback = { locale: defaultLocale, showTranslationKeys: false };
  if (typeof window === "undefined") return fallback;
  try {
    const saved = localStorage.getItem(settingsKey);
    if (!saved) return fallback;
    const settings = JSON.parse(saved) as {
      developerMode?: unknown;
      locale?: unknown;
      showTranslationKeys?: unknown;
    };
    return {
      locale: isAppLocale(settings.locale) ? settings.locale : defaultLocale,
      showTranslationKeys: settings.developerMode === true && settings.showTranslationKeys === true
    };
  } catch {
    return fallback;
  }
}

export function AppI18nProvider({ children }: { children: React.ReactNode }) {
  const [i18nState, setI18nState] = useState<StoredI18nState>(() => readStoredI18nState());
  const { locale, showTranslationKeys } = i18nState;
  const mounted = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false
  );

  useEffect(() => {
    function refreshI18nState() {
      setI18nState(readStoredI18nState());
    }

    refreshI18nState();
    window.addEventListener("storage", refreshI18nState);
    window.addEventListener(languageChangeEvent, refreshI18nState);
    return () => {
      window.removeEventListener("storage", refreshI18nState);
      window.removeEventListener(languageChangeEvent, refreshI18nState);
    };
  }, []);

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
