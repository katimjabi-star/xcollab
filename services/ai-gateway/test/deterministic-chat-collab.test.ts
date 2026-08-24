import { describe, expect, it } from "vitest";
import type { ChatEvent, ChatMessage } from "../src/chat.ts";
import { ASSISTANT_TOOLS } from "../src/chat-tools.ts";
import { DeterministicChatAdapter } from "../src/adapters/deterministic-chat.ts";

/**
 * Adapter-level coverage for the collaboration mutations: delete_task /
 * delete_project / add_team_member / remove_team_member / add_subtask,
 * including team resolution via list_teams, case-insensitive usernames via
 * list_users, and the task-ref search_tasks fallback. Mirrors the style of
 * deterministic-chat-search-fallback.test.ts.
 */

const TODAY = "2026-08-24";

const SNAPSHOT = [
  {
    id: "prog-falcon",
    name: "Falcon Rollout",
    packages: [
      {
        id: "pkg-build",
        name: "Build",
        tasks: [{ id: "task-rig", name: "Rig assembly", status: "in_progress" }],
      },
    ],
  },
];

/** Shape of the api's leaned list_teams digest: member usernames only. */
const TEAMS = [
  { id: "team-field", name: "Field Crew", members: ["jabbir", "sara"] },
  { id: "team-design", name: "فريق التصميم", members: ["jabbir"] },
];

const USERS = [{ username: "omar" }, { username: "sara" }, { username: "jabbir" }];

const user = (content: string): ChatMessage => ({ role: "user", content });
const toolResult = (tool: string, payload: unknown): ChatMessage => ({
  role: "tool_result",
  tool,
  content: JSON.stringify(payload),
});
const snapshotMessage = toolResult("list_projects", SNAPSHOT);
const teamsMessage = toolResult("list_teams", TEAMS);
const usersMessage = toolResult("list_users", USERS);

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

describe("DeterministicChatAdapter — delete_task", () => {
  it("proposes delete_task for a snapshot-resolved task", async () => {
    const events = await run([user("delete task Rig assembly"), snapshotMessage]);
    expect(onlyToolCall(events)).toEqual({
      name: "delete_task",
      args: { programId: "prog-falcon", taskId: "task-rig" },
    });
  });

  it("requests list_projects first when there is no snapshot", async () => {
    const events = await run([user("delete task Rig assembly")]);
    expect(onlyToolCall(events)).toEqual({ name: "list_projects", args: {} });
  });

  it("falls back to a program-scoped search_tasks for 'in <project>'", async () => {
    const events = await run([user("delete task Ground station in Falcon"), snapshotMessage]);
    expect(onlyToolCall(events)).toEqual({
      name: "search_tasks",
      args: { text: "Ground station", programId: "prog-falcon" },
    });
  });

  it("proposes delete_task from a unique search_tasks fallback match", async () => {
    const events = await run([
      user("delete task Ground station"),
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
      name: "delete_task",
      args: { programId: "prog-falcon", taskId: "task-ground" },
    });
  });

  it("says it couldn't find an unknown project scope", async () => {
    const events = await run([user("delete task Rig assembly in Zeppelin"), snapshotMessage]);
    expect(onlyText(events)).toContain('"Zeppelin"');
    expect(events.some((e) => e.type === "tool_call")).toBe(false);
  });
});

describe("DeterministicChatAdapter — delete_project", () => {
  it("proposes delete_project for a snapshot-resolved project (EN)", async () => {
    const events = await run([user("delete project Falcon"), snapshotMessage]);
    expect(onlyToolCall(events)).toEqual({
      name: "delete_project",
      args: { programId: "prog-falcon" },
    });
  });

  it("requests list_projects first when there is no snapshot (AR)", async () => {
    const events = await run([user("احذف مشروع منصة التعاون")]);
    expect(onlyToolCall(events)).toEqual({ name: "list_projects", args: {} });
  });

  it("says it couldn't find an unknown project ref", async () => {
    const events = await run([user("delete project Zeppelin"), snapshotMessage]);
    expect(onlyText(events)).toContain('"Zeppelin"');
  });
});

