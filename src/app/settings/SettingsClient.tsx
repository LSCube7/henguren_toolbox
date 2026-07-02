"use client";

import { useRouter } from "next/navigation";
import type { Route } from "next";
import { SettingsSection } from "../components/SettingsSection";
import { StatusAlert } from "../components/StatusAlert";
import { ThemePicker } from "../components/ThemePicker";
import { defaultSettings, type ToolboxSettings } from "@/lib/types";
import { useState } from "react";
import { useEdition, writeEdition } from "@/lib/edition";
import { restartOnboarding } from "@/lib/onboarding";
import {
  clearDeveloperSyncSource,
  isDeveloperSyncSourceReady,
  readDeveloperSyncSource,
  readDeveloperSyncSourceDraft,
  testDeveloperSyncSource,
  writeDeveloperSettings,
  writeDeveloperSyncSource,
  type DeveloperSyncSource
} from "@/lib/developer-sync-source";

const key = "henguren-v3-settings";

function readSettings() {
  if (typeof window === "undefined") return defaultSettings;
  const saved = localStorage.getItem(key);
  return saved ? { ...defaultSettings, ...JSON.parse(saved) } : defaultSettings;
}

function valueFrom(event: React.FormEvent<HTMLElement>) {
  return String((event.currentTarget as HTMLElement & { value?: string }).value ?? "");
}

function checkedFrom(event: React.FormEvent<HTMLElement>) {
  return Boolean((event.currentTarget as HTMLElement & { checked?: boolean }).checked);
}

