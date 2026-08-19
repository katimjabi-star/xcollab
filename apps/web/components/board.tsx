"use client";

import { useEffect, useRef, useState } from "react";
import type { DragEvent } from "react";
import type { Program, Task } from "@xcollab/core";
import { API_BASE, WORKSPACE, updateTaskStatus } from "../lib/api-client.ts";
import type { UiLanguage } from "../lib/i18n.ts";
import { STRINGS } from "../lib/i18n.ts";
import { ProgramCardHeader } from "./program-view.tsx";

/** Fixed column order — never derived from object-key order. */
const ORDER: Task["status"][] = ["todo", "in_progress", "blocked", "done"];

const REVERT_FLASH_MS = 1500;

interface BoardCard {
  task: Task;
  packageId: string;
  packageName: string;
}

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

export function Board({
  program,
  uiLanguage,
  onProgramUpdate,
}: {
  program: Program;
  uiLanguage: UiLanguage;
  onProgramUpdate: (program: Program) => void;
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
  // In-flight guard: drops for a task with a pending PATCH are ignored (avoids revert races).
  const pendingTasks = useRef(new Set<string>());
  const revertTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (revertTimer.current) clearTimeout(revertTimer.current);
    },
    [],
  );

  const cards: BoardCard[] = program.packages.flatMap((pkg) =>
    pkg.tasks.map((task) => ({ task, packageId: pkg.id, packageName: pkg.name })),
  );
  const effectiveStatus = (task: Task): Task["status"] => overrides[task.id] ?? task.status;

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

  return (
    <article className="program-card" dir={program.language === "ar" ? "rtl" : "ltr"}>
      <ProgramCardHeader program={program} headingLevel="h2" />

      {moveFailed ? (
        <p className="error-note" role="alert">
          {t.taskMoveFailed}
        </p>
      ) : null}

      <div>
        <p className="subhead">{t.packagesHeading}</p>
        <div className="board">
          {ORDER.map((status) => {
            const colCards = cards.filter((card) => effectiveStatus(card.task) === status);
            return (
              <section
                key={status}
                className={`board-col ${status}${dragoverCol === status ? " dragover" : ""}`}
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragoverCol(status);
                }}
                onDragLeave={() => setDragoverCol((prev) => (prev === status ? null : prev))}
                onDrop={(event) => handleDrop(event, status)}
              >
                <div className="board-col-head">
                  <span className="board-col-title">{statusLabels[status]}</span>
                  <span className="board-col-count">{colCards.length}</span>
                </div>
                <div className="board-col-body">
                  {colCards.length === 0 ? (
                    <p className="board-col-empty">{t.boardColumnEmpty}</p>
                  ) : (
                    colCards.map(({ task, packageId, packageName }) => (
                      <div
                        key={task.id}
                        className={`board-card${draggingId === task.id ? " dragging" : ""}${
                          revertErrorId === task.id ? " revert-error" : ""
                        }`}
                        draggable
                        onDragStart={(event) => {
                          event.dataTransfer.setData(
                            "text/plain",
                            JSON.stringify({ taskId: task.id, packageId }),
                          );
                          event.dataTransfer.effectAllowed = "move";
                          setDraggingId(task.id);
                        }}
                        onDragEnd={() => setDraggingId(null)}
                      >
                        <span className="board-card-eyebrow">{packageName}</span>
                        <span className="board-card-name">{task.name}</span>
                        <span className="board-card-meta">
                          {task.estimateDays} {t.estimateDaysSuffix}
                          {task.assigneeRole ? ` · ${task.assigneeRole}` : ""}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </article>
  );
}
