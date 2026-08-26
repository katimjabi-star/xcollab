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

const WORKSPACE = `ws-authz-${process.pid}`;
const UNCLAIMED = `ws-authz-unclaimed-${process.pid}`;
const gateway = new AiGateway([]);

let admin: Pool;
let appPool: Pool;
let repo: WorkGraphRepository;
let app: ReturnType<typeof createApp>;
let jabbir: string;
let sara: string;

interface Member {
  username: string;
  role: string;
}

beforeAll(async () => {
  admin = new Pool({ connectionString: ADMIN_URL });
  await migrate(admin);
  appPool = new Pool({ connectionString: APP_URL });
  repo = new WorkGraphRepository(appPool);
  app = createApp(repo, gateway);
  [jabbir, sara] = await Promise.all([getAccessToken("jabbir"), getAccessToken("sara")]);
});

afterAll(async () => {
  for (const ws of [WORKSPACE, UNCLAIMED]) {
    await admin.query("DELETE FROM workspace_members WHERE workspace_id = $1", [ws]);
    await admin.query("DELETE FROM ledger_entries WHERE workspace_id = $1", [ws]);
    await admin.query("DELETE FROM programs WHERE workspace_id = $1", [ws]);
    await admin.query("DELETE FROM teams WHERE workspace_id = $1", [ws]);
  }
  await appPool.end();
  await admin.end();
});

async function api(token: string, method: string, path: string, body?: unknown): Promise<Response> {
  const headers: Record<string, string> = { authorization: `Bearer ${token}` };
  if (body === undefined) return app.request(path, { method, headers });
  headers["content-type"] = "application/json";
  return app.request(path, { method, headers, body: JSON.stringify(body) });
}

async function listMembers(token: string): Promise<Response> {
  return api(token, "GET", `/api/workspaces/${WORKSPACE}/members`);
}

let program: Program;

describe("claim-on-create", () => {
  it("records the first mutator as the workspace owner", async () => {
    const res = await api(jabbir, "POST", "/api/programs", {
      workspaceId: WORKSPACE,
      mission: "Authorization test program",
      language: "en",
    });
    expect(res.status).toBe(201);
    program = ((await res.json()) as { program: Program }).program;

    const members = await listMembers(jabbir);
    expect(members.status).toBe(200);
    const body = (await members.json()) as { members: Member[] };
    expect(body.members).toEqual([{ username: "jabbir", role: "owner" }]);
  });

  it("leaves reads on an unclaimed workspace behaving as today", async () => {
    const programs = await api(sara, "GET", `/api/programs?workspaceId=${UNCLAIMED}`);
    expect(programs.status).toBe(200);
    expect(await programs.json()).toEqual({ programs: [] });

    const members = await api(sara, "GET", `/api/workspaces/${UNCLAIMED}/members`);
    expect(members.status).toBe(200);
    expect(await members.json()).toEqual({ members: [] });
  });
});

describe("non-member access to a claimed workspace", () => {
  it("returns 403 forbidden for reads", async () => {
    for (const path of [
      `/api/programs?workspaceId=${WORKSPACE}`,
      `/api/programs/${program.id}?workspaceId=${WORKSPACE}`,
      `/api/teams?workspaceId=${WORKSPACE}`,
      `/api/ledger?workspaceId=${WORKSPACE}`,
      `/api/users/me/tasks?workspaceId=${WORKSPACE}`,
      `/api/workspaces/${WORKSPACE}/members`,
    ]) {
      const res = await api(sara, "GET", path);
      expect(res.status, path).toBe(403);
      expect(await res.json()).toEqual({ error: "forbidden" });
    }
  });

  it("returns 403 forbidden for mutations", async () => {
    const create = await api(sara, "POST", "/api/programs", {
      workspaceId: WORKSPACE,
      mission: "Intrusion attempt",
      language: "en",
    });
    expect(create.status).toBe(403);
    expect(await create.json()).toEqual({ error: "forbidden" });

    const task = program.packages[0]?.tasks[0];
    if (!task) throw new Error("program has no tasks");
    const patch = await api(sara, "PATCH", `/api/programs/${program.id}/tasks/${task.id}`, {
      workspaceId: WORKSPACE,
      status: "done",
    });
    expect(patch.status).toBe(403);

    const del = await api(sara, "DELETE", `/api/programs/${program.id}?workspaceId=${WORKSPACE}`);
    expect(del.status).toBe(403);
  });

  it("keeps /api/users (realm directory) authenticated-only, not workspace-scoped", async () => {
    const res = await api(sara, "GET", `/api/users?workspaceId=${WORKSPACE}`);
    expect(res.status).toBe(200);
  });
});

