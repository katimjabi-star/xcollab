"use client";

import type { ReactElement } from "react";
import type { STRINGS } from "../../lib/i18n.ts";
import type { ChatMessage } from "../../lib/assistant-transcript.ts";
import type { RefResolver } from "../../lib/assistant-refs.ts";
import { MarkdownLite } from "./markdown.tsx";
import { ProposalCard } from "./proposal-card.tsx";
import { ResultCard } from "./result-card.tsx";

type Dict = (typeof STRINGS)["en"];
type ProposalMessage = Extract<ChatMessage, { kind: "proposal" }>;

const TOOL_NOTES: Record<string, keyof Dict> = {
  search_tasks: "aiToolSearchTasks",
  get_project: "aiToolGetProject",
  get_project_summary: "aiToolSummary",
  list_projects: "aiToolListProjects",
  list_users: "aiToolListUsers",
  list_teams: "aiToolListTeams",
};

function ToolNote({ t, message }: { t: Dict; message: Extract<ChatMessage, { kind: "tool" }> }) {
  const labelKey = TOOL_NOTES[message.tool];
  const label = labelKey ? t[labelKey] : t.aiToolActivity;
  const line = message.argsSummary ? `${label} · ${message.argsSummary}` : label;
  if (!message.done) {
    return <p className="xai-tool-note pending">{line}…</p>;
  }
  return (
    <details className="xai-tool-note">
      <summary>
        {line}
        <span className="xai-tool-more">{t.aiToolDetails}</span>
      </summary>
      <pre dir="ltr">{JSON.stringify(message.result, null, 2)}</pre>
    </details>
  );
}

function Bubble({ message }: { message: Extract<ChatMessage, { kind: "user" | "assistant" }> }) {
  if (message.kind === "user") {
    return (
      <div className="xai-msg user" dir="auto">
        {message.text}
      </div>
    );
  }
  return (
    <div className={`xai-msg ai${message.streaming ? " streaming" : ""}`}>
      <MarkdownLite text={message.text} />
    </div>
  );
}

interface MessageListProps {
  t: Dict;
  messages: ChatMessage[];
  /** Maps proposal id args to display names (project/section/task). */
  resolveRef: RefResolver;
  /** True while the turn is in flight and no assistant text is streaming. */
  thinking: boolean;
  onConfirm: (message: ProposalMessage) => void;
  onCancel: (message: ProposalMessage) => void;
}

function renderMessage(
  message: ChatMessage,
  { t, resolveRef, onConfirm, onCancel }: Pick<MessageListProps, "t" | "resolveRef" | "onConfirm" | "onCancel">,
): ReactElement {
  switch (message.kind) {
    case "user":
    case "assistant":
      return <Bubble key={message.id} message={message} />;
    case "tool":
      return <ToolNote key={message.id} t={t} message={message} />;
    case "proposal":
      return (
        <ProposalCard
          key={message.id}
          t={t}
          message={message}
          resolveRef={resolveRef}
          onConfirm={onConfirm}
          onCancel={onCancel}
        />
      );
    case "result":
      return <ResultCard key={message.id} t={t} message={message} />;
    case "error":
      return (
        <p key={message.id} className="xai-error" role="alert" dir="auto">
          {message.text}
        </p>
      );
  }
}

/** The transcript column: bubbles, tool notes, proposal/result cards, error
    strips, plus the thinking indicator while a turn is pending. */
export function MessageList({
  t,
  messages,
  resolveRef,
  thinking,
  onConfirm,
  onCancel,
}: MessageListProps): ReactElement {
  return (
    <>
      {messages.map((message) => renderMessage(message, { t, resolveRef, onConfirm, onCancel }))}
      {thinking ? (
        <p className="xai-thinking" role="status" aria-label={t.aiThinking}>
          <span className="xai-dot" />
          <span className="xai-dot" />
          <span className="xai-dot" />
        </p>
      ) : null}
    </>
  );
}
