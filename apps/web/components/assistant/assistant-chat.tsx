"use client";

import { useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import { API_BASE, WORKSPACE, listPrograms } from "../../lib/api-client.ts";
import { makeRefResolver } from "../../lib/assistant-refs.ts";
import { useWorkspaceData } from "../../lib/use-workspace-data.ts";
import {
  AssistantExecuteError,
  executeProposal,
  streamAssistantTurn,
} from "../../lib/api-assistant.ts";
import {
  appendResult,
  appendUser,
  applyEvent,
  setProposalState,
  toWireMessages,
  type ChatMessage,
} from "../../lib/assistant-transcript.ts";
import { getDemoKey, relayChatTurn } from "../../lib/demo-ai.ts";
import { useToasts } from "../../lib/toast-context.tsx";
import { useUi } from "../../lib/ui-context.tsx";
import { AssistantWelcome } from "./assistant-welcome.tsx";
import { Composer } from "./composer.tsx";
import { MessageList } from "./message-list.tsx";

type ProposalMessage = Extract<ChatMessage, { kind: "proposal" }>;

/** The /ai chat surface: client-held transcript (spec D6), SSE turns, and
    the confirm-before-act proposal flow (spec D3). */
export function AssistantChat(): ReactElement {
  const { t, language } = useUi();
  const { push } = useToasts();
  const { data: programs } = useWorkspaceData(listPrograms);
  const resolveRef = useMemo(() => makeRefResolver(programs ?? []), [programs]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const threadRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const thread = threadRef.current;
    if (thread) thread.scrollTop = thread.scrollHeight;
  }, [messages, busy]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const runTurn = async (list: ChatMessage[]) => {
    setBusy(true);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      // Demo relay: the operator's browser calls the hosted model directly
      // (the cluster has no egress). Read-only — proposals stay in-cluster.
      if (getDemoKey()) {
        // Fetched at turn time — the programs prop may not have loaded yet.
        const fresh = await listPrograms(API_BASE, WORKSPACE).catch(() => programs ?? []);
        const digest = fresh
          .slice(0, 25)
          .map((p) => `- ${p.name}: ${p.packages.length} sections, ${p.packages.reduce((n, pkg) => n + pkg.tasks.length, 0)} tasks`)
          .join("\n");
        const transcript = toWireMessages(list).flatMap((m) =>
          m.role === "user" || m.role === "assistant"
            ? [{ role: m.role, content: m.content }]
            : [],
        );
        const reply = await relayChatTurn(
          transcript,
          { language, programsDigest: digest || "(no projects yet)" },
          controller.signal,
        );
        setMessages((prev) => applyEvent(prev, { type: "text_delta", text: reply }));
        return;
      }
      const turn = streamAssistantTurn(
        API_BASE,
        { workspaceId: WORKSPACE, language, messages: toWireMessages(list) },
        controller.signal,
      );
      // Functional updates only: a Confirm can land between stream events
      // (setProposalState/appendResult), and a snapshot write here would
      // silently revert an already-executed proposal card to "pending".
      for await (const event of turn) {
        setMessages((prev) => applyEvent(prev, event));
      }
    } catch {
      if (!controller.signal.aborted) {
        setMessages((prev) => applyEvent(prev, { type: "error", message: t.aiErrorTransport }));
        push({ message: t.aiErrorTransport });
      }
    } finally {
      // A user abort mid-delta leaves a streaming bubble — seal it.
      setMessages((prev) => applyEvent(prev, { type: "done", finishReason: "stop" }));
      abortRef.current = null;
      setBusy(false);
    }
  };

  const send = (text: string) => {
    if (busy) return;
    const next = appendUser(messages, text);
    setMessages(next);
    void runTurn(next);
  };

  const confirm = async (proposal: ProposalMessage) => {
    setMessages((prev) => setProposalState(prev, proposal.proposalId, "executing"));
    try {
      const outcome = await executeProposal(API_BASE, {
        workspaceId: WORKSPACE,
        language,
        proposalId: proposal.proposalId,
        tool: proposal.tool,
        args: proposal.args,
      });
      setMessages((prev) => appendResult(prev, proposal.proposalId, proposal.tool, outcome));
    } catch (error) {
      const code = error instanceof AssistantExecuteError ? error.code : null;
      setMessages((prev) => setProposalState(prev, proposal.proposalId, "failed", code));
    }
  };

  const cancel = (proposal: ProposalMessage) => {
    setMessages((prev) => setProposalState(prev, proposal.proposalId, "cancelled"));
  };

  const lastMessage = messages[messages.length - 1];
  const thinking = busy && !(lastMessage?.kind === "assistant" && lastMessage.streaming);

  return (
    <div className="xai-chat">
      <div className="xai-thread" ref={threadRef}>
        <div className="xai-col">
          {messages.length === 0 ? (
            <AssistantWelcome programs={programs} onPick={send} />
          ) : (
            <MessageList
              t={t}
              messages={messages}
              resolveRef={resolveRef}
              thinking={thinking}
              onConfirm={(p) => void confirm(p)}
              onCancel={cancel}
            />
          )}
        </div>
      </div>
      <div className="xai-composer-row">
        <Composer t={t} busy={busy} onSend={send} onStop={() => abortRef.current?.abort()} />
      </div>
    </div>
  );
}
