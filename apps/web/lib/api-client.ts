import type { LedgerEntry, Program, Task } from "@xcollab/core";

export const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
export const WORKSPACE = "hq";

export interface CreateProgramInput {
  workspaceId: string;
  mission: string;
  language: "en" | "ar";
  timeline?: { start: string; end: string };
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

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
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

export function getLedger(base: string, workspaceId: string): Promise<LedgerResult> {
  return request<LedgerResult>(`${base}/api/ledger?workspaceId=${encodeURIComponent(workspaceId)}`);
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
