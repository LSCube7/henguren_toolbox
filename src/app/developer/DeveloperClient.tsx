"use client";

import { TextField } from "@/app/components/TextField";
import { M3eButton } from "@m3e/react/button";
import { M3eCard } from "@m3e/react/card";
import { M3eSwitch } from "@m3e/react/switch";

import { useMemo, useState } from "react";
import {
  clearDeveloperSyncSource,
  isDeveloperSyncSourceReady,
  readDeveloperSyncSourceDraft,
  writeDeveloperSyncSource,
  type DeveloperSyncSource
} from "@/lib/developer-sync-config";
import { useClientSettings, writeClientSettings } from "@/lib/client-settings";
import { useI18n } from "../i18n/AppI18nProvider";
import { SettingsSection } from "../components/SettingsSection";
import { useSnackbar } from "../components/Snackbar";
import { defaultSettingsForLocale } from "@/lib/types";
import { localizePath } from "@/lib/localized-routing";

function valueFrom(event: Event | React.FormEvent<HTMLElement>) {
  return String((event.currentTarget as HTMLElement & { value?: string }).value ?? "");
}

function selectedFrom(event: Event | React.FormEvent<HTMLElement>) {
  return Boolean((event.currentTarget as HTMLElement & { checked?: boolean }).checked);
}

export function DeveloperClient() {
  const [developerSource, setDeveloperSource] = useState<DeveloperSyncSource>(() => readDeveloperSyncSourceDraft());
  const { locale, t } = useI18n();
  const fallbackSettings = useMemo(() => defaultSettingsForLocale(locale), [locale]);
  const settings = useClientSettings(fallbackSettings);
  const { showSnackbar } = useSnackbar();

  function updateSettings(showTranslationKeys: boolean) {
    writeClientSettings({ ...settings, showTranslationKeys, updatedAt: new Date().toISOString() });
  }

  function updateDeveloperSource(next: Partial<DeveloperSyncSource>) {
    const value = { ...developerSource, ...next, type: "r2" as const, updatedAt: new Date().toISOString() };
    setDeveloperSource(value);
    writeDeveloperSyncSource(value);
  }

  async function testDeveloperSource() {
    try {
      const { testDeveloperSyncSource } = await import("@/lib/developer-sync-source");
      await testDeveloperSyncSource(developerSource);
      showSnackbar(t("settings.customSync.testSuccess"));
    } catch {
      showSnackbar(t("settings.customSync.testError"), "error");
    }
  }

  function clearDeveloperSource() {
    clearDeveloperSyncSource();
    setDeveloperSource(readDeveloperSyncSourceDraft());
    showSnackbar(t("settings.customSync.clearSuccess"));
  }

  if (!settings.developerMode) {
    return (
      <M3eCard variant="filled">
        <section className="settings-group-content stack" aria-labelledby="developer-disabled-title">
          <div>
            <h2 className="section-title" id="developer-disabled-title">{t("developer.disabled.title")}</h2>
            <p className="helper-text">{t("developer.disabled.description")}</p>
          </div>
          <div>
            <M3eButton variant="filled" href={localizePath(locale, "/settings")}>{t("developer.disabled.action")}</M3eButton>
          </div>
        </section>
      </M3eCard>
    );
  }

  return (
    <M3eCard variant="filled">
      <div className="settings-group-content stack">
        <SettingsSection
          title="settings.translationKeys.title"
          description="settings.translationKeys.description"
          control={
            <M3eSwitch
              aria-label={t("settings.translationKeys.title")}
              checked={Boolean(settings.showTranslationKeys)}
              onInput={(event) => updateSettings(selectedFrom(event))}
            />
          }
        />
        <section className="settings-group-section stack developer-panel" aria-label={t("settings.customSync.aria")}>
            <div>
              <h2 className="section-title">{t("settings.customSync.title")}</h2>
              <p className="helper-text">{t("settings.customSync.description")}</p>
            </div>
            <div className="field-grid">
              <TextField label={t("settings.customSync.accountId")} value={developerSource.accountId} onInput={(event) => updateDeveloperSource({ accountId: valueFrom(event) })} />
              <TextField label={t("settings.customSync.bucketName")} value={developerSource.bucketName} onInput={(event) => updateDeveloperSource({ bucketName: valueFrom(event) })} />
              <TextField label={t("settings.customSync.accessKeyId")} value={developerSource.accessKeyId} onInput={(event) => updateDeveloperSource({ accessKeyId: valueFrom(event) })} />
              <TextField
                label={t("settings.customSync.secretAccessKey")}
                type="password"
                value={developerSource.secretAccessKey}
                onInput={(event) => updateDeveloperSource({ secretAccessKey: valueFrom(event) })}
              />
              <TextField label={t("settings.customSync.keyPrefix")} value={developerSource.keyPrefix} onInput={(event) => updateDeveloperSource({ keyPrefix: valueFrom(event) })} />
              <TextField label={t("settings.customSync.profileId")} value={developerSource.profileId} onInput={(event) => updateDeveloperSource({ profileId: valueFrom(event) })} />
            </div>
            <div className="cluster">
              <span className={isDeveloperSyncSourceReady(developerSource) ? "badge" : "badge badge--neutral"}>
                {t(isDeveloperSyncSourceReady(developerSource) ? "settings.customSync.ready" : "settings.customSync.incomplete")}
              </span>
              <M3eButton variant="outlined" onClick={() => void testDeveloperSource()}>{t("settings.customSync.test")}</M3eButton>
              <M3eButton variant="outlined" onClick={clearDeveloperSource}>{t("settings.customSync.clear")}</M3eButton>
            </div>
        </section>
      </div>
    </M3eCard>
  );
}
