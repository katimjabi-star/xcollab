import type { z } from "zod";

/**
 * ChatAdapter seam — stateless inference for the XCollab AI assistant.
 * Spec: "XCollab AI — Implementation Spec" §2.7. The agent loop (tool
 * execution, proposals, ledger) lives in services/api; adapters here only
 * turn (system, messages, tools) into text and/or tool calls.
 */

export type ToolCall = {
  /** Provider call id; echoed back as `toolCallId` on the tool_result message. */
  id: string;
  name: string;
  args: unknown;
};

export type ChatMessage =
  | { role: "user"; content: string }
  | { role: "assistant"; content: string; toolCalls?: ToolCall[] }
  | { role: "tool_result"; tool: string; content: string; toolCallId?: string };

/** One callable tool. The JSON Schema handed to a live model is derived from
    `argsSchema` at the adapter boundary (zod v4 `z.toJSONSchema`). */
export interface ToolSpec {
  name: string;
  description: string;
  argsSchema: z.ZodType;
}

export type ChatFinishReason = "stop" | "tool_calls" | "length";

export type ChatEvent =
  | { type: "text_delta"; text: string }
  | { type: "tool_call"; id: string; name: string; args: unknown }
  /** Emitted when a call names an unknown tool or its args fail the zod
      schema — the loop feeds `message` back so the model can self-correct. */
  | { type: "tool_call_invalid"; id: string; name: string; message: string }
  /** The primary adapter failed mid-turn; the rest of the stream comes from `to`. */
  | { type: "degraded"; from: string; to: string }
  /** `modelId` is set by adapters that pick a model per turn (e.g. cost-aware
      routing) so the ledger can record which model actually ran. */
  | { type: "finish"; reason: ChatFinishReason; modelId?: string };

export interface ChatTurnRequest {
  system: string;
  messages: ChatMessage[];
  tools: ToolSpec[];
  /** Client disconnects abort the upstream inference request. */
  signal?: AbortSignal;
}

export interface ChatAdapter {
  id: string;
  modelId: string;
  runTurn(req: ChatTurnRequest): AsyncIterable<ChatEvent>;
}

export class ChatTurnError extends Error {
  readonly adapterId: string;

  constructor(message: string, adapterId: string) {
    super(message);
    this.name = "ChatTurnError";
    this.adapterId = adapterId;
  }
}

/**
 * Seam contract, mirroring `gateway.ts`: no tool call reaches the caller
 * unvalidated, and adapter failure degrades the turn to the next adapter
 * (deterministic last) instead of an outage.
 */
export class ChatGateway {
  private readonly adapters: ChatAdapter[];

  constructor(adapters: ChatAdapter[]) {
    if (adapters.length === 0) {
      throw new ChatTurnError("ChatGateway requires at least one adapter", "gateway");
    }
    this.adapters = adapters;
  }

  /** Adapter answering the next turn (the primary). */
  get primary(): ChatAdapter {
    const adapter = this.adapters[0];
    if (!adapter) throw new ChatTurnError("no chat adapter registered", "gateway");
    return adapter;
  }

  async *runTurn(req: ChatTurnRequest): AsyncGenerator<ChatEvent> {
    const toolsByName = new Map(req.tools.map((tool) => [tool.name, tool]));
    for (let i = 0; i < this.adapters.length; i += 1) {
      const adapter = this.adapters[i];
      if (!adapter) break;
      try {
        for await (const event of adapter.runTurn(req)) {
          yield validateEvent(event, toolsByName);
        }
        return;
      } catch (error) {
        const fallback = this.adapters[i + 1];
        if (!fallback) {
          throw new ChatTurnError(
            `adapter "${adapter.id}" failed with no fallback: ${describeError(error)}`,
            adapter.id,
          );
        }
        // Consumers may have already received partial text from the failed
        // adapter; the degraded event tells them the turn restarts from here.
        yield { type: "degraded", from: adapter.id, to: fallback.id };
      }
    }
  }
}

function validateEvent(event: ChatEvent, toolsByName: Map<string, ToolSpec>): ChatEvent {
  if (event.type !== "tool_call") return event;
  const spec = toolsByName.get(event.name);
  if (!spec) {
    return {
      type: "tool_call_invalid",
      id: event.id,
      name: event.name,
      message: `unknown tool "${event.name}"`,
    };
  }
  const parsed = spec.argsSchema.safeParse(event.args);
  if (!parsed.success) {
    return {
      type: "tool_call_invalid",
      id: event.id,
      name: event.name,
      message: `invalid args for "${event.name}": ${parsed.error.message}`,
    };
  }
  return { ...event, args: parsed.data };
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
