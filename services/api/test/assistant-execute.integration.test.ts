import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import type { LedgerEntry, Program, Task } from "@xcollab/core";
import { AiGateway, type ChatEvent } from "@xcollab/ai-gateway";
import { migrate } from "../src/db/migrate.ts";
import { WorkGraphRepository } from "../src/repository.ts";
import { createApp } from "../src/app.ts";
import { getAccessToken } from "./keycloak.ts";
import { eventsOfType, readSseEvents, ScriptedChatAdapter } from "./assistant-helpers.ts";

const ADMIN_URL =
  process.env.DATABASE_URL ?? "postgres://xcollab:xcollab_dev_only@localhost:5432/xcollab";
const APP_URL =
  process.env.APP_DATABASE_URL ?? "postgres://xcollab_app:app_dev_only@localhost:5432/xcollab";

const WORKSPACE = `ws-aiexec-${process.pid}`;
const gateway = new AiGateway([]);
const tester = { kind: "human", id: "tester" } as const;

let admin: Pool;
let appPool: Pool;
let repo: WorkGraphRepository;
let token: string;
let program: Program;
let task: Task;

type App = ReturnType<typeof createApp>;

function proposalTurn(name: string, args: Record<string, unknown>): ChatEvent[] {
  return [
    { type: "tool_call", id: "c1", name, args },
    { type: "finish", reason: "tool_calls" },
  ];
}

function buildApp(script: ChatEvent[][]): App {
  return createApp(repo, gateway, undefined, {
    adapter: new ScriptedChatAdapter(script),
    nonce: randomUUID(),
  });
}

/** Runs one chat turn and returns the proposal it streamed. */
async function propose(app: App): Promise<{ proposalId: string; tool: string; args: unknown }> {
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
  return { proposalId: proposal.proposalId, tool: proposal.tool, args: proposal.args };
}

async function execute(
  app: App,
  body: Record<string, unknown>,
  auth: string | null = `Bearer ${token}`,
): Promise<Response> {
  return app.request("/api/assistant/execute", {
    method: "POST",
    headers: {
      ...(auth === null ? {} : { authorization: auth }),
      "content-type": "application/json",
    },
    body: JSON.stringify({ workspaceId: WORKSPACE, language: "en", ...body }),
  });
}

async function lastLedgerEntry(): Promise<LedgerEntry> {
  const entries = await repo.getLedger(WORKSPACE);
  const last = entries.at(-1);
  if (!last) throw new Error("empty ledger");
  return last;
}

beforeAll(async () => {
  admin = new Pool({ connectionString: ADMIN_URL });
  await migrate(admin);
  appPool = new Pool({ connectionString: APP_URL });
  repo = new WorkGraphRepository(appPool);
  token = await getAccessToken();
  const generation = await gateway.generateProgram({ mission: "Execute route", language: "en" });
  program = (await repo.createProgram(WORKSPACE, generation, tester)).program;
  const first = program.packages[0]?.tasks[0];
  if (!first) throw new Error("template program has no tasks");
  task = first;
});

afterAll(async () => {
  await admin.query("DELETE FROM ledger_entries WHERE workspace_id = $1", [WORKSPACE]);
  await admin.query("DELETE FROM programs WHERE workspace_id = $1", [WORKSPACE]);
  await appPool.end();
  await admin.end();
});

