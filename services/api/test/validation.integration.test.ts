import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import type { Program, Task } from "@xcollab/core";
import { AiGateway } from "@xcollab/ai-gateway";
import { migrate } from "../src/db/migrate.ts";
import { WorkGraphRepository } from "../src/repository.ts";
import { createApp } from "../src/app.ts";
import { getAccessToken } from "./keycloak.ts";

const ADMIN_URL =
  process.env.DATABASE_URL ?? "postgres://xcollab:xcollab_dev_only@localhost:5432/xcollab";
const APP_URL =
  process.env.APP_DATABASE_URL ?? "postgres://xcollab_app:app_dev_only@localhost:5432/xcollab";

const WORKSPACE = `ws-validation-${process.pid}`;
const gateway = new AiGateway([]);

let admin: Pool;
let appPool: Pool;
let repo: WorkGraphRepository;
let app: ReturnType<typeof createApp>;
let token: string;
let program: Program;
let task: Task;

beforeAll(async () => {
  admin = new Pool({ connectionString: ADMIN_URL });
  await migrate(admin);
  appPool = new Pool({ connectionString: APP_URL });
  repo = new WorkGraphRepository(appPool);
  app = createApp(repo, gateway);
  token = await getAccessToken();

  const generation = await gateway.generateProgram({ mission: "Validation", language: "en" });
  program = (await repo.createProgram(WORKSPACE, generation, { kind: "human", id: "tester" }))
    .program;
  const first = program.packages[0]?.tasks[0];
  if (!first?.startDate) throw new Error("seed program has no dated task");
  task = first;
});

afterAll(async () => {
  await admin.query("DELETE FROM ledger_entries WHERE workspace_id = $1", [WORKSPACE]);
  await admin.query("DELETE FROM programs WHERE workspace_id = $1", [WORKSPACE]);
  await appPool.end();
  await admin.end();
});

function request(method: string, path: string, body?: unknown, raw?: string): Promise<Response> {
  return Promise.resolve(
    app.request(path, {
      method,
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: raw ?? (body === undefined ? undefined : JSON.stringify(body)),
    }),
  );
}

const patchTask = (body: object): Promise<Response> =>
  request("PATCH", `/api/programs/${program.id}/tasks/${task.id}`, {
    workspaceId: WORKSPACE,
    ...body,
  });

const createTask = (body: object): Promise<Response> =>
  request("POST", `/api/programs/${program.id}/tasks`, {
    workspaceId: WORKSPACE,
    packageId: program.packages[0]?.id,
    name: "probe task",
    ...body,
  });

const ledgerLength = async (): Promise<number> => (await repo.getLedger(WORKSPACE)).length;

describe("program brief date validation", () => {
  it("rejects a timeline that ends before it starts with a 400, storing nothing", async () => {
    const before = await ledgerLength();
    const res = await request("POST", "/api/programs", {
      workspaceId: WORKSPACE,
      mission: "Inverted timeline",
      language: "en",
      timeline: { start: "2026-12-01", end: "2026-09-01" },
    });
    expect(res.status).toBe(400);
    expect(await ledgerLength()).toBe(before);
    expect(await repo.listPrograms(WORKSPACE)).toHaveLength(1);
  });

  it("rejects garbage timeline dates with a 400", async () => {
    for (const bad of ["2026-13-45", "garbage", ""]) {
      const res = await request("POST", "/api/programs", {
        workspaceId: WORKSPACE,
        mission: "Garbage date",
        language: "en",
        timeline: { start: bad, end: "2026-12-01" },
      });
      expect(res.status, bad).toBe(400);
    }
  });
});

describe("task date validation", () => {
  it("rejects creating a task with startDate after dueDate", async () => {
    const res = await createTask({ startDate: "2026-10-01", dueDate: "2026-09-01" });
    expect(res.status).toBe(400);
  });

  it("rejects creating a task with a garbage dueDate", async () => {
    expect((await createTask({ dueDate: "2026-02-31" })).status).toBe(400);
  });

  it("rejects an update whose both dates are out of order", async () => {
    const res = await patchTask({ startDate: "2026-10-01", dueDate: "2026-09-01" });
    expect(res.status).toBe(400);
  });

  it("rejects a dueDate before the STORED startDate, without a ledger row", async () => {
    const before = await ledgerLength();
    const res = await patchTask({ dueDate: "2000-01-01" });
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toBe("invalid_task_dates");
    expect(await ledgerLength()).toBe(before);
    const stored = await repo.getProgram(WORKSPACE, program.id);
    const storedTask = stored?.packages.flatMap((p) => p.tasks).find((t) => t.id === task.id);
    expect(storedTask?.dueDate).toBe(task.dueDate);
  });
});

describe("assignee validation", () => {
  it("rejects an unknown assignee with 400 unknown_assignee, without a ledger row", async () => {
    const before = await ledgerLength();
    const res = await patchTask({ assignee: "no-such-user" });
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toBe("unknown_assignee");
    expect(await ledgerLength()).toBe(before);
  });

  it("accepts a known realm user and appends to the ledger", async () => {
    const before = await ledgerLength();
    const res = await patchTask({ assignee: "omar" });
    expect(res.status).toBe(200);
    expect(await ledgerLength()).toBe(before + 1);
    expect((await patchTask({ assignee: null })).status).toBe(200);
  });
});

describe("reference and malformed-input handling", () => {
  it("returns 404 for unknown program, task, and package ids", async () => {
    const patchBody = { workspaceId: WORKSPACE, status: "done" };
    expect(
      (await request("PATCH", `/api/programs/prog-none/tasks/${task.id}`, patchBody)).status,
    ).toBe(404);
    expect(
      (await request("PATCH", `/api/programs/${program.id}/tasks/task-none`, patchBody)).status,
    ).toBe(404);
    expect((await createTask({ packageId: "wbp-none" })).status).toBe(404);
    expect(
      (
        await request("PATCH", "/api/programs/prog-none", {
          workspaceId: WORKSPACE,
          teamId: null,
        })
      ).status,
    ).toBe(404);
  });

  it("returns 400, never 500, for malformed bodies", async () => {
    expect((await request("POST", "/api/programs", undefined, "{not json")).status).toBe(400);
    expect((await createTask({ estimateDays: "three" })).status).toBe(400);
    expect((await createTask({ estimateDays: -2 })).status).toBe(400);
    expect((await createTask({ name: "" })).status).toBe(400);
    expect((await createTask({ name: "x".repeat(10_000) })).status).toBe(400);
    expect((await patchTask({})).status).toBe(400);
  });
});

describe("response cacheability", () => {
  it("marks reads and mutations no-store", async () => {
    const read = await request("GET", `/api/programs?workspaceId=${WORKSPACE}`);
    expect(read.status).toBe(200);
    expect(read.headers.get("cache-control")).toBe("no-store");
    const mutation = await patchTask({ status: "in_progress" });
    expect(mutation.status).toBe(200);
    expect(mutation.headers.get("cache-control")).toBe("no-store");
  });
});