describe("membership management", () => {
  it("owner adds sara as member; sara can then read and mutate", async () => {
    const add = await api(jabbir, "POST", `/api/workspaces/${WORKSPACE}/members`, {
      username: "sara",
      role: "member",
    });
    expect(add.status).toBe(200);
    const body = (await add.json()) as { members: Member[] };
    expect(body.members).toContainEqual({ username: "sara", role: "member" });

    const read = await api(sara, "GET", `/api/programs?workspaceId=${WORKSPACE}`);
    expect(read.status).toBe(200);

    const mutate = await api(sara, "POST", "/api/teams", {
      workspaceId: WORKSPACE,
      name: "Sara Squad",
    });
    expect(mutate.status).toBe(201);
  });

  it("rejects adding a duplicate member with 409 and an unknown realm user with 422", async () => {
    const dup = await api(jabbir, "POST", `/api/workspaces/${WORKSPACE}/members`, {
      username: "sara",
      role: "member",
    });
    expect(dup.status).toBe(409);
    expect(await dup.json()).toEqual({ error: "already_member" });

    const ghost = await api(jabbir, "POST", `/api/workspaces/${WORKSPACE}/members`, {
      username: "not-a-real-user-xyz",
      role: "member",
    });
    expect(ghost.status).toBe(422);
    expect(await ghost.json()).toEqual({ error: "unknown_user" });
  });

  it("forbids a non-owner member from adding or removing members", async () => {
    const add = await api(sara, "POST", `/api/workspaces/${WORKSPACE}/members`, {
      username: "omar",
      role: "member",
    });
    expect(add.status).toBe(403);
    expect(await add.json()).toEqual({ error: "forbidden" });

    const remove = await api(sara, "DELETE", `/api/workspaces/${WORKSPACE}/members/jabbir`);
    expect(remove.status).toBe(403);
  });

  it("removes a member (owner only) and 404s an unknown member", async () => {
    const addOmar = await api(jabbir, "POST", `/api/workspaces/${WORKSPACE}/members`, {
      username: "omar",
      role: "member",
    });
    expect(addOmar.status).toBe(200);

    const remove = await api(jabbir, "DELETE", `/api/workspaces/${WORKSPACE}/members/omar`);
    expect(remove.status).toBe(200);
    const body = (await remove.json()) as { members: Member[] };
    expect(body.members.map((m) => m.username)).not.toContain("omar");

    const missing = await api(jabbir, "DELETE", `/api/workspaces/${WORKSPACE}/members/omar`);
    expect(missing.status).toBe(404);
  });

  it("refuses to remove the last owner with 409 last_owner", async () => {
    const res = await api(jabbir, "DELETE", `/api/workspaces/${WORKSPACE}/members/jabbir`);
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "last_owner" });

    const members = await listMembers(jabbir);
    const body = (await members.json()) as { members: Member[] };
    expect(body.members).toContainEqual({ username: "jabbir", role: "owner" });
  });
});

describe("membership changes in the ledger", () => {
  it("ledgers workspace.member_add / workspace.member_remove and keeps the chain valid", async () => {
    const res = await api(jabbir, "GET", `/api/ledger?workspaceId=${WORKSPACE}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { entries: LedgerEntry[]; verification: { valid: boolean } };
    expect(body.verification).toEqual({ valid: true });

    const adds = body.entries.filter((e) => e.action === "workspace.member_add");
    expect(adds.map((e) => JSON.parse(e.input).member.username)).toEqual(["sara", "omar"]);
    for (const entry of adds) expect(entry.actor).toEqual({ kind: "human", id: "jabbir" });

    const removes = body.entries.filter((e) => e.action === "workspace.member_remove");
    expect(removes.map((e) => JSON.parse(e.input).member.username)).toEqual(["omar"]);

    expect(verifyChain((await repo.getLedger(WORKSPACE)) as LedgerEntry[])).toEqual({
      valid: true,
    });
  });
});
