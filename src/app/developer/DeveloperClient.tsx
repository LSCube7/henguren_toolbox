"use client";

import { useState } from "react";
import {
  clearDeveloperSyncSource,
  isDeveloperSyncSourceReady,
  readDeveloperSyncSourceDraft,
  testDeveloperSyncSource,
  writeDeveloperSyncSource,
  type DeveloperSyncSource
} from "@/lib/developer-sync-source";
import { useClientSettings, writeClientSettings } from "@/lib/client-settings";
import { useI18n } from "../i18n/AppI18nProvider";
import { SettingsSection } from "../components/SettingsSection";
import { useSnackbar } from "../components/Snackbar";

function valueFrom(event: React.FormEvent<HTMLElement>) {
  return String((event.currentTarget as HTMLElement & { value?: string }).value ?? "");
}

function selectedFrom(event: React.FormEvent<HTMLElement>) {
  const target = event.currentTarget as HTMLElement & { checked?: boolean; selected?: boolean };
  return Boolean(target.selected ?? target.checked);
}

export function DeveloperClient() {
  const settings = useClientSettings();
  const [developerSource, setDeveloperSource] = useState<DeveloperSyncSource>(() => readDeveloperSyncSourceDraft());
  const { t } = useI18n();
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
      <section className="md-card stack">
        <div>
          <h2 className="section-title">{t("developer.disabled.title")}</h2>
          <p className="helper-text">{t("developer.disabled.description")}</p>
        </div>
        <div>
          <md-filled-button href="/settings">{t("developer.disabled.action")}</md-filled-button>
        </div>
      </section>
    );
  }

  return (
    <div className="stack">
      <SettingsSection
        title="settings.translationKeys.title"
        description="settings.translationKeys.description"
        control={
          <md-switch
            selected={Boolean(settings.showTranslationKeys)}
            checked={Boolean(settings.showTranslationKeys)}
            onInput={(event) => updateSettings(selectedFrom(event))}
          />
        }
      />
      <section className="md-card stack developer-panel" aria-label={t("settings.customSync.aria")}>
        <div>
          <h2 className="section-title">{t("settings.customSync.title")}</h2>
          <p className="helper-text">{t("settings.customSync.description")}</p>
        </div>
        <div className="field-grid">
          <md-outlined-text-field label={t("settings.customSync.accountId")} value={developerSource.accountId} onInput={(event) => updateDeveloperSource({ accountId: valueFrom(event) })} />
          <md-outlined-text-field label={t("settings.customSync.bucketName")} value={developerSource.bucketName} onInput={(event) => updateDeveloperSource({ bucketName: valueFrom(event) })} />
          <md-outlined-text-field label={t("settings.customSync.accessKeyId")} value={developerSource.accessKeyId} onInput={(event) => updateDeveloperSource({ accessKeyId: valueFrom(event) })} />
          <md-outlined-text-field
            label={t("settings.customSync.secretAccessKey")}
            type="password"
            value={developerSource.secretAccessKey}
            onInput={(event) => updateDeveloperSource({ secretAccessKey: valueFrom(event) })}
          />
          <md-outlined-text-field label={t("settings.customSync.keyPrefix")} value={developerSource.keyPrefix} onInput={(event) => updateDeveloperSource({ keyPrefix: valueFrom(event) })} />
          <md-outlined-text-field label={t("settings.customSync.profileId")} value={developerSource.profileId} onInput={(event) => updateDeveloperSource({ profileId: valueFrom(event) })} />
        </div>
        <div className="cluster">
          <span className={isDeveloperSyncSourceReady(developerSource) ? "badge" : "badge badge--neutral"}>
            {t(isDeveloperSyncSourceReady(developerSource) ? "settings.customSync.ready" : "settings.customSync.incomplete")}
          </span>
          <md-outlined-button onClick={() => void testDeveloperSource()}>{t("settings.customSync.test")}</md-outlined-button>
          <md-outlined-button onClick={clearDeveloperSource}>{t("settings.customSync.clear")}</md-outlined-button>
        </div>
      </section>
    </div>
  );
}
