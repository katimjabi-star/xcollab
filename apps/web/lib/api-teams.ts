import { ApiError } from "./api-client.ts";

/* Typed client for the teams/users contract (backend ships in parallel).
   api-client.ts keeps its request() helper and Bearer-token provider module-
   private, so this sheet mirrors the same pattern 1:1 instead of importing
   internals: pages register useAuth().getToken via setTeamsAuthTokenProvider
   before their first fetch effect runs. Non-2xx surfaces as the same ApiError
   type, so callers branch on .status (409 = last_lead / already_member,
   endpoint-dependent per the fixed contract). */

export interface WorkspaceUser {
  username: string;
  firstName: string;
  lastName: string;
  email: string;
}

export type TeamRole = "lead" | "member";

export interface TeamMember {
  username: string;
  role: TeamRole;
}

export interface Team {
  id: string;
  name: string;
  description?: string;
  members: TeamMember[];
}

let authTokenProvider: (() => string | null) | null = null;

/** Register the access-token source (mirror of api-client's private wiring). */
export function setTeamsAuthTokenProvider(fn: () => string | null): void {
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

export async function listUsers(base: string, workspaceId: string): Promise<WorkspaceUser[]> {
  const data = await request<{ users: WorkspaceUser[] }>(
    `${base}/api/users?workspaceId=${encodeURIComponent(workspaceId)}`,
  );
  return data.users;
}

export async function listTeams(base: string, workspaceId: string): Promise<Team[]> {
  const data = await request<{ teams: Team[] }>(
    `${base}/api/teams?workspaceId=${encodeURIComponent(workspaceId)}`,
  );
  return data.teams;
}

export interface CreateTeamInput {
  workspaceId: string;
  name: string;
  description?: string;
}

export async function createTeam(base: string, input: CreateTeamInput): Promise<Team> {
  const data = await request<{ team: Team }>(`${base}/api/teams`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  return data.team;
}

/** PATCH payload — any subset of the mutable team fields. */
export interface TeamPatch {
  name?: string;
  description?: string;
}

export interface UpdateTeamInput {
  workspaceId: string;
  teamId: string;
  patch: TeamPatch;
}

export async function updateTeam(
  base: string,
  { workspaceId, teamId, patch }: UpdateTeamInput,
): Promise<Team> {
  const data = await request<{ team: Team }>(
    `${base}/api/teams/${encodeURIComponent(teamId)}`,
    {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ workspaceId, ...patch }),
    },
  );
  return data.team;
}

export interface AddTeamMemberInput {
  workspaceId: string;
  teamId: string;
  username: string;
  role: TeamRole;
}

/** 409 {"error":"already_member"} surfaces as ApiError(409). */
export async function addTeamMember(
  base: string,
  { workspaceId, teamId, username, role }: AddTeamMemberInput,
): Promise<Team> {
  const data = await request<{ team: Team }>(
    `${base}/api/teams/${encodeURIComponent(teamId)}/members`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ workspaceId, username, role }),
    },
  );
  return data.team;
}

export interface RemoveTeamMemberInput {
  workspaceId: string;
  teamId: string;
  username: string;
}

/** 409 {"error":"last_lead"} surfaces as ApiError(409). */
export async function removeTeamMember(
  base: string,
  { workspaceId, teamId, username }: RemoveTeamMemberInput,
): Promise<Team> {
  const path = `${base}/api/teams/${encodeURIComponent(teamId)}/members/${encodeURIComponent(username)}`;
  const data = await request<{ team: Team }>(
    `${path}?workspaceId=${encodeURIComponent(workspaceId)}`,
    { method: "DELETE" },
  );
  return data.team;
}

export interface DeleteTeamInput {
  workspaceId: string;
  teamId: string;
}

export async function deleteTeam(
  base: string,
  { workspaceId, teamId }: DeleteTeamInput,
): Promise<void> {
  await request<{ deleted: boolean }>(
    `${base}/api/teams/${encodeURIComponent(teamId)}?workspaceId=${encodeURIComponent(workspaceId)}`,
    { method: "DELETE" },
  );
}
