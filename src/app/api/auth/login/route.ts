import { NextResponse } from "next/server";
import { createCodeChallenge, createCodeVerifier } from "@/lib/oauth-pkce";

export async function GET(request: Request) {
  const authorizeUrl = process.env.LSCUBE_OAUTH_AUTHORIZE_URL;
  const clientId = process.env.LSCUBE_OAUTH_CLIENT_ID;
  const redirectUri = process.env.LSCUBE_OAUTH_REDIRECT_URI || new URL("/api/auth/callback", request.url).toString();

  if (!authorizeUrl || !clientId) {
    return NextResponse.json({ error: "OAuth is not configured." }, { status: 500 });
  }

  const state = crypto.randomUUID();
  const codeVerifier = createCodeVerifier();
  const codeChallenge = await createCodeChallenge(codeVerifier);
  const url = new URL(authorizeUrl);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", process.env.LSCUBE_OAUTH_SCOPE || "openid profile email");
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");

  const response = NextResponse.redirect(url);
  response.cookies.set("henguren_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 10
  });
  response.cookies.set("henguren_oauth_code_verifier", codeVerifier, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 10
  });
  return response;
}
