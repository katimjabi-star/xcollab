"use client";

import Link from "next/link";
import { Inbox } from "lucide-react";
import type { LedgerEntry, Program } from "@xcollab/core";
import { ApiError, getLedger, listPrograms } from "../../lib/api-client.ts";
import { useAuth } from "../../lib/auth-context.tsx";
import { useUi } from "../../lib/ui-context.tsx";
import { useWorkspaceData } from "../../lib/use-workspace-data.ts";
import {
  actorInitials,
  formatRelativeTime,
  humanizeAction,
} from "../../components/task-activity.tsx";
import { programDisplayName } from "../../lib/program-format.ts";
import { Icon } from "../../components/ui/icon.tsx";

const FEED_LIMIT = 50;

interface EntryContext {
  programId?: string;
  taskId?: string;
}

/** Ledger inputs are JSON blobs with programId/taskId (task.create nests the
    task object). Malformed input yields an empty context, never a throw. */
function contextOf(entry: LedgerEntry): EntryContext {
  try {
    const parsed: unknown = JSON.parse(entry.input);
    if (typeof parsed !== "object" || parsed === null) return {};
    const record = parsed as Record<string, unknown>;
    const task = record.task as Record<string, unknown> | undefined;
    return {
      ...(typeof record.programId === "string" ? { programId: record.programId } : {}),
      ...(typeof record.taskId === "string"
        ? { taskId: record.taskId }
        : typeof task?.id === "string"
          ? { taskId: task.id }
          : {}),
    };
  } catch {
    return {};
  }
}

/** Relevant to me: I acted, or the touched task is assigned to me. */
function relevantEntries(
  entries: LedgerEntry[],
  username: string,
  myTaskIds: Set<string>,
): LedgerEntry[] {
  return entries
    .filter((entry) => {
      if (entry.actor.id === username) return true;
      const { taskId } = contextOf(entry);
      return taskId !== undefined && myTaskIds.has(taskId);
    })
    .sort((a, b) => b.seq - a.seq)
    .slice(0, FEED_LIMIT);
}

function myTaskIdsOf(programs: Program[], username: string): Set<string> {
  const ids = new Set<string>();
  for (const program of programs) {
    for (const pkg of program.packages) {
      for (const task of pkg.tasks) {
        if (task.assignee === username) ids.add(task.id);
      }
    }
  }
  return ids;
}

export default function InboxPage() {
  const { t, language } = useUi();
  const { user } = useAuth();
  const ledger = useWorkspaceData(getLedger);
  const programsState = useWorkspaceData(listPrograms);

  const error = ledger.error ?? programsState.error;
  if (error) {
    return (
      <div className="content">
        <p className="error-note" role="alert">
          {t.loadFailed}
          {error instanceof ApiError ? ` (${error.message})` : ""}
        </p>
      </div>
    );
  }

  const username = user?.username ?? "";
  const programs = programsState.data ?? [];
  const programNames = new Map(programs.map((p) => [p.id, programDisplayName(p)]));
  const loaded = ledger.loaded && programsState.loaded;
  const entries = ledger.data
    ? relevantEntries(ledger.data.entries, username, myTaskIdsOf(programs, username))
    : [];

  return (
    <div className="content s2-inbox">
      <div className="section-head">
        <h2 className="page-title">{t.navInbox}</h2>
      </div>
      {loaded && entries.length === 0 ? (
        <div className="s2-inbox-empty">
          <Icon icon={Inbox} size={32} className="s2-inbox-empty-icon" />
          <p className="s2-inbox-empty-title">{t.inboxEmptyTitle}</p>
          <p className="s2-inbox-empty-body">{t.inboxEmptyBody}</p>
        </div>
      ) : (
        <ul className="s2-inbox-list">
          {entries.map((entry) => {
            const { programId } = contextOf(entry);
            const programName = programId ? programNames.get(programId) : undefined;
            return (
              <li key={entry.hash} className="s2-inbox-row">
                <span className="s2-inbox-avatar" aria-hidden>
                  {actorInitials(entry.actor.id)}
                </span>
                <span className="s2-inbox-text">
                  <span className="s2-inbox-line">
                    <strong dir="ltr">{entry.actor.id}</strong>{" "}
                    <span title={entry.action}>{humanizeAction(entry.action, language)}</span>
                  </span>
                  {programName && programId ? (
                    <Link className="s2-inbox-context" href={`/projects/${programId}`} dir="auto">
                      {programName}
                    </Link>
                  ) : null}
                </span>
                <time className="s2-inbox-time" dateTime={entry.occurredAt}>
                  {formatRelativeTime(entry.occurredAt, language)}
                </time>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
