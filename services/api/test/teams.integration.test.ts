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

const WORKSPACE = `ws-teams-${process.pid}`;
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

async function ledgerLength(): Promise<number> {
  return (await repo.getLedger(WORKSPACE)).length;
}

async function createTeam(name: string, description?: string): Promise<WorkspaceTeam> {
  const res = await api("POST", "/api/teams", {
    workspaceId: WORKSPACE,
    name,
    ...(description === undefined ? {} : { description }),
  });
  expect(res.status).toBe(201);
  return ((await res.json()) as { team: WorkspaceTeam }).team;
}

describe("auth on team endpoints", () => {
  it("rejects GET /api/teams and GET /api/users without a token", async () => {
    const teams = await app.request(`/api/teams?workspaceId=${WORKSPACE}`);
    expect(teams.status).toBe(401);
    const users = await app.request(`/api/users?workspaceId=${WORKSPACE}`);
    expect(users.status).toBe(401);
  });
});

describe("GET /api/users", () => {
  it("lists the realm users with exactly the four public fields", async () => {
    const res = await api("GET", `/api/users?workspaceId=${WORKSPACE}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      users: { username: string; firstName?: string; lastName?: string; email?: string }[];
    };
    const usernames = body.users.map((u) => u.username);
    for (const expected of ["jabbir", "sara", "omar"]) {
      expect(usernames).toContain(expected);
    }
    for (const user of body.users) {
      const keys = Object.keys(user);
      expect(keys.every((k) => ["username", "firstName", "lastName", "email"].includes(k))).toBe(
        true,
      );
    }
  });
});

describe("team CRUD", () => {
  it("creates a team with the caller as sole lead and ledgers team.create", async () => {
    const team = await createTeam("Platform Squad", "Owns the API");
    expect(team.id).toMatch(/^team-/);
    expect(team.name).toBe("Platform Squad");
    expect(team.description).toBe("Owns the API");
    expect(team.members).toEqual([{ username: "jabbir", role: "lead" }]);

    const last = (await repo.getLedger(WORKSPACE)).at(-1);
    expect(last?.action).toBe("team.create");
    expect(last?.actor).toEqual({ kind: "human", id: "jabbir" });
    expect(JSON.parse(last?.input ?? "{}")).toEqual({ team });
    expect(last?.output).toBe(JSON.stringify({ applied: true }));
  });

  it("lists teams for the workspace", async () => {
    const team = await createTeam("Listed Team");
    const res = await api("GET", `/api/teams?workspaceId=${WORKSPACE}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { teams: WorkspaceTeam[] };
    expect(body.teams.map((t) => t.id)).toContain(team.id);
  });

  it("updates name/description and ledgers team.update with a changes map", async () => {
    const team = await createTeam("Old Name", "Old description");
    const res = await api("PATCH", `/api/teams/${team.id}`, {
      workspaceId: WORKSPACE,
      name: "New Name",
      description: "New description",
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { team: WorkspaceTeam };
    expect(body.team.name).toBe("New Name");
    expect(body.team.description).toBe("New description");

    const last = (await repo.getLedger(WORKSPACE)).at(-1);
    expect(last?.action).toBe("team.update");
    expect(last?.actor).toEqual({ kind: "human", id: "jabbir" });
    expect(JSON.parse(last?.input ?? "{}")).toEqual({
      teamId: team.id,
      changes: {
        name: { from: "Old Name", to: "New Name" },
        description: { from: "Old description", to: "New description" },
      },
    });
  });

  it("deletes a team and ledgers team.delete with the full snapshot", async () => {
    const team = await createTeam("Doomed Team");
    const res = await api("DELETE", `/api/teams/${team.id}?workspaceId=${WORKSPACE}`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ deleted: true });

    const last = (await repo.getLedger(WORKSPACE)).at(-1);
    expect(last?.action).toBe("team.delete");
    expect(JSON.parse(last?.input ?? "{}")).toEqual({ team });

    const list = await api("GET", `/api/teams?workspaceId=${WORKSPACE}`);
    const body = (await list.json()) as { teams: WorkspaceTeam[] };
    expect(body.teams.map((t) => t.id)).not.toContain(team.id);
  });

  it("returns 404 not_found for unknown team ids on every team mutation", async () => {
    const patch = await api("PATCH", "/api/teams/team-nope", {
      workspaceId: WORKSPACE,
      name: "X",
    });
    expect(patch.status).toBe(404);
    expect(await patch.json()).toEqual({ error: "not_found" });

    const addMember = await api("POST", "/api/teams/team-nope/members", {
      workspaceId: WORKSPACE,
      username: "sara",
      role: "member",
    });
    expect(addMember.status).toBe(404);

    const removeMember = await api(
      "DELETE",
      `/api/teams/team-nope/members/sara?workspaceId=${WORKSPACE}`,
    );
    expect(removeMember.status).toBe(404);

    const del = await api("DELETE", `/api/teams/team-nope?workspaceId=${WORKSPACE}`);
    expect(del.status).toBe(404);
    expect(await del.json()).toEqual({ error: "not_found" });
  });
});

describe("team membership", () => {
  it("adds a member, rejects duplicates with 409, and ledgers team.member_add", async () => {
    const team = await createTeam("Membership Team");
    const res = await api("POST", `/api/teams/${team.id}/members`, {
      workspaceId: WORKSPACE,
      username: "sara",
      role: "member",
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { team: WorkspaceTeam };
    expect(body.team.members).toContainEqual({ username: "sara", role: "member" });

    const last = (await repo.getLedger(WORKSPACE)).at(-1);
    expect(last?.action).toBe("team.member_add");
    expect(last?.actor).toEqual({ kind: "human", id: "jabbir" });
    expect(JSON.parse(last?.input ?? "{}")).toEqual({
      teamId: team.id,
      member: { username: "sara", role: "member" },
    });

    const before = await ledgerLength();
    const dup = await api("POST", `/api/teams/${team.id}/members`, {
      workspaceId: WORKSPACE,
      username: "sara",
      role: "lead",
    });
    expect(dup.status).toBe(409);
    expect(await dup.json()).toEqual({ error: "already_member" });
    expect(await ledgerLength()).toBe(before);
  });

  it("rejects a username that does not exist in the Keycloak realm", async () => {
    const team = await createTeam("Ghost Member Team");
    const before = await ledgerLength();
    const res = await api("POST", `/api/teams/${team.id}/members`, {
      workspaceId: WORKSPACE,
      username: "not-a-real-user-xyz",
      role: "member",
    });
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ error: "unknown_user" });
    expect(await ledgerLength()).toBe(before);
  });

  it("removes a member and ledgers team.member_remove", async () => {
    const team = await createTeam("Removal Team");
    await api("POST", `/api/teams/${team.id}/members`, {
      workspaceId: WORKSPACE,
      username: "omar",
      role: "member",
    });
    const res = await api(
      "DELETE",
      `/api/teams/${team.id}/members/omar?workspaceId=${WORKSPACE}`,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { team: WorkspaceTeam };
    expect(body.team.members.map((m) => m.username)).not.toContain("omar");

    const last = (await repo.getLedger(WORKSPACE)).at(-1);
    expect(last?.action).toBe("team.member_remove");
    expect(JSON.parse(last?.input ?? "{}")).toEqual({
      teamId: team.id,
      member: { username: "omar", role: "member" },
    });
  });

  it("refuses to remove the last lead with 409 last_lead and appends no ledger row", async () => {
    const team = await createTeam("Last Lead Team");
    const before = await ledgerLength();
    const res = await api(
      "DELETE",
      `/api/teams/${team.id}/members/jabbir?workspaceId=${WORKSPACE}`,
    );
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "last_lead" });
    expect(await ledgerLength()).toBe(before);

    const list = await api("GET", `/api/teams?workspaceId=${WORKSPACE}`);
    const body = (await list.json()) as { teams: WorkspaceTeam[] };
    const intact = body.teams.find((t) => t.id === team.id);
    expect(intact?.members).toEqual([{ username: "jabbir", role: "lead" }]);
  });
});

describe("POST /api/programs with parentId", () => {
  it("round-trips parentId through create, get, and list", async () => {
    const parentRes = await api("POST", "/api/programs", {
      workspaceId: WORKSPACE,
      mission: "Parent program",
      language: "en",
    });
    expect(parentRes.status).toBe(201);
    const parent = ((await parentRes.json()) as { program: Program }).program;

    const childRes = await api("POST", "/api/programs", {
      workspaceId: WORKSPACE,
      mission: "Child program",
      language: "en",
      parentId: parent.id,
    });
    expect(childRes.status).toBe(201);
    const child = ((await childRes.json()) as { program: Program }).program;
    expect(child.parentId).toBe(parent.id);

    const single = await api("GET", `/api/programs/${child.id}?workspaceId=${WORKSPACE}`);
    expect(((await single.json()) as { program: Program }).program.parentId).toBe(parent.id);

    const list = await api("GET", `/api/programs?workspaceId=${WORKSPACE}`);
    const listed = ((await list.json()) as { programs: Program[] }).programs;
    expect(listed.find((p) => p.id === child.id)?.parentId).toBe(parent.id);
  });

  it("rejects an unknown parent with 422 unknown_parent", async () => {
    const res = await api("POST", "/api/programs", {
      workspaceId: WORKSPACE,
      mission: "Orphan program",
      language: "en",
      parentId: "prog-does-not-exist",
    });
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ error: "unknown_parent" });
  });
});

describe("ledger integrity after team operations", () => {
  it("keeps the hash chain valid and shows team.* actions via GET /api/ledger", async () => {
    const res = await api("GET", `/api/ledger?workspaceId=${WORKSPACE}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      entries: LedgerEntry[];
      verification: { valid: boolean };
    };
    expect(body.verification).toEqual({ valid: true });
    const actions = new Set(body.entries.map((e) => e.action));
    for (const action of [
      "team.create",
      "team.update",
      "team.member_add",
      "team.member_remove",
      "team.delete",
    ]) {
      expect(actions).toContain(action);
    }
    expect(verifyChain((await repo.getLedger(WORKSPACE)) as LedgerEntry[])).toEqual({
      valid: true,
    });
  });
});
