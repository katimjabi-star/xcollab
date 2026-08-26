import type { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { z } from "zod";
import { LanguageSchema, type AssistantEvent } from "@xcollab/core";
import {
  ASSISTANT_TOOLS,
  buildChatSystemPrompt,
  type ChatAdapter,
  type ChatMessage,
} from "@xcollab/ai-gateway";
import type { AuthEnv } from "./auth.ts";
import type { ProposalStore } from "./assistant-proposals.ts";
import { runAssistantLoop } from "./assistant-loop.ts";

/** POST /api/assistant/messages — the SSE chat turn endpoint (spec §2.2). */

const IncomingMessageSchema = z.discriminatedUnion("role", [
  z.object({ role: z.literal("user"), content: z.string().min(1).max(4000) }),
  z.object({ role: z.literal("assistant"), content: z.string().max(20_000) }),
  z.object({
    role: z.literal("tool_result"),
    tool: z.string().min(1).max(100),
    resultDigest: z.string().max(8_192),
  }),
]);

const ChatRequestSchema = z.object({
  workspaceId: z.string().min(1),
  language: LanguageSchema,
  messages: z.array(IncomingMessageSchema).min(1).max(40),
});

export interface AssistantTurnLimits {
  turnsPerMinute: number;
  concurrentStreams: number;
}

export interface AssistantChatConfig {
  adapter: ChatAdapter;
  proposals: ProposalStore;
  limits?: Partial<AssistantTurnLimits>;
}

/** In-memory per-user limiter (spec §2.2) — demo scale, single process. */
class TurnRateLimiter {
  private readonly starts = new Map<string, number[]>();
  private readonly active = new Map<string, number>();
  private readonly limits: AssistantTurnLimits;

  constructor(limits: AssistantTurnLimits) {
    this.limits = limits;
  }

  tryAcquire(username: string): boolean {
    const now = Date.now();
    const recent = (this.starts.get(username) ?? []).filter((at) => now - at < 60_000);
    const running = this.active.get(username) ?? 0;
    if (recent.length >= this.limits.turnsPerMinute || running >= this.limits.concurrentStreams) {
      this.starts.set(username, recent);
      return false;
    }
    recent.push(now);
    this.starts.set(username, recent);
    this.active.set(username, running + 1);
    return true;
  }

  release(username: string): void {
    this.active.set(username, Math.max(0, (this.active.get(username) ?? 0) - 1));
  }
}

function toChatMessage(message: z.infer<typeof IncomingMessageSchema>): ChatMessage {
  if (message.role === "tool_result") {
    return { role: "tool_result", tool: message.tool, content: message.resultDigest };
  }
  return message;
}

export function registerAssistantChatRoute(app: Hono<AuthEnv>, config: AssistantChatConfig): void {
  const limiter = new TurnRateLimiter({
    turnsPerMinute: config.limits?.turnsPerMinute ?? 10,
    concurrentStreams: config.limits?.concurrentStreams ?? 3,
  });
  // The single zod-derived tool projection (gateway chat-tools) — the api
  // must never carry its own copy of the contract (charter: generated, once).
  const tools = [...ASSISTANT_TOOLS];

  app.post("/api/assistant/messages", async (c) => {
    const parsed = ChatRequestSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) {
      return c.json({ error: "invalid request", issues: parsed.error.issues }, 400);
    }
    const username = c.get("username");
    if (!limiter.tryAcquire(username)) {
      return c.json({ error: "rate_limited", message: "too many assistant turns" }, 429);
    }
    const { workspaceId, language, messages } = parsed.data;
    const authorization = c.req.header("authorization") ?? "";
    const today = new Date().toISOString().slice(0, 10);
    const history = messages.map(toChatMessage);

    return streamSSE(c, async (stream) => {
      const emit = (event: AssistantEvent): Promise<void> =>
        stream.writeSSE({ data: JSON.stringify(event) });
      try {
        await runAssistantLoop(
          {
            adapter: config.adapter,
            tools,
            system: buildChatSystemPrompt({ language, today, workspaceId, username }),
            proposals: config.proposals,
            reads: { app, authorization, workspaceId, today },
            workspaceId,
            username,
            emit,
          },
          history,
        );
      } catch (error) {
        // Typed error event, never a stack trace (app.ts onError policy).
        console.error(error);
        await emit({ type: "error", code: "internal_error", message: "assistant turn failed" });
      } finally {
        limiter.release(username);
      }
    });
  });
}
