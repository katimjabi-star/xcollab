import { describe, expect, it } from "vitest";
import { z } from "zod";
import type { ChatEvent, ChatTurnRequest } from "../src/chat.ts";
import { SearchTasksArgsSchema } from "../src/chat-tools.ts";
import {
  AnthropicChatAdapter,
  buildMessagesRequestBody,
  parseMessagesStream,
} from "../src/adapters/anthropic-chat.ts";

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

const REQ: ChatTurnRequest = {
  system: "You are XCollab AI.",
  messages: [
    { role: "user", content: "what's blocked in Falcon?" },
    {
      role: "assistant",
      content: "",
      toolCalls: [{ id: "call_1", name: "list_projects", args: {} }],
    },
    { role: "tool_result", tool: "list_projects", content: "[]", toolCallId: "call_1" },
  ],
  tools: [
    { name: "search_tasks", description: "Search tasks.", argsSchema: SearchTasksArgsSchema },
  ],
};

describe("AnthropicChatAdapter — construction and request mapping", () => {
  it("refuses to construct without an API key", () => {
    expect(() => new AnthropicChatAdapter({ apiKey: "" })).toThrow(/api key/i);
  });

  it("defaults to the spec model and Anthropic base URL", () => {
    const adapter = new AnthropicChatAdapter({ apiKey: "k" });
    expect(adapter.modelId).toBe("claude-sonnet-5");
  });

  it("maps message history (incl. tool_result round-trip) and tools to native format", () => {
    const body = buildMessagesRequestBody("claude-sonnet-5", REQ, 2048);
    expect(body.model).toBe("claude-sonnet-5");
    expect(body.stream).toBe(true);
    expect(body.max_tokens).toBe(2048);
    expect(body.system).toBe(REQ.system);

    const messages = body.messages as Record<string, unknown>[];
    expect(messages[0]).toEqual({ role: "user", content: "what's blocked in Falcon?" });
    expect(messages[1]).toEqual({
      role: "assistant",
      content: [{ type: "tool_use", id: "call_1", name: "list_projects", input: {} }],
    });
    expect(messages[2]).toEqual({
      role: "user",
      content: [{ type: "tool_result", tool_use_id: "call_1", content: "[]" }],
    });

    const tools = body.tools as { name: string; description: string; input_schema: unknown }[];
    expect(tools).toHaveLength(1);
    expect(tools[0]?.name).toBe("search_tasks");
    const schema = z
      .object({ type: z.string(), properties: z.record(z.string(), z.unknown()) })
      .parse(tools[0]?.input_schema);
    expect(schema.type).toBe("object");
    expect(Object.keys(schema.properties)).toContain("programId");
  });

  it("includes assistant text alongside tool_use blocks when both are present", () => {
    const body = buildMessagesRequestBody(
      "claude-sonnet-5",
      {
        system: "",
        messages: [
          {
            role: "assistant",
            content: "Let me check.",
            toolCalls: [{ id: "call_2", name: "list_projects", args: { x: 1 } }],
          },
        ],
        tools: [],
      },
      2048,
    );
    const messages = body.messages as Record<string, unknown>[];
    expect(messages[0]).toEqual({
      role: "assistant",
      content: [
        { type: "text", text: "Let me check." },
        { type: "tool_use", id: "call_2", name: "list_projects", input: { x: 1 } },
      ],
    });
  });

  it("sends the key only in x-api-key, sets anthropic-version, and fails closed on non-200", async () => {
    let seenUrl = "";
    let seenInit: RequestInit | undefined;
    const adapter = new AnthropicChatAdapter({
      apiKey: "secret-key",
      fetchImpl: (url, init) => {
        seenUrl = url;
        seenInit = init;
        return Promise.resolve(new Response("payment required", { status: 402 }));
      },
    });
    await expect(collect(adapter.runTurn(REQ))).rejects.toThrow(/402/);
    expect(seenUrl).toBe("https://api.anthropic.com/v1/messages");
    const headers = seenInit?.headers as Record<string, string>;
    expect(headers["x-api-key"]).toBe("secret-key");
    expect(headers["anthropic-version"]).toBe("2023-06-01");
    expect(String(seenInit?.body)).not.toContain("secret-key");
  });

  it("forwards the abort signal to fetch when provided", async () => {
    const controller = new AbortController();
    let seenSignal: AbortSignal | undefined;
    const adapter = new AnthropicChatAdapter({
      apiKey: "k",
      fetchImpl: (_url, init) => {
        seenSignal = init?.signal ?? undefined;
        return Promise.resolve(
          new Response(streamOf('data: {"type":"message_stop"}\n\n'), { status: 200 }),
        );
      },
    });
    await collect(adapter.runTurn({ ...REQ, signal: controller.signal }));
    expect(seenSignal).toBe(controller.signal);
  });

  it("omits signal from the fetch init when the request carries none", async () => {
    let sawSignalKey = true;
    const adapter = new AnthropicChatAdapter({
      apiKey: "k",
      fetchImpl: (_url, init) => {
        sawSignalKey = init !== undefined && "signal" in init;
        return Promise.resolve(
          new Response(streamOf('data: {"type":"message_stop"}\n\n'), { status: 200 }),
        );
      },
    });
    await collect(adapter.runTurn(REQ));
    expect(sawSignalKey).toBe(false);
  });

  it("streams text from a mocked Messages response", async () => {
    const adapter = new AnthropicChatAdapter({
      apiKey: "k",
      fetchImpl: () =>
        Promise.resolve(
          new Response(
            streamOf(
              'data: {"type":"message_start","message":{"id":"m1"}}\n\n',
              'data: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}\n\n',
              'data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hi"}}\n\n',
              'data: {"type":"content_block_stop","index":0}\n\n',
              'data: {"type":"message_delta","delta":{"stop_reason":"end_turn"}}\n\n',
              'data: {"type":"message_stop"}\n\n',
            ),
            { status: 200 },
          ),
        ),
    });
    const events = await collect(adapter.runTurn(REQ));
    expect(events).toEqual([
      { type: "text_delta", text: "Hi" },
      { type: "finish", reason: "stop" },
    ]);
  });
});

