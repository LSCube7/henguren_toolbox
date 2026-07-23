"use client";

import { useRouter } from "next/navigation";
import type { Route } from "next";
import { SettingsSection } from "../components/SettingsSection";
import { StatusAlert } from "../components/StatusAlert";
import { ThemePicker } from "../components/ThemePicker";
import type { ToolboxSettings } from "@/lib/types";
import { useState } from "react";
import { useEdition, writeEdition } from "@/lib/edition";
import { restartOnboarding } from "@/lib/onboarding";
import { DataManagement } from "./DataManagement";
import { readDeveloperSyncSource, writeDeveloperSettings } from "@/lib/developer-sync-source";
import { useI18n } from "../i18n/AppI18nProvider";
import { isAppLocale } from "@/i18n/config";
import { useClientSettings, writeClientSettings } from "@/lib/client-settings";

function valueFrom(event: React.FormEvent<HTMLElement>) {
  return String((event.currentTarget as HTMLElement & { value?: string }).value ?? "");
}

function checkedFrom(event: React.FormEvent<HTMLElement>) {
  const target = event.currentTarget as HTMLElement & { checked?: boolean; selected?: boolean };
  return Boolean(target.selected ?? target.checked);
}

export function SettingsClient() {
  const router = useRouter();
  const settings = useClientSettings();
  const edition = useEdition();
  const [message, setMessage] = useState("");
  const { locale, t } = useI18n();

  function update(next: Partial<ToolboxSettings>) {
    const value = { ...settings, ...next, updatedAt: new Date().toISOString() };
    writeClientSettings(value);
    window.dispatchEvent(new Event("henguren-theme-change"));
  }

  async function syncSettings() {
    const developerSourceValue = readDeveloperSyncSource();
    if (developerSourceValue) {
      await writeDeveloperSettings(developerSourceValue, {
        ...settings,
        schemaVersion: 1,
        updatedAt: new Date().toISOString()
      });
      setMessage(t("settings.sync.customSuccess"));
      return;
    }
    const response = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings)
    });
    setMessage(response.ok ? t("settings.sync.cloudSuccess") : t("settings.sync.signInRequired"));
  }

  function restartInitialGuide() {
    restartOnboarding();
    router.push("/onboarding?returnTo=/settings&restart=1" as Route);
  }

  return (
    <div className="stack">
      <SettingsSection
        title="settings.learningStage.title"
        description="settings.learningStage.description"
        control={
          <md-filled-select
            key={`${locale}-learning-stage`}
            value={edition}
            onInput={(event) => writeEdition(String((event.currentTarget as HTMLElement & { value?: string }).value ?? "junior") === "senior" ? "senior" : "junior")}
          >
            <md-select-option value="junior">
              <div slot="headline">{t("edition.junior")}</div>
            </md-select-option>
            <md-select-option value="senior">
              <div slot="headline">{t("edition.senior")}</div>
            </md-select-option>
          </md-filled-select>
        }
      />
      <SettingsSection
        title="language.setting.title"
        description="language.setting.description"
        control={
          <md-filled-select
            key={`${locale}-interface-language`}
            value={settings.locale}
            onInput={(event) => {
              const locale = valueFrom(event);
              if (isAppLocale(locale)) update({ locale });
            }}
          >
            <md-select-option value="zh-CN">
              <div slot="headline">{t("language.zh-CN")}</div>
            </md-select-option>
            <md-select-option value="en-US">
              <div slot="headline">{t("language.en-US")}</div>
            </md-select-option>
          </md-filled-select>
        }
      />
      <SettingsSection title="settings.appearance.title" description="settings.appearance.description" control={<ThemePicker settings={settings} onChange={update} />} />
      <SettingsSection
        title="settings.hint.title"
        description="settings.hint.description"
        control={<md-switch selected={settings.showHint} checked={settings.showHint} onInput={(event) => update({ showHint: checkedFrom(event) })} />}
      />
      <SettingsSection
        title="settings.slip.title"
        description="settings.slip.description"
        control={<md-switch selected={settings.enableSlipDetection} checked={settings.enableSlipDetection} onInput={(event) => update({ enableSlipDetection: checkedFrom(event) })} />}
      />
      <SettingsSection
        title="settings.testCount.title"
        description="settings.testCount.description"
        control={<md-outlined-text-field label={t("settings.testCount.label")} type="number" min={1} max={200} value={settings.defaultTestCount} onInput={(event) => update({ defaultTestCount: Number(valueFrom(event)) })} />}
      />
      <SettingsSection
        title="settings.syncStrategy.title"
        description="settings.syncStrategy.description"
        control={
          <md-filled-select key={`${locale}-sync-strategy`} value={settings.syncStrategy} onInput={(event) => update({ syncStrategy: valueFrom(event) as ToolboxSettings["syncStrategy"] })}>
            <md-select-option value="manual">
              <div slot="headline">{t("settings.syncStrategy.manual")}</div>
            </md-select-option>
            <md-select-option value="auto">
              <div slot="headline">{t("settings.syncStrategy.auto")}</div>
            </md-select-option>
          </md-filled-select>
        }
      />
      <SettingsSection
        title="settings.sync.title"
        description="settings.sync.description"
        control={<md-filled-button onClick={() => void syncSettings()}>{t("settings.sync.action")}</md-filled-button>}
      />
      <SettingsSection
        title="settings.onboarding.title"
        description="settings.onboarding.description"
        control={<md-outlined-button onClick={restartInitialGuide}>{t("settings.onboarding.action")}</md-outlined-button>}
      />
      <DataManagement />
      <section className="settings-group" aria-labelledby="advanced-settings-title">
        <div className="settings-group__header">
          <p className="breadcrumb">Settings</p>
          <h2 className="section-title" id="advanced-settings-title">
            {t("settings.advanced.title")}
          </h2>
          <p className="helper-text">{t("settings.advanced.description")}</p>
        </div>
        <SettingsSection
          title="settings.developerMode.title"
          description="settings.developerMode.description"
          control={<md-switch selected={Boolean(settings.developerMode)} checked={Boolean(settings.developerMode)} onInput={(event) => update({ developerMode: checkedFrom(event) })} />}
        />
      </section>
      <StatusAlert message={message} />
    </div>
  );
}
