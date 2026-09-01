import { randomBytes, timingSafeEqual } from "node:crypto";
import type { Hono } from "hono";
import { z } from "zod";
import { signLocalToken, type LocalProfile } from "./auth-local.ts";
import type { AuthEnv } from "./auth.ts";

/**
 * Katim ID (X4Auth) push login — the Mahara model replicated:
 *   initiate → user approves on their Katim device → status flips to
 *   approved → complete (with the completion secret handed out at initiate)
 *   mints a local session token. Tokens are NEVER returned by the status
 *   endpoint; only the holder of the completion secret can finish the login.
 *
 * Live mode mirrors Mahara's upstream wire protocol exactly:
 *   POST {baseUrl}/oauth/token {grant_type:"x4auth_push", client_id,
 *   client_secret, email, scope} → 202 {transaction_id, expires_in,
 *   poll_interval, verification_code, poll_nonce}; polls repeat the POST
 *   with {transaction_id, poll_nonce} (202 = still pending).
 * Mock mode fakes the device approval after mockApproveMs so the full UX
 * works before the x4auth team registers our client.
 */
export interface X4AuthOptions {
  mode: "mock" | "live";
  baseUrl?: string;
  clientId?: string;
  clientSecret?: string;
  scope?: string;
  /** Bare usernames become <user>@<emailDomain> for the upstream push. */
  emailDomain?: string;
  /** Mock only: how long the fake device takes to approve (default 6s). */
  mockApproveMs?: number;
  fetchImpl?: typeof fetch;
}

type TxStatus = "pending" | "approved" | "denied" | "expired";

interface Transaction {
  status: TxStatus;
  completionSecret: string;
  profile: LocalProfile;
  expiresAt: number;
  upstream?: {
    transactionId: string;
    pollNonce: string;
    pollIntervalMs: number;
    lastPollAt: number;
  };
}

const InitiateSchema = z.object({ username: z.string().trim().min(1).max(320) });
const CompleteSchema = z.object({
  transactionId: z.string().min(1).max(200),
  completionSecret: z.string().min(1).max(200),
});

const MOCK_TX_TTL_MS = 120_000;
const MAX_TRANSACTIONS = 500;

function secretsMatch(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

function profileFor(identifier: string, emailDomain: string): LocalProfile {
  const atIndex = identifier.indexOf("@");
  const username = atIndex > 0 ? identifier.slice(0, atIndex) : identifier;
  const email = atIndex > 0 ? identifier : `${identifier}@${emailDomain}`;
  return { username, fullName: username, email };
}

/** Two-digit match code, same affordance the Katim device shows (mock only —
    live mode relays the upstream verification_code instead). */
function mockVerificationCode(): string {
  return String(10 + (randomBytes(1)[0] ?? 0) % 90);
}

interface UpstreamInitiate {
  transaction_id: string;
  expires_in: number;
  poll_interval: number;
  verification_code: string;
  poll_nonce: string;
}

async function liveInitiate(
  options: X4AuthOptions,
  email: string,
): Promise<UpstreamInitiate | null> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const response = await fetchImpl(`${options.baseUrl}/oauth/token`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      grant_type: "x4auth_push",
      client_id: options.clientId,
      client_secret: options.clientSecret,
      email,
      scope: options.scope ?? "openid profile email",
    }),
  }).catch(() => null);
  if (response?.status !== 202) return null;
  return (await response.json().catch(() => null)) as UpstreamInitiate | null;
}

/** One upstream poll; returns the (possibly unchanged) status. Tasdiq
    rejects polls without the poll_nonce from initiate, so it always rides. */
async function livePoll(options: X4AuthOptions, tx: Transaction): Promise<TxStatus> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const response = await fetchImpl(`${options.baseUrl}/oauth/token`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      grant_type: "x4auth_push",
      client_id: options.clientId,
      client_secret: options.clientSecret,
      transaction_id: tx.upstream?.transactionId,
      poll_nonce: tx.upstream?.pollNonce,
    }),
  }).catch(() => null);
  if (!response || response.status === 202) return "pending";
  if (response.ok) return "approved";
  const body = (await response.json().catch(() => null)) as { error?: string } | null;
  if (body?.error === "expired_token") return "expired";
  if (body?.error === "access_denied" || response.status < 500) return "denied";
  return "pending"; // transient upstream failure — keep waiting
}

