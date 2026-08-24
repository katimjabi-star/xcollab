import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import type { Program, Subtask, Task, WorkspaceTeam } from "@xcollab/core";
import { AiGateway, type ChatEvent } from "@xcollab/ai-gateway";
import { migrate } from "../src/db/migrate.ts";
import { WorkGraphRepository } from "../src/repository.ts";
import { createApp } from "../src/app.ts";
import { getAccessToken } from "./keycloak.ts";
import { eventsOfType, readSseEvents, ScriptedChatAdapter } from "./assistant-helpers.ts";

/**
 * Execute-path coverage for the collaboration mutation tools (delete_task,
 * delete_project, add_team_member, remove is symmetric, add_subtask): each
 * confirmed proposal runs through the REAL routes and ledgers as the ai
 * actor. Split out of assistant-execute.integration.test.ts (max-lines).
 */

const ADMIN_URL =
  process.env.DATABASE_URL ?? "postgres://xcollab:xcollab_dev_only@localhost:5432/xcollab";
const APP_URL =
  process.env.APP_DATABASE_URL ?? "postgres://xcollab_app:app_dev_only@localhost:5432/xcollab";

const WORKSPACE = `ws-aicollab-${process.pid}`;
const gateway = new AiGateway([]);
const tester = { kind: "human", id: "tester" } as const;

let admin: Pool;
let appPool: Pool;
let repo: WorkGraphRepository;
let token: string;
let program: Program;
let task: Task;

type App = ReturnType<typeof createApp>;

function buildApp(script: ChatEvent[][]): App {
  return createApp(repo, gateway, undefined, {
    adapter: new ScriptedChatAdapter(script),
    nonce: randomUUID(),
  });
}

/** Builds an app whose single scripted turn proposes `tool(args)`, streams the
    turn, and returns the minted proposalId. */
async function proposeTool(
  tool: string,
  args: Record<string, unknown>,
): Promise<{ app: App; proposalId: string }> {
  const app = buildApp([
    [
      { type: "tool_call", id: "c1", name: tool, args },
      { type: "finish", reason: "tool_calls" },
    ],
  ]);
  const res = await app.request("/api/assistant/messages", {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({
      workspaceId: WORKSPACE,
      language: "en",
      messages: [{ role: "user", content: "please do the thing" }],
    }),
  });
  expect(res.status).toBe(200);
  const proposal = eventsOfType(await readSseEvents(res), "proposal")[0];
  if (!proposal) throw new Error("no proposal event streamed");
  return { app, proposalId: proposal.proposalId };
}

async function execute(
  app: App,
  body: Record<string, unknown>,
): Promise<Response> {
  return app.request("/api/assistant/execute", {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ workspaceId: WORKSPACE, language: "en", ...body }),
  });
}

async function ledgerEntries(): Promise<
  { actor: unknown; action: string; modelId?: string; input: string }[]
> {
  return repo.getLedger(WORKSPACE);
}

beforeAll(async () => {
  admin = new Pool({ connectionString: ADMIN_URL });
  await migrate(admin);
  appPool = new Pool({ connectionString: APP_URL });
  repo = new WorkGraphRepository(appPool);
  token = await getAccessToken();
  const generation = await gateway.generateProgram({ mission: "Collab tools", language: "en" });
  program = (await repo.createProgram(WORKSPACE, generation, tester)).program;
  const first = program.packages[0]?.tasks[0];
  if (!first) throw new Error("template program has no tasks");
  task = first;
});

afterAll(async () => {
  await admin.query("DELETE FROM ledger_entries WHERE workspace_id = $1", [WORKSPACE]);
  await admin.query("DELETE FROM programs WHERE workspace_id = $1", [WORKSPACE]);
  await admin.query("DELETE FROM teams WHERE workspace_id = $1", [WORKSPACE]);
  await appPool.end();
  await admin.end();
});

