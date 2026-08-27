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
import { createWorkspaceAccessMiddleware } from "./workspace-access.ts";
import { registerTeamRoutes } from "./routes-teams.ts";
import { registerWorkspaceMemberRoutes } from "./routes-workspace-members.ts";
import { registerAttachmentRoutes } from "./routes-attachments.ts";
import { registerMyTaskRoutes } from "./routes-my-tasks.ts";
import { registerSubtaskRoutes } from "./routes-subtasks.ts";
import { registerSearchRoutes } from "./routes-search.ts";
import { registerAssistantChatRoute } from "./routes-assistant.ts";
import { registerAssistantExecuteRoute } from "./routes-assistant-execute.ts";
import { wireWhatsAppChannel, type WhatsAppChannelOptions } from "./routes-whatsapp.ts";
import { createActorResolver, type AssistantConfig } from "./assistant-actor.ts";
import { AttachmentStore } from "./storage.ts";

export type { AssistantConfig } from "./assistant-actor.ts";

const CreateProgramRequestSchema = z.object({
  workspaceId: z.string().min(1),
  mission: z.string().min(1).max(20_000),
  language: LanguageSchema,
  // TimelineSchema enforces valid ISO dates AND end-after-start at the boundary,
  // so an inverted brief is a 400 here — never a schema-invalid stored program.
  timeline: TimelineSchema.optional(),
  teamHints: z.array(z.string().trim().min(1).max(500)).max(20).optional(),
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
  assistant?: AssistantConfig,
  channels?: { whatsapp?: WhatsAppChannelOptions },
): Hono<AuthEnv> {
  const app = new Hono<AuthEnv>();
  // Comma-separated allowlist for deployed origins; localhost dev default.
  const corsOrigins = (process.env.CORS_ALLOWED_ORIGINS ?? "http://localhost:3000")
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin !== "");
  app.use("/api/*", cors({ origin: corsOrigins }));

  // Authenticated per-user API: nothing is cacheable by browsers or proxies,
  // and responses (attachment downloads included) must never be MIME-sniffed.
  // Set BEFORE next(): @hono/node-server's lightweight response fast-path does
  // not serialize post-handler c.res.headers mutations, prepared headers it does.
  app.use("/api/*", async (c, next) => {
    c.header("cache-control", "no-store");
    c.header("x-content-type-options", "nosniff");
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

  // WhatsApp webhook is public by design (Meta authenticates via verify
  // token + HMAC signature) so it registers before the bearer gate.
  const { proposals, whatsapp } = wireWhatsAppChannel(app, assistant, channels?.whatsapp);

  app.use("/api/*", createAuthMiddleware());
  // Workspace-level authorization (single enforcement point): claimed
  // workspaces are members-only; the first mutation claims an unclaimed one.
  app.use("/api/*", createWorkspaceAccessMiddleware(repo.members));

  // Assistant-confirmed mutations arrive with the boot nonce and land as the
  // ai actor with provenance merged into the ledger input; everything else —
  // including a forged nonce header — stays a human actor (spec §2.6).
  const { isAssistant, actorOf, provenanceOf } = createActorResolver(assistant?.nonce);

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
    // Generation is always an ai actor; assistant-confirmed creation is the
    // assistant (D4), direct creation the generation adapter (existing shape).
    const actor: LedgerActor = {
      kind: "ai",
      id: isAssistant(c) ? "assistant" : generation.interaction.adapterId,
    };
    const { program, ledgerSeq } = await repo.createProgram(
      workspaceId,
      generation,
      actor,
      provenanceOf(c),
    );
    // Fire-and-forget channel fanout AFTER the authoritative commit.
    whatsapp?.notifyProgramCreated(program.name, workspaceId);
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
        actorOf(c),
      );
      if (renamed.outcome === "ok") return c.json({ program: renamed.program });
      return c.json({ error: "not found" }, 404);
    }
    const result = await repo.updateProgramTeam(
      parsed.data.workspaceId,
      c.req.param("id"),
      parsed.data.teamId ?? null,
      actorOf(c),
      provenanceOf(c),
    );
    if (result.outcome === "ok") return c.json({ program: result.program });
    if (result.outcome === "unknown_team") return c.json({ error: "unknown_team" }, 422);
    return c.json({ error: "not found" }, 404);
  });

  app.delete("/api/programs/:id", async (c) => {
    const workspaceId = c.req.query("workspaceId");
    if (!workspaceId) return c.json({ error: "workspaceId is required" }, 400);
    const result = await repo.deleteProgram(
      workspaceId,
      c.req.param("id"),
      actorOf(c),
      provenanceOf(c),
    );
    if (!result) return c.json({ error: "not found" }, 404);
    // Best-effort AFTER the commit: the rows + ledger are authoritative already.
    for (const key of result.storageKeys) await store.removeQuietly(key);
    return c.json({ ledgerSeq: result.ledgerSeq });
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
      actorOf(c),
      provenanceOf(c),
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
      actorOf(c),
      provenanceOf(c),
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
      actorOf(c),
      provenanceOf(c),
    );
    if (result.outcome === "deleted") {
      return c.json({ program: result.program, ledgerSeq: result.ledgerSeq });
    }
    if (result.outcome === "last_task") {
      return c.json({ error: "a work package must keep at least one task" }, 409);
    }
    return c.json({ error: "not found" }, 404);
  });

  registerTeamRoutes(app, repo, { actorOf });
  registerWorkspaceMemberRoutes(app, repo);
  registerAttachmentRoutes(app, repo, store);
  registerMyTaskRoutes(app, repo);
  registerSearchRoutes(app, repo);
  registerSubtaskRoutes(app, repo, { actorOf, provenanceOf });

  if (assistant && proposals) {
    registerAssistantChatRoute(app, {
      adapter: assistant.adapter,
      proposals,
      ...(assistant.limits === undefined ? {} : { limits: assistant.limits }),
    });
    registerAssistantExecuteRoute(app, { nonce: assistant.nonce, proposals });
  }

  app.get("/api/ledger", async (c) => {
    const workspaceId = c.req.query("workspaceId");
    if (!workspaceId) return c.json({ error: "workspaceId is required" }, 400);
    const entries = await repo.getLedger(workspaceId);
    return c.json({ entries, verification: verifyChain(entries) });
  });

  return app;
}