export function SettingsClient() {
  const router = useRouter();
  const [settings, setSettings] = useState<ToolboxSettings>(() => readSettings());
  const [developerSource, setDeveloperSource] = useState<DeveloperSyncSource>(() => readDeveloperSyncSourceDraft());
  const edition = useEdition();
  const [message, setMessage] = useState("");

  function update(next: Partial<ToolboxSettings>) {
    const value = { ...settings, ...next, updatedAt: new Date().toISOString() };
    setSettings(value);
    localStorage.setItem(key, JSON.stringify(value));
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
      setMessage("设置已同步到自定义同步源。");
      return;
    }
    const response = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings)
    });
    setMessage(response.ok ? "设置已同步到云端。" : "需要登录后才能同步设置。");
  }

  function updateDeveloperSource(next: Partial<DeveloperSyncSource>) {
    const value = { ...developerSource, ...next, type: "r2" as const, updatedAt: new Date().toISOString() };
    setDeveloperSource(value);
    writeDeveloperSyncSource(value);
  }

  async function testDeveloperSource() {
    try {
      await testDeveloperSyncSource(developerSource);
      setMessage("自定义同步源连接成功。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "自定义同步源连接失败，请检查 R2 配置和 CORS。");
    }
  }

  function clearDeveloperSource() {
    clearDeveloperSyncSource();
    setDeveloperSource(readDeveloperSyncSourceDraft());
    setMessage("已清除本机保存的自定义同步源配置。");
  }

  function restartInitialGuide() {
    restartOnboarding();
    router.push("/onboarding?returnTo=/settings&restart=1" as Route);
  }

  return (
    <div className="stack">
      <SettingsSection
        title="学习阶段"
        description="选择首页和侧边导航显示初中版工具或高中版工具。直接访问其他工具路由仍然可用。"
        control={
          <md-filled-select
            value={edition}
            onInput={(event) => writeEdition(String((event.currentTarget as HTMLElement & { value?: string }).value ?? "junior") === "senior" ? "senior" : "junior")}
          >
            <md-select-option value="junior">
              <div slot="headline">初中版</div>
            </md-select-option>
            <md-select-option value="senior">
              <div slot="headline">高中版</div>
            </md-select-option>
          </md-filled-select>
        }
      />
      <SettingsSection title="主题外观" description="选择预设主题、Pride Color 或自定义 HCT 颜色；改动会即时应用到当前页面。" control={<ThemePicker settings={settings} onChange={update} />} />
      <SettingsSection
        title="首字母提示"
        description="单词测试时显示首字母提示。"
        control={<md-switch selected={settings.showHint} checked={settings.showHint} onInput={(event) => update({ showHint: checkedFrom(event) })} />}
      />
      <SettingsSection
        title="手滑复核"
        description="当答案接近正确拼写时，先提示你复核，而不是直接计入错误。"
        control={<md-switch selected={settings.enableSlipDetection} checked={settings.enableSlipDetection} onInput={(event) => update({ enableSlipDetection: checkedFrom(event) })} />}
      />
      <SettingsSection
        title="默认测试数量"
        description="新建单词测试时默认抽取的题目数量。"
        control={<md-outlined-text-field label="题目数量" type="number" min={1} max={200} value={settings.defaultTestCount} onInput={(event) => update({ defaultTestCount: Number(valueFrom(event)) })} />}
      />
      <SettingsSection
        title="同步方式"
        description="设置后续默认同步偏好。未登录时只保存在本机，登录或配置自定义同步源后再手动同步。"
        control={
          <md-filled-select value={settings.syncStrategy} onInput={(event) => update({ syncStrategy: valueFrom(event) as ToolboxSettings["syncStrategy"] })}>
            <md-select-option value="manual">
              <div slot="headline">手动同步</div>
            </md-select-option>
            <md-select-option value="auto">
              <div slot="headline">自动同步</div>
            </md-select-option>
          </md-filled-select>
        }
      />
      <SettingsSection
        title="设置同步"
        description="将当前本机设置保存到登录账户的云端空间；若启用开发者模式且配置完整，则保存到自定义同步源。"
        control={<md-filled-button onClick={() => void syncSettings()}>同步设置</md-filled-button>}
      />
      <SettingsSection
        title="初始向导"
        description="重新开始首次使用向导，集中设置学习阶段、主题、登录选择和同步策略。"
        control={<md-outlined-button onClick={restartInitialGuide}>重新开始初始向导</md-outlined-button>}
      />
      <section className="settings-group" aria-labelledby="advanced-settings-title">
        <div className="settings-group__header">
          <p className="breadcrumb">Settings</p>
          <h2 className="section-title" id="advanced-settings-title">
            高级设置
          </h2>
          <p className="helper-text">这些选项面向高级用户。普通学习使用不需要开启开发者模式。</p>
        </div>
        <SettingsSection
          title="开发者模式"
          description="开启后可以配置自定义同步源。配置仍只保存在本机浏览器，不会随设置同步上传。"
          control={<md-switch selected={Boolean(settings.developerMode)} checked={Boolean(settings.developerMode)} onInput={(event) => update({ developerMode: checkedFrom(event) })} />}
        />
        <section className="md-card stack developer-panel" aria-label="自定义同步源">
          <div>
            <p className="breadcrumb">Settings / 开发者模式</p>
            <h2 className="section-title">自定义 R2 同步源</h2>
            <p className="helper-text">
              这里会把 R2 访问密钥长期保存在本机浏览器。请只填写你自己的开发或个人同步桶，不要使用公共密钥或共享生产密钥；R2 桶需要允许当前站点的
              CORS 访问。开发者模式关闭时可以先保存配置，但不会启用这个同步源。
            </p>
          </div>
          <div className="field-grid">
            <md-outlined-text-field label="Account ID" value={developerSource.accountId} onInput={(event) => updateDeveloperSource({ accountId: valueFrom(event) })} />
            <md-outlined-text-field label="Bucket Name" value={developerSource.bucketName} onInput={(event) => updateDeveloperSource({ bucketName: valueFrom(event) })} />
            <md-outlined-text-field label="Access Key ID" value={developerSource.accessKeyId} onInput={(event) => updateDeveloperSource({ accessKeyId: valueFrom(event) })} />
            <md-outlined-text-field
              label="Secret Access Key"
              type="password"
              value={developerSource.secretAccessKey}
              onInput={(event) => updateDeveloperSource({ secretAccessKey: valueFrom(event) })}
            />
            <md-outlined-text-field label="Key Prefix" value={developerSource.keyPrefix} onInput={(event) => updateDeveloperSource({ keyPrefix: valueFrom(event) })} />
            <md-outlined-text-field label="Profile ID" value={developerSource.profileId} onInput={(event) => updateDeveloperSource({ profileId: valueFrom(event) })} />
          </div>
          <div className="cluster">
            <span className={settings.developerMode && isDeveloperSyncSourceReady(developerSource) ? "badge" : "badge badge--neutral"}>
              {!settings.developerMode ? "未启用" : isDeveloperSyncSourceReady(developerSource) ? "配置完整" : "等待完整配置"}
            </span>
            <md-outlined-button onClick={() => void testDeveloperSource()}>测试连接</md-outlined-button>
            <md-outlined-button onClick={clearDeveloperSource}>清除本机配置</md-outlined-button>
          </div>
        </section>
      </section>
      <StatusAlert message={message} />
    </div>
  );
}
