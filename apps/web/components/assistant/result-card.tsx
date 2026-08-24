"use client";

import Link from "next/link";
import { CircleCheck, ScrollText } from "lucide-react";
import type { ReactElement } from "react";
import type { STRINGS } from "../../lib/i18n.ts";
import type { ChatMessage } from "../../lib/assistant-transcript.ts";
import { Icon } from "../ui/icon.tsx";

type ResultMessage = Extract<ChatMessage, { kind: "result" }>;

interface ResultCardProps {
  t: (typeof STRINGS)["en"];
  message: ResultMessage;
}

/** Post-execute confirmation: links into the created/changed entity
    (tasks deep-link via /projects/[id]?task= — the project page opens the
    task panel) and to the AI Ledger row. */
export function ResultCard({ t, message }: ResultCardProps): ReactElement {
  const taskHref =
    message.programId && message.taskId
      ? `/projects/${message.programId}?task=${message.taskId}`
      : null;
  const projectHref = message.programId ? `/projects/${message.programId}` : null;
  const entityName = message.taskName ?? message.programName;
  const href = taskHref ?? projectHref;

  return (
    <section className="xai-result" aria-label={t.aiResultApplied}>
      <span className="xai-result-mark" aria-hidden>
        <Icon icon={CircleCheck} size={16} />
      </span>
      <div className="xai-result-body">
        <span className="xai-result-title">{t.aiResultApplied}</span>
        {message.message ? <p dir="auto">{message.message}</p> : null}
        <div className="xai-result-links">
          {href && entityName ? (
            <Link className="xai-result-link" href={href} dir="auto">
              {entityName}
            </Link>
          ) : null}
          {href ? (
            <Link className="xai-result-open" href={href}>
              {message.taskId ? t.aiOpenTask : t.aiOpenProject}
            </Link>
          ) : null}
          {typeof message.ledgerSeq === "number" ? (
            <Link className="xai-result-ledger" href="/ledger">
              <Icon icon={ScrollText} size={12} />
              {t.aiLedgerRef.replace("{n}", String(message.ledgerSeq))}
            </Link>
          ) : null}
        </div>
      </div>
    </section>
  );
}
