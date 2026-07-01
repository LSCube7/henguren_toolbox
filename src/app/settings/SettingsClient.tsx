"use client";

import { SettingsSection } from "../components/SettingsSection";
import { StatusAlert } from "../components/StatusAlert";
import { customThemePresetId, defaultThemeSeed, inferThemePreset, isValidHexColor, normalizeHexColor, prideThemeFlags, themePresets } from "@/lib/theme-presets";
import { defaultSettings, type ToolboxSettings } from "@/lib/types";
import { CorePalette, Hct, argbFromHex, hexFromArgb } from "@material/material-color-utilities";
import { useMemo, useRef, useState } from "react";
import { useEdition, writeEdition } from "@/lib/edition";

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

function readInitialPrideFlag() {
  const savedPreset = inferThemePreset(readSettings().themeSeedColor);
  return themePresets.find((preset) => preset.id === savedPreset && preset.group === "pride")?.prideFlag ?? prideThemeFlags[0].id;
}

function hctFromHex(hex: string) {
  return Hct.fromInt(argbFromHex(hex));
}

function hctToHex(hue: number, chroma: number, tone: number) {
  return hexFromArgb(Hct.from(hue, chroma, tone).toInt());
}

function rgbFromHex(hex: string) {
  const normalized = normalizeHexColor(hex);
  if (!isValidHexColor(normalized)) return { r: 0, g: 0, b: 0 };
  return {
    r: Number.parseInt(normalized.slice(1, 3), 16),
    g: Number.parseInt(normalized.slice(3, 5), 16),
    b: Number.parseInt(normalized.slice(5, 7), 16)
  };
}

function rgbToHex(rgb: { r: number; g: number; b: number }) {
  return `#${[rgb.r, rgb.g, rgb.b].map((value) => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, "0")).join("")}`;
}

function hctStateFromHex(hex: string) {
  const hct = hctFromHex(hex);
  return {
    hex,
    hue: Math.round(hct.hue),
    chroma: Math.round(hct.chroma),
    tone: Math.round(hct.tone)
  };
}

function hctSliderGradients(hex: string) {
  const safeHex = isValidHexColor(hex) ? hex : defaultThemeSeed;
  const palette = CorePalette.of(argbFromHex(safeHex));
  const tones = Array.from({ length: 101 }, (_, tone) => {
    const { r, g, b } = rgbFromHex(hexFromArgb(palette.a1.tone(tone)));
    return `rgb(${r}, ${g}, ${b}) ${tone}%`;
  });
  const chromaRgb = rgbFromHex(hexFromArgb(palette.a1.tone(50)));
  return {
    hue:
      "linear-gradient(to right, rgb(231, 0, 125) 0%, rgb(216, 66, 0) 10%, rgb(165, 106, 0) 20%, rgb(127, 122, 0) 30%, rgb(0, 139, 24) 40%, rgb(0, 134, 115) 50%, rgb(0, 131, 152) 60%, rgb(0, 123, 200) 70%, rgb(105, 95, 255) 80%, rgb(196, 0, 246) 90%, rgb(230, 0, 128) 99.7222%)",
    chroma: `linear-gradient(to right, rgb(119, 119, 119) 0%, rgb(${chromaRgb.r}, ${chromaRgb.g}, ${chromaRgb.b}) 70%)`,
    tone: `linear-gradient(to right, ${tones.join(",")})`
  };
}

