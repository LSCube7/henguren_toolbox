"use client";

import "../material-web";
import { defaultThemeSeed, resolveThemeSeed } from "@/lib/theme-presets";
import { argbFromHex, hexFromArgb, themeFromSourceColor, type Scheme } from "@material/material-color-utilities";
import { useEffect, useState, useSyncExternalStore } from "react";

type StoredTheme = {
  themePreset?: string;
  themeSeedColor?: string;
  colorMode?: "light" | "dark" | "system";
};

const settingsKey = "henguren-v3-settings";

const schemeColorRoles = [
  "primary",
  "onPrimary",
  "primaryContainer",
  "onPrimaryContainer",
  "secondary",
  "onSecondary",
  "secondaryContainer",
  "onSecondaryContainer",
  "tertiary",
  "onTertiary",
  "tertiaryContainer",
  "onTertiaryContainer",
  "error",
  "onError",
  "errorContainer",
  "onErrorContainer",
  "background",
  "onBackground",
  "surface",
  "onSurface",
  "surfaceVariant",
  "onSurfaceVariant",
  "outline",
  "outlineVariant",
  "shadow",
  "scrim",
  "inverseSurface",
  "inverseOnSurface",
  "inversePrimary"
] as const;

function getStoredTheme(): StoredTheme {
  if (typeof window === "undefined") return {};
  try {
    const saved = localStorage.getItem(settingsKey);
    return saved ? (JSON.parse(saved) as StoredTheme) : {};
  } catch {
    return {};
  }
}

function resolveMode(mode: StoredTheme["colorMode"]) {
  if (typeof window === "undefined") return "light";
  if (!mode || mode === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return mode;
}

function roleToCssName(role: string) {
  return role.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

function readSchemeColor(scheme: Scheme, role: (typeof schemeColorRoles)[number]) {
  return hexFromArgb(scheme.toJSON()[role]);
}

function setSchemeColor(root: HTMLElement, role: (typeof schemeColorRoles)[number], value: string) {
  root.style.setProperty(`--md-sys-color-${roleToCssName(role)}`, value);
}

function hexToRgb(hex: string) {
  const normalized = hex.replace("#", "");
  const parsed = Number.parseInt(normalized, 16);
  return {
    r: (parsed >> 16) & 255,
    g: (parsed >> 8) & 255,
    b: parsed & 255
  };
}

function rgbToHex({ r, g, b }: { r: number; g: number; b: number }) {
  const channel = (value: number) => value.toString(16).padStart(2, "0");
  return `#${channel(r)}${channel(g)}${channel(b)}`;
}

function mixHex(from: string, to: string, amount: number) {
  const start = hexToRgb(from);
  const end = hexToRgb(to);
  const mix = (a: number, b: number) => Math.round(a + (b - a) * amount);
  return rgbToHex({
    r: mix(start.r, end.r),
    g: mix(start.g, end.g),
    b: mix(start.b, end.b)
  });
}

function applyTheme(theme: StoredTheme) {
  const seed = resolveThemeSeed(theme.themeSeedColor || defaultThemeSeed);
  const mode = resolveMode(theme.colorMode);
  const root = document.documentElement;
  let materialTheme;
  try {
    materialTheme = themeFromSourceColor(argbFromHex(seed));
  } catch {
    materialTheme = themeFromSourceColor(argbFromHex(defaultThemeSeed));
  }
  const scheme = mode === "dark" ? materialTheme.schemes.dark : materialTheme.schemes.light;
  root.dataset.theme = mode;
  root.style.setProperty("--md-source-color", seed);
  schemeColorRoles.forEach((role) => setSchemeColor(root, role, readSchemeColor(scheme, role)));

  const surface = readSchemeColor(scheme, "surface");
  const primaryContainer = readSchemeColor(scheme, "primaryContainer");
  const secondaryContainer = readSchemeColor(scheme, "secondaryContainer");
  const onSurface = readSchemeColor(scheme, "onSurface");
  if (mode === "dark") {
    root.style.setProperty("--md-sys-color-surface-dim", mixHex(surface, "#000000", 0.08));
    root.style.setProperty("--md-sys-color-surface-bright", mixHex(surface, primaryContainer, 0.18));
    root.style.setProperty("--md-sys-color-surface-container-lowest", mixHex(surface, "#000000", 0.22));
    root.style.setProperty("--md-sys-color-surface-container-low", mixHex(surface, primaryContainer, 0.08));
    root.style.setProperty("--md-sys-color-surface-container", mixHex(surface, primaryContainer, 0.12));
    root.style.setProperty("--md-sys-color-surface-container-high", mixHex(surface, secondaryContainer, 0.16));
    root.style.setProperty("--md-sys-color-surface-container-highest", mixHex(surface, secondaryContainer, 0.22));
  } else {
    root.style.setProperty("--md-sys-color-surface-dim", mixHex(surface, onSurface, 0.12));
    root.style.setProperty("--md-sys-color-surface-bright", surface);
    root.style.setProperty("--md-sys-color-surface-container-lowest", "#ffffff");
    root.style.setProperty("--md-sys-color-surface-container-low", mixHex(surface, primaryContainer, 0.2));
    root.style.setProperty("--md-sys-color-surface-container", mixHex(surface, primaryContainer, 0.28));
    root.style.setProperty("--md-sys-color-surface-container-high", mixHex(surface, secondaryContainer, 0.34));
    root.style.setProperty("--md-sys-color-surface-container-highest", mixHex(surface, secondaryContainer, 0.45));
  }
}

export function AppThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeState, setThemeState] = useState<StoredTheme>(() => getStoredTheme());
  const mounted = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false
  );

  useEffect(() => {
    applyTheme(themeState);
  }, [themeState]);

  useEffect(() => {
    applyTheme(getStoredTheme());
    function refreshTheme() {
      setThemeState(getStoredTheme());
    }
    function previewTheme(event: Event) {
      const preview = (event as CustomEvent<StoredTheme>).detail;
      applyTheme({ ...getStoredTheme(), ...preview });
    }
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    window.addEventListener("storage", refreshTheme);
    window.addEventListener("henguren-theme-change", refreshTheme);
    window.addEventListener("henguren-theme-preview", previewTheme);
    media.addEventListener("change", refreshTheme);
    return () => {
      window.removeEventListener("storage", refreshTheme);
      window.removeEventListener("henguren-theme-change", refreshTheme);
      window.removeEventListener("henguren-theme-preview", previewTheme);
      media.removeEventListener("change", refreshTheme);
    };
  }, []);

  if (!mounted) {
    return null;
  }

  return children;
}
