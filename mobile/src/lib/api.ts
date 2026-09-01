import type { LedgerResult, Program, TaskStatus } from "./types";

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

let authTokenProvider: (() => string | null) | null = null;

/** Registered once by the auth provider; every request rides the token. */
export function setAuthTokenProvider(fn: () => string | null): void {
  authTokenProvider = fn;
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

export async function listPrograms(base: string, workspaceId: string): Promise<Program[]> {
  const data = await request<{ programs: Program[] }>(
    `${base}/api/programs?workspaceId=${encodeURIComponent(workspaceId)}`,
  );
  return data.programs;
}

export interface CreateProgramInput {
  workspaceId: string;
  mission: string;
  language: "en" | "ar";
}

export function createProgram(
  base: string,
  input: CreateProgramInput,
): Promise<{ program: Program; ledgerSeq: number; generatedBy: string }> {
  return request(`${base}/api/programs`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
}

export interface UpdateTaskStatusInput {
  workspaceId: string;
  programId: string;
  taskId: string;
  status: TaskStatus;
}

export function updateTaskStatus(
  base: string,
  { workspaceId, programId, taskId, status }: UpdateTaskStatusInput,
): Promise<{ program: Program; ledgerSeq: number }> {
  return request(
    `${base}/api/programs/${encodeURIComponent(programId)}/tasks/${encodeURIComponent(taskId)}`,
    {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ workspaceId, status }),
    },
  );
}

export function getLedger(base: string, workspaceId: string): Promise<LedgerResult> {
  return request(`${base}/api/ledger?workspaceId=${encodeURIComponent(workspaceId)}`);
}

/** A workspace member, addressable by username (the Task.assignee value). */
export interface WorkspaceUser {
  username: string;
  firstName?: string;
  lastName?: string;
}

export async function listUsers(base: string, workspaceId: string): Promise<WorkspaceUser[]> {
  const data = await request<{ users: WorkspaceUser[] }>(
    `${base}/api/users?workspaceId=${encodeURIComponent(workspaceId)}`,
  );
  return data.users;
}

/** PATCH payload — any subset of the mutable Task fields; null clears. */
export interface TaskPatch {
  name?: string;
  status?: TaskStatus;
  estimateDays?: number;
  assignee?: string | null;
  startDate?: string | null;
  dueDate?: string | null;
  description?: string | null;
}

export interface TaskMutationResult {
  program: Program;
  ledgerSeq: number;
}

export function updateTask(
  base: string,
  { workspaceId, programId, taskId, patch }: {
    workspaceId: string;
    programId: string;
    taskId: string;
    patch: TaskPatch;
  },
): Promise<TaskMutationResult> {
  return request(
    `${base}/api/programs/${encodeURIComponent(programId)}/tasks/${encodeURIComponent(taskId)}`,
    {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ workspaceId, ...patch }),
    },
  );
}

export function createTask(
  base: string,
  { programId, ...body }: { workspaceId: string; programId: string; packageId: string; name: string },
): Promise<TaskMutationResult> {
  return request(`${base}/api/programs/${encodeURIComponent(programId)}/tasks`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function deleteTask(
  base: string,
  { workspaceId, programId, taskId }: { workspaceId: string; programId: string; taskId: string },
): Promise<TaskMutationResult> {
  const path = `${base}/api/programs/${encodeURIComponent(programId)}/tasks/${encodeURIComponent(taskId)}`;
  return request(`${path}?workspaceId=${encodeURIComponent(workspaceId)}`, { method: "DELETE" });
}

export function addSubtask(
  base: string,
  { programId, taskId, ...body }: {
    workspaceId: string;
    programId: string;
    taskId: string;
    name: string;
  },
): Promise<TaskMutationResult> {
  const path = `${base}/api/programs/${encodeURIComponent(programId)}/tasks/${encodeURIComponent(taskId)}/subtasks`;
  return request(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function updateSubtask(
  base: string,
  { programId, taskId, subtaskId, workspaceId, patch }: {
    workspaceId: string;
    programId: string;
    taskId: string;
    subtaskId: string;
    patch: { name?: string; done?: boolean };
  },
): Promise<TaskMutationResult> {
  const path = `${base}/api/programs/${encodeURIComponent(programId)}/tasks/${encodeURIComponent(taskId)}/subtasks/${encodeURIComponent(subtaskId)}`;
  return request(path, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ workspaceId, ...patch }),
  });
}

export function deleteSubtask(
  base: string,
  { programId, taskId, subtaskId, workspaceId }: {
    workspaceId: string;
    programId: string;
    taskId: string;
    subtaskId: string;
  },
): Promise<TaskMutationResult> {
  const path = `${base}/api/programs/${encodeURIComponent(programId)}/tasks/${encodeURIComponent(taskId)}/subtasks/${encodeURIComponent(subtaskId)}`;
  return request(`${path}?workspaceId=${encodeURIComponent(workspaceId)}`, { method: "DELETE" });
}
