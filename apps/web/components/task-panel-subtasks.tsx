"use client";

import { useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import type { Program, Subtask, Task } from "@xcollab/core";
import {
  API_BASE,
  ApiError,
  WORKSPACE,
  addSubtask,
  deleteSubtask,
  updateSubtask,
} from "../lib/api-client.ts";
import { STRINGS, type UiLanguage } from "../lib/i18n.ts";
import { SUBTASK_CAP, subtaskDone, subtaskProgress } from "../lib/subtasks.ts";
import { useToasts } from "../lib/toast-context.tsx";
import { Icon } from "./ui/icon.tsx";

interface TaskPanelSubtasksProps {
  program: Program;
  task: Task;
  uiLanguage: UiLanguage;
  /** Same server-state flow as the task PATCHes: apply result.program. */
  onProgramUpdate: (program: Program) => void;
  /** Called after each successful mutation so the host can refresh activity. */
  onMutated: () => void;
}

/**
 * "Subtasks" checklist section: done/total count, per-row toggle (optimistic,
 * reverted on a failed PATCH — the status-chip flow) and remove, plus an add
 * row that POSTs on Enter/click. Cap 409s surface as a toast.
 */
export function TaskPanelSubtasks({
  program,
  task,
  uiLanguage,
  onProgramUpdate,
  onMutated,
}: TaskPanelSubtasksProps) {
  const t = STRINGS[uiLanguage];
  const { push } = useToasts();
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  // Optimistic done states keyed by subtask id; cleared when the PATCH settles
  // (success lands the server state via onProgramUpdate, failure reverts).
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const togglesPending = useRef(new Set<string>());

  const subtasks = task.subtasks ?? [];
  const { done, total } = subtaskProgress(subtasks, overrides);
  const atCap = total >= SUBTASK_CAP;

  const applyResult = (result: { program: Program }) => {
    onProgramUpdate(result.program);
    push({ message: t.taskUpdated });
    onMutated();
  };

  const clearOverride = (id: string) => {
    setOverrides((prev) => Object.fromEntries(Object.entries(prev).filter(([key]) => key !== id)));
  };

  const toggle = (subtask: Subtask) => {
    if (togglesPending.current.has(subtask.id)) return; // in-flight guard
    const next = !subtaskDone(subtask, overrides);
    togglesPending.current.add(subtask.id);
    setOverrides((prev) => ({ ...prev, [subtask.id]: next }));
    updateSubtask(API_BASE, {
      workspaceId: WORKSPACE,
      programId: program.id,
      taskId: task.id,
      subtaskId: subtask.id,
      patch: { done: next },
    })
      .then(applyResult)
      .catch(() => push({ message: t.errorGeneric }))
      .finally(() => {
        togglesPending.current.delete(subtask.id);
        clearOverride(subtask.id);
      });
  };

  const remove = (subtask: Subtask) => {
    deleteSubtask(API_BASE, {
      workspaceId: WORKSPACE,
      programId: program.id,
      taskId: task.id,
      subtaskId: subtask.id,
    })
      .then(applyResult)
      .catch(() => push({ message: t.errorGeneric }));
  };

  const submitAdd = () => {
    const name = draft.trim();
    if (!name || busy) return;
    setBusy(true);
    addSubtask(API_BASE, { workspaceId: WORKSPACE, programId: program.id, taskId: task.id, name })
      .then((result) => {
        setDraft("");
        applyResult(result);
      })
      .catch((cause: unknown) => {
        const capped = cause instanceof ApiError && cause.status === 409;
        push({ message: capped ? t.subtaskCapReached : t.errorGeneric });
      })
      .finally(() => setBusy(false));
  };

  return (
    <section className="panel-section">
      <div className="subtasks-head">
        <h3 className="panel-section-label">{t.subtasksHeading}</h3>
        {total > 0 ? (
          <span className="subtasks-count num" dir="ltr">
            {done}/{total}
          </span>
        ) : null}
      </div>
      {total > 0 ? (
        <ul className="subtask-rows">
          {subtasks.map((subtask) => {
            const checked = subtaskDone(subtask, overrides);
            return (
              <li key={subtask.id} className={checked ? "subtask-row done" : "subtask-row"}>
                <label className="subtask-main">
                  <input
                    type="checkbox"
                    className="subtask-check"
                    checked={checked}
                    aria-label={subtask.name}
                    onChange={() => toggle(subtask)}
                  />
                  <span className="subtask-name" dir="auto">
                    {subtask.name}
                  </span>
                </label>
                <button
                  type="button"
                  className="panel-icon-btn subtask-remove"
                  aria-label={t.removeSubtask}
                  title={t.removeSubtask}
                  onClick={() => remove(subtask)}
                >
                  <Icon icon={X} size={14} />
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
      <form
        className="subtask-add"
        onSubmit={(event) => {
          event.preventDefault();
          submitAdd();
        }}
      >
        <input
          className="subtask-add-input"
          value={draft}
          maxLength={500}
          placeholder={t.subtaskPlaceholder}
          aria-label={t.addSubtaskAction}
          disabled={busy || atCap}
          title={atCap ? t.subtaskCapReached : undefined}
          onChange={(event) => setDraft(event.target.value)}
        />
        <button
          type="submit"
          className="panel-icon-btn"
          aria-label={t.addSubtaskAction}
          title={atCap ? t.subtaskCapReached : t.addSubtaskAction}
          disabled={busy || atCap || draft.trim() === ""}
        >
          <Icon icon={Plus} />
        </button>
      </form>
    </section>
  );
}
