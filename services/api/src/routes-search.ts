import type { Hono } from "hono";
import { z } from "zod";
import { TaskStatusSchema } from "@xcollab/core";
import type { AuthEnv } from "./auth.ts";
import type { WorkGraphRepository } from "./repository.ts";
import { searchWorkspaceTasks } from "./repository-search.ts";

/** Query params mirror the search_tasks assistant tool (spec §2.3/§2.4). */
const SearchTasksQuerySchema = z.object({
  workspaceId: z.string().min(1),
  programId: z.string().min(1).optional(),
  status: TaskStatusSchema.optional(),
  /** A username, or "me" for the verified token user. */
  assignee: z.string().min(1).max(200).optional(),
  overdue: z
    .enum(["true", "false"])
    .transform((flag) => flag === "true")
    .optional(),
  dueBefore: z.iso.date().optional(),
  dueAfter: z.iso.date().optional(),
  text: z.string().min(1).max(200).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

/**
 * GET /api/tasks — workspace-wide read-only task search (no ledger write,
 * like /api/users/me/tasks). Auth middleware is already installed on /api/*.
 * "Overdue" compares dueDate < today in the API's clock — the one documented
 * new Date() lives here so the repository stays clock-free.
 */
export function registerSearchRoutes(app: Hono<AuthEnv>, repo: WorkGraphRepository): void {
  app.get("/api/tasks", async (c) => {
    const parsed = SearchTasksQuerySchema.safeParse(c.req.query());
    if (!parsed.success) {
      return c.json({ error: "invalid request", issues: parsed.error.issues }, 400);
    }
    const { workspaceId, assignee, ...filters } = parsed.data;
    const today = new Date().toISOString().slice(0, 10);
    const tasks = await searchWorkspaceTasks(
      repo,
      workspaceId,
      { ...filters, ...(assignee === undefined ? {} : { assignee: resolveMe(assignee, c) }) },
      today,
    );
    return c.json({ tasks });
  });
}

function resolveMe(assignee: string, c: { get: (key: "username") => string }): string {
  return assignee === "me" ? c.get("username") : assignee;
}
