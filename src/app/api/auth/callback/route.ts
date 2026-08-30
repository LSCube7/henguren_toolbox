import { NextResponse } from "next/server";
import { setSessionCookie } from "@/lib/session";
import { userSessionFromOAuthProfile } from "@/lib/oauth-profile";
import { defaultLocale, isAppLocale } from "@/i18n/config";
import { getLocaleFromPathname, localizePath } from "@/lib/localized-routing";

type TokenResponse = {
  access_token?: string;
  id_token?: string;
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
  response.cookies.delete("henguren_oauth_return_to");
  return response;
}

function safeReturnTo(value: string | undefined) {
  const fallback = localizePath(defaultLocale, "/user");
  if (!value) return fallback;
  try {
    const decoded = decodeURIComponent(value);
    if (!decoded.startsWith("/") || decoded.startsWith("//") || decoded.startsWith("/api/")) return fallback;
    const locale = getLocaleFromPathname(decoded) ?? defaultLocale;
    const logicalPath = decoded.replace(/^\/[^/?#]+(?=\/|$)/, (segment) => (isAppLocale(segment.slice(1)) ? "" : segment));
    return localizePath(locale, logicalPath);
  } catch {
    return fallback;
  }
}

function getClientAuthMethod(clientSecret?: string): ClientAuthMethod {
  const method = process.env.OAUTH_CLIENT_AUTH_METHOD;
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

async function cancelResponseBody(response: Response) {
  try {
    await response.body?.cancel();
  } catch (error) {
    console.warn("OAuth response body cancellation failed", { errorType: error instanceof Error ? error.name : "UnknownError" });
  }
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
  const returnTo = safeReturnTo(readCookie(request, "henguren_oauth_return_to"));
  const redirectTarget = () => new URL(returnTo, request.url);

  if (!code || !state) {
    return redirectWithClearedOAuthCookies(redirectTarget(), "missing_code_state");
  }
  if (!cookieState || !codeVerifier) {
    return redirectWithClearedOAuthCookies(redirectTarget(), "missing_oauth_cookie");
  }
  if (state !== cookieState) {
    return redirectWithClearedOAuthCookies(redirectTarget(), "state_mismatch");
  }

  const tokenUrl = process.env.OAUTH_TOKEN_URL;
  const userInfoUrl = process.env.OAUTH_USERINFO_URL;
  const clientId = process.env.OAUTH_CLIENT_ID;
  const clientSecret = process.env.OAUTH_CLIENT_SECRET;
  const redirectUri = process.env.OAUTH_REDIRECT_URI || new URL("/api/auth/callback", request.url).toString();

  if (!tokenUrl || !userInfoUrl || !clientId) {
    return redirectWithClearedOAuthCookies(redirectTarget(), "unconfigured");
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

  let tokenResponse: Response;
  try {
    tokenResponse = await fetch(tokenUrl, {
      method: "POST",
      headers: tokenHeaders,
      body: tokenBody
    });
  } catch (error) {
    console.error("OAuth token exchange request failed", { errorType: error instanceof Error ? error.name : "UnknownError", clientAuthMethod });
    return redirectWithClearedOAuthCookies(redirectTarget(), "token_http");
  }

  if (!tokenResponse.ok) {
    const body = await readSafeErrorBody(tokenResponse);
    console.error("OAuth token exchange failed", {
      status: tokenResponse.status,
      statusText: tokenResponse.statusText,
      clientAuthMethod
    });
    return redirectWithClearedOAuthCookies(redirectTarget(), classifyTokenError(body));
  }

  let token: TokenResponse;
  try {
    token = (await tokenResponse.json()) as TokenResponse;
  } catch {
    console.error("OAuth token response was not valid JSON", { status: tokenResponse.status, clientAuthMethod });
    return redirectWithClearedOAuthCookies(redirectTarget(), "token_http");
  }
  if (!token.access_token) {
    console.error("OAuth token response did not include access_token");
    return redirectWithClearedOAuthCookies(redirectTarget(), "token_no_access_token");
  }

  let userResponse: Response;
  try {
    userResponse = await fetch(userInfoUrl, {
      headers: { Authorization: `Bearer ${token.access_token}` }
    });
  } catch (error) {
    console.error("OAuth userinfo request failed", { errorType: error instanceof Error ? error.name : "UnknownError" });
    return redirectWithClearedOAuthCookies(redirectTarget(), "userinfo_http");
  }

  if (!userResponse.ok) {
    await cancelResponseBody(userResponse);
    console.error("OAuth userinfo request failed", {
      status: userResponse.status,
      statusText: userResponse.statusText
    });
    return redirectWithClearedOAuthCookies(redirectTarget(), "userinfo_http");
  }

  let profile: unknown;
  try {
    profile = await userResponse.json();
  } catch {
    console.error("OAuth userinfo response was not valid JSON", { status: userResponse.status });
    return redirectWithClearedOAuthCookies(redirectTarget(), "userinfo_http");
  }
  const user = userSessionFromOAuthProfile(profile);
  if (!user) {
    console.error("OAuth userinfo response did not include a stable subject identifier");
    return redirectWithClearedOAuthCookies(redirectTarget(), "userinfo_missing_subject");
  }

  await setSessionCookie(user);
  return redirectWithClearedOAuthCookies(redirectTarget(), "ok");
}
