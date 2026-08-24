import { z } from "zod";
import type {
  ChatAdapter,
  ChatEvent,
  ChatFinishReason,
  ChatMessage,
  ChatTurnRequest,
  ToolSpec,
} from "../chat.ts";

/**
 * OpenAI-compatible chat completions with streaming tool calling against
 * OpenRouter — spec §2.7. The API key arrives via the constructor from
 * services/api boot code (OPENROUTER_API_KEY in services/api/.env.local);
 * it is never logged and never appears in errors or events.
 */

const DEFAULT_MODEL = "anthropic/claude-sonnet-4.5";
const DEFAULT_BASE_URL = "https://openrouter.ai/api/v1";
const DEFAULT_MAX_TOKENS = 2048;

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export class OpenRouterChatAdapter implements ChatAdapter {
  readonly id = "openrouter";
  readonly modelId: string;
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly maxTokens: number;
  private readonly fetchImpl: FetchLike;

  constructor(options: {
    apiKey: string;
    modelId?: string;
    baseUrl?: string;
    maxTokens?: number;
    fetchImpl?: FetchLike;
  }) {
    if (!options.apiKey) {
      throw new Error("OpenRouterChatAdapter requires an API key (OPENROUTER_API_KEY)");
    }
    this.apiKey = options.apiKey;
    this.modelId = options.modelId ?? DEFAULT_MODEL;
    this.baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
    this.maxTokens = options.maxTokens ?? DEFAULT_MAX_TOKENS;
    this.fetchImpl = options.fetchImpl ?? ((input, init) => fetch(input, init));
  }

  async *runTurn(req: ChatTurnRequest): AsyncGenerator<ChatEvent> {
    const response = await this.fetchImpl(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(buildChatCompletionBody(this.modelId, req, this.maxTokens)),
      ...(req.signal === undefined ? {} : { signal: req.signal }),
    });
    if (!response.ok) {
      // Status only — response bodies can echo request details; the key must never leak.
      throw new Error(`openrouter request failed: ${response.status}`);
    }
    if (!response.body) throw new Error("openrouter response had no body");
    yield* parseChatCompletionStream(response.body);
  }
}

/** Tool definitions are resent on EVERY request (OpenRouter follow-up rule). */
export function buildChatCompletionBody(
  modelId: string,
  req: ChatTurnRequest,
  maxTokens: number,
): Record<string, unknown> {
  return {
    model: modelId,
    stream: true,
    max_tokens: maxTokens,
    messages: [{ role: "system", content: req.system }, ...req.messages.map(toWireMessage)],
    tools: req.tools.map((tool) => toWireTool(tool)),
    tool_choice: "auto",
  };
}

function toWireMessage(message: ChatMessage): Record<string, unknown> {
  if (message.role === "user") return { role: "user", content: message.content };
  if (message.role === "assistant") {
    const toolCalls = message.toolCalls?.map((call) => ({
      id: call.id,
      type: "function",
      function: { name: call.name, arguments: JSON.stringify(call.args) },
    }));
    return {
      role: "assistant",
      content: message.content,
      ...(toolCalls === undefined || toolCalls.length === 0 ? {} : { tool_calls: toolCalls }),
    };
  }
  return {
    role: "tool",
    tool_call_id: message.toolCallId ?? message.tool,
    content: message.content,
  };
}

function toWireTool(tool: ToolSpec): Record<string, unknown> {
  return {
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: z.toJSONSchema(tool.argsSchema),
    },
  };
}

// ---------------------------------------------------------------------------
// SSE stream parsing (OpenAI chat.completion.chunk format)
// ---------------------------------------------------------------------------

const StreamChunkSchema = z.object({
  choices: z
    .array(
      z.object({
        delta: z
          .object({
            content: z.string().nullable().optional(),
            tool_calls: z
              .array(
                z.object({
                  index: z.number().int(),
                  id: z.string().optional(),
                  function: z
                    .object({
                      name: z.string().optional(),
                      arguments: z.string().optional(),
                    })
                    .optional(),
                }),
              )
              .optional(),
          })
          .optional(),
        finish_reason: z.string().nullable().optional(),
      }),
    )
    .default([]),
});

interface PendingToolCall {
  id: string;
  name: string;
  args: string;
}

type StreamChoice = NonNullable<z.infer<typeof StreamChunkSchema>["choices"][number]>;

export async function* parseChatCompletionStream(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<ChatEvent> {
  const pending = new Map<number, PendingToolCall>();
  let finishReason: ChatFinishReason = "stop";
  let sawToolCalls = false;

  for await (const data of sseDataLines(body)) {
    if (data === "[DONE]") break;
    const choice = parseChoice(data);
    if (!choice) continue;
    const text = choice.delta?.content;
    if (typeof text === "string" && text.length > 0) yield { type: "text_delta", text };
    sawToolCalls = accumulateToolCalls(choice, pending) || sawToolCalls;
    finishReason = mapFinishReason(choice.finish_reason, finishReason);
  }

  // Tool-call args are only complete once the stream ends; emit them here.
  for (const [index, entry] of [...pending.entries()].sort(([a], [b]) => a - b)) {
    yield toToolCallEvent(index, entry);
  }
  if (sawToolCalls && finishReason === "stop") finishReason = "tool_calls";
  yield { type: "finish", reason: finishReason };
}

/** Unknown frame shapes (e.g. usage-only chunks) parse to undefined and are skipped. */
function parseChoice(data: string): StreamChoice | undefined {
  const chunk = StreamChunkSchema.safeParse(parseJson(data));
  return chunk.success ? chunk.data.choices[0] : undefined;
}

function accumulateToolCalls(
  choice: StreamChoice,
  pending: Map<number, PendingToolCall>,
): boolean {
  const deltas = choice.delta?.tool_calls ?? [];
  for (const delta of deltas) {
    const entry = pending.get(delta.index) ?? { id: "", name: "", args: "" };
    if (delta.id !== undefined) entry.id = delta.id;
    if (delta.function?.name !== undefined) entry.name += delta.function.name;
    if (delta.function?.arguments !== undefined) entry.args += delta.function.arguments;
    pending.set(delta.index, entry);
  }
  return deltas.length > 0;
}

function mapFinishReason(
  raw: string | null | undefined,
  current: ChatFinishReason,
): ChatFinishReason {
  if (raw === "length") return "length";
  if (raw === "tool_calls") return "tool_calls";
  return current;
}

function toToolCallEvent(index: number, entry: PendingToolCall): ChatEvent {
  const id = entry.id || `call_${index}`;
  const raw = entry.args.trim() === "" ? "{}" : entry.args;
  const args = parseJson(raw);
  if (args === PARSE_FAILED) {
    // Malformed JSON args: surfaced as invalid so the loop can feed the error
    // back to the model for a self-corrected retry (spec §2.5).
    return {
      type: "tool_call_invalid",
      id,
      name: entry.name,
      message: `tool call "${entry.name}" produced malformed JSON arguments`,
    };
  }
  return { type: "tool_call", id, name: entry.name, args };
}

const PARSE_FAILED = Symbol("parse-failed");

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return PARSE_FAILED;
  }
}

/** Yields the payload of each `data:` line; SSE `:` keepalive comments are ignored. */
async function* sseDataLines(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const decoder = new TextDecoder();
  const reader = body.getReader();
  let buffer = "";
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (line.startsWith("data:")) yield line.slice(5).trim();
      }
    }
    if (buffer.startsWith("data:")) yield buffer.slice(5).trim();
  } finally {
    reader.releaseLock();
  }
}
