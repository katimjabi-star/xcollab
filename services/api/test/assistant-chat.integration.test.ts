import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import { AiGateway, DeterministicChatAdapter, type ChatAdapter, type ChatEvent } from "@xcollab/ai-gateway";
import { migrate } from "../src/db/migrate.ts";
import { WorkGraphRepository } from "../src/repository.ts";
import { createApp } from "../src/app.ts";
import type { AssistantConfig } from "../src/app.ts";
import { getAccessToken } from "./keycloak.ts";
import { eventsOfType, readSseEvents, ScriptedChatAdapter } from "./assistant-helpers.ts";

const ADMIN_URL =
  process.env.DATABASE_URL ?? "postgres://xcollab:xcollab_dev_only@localhost:5432/xcollab";
const APP_URL =
  process.env.APP_DATABASE_URL ?? "postgres://xcollab_app:app_dev_only@localhost:5432/xcollab";

const WORKSPACE = `ws-aichat-${process.pid}`;
const gateway = new AiGateway([]);

let admin: Pool;
let appPool: Pool;
let repo: WorkGraphRepository;
let token: string;

function buildApp(adapter: ChatAdapter, limits?: AssistantConfig["limits"]): ReturnType<typeof createApp> {
  return createApp(repo, gateway, undefined, {
    adapter,
    nonce: randomUUID(),
    ...(limits === undefined ? {} : { limits }),
  });
}

async function postChat(
  app: ReturnType<typeof createApp>,
  content: string,
  auth: string | null = `Bearer ${token}`,
): Promise<Response> {
  return app.request("/api/assistant/messages", {
    method: "POST",
    headers: {
      ...(auth === null ? {} : { authorization: auth }),
      "content-type": "application/json",
    },
    body: JSON.stringify({
      workspaceId: WORKSPACE,
      language: "en",
      messages: [{ role: "user", content }],
    }),
  });
}

beforeAll(async () => {
  admin = new Pool({ connectionString: ADMIN_URL });
  await migrate(admin);
  appPool = new Pool({ connectionString: APP_URL });
  repo = new WorkGraphRepository(appPool);
  token = await getAccessToken();
});

afterAll(async () => {
  await admin.query("DELETE FROM ledger_entries WHERE workspace_id = $1", [WORKSPACE]);
  await admin.query("DELETE FROM programs WHERE workspace_id = $1", [WORKSPACE]);
  await appPool.end();
  await admin.end();
});

describe("POST /api/assistant/messages", () => {
  it("rejects requests without a bearer token", async () => {
    const res = await postChat(buildApp(new ScriptedChatAdapter([])), "hi", null);
    expect(res.status).toBe(401);
  });

  it("rejects an invalid body with a structured 400", async () => {
    const app = buildApp(new ScriptedChatAdapter([]));
    const res = await app.request("/api/assistant/messages", {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ workspaceId: WORKSPACE, language: "en", messages: [] }),
    });
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toBe("invalid request");
  });

  it("streams text deltas and a stop for a plain answer", async () => {
    const app = buildApp(
      new ScriptedChatAdapter([
        [
          { type: "text_delta", text: "Hello " },
          { type: "text_delta", text: "there" },
          { type: "finish", reason: "stop" },
        ],
      ]),
    );
    const events = await readSseEvents(await postChat(app, "hi"));
    expect(eventsOfType(events, "text_delta").map((e) => e.text).join("")).toBe("Hello there");
    expect(events.at(-1)).toEqual({ type: "done", finishReason: "stop" });
  });

  it("auto-runs read tools and feeds the digest back to the model", async () => {
    const adapter = new ScriptedChatAdapter([
      [
        { type: "tool_call", id: "c1", name: "search_tasks", args: { assignee: "me" } },
        { type: "finish", reason: "tool_calls" },
      ],
      [
        { type: "text_delta", text: "You have no tasks." },
        { type: "finish", reason: "stop" },
      ],
    ]);
    const events = await readSseEvents(await postChat(buildApp(adapter), "my tasks"));
    expect(eventsOfType(events, "tool_started")[0]?.tool).toBe("search_tasks");
    expect(eventsOfType(events, "tool_result")[0]?.tool).toBe("search_tasks");
    expect(events.at(-1)).toEqual({ type: "done", finishReason: "stop" });
    // The second model call must see the tool result in its transcript.
    const secondTurn = adapter.requests[1];
    expect(secondTurn?.messages.at(-1)).toMatchObject({ role: "tool_result", tool: "search_tasks" });
  });

  it("stops at a proposal for a mutation tool — nothing executes in the loop", async () => {
    const app = buildApp(
      new ScriptedChatAdapter([
        [
          {
            type: "tool_call",
            id: "c1",
            name: "update_task",
            args: { programId: "p1", taskId: "t1", patch: { status: "done" } },
          },
          { type: "finish", reason: "tool_calls" },
        ],
      ]),
    );
    const before = (await repo.getLedger(WORKSPACE)).length;
    const events = await readSseEvents(await postChat(app, "mark t1 done"));
    const proposals = eventsOfType(events, "proposal");
    expect(proposals).toHaveLength(1);
    expect(proposals[0]?.tool).toBe("update_task");
    expect(proposals[0]?.proposalId).toMatch(/^[0-9a-f-]{36}$/);
    expect(proposals[0]?.preview.fields).toContainEqual({ label: "status", value: "done" });
    expect(events.at(-1)).toEqual({ type: "done", finishReason: "proposal" });
    expect((await repo.getLedger(WORKSPACE)).length).toBe(before);
  });

  it("feeds invalid tool args back so the model can self-correct", async () => {
    const adapter = new ScriptedChatAdapter([
      [
        { type: "tool_call", id: "c1", name: "update_task", args: { taskId: "t1" } },
        { type: "finish", reason: "tool_calls" },
      ],
      [
        { type: "text_delta", text: "Sorry, I need the project id." },
        { type: "finish", reason: "stop" },
      ],
    ]);
    const events = await readSseEvents(await postChat(buildApp(adapter), "mark it done"));
    expect(eventsOfType(events, "proposal")).toHaveLength(0);
    expect(events.at(-1)).toEqual({ type: "done", finishReason: "stop" });
    expect(adapter.requests[1]?.messages.at(-1)?.role).toBe("tool_result");
  });

  it("aborts a runaway turn with budget_exhausted", async () => {
    const readTurn: ChatEvent[] = [
      { type: "tool_call", id: "c1", name: "list_projects", args: {} },
      { type: "finish", reason: "tool_calls" },
    ];
    const app = buildApp(new ScriptedChatAdapter(Array.from({ length: 7 }, () => readTurn)));
    const events = await readSseEvents(await postChat(app, "loop forever"));
    const errors = eventsOfType(events, "error");
    expect(errors[0]?.code).toBe("budget_exhausted");
  });

  it("rate-limits assistant turns per user", async () => {
    const app = buildApp(new ScriptedChatAdapter([]), { turnsPerMinute: 1 });
    expect((await postChat(app, "one")).status).toBe(200);
    expect((await postChat(app, "two")).status).toBe(429);
  });

  it("answers through the deterministic fallback adapter end to end", async () => {
    const app = buildApp(new DeterministicChatAdapter());
    const events = await readSseEvents(await postChat(app, "show my overdue tasks"));
    expect(eventsOfType(events, "tool_started")[0]?.tool).toBe("search_tasks");
    expect(eventsOfType(events, "tool_result")).toHaveLength(1);
    expect(events.at(-1)).toEqual({ type: "done", finishReason: "stop" });
  });
});
