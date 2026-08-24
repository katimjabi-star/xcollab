import type { Hono } from "hono";
import { z } from "zod";
import { SubtaskSchema } from "@xcollab/core";
import type { AuthEnv } from "./auth.ts";
import type { WorkGraphRepository, SubtaskFieldChanges } from "./repository.ts";
import type { ActorResolver } from "./assistant-actor.ts";

const AddSubtaskRequestSchema = z.object({
  workspaceId: z.string().min(1),
  name: SubtaskSchema.shape.name,
});

const UpdateSubtaskRequestSchema = z
  .object({
    workspaceId: z.string().min(1),
    name: SubtaskSchema.shape.name.optional(),
    done: SubtaskSchema.shape.done.optional(),
  })
  .refine((body) => body.name !== undefined || body.done !== undefined, {
    message: "at least one of name or done is required",
  });

const BASE = "/api/programs/:programId/tasks/:taskId/subtasks";

/**
 * Checklist subtask routes; auth middleware is already installed on /api/* by
 * app.ts. Actor and provenance come from the shared resolver, so an
 * assistant-confirmed call ledgers as the ai actor with its audit context.
 */
export function registerSubtaskRoutes(
  app: Hono<AuthEnv>,
  repo: WorkGraphRepository,
  actors: Pick<ActorResolver, "actorOf" | "provenanceOf">,
): void {
  app.post(BASE, async (c) => {
    const parsed = AddSubtaskRequestSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) {
      return c.json({ error: "invalid request", issues: parsed.error.issues }, 400);
    }
    const result = await repo.subtasks.add(
      parsed.data.workspaceId,
      c.req.param("programId"),
      c.req.param("taskId"),
      parsed.data.name,
      actors.actorOf(c),
      actors.provenanceOf(c),
    );
    if (result.outcome === "added") {
      const { program, task, subtask, ledgerSeq } = result;
      return c.json({ program, task, subtask, ledgerSeq }, 201);
    }
    if (result.outcome === "limit") {
      return c.json({ error: "a task may have at most 50 subtasks" }, 409);
    }
    return c.json({ error: "not found" }, 404);
  });

  app.patch(`${BASE}/:subtaskId`, async (c) => {
    const parsed = UpdateSubtaskRequestSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) {
      return c.json({ error: "invalid request", issues: parsed.error.issues }, 400);
    }
    const changes: SubtaskFieldChanges = {
      ...(parsed.data.name === undefined ? {} : { name: parsed.data.name }),
      ...(parsed.data.done === undefined ? {} : { done: parsed.data.done }),
    };
    const result = await repo.subtasks.update(
      parsed.data.workspaceId,
      c.req.param("programId"),
      c.req.param("taskId"),
      c.req.param("subtaskId"),
      changes,
      actors.actorOf(c),
      actors.provenanceOf(c),
    );
    return result ? c.json(result) : c.json({ error: "not found" }, 404);
  });

  app.delete(`${BASE}/:subtaskId`, async (c) => {
    const workspaceId = c.req.query("workspaceId");
    if (!workspaceId) return c.json({ error: "workspaceId is required" }, 400);
    const result = await repo.subtasks.remove(
      workspaceId,
      c.req.param("programId"),
      c.req.param("taskId"),
      c.req.param("subtaskId"),
      actors.actorOf(c),
      actors.provenanceOf(c),
    );
    return result ? c.json(result) : c.json({ error: "not found" }, 404);
  });
}
