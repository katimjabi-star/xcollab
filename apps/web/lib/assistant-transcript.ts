import type { AssistantEvent, ExecuteResult, OutgoingMessage } from "./api-assistant.ts";

/* Pure transcript model for the /ai chat: SSE events fold into an ordered
   message list; the list maps back to the wire transcript sent each turn
   (spec D6 — the client holds the conversation). No React in this file. */

export type ProposalState = "pending" | "executing" | "cancelled" | "failed";

export type ChatMessage =
  | { id: string; kind: "user"; text: string }
  | { id: string; kind: "assistant"; text: string; streaming: boolean }
  | { id: string; kind: "tool"; tool: string; argsSummary?: string; result?: unknown; done: boolean }
  | {
      id: string;
      kind: "proposal";
      proposalId: string;
      tool: string;
      args: Record<string, unknown>;
      state: ProposalState;
      errorCode?: string | null;
    }
  | {
      id: string;
      kind: "result";
      tool: string;
      programId?: string;
      programName?: string;
      taskId?: string;
      taskName?: string;
      ledgerSeq?: number;
      message?: string;
    }
  | { id: string; kind: "error"; code?: string; text: string };

const nextId = (list: ChatMessage[]): string => `m${String(list.length)}-${String(Date.now())}`;

export function appendUser(list: ChatMessage[], text: string): ChatMessage[] {
  return [...list, { id: nextId(list), kind: "user", text }];
}

function appendDelta(list: ChatMessage[], text: string): ChatMessage[] {
  const last = list[list.length - 1];
  if (last && last.kind === "assistant" && last.streaming) {
    return [...list.slice(0, -1), { ...last, text: last.text + text }];
  }
  return [...list, { id: nextId(list), kind: "assistant", text, streaming: true }];
}

function closeStreaming(list: ChatMessage[]): ChatMessage[] {
  return list.map((m) => (m.kind === "assistant" && m.streaming ? { ...m, streaming: false } : m));
}

function finishTool(list: ChatMessage[], tool: string, result: unknown): ChatMessage[] {
  // Close the most recent still-open note for this tool (ES2022 lib — no findLastIndex).
  for (let idx = list.length - 1; idx >= 0; idx -= 1) {
    const open = list[idx];
    if (open && open.kind === "tool" && open.tool === tool && !open.done) {
      return [...list.slice(0, idx), { ...open, result, done: true }, ...list.slice(idx + 1)];
    }
  }
  return [...list, { id: nextId(list), kind: "tool", tool, result, done: true }];
}

/** Folds one SSE event into the transcript. done/error also seal any
    still-streaming assistant bubble. */
export function applyEvent(list: ChatMessage[], event: AssistantEvent): ChatMessage[] {
  switch (event.type) {
    case "text_delta":
      return appendDelta(list, event.text);
    case "tool_started":
      return [
        ...closeStreaming(list),
        { id: nextId(list), kind: "tool", tool: event.tool, argsSummary: event.argsSummary, done: false },
      ];
    case "tool_result":
      return finishTool(list, event.tool, event.result);
    case "proposal":
      return [
        ...closeStreaming(list),
        {
          id: nextId(list),
          kind: "proposal",
          proposalId: event.proposalId,
          tool: event.tool,
          args: event.args,
          state: "pending",
        },
      ];
    case "done":
      return closeStreaming(list);
    case "error":
      return [
        ...closeStreaming(list),
        { id: nextId(list), kind: "error", code: event.code, text: event.message },
      ];
  }
}

export function setProposalState(
  list: ChatMessage[],
  proposalId: string,
  state: ProposalState,
  errorCode?: string | null,
): ChatMessage[] {
  return list.map((m) =>
    m.kind === "proposal" && m.proposalId === proposalId ? { ...m, state, errorCode } : m,
  );
}

/** Appends the post-execute result card. The executed proposal is removed —
    the card replaces it (the confirm gate is spent, spec D3: one proposalId,
    consumed once). */
export function appendResult(
  list: ChatMessage[],
  proposalId: string,
  tool: string,
  outcome: ExecuteResult,
): ChatMessage[] {
  const kept = list.filter((m) => !(m.kind === "proposal" && m.proposalId === proposalId));
  return [
    ...kept,
    {
      id: nextId(kept),
      kind: "result",
      tool,
      programId: outcome.result.program?.id,
      programName: outcome.result.program?.name,
      taskId: outcome.result.task?.id,
      taskName: outcome.result.task?.name,
      ledgerSeq: outcome.result.ledgerSeq,
      message: outcome.message,
    },
  ];
}

const DIGEST_MAX = 300;

function digest(value: unknown): string {
  const text = typeof value === "string" ? value : JSON.stringify(value) ?? "";
  return text.length > DIGEST_MAX ? `${text.slice(0, DIGEST_MAX)}…` : text;
}

function toOutgoing(message: ChatMessage): OutgoingMessage | null {
  switch (message.kind) {
    case "user":
      return { role: "user", content: message.text };
    case "assistant":
      return message.text ? { role: "assistant", content: message.text } : null;
    case "tool":
      return message.done
        ? { role: "tool_result", tool: message.tool, resultDigest: digest(message.result) }
        : null;
    case "proposal":
      // The model must know its proposal was declined (spec §3.2).
      return message.state === "cancelled"
        ? { role: "tool_result", tool: message.tool, resultDigest: "proposal cancelled by the user" }
        : null;
    case "result":
      return {
        role: "tool_result",
        tool: message.tool,
        resultDigest: digest({
          executed: true,
          programId: message.programId,
          taskId: message.taskId,
          ledgerSeq: message.ledgerSeq,
        }),
      };
    case "error":
      return null;
  }
}

const WIRE_LIMIT = 40; // spec §2.2: ≤40 entries; server truncates further

/** The wire transcript for the next turn. */
export function toWireMessages(list: ChatMessage[]): OutgoingMessage[] {
  return list
    .map(toOutgoing)
    .filter((m): m is OutgoingMessage => m !== null)
    .slice(-WIRE_LIMIT);
}
