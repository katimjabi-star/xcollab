import { describe, expect, it } from "vitest";
import type { ChatEvent, ChatMessage, ChatTurnRequest } from "../src/chat.ts";
import {
  DEFAULT_COMPLEX_MODEL,
  DEFAULT_SIMPLE_MODEL,
  ModelRoutingAdapter,
  createAnthropicAdapter,
  isComplexTurn,
} from "../src/adapters/anthropic-router.ts";

function streamOf(...chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
}

async function collect(iterable: AsyncIterable<ChatEvent>): Promise<ChatEvent[]> {
  const events: ChatEvent[] = [];
  for await (const event of iterable) events.push(event);
  return events;
}

const messagesOf = (...messages: ChatMessage[]): Pick<ChatTurnRequest, "messages"> => ({
  messages,
});

describe("isComplexTurn — routing heuristic (pure)", () => {
  it("routes a short English message to the simple model", () => {
    expect(isComplexTurn(messagesOf({ role: "user", content: "what's blocked?" }))).toBe(false);
  });

  it("routes a long Arabic summarization request to the complex model", () => {
    const arabic = "لخص حالة كل المشاريع النشطة هذا الأسبوع مع تفاصيل إضافية ".repeat(8);
    expect(arabic.length).toBeGreaterThan(400);
    expect(isComplexTurn(messagesOf({ role: "user", content: arabic }))).toBe(true);
  });

  it("routes a multi-step continuation (tool results already present) to the complex model", () => {
    const req = messagesOf(
      { role: "user", content: "show my tasks" },
      {
        role: "assistant",
        content: "",
        toolCalls: [{ id: "c1", name: "search_tasks", args: {} }],
      },
      { role: "tool_result", tool: "search_tasks", content: "[]", toolCallId: "c1" },
      { role: "user", content: "ok" },
    );
    expect(isComplexTurn(req)).toBe(true);
  });

  it("routes a message over the length threshold to the complex model", () => {
    const long = "a".repeat(401);
    expect(isComplexTurn(messagesOf({ role: "user", content: long }))).toBe(true);
  });

  it("routes a message at or under the length threshold to the simple model", () => {
    const atThreshold = "a".repeat(400);
    expect(isComplexTurn(messagesOf({ role: "user", content: atThreshold }))).toBe(false);
  });

  it.each(["summarize", "summarise", "how is", "analyze", "analyse", "report", "compare", "لخص"])(
    "routes intent keyword %j to the complex model",
    (keyword) => {
      expect(isComplexTurn(messagesOf({ role: "user", content: `please ${keyword} this` }))).toBe(
        true,
      );
    },
  );

  it("ignores earlier user messages and looks only at the latest one", () => {
    const req = messagesOf(
      { role: "user", content: "summarize the program" },
      { role: "assistant", content: "Sure, one moment." },
      { role: "user", content: "actually never mind" },
    );
    expect(isComplexTurn(req)).toBe(false);
  });

  it("returns false when there is no user message at all", () => {
    expect(isComplexTurn(messagesOf({ role: "assistant", content: "hello" }))).toBe(false);
  });
});

const TOOLS: ChatTurnRequest["tools"] = [];

function jsonResponse(): Response {
  return new Response(
    streamOf(
      'data: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}\n\n',
      'data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"ok"}}\n\n',
      'data: {"type":"content_block_stop","index":0}\n\n',
      'data: {"type":"message_delta","delta":{"stop_reason":"end_turn"}}\n\n',
      'data: {"type":"message_stop"}\n\n',
    ),
    { status: 200 },
  );
}

describe("ModelRoutingAdapter / createAnthropicAdapter", () => {
  it("defaults to haiku for simple turns and sonnet for complex turns", async () => {
    const seenModels: string[] = [];
    const adapter = createAnthropicAdapter({
      apiKey: "k",
      fetchImpl: (_url, init) => {
        const body = JSON.parse(String(init?.body)) as { model: string };
        seenModels.push(body.model);
        return Promise.resolve(jsonResponse());
      },
    });

    await collect(
      adapter.runTurn({ system: "", messages: [{ role: "user", content: "hi" }], tools: TOOLS }),
    );
    await collect(
      adapter.runTurn({
        system: "",
        messages: [{ role: "user", content: "please summarize the program" }],
        tools: TOOLS,
      }),
    );

    expect(seenModels).toEqual([DEFAULT_SIMPLE_MODEL, DEFAULT_COMPLEX_MODEL]);
  });

  it("honors overridden simple/complex model ids", async () => {
    const seenModels: string[] = [];
    const adapter = new ModelRoutingAdapter({
      apiKey: "k",
      simpleModel: "custom-haiku",
      complexModel: "custom-sonnet",
      fetchImpl: (_url, init) => {
        const body = JSON.parse(String(init?.body)) as { model: string };
        seenModels.push(body.model);
        return Promise.resolve(jsonResponse());
      },
    });

    await collect(
      adapter.runTurn({ system: "", messages: [{ role: "user", content: "hi" }], tools: TOOLS }),
    );
    expect(seenModels).toEqual(["custom-haiku"]);
    expect(adapter.modelId).toBe("custom-haiku");
  });

  it("stamps the chosen model id onto the finish event for the ledger", async () => {
    const adapter = new ModelRoutingAdapter({ apiKey: "k", fetchImpl: () => Promise.resolve(jsonResponse()) });
    const events = await collect(
      adapter.runTurn({
        system: "",
        messages: [{ role: "user", content: "compare these two projects" }],
        tools: TOOLS,
      }),
    );
    expect(events.at(-1)).toEqual({
      type: "finish",
      reason: "stop",
      modelId: DEFAULT_COMPLEX_MODEL,
    });
  });
});
