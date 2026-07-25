import assert from "node:assert/strict";
import test from "node:test";
import { userSessionFromOAuthProfile } from "./oauth-profile.ts";

test("rejects OAuth profiles without a stable identifier", () => {
  assert.equal(userSessionFromOAuthProfile({ name: "No Subject" }), null);
  assert.equal(userSessionFromOAuthProfile({ sub: "   ", id: 123 }), null);
});

test("rejects malformed userinfo payloads", () => {
  assert.equal(userSessionFromOAuthProfile(null), null);
  assert.equal(userSessionFromOAuthProfile("not-an-object"), null);
});

test("normalizes profile fields while preserving the opaque subject", () => {
  assert.deepEqual(
    userSessionFromOAuthProfile({ sub: " user-1 ", name: " Test User ", email: " test@example.com ", picture: " https://example.com/avatar.png " }),
    { id: " user-1 ", name: "Test User", email: "test@example.com", avatarUrl: "https://example.com/avatar.png" }
  );
});

test("uses the provider id and nickname fallbacks", () => {
  assert.deepEqual(userSessionFromOAuthProfile({ id: "legacy-id", nickname: "Legacy User" }), {
    id: "legacy-id",
    name: "Legacy User",
    email: undefined,
    avatarUrl: undefined
  });
  assert.equal(userSessionFromOAuthProfile({ sub: "subject-only" })?.name, "LSCube OAuth");
});
