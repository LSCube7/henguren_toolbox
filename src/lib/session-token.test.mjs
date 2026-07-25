import assert from "node:assert/strict";
import test from "node:test";
import { createSignedSessionToken, readSignedSessionToken, sessionMaxAgeSeconds } from "./session-token.ts";

const secret = "test-session-secret-with-sufficient-entropy";
const user = { id: "user-1", name: "Test User", email: "test@example.com" };
const now = Date.UTC(2026, 6, 25, 0, 0, 0);

function base64UrlEncode(value) {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : new Uint8Array(value);
  return Buffer.from(bytes).toString("base64url");
}

async function createLegacySessionToken(legacyUser) {
  const encoder = new TextEncoder();
  const payload = base64UrlEncode(JSON.stringify({ user: legacyUser, createdAt: now }));
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return `${payload}.${base64UrlEncode(signature)}`;
}

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

test("rejects legacy sessions that use the shared unknown identifier", async () => {
  const token = await createLegacySessionToken({ id: "unknown", name: "Legacy OAuth User" });
  assert.equal(await readSignedSessionToken(token, secret, now), null);
});

test("allows a versioned session whose provider subject is literally unknown", async () => {
  const providerUser = { id: "unknown", name: "Provider User" };
  const token = await createSignedSessionToken(providerUser, secret, now);
  assert.deepEqual(await readSignedSessionToken(token, secret, now), providerUser);
});