describe("DeterministicChatAdapter — team membership", () => {
  it("requests list_teams when no team snapshot is in the history", async () => {
    const events = await run([user("add omar to team Field Crew")]);
    expect(onlyToolCall(events)).toEqual({ name: "list_teams", args: {} });
  });

  it("requests list_users before adding once the team resolves", async () => {
    const events = await run([user("add omar to team Field Crew"), teamsMessage]);
    expect(onlyToolCall(events)).toEqual({ name: "list_users", args: {} });
  });

  it("proposes add_team_member with the canonical username casing", async () => {
    const events = await run([user("add Omar to team field crew"), teamsMessage, usersMessage]);
    expect(onlyToolCall(events)).toEqual({
      name: "add_team_member",
      args: { teamId: "team-field", username: "omar" },
    });
  });

  it("resolves an Arabic team name for add (AR)", async () => {
    const events = await run([user("أضف omar إلى فريق التصميم"), teamsMessage, usersMessage]);
    expect(onlyToolCall(events)).toEqual({
      name: "add_team_member",
      args: { teamId: "team-design", username: "omar" },
    });
  });

  it("names an unknown username in the couldn't-find reply", async () => {
    const events = await run([user("add zorro to team Field Crew"), teamsMessage, usersMessage]);
    expect(onlyText(events)).toContain('"zorro"');
    expect(events.some((e) => e.type === "tool_call")).toBe(false);
  });

  it("names an unknown team in the couldn't-find reply", async () => {
    const events = await run([user("add omar to team Ghost Squad"), teamsMessage, usersMessage]);
    expect(onlyText(events)).toContain('"Ghost Squad"');
    expect(events.some((e) => e.type === "tool_call")).toBe(false);
  });

  it("proposes remove_team_member from the team's own member list (no list_users)", async () => {
    const events = await run([user("remove Sara from team Field Crew"), teamsMessage]);
    expect(onlyToolCall(events)).toEqual({
      name: "remove_team_member",
      args: { teamId: "team-field", username: "sara" },
    });
  });

  it("resolves an Arabic removal and names a non-member in the reply (AR)", async () => {
    const removed = await run([user("أزل jabbir من فريق التصميم"), teamsMessage]);
    expect(onlyToolCall(removed)).toEqual({
      name: "remove_team_member",
      args: { teamId: "team-design", username: "jabbir" },
    });
    const missing = await run([user("أزل sara من فريق التصميم"), teamsMessage]);
    expect(onlyText(missing)).toContain('"sara"');
    expect(missing.some((e) => e.type === "tool_call")).toBe(false);
  });
});

describe("DeterministicChatAdapter — add_subtask", () => {
  it("proposes add_subtask for a snapshot-resolved task with the quoted name stripped", async () => {
    const events = await run([user('add subtask "Check torque" to Rig assembly'), snapshotMessage]);
    expect(onlyToolCall(events)).toEqual({
      name: "add_subtask",
      args: { programId: "prog-falcon", taskId: "task-rig", name: "Check torque" },
    });
  });

  it("proposes add_subtask via the search_tasks fallback (AR)", async () => {
    const events = await run([
      user("أضف مهمة فرعية تدقيق الألوان إلى مراجعة الواجهة"),
      snapshotMessage,
      toolResult("search_tasks", [
        {
          programId: "prog-taawun",
          programName: "منصة التعاون",
          packageId: "pkg-design",
          packageName: "التصميم",
          id: "task-review",
          name: "مراجعة الواجهة",
          status: "todo",
        },
      ]),
    ]);
    expect(onlyToolCall(events)).toEqual({
      name: "add_subtask",
      args: { programId: "prog-taawun", taskId: "task-review", name: "تدقيق الألوان" },
    });
  });
});
