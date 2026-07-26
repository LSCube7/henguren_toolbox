import assert from "node:assert/strict";
import test from "node:test";
import { defaultSettings, normalizeToolboxSettings } from "./types.ts";

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