export function SettingsClient() {
  const [settings, setSettings] = useState<ToolboxSettings>(() => readSettings());
  const edition = useEdition();
  const [message, setMessage] = useState("");
  const [prideOpen, setPrideOpen] = useState(false);
  const [selectedPrideFlag, setSelectedPrideFlag] = useState(readInitialPrideFlag);
  const [customDialogOpen, setCustomDialogOpen] = useState(false);
  const [customDialogKey, setCustomDialogKey] = useState(0);
  const customDialogAppliedRef = useRef(false);
  const prideSegmentsRef = useRef<HTMLDivElement>(null);
  const [customDraftColor, setCustomDraftColor] = useState(() => {
    const seed = readSettings().themeSeedColor ?? defaultThemeSeed;
    return hctStateFromHex(isValidHexColor(seed) ? seed : defaultThemeSeed);
  });
  const currentSeed = settings.themeSeedColor ?? defaultThemeSeed;
  const activePreset = settings.themePreset ?? inferThemePreset(settings.themeSeedColor);
  const standardPresets = themePresets.filter((preset) => preset.group === "standard");
  const pridePresets = themePresets.filter((preset) => preset.group === "pride" && preset.prideFlag === selectedPrideFlag);
  const customColorValue = isValidHexColor(currentSeed) ? currentSeed : defaultThemeSeed;
  const customDraftRgb = rgbFromHex(customDraftColor.hex);
  const customDraftHexIsInvalid = Boolean(customDraftColor.hex && !isValidHexColor(normalizeHexColor(customDraftColor.hex)));
  const hctGradients = useMemo(() => hctSliderGradients(customDraftColor.hex), [customDraftColor.hex]);

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

  function selectPreset(presetId: string, seedColor: string) {
    update({ themePreset: presetId, themeSeedColor: seedColor });
  }

  function updateCustomColor(value: string) {
    const normalized = normalizeHexColor(value);
    update({
      themePreset: customThemePresetId,
      themeSeedColor: isValidHexColor(normalized) ? normalized : value
    });
  }

  function resetDefaultTheme() {
    update({ themePreset: themePresets[0].id, themeSeedColor: defaultThemeSeed });
  }

  function openCustomDialog() {
    customDialogAppliedRef.current = false;
    setPrideOpen(false);
    setCustomDraftColor(hctStateFromHex(customColorValue));
    setCustomDialogKey((current) => current + 1);
    setCustomDialogOpen(false);
    window.setTimeout(() => setCustomDialogOpen(true), 0);
  }

  function closeCustomDialog(applied = false) {
    customDialogAppliedRef.current = applied;
    setCustomDialogOpen(false);
  }

  function applyCustomColor() {
    updateCustomColor(customDraftColor.hex);
    closeCustomDialog(true);
  }

  function handleCustomDialogClosed() {
    setCustomDialogOpen(false);
    restoreSavedThemePreview();
  }

  function restoreSavedThemePreview() {
    if (customDialogAppliedRef.current) return;
    window.dispatchEvent(new Event("henguren-theme-change"));
  }

  function previewDraftColor(hex: string) {
    const normalized = normalizeHexColor(hex);
    if (!isValidHexColor(normalized)) return;
    window.dispatchEvent(
      new CustomEvent("henguren-theme-preview", {
        detail: { themePreset: customThemePresetId, themeSeedColor: normalized, colorMode: settings.colorMode }
      })
    );
  }

  function updateDraftHex(value: string) {
    const normalized = normalizeHexColor(value.startsWith("#") ? value : `#${value}`);
    if (isValidHexColor(normalized)) {
      setCustomDraftColor(hctStateFromHex(normalized));
      previewDraftColor(normalized);
      return;
    }
    setCustomDraftColor((current) => ({ ...current, hex: value }));
  }

  function updateDraftRgb(channel: "r" | "g" | "b", value: string) {
    const parsed = Number(value);
    const nextRgb = { ...customDraftRgb, [channel]: Number.isFinite(parsed) ? Math.max(0, Math.min(255, parsed)) : 0 };
    const hex = rgbToHex(nextRgb);
    setCustomDraftColor(hctStateFromHex(hex));
    previewDraftColor(hex);
  }

  function updateDraftHct(next: Partial<Pick<typeof customDraftColor, "hue" | "chroma" | "tone">>) {
    const hue = next.hue ?? customDraftColor.hue;
    const chroma = next.chroma ?? customDraftColor.chroma;
    const tone = next.tone ?? customDraftColor.tone;
    const hex = hctToHex(hue, chroma, tone);
    setCustomDraftColor({ hex, hue, chroma, tone });
    previewDraftColor(hex);
  }

  function scrollPrideFlags(direction: "left" | "right") {
    prideSegmentsRef.current?.scrollBy({
      left: direction === "left" ? -220 : 220,
      behavior: "smooth"
    });
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
      <SettingsSection
        title="主题外观"
        control={
          <div className="theme-settings">
            <div className="theme-preset-section">
              <div className="theme-preset-row">
                <div className="theme-preset-grid" role="radiogroup" aria-label="主题预设颜色">
                  {standardPresets.map((preset) => (
                    <button
                      className="theme-preset-circle"
                      style={
                        {
                          "--theme-preset-color": preset.seedColor,
                          "--theme-preset-background": preset.seedColor
                        } as React.CSSProperties
                      }
                      data-selected={activePreset === preset.id}
                      key={preset.id}
                      type="button"
                      role="radio"
                      aria-label={preset.name}
                      title={preset.name}
                      aria-checked={activePreset === preset.id}
                      onClick={() => selectPreset(preset.id, preset.seedColor)}
                    />
                  ))}
                </div>
                <div className="theme-preset-actions" aria-label="更多主题选项">
                  <button className="theme-action-circle" type="button" aria-expanded={prideOpen} aria-controls="pride-color-panel" aria-label="Pride Color" title="Pride Color" onClick={() => setPrideOpen((current) => !current)}>
                    <span className="material-symbols-rounded" aria-hidden="true">question_mark</span>
                  </button>
                  <button className="theme-action-circle" type="button" aria-label="自定义主题色" title="自定义主题色" data-selected={activePreset === customThemePresetId} onClick={openCustomDialog}>
                    <span className="material-symbols-rounded" aria-hidden="true">palette</span>
                  </button>
                </div>
              </div>
            </div>
            <section className="theme-preset-popover" id="pride-color-panel" aria-label="Pride Color" data-open={prideOpen} inert={!prideOpen ? true : undefined}>
                <div className="theme-preset-panel-title">
                  <span>Pride Color</span>
                  <button className="theme-panel-close" type="button" aria-label="收起 Pride Color" onClick={() => setPrideOpen(false)}>
                    <span className="material-symbols-rounded" aria-hidden="true">close</span>
                  </button>
                </div>
                <div className="pride-picker">
                  <div className="pride-scroll-hint">
                    <span className="material-symbols-rounded" aria-hidden="true">swipe</span>
                    <span>横向滚动查看更多旗帜</span>
                  </div>
                  <div className="pride-flag-scroll">
                    <button className="pride-scroll-button" type="button" aria-label="向左查看更多 Pride 旗帜" onClick={() => scrollPrideFlags("left")}>
                      <span className="material-symbols-rounded" aria-hidden="true">chevron_left</span>
                    </button>
                    <div ref={prideSegmentsRef} className="pride-flag-segments" role="tablist" aria-label="选择 Pride 旗帜">
                      {prideThemeFlags.map((flag) => (
                        <button
                          key={flag.id}
                          type="button"
                          role="tab"
                          aria-selected={selectedPrideFlag === flag.id}
                          data-selected={selectedPrideFlag === flag.id}
                          onClick={() => setSelectedPrideFlag(flag.id)}
                        >
                          {flag.name}
                        </button>
                      ))}
                    </div>
                    <button className="pride-scroll-button" type="button" aria-label="向右查看更多 Pride 旗帜" onClick={() => scrollPrideFlags("right")}>
                      <span className="material-symbols-rounded" aria-hidden="true">chevron_right</span>
                    </button>
                  </div>
                  <div className="theme-preset-grid theme-preset-grid--compact" role="radiogroup" aria-label={`Pride Color ${selectedPrideFlag}`}>
                    {pridePresets.map((preset) => (
                      <button
                        className="theme-preset-circle"
                        style={
                          {
                            "--theme-preset-color": preset.seedColor,
                            "--theme-preset-background": preset.seedColor
                          } as React.CSSProperties
                        }
                        data-selected={activePreset === preset.id}
                        key={preset.id}
                        type="button"
                        role="radio"
                        aria-label={preset.name}
                        title={preset.name}
                        aria-checked={activePreset === preset.id}
                        onClick={() => selectPreset(preset.id, preset.seedColor)}
                      />
                    ))}
                  </div>
                </div>
              </section>
            <div className="custom-theme-row">
              <span className="custom-color-readout" style={{ "--theme-preset-color": customColorValue } as React.CSSProperties}>
                {customColorValue.toUpperCase()}
              </span>
              <md-outlined-button onClick={resetDefaultTheme}>恢复默认主题</md-outlined-button>
            </div>
            <md-dialog key={customDialogKey} class="hct-dialog" open={customDialogOpen} onClosed={handleCustomDialogClosed} onClose={handleCustomDialogClosed} onCancel={handleCustomDialogClosed}>
              <div slot="headline">HCT 颜色选择</div>
              <div slot="content" className="hct-color-dialog">
                <div className="hct-color-preview" style={{ background: customDraftColor.hex }} aria-hidden="true" />
                <div className="hct-field-grid">
                  <label className="hex-field" data-error={customDraftHexIsInvalid}>
                    <span>HEX</span>
                    <div className="hex-input-shell">
                      <span aria-hidden="true">#</span>
                      <input
                        aria-invalid={customDraftHexIsInvalid}
                        aria-label="HEX"
                        value={customDraftColor.hex.replace(/^#/, "")}
                        maxLength={6}
                        onInput={(event) => updateDraftHex((event.currentTarget as HTMLInputElement).value)}
                      />
                    </div>
                    {customDraftHexIsInvalid ? <small>请输入 #RRGGBB 格式</small> : null}
                  </label>
                  <div className="rgb-field" aria-label="RGB">
                    <span>RGB</span>
                    <div className="rgb-inputs">
                      <input aria-label="Red" inputMode="numeric" maxLength={3} value={customDraftRgb.r} onInput={(event) => updateDraftRgb("r", (event.currentTarget as HTMLInputElement).value)} />
                      <input aria-label="Green" inputMode="numeric" maxLength={3} value={customDraftRgb.g} onInput={(event) => updateDraftRgb("g", (event.currentTarget as HTMLInputElement).value)} />
                      <input aria-label="Blue" inputMode="numeric" maxLength={3} value={customDraftRgb.b} onInput={(event) => updateDraftRgb("b", (event.currentTarget as HTMLInputElement).value)} />
                    </div>
                  </div>
                </div>
                <label className="hct-slider hct-slider--hue" style={{ "--hct-slider-track": hctGradients.hue } as React.CSSProperties}>
                  <span>Hue</span>
                  <input className="hct-slider__value" type="number" min={0} max={360} value={customDraftColor.hue} onInput={(event) => updateDraftHct({ hue: Number((event.currentTarget as HTMLInputElement).value) })} />
                  <input className="hct-slider__range" type="range" min={0} max={360} value={customDraftColor.hue} onInput={(event) => updateDraftHct({ hue: Number((event.currentTarget as HTMLInputElement).value) })} />
                </label>
                <label className="hct-slider hct-slider--chroma" style={{ "--hct-slider-track": hctGradients.chroma } as React.CSSProperties}>
                  <span>Chroma</span>
                  <input className="hct-slider__value" type="number" min={0} max={150} value={customDraftColor.chroma} onInput={(event) => updateDraftHct({ chroma: Number((event.currentTarget as HTMLInputElement).value) })} />
                  <input className="hct-slider__range" type="range" min={0} max={150} value={customDraftColor.chroma} onInput={(event) => updateDraftHct({ chroma: Number((event.currentTarget as HTMLInputElement).value) })} />
                </label>
                <label className="hct-slider hct-slider--tone" style={{ "--hct-slider-track": hctGradients.tone } as React.CSSProperties}>
                  <span>Tone</span>
                  <input className="hct-slider__value" type="number" min={0} max={100} value={customDraftColor.tone} onInput={(event) => updateDraftHct({ tone: Number((event.currentTarget as HTMLInputElement).value) })} />
                  <input className="hct-slider__range" type="range" min={0} max={100} value={customDraftColor.tone} onInput={(event) => updateDraftHct({ tone: Number((event.currentTarget as HTMLInputElement).value) })} />
                </label>
              </div>
              <div slot="actions">
                <md-text-button onClick={() => closeCustomDialog(false)}>取消</md-text-button>
                <md-filled-button onClick={applyCustomColor}>应用</md-filled-button>
              </div>
            </md-dialog>
          </div>
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
