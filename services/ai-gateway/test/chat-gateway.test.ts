import { describe, expect, it } from "vitest";
import { ChatGateway, ChatTurnError, type ChatAdapter, type ChatEvent } from "../src/chat.ts";
import { ASSISTANT_TOOLS } from "../src/chat-tools.ts";
import { createChatGateway } from "../src/chat-factory.ts";
import { DeterministicChatAdapter } from "../src/adapters/deterministic-chat.ts";

async function collect(iterable: AsyncIterable<ChatEvent>): Promise<ChatEvent[]> {
  const events: ChatEvent[] = [];
  for await (const event of iterable) events.push(event);
  return events;
}

function scripted(id: string, events: ChatEvent[], failAfter?: number): ChatAdapter {
  return {
    id,
    modelId: `${id}-model`,
    async *runTurn() {
      let emitted = 0;
      for (const event of events) {
        if (failAfter !== undefined && emitted >= failAfter) {
          throw new Error(`${id} upstream failure`);
        }
        yield event;
        emitted += 1;
      }
      await Promise.resolve();
    },
  };
}

const req = (content: string) => ({
  system: "",
  messages: [{ role: "user" as const, content }],
  tools: [...ASSISTANT_TOOLS],
});

describe("ChatGateway — seam validation (no call reaches the caller unvalidated)", () => {
  it("passes schema-valid tool calls through with parsed args, stripping unknown keys", async () => {
    const adapter = scripted("fake", [
      {
        type: "tool_call",
        id: "c1",
        name: "search_tasks",
        args: { assignee: "me", overdue: true, hallucinated: "field" },
      },
      { type: "finish", reason: "tool_calls" },
    ]);
    const events = await collect(new ChatGateway([adapter]).runTurn(req("x")));
    expect(events[0]).toEqual({
      type: "tool_call",
      id: "c1",
      name: "search_tasks",
      args: { assignee: "me", overdue: true },
    });
  });

  it("converts schema-invalid args into tool_call_invalid with the zod message", async () => {
    const adapter = scripted("fake", [
      { type: "tool_call", id: "c1", name: "update_task", args: { programId: "p1" } },
      { type: "finish", reason: "tool_calls" },
    ]);
    const events = await collect(new ChatGateway([adapter]).runTurn(req("x")));
    expect(events[0]).toMatchObject({
      type: "tool_call_invalid",
      id: "c1",
      name: "update_task",
    });
    expect((events[0] as { message: string }).message).toMatch(/invalid args/);
  });

  it("rejects calls to tools that are not in the registry", async () => {
    const adapter = scripted("fake", [
      { type: "tool_call", id: "c1", name: "purge_workspace", args: { taskId: "t1" } },
      { type: "finish", reason: "tool_calls" },
    ]);
    const events = await collect(new ChatGateway([adapter]).runTurn(req("x")));
    expect(events[0]).toEqual({
      type: "tool_call_invalid",
      id: "c1",
      name: "purge_workspace",
      message: 'unknown tool "purge_workspace"',
    });
  });
});

describe("ChatGateway — degrade to the deterministic adapter", () => {
  it("degrades the turn when the primary fails mid-stream and says so", async () => {
    const flaky = scripted(
      "flaky",
      [
        { type: "text_delta", text: "partial" },
        { type: "finish", reason: "stop" },
      ],
      1,
    );
    const gateway = new ChatGateway([flaky, new DeterministicChatAdapter({ today: "2026-08-24" })]);
    const events = await collect(gateway.runTurn(req("show my overdue tasks")));
    expect(events).toContainEqual({ type: "degraded", from: "flaky", to: "deterministic" });
    expect(events).toContainEqual({
      type: "tool_call",
      id: "det-1",
      name: "search_tasks",
      args: { assignee: "me", overdue: true },
    });
    expect(events.at(-1)).toEqual({ type: "finish", reason: "tool_calls" });
  });

  it("throws a typed ChatTurnError when the last adapter fails", async () => {
    const gateway = new ChatGateway([
      scripted("flaky", [{ type: "text_delta", text: "never sent" }], 0),
    ]);
    await expect(collect(gateway.runTurn(req("x")))).rejects.toBeInstanceOf(ChatTurnError);
  });

  it("refuses to construct with no adapters", () => {
    expect(() => new ChatGateway([])).toThrow(/at least one adapter/);
  });
});

describe("createChatGateway — boot-time adapter selection", () => {
  it("is deterministic-only without an OpenRouter key (air-gapped path)", () => {
    const gateway = createChatGateway({});
    expect(gateway.primary.id).toBe("deterministic");
    expect(gateway.primary.modelId).toBe("deterministic-intent-parser");
  });

  it("prefers OpenRouter when a key is supplied, deterministic as fallback", () => {
    const gateway = createChatGateway({ openRouterApiKey: "k", openRouterModelId: "m/x" });
    expect(gateway.primary.id).toBe("openrouter");
    expect(gateway.primary.modelId).toBe("m/x");
  });

  it("prefers Anthropic when its key is supplied, defaulting to the cheap model", () => {
    const gateway = createChatGateway({ anthropicApiKey: "k" });
    expect(gateway.primary.id).toBe("anthropic");
    expect(gateway.primary.modelId).toBe("claude-haiku-4-5");
  });

  it("prefers Anthropic over OpenRouter when both keys are supplied", () => {
    const gateway = createChatGateway({ anthropicApiKey: "k", openRouterApiKey: "k2" });
    expect(gateway.primary.id).toBe("anthropic");
  });

  it("honors overridden Anthropic simple/complex model ids", () => {
    const gateway = createChatGateway({
      anthropicApiKey: "k",
      anthropicSimpleModel: "custom-haiku",
      anthropicComplexModel: "custom-sonnet",
    });
    expect(gateway.primary.modelId).toBe("custom-haiku");
  });
});