describe("Anthropic Messages SSE stream parsing", () => {
  it("tolerates ping and message_start frames, still assembling text", async () => {
    const events = await collect(
      parseMessagesStream(
        streamOf(
          'data: {"type":"ping"}\n\n',
          'data: {"type":"message_start","message":{}}\n\n',
          'data: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}\n\n',
          'data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hel"}}\n\n',
          'data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"lo"}}\n\n',
          'data: {"type":"content_block_stop","index":0}\n\n',
          'data: {"type":"message_delta","delta":{"stop_reason":"end_turn"}}\n\n',
          'data: {"type":"message_stop"}\n\n',
        ),
      ),
    );
    expect(events).toEqual([
      { type: "text_delta", text: "Hel" },
      { type: "text_delta", text: "lo" },
      { type: "finish", reason: "stop" },
    ]);
  });

  it("skips unknown event types without dying", async () => {
    const events = await collect(
      parseMessagesStream(
        streamOf(
          'data: {"type":"some_future_event","whatever":true}\n\n',
          'data: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}\n\n',
          'data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"ok"}}\n\n',
          'data: {"type":"content_block_stop","index":0}\n\n',
          'data: {"type":"message_stop"}\n\n',
        ),
      ),
    );
    expect(events).toEqual([
      { type: "text_delta", text: "ok" },
      { type: "finish", reason: "stop" },
    ]);
  });

  it("assembles a tool_use block across multiple input_json_delta frames", async () => {
    const events = await collect(
      parseMessagesStream(
        streamOf(
          'data: {"type":"content_block_start","index":0,"content_block":{"type":"tool_use","id":"toolu_1","name":"search_tasks"}}\n\n',
          'data: {"type":"content_block_delta","index":0,"delta":{"type":"input_json_delta","partial_json":"{\\"program"}}\n\n',
          'data: {"type":"content_block_delta","index":0,"delta":{"type":"input_json_delta","partial_json":"Id\\":\\"p1\\"}"}}\n\n',
          'data: {"type":"content_block_stop","index":0}\n\n',
          'data: {"type":"message_delta","delta":{"stop_reason":"tool_use"}}\n\n',
          'data: {"type":"message_stop"}\n\n',
        ),
      ),
    );
    expect(events).toEqual([
      { type: "tool_call", id: "toolu_1", name: "search_tasks", args: { programId: "p1" } },
      { type: "finish", reason: "tool_calls" },
    ]);
  });

  it("surfaces malformed accumulated JSON as tool_call_invalid", async () => {
    const events = await collect(
      parseMessagesStream(
        streamOf(
          'data: {"type":"content_block_start","index":0,"content_block":{"type":"tool_use","id":"toolu_2","name":"search_tasks"}}\n\n',
          'data: {"type":"content_block_delta","index":0,"delta":{"type":"input_json_delta","partial_json":"{oops"}}\n\n',
          'data: {"type":"content_block_stop","index":0}\n\n',
          'data: {"type":"message_delta","delta":{"stop_reason":"tool_use"}}\n\n',
          'data: {"type":"message_stop"}\n\n',
        ),
      ),
    );
    expect(events[0]).toEqual({
      type: "tool_call_invalid",
      id: "toolu_2",
      name: "search_tasks",
      message: 'tool call "search_tasks" produced malformed JSON arguments',
    });
    expect(events[1]).toEqual({ type: "finish", reason: "tool_calls" });
  });

  it("treats an empty tool_use block as {} and maps max_tokens to length", async () => {
    const events = await collect(
      parseMessagesStream(
        streamOf(
          'data: {"type":"content_block_start","index":0,"content_block":{"type":"tool_use","id":"toolu_3","name":"list_projects"}}\n\n',
          'data: {"type":"content_block_stop","index":0}\n\n',
          'data: {"type":"message_delta","delta":{"stop_reason":"max_tokens"}}\n\n',
          'data: {"type":"message_stop"}\n\n',
        ),
      ),
    );
    expect(events).toEqual([
      { type: "tool_call", id: "toolu_3", name: "list_projects", args: {} },
      { type: "finish", reason: "length" },
    ]);
  });
});
