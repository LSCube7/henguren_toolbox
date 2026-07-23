"use client";

import { useRouter, useSearchParams } from "next/navigation";
import type { Route } from "next";
import { useEffect, useState, useSyncExternalStore } from "react";
import { MaterialIcon } from "../components/MaterialIcon";
import { ThemePicker } from "../components/ThemePicker";
import { completeOnboarding, onboardingLoginDecisionStorageKey, onboardingStepStorageKey } from "@/lib/onboarding";
import { readEdition, writeEdition, type Edition } from "@/lib/edition";
import { defaultSettings, type ToolboxSettings, type UserSession } from "@/lib/types";
import { readClientSettings, writeClientSettings } from "@/lib/client-settings";
import { useI18n } from "../i18n/AppI18nProvider";
import type { MessageKey } from "@/i18n/config";

type StepId = "login" | "cloud" | "edition" | "theme" | "sync" | "done";
type CloudStatus = "idle" | "loading" | "available" | "empty" | "error" | "skipped";
type CloudDecision = "cloud" | "local" | null;

const steps: Array<{ id: StepId; title: MessageKey; description: MessageKey }> = [
  { id: "login", title: "onboarding.login.title", description: "onboarding.login.description" },
  { id: "cloud", title: "onboarding.cloud.title", description: "onboarding.cloud.description" },
  { id: "edition", title: "onboarding.edition.title", description: "onboarding.edition.description" },
  { id: "theme", title: "onboarding.theme.title", description: "onboarding.theme.description" },
  { id: "sync", title: "onboarding.sync.title", description: "onboarding.sync.description" },
  { id: "done", title: "onboarding.done.title", description: "onboarding.done.description" }
];

type CloudSettingsResponse = {
  available: boolean;
  settings: Partial<ToolboxSettings> | null;
};

const onboardingFlowVersion = "v2";

const authMessages: Record<string, MessageKey> = {
  ok: "auth.okOnboarding",
  missing_code_state: "auth.missingCode",
  missing_oauth_cookie: "auth.missingCookie",
  state_mismatch: "auth.stateMismatch",
  unconfigured: "auth.unconfigured",
  code_expired: "auth.codeExpired",
  invalid_grant: "auth.invalidGrant",
  token_http: "auth.tokenHttp",
  token_no_access_token: "auth.noAccessToken",
  userinfo_http: "auth.userinfoHttp"
};

function subscribeNoop() {
  return () => undefined;
}

function writeSettings(settings: ToolboxSettings) {
  writeClientSettings(settings);
  window.dispatchEvent(new Event("henguren-theme-change"));
}

