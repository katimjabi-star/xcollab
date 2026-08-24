import { z } from "zod";
import type { ChatAdapter } from "@xcollab/ai-gateway";
import type { LedgerActor, MutationProvenance } from "./repository.ts";
import type { AssistantTurnLimits } from "./routes-assistant.ts";

/**
 * Actor attribution for assistant-confirmed mutations (spec §2.6, D4).
 * The nonce is minted at boot (crypto random), lives only in process memory,
 * and travels exclusively on the executor's in-process dispatch — external
 * callers cannot know it, so a forged header always lands as a human actor.
 * Auth itself is still the user's own bearer token in both cases.
 */

export interface AssistantConfig {
  adapter: ChatAdapter;
  nonce: string;
  limits?: Partial<AssistantTurnLimits>;
}

/** Audit context the executor forwards; ids only — never args, never secrets. */
const AssistantContextSchema = z.object({
  requestedBy: z.string().min(1),
  proposalId: z.string().min(1),
  tool: z.string().min(1),
  modelId: z.string().min(1).optional(),
  conversationId: z.string().min(1).optional(),
});

interface RequestLike {
  req: { header: (name: string) => string | undefined };
  get: (key: "username") => string;
}

export interface ActorResolver {
  isAssistant: (c: RequestLike) => boolean;
  actorOf: (c: RequestLike) => LedgerActor;
  provenanceOf: (c: RequestLike) => MutationProvenance | undefined;
}

export function createActorResolver(nonce: string | undefined): ActorResolver {
  const isAssistant = (c: RequestLike): boolean =>
    nonce !== undefined && c.req.header("x-xcollab-assistant-nonce") === nonce;

  const actorOf = (c: RequestLike): LedgerActor =>
    isAssistant(c) ? { kind: "ai", id: "assistant" } : { kind: "human", id: c.get("username") };

  const provenanceOf = (c: RequestLike): MutationProvenance | undefined => {
    if (!isAssistant(c)) return undefined;
    const header = c.req.header("x-xcollab-assistant-context");
    if (header === undefined) return undefined;
    let candidate: unknown;
    try {
      candidate = JSON.parse(header);
    } catch {
      return undefined;
    }
    const parsed = AssistantContextSchema.safeParse(candidate);
    if (!parsed.success) return undefined;
    const { modelId, ...context } = parsed.data;
    return { ...(modelId === undefined ? {} : { modelId }), context: { ...context } };
  };

  return { isAssistant, actorOf, provenanceOf };
}
