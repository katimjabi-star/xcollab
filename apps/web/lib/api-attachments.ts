import { ApiError } from "./api-client.ts";

/* Typed client for the attachments contract (backend ships in parallel).
   Mirrors api-teams' module-private Bearer wiring 1:1: consumers register
   useAuth().getToken via setAttachmentsAuthTokenProvider before their first
   fetch effect runs. Non-2xx surfaces as the shared ApiError, so callers
   branch on .status (413 = too_large per the fixed contract → the UI maps
   it to the friendly t.attachmentTooLarge toast). */

export interface Attachment {
  id: string;
  workspaceId: string;
  programId: string;
  taskId?: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  sha256: string;
  uploadedBy: string;
  createdAt: string;
}

/** The contract's upload cap — mirrored client-side for an instant 413 toast. */
export const ATTACHMENT_MAX_BYTES = 25 * 1024 * 1024;

let authTokenProvider: (() => string | null) | null = null;

/** Register the access-token source (mirror of api-client's private wiring). */
export function setAttachmentsAuthTokenProvider(fn: () => string | null): void {
  authTokenProvider = fn;
}

/** Bearer-authed fetch; non-2xx throws ApiError. Callers own body decoding —
    attachment content is bytes, everything else is JSON. */
async function authorizedFetch(url: string, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers);
  const token = authTokenProvider ? authTokenProvider() : null;
  if (token) headers.set("authorization", `Bearer ${token}`);
  const response = await fetch(url, { ...init, headers });
  if (!response.ok) {
    throw new ApiError(response.status, `${init?.method ?? "GET"} ${url} → ${response.status}`);
  }
  return response;
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await authorizedFetch(url, init);
  return (await response.json()) as T;
}

export interface ListAttachmentsInput {
  workspaceId: string;
  programId: string;
  /** Task scope; omit for the program-level document list (&scope=program). */
  taskId?: string;
}

export async function listAttachments(
  base: string,
  { workspaceId, programId, taskId }: ListAttachmentsInput,
): Promise<Attachment[]> {
  const params = new URLSearchParams({ workspaceId, programId });
  if (taskId) params.set("taskId", taskId);
  else params.set("scope", "program");
  const data = await request<{ attachments: Attachment[] }>(
    `${base}/api/attachments?${params.toString()}`,
  );
  return data.attachments;
}

export interface UploadAttachmentInput {
  workspaceId: string;
  programId: string;
  taskId?: string;
  file: File;
}

/** POST multipart — 201 {attachment}; 413 too_large surfaces as ApiError(413).
    No content-type header: the browser sets the multipart boundary itself. */
export async function uploadAttachment(
  base: string,
  { workspaceId, programId, taskId, file }: UploadAttachmentInput,
): Promise<Attachment> {
  const body = new FormData();
  body.set("workspaceId", workspaceId);
  body.set("programId", programId);
  if (taskId) body.set("taskId", taskId);
  body.set("file", file);
  const data = await request<{ attachment: Attachment }>(`${base}/api/attachments`, {
    method: "POST",
    body,
  });
  return data.attachment;
}

export interface AttachmentRefInput {
  workspaceId: string;
  attachmentId: string;
}

export async function deleteAttachment(
  base: string,
  { workspaceId, attachmentId }: AttachmentRefInput,
): Promise<void> {
  const path = `${base}/api/attachments/${encodeURIComponent(attachmentId)}`;
  await request<{ deleted: boolean }>(
    `${path}?workspaceId=${encodeURIComponent(workspaceId)}`,
    { method: "DELETE" },
  );
}

/** Content bytes as a Blob — the endpoint is bearer-authed, so plain <a href>
    can't reach it; consumers turn this into a blob: URL (download/lightbox)
    and revoke it when done. */
export async function fetchAttachmentBlob(
  base: string,
  { workspaceId, attachmentId }: AttachmentRefInput,
): Promise<Blob> {
  const path = `${base}/api/attachments/${encodeURIComponent(attachmentId)}/content`;
  const response = await authorizedFetch(
    `${path}?workspaceId=${encodeURIComponent(workspaceId)}`,
  );
  return response.blob();
}
