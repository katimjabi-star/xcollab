import { Hono } from "hono";
import { cors } from "hono/cors";
import { z } from "zod";
import { LanguageSchema, verifyChain } from "@xcollab/core";
import type { AiGateway } from "@xcollab/ai-gateway";
import type { WorkGraphRepository } from "./repository.ts";

const CreateProgramRequestSchema = z.object({
  workspaceId: z.string().min(1),
  mission: z.string().min(1).max(20_000),
  language: LanguageSchema,
  timeline: z.object({ start: z.iso.date(), end: z.iso.date() }).optional(),
  teamHints: z.array(z.string().min(1)).max(20).optional(),
});

export function createApp(repo: WorkGraphRepository, gateway: AiGateway): Hono {
  const app = new Hono();
  app.use("/api/*", cors({ origin: ["http://localhost:3000"] }));

  app.get("/api/health", (c) => c.json({ ok: true }));

  app.post("/api/programs", async (c) => {
    const parsed = CreateProgramRequestSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) {
      return c.json({ error: "invalid request", issues: parsed.error.issues }, 400);
    }
    const { workspaceId, ...brief } = parsed.data;
    const generation = await gateway.generateProgram(brief);
    const { program, ledgerSeq } = await repo.createProgram(workspaceId, generation, {
      kind: "ai",
      id: generation.interaction.adapterId,
    });
    return c.json({ program, ledgerSeq, generatedBy: generation.interaction.modelId }, 201);
  });

  app.get("/api/programs", async (c) => {
    const workspaceId = c.req.query("workspaceId");
    if (!workspaceId) return c.json({ error: "workspaceId is required" }, 400);
    return c.json({ programs: await repo.listPrograms(workspaceId) });
  });

  app.get("/api/programs/:id", async (c) => {
    const workspaceId = c.req.query("workspaceId");
    if (!workspaceId) return c.json({ error: "workspaceId is required" }, 400);
    const program = await repo.getProgram(workspaceId, c.req.param("id"));
    return program ? c.json({ program }) : c.json({ error: "not found" }, 404);
  });

  app.get("/api/ledger", async (c) => {
    const workspaceId = c.req.query("workspaceId");
    if (!workspaceId) return c.json({ error: "workspaceId is required" }, 400);
    const entries = await repo.getLedger(workspaceId);
    return c.json({ entries, verification: verifyChain(entries) });
  });

  return app;
}
