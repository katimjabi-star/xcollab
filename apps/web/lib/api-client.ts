import type { LedgerEntry, Program, Subtask, Task } from "@xcollab/core";

export const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
export const WORKSPACE = "hq";

export interface CreateProgramInput {
  workspaceId: string;
  mission: string;
  language: "en" | "ar";
  timeline?: { start: string; end: string };
  /** Optional parent program id — the API answers 422 "unknown_parent" if bad. */
  parentId?: string;
  /** Optional connected team id — the API answers 422 "unknown_team" if bad. */
  teamId?: string;
}

/** The program's connected team id, or null when unset. */
export function programTeamId(program: Program): string | null {
  return program.teamId ?? null;
}

export interface CreateProgramResult {
  program: Program;
  ledgerSeq: number;
  generatedBy: string;
}

export interface LedgerResult {
  entries: LedgerEntry[];
  verification: { valid: boolean; reason?: string };
}

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

let authTokenProvider: (() => string | null) | null = null;

/**
 * Register the access-token source (called once by AuthProvider). When the
 * provider returns a token, every request carries "Authorization: Bearer";
 * otherwise requests go out bare and a 401 surfaces as ApiError(401).
 */
export function setAuthTokenProvider(fn: () => string | null): void {
  authTokenProvider = fn;
}

/** Current access token (or null) — for clients that build their own fetch,
    e.g. the assistant SSE stream in api-assistant.ts. */
export function currentAuthToken(): string | null {
  return authTokenProvider ? authTokenProvider() : null;
}

export async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  const token = authTokenProvider ? authTokenProvider() : null;
  if (token) headers.set("authorization", `Bearer ${token}`);
  const response = await fetch(url, { ...init, headers });
  if (!response.ok) {
    throw new ApiError(response.status, `${init?.method ?? "GET"} ${url} → ${response.status}`);
  }
  return (await response.json()) as T;
}

export function createProgram(base: string, input: CreateProgramInput): Promise<CreateProgramResult> {
  return request<CreateProgramResult>(`${base}/api/programs`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function listPrograms(base: string, workspaceId: string): Promise<Program[]> {
  const data = await request<{ programs: Program[] }>(
    `${base}/api/programs?workspaceId=${encodeURIComponent(workspaceId)}`,
  );
  return data.programs;
}

export interface UpdateProgramTeamInput {
  workspaceId: string;
  programId: string;
  /** Team to connect, or null to disconnect. */
  teamId: string | null;
}

/** PATCH /api/programs/:id — connect/disconnect a team (422 unknown_team). */
export async function updateProgramTeam(
  base: string,
  { workspaceId, programId, teamId }: UpdateProgramTeamInput,
): Promise<Program> {
  const data = await request<{ program: Program }>(
    `${base}/api/programs/${encodeURIComponent(programId)}`,
    {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ workspaceId, teamId }),
    },
  );
  return data.program;
}

export function getLedger(base: string, workspaceId: string): Promise<LedgerResult> {
  return request<LedgerResult>(`${base}/api/ledger?workspaceId=${encodeURIComponent(workspaceId)}`);
}

/** A workspace member, addressable by username (the Task.assignee value).
    The API strips everything else (email is PII and never served). */
export interface WorkspaceUser {
  username: string;
  firstName?: string;
  lastName?: string;
}

export async function listUsers(
  base: string,
  { workspaceId }: { workspaceId: string },
): Promise<WorkspaceUser[]> {
  const data = await request<{ users: WorkspaceUser[] }>(
    `${base}/api/users?workspaceId=${encodeURIComponent(workspaceId)}`,
  );
  return data.users;
}

export interface UpdateTaskStatusInput {
  workspaceId: string;
  programId: string;
  taskId: string;
  status: Task["status"];
}

export interface UpdateTaskStatusResult {
  program: Program;
  ledgerSeq: number;
}

export function updateTaskStatus(
  base: string,
  { workspaceId, programId, taskId, status }: UpdateTaskStatusInput,
): Promise<UpdateTaskStatusResult> {
  return request<UpdateTaskStatusResult>(
    `${base}/api/programs/${encodeURIComponent(programId)}/tasks/${encodeURIComponent(taskId)}`,
    {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ workspaceId, status }),
    },
  );
}

/**
 * PATCH payload — any subset of the mutable Task fields. String-valued
 * optional fields accept `null`, meaning "clear the field" server-side.
 */
export interface TaskPatch {
  name?: string;
  status?: Task["status"];
  estimateDays?: number;
  assigneeRole?: string | null;
  /** Username of the assigned workspace member; null unassigns. */
  assignee?: string | null;
  startDate?: string | null;
  dueDate?: string | null;
  description?: string | null;
}

