import { describe, expect, it } from "vitest";
import type { ChatEvent, ChatMessage } from "../src/chat.ts";
import { ASSISTANT_TOOLS } from "../src/chat-tools.ts";
import { DeterministicChatAdapter } from "../src/adapters/deterministic-chat.ts";

/**
 * Defect 1 (task refs must fall back to search_tasks) and defect 2 (quoted
 * names lose their delimiters) adapter-level coverage. Split out of
 * deterministic-chat.test.ts to keep that file under the repo's max-lines
 * budget.
 */

const TODAY = "2026-08-24";

const SNAPSHOT = [
  {
    id: "prog-falcon",
    name: "Falcon Rollout",
    packages: [
      {
        id: "pkg-discovery",
        name: "Discovery",
        tasks: [{ id: "task-audit", name: "Field kit audit", status: "todo" }],
      },
      {
        id: "pkg-build",
        name: "Build",
        tasks: [{ id: "task-rig", name: "Rig assembly", status: "in_progress" }],
      },
    ],
  },
];

const LEAN_SNAPSHOT_AR = [
  { id: "prog-taawun", name: "منصة التعاون", packages: [{ id: "pkg-design", name: "التصميم" }] },
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

describe("DeterministicChatAdapter — task ref falls back to search_tasks", () => {
  it("requests search_tasks when a task ref has no match in the snapshot", async () => {
    const events = await run([user("mark Zeppelin as done"), snapshotMessage]);
    expect(onlyToolCall(events)).toEqual({ name: "search_tasks", args: { text: "Zeppelin" } });
    expect(events.at(-1)).toEqual({ type: "finish", reason: "tool_calls" });
  });

  it("says it couldn't find a task ref that also misses in search_tasks", async () => {
    const events = await run([
      user("mark Zeppelin as done"),
      snapshotMessage,
      toolResult("search_tasks", []),
    ]);
    expect(onlyText(events)).toContain('"Zeppelin"');
    expect(events.some((e) => e.type === "tool_call")).toBe(false);
  });

  it("resolves a task ref via a unique search_tasks match after a snapshot miss", async () => {
    const events = await run([
      user("mark Ground station calibration as done"),
      snapshotMessage,
      toolResult("search_tasks", [
        {
          programId: "prog-falcon",
          programName: "Falcon Rollout",
          packageId: "pkg-build",
          packageName: "Build",
          id: "task-ground",
          name: "Ground station calibration",
          status: "todo",
        },
      ]),
    ]);
    expect(onlyToolCall(events)).toEqual({
      name: "update_task",
      args: { programId: "prog-falcon", taskId: "task-ground", patch: { status: "done" } },
    });
  });

  it("asks which task when search_tasks returns more than one match", async () => {
    const events = await run([
      user("mark Ground station calibration as done"),
      snapshotMessage,
      toolResult("search_tasks", [
        {
          programId: "prog-falcon",
          programName: "Falcon Rollout",
          packageId: "pkg-build",
          packageName: "Build",
          id: "task-ground-a",
          name: "Ground station calibration A",
          status: "todo",
        },
        {
          programId: "prog-falcon",
          programName: "Falcon Rollout",
          packageId: "pkg-build",
          packageName: "Build",
          id: "task-ground-b",
          name: "Ground station calibration B",
          status: "todo",
        },
      ]),
    ]);
    const text = onlyText(events);
    expect(text).toContain("Ground station calibration A");
    expect(text).toContain("Ground station calibration B");
    expect(events.some((e) => e.type === "tool_call")).toBe(false);
  });

  it("resolves an Arabic task ref via a search_tasks fallback end to end (lean snapshot)", async () => {
    const events = await run([
      user("علّم فحص محطة الأرض كمنجزة"),
      toolResult("list_projects", LEAN_SNAPSHOT_AR),
      toolResult("search_tasks", [
        {
          programId: "prog-taawun",
          programName: "منصة التعاون",
          packageId: "pkg-design",
          packageName: "التصميم",
          id: "task-ground-ar",
          name: "فحص محطة الأرض",
          status: "todo",
        },
      ]),
    ]);
    expect(onlyToolCall(events)).toEqual({
      name: "update_task",
      args: { programId: "prog-taawun", taskId: "task-ground-ar", patch: { status: "done" } },
    });
  });
});

describe("DeterministicChatAdapter — quoted spans lose their delimiters", () => {
  it("strips the delimiting quotes from a create_task name", async () => {
    const events = await run([user('add task "P1" to Falcon'), snapshotMessage]);
    expect(onlyToolCall(events)).toMatchObject({
      name: "create_task",
      args: { programId: "prog-falcon", packageId: "pkg-discovery", name: "P1" },
    });
  });
});
