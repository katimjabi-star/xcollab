import { describe, expect, it } from "vitest";
import type { ChatEvent, ChatMessage } from "../src/chat.ts";
import { ASSISTANT_TOOLS } from "../src/chat-tools.ts";
import { DeterministicChatAdapter } from "../src/adapters/deterministic-chat.ts";

const TODAY = "2026-08-24";

const SNAPSHOT = [
  {
    id: "prog-falcon",
    name: "Falcon Rollout",
    packages: [
      {
        id: "pkg-discovery",
        name: "Discovery",
        tasks: [
          { id: "task-audit", name: "Field kit audit", status: "todo" },
          { id: "task-radio", name: "Radio survey", status: "blocked" },
        ],
      },
      {
        id: "pkg-build",
        name: "Build",
        tasks: [
          { id: "task-rig", name: "Rig assembly", status: "in_progress" },
          { id: "task-rig-check", name: "Rig checklist", status: "todo" },
        ],
      },
    ],
  },
  {
    id: "prog-taawun",
    name: "منصة التعاون",
    packages: [
      {
        id: "pkg-design",
        name: "التصميم",
        tasks: [{ id: "task-review", name: "مراجعة الواجهة", status: "todo" }],
      },
    ],
  },
];

const user = (content: string): ChatMessage => ({ role: "user", content });
const toolResult = (tool: string, payload: unknown): ChatMessage => ({
  role: "tool_result",
  tool,
  content: JSON.stringify(payload),
});
const snapshotMessage = toolResult("list_projects", SNAPSHOT);

async function run(messages: ChatMessage[]): Promise<ChatEvent[]> {
  const adapter = new DeterministicChatAdapter({ today: TODAY });
  const events: ChatEvent[] = [];
  for await (const event of adapter.runTurn({ system: "", messages, tools: [...ASSISTANT_TOOLS] })) {
    events.push(event);
  }
  return events;
}

function onlyToolCall(events: ChatEvent[]): { name: string; args: unknown } {
  const call = events.find((e) => e.type === "tool_call");
  if (!call || call.type !== "tool_call") throw new Error("expected a tool_call event");
  return { name: call.name, args: call.args };
}

function onlyText(events: ChatEvent[]): string {
  return events
    .filter((e): e is Extract<ChatEvent, { type: "text_delta" }> => e.type === "text_delta")
    .map((e) => e.text)
    .join("");
}

describe("DeterministicChatAdapter — snapshot acquisition", () => {
  it("requests list_projects before resolving any reference", async () => {
    const events = await run([user("mark Field kit audit as done")]);
    expect(onlyToolCall(events)).toEqual({ name: "list_projects", args: {} });
    expect(events.at(-1)).toEqual({ type: "finish", reason: "tool_calls" });
  });
});

describe("DeterministicChatAdapter — mutations emit proposal-shaped tool calls", () => {
  it("resolves a task by unique substring and emits update_task{status}", async () => {
    const events = await run([user("mark Field kit audit as done"), snapshotMessage]);
    expect(onlyToolCall(events)).toEqual({
      name: "update_task",
      args: { programId: "prog-falcon", taskId: "task-audit", patch: { status: "done" } },
    });
  });

  it("emits update_task{dueDate} for a reschedule with a relative date", async () => {
    const events = await run([user("set the due date of Radio survey to tomorrow"), snapshotMessage]);
    expect(onlyToolCall(events)).toEqual({
      name: "update_task",
      args: { programId: "prog-falcon", taskId: "task-radio", patch: { dueDate: "2026-08-25" } },
    });
  });

  it("emits update_task{assignee:null} for unassign", async () => {
    const events = await run([user("unassign Radio survey"), snapshotMessage]);
    expect(onlyToolCall(events)).toEqual({
      name: "update_task",
      args: { programId: "prog-falcon", taskId: "task-radio", patch: { assignee: null } },
    });
  });

  it("emits create_task into the named section with due date and assignee", async () => {
    const events = await run([
      user("add a task Cable check in Falcon section Build due 2026-09-05 assigned to omar"),
      snapshotMessage,
    ]);
    expect(onlyToolCall(events)).toEqual({
      name: "create_task",
      args: {
        programId: "prog-falcon",
        packageId: "pkg-build",
        name: "Cable check",
        dueDate: "2026-09-05",
        assignee: "omar",
      },
    });
  });

  it("defaults create_task to the project's first package when no section is named", async () => {
    const events = await run([user("add task Wiring in Falcon"), snapshotMessage]);
    expect(onlyToolCall(events)).toMatchObject({
      name: "create_task",
      args: { programId: "prog-falcon", packageId: "pkg-discovery", name: "Wiring" },
    });
  });

  it("emits create_project without needing a snapshot", async () => {
    const events = await run([
      user("create a project Falcon comms upgrade from 2026-09-01 to 2026-10-01"),
    ]);
    expect(onlyToolCall(events)).toEqual({
      name: "create_project",
      args: {
        mission: "Falcon comms upgrade",
        language: "en",
        timeline: { start: "2026-09-01", end: "2026-10-01" },
      },
    });
  });

  it("handles the Arabic mutation path end to end", async () => {
    const events = await run([user("علّم مراجعة الواجهة كمنجزة"), snapshotMessage]);
    expect(onlyToolCall(events)).toEqual({
      name: "update_task",
      args: { programId: "prog-taawun", taskId: "task-review", patch: { status: "done" } },
    });
  });
});

