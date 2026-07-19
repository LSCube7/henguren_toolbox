"use client";

import { useRouter, useSearchParams } from "next/navigation";
import type { Route } from "next";
import { useEffect, useState, useSyncExternalStore } from "react";
import { MaterialIcon } from "../components/MaterialIcon";
import { ThemePicker } from "../components/ThemePicker";
import { completeOnboarding, onboardingStepStorageKey } from "@/lib/onboarding";
import { readEdition, writeEdition, type Edition } from "@/lib/edition";
import { defaultSettings, type ToolboxSettings, type UserSession } from "@/lib/types";

const settingsKey = "henguren-v3-settings";

type StepId = "welcome" | "edition" | "theme" | "login" | "sync" | "done";

const steps: Array<{ id: StepId; title: string; description: string }> = [
  { id: "welcome", title: "欢迎使用恨古人工具箱", description: "先用几十秒完成基础偏好，之后也可以在设置里重新开始。" },
  { id: "edition", title: "选择学习阶段", description: "这会影响首页和侧边栏默认展示哪些学习工具。" },
  { id: "theme", title: "选择主题外观", description: "选择一个 Material 3 主题色，也可以展开 Pride Color 或自定义 HCT 颜色。" },
  { id: "login", title: "登录与本地使用", description: "使用 LSCube OAuth 登录后可以使用云端错题本和设置同步；也可以明确选择暂不登录。" },
  { id: "sync", title: "设置同步策略", description: "这里只保存后续默认行为，不会在完成向导时自动上传云端。" },
  { id: "done", title: "准备好了", description: "你的工具箱已经完成初始配置。" }
];

const authMessages: Record<string, string> = {
  ok: "已完成登录，可以继续向导。",
  missing_code_state: "登录回调缺少授权码或 state，请重新登录。",
  missing_oauth_cookie: "登录会话已过期，请重新登录。",
  state_mismatch: "LSCube OAuth state 校验失败，请重新登录。",
  unconfigured: "LSCube OAuth 环境变量尚未配置完整。",
  code_expired: "LSCube OAuth 授权码已过期或已被使用，请重新点击登录。",
  invalid_grant: "LSCube OAuth 授权码无效，请确认回调地址、PKCE 和客户端配置后重试。",
  token_http: "LSCube OAuth token exchange 失败，请查看服务端日志。",
  token_no_access_token: "LSCube OAuth token 响应缺少 access_token。",
  userinfo_http: "LSCube OAuth 用户信息请求失败，请查看服务端日志。"
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
  const returnTo = safeReturnTo(searchParams.get("returnTo"));
  const [stepIndex, setStepIndex] = useState(() => stepIndexFromStorage());
  const [settings, setSettings] = useState<ToolboxSettings>(() => readSettings());
  const [edition, setEdition] = useState<Edition>(() => readEdition());
  const [user, setUser] = useState<UserSession | null>(null);
  const [userLoading, setUserLoading] = useState(true);
  const [loginSkipped, setLoginSkipped] = useState(false);
  const [message, setMessage] = useState(() => authMessages[searchParams.get("auth") ?? ""] ?? "");
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
    setMessage("已选择暂不登录。设置将只保存在本地，之后可在用户页登录。");
  }

  if (!mounted) return null;

  return (
    <section className="onboarding-shell onboarding-shell--route" aria-label="首次使用向导">
      <div className="onboarding-panel">
        <div className="onboarding-progress" aria-label="向导进度">
          {steps.map((item, index) => (
            <span className="onboarding-progress__dot" data-active={index <= stepIndex} key={item.id} />
          ))}
        </div>
        <div className="onboarding-header">
          <span className="onboarding-mark" aria-hidden="true">
            <MaterialIcon name={step.id === "done" ? "check" : "auto_awesome"} />
          </span>
          <div>
            <p className="breadcrumb">初始设置 · {stepIndex + 1} / {steps.length}</p>
            <h1 className="page-title">{step.title}</h1>
            <p className="page-description">{step.description}</p>
          </div>
        </div>

        <div className="onboarding-content">
          {step.id === "welcome" ? (
            <div className="onboarding-hero">
              <div className="metric-value">准备好了</div>
              <p className="helper-text">配置会保存在本机浏览器中；不登录也可以继续使用本地工具箱。</p>
            </div>
          ) : null}

          {step.id === "edition" ? (
            <div className="onboarding-choice-grid" role="radiogroup" aria-label="学习阶段">
              <button className="onboarding-choice" type="button" data-selected={edition === "junior"} onClick={() => updateEdition("junior")}>
                <MaterialIcon name="school" />
                <span>初中版</span>
                <small>寻找实词、文学常识</small>
              </button>
              <button className="onboarding-choice" type="button" data-selected={edition === "senior"} onClick={() => updateEdition("senior")}>
                <MaterialIcon name="workspace_premium" />
                <span>高中版</span>
                <small>单词测试、课文测试</small>
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
                <h3 className="card-title">{userLoading ? "正在读取登录状态" : user ? user.name : "未登录"}</h3>
                <p className="helper-text">{user ? user.email || user.id : "未登录时必须点击“暂不登录”才能继续；完成向导不会上传云端设置。"}</p>
              </div>
              <div className="cluster">
                <md-outlined-button onClick={skipLogin} disabled={Boolean(user)}>
                  暂不登录
                </md-outlined-button>
                <md-filled-button onClick={startLogin}>登录 LSCube OAuth</md-filled-button>
              </div>
            </div>
          ) : null}

          {step.id === "sync" ? (
            <div className="onboarding-choice-grid" role="radiogroup" aria-label="同步策略">
              <button className="onboarding-choice" type="button" data-selected={settings.syncStrategy === "manual"} onClick={() => updateSettings({ syncStrategy: "manual" })}>
                <MaterialIcon name="touch_app" />
                <span>手动同步</span>
                <small>推荐：由你明确选择拉取、覆盖或合并。</small>
              </button>
              <button className="onboarding-choice" type="button" data-selected={settings.syncStrategy === "auto"} onClick={() => updateSettings({ syncStrategy: "auto" })}>
                <MaterialIcon name="sync" />
                <span>自动同步</span>
                <small>保存为后续默认行为；完成向导不会自动上传。</small>
              </button>
            </div>
          ) : null}

          {step.id === "done" ? (
            <div className="onboarding-hero">
              <p className="helper-text">之后可以在“个人设置”里重新开始初始向导，或继续微调主题、阶段和同步策略。</p>
              <p className="helper-text">设置已保存到本地；如需同步到云端，请登录后到设置页手动点击“同步设置”。</p>
            </div>
          ) : null}
        </div>

        {message ? <p className="status-alert">{message}</p> : null}
        <div className="onboarding-actions">
          <md-text-button disabled={stepIndex === 0} onClick={goBack}>
            上一步
          </md-text-button>
          <md-filled-button disabled={!canGoNext} onClick={goNext}>
            {step.id === "done" ? "完成" : "下一步"}
          </md-filled-button>
        </div>
      </div>
    </section>
  );
}