/** Registers the pre-auth login routes. Call BEFORE the bearer middleware.
    With no options the config probe still answers (configured:false) so the
    web login can cheaply decide which door to show. */
export function wireX4Auth(app: Hono<AuthEnv>, options?: X4AuthOptions): void {
  app.get("/api/auth/x4auth/config", (c) =>
    c.json(options ? { configured: true, mode: options.mode } : { configured: false, mode: null }),
  );
  if (!options) return;

  const transactions = new Map<string, Transaction>();
  const emailDomain = options.emailDomain ?? "katim.com";

  function sweep(now: number): void {
    for (const [id, tx] of transactions) {
      if (tx.expiresAt <= now) transactions.delete(id);
    }
  }

  app.post("/api/auth/x4auth/initiate", async (c) => {
    const parsed = InitiateSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: "invalid request" }, 400);
    const now = Date.now();
    sweep(now);
    if (transactions.size >= MAX_TRANSACTIONS) return c.json({ error: "busy" }, 503);

    const profile = profileFor(parsed.data.username, emailDomain);
    // Our own ids on the wire, never the upstream transaction_id.
    const transactionId = randomBytes(16).toString("hex");
    const completionSecret = randomBytes(32).toString("base64url");
    let expiresInMs = MOCK_TX_TTL_MS;
    let verificationCode = mockVerificationCode();
    let upstream: Transaction["upstream"];

    if (options.mode === "live") {
      const started = await liveInitiate(options, profile.email);
      if (!started) return c.json({ error: "x4auth_unavailable" }, 502);
      expiresInMs = started.expires_in * 1000;
      verificationCode = started.verification_code;
      upstream = {
        transactionId: started.transaction_id,
        pollNonce: started.poll_nonce,
        pollIntervalMs: started.poll_interval * 1000,
        lastPollAt: 0,
      };
    }

    const tx: Transaction = {
      status: "pending",
      completionSecret,
      profile,
      expiresAt: now + expiresInMs,
      ...(upstream ? { upstream } : {}),
    };
    transactions.set(transactionId, tx);
    if (options.mode === "mock") {
      setTimeout(() => {
        if (tx.status === "pending") tx.status = "approved";
      }, options.mockApproveMs ?? 6000).unref();
    }
    return c.json({
      transactionId,
      completionSecret,
      verificationCode,
      expiresIn: Math.round(expiresInMs / 1000),
    });
  });

  app.get("/api/auth/x4auth/status/:id", async (c) => {
    const tx = transactions.get(c.req.param("id"));
    if (!tx) return c.json({ error: "not found" }, 404);
    const now = Date.now();
    if (tx.status === "pending" && tx.expiresAt <= now) tx.status = "expired";
    if (
      tx.status === "pending" &&
      tx.upstream &&
      now - tx.upstream.lastPollAt >= tx.upstream.pollIntervalMs
    ) {
      tx.upstream.lastPollAt = now;
      tx.status = await livePoll(options, tx);
    }
    // Status only — the session token requires the completion secret.
    return c.json({ status: tx.status });
  });

  app.post("/api/auth/x4auth/complete", async (c) => {
    const parsed = CompleteSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: "invalid request" }, 400);
    const tx = transactions.get(parsed.data.transactionId);
    if (!tx || !secretsMatch(tx.completionSecret, parsed.data.completionSecret)) {
      return c.json({ error: "unauthorized" }, 401);
    }
    if (tx.status !== "approved" || tx.expiresAt <= Date.now()) {
      return c.json({ error: "not_approved", status: tx.status }, 409);
    }
    transactions.delete(parsed.data.transactionId); // single use
    const { accessToken, expiresIn } = await signLocalToken(tx.profile);
    return c.json({ accessToken, expiresIn, profile: tx.profile });
  });
}
