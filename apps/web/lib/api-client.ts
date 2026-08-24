import type { LedgerEntry, Program, Task } from "@xcollab/core";

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

/* Program.teamId ships in @xcollab/core together with the backend drop; until
   that lands the field is read through this widening so typecheck stays green
   (packages/core is not ours to edit). */
type ProgramTeamFields = { teamId?: string | null };

/** The program's connected team id, or null when unset. */
export function programTeamId(program: Program): string | null {
  return (program as Program & ProgramTeamFields).teamId ?? null;
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

async function request<T>(url: string, init?: RequestInit): Promise<T> {
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

/** A workspace member, addressable by username (the Task.assignee value). */
export interface WorkspaceUser {
  username: string;
  firstName: string;
  lastName: string;
  email: string;
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
