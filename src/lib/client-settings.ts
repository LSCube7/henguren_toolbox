"use client";

import "client-only";

import { useMemo, useSyncExternalStore } from "react";
import { defaultSettings, type ToolboxSettings } from "./types";

export const toolboxSettingsKey = "henguren-v3-settings";
export const toolboxSettingsChangeEvent = "henguren-settings-change";

function parseSettings(serialized: string | null): ToolboxSettings {
  if (!serialized) return defaultSettings;
  try {
    return { ...defaultSettings, ...(JSON.parse(serialized) as Partial<ToolboxSettings>) };
  } catch {
    return defaultSettings;
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
  localStorage.setItem(toolboxSettingsKey, JSON.stringify(settings));
  window.dispatchEvent(new Event(toolboxSettingsChangeEvent));
}

export function useClientSettings() {
  const serialized = useSyncExternalStore(subscribeToSettings, getSettingsSnapshot, () => null);
  return useMemo(() => parseSettings(serialized), [serialized]);
}
