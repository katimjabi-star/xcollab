import type { Task } from "@xcollab/core";
import { ApiError } from "./api-client.ts";

/* Typed client for GET /api/users/me/tasks. api-client.ts keeps its request()
   helper and Bearer-token provider module-private, so this sheet mirrors the
   same pattern 1:1 (like api-teams.ts): the page registers useAuth().getToken
   via setMyTasksAuthTokenProvider before its first fetch effect runs. */

/** A task annotated with its owning program/package (server contract #4). */
export type MyTask = Task & {
  programId: string;
  programName: string;
  packageId: string;
  packageName: string;
};

let authTokenProvider: (() => string | null) | null = null;

/** Register the access-token source (mirror of api-client's private wiring). */
export function setMyTasksAuthTokenProvider(fn: () => string | null): void {
  authTokenProvider = fn;
}

async function request<T>(url: string): Promise<T> {
  const headers = new Headers();
  const token = authTokenProvider ? authTokenProvider() : null;
  if (token) headers.set("authorization", `Bearer ${token}`);
  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new ApiError(response.status, `GET ${url} → ${response.status}`);
  }
  return (await response.json()) as T;
}

/** All tasks in the workspace assigned to the token user, program-annotated. */
export async function fetchMyTasks(base: string, workspaceId: string): Promise<MyTask[]> {
  const data = await request<{ tasks: MyTask[] }>(
    `${base}/api/users/me/tasks?workspaceId=${encodeURIComponent(workspaceId)}`,
  );
  return data.tasks;
}
