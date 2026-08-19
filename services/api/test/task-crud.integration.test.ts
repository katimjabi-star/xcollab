import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import { verifyChain, type LedgerEntry, type Program, type Task } from "@xcollab/core";
import { AiGateway } from "@xcollab/ai-gateway";
import type { Hono } from "hono";
import { migrate } from "../src/db/migrate.ts";
import { WorkGraphRepository } from "../src/repository.ts";
import { createApp } from "../src/app.ts";

const ADMIN_URL =
  process.env.DATABASE_URL ?? "postgres://xcollab:xcollab_dev_only@localhost:5432/xcollab";
const APP_URL =
  process.env.APP_DATABASE_URL ?? "postgres://xcollab_app:app_dev_only@localhost:5432/xcollab";

const WORKSPACE = `ws-taskcrud-${process.pid}`;
const gateway = new AiGateway([]);

let admin: Pool;
let appPool: Pool;
let repo: WorkGraphRepository;
let app: Hono;

beforeAll(async () => {
  admin = new Pool({ connectionString: ADMIN_URL });
  await migrate(admin);
  appPool = new Pool({ connectionString: APP_URL });
  repo = new WorkGraphRepository(appPool);
  app = createApp(repo, gateway);
});

afterAll(async () => {
  await admin.query("DELETE FROM ledger_entries WHERE workspace_id = $1", [WORKSPACE]);
  await admin.query("DELETE FROM programs WHERE workspace_id = $1", [WORKSPACE]);
  await appPool.end();
  await admin.end();
});

async function newProgram(mission: string): Promise<Program> {
  const generation = await gateway.generateProgram({ mission, language: "en" });
  const created = await repo.createProgram(WORKSPACE, generation, { kind: "human", id: "tester" });
  return created.program;
}

function findTask(program: Program | null, taskId: string): Task | undefined {
  return program?.packages.flatMap((p) => p.tasks).find((t) => t.id === taskId);
}

async function api(method: string, path: string, body?: unknown): Promise<Response> {
  return app.request(path, {
    method,
    ...(body === undefined
      ? {}
      : { body: JSON.stringify(body), headers: { "content-type": "application/json" } }),
  });
}

async function ledgerLength(): Promise<number> {
  return (await repo.getLedger(WORKSPACE)).length;
}

function delTask(programId: string, taskId: string): Promise<Response> {
  return api("DELETE", `/api/programs/${programId}/tasks/${taskId}?workspaceId=${WORKSPACE}`);
}

