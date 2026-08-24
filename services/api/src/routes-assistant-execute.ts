import type { Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { z } from "zod";
import {
  ASSISTANT_MUTATION_TOOLS,
  isAssistantMutationTool,
  LanguageSchema,
  type AssistantMutationToolName,
  type CreateTaskArgsSchema,
  type Language,
  type Program,
  type Task,
  type UpdateTaskArgsSchema,
} from "@xcollab/core";
import type { AuthEnv } from "./auth.ts";
import { listRealmUsers } from "./users.ts";
import { stableStringify, type ProposalStore } from "./assistant-proposals.ts";

/**
 * POST /api/assistant/execute (spec §2.2/§2.6) — the ONLY path that runs a
 * mutation the assistant proposed, and only after an explicit user confirm.
 * Args are re-validated against the tool's zod schema and must match the
 * proposal byte-for-byte (single-use proposalId). Execution dispatches
 * in-process through the real route handlers with the user's own bearer
 * token; the boot nonce + context headers flip the ledger actor to
 * {kind:"ai", id:"assistant"} with modelId and requestedBy recorded.
 */

const ExecuteRequestSchema = z.object({
  workspaceId: z.string().min(1),
  proposalId: z.uuid(),
  tool: z.string().min(1),
  args: z.record(z.string(), z.unknown()),
  language: LanguageSchema,
});

export interface AssistantExecuteConfig {
  nonce: string;
  proposals: ProposalStore;
}

type Dispatch = (
  method: "POST" | "PATCH",
  path: string,
  body: Record<string, unknown>,
) => Promise<{ status: number; body: unknown }>;

interface ExecuteOutcome {
  status: number;
  body: unknown;
}

type MutationResult = { program?: Program; task?: Task; ledgerSeq?: number };

function findTask(program: Program, taskId: string): Task | undefined {
  for (const pkg of program.packages) {
    const task = pkg.tasks.find((candidate) => candidate.id === taskId);
    if (task) return task;
  }
  return undefined;
}

function success(result: MutationResult): ExecuteOutcome {
  return { status: 200, body: { result } };
}

async function executeCreateProject(
  dispatch: Dispatch,
  workspaceId: string,
  args: Record<string, unknown>,
): Promise<ExecuteOutcome> {
  const res = await dispatch("POST", "/api/programs", { workspaceId, ...args });
  if (res.status !== 201) return res;
  const body = res.body as { program: Program; ledgerSeq: number };
  return success({ program: body.program, ledgerSeq: body.ledgerSeq });
}

async function executeCreateTask(
  dispatch: Dispatch,
  workspaceId: string,
  args: z.infer<typeof CreateTaskArgsSchema>,
): Promise<ExecuteOutcome> {
  const { programId, assignee, ...task } = args;
  if (assignee !== undefined) {
    // The create route does not accept assignee (spec §2.3): verify BEFORE
    // creating so the follow-up PATCH can only fail on a rare race.
    const users = await listRealmUsers();
    if (!users.some((user) => user.username === assignee)) {
      return { status: 400, body: { error: "unknown_assignee" } };
    }
  }
  const created = await dispatch("POST", `/api/programs/${encodeURIComponent(programId)}/tasks`, {
    workspaceId,
    ...task,
  });
  if (created.status !== 201) return created;
  const createdBody = created.body as { program: Program; task: Task; ledgerSeq: number };
  if (assignee === undefined) return success(createdBody);

  const patched = await dispatch(
    "PATCH",
    `/api/programs/${encodeURIComponent(programId)}/tasks/${encodeURIComponent(createdBody.task.id)}`,
    { workspaceId, assignee },
  );
  if (patched.status !== 200) return patched;
  const patchedBody = patched.body as { program: Program; ledgerSeq: number };
  return success({
    program: patchedBody.program,
    task: findTask(patchedBody.program, createdBody.task.id) ?? createdBody.task,
    ledgerSeq: patchedBody.ledgerSeq,
  });
}

async function executeUpdateTask(
  dispatch: Dispatch,
  workspaceId: string,
  args: z.infer<typeof UpdateTaskArgsSchema>,
): Promise<ExecuteOutcome> {
  const res = await dispatch(
    "PATCH",
    `/api/programs/${encodeURIComponent(args.programId)}/tasks/${encodeURIComponent(args.taskId)}`,
    { workspaceId, ...args.patch },
  );
  if (res.status !== 200) return res;
  const body = res.body as { program: Program; ledgerSeq: number };
  return success({
    program: body.program,
    task: findTask(body.program, args.taskId),
    ledgerSeq: body.ledgerSeq,
  });
}

async function executeUpdateProject(
  dispatch: Dispatch,
  workspaceId: string,
  args: Record<string, unknown>,
): Promise<ExecuteOutcome> {
  const res = await dispatch("PATCH", `/api/programs/${encodeURIComponent(String(args["programId"]))}`, {
    workspaceId,
    teamId: args["teamId"] as string | null,
  });
  if (res.status !== 200) return res;
  return success({ program: (res.body as { program: Program }).program });
}

async function executeMutation(
  dispatch: Dispatch,
  workspaceId: string,
  tool: AssistantMutationToolName,
  args: Record<string, unknown>,
): Promise<ExecuteOutcome> {
  switch (tool) {
    case "create_project":
      return executeCreateProject(dispatch, workspaceId, args);
    case "create_task":
      return executeCreateTask(dispatch, workspaceId, args as z.infer<typeof CreateTaskArgsSchema>);
    case "update_task":
      return executeUpdateTask(dispatch, workspaceId, args as z.infer<typeof UpdateTaskArgsSchema>);
    case "update_project":
      return executeUpdateProject(dispatch, workspaceId, args);
  }
}

const DONE_MESSAGES: Record<Language, Record<AssistantMutationToolName, string>> = {
  en: {
    create_project: "Project created.",
    create_task: "Task created.",
    update_task: "Task updated.",
    update_project: "Project team updated.",
  },
  ar: {
    create_project: "تم إنشاء المشروع.",
    create_task: "تم إنشاء المهمة.",
    update_task: "تم تحديث المهمة.",
    update_project: "تم تحديث فريق المشروع.",
  },
};

export function registerAssistantExecuteRoute(
  app: Hono<AuthEnv>,
  config: AssistantExecuteConfig,
): void {
  app.post("/api/assistant/execute", async (c) => {
    const parsed = ExecuteRequestSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) {
      return c.json({ error: "invalid request", issues: parsed.error.issues }, 400);
    }
    const { workspaceId, proposalId, tool, args, language } = parsed.data;
    if (!isAssistantMutationTool(tool)) return c.json({ error: "unknown_tool" }, 400);
    const validated = ASSISTANT_MUTATION_TOOLS[tool].args.safeParse(args);
    if (!validated.success) {
      return c.json({ error: "invalid request", issues: validated.error.issues }, 400);
    }
    const username = c.get("username");
    const consumed = config.proposals.consume(proposalId, {
      workspaceId,
      username,
      tool,
      argsKey: stableStringify(validated.data),
    });
    if (consumed.outcome === "unknown") {
      return c.json({ error: "unknown_proposal", message: "unknown, used or expired proposal" }, 404);
    }
    if (consumed.outcome === "mismatch") {
      return c.json({ error: "proposal_mismatch", message: "request does not match the proposal" }, 409);
    }

    const headers = {
      authorization: c.req.header("authorization") ?? "",
      "content-type": "application/json",
      "x-xcollab-assistant-nonce": config.nonce,
      "x-xcollab-assistant-context": JSON.stringify({
        requestedBy: username,
        proposalId,
        tool,
        modelId: consumed.record.modelId,
      }),
    };
    const dispatch: Dispatch = async (method, path, body) => {
      const res = await app.request(path, { method, headers, body: JSON.stringify(body) });
      return { status: res.status, body: (await res.json().catch(() => null)) as unknown };
    };

    const outcome = await executeMutation(
      dispatch,
      workspaceId,
      tool,
      validated.data as Record<string, unknown>,
    );
    if (outcome.status !== 200) {
      // Errors map 1:1 to the underlying route's structured errors (§2.2).
      const body = outcome.body ?? { error: "execution_failed" };
      return c.json(body as Record<string, unknown>, outcome.status as ContentfulStatusCode);
    }
    const result = outcome.body as { result: MutationResult };
    return c.json({ ...result, message: DONE_MESSAGES[language][tool] });
  });
}
