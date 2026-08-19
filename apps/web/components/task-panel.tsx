"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { LedgerEntry, Program } from "@xcollab/core";
import { API_BASE, WORKSPACE, getLedger } from "../lib/api-client.ts";
import type { UiLanguage } from "../lib/i18n.ts";
import { TaskPanelContent, locateTask } from "./task-panel-content.tsx";

/**
 * True when a ledger entry belongs to this exact program+task. Entry inputs are
 * JSON written by the API: task.update/status_update/delete carry { programId,
 * taskId }, task.create carries { programId, task: { id } }. Task ids are only
 * unique within a program (synthesized programs share task-1-1 etc.), so both
 * ids must match — substring matching leaks entries across programs.
 */
function entryMatchesTask(entry: LedgerEntry, programId: string, taskId: string): boolean {
  try {
    const input = JSON.parse(entry.input) as {
      programId?: unknown;
      taskId?: unknown;
      task?: { id?: unknown };
    };
    if (input.programId !== programId) return false;
    return input.taskId === taskId || input.task?.id === taskId;
  } catch {
    return false; // non-JSON input — not a task-scoped entry
  }
}

interface TaskPanelProps {
  program: Program | null;
  taskId: string | null;
  uiLanguage: UiLanguage;
  onClose: () => void;
  onProgramUpdate: (program: Program) => void;
}

/**
 * Task detail side panel shell: open/close animation via the .open class,
 * Escape/overlay-close, focus management, docked-mode padding, and the
 * per-task ledger activity fetch. Field editing lives in TaskPanelContent.
 */
export function TaskPanel({
  program,
  taskId,
  uiLanguage,
  onClose,
  onProgramUpdate,
}: TaskPanelProps) {
  const located = program && taskId ? locateTask(program, taskId) : null;
  const open = located !== null;
  const panelRef = useRef<HTMLElement | null>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const activityTaskRef = useRef<string | null>(null);
  const [overlayMode, setOverlayMode] = useState(false);
  const [entries, setEntries] = useState<LedgerEntry[]>([]);

  activityTaskRef.current = taskId;

  useEffect(() => {
    const query = window.matchMedia("(max-width: 1100px)");
    const update = () => setOverlayMode(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  // Escape closes — listener active only while open.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // >=1101px docked mode: pad .main via a class on the .app element.
  useEffect(() => {
    const app = document.querySelector(".app");
    if (!app) return;
    app.classList.toggle("task-panel-docked", open);
    return () => app.classList.remove("task-panel-docked");
  }, [open]);

  // Focus the panel on open; return focus to the trigger on close.
  useEffect(() => {
    if (open) {
      const active = document.activeElement;
      restoreFocusRef.current = active instanceof HTMLElement ? active : null;
      panelRef.current?.focus();
    } else if (restoreFocusRef.current) {
      restoreFocusRef.current.focus();
      restoreFocusRef.current = null;
    }
  }, [open]);

  const programId = program?.id ?? null;
  const refreshActivity = useCallback(() => {
    if (!taskId || !programId) return;
    const id = taskId;
    getLedger(API_BASE, WORKSPACE)
      .then((ledger) => {
        if (activityTaskRef.current !== id) return; // stale fetch for a previous task
        setEntries(
          ledger.entries
            .filter((entry) => entryMatchesTask(entry, programId, id))
            .sort((a, b) => b.seq - a.seq),
        );
      })
      .catch(() => {
        // Activity is auxiliary; field editing stays usable without it.
      });
  }, [taskId, programId]);

  useEffect(() => {
    setEntries([]);
    refreshActivity();
  }, [refreshActivity]);

  return (
    <aside
      ref={panelRef}
      tabIndex={-1}
      className={`task-panel${open ? " open" : ""}`}
      role="dialog"
      aria-modal={open && overlayMode ? true : undefined}
      aria-label={located?.task.name}
    >
      {/* No dir on the aside: docking (inset-inline-end) and the .main padding
          must both resolve against the app UI dir inherited from .app, or the
          panel docks on one side while content yields on the other. Program
          language only directs the content region. */}
      <div
        className="task-panel-inner"
        dir={program?.language === "ar" ? "rtl" : "ltr"}
      >
        {program && located ? (
          <TaskPanelContent
            key={located.task.id}
            program={program}
            located={located}
            uiLanguage={uiLanguage}
            entries={entries}
            onClose={onClose}
            onProgramUpdate={onProgramUpdate}
            onMutated={refreshActivity}
          />
        ) : null}
      </div>
    </aside>
  );
}
