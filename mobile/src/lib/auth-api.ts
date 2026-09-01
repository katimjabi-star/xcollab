import { buildPasswordGrantBody, decodeJwtClaims, tokenEndpoint } from "./oidc";

/**
 * The two login doors, mirroring apps/web/components/login-gate.tsx:
 *  - Katim ID (X4Auth device push): initiate → poll status → complete.
 *    Tokens never ride the status endpoint; the single-use completionSecret
 *    is traded for the session only after approval.
 *  - Password fallback: Keycloak ROPC direct grant.
 */

export interface PushSession {
  transactionId: string;
  completionSecret: string;
  verificationCode: string;
  expiresIn: number;
}

export type PushStatus = "pending" | "approved" | "denied" | "expired";

export interface SessionGrant {
  accessToken: string;
  expiresIn: number;
  username: string;
  name?: string;
}

async function postJson(url: string, body: unknown): Promise<Response> {
  return fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

/** Which doors exist is the API's call — password-only until it says so. */
export async function x4Config(base: string): Promise<{ configured: boolean; mode?: string }> {
  try {
    const res = await fetch(`${base}/api/auth/x4auth/config`);
    if (!res.ok) return { configured: false };
    return (await res.json()) as { configured: boolean; mode?: string };
  } catch {
    return { configured: false };
  }
}

export async function x4Initiate(base: string, username: string): Promise<PushSession> {
  const res = await postJson(`${base}/api/auth/x4auth/initiate`, { username });
  if (!res.ok) throw new Error(`initiate → ${res.status}`);
  return (await res.json()) as PushSession;
}

export async function x4Status(base: string, transactionId: string): Promise<PushStatus> {
  const res = await fetch(`${base}/api/auth/x4auth/status/${transactionId}`);
  if (!res.ok) throw new Error(`status → ${res.status}`);
  const { status } = (await res.json()) as { status: PushStatus };
  return status;
}

export async function x4Complete(base: string, push: PushSession): Promise<SessionGrant> {
  const res = await postJson(`${base}/api/auth/x4auth/complete`, {
    transactionId: push.transactionId,
    completionSecret: push.completionSecret,
  });
  if (!res.ok) throw new Error(`complete → ${res.status}`);
  const done = (await res.json()) as {
    accessToken: string;
    expiresIn: number;
    profile: { username: string; name?: string };
  };
  return {
    accessToken: done.accessToken,
    expiresIn: done.expiresIn,
    username: done.profile.username,
    name: done.profile.name,
  };
}

/** Token-endpoint failure carrying the HTTP status (401 = wrong credentials). */
export class TokenGrantError extends Error {
  readonly status: number;

  constructor(status: number) {
    super(`token endpoint → ${status}`);
    this.name = "TokenGrantError";
    this.status = status;
  }
}

export async function passwordGrant(
  issuer: string,
  clientId: string,
  username: string,
  password: string,
): Promise<SessionGrant> {
  const res = await fetch(tokenEndpoint(issuer), {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: buildPasswordGrantBody(clientId, username, password),
  });
  if (!res.ok) throw new TokenGrantError(res.status);
  const data = (await res.json()) as { access_token: string; expires_in: number };
  const claims = decodeJwtClaims(data.access_token);
  return {
    accessToken: data.access_token,
    expiresIn: data.expires_in,
    username: claims?.preferred_username ?? username,
    name: claims?.name,
  };
}
