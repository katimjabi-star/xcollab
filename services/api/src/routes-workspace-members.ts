import type { Context, Hono } from "hono";
import { z } from "zod";
import type { AuthEnv } from "./auth.ts";
import type { LedgerActor, WorkGraphRepository } from "./repository.ts";
import type { MemberMutationResult } from "./repository-members.ts";
import { listRealmUsers } from "./users.ts";

/** Only plain members can be added; ownership exists solely via the claim. */
const AddWorkspaceMemberRequestSchema = z.object({
  username: z.string().trim().min(1).max(200),
  role: z.literal("member"),
});

function respond(c: Context<AuthEnv>, result: MemberMutationResult): Response {
  switch (result.outcome) {
    case "ok":
      return c.json({ members: result.members });
    case "forbidden":
      return c.json({ error: "forbidden" }, 403);
    case "already_member":
      return c.json({ error: "already_member" }, 409);
    case "last_owner":
      return c.json({ error: "last_owner" }, 409);
    default:
      return c.json({ error: "not_found" }, 404);
  }
}

/**
 * Workspace membership management. The workspace-access middleware has
 * already rejected non-members (and claimed an unclaimed workspace for the
 * caller); the owner-only rule for mutations is enforced inside the
 * repository transaction. Membership is human-administered — never an
 * assistant tool — so the actor is always the verified token user.
 */
export function registerWorkspaceMemberRoutes(
  app: Hono<AuthEnv>,
  repo: WorkGraphRepository,
): void {
  const humanActor = (c: Context<AuthEnv>): LedgerActor => ({
    kind: "human",
    id: c.get("username"),
  });

  app.get("/api/workspaces/:id/members", async (c) => {
    return c.json({ members: await repo.members.list(c.req.param("id")) });
  });

  app.post("/api/workspaces/:id/members", async (c) => {
    const parsed = AddWorkspaceMemberRequestSchema.safeParse(
      await c.req.json().catch(() => null),
    );
    if (!parsed.success) {
      return c.json({ error: "invalid request", issues: parsed.error.issues }, 400);
    }
    const users = await listRealmUsers();
    if (!users.some((u) => u.username === parsed.data.username)) {
      return c.json({ error: "unknown_user" }, 422);
    }
    const result = await repo.members.add(c.req.param("id"), humanActor(c), parsed.data);
    return respond(c, result);
  });

  app.delete("/api/workspaces/:id/members/:username", async (c) => {
    const result = await repo.members.remove(
      c.req.param("id"),
      humanActor(c),
      c.req.param("username"),
    );
    return respond(c, result);
  });
}
