import assert from "node:assert/strict";
import test from "node:test";
import { isWelcomeDismissed, placeGuideBubble, guideExitPath, shouldShowSyncIntroduction } from "./guide.ts";
import { accountLearningOwner } from "./learning-ownership.ts";

test("sync introduction requires a confirmed matching account with auto sync enabled", () => {
  const ready = { enabled: true, introductionSeen: false, online: true, userId: "test-account", owner: accountLearningOwner("test-account"), source: "account", status: "ready" };
  assert.equal(shouldShowSyncIntroduction(ready), true);
  assert.equal(shouldShowSyncIntroduction({ ...ready, status: "synced" }), true);
  for (const changes of [
    { enabled: false }, { introductionSeen: true }, { online: false }, { userId: null },
    { owner: "guest" }, { owner: accountLearningOwner("another-account") }, { source: "custom" },
    { status: "offline" }, { status: "signed-out" }, { status: "error" }, { status: undefined }
  ]) assert.equal(shouldShowSyncIntroduction({ ...ready, ...changes }), false, JSON.stringify(changes));
});

test("new visitors see an optional welcome; existing completion remains respected", () => {
  assert.equal(isWelcomeDismissed(null, null), false);
  assert.equal(isWelcomeDismissed(null, '{"completed":true,"version":1}'), true);
  assert.equal(isWelcomeDismissed('{"version":1,"welcomeDismissed":true}', null), true);
  assert.equal(isWelcomeDismissed('{"version":2,"welcomeDismissed":true}', null), false);
  assert.equal(isWelcomeDismissed('broken', 'broken'), false);
  assert.equal(isWelcomeDismissed('null', 'null'), false);
  assert.equal(isWelcomeDismissed('{"version":1,"welcomeDismissed":false}', '{"completed":false}'), false);
});

test("ending a replay preserves its locale, other query parameters and fragment", () => {
  const current = new URL("https://toolbox.test/en-US?tour=1&source=settings#tools");
  assert.equal(guideExitPath(current), "/en-US?source=settings#tools");
  assert.equal(current.searchParams.get("tour"), "1");
});

test("history navigation away from a replay is never redirected back home", () => {
  for (const path of ["/zh-CN/settings", "/en-US/vocab?tour=1", "/zh-CN?source=home", "/zh-CN?tour=0"]) {
    assert.equal(guideExitPath(new URL(path, "https://toolbox.test")), null);
  }
});

test("bubble chooses available space and stays inside small or offset viewports", () => {
  const target = { top: 100, bottom: 140, left: 200, right: 280 };
  const bubble = { width: 300, height: 200 };
  assert.deepEqual(placeGuideBubble(target, bubble, { width: 1000, height: 800 }), { top: 156, left: 200 });
  assert.deepEqual(placeGuideBubble({ ...target, top: 650, bottom: 700 }, bubble, { width: 1000, height: 800 }), { top: 434, left: 200 });
  const positioned = placeGuideBubble(target, bubble, { width: 360, height: 400, left: 50, top: 60 });
  assert.ok(positioned.left >= 66 && positioned.left + bubble.width <= 394);
  assert.ok(positioned.top >= 76 && positioned.top + bubble.height <= 444);
});
