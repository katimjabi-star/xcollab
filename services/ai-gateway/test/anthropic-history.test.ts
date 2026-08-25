import { describe, expect, it } from "vitest";
import { buildMessagesRequestBody } from "../src/adapters/anthropic-chat.ts";
import type { ChatTurnRequest } from "../src/chat.ts";

/* Client-replayed history (spec D6 wire format) arrives WITHOUT assistant
   toolCalls and WITHOUT toolCallIds. Anthropic rejects tool_result blocks
   whose id has no matching tool_use in the preceding assistant message —
   the adapter must synthesize the pairs instead of 400ing (live defect:
   every multi-turn Claude conversation degraded to the deterministic
   fallback). */

const request = (messages: ChatTurnRequest["messages"]): ChatTurnRequest => ({
  system: "You are XCollab AI.",
  messages,
  tools: [],
});

describe("Anthropic history normalization", () => {
  it("synthesizes tool_use pairs for orphan tool_results (client replay shape)", () => {
    const body = buildMessagesRequestBody(
      "claude-haiku-4-5",
      request([
        { role: "user", content: "what should we focus on?" },
        { role: "assistant", content: "Let me check." },
        { role: "tool_result", tool: "list_projects", content: "[]" },
        { role: "user", content: "yes go ahead" },
      ]),
      1024,
    );
    const messages = body.messages as Record<string, unknown>[];
    // the synthetic tool_use is appended to the existing assistant message
    const assistant = messages[1] as { role: string; content: { type: string; id?: string; name?: string }[] };
    expect(assistant.role).toBe("assistant");
    expect(assistant.content[0]?.type).toBe("text");
    const toolUse = assistant.content[1];
    expect(toolUse?.type).toBe("tool_use");
    expect(toolUse?.name).toBe("list_projects");
    const result = messages[2] as { role: string; content: { type: string; tool_use_id: string }[] };
    expect(result.role).toBe("user");
    expect(result.content[0]?.tool_use_id).toBe(toolUse?.id);
    expect(messages[3]).toEqual({ role: "user", content: "yes go ahead" });
  });

  it("groups consecutive tool_results into one user turn with matched ids", () => {
    const body = buildMessagesRequestBody(
      "claude-haiku-4-5",
      request([
        { role: "user", content: "status?" },
        {
          role: "assistant",
          content: "",
          toolCalls: [
            { id: "call_a", name: "list_projects", args: {} },
            { id: "call_b", name: "search_tasks", args: { overdue: true } },
          ],
        },
        { role: "tool_result", tool: "list_projects", toolCallId: "call_a", content: "[]" },
        { role: "tool_result", tool: "search_tasks", toolCallId: "call_b", content: "[]" },
      ]),
      1024,
    );
    const messages = body.messages as Record<string, unknown>[];
    expect(messages).toHaveLength(3);
    const results = messages[2] as { role: string; content: { tool_use_id: string }[] };
    expect(results.role).toBe("user");
    expect(results.content.map((block) => block.tool_use_id)).toEqual(["call_a", "call_b"]);
  });
});
