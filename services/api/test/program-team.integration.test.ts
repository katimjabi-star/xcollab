import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import { verifyChain, type LedgerEntry, type Program, type WorkspaceTeam } from "@xcollab/core";
import { AiGateway } from "@xcollab/ai-gateway";
import { migrate } from "../src/db/migrate.ts";
import { WorkGraphRepository } from "../src/repository.ts";
import { createApp } from "../src/app.ts";
import { getAccessToken } from "./keycloak.ts";

const ADMIN_URL =
  process.env.DATABASE_URL ?? "postgres://xcollab:xcollab_dev_only@localhost:5432/xcollab";
const APP_URL =
  process.env.APP_DATABASE_URL ?? "postgres://xcollab_app:app_dev_only@localhost:5432/xcollab";

const WORKSPACE = `ws-progteam-${process.pid}`;
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
  await admin.query("DELETE FROM teams WHERE workspace_id = $1", [WORKSPACE]);
  await appPool.end();
  await admin.end();
});

async function api(method: string, path: string, body?: unknown): Promise<Response> {
  const headers: Record<string, string> = { authorization: `Bearer ${token}` };
  if (body === undefined) return app.request(path, { method, headers });
  headers["content-type"] = "application/json";
  return app.request(path, { method, headers, body: JSON.stringify(body) });
}

async function createTeam(name: string): Promise<WorkspaceTeam> {
  const res = await api("POST", "/api/teams", { workspaceId: WORKSPACE, name });
  expect(res.status).toBe(201);
  return ((await res.json()) as { team: WorkspaceTeam }).team;
}

async function createProgram(mission: string, teamId?: string): Promise<Program> {
  const res = await api("POST", "/api/programs", {
    workspaceId: WORKSPACE,
    mission,
    language: "en",
    ...(teamId === undefined ? {} : { teamId }),
  });
  expect(res.status).toBe(201);
  return ((await res.json()) as { program: Program }).program;
}

async function ledgerLength(): Promise<number> {
  return (await repo.getLedger(WORKSPACE)).length;
}

describe("POST /api/programs with teamId", () => {
  it("creates a program linked to an existing team and returns teamId on get/list", async () => {
    const team = await createTeam("Delivery Squad");
    const program = await createProgram("Team-linked program", team.id);
    expect(program.teamId).toBe(team.id);

    const single = await api("GET", `/api/programs/${program.id}?workspaceId=${WORKSPACE}`);
    expect(((await single.json()) as { program: Program }).program.teamId).toBe(team.id);

    const list = await api("GET", `/api/programs?workspaceId=${WORKSPACE}`);
    const listed = ((await list.json()) as { programs: Program[] }).programs;
    expect(listed.find((p) => p.id === program.id)?.teamId).toBe(team.id);
  });

  it("rejects an unknown teamId with 422 unknown_team and creates nothing", async () => {
    const before = await ledgerLength();
    const res = await api("POST", "/api/programs", {
      workspaceId: WORKSPACE,
      mission: "Orphan-team program",
      language: "en",
      teamId: "team-does-not-exist",
    });
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ error: "unknown_team" });
    expect(await ledgerLength()).toBe(before);
  });
});

describe("PATCH /api/programs/:id team link", () => {
  it("links a team and ledgers program.update with a teamId changes map", async () => {
    const team = await createTeam("Link Target");
    const program = await createProgram("Unlinked program");
    expect(program.teamId).toBeUndefined();

    const res = await api("PATCH", `/api/programs/${program.id}`, {
      workspaceId: WORKSPACE,
      teamId: team.id,
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { program: Program };
    expect(body.program.teamId).toBe(team.id);

    const last = (await repo.getLedger(WORKSPACE)).at(-1);
    expect(last?.action).toBe("program.update");
    expect(last?.actor).toEqual({ kind: "human", id: "jabbir" });
    expect(JSON.parse(last?.input ?? "{}")).toEqual({
      programId: program.id,
      changes: { teamId: { from: null, to: team.id } },
    });
  });

  it("unlinks with teamId null and ledgers the reverse change", async () => {
    const team = await createTeam("Unlink Target");
    const program = await createProgram("Linked program", team.id);

    const res = await api("PATCH", `/api/programs/${program.id}`, {
      workspaceId: WORKSPACE,
      teamId: null,
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { program: Program };
    expect(body.program.teamId).toBeUndefined();

    const last = (await repo.getLedger(WORKSPACE)).at(-1);
    expect(last?.action).toBe("program.update");
    expect(JSON.parse(last?.input ?? "{}")).toEqual({
      programId: program.id,
      changes: { teamId: { from: team.id, to: null } },
    });
  });

  it("returns 404 for an unknown program and 422 for an unknown team without ledgering", async () => {
    const team = await createTeam("For 404 Case");
    const missing = await api("PATCH", "/api/programs/prog-nope", {
      workspaceId: WORKSPACE,
      teamId: team.id,
    });
    expect(missing.status).toBe(404);

    const program = await createProgram("Bad team target");
    const before = await ledgerLength();
    const badTeam = await api("PATCH", `/api/programs/${program.id}`, {
      workspaceId: WORKSPACE,
      teamId: "team-nope",
    });
    expect(badTeam.status).toBe(422);
    expect(await badTeam.json()).toEqual({ error: "unknown_team" });
    expect(await ledgerLength()).toBe(before);
  });

  it("rejects a body without teamId", async () => {
    const program = await createProgram("No-op patch");
    const res = await api("PATCH", `/api/programs/${program.id}`, { workspaceId: WORKSPACE });
    expect(res.status).toBe(400);
  });
});

describe("ledger integrity after program-team operations", () => {
  it("keeps the hash chain valid", async () => {
    const res = await api("GET", `/api/ledger?workspaceId=${WORKSPACE}`);
    const body = (await res.json()) as {
      entries: LedgerEntry[];
      verification: { valid: boolean };
    };
    expect(body.verification).toEqual({ valid: true });
    expect(body.entries.map((e) => e.action)).toContain("program.update");
    expect(verifyChain((await repo.getLedger(WORKSPACE)) as LedgerEntry[])).toEqual({
      valid: true,
    });
  });
});
