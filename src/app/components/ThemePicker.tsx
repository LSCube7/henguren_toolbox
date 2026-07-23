"use client";

import { CorePalette, Hct, argbFromHex, hexFromArgb } from "@material/material-color-utilities";
import { useMemo, useRef, useState } from "react";
import { customThemePresetId, defaultThemeSeed, inferThemePreset, isValidHexColor, normalizeHexColor, prideThemeFlags, themePresets } from "@/lib/theme-presets";
import type { ToolboxSettings } from "@/lib/types";
import { MaterialIcon } from "./MaterialIcon";
import { useI18n } from "../i18n/AppI18nProvider";
import type { MessageKey } from "@/i18n/config";

const standardPresetLabels: Record<string, MessageKey> = {
  "default-blue": "theme.preset.default-blue",
  red: "theme.preset.red",
  orange: "theme.preset.orange",
  yellow: "theme.preset.yellow",
  green: "theme.preset.green",
  cyan: "theme.preset.cyan",
  blue: "theme.preset.blue",
  purple: "theme.preset.purple",
  graphite: "theme.preset.graphite"
};

const prideColorLabels: Record<string, MessageKey> = {
  blue: "theme.color.blue",
  pink: "theme.color.pink",
  yellow: "theme.color.yellow",
  purple: "theme.color.purple",
  magenta: "theme.color.magenta",
  cyan: "theme.color.cyan",
  orange: "theme.color.orange",
  rose: "theme.color.rose",
  green: "theme.color.green",
  teal: "theme.color.teal",
  gray: "theme.color.gray",
  mint: "theme.color.mint",
  lavender: "theme.color.lavender"
};

