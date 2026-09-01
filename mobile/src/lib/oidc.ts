/**
 * Pure OIDC helpers — no React, no Expo imports, unit-tested under vitest.
 * Mirrors apps/web/lib/auth.ts where the flows overlap (ROPC direct grant).
 */

const TOKEN_PATH = "/protocol/openid-connect/token";

export function tokenEndpoint(issuer: string): string {
  return `${issuer}${TOKEN_PATH}`;
}

/** Direct grant (ROPC) body for the in-app credential form. `openid` scope is
    required — profile claims ride the tokens, same as the web gate. */
export function buildPasswordGrantBody(
  clientId: string,
  username: string,
  password: string,
): string {
  return new URLSearchParams({
    grant_type: "password",
    client_id: clientId,
    scope: "openid profile email",
    username,
    password,
  }).toString();
}

/** RFC 4648 §5 base64url decode — Hermes-safe (no atob dependency). */
export function base64UrlDecode(input: string): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const char of normalized) {
    const index = alphabet.indexOf(char);
    if (index === -1) continue; // padding or whitespace
    value = (value << 6) | index;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((value >> bits) & 0xff);
    }
  }
  // UTF-8 decode (JWT claims are UTF-8 JSON).
  let out = "";
  for (let i = 0; i < bytes.length; ) {
    const byte = bytes[i];
    if (byte < 0x80) {
      out += String.fromCharCode(byte);
      i += 1;
    } else if (byte < 0xe0) {
      out += String.fromCharCode(((byte & 0x1f) << 6) | (bytes[i + 1] & 0x3f));
      i += 2;
    } else if (byte < 0xf0) {
      out += String.fromCharCode(
        ((byte & 0x0f) << 12) | ((bytes[i + 1] & 0x3f) << 6) | (bytes[i + 2] & 0x3f),
      );
      i += 3;
    } else {
      const code =
        ((byte & 0x07) << 18) |
        ((bytes[i + 1] & 0x3f) << 12) |
        ((bytes[i + 2] & 0x3f) << 6) |
        (bytes[i + 3] & 0x3f);
      out += String.fromCodePoint(code);
      i += 4;
    }
  }
  return out;
}

export interface JwtClaims {
  preferred_username?: string;
  name?: string;
  exp?: number;
}

/** Decodes a JWT payload WITHOUT verifying the signature — display-only use.
    The API verifies every token server-side; the app never trusts these
    claims for authorization. */
export function decodeJwtClaims(token: string): JwtClaims | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    return JSON.parse(base64UrlDecode(parts[1])) as JwtClaims;
  } catch {
    return null;
  }
}