describe("POST /api/assistant/execute", () => {
  const updateArgs = () => ({
    programId: program.id,
    taskId: task.id,
    patch: { status: "done" },
  });

  it("rejects requests without a bearer token", async () => {
    const app = buildApp([]);
    const res = await execute(
      app,
      { proposalId: randomUUID(), tool: "update_task", args: updateArgs() },
      null,
    );
    expect(res.status).toBe(401);
  });

  it("executes a confirmed proposal and ledgers it as the ai actor", async () => {
    const app = buildApp([proposalTurn("update_task", updateArgs())]);
    const { proposalId, tool, args } = await propose(app);
    const res = await execute(app, { proposalId, tool, args });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      result: { program: Program; task?: Task; ledgerSeq: number };
      message: string;
    };
    expect(body.result.task?.status).toBe("done");
    expect(body.result.ledgerSeq).toBeGreaterThan(1);
    expect(body.message).toBe("Task updated.");

    const entry = await lastLedgerEntry();
    expect(entry.actor).toEqual({ kind: "ai", id: "assistant" });
    expect(entry.modelId).toBe("scripted-model");
    expect(entry.action).toBe("task.status_update");
    const input = JSON.parse(entry.input) as {
      assistant: { requestedBy: string; proposalId: string; tool: string };
    };
    expect(input.assistant.requestedBy).toBe("jabbir");
    expect(input.assistant.proposalId).toBe(proposalId);
    expect(input.assistant.tool).toBe("update_task");

    // The hash chain stays verifiable after the enriched append.
    const ledgerRes = await app.request(`/api/ledger?workspaceId=${WORKSPACE}`, {
      headers: { authorization: `Bearer ${token}` },
    });
    const ledger = (await ledgerRes.json()) as { verification: { valid: boolean } };
    expect(ledger.verification.valid).toBe(true);
  });

  it("refuses a reused proposalId (single-use)", async () => {
    const app = buildApp([proposalTurn("update_task", updateArgs())]);
    const { proposalId, tool, args } = await propose(app);
    expect((await execute(app, { proposalId, tool, args })).status).toBe(200);
    const reused = await execute(app, { proposalId, tool, args });
    expect(reused.status).toBe(404);
    expect(((await reused.json()) as { error: string }).error).toBe("unknown_proposal");
  });

  it("refuses an unknown proposalId", async () => {
    const app = buildApp([]);
    const res = await execute(app, {
      proposalId: randomUUID(),
      tool: "update_task",
      args: updateArgs(),
    });
    expect(res.status).toBe(404);
  });

  it("refuses args that differ from the proposed args", async () => {
    const app = buildApp([proposalTurn("update_task", updateArgs())]);
    const { proposalId, tool } = await propose(app);
    const tampered = { programId: program.id, taskId: task.id, patch: { status: "blocked" } };
    const res = await execute(app, { proposalId, tool, args: tampered });
    expect(res.status).toBe(409);
    expect(((await res.json()) as { error: string }).error).toBe("proposal_mismatch");
    // The mismatched confirm burns the proposal — no retry with the original.
    expect((await execute(app, { proposalId, tool, args: updateArgs() })).status).toBe(404);
  });

  it("rejects unknown tools and schema-invalid args before consuming anything", async () => {
    const app = buildApp([]);
    expect(
      (await execute(app, { proposalId: randomUUID(), tool: "delete_task", args: {} })).status,
    ).toBe(400);
    expect(
      (
        await execute(app, {
          proposalId: randomUUID(),
          tool: "update_task",
          args: { taskId: task.id },
        })
      ).status,
    ).toBe(400);
  });

  it("creates a task with assignee via create + follow-up assign, both ai-actor rows", async () => {
    const packageId = program.packages[0]?.id;
    const args = {
      programId: program.id,
      packageId,
      name: "Assistant-created task",
      assignee: "jabbir",
      dueDate: "2031-05-01",
    };
    const app = buildApp([proposalTurn("create_task", args)]);
    const proposal = await propose(app);
    const before = (await repo.getLedger(WORKSPACE)).length;
    const res = await execute(app, { proposalId: proposal.proposalId, tool: "create_task", args });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { result: { task?: Task } };
    expect(body.result.task?.name).toBe("Assistant-created task");
    expect(body.result.task?.assignee).toBe("jabbir");

    const entries = await repo.getLedger(WORKSPACE);
    expect(entries.length).toBe(before + 2);
    const [created, assigned] = entries.slice(-2);
    expect(created?.action).toBe("task.create");
    expect(assigned?.action).toBe("task.update");
    for (const entry of [created, assigned]) {
      expect(entry?.actor).toEqual({ kind: "ai", id: "assistant" });
      expect(entry?.modelId).toBe("scripted-model");
    }
  });

  it("keeps a forged nonce header a human actor", async () => {
    const app = buildApp([]);
    const res = await app.request(`/api/programs/${program.id}/tasks/${task.id}`, {
      method: "PATCH",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        "x-xcollab-assistant-nonce": "forged-nonce",
        "x-xcollab-assistant-context": JSON.stringify({
          requestedBy: "mallory",
          proposalId: "p",
          tool: "update_task",
        }),
      },
      body: JSON.stringify({ workspaceId: WORKSPACE, name: "Renamed by a human" }),
    });
    expect(res.status).toBe(200);
    const entry = await lastLedgerEntry();
    expect(entry.actor).toEqual({ kind: "human", id: "jabbir" });
    expect(entry.input.includes("assistant")).toBe(false);
    expect(entry.modelId).toBeUndefined();
  });
});
