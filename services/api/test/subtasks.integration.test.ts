import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import { verifyChain, type LedgerEntry, type Program, type Subtask, type Task } from "@xcollab/core";
import { AiGateway } from "@xcollab/ai-gateway";
import { migrate } from "../src/db/migrate.ts";
import { WorkGraphRepository } from "../src/repository.ts";
import { createApp } from "../src/app.ts";
import { getAccessToken } from "./keycloak.ts";
import { ScriptedChatAdapter } from "./assistant-helpers.ts";

const ADMIN_URL =
  process.env.DATABASE_URL ?? "postgres://xcollab:xcollab_dev_only@localhost:5432/xcollab";
const APP_URL =
  process.env.APP_DATABASE_URL ?? "postgres://xcollab_app:app_dev_only@localhost:5432/xcollab";

const WORKSPACE = `ws-subtasks-${process.pid}`;
const gateway = new AiGateway([]);
const tester = { kind: "human", id: "tester" } as const;

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

async function newProgramTask(mission: string): Promise<{ program: Program; task: Task }> {
  const generation = await gateway.generateProgram({ mission, language: "en" });
  const { program } = await repo.createProgram(WORKSPACE, generation, tester);
  const task = program.packages[0]?.tasks[0];
  if (!task) throw new Error("template program has no tasks");
  return { program, task };
}

async function api(method: string, path: string, body?: unknown): Promise<Response> {
  const headers: Record<string, string> = { authorization: `Bearer ${token}` };
  if (body === undefined) return app.request(path, { method, headers });
  headers["content-type"] = "application/json";
  return app.request(path, { method, headers, body: JSON.stringify(body) });
}

function subtaskUrl(programId: string, taskId: string, subtaskId = ""): string {
  const suffix = subtaskId === "" ? "" : `/${subtaskId}`;
  return `/api/programs/${programId}/tasks/${taskId}/subtasks${suffix}`;
}

async function addSubtask(programId: string, taskId: string, name: string): Promise<Subtask> {
  const res = await api("POST", subtaskUrl(programId, taskId), { workspaceId: WORKSPACE, name });
  expect(res.status).toBe(201);
  return ((await res.json()) as { subtask: Subtask }).subtask;
}

function storedTask(program: Program | null, taskId: string): Task | undefined {
  return program?.packages.flatMap((p) => p.tasks).find((t) => t.id === taskId);
}

async function ledgerLength(): Promise<number> {
  return (await repo.getLedger(WORKSPACE)).length;
}

