"use client";

import { useState, type ReactElement, type ReactNode } from "react";
import { CheckCircle2, ChevronDown, ChevronRight, Plus } from "lucide-react";
import type { Program } from "@xcollab/core";
import { API_BASE, WORKSPACE, updateTask } from "../lib/api-client.ts";
import { STRINGS, type UiLanguage } from "../lib/i18n.ts";
import { formatDueRange, isDueOverdue, localTodayIso } from "../lib/my-tasks.ts";
import { programColor, programDisplayName } from "../lib/program-format.ts";
import { useToasts } from "../lib/toast-context.tsx";
import { Avatar } from "./ui/avatar.tsx";
import { Icon } from "./ui/icon.tsx";

/** Cross-agent contract #1 — keep this shape stable. */
export interface TaskRow {
  id: string;
  name: string;
  status: "todo" | "in_progress" | "done";
  startDate?: string;
  dueDate?: string;
  assignee?: string;
  programId: string;
  programName: string;
  packageId: string;
  packageName: string;
}

interface TaskTableProps {
  rows: TaskRow[];
  groups: { id: string; label: string; rowIds: string[] }[];
  uiLanguage: UiLanguage;
  onOpenTask: (row: TaskRow) => void;
  onAddTask?: (groupId: string) => void;
  /** Group currently composing a new task — its ghost row becomes the inline
      composer rendered by renderComposer, so the form opens where clicked. */
  composingGroupId?: string | null;
  renderComposer?: (groupId: string) => ReactNode;
  /** Bottom "+ Add section" ghost — omit where sections are derived (My Tasks). */
  onAddSection?: () => void;
  /** Hide the Projects column on single-project surfaces (project detail). */
  showProjectColumn?: boolean;
  /** Fresh server program after a done-toggle PATCH (single-project hosts). */
  onProgramUpdate?: (program: Program) => void;
}

/** Rows keyed program+task: generated dev data reuses task ids across programs. */
const keyOf = (row: TaskRow): string => `${row.programId}/${row.id}`;

/** id → row queue, consumed in order so duplicate ids still render once each. */
function rowQueues(rows: TaskRow[]): Map<string, TaskRow[]> {
  const map = new Map<string, TaskRow[]>();
  for (const row of rows) {
    const queue = map.get(row.id);
    if (queue) queue.push(row);
    else map.set(row.id, [row]);
  }
  return map;
}

/** Spreadsheet-style task list (contract #1): sticky column header, 36px rows,
    done-toggle with optimistic update + rollback, collapsible groups. */
export function TaskTable({
  rows,
  groups,
  uiLanguage,
  onOpenTask,
  onAddTask,
  composingGroupId = null,
  renderComposer,
  onAddSection,
  showProjectColumn = true,
  onProgramUpdate,
}: TaskTableProps): ReactElement {
  const t = STRINGS[uiLanguage];
  const { push } = useToasts();
  const today = localTodayIso();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  /** Optimistic status per row key; server state wins again on refetch. */
  const [overrides, setOverrides] = useState<Record<string, TaskRow["status"]>>({});

  const statusOf = (row: TaskRow): TaskRow["status"] => overrides[keyOf(row)] ?? row.status;

  const toggleDone = async (row: TaskRow) => {
    const current = statusOf(row);
    const next = current === "done" ? "todo" : "done";
    setOverrides((prev) => ({ ...prev, [keyOf(row)]: next }));
    try {
      const result = await updateTask(API_BASE, {
        workspaceId: WORKSPACE,
        programId: row.programId,
        taskId: row.id,
        patch: { status: next },
      });
      onProgramUpdate?.(result.program);
    } catch {
      setOverrides((prev) => ({ ...prev, [keyOf(row)]: current }));
      push({ message: t.actionFailed });
    }
  };

  const queues = rowQueues(rows);
  const groupRows = (ids: string[]): TaskRow[] => {
    const resolved: TaskRow[] = [];
    for (const id of ids) {
      const row = queues.get(id)?.shift();
      if (row) resolved.push(row);
    }
    return resolved;
  };

  return (
    <div className={showProjectColumn ? "task-table" : "task-table tt-no-project"}>
      <div className="tt-grid tt-head" role="row">
        <span className="tt-col">{t.myTasksColName}</span>
        <span className="tt-col">{t.taskDueDate}</span>
        <span className="tt-col">{t.myTasksColCollaborators}</span>
        {showProjectColumn ? <span className="tt-col">{t.programsHeading}</span> : null}
        <span className="tt-col tt-col-plus" aria-hidden>
          <Icon icon={Plus} size={14} />
        </span>
      </div>

      {groups.map((group) => {
        const isCollapsed = collapsed[group.id] ?? false;
        const resolved = groupRows(group.rowIds);
        return (
          <section key={group.id} className="tt-group">
            <button
              type="button"
              className="tt-group-head"
              aria-expanded={!isCollapsed}
              onClick={() => setCollapsed((prev) => ({ ...prev, [group.id]: !isCollapsed }))}
            >
              <Icon icon={isCollapsed ? ChevronRight : ChevronDown} size={14} directional />
              <span className="tt-group-label" dir="auto">
                {group.label}
              </span>
            </button>
            {isCollapsed
              ? null
              : resolved.map((row) => {
                  const done = statusOf(row) === "done";
                  const dueText = formatDueRange(row, today, uiLanguage, t.timelineTodayLabel);
                  const overdue = !done && isDueOverdue(row.dueDate, today);
                  return (
                    <div key={keyOf(row)} className="tt-grid tt-row" role="row">
                      <div className="tt-cell tt-name-cell">
                        <button
                          type="button"
                          className={`tt-check${done ? " done" : ""}`}
                          aria-pressed={done}
                          aria-label={`${done ? t.markIncomplete : t.markComplete}: ${row.name}`}
                          onClick={() => void toggleDone(row)}
                        >
                          <Icon icon={CheckCircle2} size={16} />
                        </button>
                        <button
                          type="button"
                          className={`tt-name${done ? " done" : ""}`}
                          dir="auto"
                          onClick={() => onOpenTask(row)}
                        >
                          {row.name}
                        </button>
                      </div>
                      <span className={`tt-cell tt-due${overdue ? " overdue" : ""}`} dir="auto">
                        {dueText}
                      </span>
                      <span className="tt-cell tt-collab">
                        {row.assignee ? <Avatar name={row.assignee} /> : null}
                      </span>
                      {showProjectColumn ? (
                        <span className="tt-cell">
                          <span className="project-pill" title={row.packageName}>
                            <span
                              className="project-swatch"
                              style={{ background: programColor(row.programId) }}
                              aria-hidden
                            />
                            {programDisplayName({ name: row.programName })}
                          </span>
                        </span>
                      ) : null}
                      <span className="tt-cell" aria-hidden />
                    </div>
                  );
                })}
            {!isCollapsed && composingGroupId === group.id && renderComposer ? (
              <div className="tt-compose-row">{renderComposer(group.id)}</div>
            ) : !isCollapsed && onAddTask ? (
              <button type="button" className="tt-ghost-row" onClick={() => onAddTask(group.id)}>
                {t.myTasksGhostAddTask}
              </button>
            ) : null}
          </section>
        );
      })}

      {onAddSection ? (
        <button type="button" className="tt-add-section" onClick={onAddSection}>
          + {t.myTasksAddSection}
        </button>
      ) : null}
    </div>
  );
}