describe("DeterministicChatAdapter — disambiguation and misses", () => {
  it("asks which task when a reference is ambiguous, listing candidates", async () => {
    const events = await run([user("assign rig to sara"), snapshotMessage]);
    const text = onlyText(events);
    expect(text).toContain("Rig assembly");
    expect(text).toContain("Rig checklist");
    expect(events.at(-1)).toEqual({ type: "finish", reason: "stop" });
  });

  it("says it couldn't find an unknown reference", async () => {
    const events = await run([user("mark Zeppelin as done"), snapshotMessage]);
    expect(onlyText(events)).toContain('"Zeppelin"');
    expect(events.some((e) => e.type === "tool_call")).toBe(false);
  });

  it("answers outside-grammar utterances with the canned capability reply", async () => {
    const events = await run([user("hello there, what can you do?")]);
    expect(onlyText(events)).toMatch(/create a project/i);
  });

  it("answers Arabic outside-grammar utterances in Arabic", async () => {
    const events = await run([user("مرحباً كيف حالك")]);
    expect(onlyText(events)).toContain("مشروع");
  });
});

describe("DeterministicChatAdapter — searches, summaries and narration", () => {
  it("maps 'my overdue tasks' to search_tasks{assignee:'me', overdue:true}", async () => {
    const events = await run([user("show my overdue tasks")]);
    expect(onlyToolCall(events)).toEqual({
      name: "search_tasks",
      args: { assignee: "me", overdue: true },
    });
  });

  it("maps 'due this week' to a dueAfter/dueBefore window from today", async () => {
    const events = await run([user("show my tasks due this week")]);
    expect(onlyToolCall(events)).toEqual({
      name: "search_tasks",
      args: { assignee: "me", dueAfter: TODAY, dueBefore: "2026-08-31" },
    });
  });

  it("maps 'what's blocked in X' to search_tasks{programId, status}", async () => {
    const events = await run([user("what's blocked in Falcon?"), snapshotMessage]);
    expect(onlyToolCall(events)).toEqual({
      name: "search_tasks",
      args: { programId: "prog-falcon", status: "blocked" },
    });
  });

  it("maps summarize to get_project_summary once the ref resolves", async () => {
    const events = await run([user("لخص منصة التعاون"), snapshotMessage]);
    expect(onlyToolCall(events)).toEqual({
      name: "get_project_summary",
      args: { programId: "prog-taawun" },
    });
  });

  it("narrates a search result fed back within the same turn", async () => {
    const events = await run([
      user("show my overdue tasks"),
      toolResult("search_tasks", [{ id: "task-audit", name: "Field kit audit" }]),
    ]);
    expect(onlyText(events)).toContain("Found 1 task");
    expect(onlyText(events)).toContain("Field kit audit");
  });

  it("narrates an empty search result", async () => {
    const events = await run([user("اعرض مهامي المتأخرة"), toolResult("search_tasks", [])]);
    expect(onlyText(events)).toContain("لا توجد مهام");
  });

  it("narrates a summary digest fed back within the same turn", async () => {
    const events = await run([
      user("summarize Falcon"),
      snapshotMessage,
      toolResult("get_project_summary", {
        statusCounts: { todo: 2, done: 1 },
        overdue: 1,
        nextMilestone: { name: "Pilot go-live" },
      }),
    ]);
    const text = onlyText(events);
    expect(text).toContain("Overdue: 1");
    expect(text).toContain("Pilot go-live");
  });
});