function formatTimestamp(value: string, locale: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function readLoginSkipped() {
  return typeof window !== "undefined" && sessionStorage.getItem(onboardingLoginDecisionStorageKey) === "skipped";
}

function stepIndexFromStorage() {
  if (typeof window === "undefined") return 0;
  const savedValue = sessionStorage.getItem(onboardingStepStorageKey);
  const saved = savedValue?.startsWith(`${onboardingFlowVersion}:`) ? (savedValue.slice(onboardingFlowVersion.length + 1) as StepId) : null;
  const index = steps.findIndex((step) => step.id === saved);
  return index >= 0 ? index : 0;
}

function safeReturnTo(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
  if (value.startsWith("/api/") || value.startsWith("/onboarding")) return "/";
  return value;
}

export function OnboardingClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const mounted = useSyncExternalStore(subscribeNoop, () => true, () => false);
  const { locale, t } = useI18n();
  const returnTo = safeReturnTo(searchParams.get("returnTo"));
  const [stepIndex, setStepIndex] = useState(() => stepIndexFromStorage());
  const [settings, setSettings] = useState<ToolboxSettings>(() => readClientSettings());
  const [localSettingsBeforeCloud] = useState<ToolboxSettings>(settings);
  const [edition, setEdition] = useState<Edition>(() => readEdition());
  const [user, setUser] = useState<UserSession | null>(null);
  const [userLoading, setUserLoading] = useState(true);
  const [loginSkipped, setLoginSkipped] = useState(() => readLoginSkipped());
  const [cloudStatus, setCloudStatus] = useState<CloudStatus>(() => (readLoginSkipped() ? "skipped" : "idle"));
  const [cloudSettings, setCloudSettings] = useState<ToolboxSettings | null>(null);
  const [cloudDecision, setCloudDecision] = useState<CloudDecision>(null);
  const [cloudErrorStatus, setCloudErrorStatus] = useState("");
  const [cloudCheckVersion, setCloudCheckVersion] = useState(0);
  const authMessageKey = authMessages[searchParams.get("auth") ?? ""];
  const message = authMessageKey ? t(authMessageKey) : "";
  const step = steps[stepIndex];
  const canGoNext =
    step.id === "login"
      ? !userLoading && (Boolean(user) || loginSkipped)
      : step.id === "cloud"
        ? cloudStatus !== "idle" && cloudStatus !== "loading" && (cloudStatus !== "available" || cloudDecision !== null)
        : true;

  useEffect(() => {
    if (!mounted) return;
    sessionStorage.setItem(onboardingStepStorageKey, `${onboardingFlowVersion}:${step.id}`);
  }, [mounted, step.id]);

  useEffect(() => {
    let active = true;
    async function loadUser() {
      setUserLoading(true);
      try {
        const response = await fetch("/api/me");
        const data = (await response.json()) as { authenticated: boolean; user: UserSession | null };
        if (active) {
          setUser(data.user);
          if (data.user) {
            sessionStorage.removeItem(onboardingLoginDecisionStorageKey);
            setLoginSkipped(false);
          } else if (!readLoginSkipped()) {
            setStepIndex(0);
          }
        }
      } catch {
        if (active) {
          setUser(null);
          if (!readLoginSkipped()) setStepIndex(0);
        }
      } finally {
        if (active) setUserLoading(false);
      }
    }
    void loadUser();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!user) return;

    let active = true;
    async function loadCloudSettings() {
      setCloudStatus("loading");
      setCloudDecision(null);
      setCloudErrorStatus("");
      try {
        const response = await fetch("/api/settings?availability=1", { cache: "no-store" });
        if (!response.ok) {
          if (active) {
            setCloudSettings(null);
            setCloudErrorStatus(String(response.status));
            setCloudStatus("error");
          }
          return;
        }
        const data = (await response.json()) as CloudSettingsResponse;
        if (!active) return;
        if (!data.available || !data.settings) {
          setCloudSettings(null);
          setCloudStatus("empty");
          return;
        }
        setCloudSettings({ ...defaultSettings, ...data.settings, schemaVersion: 1 });
        setCloudStatus("available");
      } catch {
        if (active) {
          setCloudSettings(null);
          setCloudErrorStatus("NETWORK_ERROR");
          setCloudStatus("error");
        }
      }
    }

    void loadCloudSettings();
    return () => {
      active = false;
    };
  }, [cloudCheckVersion, user]);

  function updateSettings(next: Partial<ToolboxSettings>) {
    const value = { ...settings, ...next, updatedAt: new Date().toISOString() };
    setSettings(value);
    writeSettings(value);
  }

  function updateEdition(next: Edition) {
    setEdition(next);
    writeEdition(next);
  }

  function goNext() {
    if (!canGoNext) return;
    if (stepIndex < steps.length - 1) {
      setStepIndex((current) => current + 1);
      return;
    }
    completeOnboarding();
    router.replace(returnTo as Route);
  }

  function goBack() {
    setStepIndex((current) => Math.max(0, current - 1));
  }

  function startLogin() {
    sessionStorage.removeItem(onboardingLoginDecisionStorageKey);
    sessionStorage.setItem(onboardingStepStorageKey, `${onboardingFlowVersion}:login`);
    const target = `/onboarding?returnTo=${encodeURIComponent(returnTo)}`;
    window.location.href = `/api/auth/login?returnTo=${encodeURIComponent(target)}`;
  }

  function skipLogin() {
    sessionStorage.setItem(onboardingLoginDecisionStorageKey, "skipped");
    setLoginSkipped(true);
    setCloudStatus("skipped");
  }

  function applyCloudSettings() {
    if (!cloudSettings) return;
    setSettings(cloudSettings);
    writeSettings(cloudSettings);
    setCloudDecision("cloud");
  }

  function keepLocalSettings() {
    if (cloudDecision === "cloud") {
      setSettings(localSettingsBeforeCloud);
      writeSettings(localSettingsBeforeCloud);
    }
    setCloudDecision("local");
  }

  function retryCloudSettings() {
    setCloudCheckVersion((current) => current + 1);
  }

  if (!mounted) return null;

  return (
    <section className="onboarding-shell onboarding-shell--route" aria-label={t("onboarding.aria")}>
      <div className="onboarding-panel">
        <div className="onboarding-progress" aria-label={t("onboarding.progress")}>
          {steps.map((item, index) => (
            <span className="onboarding-progress__dot" data-active={index <= stepIndex} key={item.id} />
          ))}
        </div>
        <div className="onboarding-header">
          <span className="onboarding-mark" aria-hidden="true">
            <MaterialIcon name={step.id === "done" ? "check" : "auto_awesome"} />
          </span>
          <div>
            <p className="breadcrumb">{t("onboarding.step", { current: stepIndex + 1, total: steps.length })}</p>
            <h1 className="page-title">{t(step.title)}</h1>
            <p className="page-description">{t(step.description)}</p>
          </div>
        </div>

        <div className="onboarding-content">
          {step.id === "edition" ? (
            <div className="onboarding-choice-grid" role="radiogroup" aria-label={t("onboarding.edition.aria")}>
              <button className="onboarding-choice" type="button" data-selected={edition === "junior"} onClick={() => updateEdition("junior")}>
                <MaterialIcon name="school" />
                <span>{t("edition.junior")}</span>
                <small>{t("onboarding.edition.juniorTools")}</small>
              </button>
              <button className="onboarding-choice" type="button" data-selected={edition === "senior"} onClick={() => updateEdition("senior")}>
                <MaterialIcon name="workspace_premium" />
                <span>{t("edition.senior")}</span>
                <small>{t("onboarding.edition.seniorTools")}</small>
              </button>
            </div>
          ) : null}

          {step.id === "theme" ? <ThemePicker settings={settings} onChange={updateSettings} /> : null}

          {step.id === "login" ? (
            <div className="onboarding-login">
              <span className="onboarding-login__icon" aria-hidden="true">
                <MaterialIcon name={user ? "account_circle" : "person"} />
              </span>
              <div>
                <h3 className="card-title">{userLoading ? t("onboarding.signIn.loading") : user ? user.name : t("user.signedOut")}</h3>
                <p className="helper-text">{user ? user.email || user.id : t("onboarding.signIn.requiredChoice")}</p>
              </div>
              <div className="cluster">
                <md-outlined-button onClick={skipLogin} disabled={Boolean(user)}>
                  {t("onboarding.signIn.skip")}
                </md-outlined-button>
                <md-filled-button onClick={startLogin}>{t("onboarding.signIn.action")}</md-filled-button>
              </div>
            </div>
          ) : null}

          {step.id === "cloud" ? (
            <div className="stack">
              <div className="onboarding-login">
                <span className="onboarding-login__icon" aria-hidden="true">
                  <MaterialIcon
                    name={
                      cloudStatus === "error"
                        ? "cloud_alert"
                        : cloudStatus === "available"
                          ? "cloud_download"
                          : cloudStatus === "empty" || cloudStatus === "skipped"
                            ? "cloud_off"
                            : "cloud_sync"
                    }
                  />
                </span>
                <div>
                  <h3 className="card-title">
                    {t(
                      cloudStatus === "available"
                        ? "onboarding.cloud.availableTitle"
                        : cloudStatus === "empty"
                          ? "onboarding.cloud.emptyTitle"
                          : cloudStatus === "error"
                            ? "onboarding.cloud.errorTitle"
                            : cloudStatus === "skipped"
                              ? "onboarding.cloud.skippedTitle"
                              : "onboarding.cloud.loadingTitle"
                    )}
                  </h3>
                  <p className="helper-text">
                    {cloudStatus === "available" && cloudSettings
                      ? t("onboarding.cloud.availableDescription", { time: formatTimestamp(cloudSettings.updatedAt, locale) })
                      : cloudStatus === "empty"
                        ? t("onboarding.cloud.emptyDescription")
                        : cloudStatus === "error"
                          ? t("onboarding.cloud.errorDescription", { status: cloudErrorStatus })
                          : cloudStatus === "skipped"
                            ? t("onboarding.cloud.skippedDescription")
                            : t("onboarding.cloud.loadingDescription")}
                  </p>
                </div>
                {cloudStatus === "error" ? (
                  <md-outlined-button onClick={retryCloudSettings}>{t("onboarding.cloud.retry")}</md-outlined-button>
                ) : null}
              </div>

              {cloudStatus === "available" ? (
                <div className="onboarding-choice-grid" role="radiogroup" aria-label={t("onboarding.cloud.choiceAria")}>
                  <button className="onboarding-choice" type="button" data-selected={cloudDecision === "cloud"} onClick={applyCloudSettings}>
                    <MaterialIcon name="cloud_download" />
                    <span>{t("onboarding.cloud.useCloud")}</span>
                    <small>{t("onboarding.cloud.useCloudDescription")}</small>
                  </button>
                  <button className="onboarding-choice" type="button" data-selected={cloudDecision === "local"} onClick={keepLocalSettings}>
                    <MaterialIcon name="touch_app" />
                    <span>{t("onboarding.cloud.keepLocal")}</span>
                    <small>{t("onboarding.cloud.keepLocalDescription")}</small>
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}

          {step.id === "sync" ? (
            <div className="onboarding-choice-grid" role="radiogroup" aria-label={t("onboarding.sync.aria")}>
              <button className="onboarding-choice" type="button" data-selected={settings.syncStrategy === "manual"} onClick={() => updateSettings({ syncStrategy: "manual" })}>
                <MaterialIcon name="touch_app" />
                <span>{t("settings.syncStrategy.manual")}</span>
                <small>{t("onboarding.sync.manualDescription")}</small>
              </button>
              <button className="onboarding-choice" type="button" data-selected={settings.syncStrategy === "auto"} onClick={() => updateSettings({ syncStrategy: "auto" })}>
                <MaterialIcon name="sync" />
                <span>{t("settings.syncStrategy.auto")}</span>
                <small>{t("onboarding.sync.autoDescription")}</small>
              </button>
            </div>
          ) : null}

          {step.id === "done" ? (
            <div className="onboarding-hero">
              <p className="helper-text">{t("onboarding.done.settings")}</p>
              <p className="helper-text">{t("onboarding.done.sync")}</p>
            </div>
          ) : null}
        </div>

        {message ? <p className="status-alert">{message}</p> : null}
        <div className="onboarding-actions">
          <md-text-button disabled={stepIndex === 0} onClick={goBack}>
            {t("onboarding.previous")}
          </md-text-button>
          <md-filled-button disabled={!canGoNext} onClick={goNext}>
            {t(step.id === "done" ? "onboarding.finish" : "onboarding.next")}
          </md-filled-button>
        </div>
      </div>
    </section>
  );
}
