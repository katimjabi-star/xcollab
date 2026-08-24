import { describe, expect, it } from "vitest";
import type { AssistantEvent } from "../lib/api-assistant.ts";
import {
  appendResult,
  appendUser,
  applyEvent,
  setProposalState,
  toWireMessages,
  type ChatMessage,
} from "../lib/assistant-transcript.ts";

const fold = (list: ChatMessage[], events: AssistantEvent[]): ChatMessage[] =>
  events.reduce(applyEvent, list);

describe("assistant transcript reducer", () => {
  it("accumulates text deltas into one streaming bubble and seals it on done", () => {
    let list = appendUser([], "hi");
    list = fold(list, [
      { type: "text_delta", text: "Hel" },
      { type: "text_delta", text: "lo" },
    ]);
    expect(list).toHaveLength(2);
    expect(list[1]).toMatchObject({ kind: "assistant", text: "Hello", streaming: true });
    list = applyEvent(list, { type: "done", finishReason: "stop" });
    expect(list[1]).toMatchObject({ streaming: false });
  });

  it("pairs tool_started with its tool_result", () => {
    let list = fold([], [{ type: "tool_started", tool: "search_tasks", argsSummary: "mine" }]);
    expect(list[0]).toMatchObject({ kind: "tool", done: false });
    list = applyEvent(list, { type: "tool_result", tool: "search_tasks", result: { tasks: [1] } });
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ kind: "tool", done: true, result: { tasks: [1] } });
  });

  it("records a proposal as pending and closes any streaming bubble", () => {
    const list = fold([], [
      { type: "text_delta", text: "Creating…" },
      { type: "proposal", proposalId: "p-1", tool: "create_task", args: { name: "X" } },
    ]);
    expect(list[0]).toMatchObject({ kind: "assistant", streaming: false });
    expect(list[1]).toMatchObject({ kind: "proposal", state: "pending", proposalId: "p-1" });
  });

  it("replaces an executed proposal with a result card", () => {
    let list = fold([], [
      { type: "proposal", proposalId: "p-1", tool: "create_task", args: { name: "X" } },
    ]);
    list = setProposalState(list, "p-1", "executing");
    list = appendResult(list, "p-1", "create_task", {
      result: {
        program: { id: "prog-1", name: "Rollout" } as never,
        task: { id: "task-9", name: "X" } as never,
        ledgerSeq: 42,
      },
      message: "Created X",
    });
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({
      kind: "result",
      programId: "prog-1",
      taskId: "task-9",
      ledgerSeq: 42,
    });
  });

  it("keeps a cancelled proposal and tells the model on the wire", () => {
    let list = appendUser([], "add a task");
    list = applyEvent(list, {
      type: "proposal",
      proposalId: "p-2",
      tool: "create_task",
      args: { name: "Y" },
    });
    list = setProposalState(list, "p-2", "cancelled");
    const wire = toWireMessages(list);
    expect(wire).toEqual([
      { role: "user", content: "add a task" },
      { role: "tool_result", tool: "create_task", resultDigest: "proposal cancelled by the user" },
    ]);
  });

  it("maps errors to an error message without a wire entry", () => {
    const list = applyEvent([], { type: "error", code: "budget_exhausted", message: "Too long" });
    expect(list[0]).toMatchObject({ kind: "error", code: "budget_exhausted" });
    expect(toWireMessages(list)).toEqual([]);
  });

  it("caps the wire transcript at 40 entries", () => {
    let list: ChatMessage[] = [];
    for (let i = 0; i < 50; i += 1) list = appendUser(list, `msg ${String(i)}`);
    const wire = toWireMessages(list);
    expect(wire).toHaveLength(40);
    expect(wire[0]).toEqual({ role: "user", content: "msg 10" });
  });

  it("truncates long tool result digests", () => {
    const list = fold([], [
      { type: "tool_result", tool: "get_project", result: { blob: "x".repeat(1000) } },
    ]);
    const wire = toWireMessages(list);
    expect(wire[0]?.role).toBe("tool_result");
    const digest = wire[0]?.role === "tool_result" ? wire[0].resultDigest : "";
    expect(digest.length).toBeLessThanOrEqual(301);
  });
});
