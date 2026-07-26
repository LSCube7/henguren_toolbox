import assert from "node:assert/strict";
import test from "node:test";
import { defaultSettings, defaultSettingsForLocale, normalizeToolboxSettings } from "./types.ts";

test("creates request-aware default settings", () => {
  assert.equal(defaultSettingsForLocale("zh-CN").locale, "zh-CN");
  assert.equal(defaultSettingsForLocale("en-US"), defaultSettings);
});

test("uses the request locale when legacy settings omit locale", () => {
  const fallbackSettings = { ...defaultSettings, locale: "zh-CN" };
  const normalized = normalizeToolboxSettings({ showHint: false }, fallbackSettings);

  assert.equal(normalized.locale, "zh-CN");
  assert.equal(normalized.showHint, false);
});

test("preserves an explicitly saved locale", () => {
  const fallbackSettings = { ...defaultSettings, locale: "zh-CN" };
  const normalized = normalizeToolboxSettings({ locale: "en-US" }, fallbackSettings);

  assert.equal(normalized.locale, "en-US");
});