export interface UpdateTaskInput {
  workspaceId: string;
  programId: string;
  taskId: string;
  patch: TaskPatch;
}

export interface TaskMutationResult {
  program: Program;
  ledgerSeq: number;
}

export function updateTask(
  base: string,
  { workspaceId, programId, taskId, patch }: UpdateTaskInput,
): Promise<TaskMutationResult> {
  return request<TaskMutationResult>(
    `${base}/api/programs/${encodeURIComponent(programId)}/tasks/${encodeURIComponent(taskId)}`,
    {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ workspaceId, ...patch }),
    },
  );
}

export interface CreateTaskInput {
  workspaceId: string;
  programId: string;
  packageId: string;
  name: string;
  estimateDays?: number;
  assigneeRole?: string;
  startDate?: string;
  dueDate?: string;
  description?: string;
}

export interface CreateTaskResult {
  program: Program;
  task: Task;
  ledgerSeq: number;
}

export function createTask(
  base: string,
  { programId, ...body }: CreateTaskInput,
): Promise<CreateTaskResult> {
  return request<CreateTaskResult>(
    `${base}/api/programs/${encodeURIComponent(programId)}/tasks`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    },
  );
}

export interface UpdateProgramNameInput {
  workspaceId: string;
  programId: string;
  name: string;
}

/** Renames a program (ledgered "program.update"). */
export function updateProgramName(
  base: string,
  { programId, ...body }: UpdateProgramNameInput,
): Promise<{ program: Program }> {
  return request<{ program: Program }>(
    `${base}/api/programs/${encodeURIComponent(programId)}`,
    {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    },
  );
}

export interface AddSubtaskInput {
  workspaceId: string;
  programId: string;
  taskId: string;
  name: string;
}

export interface SubtaskMutationResult {
  program: Program;
  task: Task;
  subtask: Subtask;
  ledgerSeq: number;
}

/** POST a checklist subtask (409 at the 50-per-task cap). */
export function addSubtask(
  base: string,
  { programId, taskId, ...body }: AddSubtaskInput,
): Promise<SubtaskMutationResult> {
  return request<SubtaskMutationResult>(
    `${base}/api/programs/${encodeURIComponent(programId)}/tasks/${encodeURIComponent(taskId)}/subtasks`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    },
  );
}

/** PATCH payload — any subset of the mutable subtask fields. */
export interface SubtaskPatch {
  name?: string;
  done?: boolean;
}

export interface UpdateSubtaskInput {
  workspaceId: string;
  programId: string;
  taskId: string;
  subtaskId: string;
  patch: SubtaskPatch;
}

export function updateSubtask(
  base: string,
  { workspaceId, programId, taskId, subtaskId, patch }: UpdateSubtaskInput,
): Promise<SubtaskMutationResult> {
  const path = `${base}/api/programs/${encodeURIComponent(programId)}/tasks/${encodeURIComponent(taskId)}/subtasks/${encodeURIComponent(subtaskId)}`;
  return request<SubtaskMutationResult>(path, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ workspaceId, ...patch }),
  });
}

export interface DeleteSubtaskInput {
  workspaceId: string;
  programId: string;
  taskId: string;
  subtaskId: string;
}

export function deleteSubtask(
  base: string,
  { workspaceId, programId, taskId, subtaskId }: DeleteSubtaskInput,
): Promise<TaskMutationResult> {
  const path = `${base}/api/programs/${encodeURIComponent(programId)}/tasks/${encodeURIComponent(taskId)}/subtasks/${encodeURIComponent(subtaskId)}`;
  return request<TaskMutationResult>(`${path}?workspaceId=${encodeURIComponent(workspaceId)}`, {
    method: "DELETE",
  });
}

export interface DeleteProgramInput {
  workspaceId: string;
  programId: string;
}

/** Deletes a program and all its contents (ledgered "program.delete"). */
export function deleteProgram(
  base: string,
  { workspaceId, programId }: DeleteProgramInput,
): Promise<{ ledgerSeq: number }> {
  const path = `${base}/api/programs/${encodeURIComponent(programId)}`;
  return request<{ ledgerSeq: number }>(`${path}?workspaceId=${encodeURIComponent(workspaceId)}`, {
    method: "DELETE",
  });
}

export interface DeleteTaskInput {
  workspaceId: string;
  programId: string;
  taskId: string;
}

export function deleteTask(
  base: string,
  { workspaceId, programId, taskId }: DeleteTaskInput,
): Promise<TaskMutationResult> {
  const path = `${base}/api/programs/${encodeURIComponent(programId)}/tasks/${encodeURIComponent(taskId)}`;
  return request<TaskMutationResult>(`${path}?workspaceId=${encodeURIComponent(workspaceId)}`, {
    method: "DELETE",
  });
}
