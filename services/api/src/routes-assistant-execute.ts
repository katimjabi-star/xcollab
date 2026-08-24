import type { Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { z } from "zod";
import { ASSISTANT_MUTATION_TOOLS, isAssistantMutationTool, LanguageSchema } from "@xcollab/core";
import type { AuthEnv } from "./auth.ts";
import { stableStringify, type ProposalStore } from "./assistant-proposals.ts";
import {
  DONE_MESSAGES,
  executeMutation,
  type Dispatch,
  type MutationResult,
} from "./assistant-execute-mutations.ts";

/**
 * POST /api/assistant/execute (spec §2.2/§2.6) — the ONLY path that runs a
 * mutation the assistant proposed, and only after an explicit user confirm.
 * Args are re-validated against the tool's zod schema and must match the
 * proposal byte-for-byte (single-use proposalId). Execution dispatches
 * in-process through the real route handlers with the user's own bearer
 * token; the boot nonce + context headers flip the ledger actor to
 * {kind:"ai", id:"assistant"} with modelId and requestedBy recorded.
 * Per-tool executors live in assistant-execute-mutations.ts.
 */

const ExecuteRequestSchema = z.object({
  workspaceId: z.string().min(1),
  proposalId: z.uuid(),
  tool: z.string().min(1),
  args: z.record(z.string(), z.unknown()),
  language: LanguageSchema,
});

export interface AssistantExecuteConfig {
  nonce: string;
  proposals: ProposalStore;
}

export function registerAssistantExecuteRoute(
  app: Hono<AuthEnv>,
  config: AssistantExecuteConfig,
): void {
  app.post("/api/assistant/execute", async (c) => {
    const parsed = ExecuteRequestSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) {
      return c.json({ error: "invalid request", issues: parsed.error.issues }, 400);
    }
    const { workspaceId, proposalId, tool, args, language } = parsed.data;
    if (!isAssistantMutationTool(tool)) return c.json({ error: "unknown_tool" }, 400);
    const validated = ASSISTANT_MUTATION_TOOLS[tool].args.safeParse(args);
    if (!validated.success) {
      return c.json({ error: "invalid request", issues: validated.error.issues }, 400);
    }
    const username = c.get("username");
    const consumed = config.proposals.consume(proposalId, {
      workspaceId,
      username,
      tool,
      argsKey: stableStringify(validated.data),
    });
    if (consumed.outcome === "unknown") {
      return c.json({ error: "unknown_proposal", message: "unknown, used or expired proposal" }, 404);
    }
    if (consumed.outcome === "mismatch") {
      return c.json({ error: "proposal_mismatch", message: "request does not match the proposal" }, 409);
    }

    const headers = {
      authorization: c.req.header("authorization") ?? "",
      "content-type": "application/json",
      "x-xcollab-assistant-nonce": config.nonce,
      "x-xcollab-assistant-context": JSON.stringify({
        requestedBy: username,
        proposalId,
        tool,
        modelId: consumed.record.modelId,
      }),
    };
    const dispatch: Dispatch = async (method, path, body) => {
      const res = await app.request(path, {
        method,
        headers,
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      return { status: res.status, body: (await res.json().catch(() => null)) as unknown };
    };

    const outcome = await executeMutation(
      dispatch,
      workspaceId,
      tool,
      validated.data as Record<string, unknown>,
    );
    if (outcome.status !== 200) {
      // Errors map 1:1 to the underlying route's structured errors (§2.2).
      const body = outcome.body ?? { error: "execution_failed" };
      return c.json(body as Record<string, unknown>, outcome.status as ContentfulStatusCode);
    }
    const result = outcome.body as { result: MutationResult };
    return c.json({ ...result, message: DONE_MESSAGES[language][tool] });
  });
}
