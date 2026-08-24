import { Hono } from "hono";
import { cors } from "hono/cors";
import { z } from "zod";
import { LanguageSchema, TaskSchema, TimelineSchema, verifyChain } from "@xcollab/core";
import { ProgramGenerationError, type AiGateway } from "@xcollab/ai-gateway";
import { createAuthMiddleware, type AuthEnv } from "./auth.ts";
import {
  InvalidTaskDatesError,
  type LedgerActor,
  type TaskFieldChanges,
  type WorkGraphRepository,
} from "./repository.ts";
import { listRealmUsers } from "./users.ts";
import { registerTeamRoutes } from "./routes-teams.ts";
import { registerAttachmentRoutes } from "./routes-attachments.ts";
import { registerMyTaskRoutes } from "./routes-my-tasks.ts";
import { AttachmentStore } from "./storage.ts";

const CreateProgramRequestSchema = z.object({
  workspaceId: z.string().min(1),
  mission: z.string().min(1).max(20_000),
  language: LanguageSchema,
  // TimelineSchema enforces valid ISO dates AND end-after-start at the boundary,
  // so an inverted brief is a 400 here — never a schema-invalid stored program.
  timeline: TimelineSchema.optional(),
  teamHints: z.array(z.string().min(1)).max(20).optional(),
  parentId: z.string().min(1).optional(),
  teamId: z.string().min(1).optional(),
});

/** Exactly one operation per request: teamId (null unlinks; a string re-links
    to an existing workspace team) or name (rename). */
const UpdateProgramRequestSchema = z
  .object({
    workspaceId: z.string().min(1),
    teamId: z.string().min(1).nullable().optional(),
    name: z.string().trim().min(1).max(500).optional(),
  })
  .refine((body) => (body.teamId !== undefined) !== (body.name !== undefined), {
    message: "exactly one of teamId or name is required",
  });

const UPDATABLE_TASK_KEYS = [
  "status",
  "name",
  "estimateDays",
  "assigneeRole",
  "assignee",
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
    assignee: TaskSchema.shape.assignee.nullable(),
    startDate: TaskSchema.shape.startDate.nullable(),
    dueDate: TaskSchema.shape.dueDate.nullable(),
    description: TaskSchema.shape.description.nullable(),
  })
  .refine((body) => UPDATABLE_TASK_KEYS.some((key) => body[key] !== undefined), {
    message: "at least one task field is required",
  })
  .refine(
    (body) =>
      typeof body.startDate !== "string" ||
      typeof body.dueDate !== "string" ||
      body.startDate <= body.dueDate,
    { message: "task startDate must be on or before dueDate", path: ["dueDate"] },
  );

const CreateTaskRequestSchema = z
  .object({
    workspaceId: z.string().min(1),
    packageId: z.string().min(1),
    name: TaskSchema.shape.name,
    estimateDays: TaskSchema.shape.estimateDays.optional(),
    assigneeRole: TaskSchema.shape.assigneeRole,
    startDate: TaskSchema.shape.startDate,
    dueDate: TaskSchema.shape.dueDate,
    description: TaskSchema.shape.description,
  })
  .refine((body) => !body.startDate || !body.dueDate || body.startDate <= body.dueDate, {
    message: "task startDate must be on or before dueDate",
    path: ["dueDate"],
  });

