"use client";

import { useState, type ReactElement } from "react";
import { ArrowUpDown, ListFilter } from "lucide-react";
import type { Program } from "@xcollab/core";
import { API_BASE, WORKSPACE, listPrograms } from "../lib/api-client.ts";
import type { BoardCard, BoardSort, DueFilter } from "../lib/board-filter.ts";
import { EMPTY_FILTER, filterTasks, sortTasks } from "../lib/board-filter.ts";
import { STRINGS, type UiLanguage } from "../lib/i18n.ts";
import { localTodayIso } from "../lib/my-tasks.ts";
import { TaskTable, type TaskRow } from "./task-table.tsx";
import { AddTaskForm } from "./my-tasks-add-form.tsx";
import { ProgramOverview } from "./program-view.tsx";
import { TaskQuickAdd } from "./quick-add.tsx";
import { Icon } from "./ui/icon.tsx";
import { Popover } from "./ui/popover.tsx";

type Strings = (typeof STRINGS)["en"];
type ListSort = Extract<BoardSort, "default" | "dueDate" | "name">;

interface ListFilterState {
  packageId: string | null;
  due: DueFilter | null;
}

/** Contract #1 narrows status to todo/in_progress/done; blocked is active work. */
function toRow(card: BoardCard, program: Program): TaskRow {
  const { status, ...rest } = card.task;
  return {
    ...rest,
    status: status === "blocked" ? "in_progress" : status,
    programId: program.id,
    programName: program.name,
    packageId: card.packageId,
    packageName: card.packageName,
  };
}

/** Section radio menu + due-date radio menu, sharing one popover body. */
function FilterMenu({
  t,
  program,
  filter,
  onChange,
}: {
  t: Strings;
  program: Program;
  filter: ListFilterState;
  onChange: (filter: ListFilterState) => void;
}): ReactElement {
  const dueLabels: Record<DueFilter, string> = {
    overdue: t.filterOverdue,
    thisWeek: t.filterThisWeek,
    noDate: t.filterNoDate,
  };
  return (
    <>
      <p className="board-move-heading">{t.filterPackage}</p>
      {[null, ...program.packages.map((pkg) => pkg.id)].map((id) => (
        <button
          key={id ?? "all"}
          type="button"
          role="menuitemradio"
          aria-checked={filter.packageId === id}
          className="board-sort-option mt-menu-item"
          dir="auto"
          onClick={() => onChange({ ...filter, packageId: id })}
        >
          {id === null
            ? t.filterAll
            : (program.packages.find((pkg) => pkg.id === id)?.name ?? id)}
        </button>
      ))}
      <p className="board-move-heading">{t.filterDueDate}</p>
      {[null, ...(["overdue", "thisWeek", "noDate"] as const)].map((due) => (
        <button
          key={due ?? "all"}
          type="button"
          role="menuitemradio"
          aria-checked={filter.due === due}
          className="board-sort-option mt-menu-item"
          onClick={() => onChange({ ...filter, due })}
        >
          {due === null ? t.filterAll : dueLabels[due]}
        </button>
      ))}
    </>
  );
}

interface ProjectListViewProps {
  program: Program;
  /** Full workspace program list — feeds the add-task form's project select. */
  programs: Program[];
  uiLanguage: UiLanguage;
  /** Token user — toolbar-created tasks are assigned to them (My Tasks parity). */
  username: string;
  onTaskSelect: (taskId: string) => void;
  onProgramUpdate: (program: Program) => void;
}

/** List tab body: My-Tasks-style toolbar (+ Add task popover, Filter, Sort)
    over the shared spreadsheet TaskTable grouped by section, with the program
    overview (mission/documents/milestones/risks/teams) demoted below it. */
