"use client";

import { M3eButton } from "@m3e/react/button";
import { M3eButtonGroup } from "@m3e/react/button-group";
import { moveButtonGroupSelection } from "@/app/components/button-group-keyboard";
import { M3eCard } from "@m3e/react/card";
import { M3eIconButton, type M3eIconButtonElement } from "@m3e/react/icon-button";
import { Dialog as M3eDialog } from "./Dialog";
import { CorePalette, Hct, argbFromHex, hexFromArgb } from "@material/material-color-utilities";
import { useMemo, useRef, useState, type KeyboardEvent } from "react";
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

function moveThemeSelection(event: KeyboardEvent<HTMLElement>) {
  if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) return;
  const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('[role="radio"], [role="tab"]'));
  const index = buttons.indexOf(event.target as HTMLElement);
  if (index < 0) return;
  event.preventDefault();
  const next = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 :
    (index + (event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 1) + buttons.length) % buttons.length;
  buttons[next]?.focus();
  buttons[next]?.click();
}

export function ThemePicker({
  settings,
  onChange,
  showReset = true,
  showModeDescription = true
}: {
  settings: ToolboxSettings;
  onChange: (next: Partial<ToolboxSettings>) => void;
  showReset?: boolean;
  showModeDescription?: boolean;
}) {
  const { t } = useI18n();
  const [prideOpen, setPrideOpen] = useState(false);
  const prideTriggerRef = useRef<M3eIconButtonElement>(null);
  function closePridePanel() {
    setPrideOpen(false);
    prideTriggerRef.current?.focus();
  }
  const [selectedPrideFlag, setSelectedPrideFlag] = useState(() => readInitialPrideFlag(settings.themeSeedColor));
  const [customDialogOpen, setCustomDialogOpen] = useState(false);
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
    setCustomDialogOpen(true);
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
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth"
    });
  }

  return (
    <div className="theme-settings">
      <div className="theme-preset-section">
        <div className="theme-preset-row">
          <div className="theme-preset-grid" role="radiogroup" onKeyDown={moveThemeSelection} aria-label={t("theme.presetAria")}>
            {standardPresets.map((preset, index) => (
              <button
                className="theme-preset-circle"
                style={{ "--theme-preset-color": preset.seedColor, "--theme-preset-background": preset.seedColor } as React.CSSProperties}
                data-selected={activePreset === preset.id}
                key={preset.id}
                type="button"
                role="radio"
                aria-label={presetLabel(preset)}
                title={presetLabel(preset)}
                aria-checked={(activePreset === preset.id) ? "true" : "false"}
                tabIndex={activePreset === preset.id || (!standardPresets.some((item) => item.id === activePreset) && index === 0) ? 0 : -1}
                onClick={() => selectPreset(preset.id, preset.seedColor)}
              />
            ))}
          </div>
          <div className="theme-preset-actions" aria-label={t("theme.moreAria")}>
            <M3eIconButton ref={prideTriggerRef} aria-expanded={prideOpen} aria-controls="pride-color-panel" aria-label="Pride Color" title="Pride Color" onClick={() => setPrideOpen((current) => !current)}>
              <MaterialIcon name="question_mark" />
            </M3eIconButton>
            <M3eIconButton aria-label={t("theme.custom")} title={t("theme.custom")} data-selected={activePreset === customThemePresetId} onClick={openCustomDialog}>
              <MaterialIcon name="palette" />
            </M3eIconButton>
          </div>
        </div>
      </div>
      <section className="theme-preset-popover" id="pride-color-panel" aria-label="Pride Color" data-open={prideOpen} inert={!prideOpen ? true : undefined}
        onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); closePridePanel(); } }}>
        <M3eCard className="theme-preset-card" variant="elevated">
          <div slot="content" className="theme-preset-card-content">
          <header className="theme-preset-panel-title">
            <span>Pride Color</span>
            <M3eIconButton aria-label={t("theme.pride.collapse")} onClick={closePridePanel}>
              <MaterialIcon name="close" />
            </M3eIconButton>
          </header>
          <div className="pride-picker">
            <div className="pride-scroll-hint">
              <MaterialIcon name="swipe" />
              <span>{t("theme.pride.hint")}</span>
            </div>
            <div className="pride-flag-scroll">
              <M3eIconButton aria-label={t("theme.pride.left")} onClick={() => scrollPrideFlags("left")}>
                <MaterialIcon name="chevron_left" />
              </M3eIconButton>
              <div ref={prideSegmentsRef} className="pride-flag-segments">
                <M3eButtonGroup variant="connected" onKeyDown={moveButtonGroupSelection} role="radiogroup" aria-label={t("theme.pride.select")}>
                  {prideThemeFlags.map((flag) => (
                    <M3eButton
                      key={flag.id}
                      variant="tonal"
                      size="medium"
                      shape="square"
                      toggle
                      selected={selectedPrideFlag === flag.id}
                      role="radio"
                      aria-checked={selectedPrideFlag === flag.id ? "true" : "false"}
                      tabIndex={selectedPrideFlag === flag.id ? 0 : -1}
                      onBeforeInput={(event) => { if (selectedPrideFlag === flag.id) event.preventDefault(); }}
                      onClick={() => setSelectedPrideFlag(flag.id)}
                    >
                      {flag.name}
                    </M3eButton>
                  ))}
                </M3eButtonGroup>
              </div>
              <M3eIconButton aria-label={t("theme.pride.right")} onClick={() => scrollPrideFlags("right")}>
                <MaterialIcon name="chevron_right" />
              </M3eIconButton>
            </div>
            <div className="theme-preset-grid theme-preset-grid--compact" role="radiogroup" aria-label={`Pride Color ${selectedPrideFlag}`} onKeyDown={moveThemeSelection}>
              {pridePresets.map((preset, index) => (
                <button
                  className="theme-preset-circle"
                  style={{ "--theme-preset-color": preset.seedColor, "--theme-preset-background": preset.seedColor } as React.CSSProperties}
                  data-selected={activePreset === preset.id}
                  key={preset.id}
                  type="button"
                  role="radio"
                  aria-label={presetLabel(preset)}
                  title={presetLabel(preset)}
                  aria-checked={(activePreset === preset.id) ? "true" : "false"}
                  tabIndex={activePreset === preset.id || (!pridePresets.some((item) => item.id === activePreset) && index === 0) ? 0 : -1}
                  onClick={() => selectPreset(preset.id, preset.seedColor)}
                />
              ))}
            </div>
          </div>
          </div>
        </M3eCard>
      </section>
      <div className="custom-theme-row">
        <span className="custom-color-readout" style={{ "--theme-preset-color": customColorValue } as React.CSSProperties}>
          {customColorValue.toUpperCase()}
        </span>
        {showReset ? <M3eButton variant="outlined" onClick={resetDefaultTheme}>{t("theme.reset")}</M3eButton> : null}
      </div>
      <div className="theme-mode-row">
        <div>
          <h3 className="card-title">{t("theme.mode.title")}</h3>
          {showModeDescription ? <p className="helper-text">{t("theme.mode.description")}</p> : null}
        </div>
        <M3eButtonGroup variant="connected" onKeyDown={moveButtonGroupSelection} aria-label={t("theme.mode.title")}>
          {(["system", "light", "dark"] as const).map((mode) =>
            <M3eButton key={mode} variant="tonal" shape="square" toggle
              selected={(settings.colorMode ?? "system") === mode}
              role="radio" tabIndex={(settings.colorMode ?? "system") === mode ? 0 : -1}
              aria-checked={((settings.colorMode ?? "system") === mode) ? "true" : "false"}
              onBeforeInput={(event) => { if ((settings.colorMode ?? "system") === mode) event.preventDefault(); }}
              onClick={() => onChange({ colorMode: mode })}>{t(("theme.mode." + mode) as MessageKey)}</M3eButton>
          )}
        </M3eButtonGroup>
      </div>
      <M3eDialog open={customDialogOpen}
        onClosed={handleCustomDialogClosed} onCancel={handleCustomDialogClosed}>
        <div slot="header">{t("theme.hct.title")}</div>
        <div className="hct-color-dialog">
          <div className="hct-color-preview" style={{ background: customDraftColor.hex }} aria-hidden="true" />
          <div className="hct-field-grid">
            <label className="hex-field" data-error={customDraftHexIsInvalid}>
              <span>HEX</span>
              <div className="hex-input-shell">
                <span aria-hidden="true">#</span>
                <input aria-invalid={customDraftHexIsInvalid} aria-label="HEX" aria-describedby={customDraftHexIsInvalid ? "hct-hex-error" : undefined} value={customDraftColor.hex.replace(/^#/, "")} maxLength={6} onInput={(event) => updateDraftHex((event.currentTarget as HTMLInputElement).value)} />
              </div>
              {customDraftHexIsInvalid ? <small id="hct-hex-error">{t("theme.hct.invalidHex")}</small> : null}
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
          <div className="hct-slider hct-slider--hue" style={{ "--hct-slider-track": hctGradients.hue } as React.CSSProperties}>
            <span>Hue</span>
            <input className="hct-slider__value" aria-label="Hue" type="number" min={0} max={360} value={customDraftColor.hue} onInput={(event) => updateDraftHct({ hue: Number((event.currentTarget as HTMLInputElement).value) })} />
            <input className="hct-slider__range" aria-label="Hue" type="range" min={0} max={360} value={customDraftColor.hue} onInput={(event) => updateDraftHct({ hue: Number((event.currentTarget as HTMLInputElement).value) })} />
          </div>
          <div className="hct-slider hct-slider--chroma" style={{ "--hct-slider-track": hctGradients.chroma } as React.CSSProperties}>
            <span>Chroma</span>
            <input className="hct-slider__value" aria-label="Chroma" type="number" min={0} max={150} value={customDraftColor.chroma} onInput={(event) => updateDraftHct({ chroma: Number((event.currentTarget as HTMLInputElement).value) })} />
            <input className="hct-slider__range" aria-label="Chroma" type="range" min={0} max={150} value={customDraftColor.chroma} onInput={(event) => updateDraftHct({ chroma: Number((event.currentTarget as HTMLInputElement).value) })} />
          </div>
          <div className="hct-slider hct-slider--tone" style={{ "--hct-slider-track": hctGradients.tone } as React.CSSProperties}>
            <span>Tone</span>
            <input className="hct-slider__value" aria-label="Tone" type="number" min={0} max={100} value={customDraftColor.tone} onInput={(event) => updateDraftHct({ tone: Number((event.currentTarget as HTMLInputElement).value) })} />
            <input className="hct-slider__range" aria-label="Tone" type="range" min={0} max={100} value={customDraftColor.tone} onInput={(event) => updateDraftHct({ tone: Number((event.currentTarget as HTMLInputElement).value) })} />
          </div>
        </div>
        <div slot="actions">
          <M3eButton variant="text" onClick={() => closeCustomDialog(false)}>{t("common.cancel")}</M3eButton>
          <M3eButton variant="filled" onClick={applyCustomColor}>{t("common.apply")}</M3eButton>
        </div>
      </M3eDialog>
    </div>
  );
}
