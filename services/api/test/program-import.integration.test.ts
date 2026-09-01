import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import { AiGateway } from "@xcollab/ai-gateway";
import { verifyChain, type LedgerEntry } from "@xcollab/core";
import { migrate } from "../src/db/migrate.ts";
import { WorkGraphRepository } from "../src/repository.ts";
import { createApp } from "../src/app.ts";

const ADMIN_URL =
  process.env.DATABASE_URL ?? "postgres://xcollab:xcollab_dev_only@localhost:5432/xcollab";
const APP_URL =
  process.env.APP_DATABASE_URL ?? "postgres://xcollab_app:app_dev_only@localhost:5432/xcollab";

const WORKSPACE = `ws-import-${process.pid}`;

let admin: Pool;
let appPool: Pool;
let repo: WorkGraphRepository;
let app: ReturnType<typeof createApp>;
let token: string;

/** Minimal valid Program per @xcollab/core ProgramSchema. */
function validProgram() {
  return {
    id: "imp-prog-1",
    name: "Imported plan",
    mission: "Browser relay import test",
    language: "en",
    timeline: { start: "2026-09-01", end: "2026-12-01" },
    teams: [{ id: "tm1", name: "Core", kind: "internal" }],
    packages: [
      {
        id: "p1",
        name: "Discovery",
        scope: "Understand",
        tasks: [{ id: "t1", name: "Interview", status: "todo", estimateDays: 3 }],
        dependsOn: [],
      },
      {
        id: "p2",
        name: "Build",
        scope: "Deliver",
        tasks: [{ id: "t2", name: "Implement", status: "todo", estimateDays: 5 }],
        dependsOn: ["p1"],
      },
    ],
    milestones: [{ id: "m1", name: "Kickoff", dueDate: "2026-09-10" }],
    risks: [{ id: "r1", title: "Scope creep", severity: "medium" }],
  };
}

async function importRequest(body: unknown) {
  return app.request("/api/programs/import", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
}

beforeAll(async () => {
  admin = new Pool({ connectionString: ADMIN_URL });
  await migrate(admin);
  appPool = new Pool({ connectionString: APP_URL });
  repo = new WorkGraphRepository(appPool);
  // Katim mock door mints the auth token — no Keycloak needed for this suite.
  app = createApp(repo, new AiGateway([]), undefined, undefined, {
    x4auth: { mode: "mock", mockApproveMs: 30 },
  });
  const init = (await (
    await app.request("/api/auth/x4auth/initiate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: "importer" }),
    })
  ).json()) as { transactionId: string; completionSecret: string };
  await new Promise((resolve) => setTimeout(resolve, 80));
  await app.request(`/api/auth/x4auth/status/${init.transactionId}`);
  const done = (await (
    await app.request("/api/auth/x4auth/complete", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(init),
    })
  ).json()) as { accessToken: string };
  token = done.accessToken;
});

afterAll(async () => {
  await admin.query("DELETE FROM ledger_entries WHERE workspace_id = $1", [WORKSPACE]);
  await admin.query("DELETE FROM programs WHERE workspace_id = $1", [WORKSPACE]);
  await appPool.end();
  await admin.end();
});

describe("POST /api/programs/import (browser-relay)", () => {
  it("rejects an unauthenticated import", async () => {
    const res = await app.request("/api/programs/import", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(401);
  });

  it("rejects a schema-invalid program with 422 and writes nothing", async () => {
    const res = await importRequest({
      workspaceId: WORKSPACE,
      mission: "bad",
      language: "en",
      modelId: "claude-sonnet-5",
      program: { id: "x", name: "no packages" },
    });
    expect(res.status).toBe(422);
    expect(((await res.json()) as { error: string }).error).toBe("invalid_program");
    expect(await repo.listPrograms(WORKSPACE)).toEqual([]);
  });

  it("rejects a dependency cycle with 422", async () => {
    const program = validProgram();
    for (const pkg of program.packages) {
      if (pkg.id === "p1") pkg.dependsOn = ["p2"];
    }
    const res = await importRequest({
      workspaceId: WORKSPACE,
      mission: "cycle",
      language: "en",
      modelId: "claude-sonnet-5",
      program,
    });
    expect(res.status).toBe(422);
    expect(((await res.json()) as { error: string }).error).toBe("dependency_cycle");
  });

  it("imports a valid program, ledgered as ai/browser-relay with requester provenance", async () => {
    const res = await importRequest({
      workspaceId: WORKSPACE,
      mission: "Browser relay import test",
      language: "en",
      modelId: "claude-sonnet-5",
      program: validProgram(),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as {
      program: { id: string; name: string };
      generatedBy: string;
    };
    expect(body.generatedBy).toBe("claude-sonnet-5");
    expect(body.program.name).toBe("Imported plan");

    const ledger = await repo.getLedger(WORKSPACE);
    const entry = ledger.at(-1) as LedgerEntry & { input: string };
    expect(entry.action).toBe("program.generate");
    expect(entry.actor).toEqual({ kind: "ai", id: "browser-relay" });
    const input = JSON.parse(entry.input) as { assistant?: { channel?: string; requestedBy?: string } };
    expect(input.assistant?.channel).toBe("browser-relay");
    expect(input.assistant?.requestedBy).toBe("importer");
    expect(verifyChain(ledger as LedgerEntry[])).toEqual({ valid: true });
  });

  it("rejects an unknown parent with 422", async () => {
    const res = await importRequest({
      workspaceId: WORKSPACE,
      mission: "child",
      language: "en",
      modelId: "claude-sonnet-5",
      program: { ...validProgram(), id: "imp-prog-2" },
      parentId: "nope",
    });
    expect(res.status).toBe(422);
    expect(((await res.json()) as { error: string }).error).toBe("unknown_parent");
  });
});
