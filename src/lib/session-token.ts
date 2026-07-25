import type { UserSession } from "./types";

export const sessionMaxAgeSeconds = 60 * 60 * 24 * 30;

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const sessionFutureToleranceMs = 5 * 60 * 1000;

type SessionPayload = {
  user?: UserSession;
  createdAt?: number;
};

function base64UrlEncode(value: ArrayBuffer | string) {
  const bytes = typeof value === "string" ? encoder.encode(value) : new Uint8Array(value);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function base64UrlDecodeBytes(value: string) {
  const padded = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function importSigningKey(secret: string) {
  return crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

export async function createSignedSessionToken(user: UserSession, secret: string, now = Date.now()) {
  const payload = base64UrlEncode(JSON.stringify({ user, createdAt: now } satisfies SessionPayload));
  const key = await importSigningKey(secret);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return `${payload}.${base64UrlEncode(signature)}`;
}

export async function readSignedSessionToken(token: string | undefined, secret: string, now = Date.now()): Promise<UserSession | null> {
  if (!token) return null;
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra) return null;

  try {
    const key = await importSigningKey(secret);
    const valid = await crypto.subtle.verify("HMAC", key, base64UrlDecodeBytes(signature), encoder.encode(payload));
    if (!valid) return null;

    const parsed = JSON.parse(decoder.decode(base64UrlDecodeBytes(payload))) as SessionPayload;
    if (!parsed.user || typeof parsed.createdAt !== "number" || !Number.isFinite(parsed.createdAt)) return null;
    if (parsed.createdAt > now + sessionFutureToleranceMs) return null;
    if (now - parsed.createdAt > sessionMaxAgeSeconds * 1000) return null;
    return parsed.user;
  } catch {
    return null;
  }
}
