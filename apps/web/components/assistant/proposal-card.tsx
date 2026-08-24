"use client";

import { FilePlus2, ListChecks, PenLine } from "lucide-react";
import type { ReactElement, ReactNode } from "react";
import type { STRINGS } from "../../lib/i18n.ts";
import type { ChatMessage } from "../../lib/assistant-transcript.ts";
import type { RefResolver } from "../../lib/assistant-refs.ts";
import { Icon } from "../ui/icon.tsx";

type Dict = (typeof STRINGS)["en"];
type ProposalMessage = Extract<ChatMessage, { kind: "proposal" }>;

/* The confirmation gate (spec D3): the card renders the REAL validated args —
   never model prose — so the user sees exactly what /execute will apply. */

const TOOL_TITLES: Record<string, keyof Dict> = {
  create_project: "aiProposalCreateProject",
  create_task: "aiProposalCreateTask",
  update_task: "aiProposalUpdateTask",
  update_project: "aiProposalUpdateProject",
};

const FIELD_LABELS: Record<string, keyof Dict> = {
  programId: "aiFieldProject",
  packageId: "aiFieldSection",
  taskId: "aiFieldTask",
  name: "taskName",
  mission: "aiFieldMission",
  language: "aiFieldLanguage",
  timeline: "aiFieldTimeline",
  teamId: "aiFieldTeam",
  teamHints: "aiFieldTeam",
  status: "taskStatus",
  assignee: "aiFieldAssignee",
  assigneeRole: "taskAssigneeRole",
  startDate: "taskStartDate",
  dueDate: "taskDueDate",
  estimateDays: "taskEstimate",
  description: "taskDescription",
};

const STATUS_LABELS: Record<string, keyof Dict> = {
  todo: "statusTodo",
  in_progress: "statusInProgress",
  blocked: "statusBlocked",
  done: "statusDone",
};

const ERROR_LABELS: Record<string, keyof Dict> = {
  unknown_assignee: "aiErrUnknownAssignee",
  unknown_team: "aiErrUnknownTeam",
  not_found: "aiErrNotFound",
  last_task: "aiErrConflict",
  conflict: "aiErrConflict",
};

const ID_KEYS = new Set(["programId", "packageId", "taskId", "teamId"]);

interface FieldRow {
  key: string;
  value: unknown;
}

/** Flattens tool args to label/value rows; `patch` (update_task) unnests. */
function fieldRows(args: Record<string, unknown>): FieldRow[] {
  const rows: FieldRow[] = [];
  for (const [key, value] of Object.entries(args)) {
    if (key === "workspaceId" || value === undefined) continue;
    if (key === "patch" && value !== null && typeof value === "object") {
      for (const [k, v] of Object.entries(value)) {
        if (v !== undefined) rows.push({ key: k, value: v });
      }
    } else {
      rows.push({ key, value });
    }
  }
  return rows;
}

const isTimeline = (v: unknown): v is { start: string; end: string } =>
  v !== null && typeof v === "object" && "start" in v && "end" in v;

function fieldValue(t: Dict, row: FieldRow, resolved: string | null): ReactNode {
  const { key, value } = row;
  if (value === null) return <span className="xai-field-clear">—</span>;
  if (key === "status" && typeof value === "string") {
    const label = STATUS_LABELS[value];
    return (
      <span className="xai-status" data-status={value}>
        {label ? t[label] : value}
      </span>
    );
  }
  if (ID_KEYS.has(key)) {
    // Resolved display name (id kept in the tooltip); raw id only as fallback.
    if (resolved !== null) {
      return (
        <span dir="auto" title={String(value)}>
          {resolved}
        </span>
      );
    }
    return (
      <span className="xai-id" dir="ltr">
        {String(value)}
      </span>
    );
  }
  if (isTimeline(value)) {
    return (
      <span dir="ltr">
        {value.start} → {value.end}
      </span>
    );
  }
  if (Array.isArray(value)) return <span dir="auto">{value.join(", ")}</span>;
  return <span dir="auto">{String(value)}</span>;
}

const toolIcon = (tool: string) =>
  tool === "create_project" ? FilePlus2 : tool.startsWith("update") ? PenLine : ListChecks;

interface ProposalCardProps {
  t: Dict;
  message: ProposalMessage;
  resolveRef: RefResolver;
  onConfirm: (message: ProposalMessage) => void;
  onCancel: (message: ProposalMessage) => void;
}

/** Mutation preview + Confirm/Cancel. Cancelled cards collapse to a struck
    one-liner; failures show the typed API error inline and keep the card. */
export function ProposalCard({
  t,
  message,
  resolveRef,
  onConfirm,
  onCancel,
}: ProposalCardProps): ReactElement {
  const titleKey = TOOL_TITLES[message.tool];
  const title = titleKey ? t[titleKey] : message.tool;

  if (message.state === "cancelled") {
    return (
      <div className="xai-proposal-cancelled" role="note">
        <s>{title}</s>
        <span>{t.aiCancelledNote}</span>
      </div>
    );
  }

  const errorKey = message.errorCode ? ERROR_LABELS[message.errorCode] : undefined;
  const executing = message.state === "executing";
  return (
    <section className="xai-proposal" aria-label={title}>
      <header className="xai-proposal-head">
        <Icon icon={toolIcon(message.tool)} size={15} />
        <h3>{title}</h3>
      </header>
      <dl className="xai-proposal-fields">
        {fieldRows(message.args).map((row) => {
          const labelKey = FIELD_LABELS[row.key];
          const resolved = ID_KEYS.has(row.key) ? resolveRef(row.key, message.args) : null;
          return (
            <div className="xai-field" key={row.key}>
              <dt>{labelKey ? t[labelKey] : row.key}</dt>
              <dd>{fieldValue(t, row, resolved)}</dd>
            </div>
          );
        })}
      </dl>
      {message.state === "failed" ? (
        <p className="xai-proposal-error" role="alert">
          {errorKey ? t[errorKey] : t.aiErrorGeneric}
        </p>
      ) : null}
      <footer className="xai-proposal-foot">
        <span className="xai-proposal-hint">{t.aiProposalHint}</span>
        <button
          type="button"
          className="xai-ghost-btn"
          disabled={executing}
          onClick={() => onCancel(message)}
        >
          {t.cancel}
        </button>
        <button
          type="button"
          className="xai-confirm-btn"
          disabled={executing}
          onClick={() => onConfirm(message)}
        >
          {executing ? t.aiExecuting : t.aiConfirm}
        </button>
      </footer>
    </section>
  );
}
