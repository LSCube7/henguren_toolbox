import assert from "node:assert/strict";
import test from "node:test";
import { createSignedSessionToken, readSignedSessionToken, sessionMaxAgeSeconds } from "./session-token.ts";

const secret = "test-session-secret-with-sufficient-entropy";
const user = { id: "user-1", name: "Test User", email: "test@example.com" };
const now = Date.UTC(2026, 6, 25, 0, 0, 0);

test("accepts a valid session token", async () => {
  const token = await createSignedSessionToken(user, secret, now);
  assert.deepEqual(await readSignedSessionToken(token, secret, now), user);
});

test("rejects a tampered session token", async () => {
  const token = await createSignedSessionToken(user, secret, now);
  const [payload, signature] = token.split(".");
  assert.equal(await readSignedSessionToken(`${payload}x.${signature}`, secret, now), null);
});

test("rejects an expired session token", async () => {
  const token = await createSignedSessionToken(user, secret, now - sessionMaxAgeSeconds * 1000 - 1);
  assert.equal(await readSignedSessionToken(token, secret, now), null);
});

test("rejects a session token issued too far in the future", async () => {
  const token = await createSignedSessionToken(user, secret, now + 5 * 60 * 1000 + 1);
  assert.equal(await readSignedSessionToken(token, secret, now), null);
});

test("rejects malformed session tokens", async () => {
  assert.equal(await readSignedSessionToken("not-a-session-token", secret, now), null);
});
