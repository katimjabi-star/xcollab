"use client";

import { useState, type ReactElement } from "react";
import { ArrowUpDown, ChevronDown, ListFilter } from "lucide-react";
import type { Program } from "@xcollab/core";
import { STRINGS, type UiLanguage } from "../lib/i18n.ts";
import { programDisplayName } from "../lib/program-format.ts";
import { Icon } from "./ui/icon.tsx";
import { Popover } from "./ui/popover.tsx";
import { AddTaskForm } from "./my-tasks-add-form.tsx";

export type MyTasksSort = "default" | "dueDate" | "name";

interface MyTasksToolbarProps {
  programs: Program[];
  uiLanguage: UiLanguage;
  /** Token user — new tasks are assigned to them so they land in My Tasks. */
  username: string;
  filterProgramId: string | null;
  onFilterProgram: (id: string | null) => void;
  sort: MyTasksSort;
  onSort: (sort: MyTasksSort) => void;
  /** Page-controlled so opening it can dismiss any inline bucket composer. */
  createOpen: boolean;
  onCreateOpenChange: (open: boolean) => void;
  /** Due date preset for the toolbar add; bucket adds compose inline instead. */
  presetDueDate: string | null;
  onCreated: () => void;
}

/** "+ Add task" split button (left) plus the Filter / Sort cluster (right). */
export function MyTasksToolbar({
  programs,
  uiLanguage,
  username,
  filterProgramId,
  onFilterProgram,
  sort,
  onSort,
  createOpen,
  onCreateOpenChange,
  presetDueDate,
  onCreated,
}: MyTasksToolbarProps): ReactElement {
  const t = STRINGS[uiLanguage];
  const [filterOpen, setFilterOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);

  return (
    <div className="mt-toolbar">
      <Popover
        open={createOpen}
        onClose={() => onCreateOpenChange(false)}
        align="start"
        role="dialog"
        className="mt-split-root"
        anchor={
          <span className="mt-split">
            <button
              type="button"
              className="mt-split-main"
              onClick={() => onCreateOpenChange(!createOpen)}
            >
              + {t.addTask}
            </button>
            <button
              type="button"
              className="mt-split-caret"
              aria-label={t.myTasksPickTarget}
              aria-expanded={createOpen}
              onClick={() => onCreateOpenChange(!createOpen)}
            >
              <Icon icon={ChevronDown} size={14} />
            </button>
          </span>
        }
      >
        {createOpen ? (
          <AddTaskForm
            programs={programs}
            uiLanguage={uiLanguage}
            username={username}
            presetDueDate={presetDueDate}
            defaultProgramId={filterProgramId}
            onCreated={onCreated}
            onClose={() => onCreateOpenChange(false)}
          />
        ) : null}
      </Popover>

      <div className="mt-toolbar-end">
        <Popover
          open={filterOpen}
          onClose={() => setFilterOpen(false)}
          align="end"
          role="menu"
          anchor={
            <button
              type="button"
              className={`board-tool-btn${filterProgramId ? " active" : ""}`}
              aria-expanded={filterOpen}
              onClick={() => setFilterOpen((prev) => !prev)}
            >
              <Icon icon={ListFilter} size={14} /> {t.filterLabel}
            </button>
          }
        >
          <p className="board-move-heading">{t.myTasksProjectLabel}</p>
          {[null, ...programs.map((p) => p.id)].map((id) => (
            <button
              key={id ?? "all"}
              type="button"
              role="menuitemradio"
              aria-checked={filterProgramId === id}
              className="board-sort-option mt-menu-item"
              onClick={() => {
                onFilterProgram(id);
                setFilterOpen(false);
              }}
            >
              {id === null
                ? t.filterAll
                : programDisplayName(programs.find((p) => p.id === id) ?? { name: id })}
            </button>
          ))}
        </Popover>

        <Popover
          open={sortOpen}
          onClose={() => setSortOpen(false)}
          align="end"
          role="menu"
          anchor={
            <button
              type="button"
              className={`board-tool-btn${sort !== "default" ? " active" : ""}`}
              aria-expanded={sortOpen}
              onClick={() => setSortOpen((prev) => !prev)}
            >
              <Icon icon={ArrowUpDown} size={14} /> {t.sortLabel}
            </button>
          }
        >
          <p className="board-move-heading">{t.sortLabel}</p>
          {(
            [
              ["default", t.sortDefault],
              ["dueDate", t.sortDueDate],
              ["name", t.sortName],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="menuitemradio"
              aria-checked={sort === id}
              className="board-sort-option mt-menu-item"
              onClick={() => {
                onSort(id);
                setSortOpen(false);
              }}
            >
              {label}
            </button>
          ))}
        </Popover>
      </div>
    </div>
  );
}