export function createApp(
  repo: WorkGraphRepository,
  gateway: AiGateway,
  store: AttachmentStore = new AttachmentStore(),
): Hono<AuthEnv> {
  const app = new Hono<AuthEnv>();
  app.use("/api/*", cors({ origin: ["http://localhost:3000"] }));

  // Authenticated per-user API: nothing is cacheable by browsers or proxies.
  // Set BEFORE next(): @hono/node-server's lightweight response fast-path does
  // not serialize post-handler c.res.headers mutations, prepared headers it does.
  app.use("/api/*", async (c, next) => {
    c.header("cache-control", "no-store");
    await next();
  });

  // Typed domain errors become structured 4xx/5xx; nothing leaks a stack trace.
  app.onError((error, c) => {
    if (error instanceof InvalidTaskDatesError) {
      return c.json({ error: error.code, message: error.message }, 400);
    }
    if (error instanceof ProgramGenerationError) {
      return c.json({ error: "generation_failed", message: error.message }, 502);
    }
    console.error(error);
    return c.json({ error: "internal_error" }, 500);
  });

  // Registered before the auth middleware so it stays open without a token.
  app.get("/api/health", (c) => c.json({ ok: true }));

  app.use("/api/*", createAuthMiddleware());

  const humanActor = (c: { get: (key: "username") => string }): LedgerActor => ({
    kind: "human",
    id: c.get("username"),
  });

  app.post("/api/programs", async (c) => {
    const parsed = CreateProgramRequestSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) {
      return c.json({ error: "invalid request", issues: parsed.error.issues }, 400);
    }
    const { workspaceId, parentId, teamId, ...brief } = parsed.data;
    if (parentId !== undefined && !(await repo.getProgram(workspaceId, parentId))) {
      return c.json({ error: "unknown_parent" }, 422);
    }
    if (teamId !== undefined && !(await repo.teams.get(workspaceId, teamId))) {
      return c.json({ error: "unknown_team" }, 422);
    }
    const generation = await gateway.generateProgram(brief);
    if (parentId !== undefined) {
      generation.program = { ...generation.program, parentId };
    }
    if (teamId !== undefined) {
      generation.program = { ...generation.program, teamId };
    }
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

  app.patch("/api/programs/:id", async (c) => {
    const parsed = UpdateProgramRequestSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) {
      return c.json({ error: "invalid request", issues: parsed.error.issues }, 400);
    }
    if (parsed.data.name !== undefined) {
      const renamed = await repo.updateProgramName(
        parsed.data.workspaceId,
        c.req.param("id"),
        parsed.data.name,
        humanActor(c),
      );
      if (renamed.outcome === "ok") return c.json({ program: renamed.program });
      return c.json({ error: "not found" }, 404);
    }
    const result = await repo.updateProgramTeam(
      parsed.data.workspaceId,
      c.req.param("id"),
      parsed.data.teamId ?? null,
      humanActor(c),
    );
    if (result.outcome === "ok") return c.json({ program: result.program });
    if (result.outcome === "unknown_team") return c.json({ error: "unknown_team" }, 422);
    return c.json({ error: "not found" }, 404);
  });

  app.patch("/api/programs/:programId/tasks/:taskId", async (c) => {
    const parsed = UpdateTaskRequestSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) {
      return c.json({ error: "invalid request", issues: parsed.error.issues }, 400);
    }
    // A set (non-null) assignee must be a known realm user; null still clears.
    if (typeof parsed.data.assignee === "string") {
      const users = await listRealmUsers();
      if (!users.some((user) => user.username === parsed.data.assignee)) {
        return c.json({ error: "unknown_assignee" }, 400);
      }
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
      humanActor(c),
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
      humanActor(c),
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
      humanActor(c),
    );
    if (result.outcome === "deleted") {
      return c.json({ program: result.program, ledgerSeq: result.ledgerSeq });
    }
    if (result.outcome === "last_task") {
      return c.json({ error: "a work package must keep at least one task" }, 409);
    }
    return c.json({ error: "not found" }, 404);
  });

  registerTeamRoutes(app, repo);
  registerAttachmentRoutes(app, repo, store);
  registerMyTaskRoutes(app, repo);

  app.get("/api/ledger", async (c) => {
    const workspaceId = c.req.query("workspaceId");
    if (!workspaceId) return c.json({ error: "workspaceId is required" }, 400);
    const entries = await repo.getLedger(workspaceId);
    return c.json({ entries, verification: verifyChain(entries) });
  });

  return app;
}
