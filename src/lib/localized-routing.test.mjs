import test from "node:test";
import assert from "node:assert/strict";
import {
  getLocaleFromPathname,
  localizePath,
  resolveClientLocale,
  stripLocalePrefix
} from "./localized-routing.ts";

test("localizes logical paths and preserves query/hash", () => {
  assert.equal(localizePath("zh-CN", "/settings?tab=theme#colors"), "/zh-CN/settings?tab=theme#colors");
  assert.equal(localizePath("en-US", "/zh-CN/vocab/print?mode=word"), "/en-US/vocab/print?mode=word");
  assert.equal(localizePath("en-US", "/"), "/en-US");
});

test("strips only a valid locale prefix", () => {
  assert.equal(stripLocalePrefix("/zh-CN/settings?tab=theme#colors"), "/settings?tab=theme#colors");
  assert.equal(stripLocalePrefix("/settings"), "/settings");
  assert.equal(stripLocalePrefix("/en-US"), "/");
  assert.equal(getLocaleFromPathname("/zh-CNfoo/settings"), null);
  assert.equal(getLocaleFromPathname("/en-US/user"), "en-US");
});

test("resolves saved locale before browser preferences", () => {
  assert.equal(resolveClientLocale("zh-CN", ["en-US"]), "zh-CN");
  assert.equal(resolveClientLocale(null, ["zh-TW", "en-US"]), "zh-CN");
  assert.equal(resolveClientLocale(null, ["fr-FR"]), "en-US");
});
