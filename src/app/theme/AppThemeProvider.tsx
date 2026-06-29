"use client";

import "../material-web";
import { useEffect, useState, useSyncExternalStore } from "react";

type StoredTheme = {
  themeSeedColor?: string;
  colorMode?: "light" | "dark" | "system";
};

const settingsKey = "henguren-v3-settings";
const defaultSeed = "#4f7cff";

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
  if (mode === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return mode ?? "light";
}

function hexToRgb(hex: string) {
  const normalized = hex.replace("#", "");
  const value = normalized.length === 3 ? normalized.split("").map((item) => item + item).join("") : normalized;
  const parsed = Number.parseInt(value, 16);
  if (Number.isNaN(parsed)) return { r: 79, g: 124, b: 255 };
  return { r: (parsed >> 16) & 255, g: (parsed >> 8) & 255, b: parsed & 255 };
}

function mix(hex: string, target: "#ffffff" | "#000000", amount: number) {
  const source = hexToRgb(hex);
  const end = target === "#ffffff" ? { r: 255, g: 255, b: 255 } : { r: 0, g: 0, b: 0 };
  const channel = (start: number, finish: number) => Math.round(start + (finish - start) * amount);
  return `rgb(${channel(source.r, end.r)}, ${channel(source.g, end.g)}, ${channel(source.b, end.b)})`;
}

function applyTheme(theme: StoredTheme) {
  const seed = theme.themeSeedColor || defaultSeed;
  const mode = resolveMode(theme.colorMode);
  const root = document.documentElement;
  root.dataset.theme = mode;
  root.style.setProperty("--md-source-color", seed);
  root.style.setProperty("--md-sys-color-primary", mode === "dark" ? mix(seed, "#ffffff", 0.32) : seed);
  root.style.setProperty("--md-sys-color-on-primary", mode === "dark" ? "#0a1b3f" : "#ffffff");
  root.style.setProperty("--md-sys-color-primary-container", mode === "dark" ? mix(seed, "#000000", 0.62) : mix(seed, "#ffffff", 0.78));
  root.style.setProperty("--md-sys-color-on-primary-container", mode === "dark" ? "#dbe6ff" : "#09235f");
  root.style.setProperty("--md-sys-color-secondary", mode === "dark" ? "#c0c6dc" : "#586176");
  root.style.setProperty("--md-sys-color-secondary-container", mode === "dark" ? "#40475a" : "#dce2f9");
  root.style.setProperty("--md-sys-color-tertiary", mode === "dark" ? "#e3b9d7" : "#75536c");
  root.style.setProperty("--md-sys-color-surface", mode === "dark" ? "#111318" : "#f8f9ff");
  root.style.setProperty("--md-sys-color-surface-dim", mode === "dark" ? "#111318" : "#d8d9e2");
  root.style.setProperty("--md-sys-color-surface-container-low", mode === "dark" ? "#1a1b20" : "#f2f3fb");
  root.style.setProperty("--md-sys-color-surface-container", mode === "dark" ? "#1e2026" : "#eceef7");
  root.style.setProperty("--md-sys-color-surface-container-high", mode === "dark" ? "#292b31" : "#e6e8f1");
  root.style.setProperty("--md-sys-color-on-surface", mode === "dark" ? "#e3e2e9" : "#1a1b20");
  root.style.setProperty("--md-sys-color-on-surface-variant", mode === "dark" ? "#c6c6d0" : "#454852");
  root.style.setProperty("--md-sys-color-outline", mode === "dark" ? "#90939d" : "#757780");
  root.style.setProperty("--md-sys-color-outline-variant", mode === "dark" ? "#454852" : "#c6c6d0");
  root.style.setProperty("--md-sys-color-error", mode === "dark" ? "#ffb4ab" : "#ba1a1a");
  root.style.setProperty("--md-sys-color-error-container", mode === "dark" ? "#93000a" : "#ffdad6");
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
    window.addEventListener("storage", refreshTheme);
    window.addEventListener("henguren-theme-change", refreshTheme);
    return () => {
      window.removeEventListener("storage", refreshTheme);
      window.removeEventListener("henguren-theme-change", refreshTheme);
    };
  }, []);

  if (!mounted) {
    return null;
  }

  return children;
}
