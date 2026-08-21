"use client";

import { useEffect, useState, type ReactElement } from "react";
import { ArrowUpDown, ChevronDown, ListFilter } from "lucide-react";
import type { Program } from "@xcollab/core";
import { API_BASE, WORKSPACE, createTask, updateTask } from "../lib/api-client.ts";
import { STRINGS, type UiLanguage } from "../lib/i18n.ts";
import { programDisplayName } from "../lib/program-format.ts";
import { useToasts } from "../lib/toast-context.tsx";
import { Icon } from "./ui/icon.tsx";
import { Popover } from "./ui/popover.tsx";

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
  /** Create popover is page-controlled so bucket ghost rows can open it. */
  createOpen: boolean;
  onCreateOpenChange: (open: boolean) => void;
  /** Due date preset chosen by the bucket the add started from; null = none. */
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
  const { push } = useToasts();
  const [programId, setProgramId] = useState<string | null>(null);
  const [packageId, setPackageId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);

  // Default target: the filtered project when set, else the first project.
  useEffect(() => {
    if (!createOpen) return;
    const fallback = filterProgramId ?? programs[0]?.id ?? null;
    setProgramId((current) =>
      current && programs.some((p) => p.id === current) ? current : fallback,
    );
  }, [createOpen, filterProgramId, programs]);

  const program = programs.find((p) => p.id === programId) ?? null;
  const packages = program?.packages ?? [];
  const pkgId = packageId && packages.some((p) => p.id === packageId)
    ? packageId
    : (packages[0]?.id ?? null);

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed || !program || !pkgId || pending) return;
    setPending(true);
    try {
      const created = await createTask(API_BASE, {
        workspaceId: WORKSPACE,
        programId: program.id,
        packageId: pkgId,
        name: trimmed,
        ...(presetDueDate ? { dueDate: presetDueDate } : {}),
      });
      // Assign to the current user so the task shows up in My Tasks.
      await updateTask(API_BASE, {
        workspaceId: WORKSPACE,
        programId: program.id,
        taskId: created.task.id,
        patch: { assignee: username },
      });
      push({ message: t.taskCreated });
      setName("");
      onCreateOpenChange(false);
      onCreated();
    } catch {
      push({ message: t.actionFailed });
    } finally {
      setPending(false);
    }
  };

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
        <form
          className="mt-create"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <p className="mt-create-heading">{t.myTasksPickTarget}</p>
          <label className="mt-create-field">
            <span>{t.myTasksProjectLabel}</span>
            <select
              value={programId ?? ""}
              onChange={(event) => {
                setProgramId(event.target.value || null);
                setPackageId(null);
              }}
            >
              {programs.map((p) => (
                <option key={p.id} value={p.id}>
                  {programDisplayName(p)}
                </option>
              ))}
            </select>
          </label>
          <label className="mt-create-field">
            <span>{t.taskPackage}</span>
            <select value={pkgId ?? ""} onChange={(event) => setPackageId(event.target.value)}>
              {packages.map((pkg) => (
                <option key={pkg.id} value={pkg.id}>
                  {pkg.name}
                </option>
              ))}
            </select>
          </label>
          <label className="mt-create-field">
            <span>{t.taskName}</span>
            <input
              autoFocus
              value={name}
              placeholder={t.addTaskPlaceholder}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <button
            type="submit"
            className="mt-create-submit"
            disabled={pending || !name.trim() || !pkgId}
          >
            {t.addTask}
          </button>
        </form>
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
