import type { LedgerEntry, Program } from "@xcollab/core";

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
