import type { Program, Task } from "@xcollab/core";
import { ApiError, currentAuthToken } from "./api-client.ts";

/* XCollab AI chat transport — spec §2.2:
   POST /api/assistant/messages  → text/event-stream (SSE)
   POST /api/assistant/execute   → JSON (confirmed proposal execution) */

export type AssistantEvent =
  | { type: "text_delta"; text: string }
  | { type: "tool_started"; tool: string; argsSummary?: string }
  | { type: "tool_result"; tool: string; result: unknown }
  | {
      type: "proposal";
      proposalId: string;
      tool: string;
      args: Record<string, unknown>;
      preview?: unknown;
    }
  | { type: "done"; finishReason: "stop" | "proposal" | "length" }
  | { type: "error"; code?: string; message: string };

export type OutgoingMessage =
  | { role: "user"; content: string }
  | { role: "assistant"; content: string }
  | { role: "tool_result"; tool: string; resultDigest: string };

export interface AssistantTurnInput {
  workspaceId: string;
  language: "en" | "ar";
  messages: OutgoingMessage[];
}

/**
 * Incremental SSE decoder: feed raw text chunks (already UTF-8 decoded),
 * receive completed events. Events are `data:` lines separated by a blank
 * line; `:` keepalive comments and non-JSON payloads are skipped. Pure so
 * the chunk-boundary handling is unit-testable without a stream.
 */
export function createSseDecoder(): { push: (chunk: string) => AssistantEvent[] } {
  let buffer = "";
  return {
    push(chunk: string): AssistantEvent[] {
      buffer += chunk;
      const events: AssistantEvent[] = [];
      let boundary = buffer.indexOf("\n\n");
      while (boundary !== -1) {
        const block = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        const data = block
          .split("\n")
          .filter((line) => line.startsWith("data:"))
          .map((line) => line.slice(5).trimStart())
          .join("\n");
        if (data) {
          try {
            events.push(JSON.parse(data) as AssistantEvent);
          } catch {
            /* malformed frame — skip; the typed error event is the API's job */
          }
        }
        boundary = buffer.indexOf("\n\n");
      }
      return events;
    },
  };
}

/**
 * One assistant turn: POSTs the transcript, yields SSE events until the
 * stream ends. Abort via `signal` (Stop button). Non-2xx surfaces as
 * ApiError before any event is yielded.
 */
export async function* streamAssistantTurn(
  base: string,
  input: AssistantTurnInput,
  signal?: AbortSignal,
): AsyncGenerator<AssistantEvent> {
  const headers = new Headers({ "content-type": "application/json", accept: "text/event-stream" });
  const token = currentAuthToken();
  if (token) headers.set("authorization", `Bearer ${token}`);
  const response = await fetch(`${base}/api/assistant/messages`, {
    method: "POST",
    headers,
    body: JSON.stringify(input),
    signal,
  });
  if (!response.ok || !response.body) {
    throw new ApiError(response.status, `POST ${base}/api/assistant/messages → ${response.status}`);
  }
  const reader = response.body.getReader();
  const utf8 = new TextDecoder();
  const decoder = createSseDecoder();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      for (const event of decoder.push(utf8.decode(value, { stream: true }))) yield event;
    }
  } finally {
    reader.releaseLock();
  }
}

export interface ExecuteInput {
  workspaceId: string;
  language: "en" | "ar";
  proposalId: string;
  tool: string;
  args: Record<string, unknown>;
}

export interface ExecuteResult {
  result: { program?: Program; task?: Task; ledgerSeq?: number };
  message?: string;
}

/** Thrown on execute failure; `code` is the API's typed error (e.g.
    "unknown_assignee") when the response body carries one. */
export class AssistantExecuteError extends ApiError {
  readonly code: string | null;

  constructor(status: number, message: string, code: string | null) {
    super(status, message);
    this.name = "AssistantExecuteError";
    this.code = code;
  }
}

/** Executes ONE confirmed proposal — the user's explicit Confirm click is the
    only caller (spec D3: mutations are never auto-executed). */
export async function executeProposal(base: string, input: ExecuteInput): Promise<ExecuteResult> {
  const headers = new Headers({ "content-type": "application/json" });
  const token = currentAuthToken();
  if (token) headers.set("authorization", `Bearer ${token}`);
  const url = `${base}/api/assistant/execute`;
  const response = await fetch(url, { method: "POST", headers, body: JSON.stringify(input) });
  if (!response.ok) {
    let code: string | null = null;
    try {
      const body = (await response.json()) as { error?: string };
      if (typeof body.error === "string") code = body.error;
    } catch {
      /* non-JSON error body — status alone is the signal */
    }
    throw new AssistantExecuteError(response.status, `POST ${url} → ${response.status}`, code);
  }
  return (await response.json()) as ExecuteResult;
}
