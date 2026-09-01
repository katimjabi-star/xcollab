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
