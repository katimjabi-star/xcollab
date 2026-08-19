import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import { verifyChain, type LedgerEntry, type Program } from "@xcollab/core";
import { AiGateway } from "@xcollab/ai-gateway";
import { migrate } from "../src/db/migrate.ts";
import { WorkGraphRepository } from "../src/repository.ts";
import { createApp } from "../src/app.ts";
import { getAccessToken } from "./keycloak.ts";

const ADMIN_URL =
  process.env.DATABASE_URL ?? "postgres://xcollab:xcollab_dev_only@localhost:5432/xcollab";
const APP_URL =
  process.env.APP_DATABASE_URL ?? "postgres://xcollab_app:app_dev_only@localhost:5432/xcollab";

const WORKSPACE = `ws-auth-${process.pid}`;
const gateway = new AiGateway([]);

let admin: Pool;
let appPool: Pool;
let repo: WorkGraphRepository;
let app: ReturnType<typeof createApp>;
let token: string;

beforeAll(async () => {
  admin = new Pool({ connectionString: ADMIN_URL });
  await migrate(admin);
  appPool = new Pool({ connectionString: APP_URL });
  repo = new WorkGraphRepository(appPool);
  app = createApp(repo, gateway);
  token = await getAccessToken();
});

afterAll(async () => {
  await admin.query("DELETE FROM ledger_entries WHERE workspace_id = $1", [WORKSPACE]);
  await admin.query("DELETE FROM programs WHERE workspace_id = $1", [WORKSPACE]);
  await appPool.end();
  await admin.end();
});

describe("API auth (Keycloak RS256 bearer tokens)", () => {
  it("rejects POST /api/programs without a token with 401 unauthorized", async () => {
    const res = await app.request("/api/programs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ workspaceId: WORKSPACE, mission: "No token", language: "en" }),
    });
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "unauthorized" });
  });

  it("rejects GET /api/programs without a token with 401 unauthorized", async () => {
    const res = await app.request(`/api/programs?workspaceId=${WORKSPACE}`);
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "unauthorized" });
  });

  it("rejects a garbage token with 401", async () => {
    const res = await app.request(`/api/programs?workspaceId=${WORKSPACE}`, {
      headers: { authorization: "Bearer not-a-jwt" },
    });
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "unauthorized" });
  });

  it("accepts a real Keycloak token on GET /api/programs with 200", async () => {
    const res = await app.request(`/api/programs?workspaceId=${WORKSPACE}`, {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ programs: [] });
  });

  it("records the authenticated username as the human ledger actor on task mutation", async () => {
    const generation = await gateway.generateProgram({ mission: "Auth actor test", language: "en" });
    const { program } = await repo.createProgram(WORKSPACE, generation, {
      kind: "human",
      id: "tester",
    });
    const task = program.packages[0]?.tasks[0];
    if (!task) throw new Error("program has no tasks");

    const res = await app.request(`/api/programs/${program.id}/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ workspaceId: WORKSPACE, status: "in_progress" }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { program: Program };
    expect(body.program.id).toBe(program.id);

    const ledger = await repo.getLedger(WORKSPACE);
    const last = ledger.at(-1);
    expect(last?.action).toBe("task.status_update");
    expect(last?.actor).toEqual({ kind: "human", id: "jabbir" });
    expect(verifyChain(ledger as LedgerEntry[])).toEqual({ valid: true });
  });

  it("keeps GET /api/health open without a token", async () => {
    const res = await app.request("/api/health");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });
});
