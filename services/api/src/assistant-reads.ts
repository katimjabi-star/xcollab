import type { Hono } from "hono";
import type { Program } from "@xcollab/core";
import type { AssistantReadToolName } from "@xcollab/core";
import type { AuthEnv } from "./auth.ts";

/**
 * READ tool execution for the agent loop (spec §2.3/§2.5): every tool is an
 * in-process GET through the real routes — cors, no-store, bearer auth and
 * route validation all re-run — with the user's own Authorization header.
 * Results are digested so the model sees ids and structure, never raw
 * description walls (prompt-injection surface + context budget).
 */

export interface ReadToolContext {
  app: Hono<AuthEnv>;
  authorization: string;
  workspaceId: string;
  /** ISO date in the api's clock, injected once per turn. */
  today: string;
}

export interface ReadToolOutcome {
  ok: boolean;
  result: unknown;
}

const DESCRIPTION_PREVIEW = 200;

async function getJson(ctx: ReadToolContext, path: string): Promise<{ status: number; body: unknown }> {
  const res = await ctx.app.request(path, { headers: { authorization: ctx.authorization } });
  const body: unknown = await res.json().catch(() => null);
  return { status: res.status, body };
}

/* The loop's truncator sheds trailing ARRAY ITEMS, so a full outline that
   overflows the digest cap silently dropped whole projects and made them
   unresolvable by name (cross-test defect 1). When full outlines don't fit,
   fall back to a lean index (no tasks) that keeps EVERY project present;
   task refs then resolve via search_tasks. */
const OUTLINE_DIGEST_BUDGET = 8_000;

export function projectsIndex(programs: Program[]): unknown[] {
  const full = programs.map(projectOutline);
  if (JSON.stringify(full).length <= OUTLINE_DIGEST_BUDGET) return full;
  return programs.map((program) => ({
    id: program.id,
    name: program.name,
    language: program.language,
    packages: program.packages.map((pkg) => ({ id: pkg.id, name: pkg.name })),
  }));
}

/** Lean outline WITH task ids/names: the reference snapshot the model (and
    the deterministic intent parser) resolves every id from — ids are never
    invented, so they must all be discoverable here. */
function projectOutline(program: Program): Record<string, unknown> {
  return {
    id: program.id,
    name: program.name,
    language: program.language,
    packages: program.packages.map((pkg) => ({
      id: pkg.id,
      name: pkg.name,
      tasks: pkg.tasks.map((task) => ({ id: task.id, name: task.name, status: task.status })),
    })),
  };
}

function projectDetail(program: Program): Record<string, unknown> {
  return {
    ...projectOutline(program),
    timeline: program.timeline,
    teamId: program.teamId ?? null,
    mission: program.mission.slice(0, DESCRIPTION_PREVIEW),
    milestones: program.milestones,
    risks: program.risks,
    packages: program.packages.map((pkg) => ({
      id: pkg.id,
      name: pkg.name,
      tasks: pkg.tasks.map((task) => ({
        id: task.id,
        name: task.name,
        status: task.status,
        assignee: task.assignee ?? null,
        startDate: task.startDate ?? null,
        dueDate: task.dueDate ?? null,
        estimateDays: task.estimateDays,
      })),
    })),
  };
}

/** Deterministic digest (spec §2.3): the model narrates this, it never computes it. */
export function projectSummaryDigest(program: Program, today: string): Record<string, unknown> {
  const statusCounts = { todo: 0, in_progress: 0, blocked: 0, done: 0 };
  let overdueCount = 0;
  const packages = program.packages.map((pkg) => {
    let done = 0;
    for (const task of pkg.tasks) {
      statusCounts[task.status] += 1;
      if (task.status === "done") done += 1;
      else if (task.dueDate && task.dueDate < today) overdueCount += 1;
    }
    return { id: pkg.id, name: pkg.name, doneCount: done, taskCount: pkg.tasks.length };
  });
  const nextMilestone =
    [...program.milestones].sort((a, b) => (a.dueDate < b.dueDate ? -1 : 1)).find(
      (milestone) => milestone.dueDate >= today,
    ) ?? null;
  return {
    programId: program.id,
    name: program.name,
    statusCounts,
    overdueCount,
    nextMilestone,
    risks: program.risks.map((risk) => ({ id: risk.id, title: risk.title, severity: risk.severity })),
    packages,
  };
}

async function fetchProgram(
  ctx: ReadToolContext,
  programId: string,
): Promise<{ ok: boolean; program?: Program; result?: unknown }> {
  const { status, body } = await getJson(
    ctx,
    `/api/programs/${encodeURIComponent(programId)}?workspaceId=${encodeURIComponent(ctx.workspaceId)}`,
  );
  if (status !== 200) return { ok: false, result: body ?? { error: `status ${status}` } };
  return { ok: true, program: (body as { program: Program }).program };
}

function searchQuery(ctx: ReadToolContext, args: Record<string, unknown>): string {
  const params = new URLSearchParams({ workspaceId: ctx.workspaceId });
  for (const [key, value] of Object.entries(args)) {
    if (value !== undefined) params.set(key, String(value));
  }
  return `/api/tasks?${params.toString()}`;
}

/** Realm users stripped to identity fields — emails never enter model context. */
function usersDigest(body: unknown): unknown {
  const users = (body as { users?: { username: string; firstName?: string; lastName?: string }[] })
    .users;
  if (!Array.isArray(users)) return body;
  return users.map((user) => ({
    username: user.username,
    ...(user.firstName === undefined ? {} : { firstName: user.firstName }),
    ...(user.lastName === undefined ? {} : { lastName: user.lastName }),
  }));
}

export async function executeReadTool(
  ctx: ReadToolContext,
  tool: AssistantReadToolName,
  args: Record<string, unknown>,
): Promise<ReadToolOutcome> {
  const ws = encodeURIComponent(ctx.workspaceId);
  switch (tool) {
    case "search_tasks": {
      const { status, body } = await getJson(ctx, searchQuery(ctx, args));
      return { ok: status === 200, result: body };
    }
    case "list_projects": {
      const { status, body } = await getJson(ctx, `/api/programs?workspaceId=${ws}`);
      if (status !== 200) return { ok: false, result: body };
      const programs = (body as { programs: Program[] }).programs;
      return { ok: true, result: projectsIndex(programs) };
    }
    case "get_project": {
      const fetched = await fetchProgram(ctx, String(args["programId"]));
      if (!fetched.ok || !fetched.program) return { ok: false, result: fetched.result };
      return { ok: true, result: projectDetail(fetched.program) };
    }
    case "get_project_summary": {
      const fetched = await fetchProgram(ctx, String(args["programId"]));
      if (!fetched.ok || !fetched.program) return { ok: false, result: fetched.result };
      return { ok: true, result: projectSummaryDigest(fetched.program, ctx.today) };
    }
    case "list_users": {
      const { status, body } = await getJson(ctx, `/api/users?workspaceId=${ws}`);
      return { ok: status === 200, result: status === 200 ? usersDigest(body) : body };
    }
    case "list_teams": {
      const { status, body } = await getJson(ctx, `/api/teams?workspaceId=${ws}`);
      return { ok: status === 200, result: body };
    }
  }
}
