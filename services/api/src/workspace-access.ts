import type { Context, MiddlewareHandler } from "hono";
import type { AuthEnv } from "./auth.ts";
import type { WorkspaceMembersRepository } from "./repository-members.ts";

/**
 * Workspace-level authorization — the ONE enforcement point for every route
 * that names a workspaceId (path, query, or body). Rules:
 *   - claimed workspace, caller not a member  -> 403 {error:"forbidden"}
 *   - unclaimed workspace, read               -> pass (empty lists / 404s)
 *   - unclaimed workspace, mutation           -> caller claims it as owner
 * /api/users is realm directory data, not workspace data: authenticated-only.
 * Owner-vs-member distinctions (member management) are enforced inside the
 * membership repository's transactions, not here.
 */

const READ_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const EXEMPT_PATHS = new Set(["/api/users"]);
const WORKSPACE_PATH = /^\/api\/workspaces\/([^/]+)(?:\/|$)/;

function pathWorkspaceId(path: string): string | undefined {
  const raw = WORKSPACE_PATH.exec(path)?.[1];
  if (raw === undefined) return undefined;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

/**
 * Mirrors where the routes themselves read workspaceId from a request body:
 * JSON for the api routes, form fields for the multipart attachment upload.
 * Hono caches parsed bodies, so the downstream handler's own parse re-reads
 * the cache instead of a consumed stream.
 */
async function bodyWorkspaceId(c: Context<AuthEnv>): Promise<string | undefined> {
  const contentType = c.req.header("content-type") ?? "";
  try {
    if (contentType.includes("application/json")) {
      const body: unknown = await c.req.json();
      const candidate = (body as { workspaceId?: unknown } | null)?.workspaceId;
      return typeof candidate === "string" && candidate !== "" ? candidate : undefined;
    }
    if (
      contentType.includes("multipart/form-data") ||
      contentType.includes("application/x-www-form-urlencoded")
    ) {
      const body = await c.req.parseBody();
      const candidate = body["workspaceId"];
      return typeof candidate === "string" && candidate !== "" ? candidate : undefined;
    }
  } catch {
    return undefined; // Unparseable body: the route's own validation answers.
  }
  return undefined;
}

/** Every workspaceId the request names; all of them must be authorized. */
async function workspaceIdsOf(c: Context<AuthEnv>, isRead: boolean): Promise<Set<string>> {
  const ids = new Set<string>();
  const fromPath = pathWorkspaceId(c.req.path);
  if (fromPath !== undefined) ids.add(fromPath);
  const fromQuery = c.req.query("workspaceId");
  if (fromQuery !== undefined && fromQuery !== "") ids.add(fromQuery);
  if (!isRead) {
    const fromBody = await bodyWorkspaceId(c);
    if (fromBody !== undefined) ids.add(fromBody);
  }
  return ids;
}

export function createWorkspaceAccessMiddleware(
  members: WorkspaceMembersRepository,
): MiddlewareHandler<AuthEnv> {
  return async (c, next) => {
    if (EXEMPT_PATHS.has(c.req.path)) return next();
    const isRead = READ_METHODS.has(c.req.method);
    const username = c.get("username");
    for (const workspaceId of await workspaceIdsOf(c, isRead)) {
      const access = isRead
        ? await members.access(workspaceId, username)
        : await members.claimOrAccess(workspaceId, username);
      if (access.claimed && access.role === null) {
        return c.json({ error: "forbidden" }, 403);
      }
    }
    return next();
  };
}