export function ProjectListView({
  program,
  programs,
  uiLanguage,
  username,
  onTaskSelect,
  onProgramUpdate,
}: ProjectListViewProps): ReactElement {
  const t = STRINGS[uiLanguage];
  const [createOpen, setCreateOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [filter, setFilter] = useState<ListFilterState>({ packageId: null, due: null });
  const [sort, setSort] = useState<ListSort>("default");
  const [composingPkg, setComposingPkg] = useState<string | null>(null);

  const today = localTodayIso();
  const cards: BoardCard[] = program.packages.flatMap((pkg) =>
    pkg.tasks.map((task) => ({ task, packageId: pkg.id, packageName: pkg.name })),
  );
  const visible = sortTasks(
    filterTasks(cards, { ...EMPTY_FILTER, packageId: filter.packageId, due: filter.due }, today),
    sort,
  );
  const packages = filter.packageId
    ? program.packages.filter((pkg) => pkg.id === filter.packageId)
    : program.packages;

  /** Toolbar adds go through AddTaskForm (create + assign PATCH); re-read the
      ledgered server state afterwards so the table shows the fresh program. */
  const refresh = () => {
    listPrograms(API_BASE, WORKSPACE)
      .then((list) => {
        const fresh = list.find((p) => p.id === program.id);
        if (fresh) onProgramUpdate(fresh);
      })
      .catch(() => {
        /* the create toast already fired; a reload shows the fresh state */
      });
  };

  const sortLabels: Record<ListSort, string> = {
    default: t.sortDefault,
    dueDate: t.sortDueDate,
    name: t.sortName,
  };
  const filterActive = filter.packageId !== null || filter.due !== null;

  return (
    <div className="proj-list" dir={program.language === "ar" ? "rtl" : "ltr"}>
      <div className="mt-toolbar">
        <Popover
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          align="start"
          role="dialog"
          className="mt-split-root"
          anchor={
            <button
              type="button"
              className="mt-split-main proj-add-btn"
              aria-expanded={createOpen}
              onClick={() => setCreateOpen((prev) => !prev)}
            >
              + {t.addTask}
            </button>
          }
        >
          {createOpen ? (
            <AddTaskForm
              programs={programs}
              uiLanguage={uiLanguage}
              username={username}
              presetDueDate={null}
              defaultProgramId={program.id}
              onCreated={refresh}
              onClose={() => setCreateOpen(false)}
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
                className={`board-tool-btn${filterActive ? " active" : ""}`}
                aria-expanded={filterOpen}
                onClick={() => setFilterOpen((prev) => !prev)}
              >
                <Icon icon={ListFilter} size={14} /> {t.filterLabel}
              </button>
            }
          >
            <FilterMenu t={t} program={program} filter={filter} onChange={setFilter} />
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
            {(["default", "dueDate", "name"] as const).map((id) => (
              <button
                key={id}
                type="button"
                role="menuitemradio"
                aria-checked={sort === id}
                className="board-sort-option mt-menu-item"
                onClick={() => {
                  setSort(id);
                  setSortOpen(false);
                }}
              >
                {sortLabels[id]}
              </button>
            ))}
          </Popover>
        </div>
      </div>

      <TaskTable
        rows={visible.map((card) => toRow(card, program))}
        groups={packages.map((pkg) => ({
          id: pkg.id,
          label: pkg.name,
          rowIds: visible.filter((card) => card.packageId === pkg.id).map((card) => card.task.id),
        }))}
        uiLanguage={uiLanguage}
        showProjectColumn={false}
        onOpenTask={(row) => onTaskSelect(row.id)}
        onAddTask={(groupId) => setComposingPkg(groupId)}
        composingGroupId={composingPkg}
        renderComposer={(groupId) => (
          <TaskQuickAdd
            variant="list"
            programId={program.id}
            packageId={groupId}
            uiLanguage={uiLanguage}
            onProgramUpdate={onProgramUpdate}
            open
            onOpenChange={(open) => {
              if (!open) setComposingPkg(null);
            }}
          />
        )}
        onProgramUpdate={onProgramUpdate}
      />

      <ProgramOverview program={program} uiLanguage={uiLanguage} onProgramUpdate={onProgramUpdate} />
    </div>
  );
}
