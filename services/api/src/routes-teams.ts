import type { Context, Hono } from "hono";
import { z } from "zod";
import { TeamMemberSchema, WorkspaceTeamSchema } from "@xcollab/core";
import type { AuthEnv } from "./auth.ts";
import type { TeamMutationResult, WorkGraphRepository } from "./repository.ts";
import type { ActorResolver } from "./assistant-actor.ts";
import { listRealmUsers } from "./users.ts";

const CreateTeamRequestSchema = z.object({
  workspaceId: z.string().min(1),
  name: WorkspaceTeamSchema.shape.name,
  description: WorkspaceTeamSchema.shape.description,
});

const UpdateTeamRequestSchema = z
  .object({
    workspaceId: z.string().min(1),
    name: WorkspaceTeamSchema.shape.name.optional(),
    description: WorkspaceTeamSchema.shape.description,
  })
  .refine((body) => body.name !== undefined || body.description !== undefined, {
    message: "at least one team field is required",
  });

const AddMemberRequestSchema = z.object({
  workspaceId: z.string().min(1),
  username: TeamMemberSchema.shape.username,
  role: TeamMemberSchema.shape.role,
});

function respond(c: Context<AuthEnv>, result: TeamMutationResult): Response {
  switch (result.outcome) {
    case "ok":
      return c.json({ team: result.team });
    case "already_member":
      return c.json({ error: "already_member" }, 409);
    case "last_lead":
      return c.json({ error: "last_lead" }, 409);
    default:
      return c.json({ error: "not_found" }, 404);
  }
}

/**
 * Team + user routes; auth middleware is already installed on /api/* by
 * app.ts. The actor comes from the shared resolver so an assistant-confirmed
 * team mutation ledgers as {kind:"ai", id:"assistant"} (spec §2.6), while a
 * direct call stays the human user.
 */
export function registerTeamRoutes(
  app: Hono<AuthEnv>,
  repo: WorkGraphRepository,
  actors: Pick<ActorResolver, "actorOf">,
): void {
  const actorOf = actors.actorOf;

  app.get("/api/users", async (c) => {
    if (!c.req.query("workspaceId")) return c.json({ error: "workspaceId is required" }, 400);
    return c.json({ users: await listRealmUsers() });
  });

  app.get("/api/teams", async (c) => {
    const workspaceId = c.req.query("workspaceId");
    if (!workspaceId) return c.json({ error: "workspaceId is required" }, 400);
    return c.json({ teams: await repo.teams.list(workspaceId) });
  });

  app.post("/api/teams", async (c) => {
    const parsed = CreateTeamRequestSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) {
      return c.json({ error: "invalid request", issues: parsed.error.issues }, 400);
    }
    const { workspaceId, ...input } = parsed.data;
    const { team } = await repo.teams.create(workspaceId, input, actorOf(c));
    return c.json({ team }, 201);
  });

  app.patch("/api/teams/:id", async (c) => {
    const parsed = UpdateTeamRequestSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) {
      return c.json({ error: "invalid request", issues: parsed.error.issues }, 400);
    }
    const { workspaceId, ...changes } = parsed.data;
    const result = await repo.teams.update(workspaceId, c.req.param("id"), changes, actorOf(c));
    return respond(c, result);
  });

  app.post("/api/teams/:id/members", async (c) => {
    const parsed = AddMemberRequestSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) {
      return c.json({ error: "invalid request", issues: parsed.error.issues }, 400);
    }
    const { workspaceId, username, role } = parsed.data;
    const users = await listRealmUsers();
    if (!users.some((u) => u.username === username)) {
      return c.json({ error: "unknown_user" }, 422);
    }
    const result = await repo.teams.addMember(
      workspaceId,
      c.req.param("id"),
      { username, role },
      actorOf(c),
    );
    return respond(c, result);
  });

  app.delete("/api/teams/:id/members/:username", async (c) => {
    const workspaceId = c.req.query("workspaceId");
    if (!workspaceId) return c.json({ error: "workspaceId is required" }, 400);
    const result = await repo.teams.removeMember(
      workspaceId,
      c.req.param("id"),
      c.req.param("username"),
      actorOf(c),
    );
    return respond(c, result);
  });

  app.delete("/api/teams/:id", async (c) => {
    const workspaceId = c.req.query("workspaceId");
    if (!workspaceId) return c.json({ error: "workspaceId is required" }, 400);
    const result = await repo.teams.remove(workspaceId, c.req.param("id"), actorOf(c));
    return result.deleted ? c.json({ deleted: true }) : c.json({ error: "not_found" }, 404);
  });
}
