"use client";

import { useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import type { Program, Task } from "@xcollab/core";
import { API_BASE, WORKSPACE, createTask, updateTask } from "../lib/api-client.ts";
import { STRINGS, type UiLanguage } from "../lib/i18n.ts";
import { useToasts } from "../lib/toast-context.tsx";

interface TaskQuickAddProps {
  programId: string;
  packageId: string;
  variant: "list" | "board";
  /** Board column status. The API creates as "todo"; non-todo needs a follow-up PATCH. */
  status?: Task["status"];
  uiLanguage: UiLanguage;
  onProgramUpdate: (program: Program) => void;
  /** Optional controlled open state (board column header "+" drives this). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

/**
 * Ghost "+ Add task" affordance that expands into an inline name input.
 * Enter commits and keeps the input open (rapid entry); Escape cancels;
 * blur commits when non-empty, otherwise collapses back to the button.
 */
export function TaskQuickAdd({
  programId,
  packageId,
  variant,
  status,
  uiLanguage,
  onProgramUpdate,
  open: controlledOpen,
  onOpenChange,
}: TaskQuickAddProps) {
  const t = STRINGS[uiLanguage];
  const { push } = useToasts();
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = (next: boolean) => {
    setInternalOpen(next);
    onOpenChange?.(next);
  };
  const [value, setValue] = useState("");
  const [failed, setFailed] = useState(false);
  const pending = useRef(false);

  const close = () => {
    setOpen(false);
    setValue("");
    setFailed(false);
  };

  const commit = async (): Promise<boolean> => {
    const name = value.trim();
    if (!name || pending.current) return false;
    pending.current = true;
    try {
      const created = await createTask(API_BASE, {
        workspaceId: WORKSPACE,
        programId,
        packageId,
        name,
      });
      setValue("");
      setFailed(false);
      onProgramUpdate(created.program);
      push({ message: t.taskCreated });
      if (status && status !== "todo") {
        try {
          const patched = await updateTask(API_BASE, {
            workspaceId: WORKSPACE,
            programId,
            taskId: created.task.id,
            patch: { status },
          });
          onProgramUpdate(patched.program);
        } catch {
          // Created as "todo"; the board already reflects the server state.
        }
      }
      return true;
    } catch {
      setFailed(true); // keep the typed value so the user can retry
      return false;
    } finally {
      pending.current = false;
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") void commit();
    else if (event.key === "Escape") close();
  };

  const handleBlur = () => {
    if (!value.trim()) {
      close();
      return;
    }
    void commit().then((ok) => {
      if (ok) close();
    });
  };

  if (!open) {
    return variant === "list" ? (
      <button type="button" className="quick-add-row" onClick={() => setOpen(true)}>
        + {t.addTask}
      </button>
    ) : (
      <button
        type="button"
        className="quick-add-btn"
        aria-label={t.addTask}
        onClick={() => setOpen(true)}
      >
        + {t.addTask}
      </button>
    );
  }

  return (
    <div>
      {failed ? (
        <p className="error-note" role="alert">
          {t.errorGeneric}
        </p>
      ) : null}
      <input
        className={variant === "board" ? "quick-add-input in-board" : "quick-add-input"}
        autoFocus
        placeholder={t.addTask}
        aria-label={t.addTask}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
      />
    </div>
  );
}
