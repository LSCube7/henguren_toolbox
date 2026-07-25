import { cookies } from "next/headers";
import type { UserSession } from "./types";
import { createSignedSessionToken, readSignedSessionToken, sessionMaxAgeSeconds } from "./session-token";

const COOKIE_NAME = "henguren_session";

function getSessionSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET is required for authenticated routes.");
  }
  return secret;
}

export async function createSessionToken(user: UserSession) {
  return createSignedSessionToken(user, getSessionSecret());
}

export async function readSessionToken(token?: string): Promise<UserSession | null> {
  if (!token) return null;
  return readSignedSessionToken(token, getSessionSecret());
}

export async function getCurrentUser() {
  const cookieStore = await cookies();
  return readSessionToken(cookieStore.get(COOKIE_NAME)?.value);
}

export async function setSessionCookie(user: UserSession) {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, await createSessionToken(user), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: sessionMaxAgeSeconds
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}
