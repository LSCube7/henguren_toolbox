import { NextResponse } from "next/server";
import { setSessionCookie } from "@/lib/session";
import type { UserSession } from "@/lib/types";

type TokenResponse = {
  access_token?: string;
  id_token?: string;
};

type UserInfoResponse = {
  sub?: string;
  id?: string;
  name?: string;
  nickname?: string;
  email?: string;
  picture?: string;
  avatar_url?: string;
  avatarUrl?: string;
  avatar?: string;
};

type ClientAuthMethod = "none" | "post" | "basic";

function readCookie(request: Request, name: string) {
  return request.headers
    .get("cookie")
    ?.split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${name}=`))
    ?.split("=")
    .slice(1)
    .join("=");
}

function redirectWithClearedOAuthCookies(url: URL, reason?: string) {
  if (reason) {
    url.searchParams.set("auth", reason);
  }
  const response = NextResponse.redirect(url);
  response.cookies.delete("henguren_oauth_state");
  response.cookies.delete("henguren_oauth_code_verifier");
  return response;
}

function getClientAuthMethod(clientSecret?: string): ClientAuthMethod {
  const method = process.env.LSCUBE_OAUTH_CLIENT_AUTH_METHOD;
  if (method === "none" || method === "basic" || method === "post") return method;
  return clientSecret ? "post" : "none";
}

function createBasicAuthHeader(clientId: string, clientSecret: string) {
  const encodedClientId = encodeURIComponent(clientId);
  const encodedClientSecret = encodeURIComponent(clientSecret);
  return `Basic ${Buffer.from(`${encodedClientId}:${encodedClientSecret}`).toString("base64")}`;
}

async function readSafeErrorBody(response: Response) {
  const text = await response.text();
  return text.slice(0, 500);
}

function classifyTokenError(body: string) {
  const normalized = body.toLowerCase();
  if (normalized.includes("authorization code expired") || normalized.includes("code expired")) return "code_expired";
  if (normalized.includes("invalid_grant")) return "invalid_grant";
  return "token_http";
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieState = readCookie(request, "henguren_oauth_state");
  const codeVerifier = readCookie(request, "henguren_oauth_code_verifier");

  if (!code || !state) {
    return redirectWithClearedOAuthCookies(new URL("/user", request.url), "missing_code_state");
  }
  if (!cookieState || !codeVerifier) {
    return redirectWithClearedOAuthCookies(new URL("/user", request.url), "missing_oauth_cookie");
  }
  if (state !== cookieState) {
    return redirectWithClearedOAuthCookies(new URL("/user", request.url), "state_mismatch");
  }

  const tokenUrl = process.env.LSCUBE_OAUTH_TOKEN_URL;
  const userInfoUrl = process.env.LSCUBE_OAUTH_USERINFO_URL;
  const clientId = process.env.LSCUBE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.LSCUBE_OAUTH_CLIENT_SECRET;
  const redirectUri = process.env.LSCUBE_OAUTH_REDIRECT_URI || new URL("/api/auth/callback", request.url).toString();

  if (!tokenUrl || !userInfoUrl || !clientId) {
    return redirectWithClearedOAuthCookies(new URL("/user", request.url), "unconfigured");
  }

  const clientAuthMethod = getClientAuthMethod(clientSecret);
  const tokenBody = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    client_id: clientId,
    redirect_uri: redirectUri,
    code_verifier: codeVerifier
  });
  const tokenHeaders: HeadersInit = { "Content-Type": "application/x-www-form-urlencoded" };
  if (clientSecret && clientAuthMethod === "post") {
    tokenBody.set("client_secret", clientSecret);
  }
  if (clientSecret && clientAuthMethod === "basic") {
    tokenHeaders.Authorization = createBasicAuthHeader(clientId, clientSecret);
  }

  const tokenResponse = await fetch(tokenUrl, {
    method: "POST",
    headers: tokenHeaders,
    body: tokenBody
  });

  if (!tokenResponse.ok) {
    const body = await readSafeErrorBody(tokenResponse);
    console.error("OAuth token exchange failed", {
      status: tokenResponse.status,
      statusText: tokenResponse.statusText,
      body,
      clientAuthMethod
    });
    return redirectWithClearedOAuthCookies(new URL("/user", request.url), classifyTokenError(body));
  }

  const token = (await tokenResponse.json()) as TokenResponse;
  if (!token.access_token) {
    console.error("OAuth token response did not include access_token");
    return redirectWithClearedOAuthCookies(new URL("/user", request.url), "token_no_access_token");
  }

  const userResponse = await fetch(userInfoUrl, {
    headers: { Authorization: `Bearer ${token.access_token}` }
  });

  if (!userResponse.ok) {
    console.error("OAuth userinfo request failed", {
      status: userResponse.status,
      statusText: userResponse.statusText,
      body: await readSafeErrorBody(userResponse)
    });
    return redirectWithClearedOAuthCookies(new URL("/user", request.url), "userinfo_http");
  }

  const profile = (await userResponse.json()) as UserInfoResponse;
  const user: UserSession = {
    id: profile.sub || profile.id || "unknown",
    name: profile.name || profile.nickname || "LSCube User",
    email: profile.email,
    avatarUrl: profile.picture || profile.avatar_url || profile.avatarUrl || profile.avatar
  };

  await setSessionCookie(user);
  return redirectWithClearedOAuthCookies(new URL("/user", request.url), "ok");
}
