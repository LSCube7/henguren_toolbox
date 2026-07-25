import type { UserSession } from "./types";

export type OAuthUserInfo = {
  sub?: unknown;
  id?: unknown;
  name?: unknown;
  nickname?: unknown;
  email?: unknown;
  picture?: unknown;
  avatar_url?: unknown;
  avatarUrl?: unknown;
  avatar?: unknown;
};

function nonEmptyString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value !== "string") continue;
    const normalized = value.trim();
    if (normalized) return normalized;
  }
  return undefined;
}

function nonEmptyIdentifier(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value;
  }
  return undefined;
}

export function userSessionFromOAuthProfile(profile: unknown): UserSession | null {
  if (!profile || typeof profile !== "object") return null;

  const userInfo = profile as OAuthUserInfo;
  const id = nonEmptyIdentifier(userInfo.sub, userInfo.id);
  if (!id) return null;

  return {
    id,
    name: nonEmptyString(userInfo.name, userInfo.nickname) ?? "LSCube OAuth",
    email: nonEmptyString(userInfo.email),
    avatarUrl: nonEmptyString(userInfo.picture, userInfo.avatar_url, userInfo.avatarUrl, userInfo.avatar)
  };
}
