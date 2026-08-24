import type { ChatAdapter, ChatEvent, ChatMessage, ChatTurnRequest } from "../chat.ts";
import { AnthropicChatAdapter, type FetchLike } from "./anthropic-chat.ts";

/**
 * Cost-aware model routing over the direct Anthropic adapter — spec §2.7.
 * Genuinely hard turns (long asks, multi-step tool continuations, or
 * summarization/analysis intent) run on the complex model; everything else
 * runs on the cheap model. The heuristic is a small pure function so it can
 * be unit tested without any network mocking.
 */

export const DEFAULT_SIMPLE_MODEL = "claude-haiku-4-5";
export const DEFAULT_COMPLEX_MODEL = "claude-sonnet-5";

const LONG_MESSAGE_THRESHOLD = 400;

/** EN/AR keywords that signal summarization or analysis intent. */
const COMPLEX_KEYWORDS = [
  "summarize",
  "summarise",
  "لخص",
  "how is",
  "analyze",
  "analyse",
  "report",
  "compare",
];

/**
 * Pure routing heuristic: true ⇒ route to the complex model. Exported for
 * direct unit testing independent of any fetch/HTTP mocking.
 */
export function isComplexTurn(req: Pick<ChatTurnRequest, "messages">): boolean {
  if (hasToolResult(req.messages)) return true;
  const lastUser = lastUserMessage(req.messages);
  if (!lastUser) return false;
  if (lastUser.content.length > LONG_MESSAGE_THRESHOLD) return true;
  return containsComplexKeyword(lastUser.content);
}

function hasToolResult(messages: ChatMessage[]): boolean {
  return messages.some((message) => message.role === "tool_result");
}

function lastUserMessage(messages: ChatMessage[]): Extract<ChatMessage, { role: "user" }> | undefined {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (message?.role === "user") return message;
  }
  return undefined;
}

function containsComplexKeyword(text: string): boolean {
  const lower = text.toLowerCase();
  return COMPLEX_KEYWORDS.some((keyword) => lower.includes(keyword.toLowerCase()));
}

export interface AnthropicRouterOptions {
  apiKey: string;
  simpleModel?: string;
  complexModel?: string;
  baseUrl?: string;
  maxTokens?: number;
  fetchImpl?: FetchLike;
}

/**
 * ChatAdapter that picks the cheapest model able to handle each turn.
 * `modelId` reflects the model chosen for the most recently started turn;
 * the authoritative per-turn value is also stamped onto the `finish` event
 * so the ledger records which model actually ran even under concurrent use.
 */
export class ModelRoutingAdapter implements ChatAdapter {
  readonly id = "anthropic";
  private readonly simple: AnthropicChatAdapter;
  private readonly complex: AnthropicChatAdapter;
  private lastModelId: string;

  constructor(options: AnthropicRouterOptions) {
    const simpleModel = options.simpleModel ?? DEFAULT_SIMPLE_MODEL;
    const complexModel = options.complexModel ?? DEFAULT_COMPLEX_MODEL;
    const shared = {
      apiKey: options.apiKey,
      ...(options.baseUrl === undefined ? {} : { baseUrl: options.baseUrl }),
      ...(options.maxTokens === undefined ? {} : { maxTokens: options.maxTokens }),
      ...(options.fetchImpl === undefined ? {} : { fetchImpl: options.fetchImpl }),
    };
    this.simple = new AnthropicChatAdapter({ ...shared, modelId: simpleModel });
    this.complex = new AnthropicChatAdapter({ ...shared, modelId: complexModel });
    this.lastModelId = simpleModel;
  }

  get modelId(): string {
    return this.lastModelId;
  }

  async *runTurn(req: ChatTurnRequest): AsyncGenerator<ChatEvent> {
    const adapter = isComplexTurn(req) ? this.complex : this.simple;
    this.lastModelId = adapter.modelId;
    for await (const event of adapter.runTurn(req)) {
      yield event.type === "finish" ? { ...event, modelId: adapter.modelId } : event;
    }
  }
}

export function createAnthropicAdapter(options: AnthropicRouterOptions): ChatAdapter {
  return new ModelRoutingAdapter(options);
}
