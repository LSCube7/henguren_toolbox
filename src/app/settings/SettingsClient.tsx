"use client";

import { SelectField } from "@/app/components/SelectField";
import { M3eOption } from "@m3e/react/option";
import { TextField } from "@/app/components/TextField";

import { M3eButton } from "@m3e/react/button";
import { M3eCard } from "@m3e/react/card";
import { M3eSwitch } from "@m3e/react/switch";

import { usePathname, useRouter } from "next/navigation";
import type { Route } from "next";
import { useMemo } from "react";
import { SettingsSection } from "../components/SettingsSection";
import { useSnackbar } from "../components/Snackbar";
import { ThemePicker } from "../components/ThemePicker";
import { defaultSettingsForLocale, type ToolboxSettings } from "@/lib/types";
import { useEdition, writeEdition } from "@/lib/edition";
import { restartOnboarding } from "@/lib/onboarding";
import { LearningOwnerGate } from "../components/LearningOwnerGate";
import { DataManagement } from "./DataManagement";
import { readDeveloperSyncSource } from "@/lib/developer-sync-config";
import { useI18n } from "../i18n/AppI18nProvider";
import { isAppLocale } from "@/i18n/config";
import { useClientSettings, writeClientSettings } from "@/lib/client-settings";
import { localizePath, stripLocalePrefix } from "@/lib/localized-routing";

function valueFrom(event: Event | React.FormEvent<HTMLElement>) {
  return String((event.currentTarget as HTMLElement & { value?: string }).value ?? "");
}

function checkedFrom(event: Event | React.FormEvent<HTMLElement>) {
  return Boolean((event.currentTarget as HTMLElement & { checked?: boolean }).checked);
}

export function SettingsClient() {
  const router = useRouter();
  const pathname = usePathname();
  const { locale, t } = useI18n();
  const fallbackSettings = useMemo(() => defaultSettingsForLocale(locale), [locale]);
  const settings = useClientSettings(fallbackSettings);
  const edition = useEdition();
  const { showSnackbar } = useSnackbar();

  function update(next: Partial<ToolboxSettings>) {
    const value = { ...settings, ...next, updatedAt: new Date().toISOString() };
    writeClientSettings(value);
    window.dispatchEvent(new Event("henguren-theme-change"));
    if (next.locale && isAppLocale(next.locale) && next.locale !== locale) {
      const currentUrl = `${stripLocalePrefix(pathname)}${window.location.search}${window.location.hash}`;
      router.replace(localizePath(next.locale, currentUrl) as Route);
    }
  }

  async function syncSettings() {
    const developerSourceValue = readDeveloperSyncSource();
    if (developerSourceValue) {
      const { writeDeveloperSettings } = await import("@/lib/developer-sync-source");
      await writeDeveloperSettings(developerSourceValue, {
        ...settings,
        schemaVersion: 1,
        updatedAt: new Date().toISOString()
      });
      showSnackbar(t("settings.sync.customSuccess"));
      return;
    }
    const response = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings)
    });
    showSnackbar(response.ok ? t("settings.sync.cloudSuccess") : t("settings.sync.signInRequired"), response.ok ? "info" : "error");
  }

  function restartInitialGuide() {
    restartOnboarding();
    const returnTo = localizePath(locale, "/settings");
    router.push(localizePath(locale, `/onboarding?returnTo=${encodeURIComponent(returnTo)}&restart=1`) as Route);
  }

  return (
    <div className="stack">
      <M3eCard variant="filled">
        <div className="settings-group-content settings-list">
          <SettingsSection
            title="settings.learningStage.title"
            description="settings.learningStage.description"
            control={
              <SelectField
                label={t("settings.learningStage.title")}
                key={`${locale}-learning-stage`}
                value={edition}
                onInput={(event) => writeEdition(String((event.currentTarget as HTMLElement & { value?: string }).value ?? "junior") === "senior" ? "senior" : "junior")}
              >
                <M3eOption value="junior">
                  <div>{t("edition.junior")}</div>
                </M3eOption>
                <M3eOption value="senior">
                  <div>{t("edition.senior")}</div>
                </M3eOption>
              </SelectField>
            }
          />
          <SettingsSection
            title="language.setting.title"
            description="language.setting.description"
            control={
              <SelectField
                label={t("language.setting.title")}
                key={`${locale}-interface-language`}
                value={locale}
                onInput={(event) => {
                  const locale = valueFrom(event);
                  if (isAppLocale(locale)) update({ locale });
                }}
              >
                <M3eOption value="zh-CN">
                  <div>{t("language.zh-CN")}</div>
                </M3eOption>
                <M3eOption value="en-US">
                  <div>{t("language.en-US")}</div>
                </M3eOption>
              </SelectField>
            }
          />
          <SettingsSection title="settings.appearance.title" description="settings.appearance.description" control={<ThemePicker settings={settings} onChange={update} />} />
          <SettingsSection
            title="settings.hint.title"
            description="settings.hint.description"
            control={<M3eSwitch aria-label={t("settings.hint.title")} checked={settings.showHint} onInput={(event) => update({ showHint: checkedFrom(event) })} />}
          />
          <SettingsSection
            title="settings.slip.title"
            description="settings.slip.description"
            control={<M3eSwitch aria-label={t("settings.slip.title")} checked={settings.enableSlipDetection} onInput={(event) => update({ enableSlipDetection: checkedFrom(event) })} />}
          />
          <SettingsSection
            title="settings.testCount.title"
            description="settings.testCount.description"
            control={<TextField label={t("settings.testCount.label")} type="number" min={1} max={200} value={settings.defaultTestCount} onInput={(event) => update({ defaultTestCount: Number(valueFrom(event)) })} />}
          />
          <SettingsSection
            title="settings.sync.title"
            description="settings.sync.description"
            control={<M3eButton variant="filled" onClick={() => void syncSettings()}>{t("settings.sync.action")}</M3eButton>}
          />
          <SettingsSection
            title="settings.onboarding.title"
            description="settings.onboarding.description"
            control={<M3eButton variant="outlined" onClick={restartInitialGuide}>{t("settings.onboarding.action")}</M3eButton>}
          />
        </div>
      </M3eCard>
      <LearningOwnerGate><DataManagement fallbackSettings={fallbackSettings} /></LearningOwnerGate>
      <section className="settings-group" aria-labelledby="advanced-settings-title">
        <M3eCard variant="filled">
          <div className="settings-group-content stack">
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
              control={<M3eSwitch aria-label={t("settings.developerMode.title")} checked={Boolean(settings.developerMode)} onInput={(event) => update({ developerMode: checkedFrom(event) })} />}
            />
          </div>
        </M3eCard>
      </section>
    </div>
  );
}