describe("POST /api/programs/:programId/tasks/:taskId/subtasks", () => {
  it("adds a subtask, ledgers task.subtask_add, and keeps the chain valid", async () => {
    const { program, task } = await newProgramTask("Subtask add");
    const res = await api("POST", subtaskUrl(program.id, task.id), {
      workspaceId: WORKSPACE,
      name: "Draft the review checklist",
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as {
      program: Program;
      task: Task;
      subtask: Subtask;
      ledgerSeq: number;
    };
    expect(body.subtask.id).toMatch(/^sub-/);
    expect(body.subtask).toMatchObject({ name: "Draft the review checklist", done: false });
    expect(body.task.subtasks).toEqual([body.subtask]);
    expect(storedTask(await repo.getProgram(WORKSPACE, program.id), task.id)?.subtasks).toEqual([
      body.subtask,
    ]);

    const ledger = await repo.getLedger(WORKSPACE);
    const last = ledger.at(-1);
    expect(last?.action).toBe("task.subtask_add");
    expect(last?.actor).toEqual({ kind: "human", id: "jabbir" });
    expect(JSON.parse(last?.input ?? "{}")).toEqual({
      programId: program.id,
      taskId: task.id,
      subtask: body.subtask,
    });
    expect(last?.output).toBe(JSON.stringify({ applied: true }));
    expect(last?.seq).toBe(body.ledgerSeq);
    expect(verifyChain(ledger as LedgerEntry[])).toEqual({ valid: true });
  });

  it("returns 404 for an unknown task or program and appends no ledger row", async () => {
    const { program } = await newProgramTask("Subtask add 404");
    const before = await ledgerLength();
    const payload = { workspaceId: WORKSPACE, name: "Orphan" };
    expect((await api("POST", subtaskUrl(program.id, "task-nope"), payload)).status).toBe(404);
    expect((await api("POST", subtaskUrl("prog-nope", "task-nope"), payload)).status).toBe(404);
    expect(await ledgerLength()).toBe(before);
  });

  it("rejects an empty or missing name with 400", async () => {
    const { program, task } = await newProgramTask("Subtask add 400");
    const empty = await api("POST", subtaskUrl(program.id, task.id), {
      workspaceId: WORKSPACE,
      name: "",
    });
    expect(empty.status).toBe(400);
    const missing = await api("POST", subtaskUrl(program.id, task.id), {
      workspaceId: WORKSPACE,
    });
    expect(missing.status).toBe(400);
  });

  it("returns 409 at the 50-subtask cap without a ledger row", async () => {
    const { program, task } = await newProgramTask("Subtask cap");
    for (let i = 0; i < 50; i += 1) {
      const added = await repo.subtasks.add(WORKSPACE, program.id, task.id, `item ${i}`, tester);
      expect(added.outcome).toBe("added");
    }
    const before = await ledgerLength();
    const res = await api("POST", subtaskUrl(program.id, task.id), {
      workspaceId: WORKSPACE,
      name: "one too many",
    });
    expect(res.status).toBe(409);
    expect(await ledgerLength()).toBe(before);
    const stored = storedTask(await repo.getProgram(WORKSPACE, program.id), task.id);
    expect(stored?.subtasks).toHaveLength(50);
    expect(verifyChain((await repo.getLedger(WORKSPACE)) as LedgerEntry[])).toEqual({
      valid: true,
    });
  });
});

describe("PATCH /api/programs/:programId/tasks/:taskId/subtasks/:subtaskId", () => {
  it("renames and toggles done, ledgering task.subtask_update with {from,to}", async () => {
    const { program, task } = await newProgramTask("Subtask update");
    const subtask = await addSubtask(program.id, task.id, "Initial name");

    const res = await api("PATCH", subtaskUrl(program.id, task.id, subtask.id), {
      workspaceId: WORKSPACE,
      name: "Renamed step",
      done: true,
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { subtask: Subtask; task: Task; ledgerSeq: number };
    expect(body.subtask).toEqual({ id: subtask.id, name: "Renamed step", done: true });
    expect(body.task.subtasks).toEqual([body.subtask]);
    expect(
      storedTask(await repo.getProgram(WORKSPACE, program.id), task.id)?.subtasks,
    ).toEqual([body.subtask]);

    const ledger = await repo.getLedger(WORKSPACE);
    const last = ledger.at(-1);
    expect(last?.action).toBe("task.subtask_update");
    expect(JSON.parse(last?.input ?? "{}")).toEqual({
      programId: program.id,
      taskId: task.id,
      subtaskId: subtask.id,
      changes: {
        name: { from: "Initial name", to: "Renamed step" },
        done: { from: false, to: true },
      },
    });
    expect(last?.seq).toBe(body.ledgerSeq);
    expect(verifyChain(ledger as LedgerEntry[])).toEqual({ valid: true });
  });

  it("toggles done alone (done-only change map)", async () => {
    const { program, task } = await newProgramTask("Subtask toggle");
    const subtask = await addSubtask(program.id, task.id, "Toggle me");
    const res = await api("PATCH", subtaskUrl(program.id, task.id, subtask.id), {
      workspaceId: WORKSPACE,
      done: true,
    });
    expect(res.status).toBe(200);
    const last = (await repo.getLedger(WORKSPACE)).at(-1);
    expect(JSON.parse(last?.input ?? "{}")).toEqual({
      programId: program.id,
      taskId: task.id,
      subtaskId: subtask.id,
      changes: { done: { from: false, to: true } },
    });
  });

  it("rejects a body with neither name nor done", async () => {
    const { program, task } = await newProgramTask("Subtask empty patch");
    const subtask = await addSubtask(program.id, task.id, "Untouched");
    const res = await api("PATCH", subtaskUrl(program.id, task.id, subtask.id), {
      workspaceId: WORKSPACE,
    });
    expect(res.status).toBe(400);
  });

  it("returns 404 for an unknown subtask, task, or program", async () => {
    const { program, task } = await newProgramTask("Subtask update 404");
    await addSubtask(program.id, task.id, "Exists");
    const before = await ledgerLength();
    const patch = (p: string, t: string, s: string) =>
      api("PATCH", subtaskUrl(p, t, s), { workspaceId: WORKSPACE, done: true });
    expect((await patch(program.id, task.id, "sub-nope")).status).toBe(404);
    expect((await patch(program.id, "task-nope", "sub-nope")).status).toBe(404);
    expect((await patch("prog-nope", task.id, "sub-nope")).status).toBe(404);
    expect(await ledgerLength()).toBe(before);
  });
});

describe("DELETE /api/programs/:programId/tasks/:taskId/subtasks/:subtaskId", () => {
  it("removes the subtask and ledgers task.subtask_delete with the snapshot", async () => {
    const { program, task } = await newProgramTask("Subtask delete");
    const keep = await addSubtask(program.id, task.id, "Keep me");
    const doomed = await addSubtask(program.id, task.id, "Delete me");

    const res = await api(
      "DELETE",
      `${subtaskUrl(program.id, task.id, doomed.id)}?workspaceId=${WORKSPACE}`,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { task: Task; ledgerSeq: number };
    expect(body.task.subtasks).toEqual([keep]);
    expect(
      storedTask(await repo.getProgram(WORKSPACE, program.id), task.id)?.subtasks,
    ).toEqual([keep]);

    const ledger = await repo.getLedger(WORKSPACE);
    const last = ledger.at(-1);
    expect(last?.action).toBe("task.subtask_delete");
    expect(JSON.parse(last?.input ?? "{}")).toEqual({
      programId: program.id,
      taskId: task.id,
      subtask: doomed,
    });
    expect(last?.seq).toBe(body.ledgerSeq);
    expect(verifyChain(ledger as LedgerEntry[])).toEqual({ valid: true });
  });

  it("returns 400 without workspaceId and 404 for unknown ids", async () => {
    const { program, task } = await newProgramTask("Subtask delete 404");
    const subtask = await addSubtask(program.id, task.id, "Still here");
    expect((await api("DELETE", subtaskUrl(program.id, task.id, subtask.id))).status).toBe(400);
    const before = await ledgerLength();
    const del = (id: string) =>
      api("DELETE", `${subtaskUrl(program.id, task.id, id)}?workspaceId=${WORKSPACE}`);
    expect((await del("sub-nope")).status).toBe(404);
    expect(
      (
        await api(
          "DELETE",
          `${subtaskUrl(program.id, "task-nope", subtask.id)}?workspaceId=${WORKSPACE}`,
        )
      ).status,
    ).toBe(404);
    expect(await ledgerLength()).toBe(before);
  });
});

describe("assistant-confirmed subtask mutation", () => {
  it("ledgers as the ai actor with provenance when the boot nonce is presented", async () => {
    const nonce = randomUUID();
    const aiApp = createApp(repo, gateway, undefined, {
      adapter: new ScriptedChatAdapter([]),
      nonce,
    });
    const { program, task } = await newProgramTask("Subtask ai provenance");
    const context = { requestedBy: "jabbir", proposalId: "prop-1", tool: "add_subtask" };
    const res = await aiApp.request(subtaskUrl(program.id, task.id), {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        "x-xcollab-assistant-nonce": nonce,
        "x-xcollab-assistant-context": JSON.stringify(context),
      },
      body: JSON.stringify({ workspaceId: WORKSPACE, name: "AI-added step" }),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { subtask: Subtask };

    const last = (await repo.getLedger(WORKSPACE)).at(-1);
    expect(last?.action).toBe("task.subtask_add");
    expect(last?.actor).toEqual({ kind: "ai", id: "assistant" });
    expect(JSON.parse(last?.input ?? "{}")).toEqual({
      programId: program.id,
      taskId: task.id,
      subtask: body.subtask,
      assistant: context,
    });
  });

  it("keeps a forged nonce a human actor", async () => {
    const { program, task } = await newProgramTask("Subtask forged nonce");
    const res = await app.request(subtaskUrl(program.id, task.id), {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        "x-xcollab-assistant-nonce": "forged",
      },
      body: JSON.stringify({ workspaceId: WORKSPACE, name: "Forged" }),
    });
    expect(res.status).toBe(201);
    const last = (await repo.getLedger(WORKSPACE)).at(-1);
    expect(last?.actor).toEqual({ kind: "human", id: "jabbir" });
  });
});
