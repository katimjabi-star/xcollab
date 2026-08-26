"use client";

import { useEffect, useRef, useState } from "react";
import type { DragEvent } from "react";
import type { Program, Task } from "@xcollab/core";
import { API_BASE, WORKSPACE, updateTaskStatus } from "../lib/api-client.ts";
import type { BoardCard } from "../lib/board-filter.ts";
import { anyFilterActive, filterTasks, sortTasks } from "../lib/board-filter.ts";
import { localTodayIso } from "../lib/my-tasks.ts";
import type { UiLanguage } from "../lib/i18n.ts";
import { STRINGS } from "../lib/i18n.ts";
import { fullName, useWorkspaceUsers } from "./assignee-picker.tsx";
import { BoardCardItem } from "./board-card.tsx";
import { BoardColumn } from "./board-column.tsx";
import { BoardFilterBar, useBoardQuery } from "./board-filters.tsx";

/** Fixed column order — never derived from object-key order. */
const ORDER: Task["status"][] = ["todo", "in_progress", "blocked", "done"];

const REVERT_FLASH_MS = 1500;
const COLLAPSE_KEY = "xcollab.board.collapsed";

interface DragPayload {
  taskId: string;
  packageId: string;
}

function parseDragPayload(raw: string): DragPayload | null {
  try {
    const parsed = JSON.parse(raw) as Partial<DragPayload>;
    return typeof parsed.taskId === "string" && typeof parsed.packageId === "string"
      ? { taskId: parsed.taskId, packageId: parsed.packageId }
      : null;
  } catch {
    return null;
  }
}


function readCollapsed(programId: string): Task["status"][] {
  try {
    const raw = localStorage.getItem(COLLAPSE_KEY);
    const map = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    const entry = map[programId];
    return Array.isArray(entry)
      ? ORDER.filter((status) => (entry as unknown[]).includes(status))
      : [];
  } catch {
    return [];
  }
}

function writeCollapsed(programId: string, statuses: Task["status"][]) {
  try {
    const raw = localStorage.getItem(COLLAPSE_KEY);
    const map = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    map[programId] = statuses;
    localStorage.setItem(COLLAPSE_KEY, JSON.stringify(map));
  } catch {
    /* storage unavailable — collapse state stays session-local */
  }
}

