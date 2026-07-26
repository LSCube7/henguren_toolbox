"use client";

import "client-only";

import { useMemo, useSyncExternalStore } from "react";
import { defaultSettings, normalizeToolboxSettings, type ToolboxSettings } from "./types";

export const toolboxSettingsKey = "henguren-v3-settings";
export const toolboxSettingsChangeEvent = "henguren-settings-change";

function parseSettings(serialized: string | null, fallbackSettings = defaultSettings): ToolboxSettings {
  if (!serialized) return fallbackSettings;
  try {
    const saved = JSON.parse(serialized) as unknown;
    if (!saved || typeof saved !== "object") return fallbackSettings;
    return normalizeToolboxSettings(saved, fallbackSettings);
  } catch {
    return fallbackSettings;
  }
}

function getSettingsSnapshot() {
  return typeof window === "undefined" ? null : localStorage.getItem(toolboxSettingsKey);
}

function subscribeToSettings(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(toolboxSettingsChangeEvent, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(toolboxSettingsChangeEvent, onStoreChange);
  };
}

export function readClientSettings() {
  return parseSettings(getSettingsSnapshot());
}

export function writeClientSettings(settings: ToolboxSettings) {
  localStorage.setItem(toolboxSettingsKey, JSON.stringify(normalizeToolboxSettings(settings)));
  window.dispatchEvent(new Event(toolboxSettingsChangeEvent));
}

export function useClientSettings(fallbackSettings = defaultSettings) {
  const serialized = useSyncExternalStore(subscribeToSettings, getSettingsSnapshot, () => null);
  return useMemo(() => parseSettings(serialized, fallbackSettings), [fallbackSettings, serialized]);
}
