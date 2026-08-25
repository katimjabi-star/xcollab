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
 * Direct Anthropic Messages API adapter — spec §2.7. Named `anthropic-chat.ts`
 * (not `anthropic.ts`) to avoid colliding with the pre-existing
 * `AnthropicAdapter` (a `ModelAdapter` for program synthesis in `gateway.ts`,
 * unrelated to the ChatAdapter seam and depended on by existing exports/tests).
 * The API key arrives via the constructor from services/api boot code
 * (ANTHROPIC_API_KEY); it is never logged and never appears in errors/events.
 */

const DEFAULT_MODEL = "claude-sonnet-5";
const DEFAULT_BASE_URL = "https://api.anthropic.com";
const DEFAULT_MAX_TOKENS = 2048;
const ANTHROPIC_VERSION = "2023-06-01";

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export class AnthropicChatAdapter implements ChatAdapter {
  readonly id = "anthropic";
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
      throw new Error("AnthropicChatAdapter requires an API key (ANTHROPIC_API_KEY)");
    }
    this.apiKey = options.apiKey;
    this.modelId = options.modelId ?? DEFAULT_MODEL;
    this.baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
    this.maxTokens = options.maxTokens ?? DEFAULT_MAX_TOKENS;
    this.fetchImpl = options.fetchImpl ?? ((input, init) => fetch(input, init));
  }

  async *runTurn(req: ChatTurnRequest): AsyncGenerator<ChatEvent> {
    const response = await this.fetchImpl(`${this.baseUrl}/v1/messages`, {
      method: "POST",
      headers: {
        "x-api-key": this.apiKey,
        "anthropic-version": ANTHROPIC_VERSION,
        "content-type": "application/json",
      },
      body: JSON.stringify(buildMessagesRequestBody(this.modelId, req, this.maxTokens)),
      ...(req.signal === undefined ? {} : { signal: req.signal }),
    });
    if (!response.ok) {
      // Status only — response bodies can echo request details; the key must never leak.
      throw new Error(`anthropic request failed: ${response.status}`);
    }
    if (!response.body) throw new Error("anthropic response had no body");
    yield* parseMessagesStream(response.body);
  }
}

/** Tool definitions and full history are resent on every request (stateless API). */
export function buildMessagesRequestBody(
  modelId: string,
  req: ChatTurnRequest,
  maxTokens: number,
): Record<string, unknown> {
  return {
    model: modelId,
    stream: true,
    max_tokens: maxTokens,
    system: req.system,
    messages: toWireHistory(req.messages),
    tools: req.tools.map(toWireTool),
  };
}

type ToolResultMsg = Extract<ChatMessage, { role: "tool_result" }>;

/* Anthropic requires every tool_result block to reference a tool_use id in
   the immediately preceding assistant message, and consecutive results to
   arrive as blocks of ONE user turn. Loop-internal history carries real ids;
   client-replayed history (spec D6 wire format) carries neither toolCalls
   nor toolCallIds — normalize both here instead of 400ing. */
function toWireHistory(messages: ChatMessage[]): Record<string, unknown>[] {
  const wire: Record<string, unknown>[] = [];
  let i = 0;
  while (i < messages.length) {
    const message = messages[i];
    if (!message) break;
    if (message.role !== "tool_result") {
      wire.push(
        message.role === "user"
          ? { role: "user", content: message.content }
          : { role: "assistant", content: toAssistantBlocks(message) },
      );
      i += 1;
      continue;
    }
    const group: ToolResultMsg[] = [];
    while (i < messages.length) {
      const candidate = messages[i];
      if (!candidate || candidate.role !== "tool_result") break;
      group.push(candidate);
      i += 1;
    }
    wire.push(...toToolResultTurn(wire, group));
  }
  return wire;
}

/** One tool round: pair each result with a (possibly synthesized) tool_use. */
function toToolResultTurn(
  wire: Record<string, unknown>[],
  group: ToolResultMsg[],
): Record<string, unknown>[] {
  const prev = wire[wire.length - 1];
  const prevBlocks =
    prev !== undefined && prev["role"] === "assistant" && Array.isArray(prev["content"])
      ? (prev["content"] as Record<string, unknown>[])
      : null;
  const knownIds = new Set(
    (prevBlocks ?? [])
      .filter((block) => block["type"] === "tool_use")
      .map((block) => String(block["id"])),
  );
  const results: Record<string, unknown>[] = [];
  const synthetic: Record<string, unknown>[] = [];
  group.forEach((message, index) => {
    const id = message.toolCallId ?? `hist_${wire.length}_${index}`;
    if (!knownIds.has(id)) {
      synthetic.push({ type: "tool_use", id, name: message.tool, input: {} });
    }
    results.push({ type: "tool_result", tool_use_id: id, content: message.content });
  });
  const turn: Record<string, unknown>[] = [];
  if (synthetic.length > 0) {
    if (prevBlocks) prevBlocks.push(...synthetic);
    else turn.push({ role: "assistant", content: synthetic });
  }
  turn.push({ role: "user", content: results });
  return turn;
}

function toAssistantBlocks(
  message: Extract<ChatMessage, { role: "assistant" }>,
): Record<string, unknown>[] {
  const blocks: Record<string, unknown>[] = [];
  if (message.content.length > 0) blocks.push({ type: "text", text: message.content });
  for (const call of message.toolCalls ?? []) {
    blocks.push({ type: "tool_use", id: call.id, name: call.name, input: call.args });
  }
  return blocks;
}

