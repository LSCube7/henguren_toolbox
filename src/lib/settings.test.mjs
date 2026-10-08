import assert from "node:assert/strict";
import test from "node:test";
import { defaultSettings, defaultSettingsForLocale, normalizeToolboxSettings } from "./types.ts";
import { parseOnboardingCloudChoice } from "./onboarding-cloud-choice.ts";

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

test("restores the onboarding cloud choice and pre-cloud settings", () => {
  const fallbackSettings = { ...defaultSettings, locale: "zh-CN" };
  const choice = parseOnboardingCloudChoice(JSON.stringify({
    version: 1,
    userId: "user-1",
    decision: "cloud",
    localSettings: { locale: "en-US", showHint: false }
  }), fallbackSettings);

  assert.equal(choice?.userId, "user-1");
  assert.equal(choice?.decision, "cloud");
  assert.equal(choice?.localSettings.locale, "en-US");
  assert.equal(choice?.localSettings.showHint, false);
});

test("rejects invalid onboarding cloud choice state", () => {
  assert.equal(parseOnboardingCloudChoice("not-json", defaultSettings), null);
  assert.equal(parseOnboardingCloudChoice(JSON.stringify({ version: 1, decision: "cloud" }), defaultSettings), null);
});

test("normalizes unsupported restored locales to the current supported locale", () => {
  const fallback = defaultSettingsForLocale("zh-CN");
  for (const locale of ["fr", "", null, 42, { code: "en-US" }]) {
    assert.equal(normalizeToolboxSettings({ locale, showHint: false }, fallback).locale, "zh-CN");
    const choice = parseOnboardingCloudChoice(JSON.stringify({ version: 1, userId: "user-1", decision: "cloud", localSettings: { locale } }), fallback);
    assert.equal(choice.localSettings.locale, "zh-CN");
  }
});

test("cloud snapshots keep explicit languages and fill invalid languages from the route", async () => {
  const { resolveSettingsLocale } = await import("../i18n/locale-detection.ts");
  const fallback = defaultSettingsForLocale(resolveSettingsLocale("zh-CN", "en-US"));
  for (const snapshot of [{ showHint: false }, { locale: "fr" }, { locale: null }]) {
    assert.equal(normalizeToolboxSettings(snapshot, fallback).locale, "zh-CN");
  }
  assert.equal(normalizeToolboxSettings({ locale: "en-US" }, fallback).locale, "en-US");
});
