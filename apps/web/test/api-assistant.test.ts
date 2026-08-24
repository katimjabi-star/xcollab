import { describe, expect, it } from "vitest";
import { createSseDecoder, type AssistantEvent } from "../lib/api-assistant.ts";

const frame = (payload: object): string => `data: ${JSON.stringify(payload)}\n\n`;

describe("assistant SSE decoder", () => {
  it("decodes a complete event frame", () => {
    const decoder = createSseDecoder();
    const events = decoder.push(frame({ type: "text_delta", text: "Hello" }));
    expect(events).toEqual([{ type: "text_delta", text: "Hello" }]);
  });

  it("holds partial frames across chunk boundaries", () => {
    const decoder = createSseDecoder();
    const whole = frame({ type: "text_delta", text: "split across chunks" });
    const events = [
      ...decoder.push(whole.slice(0, 12)),
      ...decoder.push(whole.slice(12, 30)),
      ...decoder.push(whole.slice(30)),
    ];
    expect(events).toEqual([{ type: "text_delta", text: "split across chunks" }]);
  });

  it("decodes multiple events arriving in one chunk", () => {
    const decoder = createSseDecoder();
    const events = decoder.push(
      frame({ type: "tool_started", tool: "search_tasks", argsSummary: "overdue" }) +
        frame({ type: "tool_result", tool: "search_tasks", result: { tasks: [] } }) +
        frame({ type: "done", finishReason: "stop" }),
    );
    expect(events.map((e) => e.type)).toEqual(["tool_started", "tool_result", "done"]);
  });

  it("skips keepalive comments and malformed frames", () => {
    const decoder = createSseDecoder();
    const events = [
      ...decoder.push(": keepalive\n\n"),
      ...decoder.push("data: {not json\n\n"),
      ...decoder.push(frame({ type: "done", finishReason: "proposal" })),
    ];
    expect(events).toEqual([{ type: "done", finishReason: "proposal" }]);
  });

  it("decodes a proposal event with args intact", () => {
    const decoder = createSseDecoder();
    const proposal: AssistantEvent = {
      type: "proposal",
      proposalId: "p-1",
      tool: "create_task",
      args: { programId: "prog-1", packageId: "pkg-1", name: "Field kit audit" },
    };
    expect(decoder.push(frame(proposal))).toEqual([proposal]);
  });
});