describe("POST /api/assistant/execute — collaboration tools", () => {
  it("executes a confirmed delete_task: task gone, ledgered as the ai actor", async () => {
    // A package must keep >= 1 task, so delete a task created for the purpose.
    const packageId = program.packages[0]?.id;
    if (!packageId) throw new Error("no package");
    const created = await repo.createTask(
      WORKSPACE,
      program.id,
      packageId,
      { name: "Doomed task" },
      tester,
    );
    if (!created) throw new Error("createTask failed");
    const args = { programId: program.id, taskId: created.task.id };

    const { app, proposalId } = await proposeTool("delete_task", args);
    const res = await execute(app, { proposalId, tool: "delete_task", args });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      result: { program: Program; ledgerSeq: number };
      message: string;
    };
    expect(body.message).toBe("Task deleted.");
    expect(body.result.ledgerSeq).toBeGreaterThan(1);
    const tasks = body.result.program.packages.flatMap((pkg) => pkg.tasks.map((t) => t.id));
    expect(tasks).not.toContain(created.task.id);

    const stored = await repo.getProgram(WORKSPACE, program.id);
    const storedIds = stored?.packages.flatMap((pkg) => pkg.tasks.map((t) => t.id)) ?? [];
    expect(storedIds).not.toContain(created.task.id);

    const entry = (await ledgerEntries()).at(-1);
    expect(entry?.action).toBe("task.delete");
    expect(entry?.actor).toEqual({ kind: "ai", id: "assistant" });
    expect(entry?.modelId).toBe("scripted-model");
    const input = JSON.parse(entry?.input ?? "{}") as { assistant?: { tool: string } };
    expect(input.assistant?.tool).toBe("delete_task");
  });

  it("executes a confirmed add_team_member through the real team route", async () => {
    const createTeam = await buildApp([]).request("/api/teams", {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ workspaceId: WORKSPACE, name: "Field crew" }),
    });
    expect(createTeam.status).toBe(201);
    const team = ((await createTeam.json()) as { team: WorkspaceTeam }).team;

    const args = { teamId: team.id, username: "sara" };
    const { app, proposalId } = await proposeTool("add_team_member", args);
    const res = await execute(app, { proposalId, tool: "add_team_member", args });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { result: { team: WorkspaceTeam }; message: string };
    expect(body.message).toBe("Team member added.");
    expect(body.result.team.members).toContainEqual({ username: "sara", role: "member" });

    const entry = (await ledgerEntries()).at(-1);
    expect(entry?.action).toBe("team.member_add");
    expect(entry?.actor).toEqual({ kind: "ai", id: "assistant" });
  });

  it("executes a confirmed add_subtask and ledgers it as the ai actor", async () => {
    const args = { programId: program.id, taskId: task.id, name: "Check the checklist" };
    const { app, proposalId } = await proposeTool("add_subtask", args);
    const res = await execute(app, { proposalId, tool: "add_subtask", args });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      result: { task: Task; subtask: Subtask; ledgerSeq: number };
      message: string;
    };
    expect(body.message).toBe("Subtask added.");
    expect(body.result.subtask.name).toBe("Check the checklist");
    expect(body.result.subtask.done).toBe(false);
    expect(body.result.task.subtasks?.some((s) => s.id === body.result.subtask.id)).toBe(true);

    const entry = (await ledgerEntries()).at(-1);
    expect(entry?.action).toBe("task.subtask_add");
    expect(entry?.actor).toEqual({ kind: "ai", id: "assistant" });
  });

  it("refuses tampered delete_task args (409) and burns the proposal", async () => {
    const args = { programId: program.id, taskId: task.id };
    const { app, proposalId } = await proposeTool("delete_task", args);
    const tampered = { programId: program.id, taskId: "task-somebody-else" };
    const res = await execute(app, { proposalId, tool: "delete_task", args: tampered });
    expect(res.status).toBe(409);
    expect(((await res.json()) as { error: string }).error).toBe("proposal_mismatch");
    // The original task is untouched.
    const stored = await repo.getProgram(WORKSPACE, program.id);
    const storedIds = stored?.packages.flatMap((pkg) => pkg.tasks.map((t) => t.id)) ?? [];
    expect(storedIds).toContain(task.id);
  });

  it("executes a confirmed delete_project and refuses the replay (404)", async () => {
    const generation = await gateway.generateProgram({ mission: "Doomed project", language: "en" });
    const doomed = (await repo.createProgram(WORKSPACE, generation, tester)).program;
    const args = { programId: doomed.id };

    const { app, proposalId } = await proposeTool("delete_project", args);
    const res = await execute(app, { proposalId, tool: "delete_project", args });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { result: { ledgerSeq: number }; message: string };
    expect(body.message).toBe("Project deleted.");
    expect(body.result.ledgerSeq).toBeGreaterThan(1);
    expect(await repo.getProgram(WORKSPACE, doomed.id)).toBeNull();

    const entry = (await ledgerEntries()).at(-1);
    expect(entry?.action).toBe("program.delete");
    expect(entry?.actor).toEqual({ kind: "ai", id: "assistant" });
    expect(entry?.modelId).toBe("scripted-model");

    // Single-use proposal: replaying the confirmed request is a 404.
    const replay = await execute(app, { proposalId, tool: "delete_project", args });
    expect(replay.status).toBe(404);
    expect(((await replay.json()) as { error: string }).error).toBe("unknown_proposal");
  });

  it("maps the last_task guard through to a structured 409", async () => {
    const solo = program.packages.find((pkg) => pkg.tasks.length === 1);
    // The template program may not have a single-task package; make one true.
    const target = solo ?? program.packages[0];
    if (!target) throw new Error("no package");
    const stored = await repo.getProgram(WORKSPACE, program.id);
    const storedPkg = stored?.packages.find((pkg) => pkg.id === target.id);
    if (!storedPkg) throw new Error("package missing");
    while (storedPkg.tasks.length > 1) {
      const surplus = storedPkg.tasks.pop();
      if (!surplus) break;
      await repo.deleteTask(WORKSPACE, program.id, surplus.id, tester);
    }
    const lastTask = storedPkg.tasks[0];
    if (!lastTask) throw new Error("no last task");

    const args = { programId: program.id, taskId: lastTask.id };
    const { app, proposalId } = await proposeTool("delete_task", args);
    const res = await execute(app, { proposalId, tool: "delete_task", args });
    expect(res.status).toBe(409);
  });
});
