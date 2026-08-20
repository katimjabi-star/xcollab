"use client";

import { useState } from "react";
import type { DragEvent, ReactNode } from "react";
import { ChevronsRightLeft, Plus } from "lucide-react";
import type { Program, Task } from "@xcollab/core";
import type { STRINGS, UiLanguage } from "../lib/i18n.ts";
import { STATUS_ICONS } from "./board-card.tsx";
import { Icon } from "./ui/icon.tsx";
import { TaskQuickAdd } from "./quick-add.tsx";

type Strings = (typeof STRINGS)["en"];

interface BoardColumnProps {
  status: Task["status"];
  label: string;
  count: number;
  isEmpty: boolean;
  /** Any filter active — decides which empty state the column shows. */
  filtered: boolean;
  onClearFilters: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  dragover: boolean;
  onDragOver: (event: DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (event: DragEvent) => void;
  /** Quick-add target package; undefined hides the affordance. */
  programId: string;
  packageId?: string;
  uiLanguage: UiLanguage;
  onProgramUpdate: (program: Program) => void;
  t: Strings;
  children: ReactNode;
}

/** Header-only kanban column (340px) that collapses to a 40px vertical rail. */
export function BoardColumn({
  status,
  label,
  count,
  isEmpty,
  filtered,
  onClearFilters,
  collapsed,
  onToggleCollapse,
  dragover,
  onDragOver,
  onDragLeave,
  onDrop,
  programId,
  packageId,
  uiLanguage,
  onProgramUpdate,
  t,
  children,
}: BoardColumnProps) {
  const [quickAddOpen, setQuickAddOpen] = useState(false);

  if (collapsed) {
    return (
      <section className="board-col collapsed">
        <button
          type="button"
          className="board-col-rail"
          aria-expanded={false}
          aria-label={`${t.expandColumn}: ${label}`}
          onClick={onToggleCollapse}
        >
          <Icon icon={STATUS_ICONS[status]} className={`board-status-icon ${status}`} />
          <span className="board-rail-name">{label}</span>
          <span className="board-col-count">{count}</span>
        </button>
      </section>
    );
  }

  return (
    <section
      className={`board-col ${status}${dragover ? " dragover" : ""}`}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <div className="board-col-head">
        <Icon icon={STATUS_ICONS[status]} className={`board-status-icon ${status}`} />
        <span className="board-col-title">{label}</span>
        <span className="board-col-count">{count}</span>
        <div className="board-col-actions">
          {packageId ? (
            /* "+" stays visible at rest (quiet, --text-low) so first-time users
               can discover it; collapse remains hover/focus-revealed. */
            <button
              type="button"
              className="board-col-action rest-visible"
              aria-label={`${t.addTask}: ${label}`}
              onClick={() => setQuickAddOpen(true)}
            >
              <Icon icon={Plus} size={14} />
            </button>
          ) : null}
          <button
            type="button"
            className="board-col-action"
            aria-expanded
            aria-label={`${t.collapseColumn}: ${label}`}
            onClick={onToggleCollapse}
          >
            <Icon icon={ChevronsRightLeft} size={14} />
          </button>
        </div>
      </div>

      <div className="board-col-body">
        {isEmpty ? (
          filtered ? (
            <div className="board-col-empty filtered">
              <p>{t.noMatchingTasks}</p>
              <button type="button" className="board-clear-link" onClick={onClearFilters}>
                {t.filterClearAll}
              </button>
            </div>
          ) : (
            <p className="board-col-empty">{t.boardColumnEmpty}</p>
          )
        ) : (
          children
        )}
        {packageId ? (
          <TaskQuickAdd
            variant="board"
            programId={programId}
            packageId={packageId}
            status={status}
            uiLanguage={uiLanguage}
            onProgramUpdate={onProgramUpdate}
            open={quickAddOpen}
            onOpenChange={setQuickAddOpen}
          />
        ) : null}
      </div>
    </section>
  );
}
