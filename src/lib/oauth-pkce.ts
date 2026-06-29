const verifierBytes = 32;

function base64UrlEncode(bytes: Uint8Array) {
  const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join("");
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

export function createCodeVerifier() {
  const bytes = new Uint8Array(verifierBytes);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}

export async function createCodeChallenge(verifier: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return base64UrlEncode(new Uint8Array(digest));
}
