import type { Hono } from "hono";
import { z } from "zod";
import { findDependencyCycle, LanguageSchema, ProgramSchema } from "@xcollab/core";
import type { AuthEnv } from "./auth.ts";
import type { WorkGraphRepository } from "./repository.ts";

/**
 * Browser-relay import (demo mode): the browser called the hosted model
 * directly (the cluster has no egress) and submits the generated program
 * here. The server re-runs EXACTLY the gateway's checks — schema + acyclic
 * dependencies — so a hand-crafted payload gets no further than a bad model
 * output would. Ledgered as the ai actor "browser-relay" with the signed-in
 * user in the provenance context: the chain records that this generation was
 * client-supplied, never that the server verified the model produced it.
 */
const ImportProgramRequestSchema = z.object({
  workspaceId: z.string().min(1),
  mission: z.string().min(1).max(20_000),
  language: LanguageSchema,
  modelId: z.string().min(1).max(120),
  program: z.unknown(),
  parentId: z.string().min(1).optional(),
  teamId: z.string().min(1).optional(),
});

const MAX_PROGRAM_JSON_BYTES = 512 * 1024;

export function registerProgramImportRoute(app: Hono<AuthEnv>, repo: WorkGraphRepository): void {
  app.post("/api/programs/import", async (c) => {
    const parsed = ImportProgramRequestSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) {
      return c.json({ error: "invalid request", issues: parsed.error.issues }, 400);
    }
    const { workspaceId, mission, language, modelId, parentId, teamId } = parsed.data;

    const output = JSON.stringify(parsed.data.program);
    if (output.length > MAX_PROGRAM_JSON_BYTES) return c.json({ error: "too_large" }, 413);
    const candidate = ProgramSchema.safeParse(parsed.data.program);
    if (!candidate.success) {
      return c.json({ error: "invalid_program", issues: candidate.error.issues }, 422);
    }
    const cycle = findDependencyCycle(candidate.data.packages);
    if (cycle) {
      return c.json({ error: "dependency_cycle", cycle }, 422);
    }
    if (parentId !== undefined && !(await repo.getProgram(workspaceId, parentId))) {
      return c.json({ error: "unknown_parent" }, 422);
    }
    if (teamId !== undefined && !(await repo.teams.get(workspaceId, teamId))) {
      return c.json({ error: "unknown_team" }, 422);
    }

    let program = candidate.data;
    if (parentId !== undefined) program = { ...program, parentId };
    if (teamId !== undefined) program = { ...program, teamId };

    const result = await repo.createProgram(
      workspaceId,
      {
        program,
        interaction: {
          adapterId: "browser-relay",
          modelId,
          input: JSON.stringify({ mission, language }),
          output,
        },
      },
      { kind: "ai", id: "browser-relay" },
      { modelId, context: { channel: "browser-relay", requestedBy: c.get("username") } },
    );
    return c.json(
      { program: result.program, ledgerSeq: result.ledgerSeq, generatedBy: modelId },
      201,
    );
  });
}
