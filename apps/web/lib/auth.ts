/**
 * Pure OIDC / PKCE helpers — no React, no side effects beyond WebCrypto.
 * Hand-rolled Authorization Code + PKCE (S256); no auth SDK by design.
 */

const AUTH_PATH = "/protocol/openid-connect/auth";
const TOKEN_PATH = "/protocol/openid-connect/token";
const END_SESSION_PATH = "/protocol/openid-connect/logout";

/** RFC 4648 §5 base64url, unpadded. */
export function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Cryptographically random PKCE verifier / state value (base64url of N bytes). */
export function randomVerifier(byteLength = 32): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}

/** RFC 7636 S256 code challenge: base64url(SHA-256(verifier)). */
export async function s256Challenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return base64UrlEncode(new Uint8Array(digest));
}

export function buildAuthUrl(
  issuer: string,
  clientId: string,
  redirectUri: string,
  state: string,
  challenge: string,
): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid profile email",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  });
  return `${issuer}${AUTH_PATH}?${params.toString()}`;
}

export function tokenEndpoint(issuer: string): string {
  return `${issuer}${TOKEN_PATH}`;
}

/** Direct grant (ROPC) body for the in-app credential form. `openid` scope is
    required — the profile comes from the id_token, same as the code flow. */
export function buildPasswordGrantBody(
  clientId: string,
  username: string,
  password: string,
): URLSearchParams {
  return new URLSearchParams({
    grant_type: "password",
    client_id: clientId,
    scope: "openid profile email",
    username,
    password,
  });
}

export function buildEndSessionUrl(
  issuer: string,
  clientId: string,
  postLogoutRedirectUri: string,
  idTokenHint?: string,
): string {
  const params = new URLSearchParams({
    client_id: clientId,
    post_logout_redirect_uri: postLogoutRedirectUri,
  });
  if (idTokenHint) params.set("id_token_hint", idTokenHint);
  return `${issuer}${END_SESSION_PATH}?${params.toString()}`;
}

/** Raw token-endpoint response (authorization_code and refresh_token grants). */
export interface TokenEndpointResponse {
  access_token: string;
  refresh_token?: string;
  id_token?: string;
  expires_in: number;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string | null;
  idToken: string | null;
  expiresAt: number;
}

/** expiresAt = now + expires_in * 1000 (ms epoch). */
export function parseTokenResponse(raw: TokenEndpointResponse, now: number = Date.now()): AuthTokens {
  return {
    accessToken: raw.access_token,
    refreshToken: raw.refresh_token ?? null,
    idToken: raw.id_token ?? null,
    expiresAt: now + raw.expires_in * 1000,
  };
}

/** True when the access token is within `skewMs` of expiry (or past it). */
export function shouldRefresh(expiresAt: number, skewMs = 60_000, now: number = Date.now()): boolean {
  return now >= expiresAt - skewMs;
}

export interface AuthProfile {
  username: string;
  fullName: string;
  email: string;
}

/**
 * Decode a JWT payload (base64url JSON). No signature verification — the API
 * verifies signatures against the realm JWKS; the client only reads claims
 * it received directly from the token endpoint over the code exchange.
 */
export function decodeJwtPayload(jwt: string): Record<string, unknown> {
  const part = jwt.split(".")[1];
  if (!part) throw new Error("malformed JWT");
  const b64 = part.replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
  const bytes = Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes)) as Record<string, unknown>;
}

export function profileFromIdToken(idToken: string): AuthProfile {
  const claims = decodeJwtPayload(idToken);
  const username = typeof claims.preferred_username === "string" ? claims.preferred_username : "";
  const name = typeof claims.name === "string" ? claims.name : "";
  const email = typeof claims.email === "string" ? claims.email : "";
  return { username, fullName: name || username, email };
}