function readInitialPrideFlag(seedColor: string | undefined) {
  const savedPreset = inferThemePreset(seedColor);
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

function valueFrom(event: React.FormEvent<HTMLElement>) {
  return String((event.currentTarget as HTMLElement & { value?: string }).value ?? "");
}

export function ThemePicker({
  settings,
  onChange,
  showReset = true
}: {
  settings: ToolboxSettings;
  onChange: (next: Partial<ToolboxSettings>) => void;
  showReset?: boolean;
}) {
  const { locale, t } = useI18n();
  const [prideOpen, setPrideOpen] = useState(false);
  const [selectedPrideFlag, setSelectedPrideFlag] = useState(() => readInitialPrideFlag(settings.themeSeedColor));
  const [customDialogOpen, setCustomDialogOpen] = useState(false);
  const [customDialogKey, setCustomDialogKey] = useState(0);
  const customDialogAppliedRef = useRef(false);
  const prideSegmentsRef = useRef<HTMLDivElement>(null);
  const currentSeed = settings.themeSeedColor ?? defaultThemeSeed;
  const customColorValue = isValidHexColor(currentSeed) ? currentSeed : defaultThemeSeed;
  const [customDraftColor, setCustomDraftColor] = useState(() => hctStateFromHex(customColorValue));
  const activePreset = settings.themePreset ?? inferThemePreset(settings.themeSeedColor);
  const standardPresets = themePresets.filter((preset) => preset.group === "standard");
  const pridePresets = themePresets.filter((preset) => preset.group === "pride" && preset.prideFlag === selectedPrideFlag);
  const customDraftRgb = rgbFromHex(customDraftColor.hex);
  const customDraftHexIsInvalid = Boolean(customDraftColor.hex && !isValidHexColor(normalizeHexColor(customDraftColor.hex)));
  const hctGradients = useMemo(() => hctSliderGradients(customDraftColor.hex), [customDraftColor.hex]);

  function presetLabel(preset: (typeof themePresets)[number]) {
    const standardKey = standardPresetLabels[preset.id];
    if (standardKey) return t(standardKey);
    const colorKey = prideColorLabels[preset.id.split("-").at(-1) ?? ""];
    return colorKey ? `${preset.prideFlag ?? "Pride"} ${t(colorKey)}` : preset.name;
  }

  function selectPreset(presetId: string, seedColor: string) {
    onChange({ themePreset: presetId, themeSeedColor: seedColor });
  }

  function updateCustomColor(value: string) {
    const normalized = normalizeHexColor(value);
    onChange({
      themePreset: customThemePresetId,
      themeSeedColor: isValidHexColor(normalized) ? normalized : value
    });
  }

  function resetDefaultTheme() {
    onChange({ themePreset: themePresets[0].id, themeSeedColor: defaultThemeSeed });
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
    if (!customDialogAppliedRef.current) {
      window.dispatchEvent(new Event("henguren-theme-change"));
    }
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
    <div className="theme-settings">
      <div className="theme-preset-section">
        <div className="theme-preset-row">
          <div className="theme-preset-grid" role="radiogroup" aria-label={t("theme.presetAria")}>
            {standardPresets.map((preset) => (
              <button
                className="theme-preset-circle"
                style={{ "--theme-preset-color": preset.seedColor, "--theme-preset-background": preset.seedColor } as React.CSSProperties}
                data-selected={activePreset === preset.id}
                key={preset.id}
                type="button"
                role="radio"
                aria-label={presetLabel(preset)}
                title={presetLabel(preset)}
                aria-checked={activePreset === preset.id}
                onClick={() => selectPreset(preset.id, preset.seedColor)}
              />
            ))}
          </div>
          <div className="theme-preset-actions" aria-label={t("theme.moreAria")}>
            <button className="theme-action-circle" type="button" aria-expanded={prideOpen} aria-controls="pride-color-panel" aria-label="Pride Color" title="Pride Color" onClick={() => setPrideOpen((current) => !current)}>
              <MaterialIcon name="question_mark" />
            </button>
            <button className="theme-action-circle" type="button" aria-label={t("theme.custom")} title={t("theme.custom")} data-selected={activePreset === customThemePresetId} onClick={openCustomDialog}>
              <MaterialIcon name="palette" />
            </button>
          </div>
        </div>
      </div>
      <section className="theme-preset-popover" id="pride-color-panel" aria-label="Pride Color" data-open={prideOpen} inert={!prideOpen ? true : undefined}>
        <div className="theme-preset-panel-title">
          <span>Pride Color</span>
          <button className="theme-panel-close" type="button" aria-label={t("theme.pride.collapse")} onClick={() => setPrideOpen(false)}>
            <MaterialIcon name="close" />
          </button>
        </div>
        <div className="pride-picker">
          <div className="pride-scroll-hint">
            <MaterialIcon name="swipe" />
            <span>{t("theme.pride.hint")}</span>
          </div>
          <div className="pride-flag-scroll">
            <button className="pride-scroll-button" type="button" aria-label={t("theme.pride.left")} onClick={() => scrollPrideFlags("left")}>
              <MaterialIcon name="chevron_left" />
            </button>
            <div ref={prideSegmentsRef} className="pride-flag-segments" role="tablist" aria-label={t("theme.pride.select")}>
              {prideThemeFlags.map((flag) => (
                <button key={flag.id} type="button" role="tab" aria-selected={selectedPrideFlag === flag.id} data-selected={selectedPrideFlag === flag.id} onClick={() => setSelectedPrideFlag(flag.id)}>
                  {flag.name}
                </button>
              ))}
            </div>
            <button className="pride-scroll-button" type="button" aria-label={t("theme.pride.right")} onClick={() => scrollPrideFlags("right")}>
              <MaterialIcon name="chevron_right" />
            </button>
          </div>
          <div className="theme-preset-grid theme-preset-grid--compact" role="radiogroup" aria-label={`Pride Color ${selectedPrideFlag}`}>
            {pridePresets.map((preset) => (
              <button
                className="theme-preset-circle"
                style={{ "--theme-preset-color": preset.seedColor, "--theme-preset-background": preset.seedColor } as React.CSSProperties}
                data-selected={activePreset === preset.id}
                key={preset.id}
                type="button"
                role="radio"
                aria-label={presetLabel(preset)}
                title={presetLabel(preset)}
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
        {showReset ? <md-outlined-button onClick={resetDefaultTheme}>{t("theme.reset")}</md-outlined-button> : null}
      </div>
      <div className="theme-mode-row">
        <div>
          <h3 className="card-title">{t("theme.mode.title")}</h3>
          <p className="helper-text">{t("theme.mode.description")}</p>
        </div>
        <md-filled-select key={`${locale}-color-mode`} value={settings.colorMode ?? "system"} onInput={(event) => onChange({ colorMode: valueFrom(event) as ToolboxSettings["colorMode"] })}>
          <md-select-option value="system">
            <div slot="headline">{t("theme.mode.system")}</div>
          </md-select-option>
          <md-select-option value="light">
            <div slot="headline">{t("theme.mode.light")}</div>
          </md-select-option>
          <md-select-option value="dark">
            <div slot="headline">{t("theme.mode.dark")}</div>
          </md-select-option>
        </md-filled-select>
      </div>
      <md-dialog key={customDialogKey} class="hct-dialog" open={customDialogOpen} onClosed={handleCustomDialogClosed} onClose={handleCustomDialogClosed} onCancel={handleCustomDialogClosed}>
        <div slot="headline">{t("theme.hct.title")}</div>
        <div slot="content" className="hct-color-dialog">
          <div className="hct-color-preview" style={{ background: customDraftColor.hex }} aria-hidden="true" />
          <div className="hct-field-grid">
            <label className="hex-field" data-error={customDraftHexIsInvalid}>
              <span>HEX</span>
              <div className="hex-input-shell">
                <span aria-hidden="true">#</span>
                <input aria-invalid={customDraftHexIsInvalid} aria-label="HEX" value={customDraftColor.hex.replace(/^#/, "")} maxLength={6} onInput={(event) => updateDraftHex((event.currentTarget as HTMLInputElement).value)} />
              </div>
              {customDraftHexIsInvalid ? <small>{t("theme.hct.invalidHex")}</small> : null}
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
          <md-text-button onClick={() => closeCustomDialog(false)}>{t("common.cancel")}</md-text-button>
          <md-filled-button onClick={applyCustomColor}>{t("common.apply")}</md-filled-button>
        </div>
      </md-dialog>
    </div>
  );
}
