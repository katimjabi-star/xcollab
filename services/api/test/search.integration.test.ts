import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import type { Program } from "@xcollab/core";
import { AiGateway } from "@xcollab/ai-gateway";
import { migrate } from "../src/db/migrate.ts";
import { WorkGraphRepository } from "../src/repository.ts";
import { createApp } from "../src/app.ts";
import type { WorkspaceTask } from "../src/repository-search.ts";
import { getAccessToken } from "./keycloak.ts";

const ADMIN_URL =
  process.env.DATABASE_URL ?? "postgres://xcollab:xcollab_dev_only@localhost:5432/xcollab";
const APP_URL =
  process.env.APP_DATABASE_URL ?? "postgres://xcollab_app:app_dev_only@localhost:5432/xcollab";

const WORKSPACE = `ws-search-${process.pid}`;
const gateway = new AiGateway([]);
const tester = { kind: "human", id: "tester" } as const;

let admin: Pool;
let appPool: Pool;
let repo: WorkGraphRepository;
let app: ReturnType<typeof createApp>;
let token: string;
let program: Program;

async function search(query: string, auth?: string): Promise<Response> {
  return app.request(`/api/tasks${query}`, { headers: auth ? { authorization: auth } : {} });
}

async function searchTasks(query: string): Promise<WorkspaceTask[]> {
  const res = await search(`?workspaceId=${WORKSPACE}${query}`, `Bearer ${token}`);
  expect(res.status).toBe(200);
  return ((await res.json()) as { tasks: WorkspaceTask[] }).tasks;
}

beforeAll(async () => {
  admin = new Pool({ connectionString: ADMIN_URL });
  await migrate(admin);
  appPool = new Pool({ connectionString: APP_URL });
  repo = new WorkGraphRepository(appPool);
  app = createApp(repo, gateway);
  token = await getAccessToken();

  const generation = await gateway.generateProgram({ mission: "Search route", language: "en" });
  program = (await repo.createProgram(WORKSPACE, generation, tester)).program;
  const tasks = program.packages.flatMap((pkg) => pkg.tasks);
  const [a, b, c] = tasks;
  if (!a || !b || !c) throw new Error("template program must have at least 3 tasks");
  // a: jabbir's overdue searchable task; b: sara's done future task; c: blocked.
  await repo.updateTask(
    WORKSPACE,
    program.id,
    a.id,
    { assignee: "jabbir", startDate: "2020-01-01", dueDate: "2020-01-02", name: "Field kit audit" },
    tester,
  );
  await repo.updateTask(
    WORKSPACE,
    program.id,
    b.id,
    { assignee: "sara", status: "done", startDate: "2031-01-01", dueDate: "2031-01-02" },
    tester,
  );
  await repo.updateTask(WORKSPACE, program.id, c.id, { status: "blocked" }, tester);
});

afterAll(async () => {
  await admin.query("DELETE FROM ledger_entries WHERE workspace_id = $1", [WORKSPACE]);
  await admin.query("DELETE FROM programs WHERE workspace_id = $1", [WORKSPACE]);
  await appPool.end();
  await admin.end();
});

describe("GET /api/tasks", () => {
  it("rejects requests without a bearer token", async () => {
    expect((await search(`?workspaceId=${WORKSPACE}`)).status).toBe(401);
  });

  it("rejects a missing workspaceId and out-of-range filters", async () => {
    expect((await search("", `Bearer ${token}`)).status).toBe(400);
    expect((await search(`?workspaceId=${WORKSPACE}&limit=51`, `Bearer ${token}`)).status).toBe(400);
    expect(
      (await search(`?workspaceId=${WORKSPACE}&dueBefore=tomorrow`, `Bearer ${token}`)).status,
    ).toBe(400);
  });

  it("resolves assignee=me to the token user, without a ledger write", async () => {
    const before = (await repo.getLedger(WORKSPACE)).length;
    const mine = await searchTasks("&assignee=me");
    expect(mine.length).toBeGreaterThan(0);
    for (const task of mine) expect(task.assignee).toBe("jabbir");
    expect((await repo.getLedger(WORKSPACE)).length).toBe(before);
  });

  it("filters by status and program, annotated with program/package identity", async () => {
    const blocked = await searchTasks(`&status=blocked&programId=${program.id}`);
    expect(blocked.length).toBeGreaterThan(0);
    for (const task of blocked) {
      expect(task.status).toBe("blocked");
      expect(task.programId).toBe(program.id);
      expect(task.programName).toBe(program.name);
      expect(task.packageId).toBeTruthy();
      expect(task.packageName).toBeTruthy();
    }
    expect(await searchTasks("&programId=prog-nope")).toEqual([]);
  });

  it("computes overdue as dueDate before today and not done", async () => {
    const overdue = await searchTasks("&overdue=true");
    expect(overdue.some((task) => task.name === "Field kit audit")).toBe(true);
    for (const task of overdue) {
      expect(task.status).not.toBe("done");
      expect(task.dueDate && task.dueDate < new Date().toISOString().slice(0, 10)).toBe(true);
    }
  });

  it("filters by due-date window", async () => {
    const early = await searchTasks("&dueBefore=2021-01-01");
    expect(early.map((task) => task.name)).toContain("Field kit audit");
    const late = await searchTasks("&dueAfter=2030-12-31");
    expect(late.length).toBeGreaterThan(0);
    for (const task of late) expect(task.dueDate && task.dueDate > "2030-12-31").toBe(true);
  });

  it("matches text case-insensitively and honors limit", async () => {
    const byText = await searchTasks("&text=FIELD%20KIT");
    expect(byText).toHaveLength(1);
    expect(byText[0]?.name).toBe("Field kit audit");
    const capped = await searchTasks("&limit=1");
    expect(capped).toHaveLength(1);
  });
});
