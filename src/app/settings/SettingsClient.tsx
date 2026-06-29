"use client";

import { SettingsSection } from "../components/SettingsSection";
import { StatusAlert } from "../components/StatusAlert";
import { defaultSettings, type ToolboxSettings } from "@/lib/types";
import { useState } from "react";

const key = "henguren-v3-settings";
const defaultSeed = "#4f7cff";

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
  const [settings, setSettings] = useState<ToolboxSettings>(() => readSettings());
  const [message, setMessage] = useState("");

  function update(next: Partial<ToolboxSettings>) {
    const value = { ...settings, ...next, updatedAt: new Date().toISOString() };
    setSettings(value);
    localStorage.setItem(key, JSON.stringify(value));
    window.dispatchEvent(new Event("henguren-theme-change"));
  }

  async function syncSettings() {
    const response = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings)
    });
    setMessage(response.ok ? "设置已同步到云端。" : "需要登录后才能同步设置。");
  }

  return (
    <div className="stack">
      <SettingsSection
        title="主题色"
        description="选择 Material Web 的主题种子色；默认是浅蓝色调。"
        control={
          <md-outlined-text-field
            label="主题色"
            type="color"
            value={settings.themeSeedColor ?? defaultSeed}
            onInput={(event) => update({ themeSeedColor: valueFrom(event) })}
          />
        }
      />
      <SettingsSection
        title="颜色模式"
        description="选择浅色、深色或跟随系统。"
        control={
          <md-filled-select value={settings.colorMode ?? "light"} onInput={(event) => update({ colorMode: valueFrom(event) as ToolboxSettings["colorMode"] })}>
            <md-select-option value="light">
              <div slot="headline">浅色</div>
            </md-select-option>
            <md-select-option value="dark">
              <div slot="headline">深色</div>
            </md-select-option>
            <md-select-option value="system">
              <div slot="headline">跟随系统</div>
            </md-select-option>
          </md-filled-select>
        }
      />
      <SettingsSection
        title="Show First-letter Hint"
        description="单词测试时显示首字母提示。"
        control={<md-switch selected={settings.showHint} checked={settings.showHint} onInput={(event) => update({ showHint: checkedFrom(event) })} />}
      />
      <SettingsSection
        title="Slip Detection"
        description="允许测试器识别轻微手滑并提示复核。"
        control={<md-switch selected={settings.enableSlipDetection} checked={settings.enableSlipDetection} onInput={(event) => update({ enableSlipDetection: checkedFrom(event) })} />}
      />
      <SettingsSection
        title="Default Test Count"
        description="新建单词测试时默认抽取的题目数量。"
        control={
          <md-outlined-text-field
            label="题目数量"
            type="number"
            min={1}
            max={200}
            value={settings.defaultTestCount}
            onInput={(event) => update({ defaultTestCount: Number(valueFrom(event)) })}
          />
        }
      />
      <SettingsSection
        title="Sync Strategy"
        description="设置同步策略。自动同步会在登录后优先使用云端状态。"
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
        title="Cloud Settings Sync"
        description="将当前本地设置上传到 LSCube OAuth 账户绑定的 R2 存储。"
        control={<md-filled-button onClick={() => void syncSettings()}>同步设置</md-filled-button>}
      />
      <StatusAlert message={message} />
    </div>
  );
}
