import test from "node:test";
import assert from "node:assert/strict";
import {
  getLocaleFromPathname,
  localizePath,
  resolveClientLocale,
  safeOnboardingReturnTo,
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

test("keeps the locale on root paths with queries and fragments", () => {
  for (const path of ["/zh-CN?source=home", "/zh-CN#section", "/zh-CN?source=home#section"]) {
    const locale = getLocaleFromPathname(path);
    assert.equal(locale, "zh-CN");
    assert.equal(localizePath(locale, path), path);
  }
  assert.equal(getLocaleFromPathname("/zh-CNfoo?source=home"), null);
});

test("onboarding settings choices preserve session URL context and use the final language on return", () => {
  const currentUrl = "/en-US/onboarding?returnTo=%2Fen-US%2Fvocab%3Flist%3Dunit1%23words&auth=ok&restart=1#cloud";
  const cloudUrl = localizePath("zh-CN", currentUrl);
  assert.equal(cloudUrl, "/zh-CN/onboarding?returnTo=%2Fen-US%2Fvocab%3Flist%3Dunit1%23words&auth=ok&restart=1#cloud");
  assert.equal(localizePath("en-US", cloudUrl), currentUrl);
  const returnTo = new URL(cloudUrl, "https://toolbox.example").searchParams.get("returnTo");
  assert.equal(localizePath("zh-CN", returnTo), "/zh-CN/vocab?list=unit1#words");
});

test("rejects onboarding returns at every path boundary", () => {
  for (const path of [
    "/onboarding", "/onboarding#cloud", "/onboarding?auth=ok#cloud", "/onboarding/", "/onboarding/step",
    "/zh-CN/onboarding#cloud", "/en-US/onboarding/?restart=1#cloud", "/zh-CN/onboarding/step",
    "/zh-CN/settings/../onboarding#cloud", "/en-US/%6fnboarding#cloud", "/zh-CN/settings/%2e%2e/onboarding"
  ]) {
    assert.equal(safeOnboardingReturnTo(path, "zh-CN"), "/zh-CN", path);
  }
});

test("rejects invalid and API onboarding returns", () => {
  for (const path of [null, "", "https://example.test/", "//example.test/", "/\\example.test/", "/%", "/api", "/api/me#status", "/zh-CN/api/auth/login", "/en-US/%61pi/me"]) {
    assert.equal(safeOnboardingReturnTo(path, "en-US"), "/en-US", path);
  }
});

test("preserves valid onboarding return queries and fragments", () => {
  assert.equal(safeOnboardingReturnTo("/zh-CN/vocab?list=unit1#words", "en-US"), "/en-US/vocab?list=unit1#words");
  assert.equal(safeOnboardingReturnTo("/zh-CN?source=home#section", "zh-CN"), "/zh-CN?source=home#section");
  assert.equal(safeOnboardingReturnTo("/settings?returnTo=%2Fonboarding%23cloud#theme", "en-US"), "/en-US/settings?returnTo=%2Fonboarding%23cloud#theme");
  assert.equal(safeOnboardingReturnTo("/onboarding-help#intro", "en-US"), "/en-US/onboarding-help#intro");
});
