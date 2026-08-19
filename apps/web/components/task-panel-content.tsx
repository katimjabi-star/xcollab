"use client";

import { useEffect, useRef, useState } from "react";
import type { LedgerEntry, Program, Task } from "@xcollab/core";
import {
  API_BASE,
  ApiError,
  WORKSPACE,
  createTask,
  deleteTask,
  updateTask,
  type TaskPatch,
} from "../lib/api-client.ts";
import { STRINGS, type UiLanguage } from "../lib/i18n.ts";
import { useToasts } from "../lib/toast-context.tsx";
import { TaskActivity } from "./task-activity.tsx";
import { TaskPanelFields } from "./task-panel-fields.tsx";

const DISARM_MS = 3000;

export interface LocatedTask {
  task: Task;
  packageId: string;
  lastInPackage: boolean;
}

export function locateTask(program: Program, taskId: string): LocatedTask | null {
  for (const pkg of program.packages) {
    const task = pkg.tasks.find((candidate) => candidate.id === taskId);
    if (task) return { task, packageId: pkg.id, lastInPackage: pkg.tasks.length === 1 };
  }
  return null;
}

interface TaskPanelContentProps {
  program: Program;
  located: LocatedTask;
  uiLanguage: UiLanguage;
  entries: LedgerEntry[];
  onClose: () => void;
  onProgramUpdate: (program: Program) => void;
  /** Called after each successful mutation so the host can refresh activity. */
  onMutated: () => void;
}

export function TaskPanelContent({
  program,
  located,
  uiLanguage,
  entries,
  onClose,
  onProgramUpdate,
  onMutated,
}: TaskPanelContentProps) {
  const t = STRINGS[uiLanguage];
  const { push } = useToasts();
  const { task, packageId, lastInPackage } = located;
  const [name, setName] = useState(task.name);
  const [status, setStatus] = useState<Task["status"]>(task.status);
  const [failed, setFailed] = useState(false);
  const [armed, setArmed] = useState(false);
  const statusPending = useRef(false);
  const disarmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (disarmTimer.current) clearTimeout(disarmTimer.current);
    },
    [],
  );

  const commitPatch = async (patch: TaskPatch): Promise<boolean> => {
    try {
      const result = await updateTask(API_BASE, {
        workspaceId: WORKSPACE,
        programId: program.id,
        taskId: task.id,
        patch,
      });
      setFailed(false);
      onProgramUpdate(result.program);
      push({ message: t.taskUpdated });
      onMutated();
      return true;
    } catch {
      setFailed(true);
      return false;
    }
  };

  const commitName = () => {
    const trimmed = name.trim();
    if (!trimmed || trimmed === task.name) {
      setName(task.name); // empty/whitespace or unchanged → revert, no request
      return;
    }
    void commitPatch({ name: trimmed }).then((ok) => {
      if (!ok) setName(task.name);
    });
  };

  const handleStatusChange = (to: Task["status"]) => {
    if (statusPending.current || to === status) return; // in-flight guard
    const previous = status;
    statusPending.current = true;
    setStatus(to);
    void commitPatch({ status: to })
      .then((ok) => {
        if (!ok) setStatus(previous);
      })
      .finally(() => {
        statusPending.current = false;
      });
  };

  const restoreTask = async (programId: string, pkgId: string, snapshot: Task) => {
    try {
      const created = await createTask(API_BASE, {
        workspaceId: WORKSPACE,
        programId,
        packageId: pkgId,
        name: snapshot.name,
        estimateDays: snapshot.estimateDays,
        assigneeRole: snapshot.assigneeRole,
        startDate: snapshot.startDate,
        dueDate: snapshot.dueDate,
        description: snapshot.description,
      });
      let next = created.program;
      if (snapshot.status !== "todo") {
        const patched = await updateTask(API_BASE, {
          workspaceId: WORKSPACE,
          programId,
          taskId: created.task.id,
          patch: { status: snapshot.status },
        });
        next = patched.program;
      }
      onProgramUpdate(next);
      push({ message: t.taskCreated });
    } catch {
      push({ message: t.errorGeneric });
    }
  };

  const handleDelete = () => {
    if (!armed) {
      setArmed(true);
      disarmTimer.current = setTimeout(() => setArmed(false), DISARM_MS);
      return;
    }
    if (disarmTimer.current) clearTimeout(disarmTimer.current);
    setArmed(false);
    const snapshot: Task = { ...task };
    const programId = program.id;
    const pkgId = packageId;
    deleteTask(API_BASE, { workspaceId: WORKSPACE, programId, taskId: task.id })
      .then((result) => {
        onProgramUpdate(result.program);
        onClose();
        push({
          message: t.taskDeleted,
          undo: () => {
            void restoreTask(programId, pkgId, snapshot);
          },
        });
      })
      .catch((cause: unknown) => {
        if (cause instanceof ApiError && cause.status === 409) {
          push({ message: t.lastTaskInPackage });
        } else {
          setFailed(true);
        }
      });
  };

  return (
    <>
      <div className="task-panel-head">
        <input
          className="task-panel-name"
          value={name}
          aria-label={t.taskName}
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
          }}
          onBlur={commitName}
        />
        <button type="button" className="task-panel-close" aria-label={t.close} onClick={onClose}>
          ✕
        </button>
      </div>
      <div className="task-panel-body">
        {failed ? (
          <p className="error-note" role="alert">
            {t.errorGeneric}
          </p>
        ) : null}
        <span className="status-select-wrap">
          <select
            className={`status-pill status-select ${status}`}
            value={status}
            aria-label={t.taskStatus}
            onChange={(event) => handleStatusChange(event.target.value as Task["status"])}
          >
            <option value="todo">{t.statusTodo}</option>
            <option value="in_progress">{t.statusInProgress}</option>
            <option value="blocked">{t.statusBlocked}</option>
            <option value="done">{t.statusDone}</option>
          </select>
        </span>
        <TaskPanelFields task={task} uiLanguage={uiLanguage} commit={commitPatch} />
        <div>
          <label className="field-label">{t.taskActivity}</label>
          <TaskActivity entries={entries} uiLanguage={uiLanguage} emptyLabel={t.ledgerEmpty} />
        </div>
      </div>
      <div className="task-panel-foot">
        {lastInPackage ? <span className="task-meta">{t.lastTaskInPackage}</span> : null}
        <button
          type="button"
          className={`delete-btn${armed ? " confirm" : ""}`}
          disabled={lastInPackage}
          title={lastInPackage ? t.lastTaskInPackage : undefined}
          onClick={handleDelete}
        >
          {armed ? t.confirmDelete : t.deleteTask}
        </button>
      </div>
    </>
  );
}
