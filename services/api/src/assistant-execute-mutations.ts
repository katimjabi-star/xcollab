import type { z } from "zod";
import type {
  AddSubtaskArgsSchema,
  AddTeamMemberArgsSchema,
  AssistantMutationToolName,
  CreateTaskArgsSchema,
  DeleteTaskArgsSchema,
  Language,
  Program,
  RemoveTeamMemberArgsSchema,
  Subtask,
  Task,
  UpdateTaskArgsSchema,
  WorkspaceTeam,
} from "@xcollab/core";
import { listRealmUsers } from "./users.ts";

/**
 * Per-tool executors for POST /api/assistant/execute: each confirmed proposal
 * dispatches in-process through the REAL route handlers (the Dispatch closure
 * carries the user's bearer token plus the boot nonce, so the ai actor and
 * provenance land automatically). Split out of routes-assistant-execute.ts to
 * keep both files under the repo's max-lines budget.
 */

export type Dispatch = (
  method: "POST" | "PATCH" | "DELETE",
  path: string,
  body?: Record<string, unknown>,
) => Promise<{ status: number; body: unknown }>;

export interface ExecuteOutcome {
  status: number;
  body: unknown;
}

export type MutationResult = {
  program?: Program;
  task?: Task;
  subtask?: Subtask;
  team?: WorkspaceTeam;
  ledgerSeq?: number;
};

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

async function executeDeleteTask(
  dispatch: Dispatch,
  workspaceId: string,
  args: z.infer<typeof DeleteTaskArgsSchema>,
): Promise<ExecuteOutcome> {
  const res = await dispatch(
    "DELETE",
    `/api/programs/${encodeURIComponent(args.programId)}/tasks/${encodeURIComponent(args.taskId)}` +
      `?workspaceId=${encodeURIComponent(workspaceId)}`,
  );
  if (res.status !== 200) return res;
  const body = res.body as { program: Program; ledgerSeq: number };
  return success({ program: body.program, ledgerSeq: body.ledgerSeq });
}

async function executeDeleteProject(
  dispatch: Dispatch,
  workspaceId: string,
  args: Record<string, unknown>,
): Promise<ExecuteOutcome> {
  const res = await dispatch(
    "DELETE",
    `/api/programs/${encodeURIComponent(String(args["programId"]))}` +
      `?workspaceId=${encodeURIComponent(workspaceId)}`,
  );
  if (res.status !== 200) return res;
  return success({ ledgerSeq: (res.body as { ledgerSeq: number }).ledgerSeq });
}

async function executeAddTeamMember(
  dispatch: Dispatch,
  workspaceId: string,
  args: z.infer<typeof AddTeamMemberArgsSchema>,
): Promise<ExecuteOutcome> {
  // The route requires an explicit role; assistant-added members always join
  // as plain members — leads are promoted by humans only.
  const res = await dispatch("POST", `/api/teams/${encodeURIComponent(args.teamId)}/members`, {
    workspaceId,
    username: args.username,
    role: "member",
  });
  if (res.status !== 200) return res;
  return success({ team: (res.body as { team: WorkspaceTeam }).team });
}

async function executeRemoveTeamMember(
  dispatch: Dispatch,
  workspaceId: string,
  args: z.infer<typeof RemoveTeamMemberArgsSchema>,
): Promise<ExecuteOutcome> {
  const res = await dispatch(
    "DELETE",
    `/api/teams/${encodeURIComponent(args.teamId)}/members/${encodeURIComponent(args.username)}` +
      `?workspaceId=${encodeURIComponent(workspaceId)}`,
  );
  if (res.status !== 200) return res;
  return success({ team: (res.body as { team: WorkspaceTeam }).team });
}

async function executeAddSubtask(
  dispatch: Dispatch,
  workspaceId: string,
  args: z.infer<typeof AddSubtaskArgsSchema>,
): Promise<ExecuteOutcome> {
  const res = await dispatch(
    "POST",
    `/api/programs/${encodeURIComponent(args.programId)}/tasks/${encodeURIComponent(args.taskId)}/subtasks`,
    { workspaceId, name: args.name },
  );
  if (res.status !== 201) return res;
  const body = res.body as { program: Program; task: Task; subtask: Subtask; ledgerSeq: number };
  return success({
    program: body.program,
    task: body.task,
    subtask: body.subtask,
    ledgerSeq: body.ledgerSeq,
  });
}

export async function executeMutation(
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
    case "delete_task":
      return executeDeleteTask(dispatch, workspaceId, args as z.infer<typeof DeleteTaskArgsSchema>);
    case "delete_project":
      return executeDeleteProject(dispatch, workspaceId, args);
    case "add_team_member":
      return executeAddTeamMember(
        dispatch,
        workspaceId,
        args as z.infer<typeof AddTeamMemberArgsSchema>,
      );
    case "remove_team_member":
      return executeRemoveTeamMember(
        dispatch,
        workspaceId,
        args as z.infer<typeof RemoveTeamMemberArgsSchema>,
      );
    case "add_subtask":
      return executeAddSubtask(dispatch, workspaceId, args as z.infer<typeof AddSubtaskArgsSchema>);
  }
}

export const DONE_MESSAGES: Record<Language, Record<AssistantMutationToolName, string>> = {
  en: {
    create_project: "Project created.",
    create_task: "Task created.",
    update_task: "Task updated.",
    update_project: "Project team updated.",
    delete_task: "Task deleted.",
    delete_project: "Project deleted.",
    add_team_member: "Team member added.",
    remove_team_member: "Team member removed.",
    add_subtask: "Subtask added.",
  },
  ar: {
    create_project: "تم إنشاء المشروع.",
    create_task: "تم إنشاء المهمة.",
    update_task: "تم تحديث المهمة.",
    update_project: "تم تحديث فريق المشروع.",
    delete_task: "تم حذف المهمة.",
    delete_project: "تم حذف المشروع.",
    add_team_member: "تمت إضافة عضو الفريق.",
    remove_team_member: "تمت إزالة عضو الفريق.",
    add_subtask: "تمت إضافة المهمة الفرعية.",
  },
};
