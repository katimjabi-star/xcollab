import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import { AiGateway } from "@xcollab/ai-gateway";
import { migrate } from "../src/db/migrate.ts";
import { WorkGraphRepository } from "../src/repository.ts";
import { createApp } from "../src/app.ts";

const ADMIN_URL =
  process.env.DATABASE_URL ?? "postgres://xcollab:xcollab_dev_only@localhost:5432/xcollab";
const APP_URL =
  process.env.APP_DATABASE_URL ?? "postgres://xcollab_app:app_dev_only@localhost:5432/xcollab";

const WORKSPACE = `ws-x4auth-${process.pid}`;
const gateway = new AiGateway([]);

let admin: Pool;
let appPool: Pool;
let app: ReturnType<typeof createApp>;

interface InitiateResponse {
  transactionId: string;
  completionSecret: string;
  verificationCode: string;
  expiresIn: number;
}

async function initiate(username = "demo"): Promise<InitiateResponse> {
  const res = await app.request("/api/auth/x4auth/initiate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username }),
  });
  expect(res.status).toBe(200);
  return (await res.json()) as InitiateResponse;
}

async function statusOf(transactionId: string): Promise<string> {
  const res = await app.request(`/api/auth/x4auth/status/${transactionId}`);
  expect(res.status).toBe(200);
  return ((await res.json()) as { status: string }).status;
}

async function waitForApproval(transactionId: string): Promise<void> {
  for (let attempt = 0; attempt < 40; attempt++) {
    if ((await statusOf(transactionId)) === "approved") return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error("mock approval never arrived");
}

beforeAll(async () => {
  admin = new Pool({ connectionString: ADMIN_URL });
  await migrate(admin);
  await admin.end();
  appPool = new Pool({ connectionString: APP_URL });
  const repo = new WorkGraphRepository(appPool);
  // Mock approval after 50ms keeps the full push flow fast under vitest.
  app = createApp(repo, gateway, undefined, undefined, {
    x4auth: { mode: "mock", mockApproveMs: 50 },
  });
});

afterAll(async () => {
  await appPool.end();
});

describe("Katim ID (X4Auth) push login — mock mode", () => {
  it("advertises mock mode via the pre-auth config probe", async () => {
    const res = await app.request("/api/auth/x4auth/config");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ configured: true, mode: "mock" });
  });

  it("reports unconfigured when the channel is not wired", async () => {
    const bare = createApp(new WorkGraphRepository(appPool), gateway);
    const res = await bare.request("/api/auth/x4auth/config");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ configured: false, mode: null });
  });

  it("initiate starts a pending transaction with a verification code", async () => {
    const started = await initiate();
    expect(started.transactionId).toMatch(/^[0-9a-f]{32}$/);
    expect(started.completionSecret.length).toBeGreaterThanOrEqual(40);
    expect(started.verificationCode).toMatch(/^\d{2}$/);
    expect(await statusOf(started.transactionId)).toBe("pending");
  });

  it("rejects an initiate without a username", async () => {
    const res = await app.request("/api/auth/x4auth/initiate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  it("404s status for an unknown transaction", async () => {
    const res = await app.request("/api/auth/x4auth/status/deadbeef");
    expect(res.status).toBe(404);
  });

  it("refuses completion before the device approves (409, no token)", async () => {
    const started = await initiate();
    const res = await app.request("/api/auth/x4auth/complete", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(started),
    });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "not_approved", status: "pending" });
  });

  it("refuses completion with a wrong secret even after approval (401)", async () => {
    const started = await initiate();
    await waitForApproval(started.transactionId);
    const res = await app.request("/api/auth/x4auth/complete", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        transactionId: started.transactionId,
        completionSecret: "A".repeat(43),
      }),
    });
    expect(res.status).toBe(401);
  });

  it("approves, completes, and the minted token authorizes the API", async () => {
    const started = await initiate("demo");
    await waitForApproval(started.transactionId);

    const completion = await app.request("/api/auth/x4auth/complete", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(started),
    });
    expect(completion.status).toBe(200);
    const session = (await completion.json()) as {
      accessToken: string;
      expiresIn: number;
      profile: { username: string; email: string };
    };
    expect(session.profile.username).toBe("demo");
    expect(session.profile.email).toBe("demo@katim.com");
    expect(session.expiresIn).toBe(8 * 60 * 60);

    const authorized = await app.request(`/api/programs?workspaceId=${WORKSPACE}`, {
      headers: { authorization: `Bearer ${session.accessToken}` },
    });
    expect(authorized.status).toBe(200);
    expect(await authorized.json()).toEqual({ programs: [] });

    // Single use: the transaction is burned by the successful completion.
    const replay = await app.request("/api/auth/x4auth/complete", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(started),
    });
    expect(replay.status).toBe(401);
  });

  it("keeps email-shaped identifiers intact and derives the username", async () => {
    const started = await initiate("jabbir.parlapati@katim.com");
    await waitForApproval(started.transactionId);
    const completion = await app.request("/api/auth/x4auth/complete", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(started),
    });
    expect(completion.status).toBe(200);
    const session = (await completion.json()) as { profile: { username: string; email: string } };
    expect(session.profile).toMatchObject({
      username: "jabbir.parlapati",
      email: "jabbir.parlapati@katim.com",
    });
  });
});