export function Board({
  program,
  uiLanguage,
  onProgramUpdate,
  onTaskSelect,
}: {
  program: Program;
  uiLanguage: UiLanguage;
  onProgramUpdate: (program: Program) => void;
  /** When provided, activating a card (not dragging it) opens the task panel. */
  onTaskSelect?: (taskId: string) => void;
}) {
  const t = STRINGS[uiLanguage];
  const statusLabels: Record<Task["status"], string> = {
    todo: t.statusTodo,
    in_progress: t.statusInProgress,
    blocked: t.statusBlocked,
    done: t.statusDone,
  };

  // Optimistic status overrides, keyed by task id, while a PATCH is in flight.
  const [overrides, setOverrides] = useState<Record<string, Task["status"]>>({});
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragoverCol, setDragoverCol] = useState<Task["status"] | null>(null);
  const [revertErrorId, setRevertErrorId] = useState<string | null>(null);
  const [moveFailed, setMoveFailed] = useState(false);
  const [collapsed, setCollapsed] = useState<Task["status"][]>([]);
  // In-flight guard: drops for a task with a pending PATCH are ignored (avoids revert races).
  const pendingTasks = useRef(new Set<string>());
  const revertTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Suppress the click event some browsers fire right after a drag ends.
  const justDragged = useRef(false);

  const { filter, sort, setFilter, setSort, clearFilters } = useBoardQuery();

  useEffect(
    () => () => {
      if (revertTimer.current) clearTimeout(revertTimer.current);
    },
    [],
  );

  // Collapse state loads after mount (localStorage is client-only).
  useEffect(() => {
    setCollapsed(readCollapsed(program.id));
  }, [program.id]);

  const toggleCollapse = (status: Task["status"]) => {
    setCollapsed((prev) => {
      const next = prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status];
      writeCollapsed(program.id, next);
      return next;
    });
  };

  const cards: BoardCard[] = program.packages.flatMap((pkg) =>
    pkg.tasks.map((task) => ({ task, packageId: pkg.id, packageName: pkg.name })),
  );
  // Board columns are status-scoped; quick-add lands in the first work package
  // (its eyebrow on the new card makes the placement visible immediately).
  const firstPackageId = program.packages[0]?.id;
  const effectiveStatus = (task: Task): Task["status"] => overrides[task.id] ?? task.status;

  const today = localTodayIso();
  const filtered = anyFilterActive(filter);
  const visible = sortTasks(filterTasks(cards, filter, today), sort);
  const roles = [...new Set(cards.map((c) => c.task.assigneeRole).filter((r): r is string => !!r))].sort();
  const packages = program.packages.map((pkg) => ({ id: pkg.id, name: pkg.name }));
  const users = useWorkspaceUsers();
  const namesByUsername = new Map(users.map((user) => [user.username, fullName(user)]));

  const clearOverride = (taskId: string) => {
    setOverrides((prev) =>
      Object.fromEntries(Object.entries(prev).filter(([id]) => id !== taskId)),
    );
  };

  const flashRevert = (taskId: string) => {
    setRevertErrorId(taskId);
    if (revertTimer.current) clearTimeout(revertTimer.current);
    revertTimer.current = setTimeout(() => setRevertErrorId(null), REVERT_FLASH_MS);
  };

  const moveTask = (taskId: string, to: Task["status"]) => {
    pendingTasks.current.add(taskId);
    setOverrides((prev) => ({ ...prev, [taskId]: to }));
    updateTaskStatus(API_BASE, {
      workspaceId: WORKSPACE,
      programId: program.id,
      taskId,
      status: to,
    })
      .then((result) => {
        setMoveFailed(false);
        onProgramUpdate(result.program);
        clearOverride(taskId);
      })
      .catch(() => {
        clearOverride(taskId);
        setMoveFailed(true);
        flashRevert(taskId);
      })
      .finally(() => {
        pendingTasks.current.delete(taskId);
      });
  };

  const handleDrop = (event: DragEvent, target: Task["status"]) => {
    event.preventDefault();
    setDragoverCol(null);
    const payload = parseDragPayload(event.dataTransfer.getData("text/plain"));
    if (!payload || pendingTasks.current.has(payload.taskId)) return;
    const card = cards.find((c) => c.task.id === payload.taskId);
    if (!card || effectiveStatus(card.task) === target) return;
    moveTask(payload.taskId, target);
  };

  const handleCardSelect = (taskId: string) => {
    if (justDragged.current) {
      justDragged.current = false;
      return;
    }
    onTaskSelect?.(taskId);
  };

  return (
    <div className="board-region" dir={program.language === "ar" ? "rtl" : "ltr"}>
      <BoardFilterBar
        t={t}
        filter={filter}
        sort={sort}
        packages={packages}
        roles={roles}
        users={users}
        onFilterChange={setFilter}
        onSortChange={setSort}
        onClearFilters={clearFilters}
      />

      {moveFailed ? (
        <p className="error-note board-error" role="alert">
          {t.taskMoveFailed}
        </p>
      ) : null}

      <div className="board-scroller">
        <div className="board">
          {ORDER.map((status) => {
            const colCards = visible.filter((card) => effectiveStatus(card.task) === status);
            const moveTargets = ORDER.filter((s) => s !== status).map((s) => ({
              status: s,
              label: statusLabels[s],
            }));
            return (
              <BoardColumn
                key={status}
                status={status}
                label={statusLabels[status]}
                count={colCards.length}
                isEmpty={colCards.length === 0}
                filtered={filtered}
                onClearFilters={clearFilters}
                collapsed={collapsed.includes(status)}
                onToggleCollapse={() => toggleCollapse(status)}
                dragover={dragoverCol === status}
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragoverCol(status);
                }}
                onDragLeave={() => setDragoverCol((prev) => (prev === status ? null : prev))}
                onDrop={(event) => handleDrop(event, status)}
                programId={program.id}
                packageId={firstPackageId}
                uiLanguage={uiLanguage}
                onProgramUpdate={onProgramUpdate}
                t={t}
              >
                {colCards.map((card) => (
                  <BoardCardItem
                    key={card.task.id}
                    card={card}
                    t={t}
                    today={today}
                    assigneeName={
                      card.task.assignee ? namesByUsername.get(card.task.assignee) : undefined
                    }
                    uiLanguage={uiLanguage}
                    dragging={draggingId === card.task.id}
                    revertError={revertErrorId === card.task.id}
                    moveTargets={moveTargets}
                    onSelect={() => handleCardSelect(card.task.id)}
                    onMove={(to) => moveTask(card.task.id, to)}
                    onDragStart={(event) => {
                      event.dataTransfer.setData(
                        "text/plain",
                        JSON.stringify({ taskId: card.task.id, packageId: card.packageId }),
                      );
                      event.dataTransfer.effectAllowed = "move";
                      setDraggingId(card.task.id);
                    }}
                    onDragEnd={() => {
                      setDraggingId(null);
                      justDragged.current = true;
                      // A post-drag click (if any) fires before this macrotask.
                      window.setTimeout(() => {
                        justDragged.current = false;
                      }, 0);
                    }}
                  />
                ))}
              </BoardColumn>
            );
          })}
        </div>
      </div>
    </div>
  );
}