describe("POST /api/programs/:programId/tasks", () => {
  it("creates a task, appends task.create, and keeps the chain valid", async () => {
    const program = await newProgram("Create task test");
    const pkg = program.packages[0];
    if (!pkg) throw new Error("program has no packages");
    const countBefore = pkg.tasks.length;

    const res = await api("POST", `/api/programs/${program.id}/tasks`, {
      workspaceId: WORKSPACE,
      packageId: pkg.id,
      name: "Ship the launch checklist",
      estimateDays: 3,
      assigneeRole: "pm",
      dueDate: "2026-09-15",
      description: "Final review before launch",
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { program: Program; task: Task; ledgerSeq: number };
    expect(body.task.id).toMatch(/^task-/);
    expect(body.task).toMatchObject({
      name: "Ship the launch checklist",
      status: "todo",
      estimateDays: 3,
      assigneeRole: "pm",
      dueDate: "2026-09-15",
      description: "Final review before launch",
    });
    const updatedPkg = body.program.packages.find((p) => p.id === pkg.id);
    expect(updatedPkg?.tasks.length).toBe(countBefore + 1);
    expect(findTask(await repo.getProgram(WORKSPACE, program.id), body.task.id)).toBeDefined();

    const ledger = await repo.getLedger(WORKSPACE);
    const last = ledger.at(-1);
    expect(last?.action).toBe("task.create");
    expect(last?.actor).toEqual({ kind: "human", id: "web-user" });
    expect(JSON.parse(last?.input ?? "{}")).toEqual({
      programId: program.id,
      packageId: pkg.id,
      task: body.task,
    });
    expect(last?.output).toBe(JSON.stringify({ applied: true }));
    expect(last?.seq).toBe(body.ledgerSeq);
    expect(verifyChain(ledger as LedgerEntry[])).toEqual({ valid: true });
  });

  it("defaults estimateDays to 1 when omitted", async () => {
    const program = await newProgram("Create task default estimate");
    const pkg = program.packages[0];
    if (!pkg) throw new Error("program has no packages");
    const res = await api("POST", `/api/programs/${program.id}/tasks`, {
      workspaceId: WORKSPACE,
      packageId: pkg.id,
      name: "Minimal task",
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { task: Task };
    expect(body.task.estimateDays).toBe(1);
    expect(body.task.assigneeRole).toBeUndefined();
  });

  it("returns 404 for an unknown package or program and appends no ledger row", async () => {
    const program = await newProgram("Create task unknown package");
    const before = await ledgerLength();
    const body = { workspaceId: WORKSPACE, packageId: "pkg-does-not-exist", name: "Orphan" };
    const unknownPkg = await api("POST", `/api/programs/${program.id}/tasks`, body);
    expect(unknownPkg.status).toBe(404);
    const unknownProgram = await api("POST", `/api/programs/prog-does-not-exist/tasks`, body);
    expect(unknownProgram.status).toBe(404);
    expect(await ledgerLength()).toBe(before);
  });
});

describe("PATCH /api/programs/:programId/tasks/:taskId (generalized update)", () => {
  it("updates multiple fields at once and appends task.update with a changes map", async () => {
    const program = await newProgram("Multi-field update test");
    const task = program.packages[0]?.tasks[0];
    if (!task) throw new Error("program has no tasks");

    const res = await api("PATCH", `/api/programs/${program.id}/tasks/${task.id}`, {
      workspaceId: WORKSPACE,
      name: "Renamed task",
      estimateDays: 5,
      description: "Updated details",
      dueDate: "2026-10-01",
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { program: Program; ledgerSeq: number };
    expect(findTask(body.program, task.id)).toMatchObject({
      name: "Renamed task",
      estimateDays: 5,
      description: "Updated details",
      dueDate: "2026-10-01",
    });
    expect(findTask(await repo.getProgram(WORKSPACE, program.id), task.id)?.name).toBe(
      "Renamed task",
    );

    const ledger = await repo.getLedger(WORKSPACE);
    const last = ledger.at(-1);
    expect(last?.action).toBe("task.update");
    expect(last?.actor).toEqual({ kind: "human", id: "web-user" });
    expect(JSON.parse(last?.input ?? "{}")).toEqual({
      programId: program.id,
      taskId: task.id,
      changes: {
        name: { from: task.name, to: "Renamed task" },
        estimateDays: { from: task.estimateDays, to: 5 },
        description: { from: task.description ?? null, to: "Updated details" },
        dueDate: { from: task.dueDate ?? null, to: "2026-10-01" },
      },
    });
    expect(last?.output).toBe(JSON.stringify({ applied: true }));
    expect(last?.seq).toBe(body.ledgerSeq);
    expect(verifyChain(ledger as LedgerEntry[])).toEqual({ valid: true });
  });

  it("still emits task.status_update when status is the only change key", async () => {
    const program = await newProgram("Status-only update test");
    const task = program.packages[0]?.tasks[0];
    if (!task) throw new Error("program has no tasks");

    const res = await api("PATCH", `/api/programs/${program.id}/tasks/${task.id}`, {
      workspaceId: WORKSPACE,
      status: "in_progress",
    });
    expect(res.status).toBe(200);
    const last = (await repo.getLedger(WORKSPACE)).at(-1);
    expect(last?.action).toBe("task.status_update");
    expect(last?.input).toBe(
      JSON.stringify({
        programId: program.id,
        taskId: task.id,
        from: task.status,
        to: "in_progress",
      }),
    );
  });

  it("clears a string field with null", async () => {
    const program = await newProgram("Null clear test");
    const task = program.packages[0]?.tasks[0];
    if (!task) throw new Error("program has no tasks");
    const setRes = await api("PATCH", `/api/programs/${program.id}/tasks/${task.id}`, {
      workspaceId: WORKSPACE,
      assigneeRole: "qa-lead",
    });
    expect(setRes.status).toBe(200);

    const res = await api("PATCH", `/api/programs/${program.id}/tasks/${task.id}`, {
      workspaceId: WORKSPACE,
      assigneeRole: null,
    });
    expect(res.status).toBe(200);
    const cleared = findTask(await repo.getProgram(WORKSPACE, program.id), task.id);
    expect(cleared?.assigneeRole).toBeUndefined();

    const last = (await repo.getLedger(WORKSPACE)).at(-1);
    expect(last?.action).toBe("task.update");
    expect(JSON.parse(last?.input ?? "{}")).toEqual({
      programId: program.id,
      taskId: task.id,
      changes: { assigneeRole: { from: "qa-lead", to: null } },
    });
  });

  it("rejects a body with no updatable field", async () => {
    const program = await newProgram("Empty patch test");
    const task = program.packages[0]?.tasks[0];
    if (!task) throw new Error("program has no tasks");
    const res = await api("PATCH", `/api/programs/${program.id}/tasks/${task.id}`, {
      workspaceId: WORKSPACE,
    });
    expect(res.status).toBe(400);
  });

  it("returns 404 for an unknown taskId and null from the repository", async () => {
    const program = await newProgram("Unknown task update test");
    const res = await api("PATCH", `/api/programs/${program.id}/tasks/task-nope`, {
      workspaceId: WORKSPACE,
      name: "Nope",
    });
    expect(res.status).toBe(404);
    const direct = await repo.updateTask(WORKSPACE, "prog-does-not-exist", "t1", { name: "x" }, {
      kind: "human",
      id: "web-user",
    });
    expect(direct).toBeNull();
  });
});

describe("DELETE /api/programs/:programId/tasks/:taskId", () => {
  it("deletes a task and appends task.delete with the full snapshot", async () => {
    const program = await newProgram("Delete task test");
    const pkg = program.packages[0];
    if (!pkg) throw new Error("program has no packages");
    const createRes = await api("POST", `/api/programs/${program.id}/tasks`, {
      workspaceId: WORKSPACE,
      packageId: pkg.id,
      name: "Doomed task",
      startDate: "2026-09-01",
    });
    const { task } = (await createRes.json()) as { task: Task };

    const res = await delTask(program.id, task.id);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { program: Program; ledgerSeq: number };
    expect(findTask(body.program, task.id)).toBeUndefined();
    expect(findTask(await repo.getProgram(WORKSPACE, program.id), task.id)).toBeUndefined();

    const ledger = await repo.getLedger(WORKSPACE);
    const last = ledger.at(-1);
    expect(last?.action).toBe("task.delete");
    expect(JSON.parse(last?.input ?? "{}")).toEqual({
      programId: program.id,
      taskId: task.id,
      task,
    });
    expect(last?.output).toBe(JSON.stringify({ applied: true }));
    expect(last?.seq).toBe(body.ledgerSeq);
    expect(verifyChain(ledger as LedgerEntry[])).toEqual({ valid: true });
  });

  it("rejects deleting the last task in a package with 409, no ledger row, program intact", async () => {
    const program = await newProgram("Delete last task test");
    const pkg = program.packages[0];
    if (!pkg) throw new Error("program has no packages");
    for (const t of pkg.tasks.slice(1)) {
      expect((await delTask(program.id, t.id)).status).toBe(200);
    }
    const before = await repo.getProgram(WORKSPACE, program.id);
    const lastTask = before?.packages.find((p) => p.id === pkg.id)?.tasks[0];
    if (!lastTask) throw new Error("package has no remaining task");
    const ledgerBefore = await ledgerLength();

    const res = await delTask(program.id, lastTask.id);
    expect(res.status).toBe(409);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBeTruthy();

    const direct = await repo.deleteTask(WORKSPACE, program.id, lastTask.id, {
      kind: "human",
      id: "web-user",
    });
    expect(direct.outcome).toBe("last_task");

    expect(await repo.getProgram(WORKSPACE, program.id)).toEqual(before);
    expect(await ledgerLength()).toBe(ledgerBefore);
    expect(verifyChain((await repo.getLedger(WORKSPACE)) as LedgerEntry[])).toEqual({
      valid: true,
    });
  });

  it("returns 404 for unknown ids and 400 without workspaceId", async () => {
    const program = await newProgram("Delete unknown test");
    const missingWs = await api("DELETE", `/api/programs/${program.id}/tasks/task-x`);
    expect(missingWs.status).toBe(400);
    expect((await delTask(program.id, "task-nope")).status).toBe(404);
    expect((await delTask("prog-nope", "task-nope")).status).toBe(404);
    const direct = await repo.deleteTask(WORKSPACE, program.id, "task-nope", {
      kind: "human",
      id: "web-user",
    });
    expect(direct.outcome).toBe("not_found");
  });
});
