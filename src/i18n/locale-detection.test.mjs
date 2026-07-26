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
  assert.equal(resolveRequestLocale("fr-FR,zh;q=0.8"), "en-US");
  assert.equal(resolveRequestLocale(null), "en-US");
});
