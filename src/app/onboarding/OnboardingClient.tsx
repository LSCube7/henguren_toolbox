"use client";

import { useRouter, useSearchParams } from "next/navigation";
import type { Route } from "next";
import { useEffect, useState, useSyncExternalStore } from "react";
import { MaterialIcon } from "../components/MaterialIcon";
import { ThemePicker } from "../components/ThemePicker";
import { completeOnboarding, onboardingStepStorageKey } from "@/lib/onboarding";
import { readEdition, writeEdition, type Edition } from "@/lib/edition";
import { defaultSettings, type ToolboxSettings, type UserSession } from "@/lib/types";
import { useI18n } from "../i18n/AppI18nProvider";
import type { MessageKey } from "@/i18n/config";

const settingsKey = "henguren-v3-settings";

type StepId = "welcome" | "edition" | "theme" | "login" | "sync" | "done";

const steps: Array<{ id: StepId; title: MessageKey; description: MessageKey }> = [
  { id: "welcome", title: "onboarding.welcome.title", description: "onboarding.welcome.description" },
  { id: "edition", title: "onboarding.edition.title", description: "onboarding.edition.description" },
  { id: "theme", title: "onboarding.theme.title", description: "onboarding.theme.description" },
  { id: "login", title: "onboarding.login.title", description: "onboarding.login.description" },
  { id: "sync", title: "onboarding.sync.title", description: "onboarding.sync.description" },
  { id: "done", title: "onboarding.done.title", description: "onboarding.done.description" }
];

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

function readSettings() {
  if (typeof window === "undefined") return defaultSettings;
  try {
    const saved = localStorage.getItem(settingsKey);
    return saved ? { ...defaultSettings, ...JSON.parse(saved) } : defaultSettings;
  } catch {
    return defaultSettings;
  }
}

function writeSettings(settings: ToolboxSettings) {
  localStorage.setItem(settingsKey, JSON.stringify(settings));
  window.dispatchEvent(new Event("henguren-theme-change"));
}

function stepIndexFromStorage() {
  if (typeof window === "undefined") return 0;
  const saved = sessionStorage.getItem(onboardingStepStorageKey) as StepId | null;
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
  const { t } = useI18n();
  const returnTo = safeReturnTo(searchParams.get("returnTo"));
  const [stepIndex, setStepIndex] = useState(() => stepIndexFromStorage());
  const [settings, setSettings] = useState<ToolboxSettings>(() => readSettings());
  const [edition, setEdition] = useState<Edition>(() => readEdition());
  const [user, setUser] = useState<UserSession | null>(null);
  const [userLoading, setUserLoading] = useState(true);
  const [loginSkipped, setLoginSkipped] = useState(false);
  const [message, setMessage] = useState(() => {
    const key = authMessages[searchParams.get("auth") ?? ""];
    return key ? t(key) : "";
  });
  const step = steps[stepIndex];
  const canGoNext = step.id !== "login" || Boolean(user) || loginSkipped;

  useEffect(() => {
    if (!mounted) return;
    sessionStorage.setItem(onboardingStepStorageKey, step.id);
  }, [mounted, step.id]);

  useEffect(() => {
    let active = true;
    async function loadUser() {
      setUserLoading(true);
      try {
        const response = await fetch("/api/me");
        const data = (await response.json()) as { authenticated: boolean; user: UserSession | null };
        if (active) setUser(data.user);
      } catch {
        if (active) setUser(null);
      } finally {
        if (active) setUserLoading(false);
      }
    }
    void loadUser();
    return () => {
      active = false;
    };
  }, []);

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
    sessionStorage.setItem(onboardingStepStorageKey, "login");
    const target = `/onboarding?returnTo=${encodeURIComponent(returnTo)}`;
    window.location.href = `/api/auth/login?returnTo=${encodeURIComponent(target)}`;
  }

  function skipLogin() {
    setLoginSkipped(true);
    setMessage(t("onboarding.signIn.skipped"));
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
          {step.id === "welcome" ? (
            <div className="onboarding-hero">
              <div className="metric-value">{t("onboarding.done.title")}</div>
              <p className="helper-text">{t("onboarding.done.local")}</p>
            </div>
          ) : null}

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
