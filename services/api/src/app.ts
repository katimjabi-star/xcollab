import { Hono } from "hono";
import { cors } from "hono/cors";
import { z } from "zod";
import { LanguageSchema, TaskSchema, verifyChain } from "@xcollab/core";
import type { AiGateway } from "@xcollab/ai-gateway";
import type { LedgerActor, TaskFieldChanges, WorkGraphRepository } from "./repository.ts";

const WEB_USER: LedgerActor = { kind: "human", id: "web-user" };

const CreateProgramRequestSchema = z.object({
  workspaceId: z.string().min(1),
  mission: z.string().min(1).max(20_000),
  language: LanguageSchema,
  timeline: z.object({ start: z.iso.date(), end: z.iso.date() }).optional(),
  teamHints: z.array(z.string().min(1)).max(20).optional(),
});

const UPDATABLE_TASK_KEYS = [
  "status",
  "name",
  "estimateDays",
  "assigneeRole",
  "startDate",
  "dueDate",
  "description",
] as const;

// Field validators come from TaskSchema.shape; null clears an optional field.
const UpdateTaskRequestSchema = z
  .object({
    workspaceId: z.string().min(1),
    status: TaskSchema.shape.status.optional(),
    name: TaskSchema.shape.name.optional(),
    estimateDays: TaskSchema.shape.estimateDays.optional(),
    assigneeRole: TaskSchema.shape.assigneeRole.nullable(),
    startDate: TaskSchema.shape.startDate.nullable(),
    dueDate: TaskSchema.shape.dueDate.nullable(),
    description: TaskSchema.shape.description.nullable(),
  })
  .refine((body) => UPDATABLE_TASK_KEYS.some((key) => body[key] !== undefined), {
    message: "at least one task field is required",
  });

const CreateTaskRequestSchema = z.object({
  workspaceId: z.string().min(1),
  packageId: z.string().min(1),
  name: TaskSchema.shape.name,
  estimateDays: TaskSchema.shape.estimateDays.optional(),
  assigneeRole: TaskSchema.shape.assigneeRole,
  startDate: TaskSchema.shape.startDate,
  dueDate: TaskSchema.shape.dueDate,
  description: TaskSchema.shape.description,
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

  app.patch("/api/programs/:programId/tasks/:taskId", async (c) => {
    const parsed = UpdateTaskRequestSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) {
      return c.json({ error: "invalid request", issues: parsed.error.issues }, 400);
    }
    const changes: TaskFieldChanges = {};
    for (const key of UPDATABLE_TASK_KEYS) {
      const value = parsed.data[key];
      if (value !== undefined) (changes as Record<string, unknown>)[key] = value;
    }
    const result = await repo.updateTask(
      parsed.data.workspaceId,
      c.req.param("programId"),
      c.req.param("taskId"),
      changes,
      WEB_USER,
    );
    return result ? c.json(result) : c.json({ error: "not found" }, 404);
  });

  app.post("/api/programs/:programId/tasks", async (c) => {
    const parsed = CreateTaskRequestSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) {
      return c.json({ error: "invalid request", issues: parsed.error.issues }, 400);
    }
    const { workspaceId, packageId, ...task } = parsed.data;
    const result = await repo.createTask(
      workspaceId,
      c.req.param("programId"),
      packageId,
      task,
      WEB_USER,
    );
    return result ? c.json(result, 201) : c.json({ error: "not found" }, 404);
  });

  app.delete("/api/programs/:programId/tasks/:taskId", async (c) => {
    const workspaceId = c.req.query("workspaceId");
    if (!workspaceId) return c.json({ error: "workspaceId is required" }, 400);
    const result = await repo.deleteTask(
      workspaceId,
      c.req.param("programId"),
      c.req.param("taskId"),
      WEB_USER,
    );
    if (result.outcome === "deleted") {
      return c.json({ program: result.program, ledgerSeq: result.ledgerSeq });
    }
    if (result.outcome === "last_task") {
      return c.json({ error: "a work package must keep at least one task" }, 409);
    }
    return c.json({ error: "not found" }, 404);
  });

  app.get("/api/ledger", async (c) => {
    const workspaceId = c.req.query("workspaceId");
    if (!workspaceId) return c.json({ error: "workspaceId is required" }, 400);
    const entries = await repo.getLedger(workspaceId);
    return c.json({ entries, verification: verifyChain(entries) });
  });

  return app;
}
