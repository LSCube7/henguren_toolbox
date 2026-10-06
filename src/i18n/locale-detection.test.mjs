import assert from "node:assert/strict";
import test from "node:test";
import { resolveRequestLocale } from "./locale-detection.ts";

test("selects Chinese for zh language preferences", () => {
  assert.equal(resolveRequestLocale("zh-CN,zh;q=0.9,en;q=0.8"), "zh-CN");
  assert.equal(resolveRequestLocale("zh-Hant;q=1,en;q=0.5"), "zh-CN");
  assert.equal(resolveRequestLocale("zh"), "zh-CN");
});

test("defaults non-Chinese language preferences to English", () => {
  assert.equal(resolveRequestLocale("en-US,en;q=0.9,zh;q=0.8"), "en-US");
  assert.equal(resolveRequestLocale("fr-FR"), "en-US");
  assert.equal(resolveRequestLocale(null), "en-US");
});

test("honors quality weights and excludes rejected languages", () => {
  assert.equal(resolveRequestLocale("zh-CN;q=0,en-US;q=1"), "en-US");
  assert.equal(resolveRequestLocale("en-US;q=0.5,zh-CN;q=1"), "zh-CN");
  assert.equal(resolveRequestLocale("zh-CN;q=0"), "en-US");
});

test("skips unsupported languages before selecting the preferred locale", () => {
  assert.equal(resolveRequestLocale("fr-FR,zh-CN;q=0.9"), "zh-CN");
  assert.equal(resolveRequestLocale("*;q=1,en-US;q=0,zh-CN;q=0.8"), "zh-CN");
  assert.equal(resolveRequestLocale("*;q=1,zh-CN;q=0.8"), "en-US");
  assert.equal(resolveRequestLocale("fr-FR,en-US;q=0.8"), "en-US");
});

test("cloud settings use the explicit route locale before browser preferences", async () => {
  const { resolveSettingsLocale } = await import("./locale-detection.ts");
  assert.equal(resolveSettingsLocale("zh-CN", "en-US,en;q=0.9"), "zh-CN");
  assert.equal(resolveSettingsLocale("en-US", "zh-CN"), "en-US");
  assert.equal(resolveSettingsLocale(null, "zh-CN"), "zh-CN");
  assert.equal(resolveSettingsLocale("fr", "en-US"), "en-US");
});