function toWireTool(tool: ToolSpec): Record<string, unknown> {
  return {
    name: tool.name,
    description: tool.description,
    input_schema: z.toJSONSchema(tool.argsSchema),
  };
}

// ---------------------------------------------------------------------------
// SSE stream parsing (Anthropic Messages API event format)
// ---------------------------------------------------------------------------

const ContentBlockStartFrame = z.object({
  type: z.literal("content_block_start"),
  index: z.number().int(),
  content_block: z.object({
    type: z.string(),
    id: z.string().optional(),
    name: z.string().optional(),
  }),
});

const ContentBlockDeltaFrame = z.object({
  type: z.literal("content_block_delta"),
  index: z.number().int(),
  delta: z.union([
    z.object({ type: z.literal("text_delta"), text: z.string() }),
    z.object({ type: z.literal("input_json_delta"), partial_json: z.string() }),
  ]),
});

const ContentBlockStopFrame = z.object({
  type: z.literal("content_block_stop"),
  index: z.number().int(),
});

const MessageDeltaFrame = z.object({
  type: z.literal("message_delta"),
  delta: z.object({ stop_reason: z.string().nullable().optional() }),
});

type PendingBlock = { type: "text" } | { type: "tool_use"; id: string; name: string; args: string };

export async function* parseMessagesStream(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<ChatEvent> {
  const blocks = new Map<number, PendingBlock>();
  let stopReason: ChatFinishReason = "stop";

  for await (const raw of sseDataLines(body)) {
    const frame = parseJson(raw);
    const type = frameType(frame);
    if (type === "content_block_start") {
      handleBlockStart(frame, blocks);
    } else if (type === "content_block_delta") {
      yield* handleBlockDelta(frame, blocks);
    } else if (type === "content_block_stop") {
      yield* handleBlockStop(frame, blocks);
    } else if (type === "message_delta") {
      stopReason = mapStopReason(frame, stopReason);
    } else if (type === "message_stop") {
      yield { type: "finish", reason: stopReason };
      return;
    }
    // message_start, ping, error, and any other frame shape are tolerated.
  }
  // Stream ended without an explicit message_stop — still finish so callers don't hang.
  yield { type: "finish", reason: stopReason };
}

function frameType(frame: unknown): string | undefined {
  if (typeof frame !== "object" || frame === null) return undefined;
  const type = (frame as { type?: unknown }).type;
  return typeof type === "string" ? type : undefined;
}

function handleBlockStart(frame: unknown, blocks: Map<number, PendingBlock>): void {
  const parsed = ContentBlockStartFrame.safeParse(frame);
  if (!parsed.success) return;
  const { index, content_block: block } = parsed.data;
  blocks.set(
    index,
    block.type === "tool_use"
      ? { type: "tool_use", id: block.id ?? `toolu_${index}`, name: block.name ?? "", args: "" }
      : { type: "text" },
  );
}

function* handleBlockDelta(
  frame: unknown,
  blocks: Map<number, PendingBlock>,
): Generator<ChatEvent> {
  const parsed = ContentBlockDeltaFrame.safeParse(frame);
  if (!parsed.success) return;
  const { index, delta } = parsed.data;
  if (delta.type === "text_delta") {
    yield { type: "text_delta", text: delta.text };
    return;
  }
  const block = blocks.get(index);
  if (block?.type === "tool_use") block.args += delta.partial_json;
}

function* handleBlockStop(
  frame: unknown,
  blocks: Map<number, PendingBlock>,
): Generator<ChatEvent> {
  const parsed = ContentBlockStopFrame.safeParse(frame);
  if (!parsed.success) return;
  const block = blocks.get(parsed.data.index);
  blocks.delete(parsed.data.index);
  if (block?.type !== "tool_use") return;
  yield toToolCallEvent(block);
}

function toToolCallEvent(block: Extract<PendingBlock, { type: "tool_use" }>): ChatEvent {
  const raw = block.args.trim() === "" ? "{}" : block.args;
  const args = parseJson(raw);
  if (args === PARSE_FAILED) {
    // Malformed JSON args: surfaced as invalid so the loop can feed the error
    // back to the model for a self-corrected retry (spec §2.5).
    return {
      type: "tool_call_invalid",
      id: block.id,
      name: block.name,
      message: `tool call "${block.name}" produced malformed JSON arguments`,
    };
  }
  return { type: "tool_call", id: block.id, name: block.name, args };
}

function mapStopReason(frame: unknown, current: ChatFinishReason): ChatFinishReason {
  const parsed = MessageDeltaFrame.safeParse(frame);
  if (!parsed.success) return current;
  const reason = parsed.data.delta.stop_reason;
  if (reason === "max_tokens") return "length";
  if (reason === "tool_use") return "tool_calls";
  if (reason === "end_turn" || reason === "stop_sequence") return "stop";
  return current;
}

const PARSE_FAILED = Symbol("parse-failed");

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return PARSE_FAILED;
  }
}

/** Yields the payload of each `data:` line; `event:` lines and SSE `:` keepalive
    comments are ignored — Anthropic's payload always embeds its own `type`. */
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
