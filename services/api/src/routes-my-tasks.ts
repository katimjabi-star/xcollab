import type { Hono } from "hono";
import type { AuthEnv } from "./auth.ts";
import type { WorkGraphRepository } from "./repository.ts";
import { listAssignedTasks } from "./repository-my-tasks.ts";

/**
 * Personal task aggregate; auth middleware is already installed on /api/* by
 * app.ts, so c.get("username") is the verified token preferred_username.
 * Read-only: never appends to the ledger.
 */
export function registerMyTaskRoutes(app: Hono<AuthEnv>, repo: WorkGraphRepository): void {
  app.get("/api/users/me/tasks", async (c) => {
    const workspaceId = c.req.query("workspaceId");
    if (!workspaceId) return c.json({ error: "workspaceId is required" }, 400);
    return c.json({ tasks: await listAssignedTasks(repo, workspaceId, c.get("username")) });
  });
}
