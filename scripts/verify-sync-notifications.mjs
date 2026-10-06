import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { parseVocabSnapshot, mergeVocabSnapshots } from "../src/lib/vocab-sync.ts";

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE_PATH || "playwright");
const origin = process.env.SYNC_TEST_BASE_URL || "http://localhost:3016";
assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(new URL(origin).hostname));
const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || "msedge", headless: true });
const day = "2026-01-01T00:00:00.000Z";
const owner = 'account:"review-account"';
const word = name => ({ id: `unit:${name}`, sourceName: "unit", word: name, definitions: ["fixture"], wrongCount: 1, wrongAttempts: [{ id: `attempt-${name}`, clientId: "fixture", createdAt: day }], createdAt: day, updatedAt: day });
const mastery = name => ({ id: `unit:${name}`, level: "reviewing", correctStreak: 1, reviewCount: 1, lastReviewedAt: day, nextReviewAt: day, updatedAt: day, wrongAttemptIds: [`attempt-${name}`] });
function snapshot(userId, names = []) {
  return parseVocabSnapshot({ schemaVersion: 2, userId, clientId: "fixture", records: names.map(word), deletedRecords: [], deletedBatches: [], updatedAt: day, learningSchemaVersion: 1, masteryRecords: names.map(mastery) }, userId);
}
async function waitFor(check) {
  for (let attempt = 0; attempt < 150; attempt++) {
    if (await check()) return;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error("Fixture condition timed out");
}
async function fixture({ developer = false, initialOwner = owner, denyOwnerNotification = false } = {}) {
  const context = await browser.newContext({ serviceWorkers: "block", locale: "zh-CN" });
  const state = { signedIn: true, cloud: snapshot("review-account"), writes: 0 };
  await context.addInitScript(({ owner, initialOwner, developer, denyOwnerNotification, account, guest }) => {
    localStorage.setItem("henguren-v3-onboarding", JSON.stringify({ completed: true }));
    localStorage.setItem("henguren-v3-settings", JSON.stringify({ locale: "zh-CN", developerMode: developer }));
    localStorage.setItem("henguren-v3-edition", "senior");
    if (denyOwnerNotification) {
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = function(key, value) {
        if (key === "henguren-v3-learning-owner-event") throw new DOMException("Fixture denied", "SecurityError");
        return original.call(this, key, value);
      };
    }
    if (localStorage.getItem("review-seeded")) return;
    localStorage.setItem("review-seeded", "1");
    const request = indexedDB.open("henguren-v3", 3);
    request.onupgradeneeded = () => {
      for (const name of ["wrongbook", "wrongbook-meta", "learning-partitions", "learning-state"]) request.result.createObjectStore(name, { keyPath: name === "learning-partitions" ? "owner" : "id" });
    };
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(["learning-partitions", "learning-state"], "readwrite");
      transaction.objectStore("learning-state").put({ id: "active", owner: initialOwner });
      transaction.objectStore("learning-state").put({ id: "migration", version: 1 });
      transaction.objectStore("learning-partitions").put({ owner, wrongbook: account, masteryRecords: account.masteryRecords, sync: { enabled: false, localVersion: 0, confirmedVersion: -1 } });
      transaction.objectStore("learning-partitions").put({ owner: "guest", wrongbook: guest, masteryRecords: guest.masteryRecords });
      transaction.oncomplete = () => db.close();
    };
  }, { owner, initialOwner, developer, denyOwnerNotification, account: snapshot("local", ["alpha"]), guest: snapshot("local", ["guestword"]) });
  await context.route("**/api/**", async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === "/api/me") return route.fulfill({ json: { authenticated: state.signedIn, user: state.signedIn ? { id: "review-account", name: "Review fixture" } : null } });
    if (path === "/api/auth/logout") { state.signedIn = false; return route.fulfill({ json: { ok: true } }); }
    if (path === "/api/settings") return route.fulfill({ json: { available: false } });
    if (path.startsWith("/api/wrongbook")) {
      if (!state.signedIn) return route.fulfill({ status: 401, json: { error: "UNAUTHORIZED" } });
      if (request.method() === "GET") return route.fulfill({ json: state.cloud, headers: { "X-Sync-Version": "fixture-v1" } });
      state.writes++;
      state.cloud = mergeVocabSnapshots("review-account", state.cloud, request.postDataJSON());
      return route.fulfill({ json: state.cloud, headers: { "X-Sync-Version": "fixture-v2" } });
    }
    return route.abort();
  });
  await context.route("**/*", async route => {
    if (new URL(route.request().url()).origin === origin) return route.fallback();
    return route.abort(); // Never contact a real cloud endpoint from browser fixtures.
  });
  return { context, state };
}
async function partition(page, key = owner) {
  return page.evaluate(async owner => {
    const db = await new Promise(resolve => { const request = indexedDB.open("henguren-v3", 3); request.onsuccess = () => resolve(request.result); });
    const value = await new Promise(resolve => { const request = db.transaction("learning-partitions").objectStore("learning-partitions").get(owner); request.onsuccess = () => resolve(request.result); });
    db.close(); return value;
  }, key);
}
const pageErrors = [];
const watch = page => page.on("pageerror", error => pageErrors.push(error.message));
try {
  // Completing and editing custom source fields must refresh this same tab immediately.
  const custom = await fixture({ developer: true });
  let releaseOldRead;
  let oldReadHeld = false;
  const reads = [];
  const writeTargets = [];
  await custom.context.route("**/*.r2.cloudflarestorage.com/**", async route => {
    const request = route.request();
    const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Expose-Headers": "ETag", "Access-Control-Allow-Headers": request.headers()["access-control-request-headers"] || "*", "Access-Control-Allow-Methods": "GET,PUT,HEAD,OPTIONS" };
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    const parts = new URL(request.url()).pathname.split("/");
    const profile = parts[parts.indexOf("wrongbooks") + 1];
    if (request.method() === "GET") {
      reads.push(profile);
      if (profile === "slow-profile" && !oldReadHeld) { oldReadHeld = true; await new Promise(resolve => { releaseOldRead = resolve; }); }
      return route.fulfill({ json: snapshot(profile), headers: { ...cors, ETag: '"fixture-' + profile + '"' } });
    }
    writeTargets.push(profile);
    return route.fulfill({ status: 200, headers: { ...cors, ETag: '"written"' } });
  });
  const developerPage = await custom.context.newPage(); watch(developerPage);
  await developerPage.goto(origin + "/zh-CN/developer");
  await developerPage.getByRole("textbox", { name: "账户 ID", exact: true }).fill("fixture-account");
  await developerPage.getByRole("textbox", { name: "存储桶名称", exact: true }).fill("fixture-bucket");
  await developerPage.getByRole("textbox", { name: "访问密钥 ID", exact: true }).fill("fixture-key");
  await developerPage.getByLabel("访问密钥", { exact: true }).fill("fixture-secret");
  await developerPage.getByRole("textbox", { name: "配置 ID", exact: true }).fill("first-profile");
  await waitFor(() => reads.includes("first-profile"));
  await developerPage.getByRole("button", { name: /同步设置 ·/ }).click();
  const panel = developerPage.getByRole("dialog", { name: "同步", exact: true });
  await panel.getByText("同步来源：自定义配置 first-profile", { exact: true }).waitFor();
  await panel.getByRole("button", { name: "关闭", exact: true }).click();
  await developerPage.getByRole("textbox", { name: "配置 ID", exact: true }).fill("slow-profile");
  await waitFor(() => Boolean(releaseOldRead));
  await developerPage.getByRole("textbox", { name: "配置 ID", exact: true }).fill("latest-profile");
  await developerPage.getByRole("button", { name: /同步设置 ·/ }).click();
  assert.equal(await panel.getByRole("button", { name: "立即同步", exact: true }).count(), 0, "Do not offer sync under stale source information");
  releaseOldRead();
  await panel.getByText("同步来源：自定义配置 latest-profile", { exact: true }).waitFor();
  await panel.getByRole("button", { name: "立即同步", exact: true }).click();
  await waitFor(() => writeTargets.includes("latest-profile"));
  assert.ok(writeTargets.every(target => target === "latest-profile"));
  assert.equal(custom.state.writes, 0);
  await custom.context.close();

  // Adoption must update the already-open wrongbook and the other tab's scheduler.
  const adopted = await fixture();
  const vocabPage = await adopted.context.newPage(); watch(vocabPage);
  await vocabPage.goto(origin + "/zh-CN/vocab");
  await vocabPage.getByRole("button", { name: "打开错题本", exact: true }).click();
  await vocabPage.getByText("alpha", { exact: true }).first().waitFor();
  const initialNavigations = [];
  vocabPage.on("framenavigated", frame => { if (frame === vocabPage.mainFrame()) initialNavigations.push(frame.url()); });
  const userPage = await adopted.context.newPage(); watch(userPage);
  await userPage.goto(origin + "/zh-CN/user");
  await userPage.getByRole("button", { name: /同步设置 ·/ }).click();
  await userPage.getByRole("dialog", { name: "同步", exact: true }).locator("md-switch").click();
  await waitFor(() => partition(userPage).then(value => value.sync.enabled && value.sync.confirmedVersion === value.sync.localVersion));
  await userPage.getByRole("button", { name: "关闭", exact: true }).click();
  const writesBeforeAdoption = adopted.state.writes;
  await userPage.getByRole("button", { name: "转入本机访客数据", exact: true }).click();
  await userPage.getByRole("button", { name: "确认转入", exact: true }).click();
  await vocabPage.getByText("guestword", { exact: true }).first().waitFor();
  assert.equal(initialNavigations.length, 0, "Other tab updates without reloading");
  assert.equal((await partition(userPage, "guest")).wrongbook.records.length, 0);
  assert.equal((await partition(userPage)).masteryRecords.length, 2);
  await waitFor(() => adopted.state.writes > writesBeforeAdoption);
  assert.equal(adopted.state.cloud.records.length, 2);
  await adopted.context.close();

  // A denied best-effort notification must not fail durable login/logout owner changes.
  const denied = await fixture({ initialOwner: "guest", denyOwnerNotification: true });
  const deniedPage = await denied.context.newPage(); watch(deniedPage);
  await deniedPage.goto(origin + "/zh-CN/user");
  await deniedPage.getByText("当前学习数据属于“Review fixture”。", { exact: true }).waitFor();
  assert.equal((await partition(deniedPage)).wrongbook.records.length, 1);
  await deniedPage.getByRole("button", { name: "退出登录", exact: true }).click();
  await deniedPage.getByText("当前使用本机访客数据。", { exact: true }).waitFor();
  assert.equal((await partition(deniedPage)).wrongbook.records.length, 1, "Unsynced account data is retained after logout");
  await denied.context.close();
  assert.deepEqual(pageErrors, []);
  console.log("PASS review notifications: custom saves and stale-source races, cross-tab adoption/UI/auto sync, denied owner storage during login/logout");
} finally { await browser.close(); }
