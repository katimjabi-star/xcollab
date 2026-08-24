import { describe, expect, it } from "vitest";
import { z } from "zod";
import type { ChatEvent, ChatTurnRequest } from "../src/chat.ts";
import { SearchTasksArgsSchema } from "../src/chat-tools.ts";
import {
  buildChatCompletionBody,
  OpenRouterChatAdapter,
  parseChatCompletionStream,
} from "../src/adapters/openrouter.ts";

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

describe("OpenRouterChatAdapter — construction and request mapping", () => {
  it("refuses to construct without an API key", () => {
    expect(() => new OpenRouterChatAdapter({ apiKey: "" })).toThrow(/api key/i);
  });

  it("defaults to the spec model and OpenRouter base URL", () => {
    const adapter = new OpenRouterChatAdapter({ apiKey: "k" });
    expect(adapter.modelId).toBe("anthropic/claude-sonnet-4.5");
  });

  it("maps messages, resends tools with JSON Schema params, and streams", () => {
    const body = buildChatCompletionBody("anthropic/claude-sonnet-4.5", REQ, 2048);
    expect(body.model).toBe("anthropic/claude-sonnet-4.5");
    expect(body.stream).toBe(true);
    expect(body.tool_choice).toBe("auto");
    expect(body.max_tokens).toBe(2048);

    const messages = body.messages as Record<string, unknown>[];
    expect(messages[0]).toEqual({ role: "system", content: REQ.system });
    expect(messages[1]).toEqual({ role: "user", content: "what's blocked in Falcon?" });
    expect(messages[2]).toEqual({
      role: "assistant",
      content: "",
      tool_calls: [
        { id: "call_1", type: "function", function: { name: "list_projects", arguments: "{}" } },
      ],
    });
    expect(messages[3]).toEqual({ role: "tool", tool_call_id: "call_1", content: "[]" });

    const tools = body.tools as { type: string; function: Record<string, unknown> }[];
    expect(tools).toHaveLength(1);
    expect(tools[0]?.type).toBe("function");
    expect(tools[0]?.function.name).toBe("search_tasks");
    const params = z
      .object({ type: z.string(), properties: z.record(z.string(), z.unknown()) })
      .parse(tools[0]?.function.parameters);
    expect(params.type).toBe("object");
    expect(Object.keys(params.properties)).toContain("programId");
  });

  it("sends the key only in the authorization header and fails closed on non-200", async () => {
    let seenUrl = "";
    let seenInit: RequestInit | undefined;
    const adapter = new OpenRouterChatAdapter({
      apiKey: "secret-key",
      fetchImpl: (url, init) => {
        seenUrl = url;
        seenInit = init;
        return Promise.resolve(new Response("payment required", { status: 402 }));
      },
    });
    await expect(collect(adapter.runTurn(REQ))).rejects.toThrow(/402/);
    expect(seenUrl).toBe("https://openrouter.ai/api/v1/chat/completions");
    const headers = seenInit?.headers as Record<string, string>;
    expect(headers.authorization).toBe("Bearer secret-key");
    expect(String(seenInit?.body)).not.toContain("secret-key");
  });

  it("streams events from a mocked completion response", async () => {
    const adapter = new OpenRouterChatAdapter({
      apiKey: "k",
      fetchImpl: () =>
        Promise.resolve(
          new Response(
            streamOf(
              'data: {"choices":[{"delta":{"content":"Hi"}}]}\n\n',
              "data: [DONE]\n\n",
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

describe("OpenRouter SSE stream parsing", () => {
  it("yields text deltas, ignores keepalive comments, buffers split chunks", async () => {
    const events = await collect(
      parseChatCompletionStream(
        streamOf(
          ": OPENROUTER PROCESSING\n\n",
          'data: {"choices":[{"delta":{"content":"Hel',
          'lo"}}]}\n\ndata: {"choices":[{"delta":{"content":" world"},"finish_reason":"stop"}]}\n\n',
          "data: [DONE]\n\n",
        ),
      ),
    );
    expect(events).toEqual([
      { type: "text_delta", text: "Hello" },
      { type: "text_delta", text: " world" },
      { type: "finish", reason: "stop" },
    ]);
  });

  it("assembles incremental tool_calls deltas into one parsed call", async () => {
    const events = await collect(
      parseChatCompletionStream(
        streamOf(
          'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_9","function":{"name":"search_tasks","arguments":"{\\"program"}}]}}]}\n\n',
          'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"Id\\":\\"p1\\"}"}}]},"finish_reason":"tool_calls"}]}\n\n',
          "data: [DONE]\n\n",
        ),
      ),
    );
    expect(events).toEqual([
      { type: "tool_call", id: "call_9", name: "search_tasks", args: { programId: "p1" } },
      { type: "finish", reason: "tool_calls" },
    ]);
  });

  it("surfaces malformed JSON tool args as tool_call_invalid for the retry path", async () => {
    const events = await collect(
      parseChatCompletionStream(
        streamOf(
          'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_2","function":{"name":"search_tasks","arguments":"{oops"}}]},"finish_reason":"tool_calls"}]}\n\n',
          "data: [DONE]\n\n",
        ),
      ),
    );
    expect(events[0]).toEqual({
      type: "tool_call_invalid",
      id: "call_2",
      name: "search_tasks",
      message: 'tool call "search_tasks" produced malformed JSON arguments',
    });
    expect(events[1]).toEqual({ type: "finish", reason: "tool_calls" });
  });

  it("treats empty tool args as {} and maps length finishes", async () => {
    const events = await collect(
      parseChatCompletionStream(
        streamOf(
          'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"c1","function":{"name":"list_projects"}}]}}]}\n\n',
          'data: {"choices":[{"delta":{},"finish_reason":"length"}]}\n\n',
          "data: [DONE]\n\n",
        ),
      ),
    );
    expect(events).toEqual([
      { type: "tool_call", id: "c1", name: "list_projects", args: {} },
      { type: "finish", reason: "length" },
    ]);
  });

  it("skips unparseable frames without dying", async () => {
    const events = await collect(
      parseChatCompletionStream(
        streamOf(
          "data: not-json\n\n",
          'data: {"choices":[{"delta":{"content":"ok"},"finish_reason":"stop"}]}\n\n',
          "data: [DONE]\n\n",
        ),
      ),
    );
    expect(events).toEqual([
      { type: "text_delta", text: "ok" },
      { type: "finish", reason: "stop" },
    ]);
  });
});
