"use client";

import { useEffect, useState, type ReactElement } from "react";
import type { Program } from "@xcollab/core";
import { API_BASE, WORKSPACE, createTask, updateTask } from "../lib/api-client.ts";
import { STRINGS, type UiLanguage } from "../lib/i18n.ts";
import { programDisplayName } from "../lib/program-format.ts";
import { useToasts } from "../lib/toast-context.tsx";

interface TargetFieldsProps {
  t: (typeof STRINGS)["en"];
  programs: Program[];
  programId: string | null;
  pkgId: string | null;
  packages: Program["packages"];
  onProgram: (id: string | null) => void;
  onPackage: (id: string) => void;
}

/** Project + section selects (split out to keep AddTaskForm within the
    complexity cap). */
function TargetFields({
  t,
  programs,
  programId,
  pkgId,
  packages,
  onProgram,
  onPackage,
}: TargetFieldsProps): ReactElement {
  return (
    <>
      <label className="mt-create-field">
        <span>{t.myTasksProjectLabel}</span>
        <select
          value={programId ?? ""}
          onChange={(event) => onProgram(event.target.value || null)}
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
        <select value={pkgId ?? ""} onChange={(event) => onPackage(event.target.value)}>
          {packages.map((pkg) => (
            <option key={pkg.id} value={pkg.id}>
              {pkg.name}
            </option>
          ))}
        </select>
      </label>
    </>
  );
}

interface AddTaskFormProps {
  programs: Program[];
  uiLanguage: UiLanguage;
  /** Token user — new tasks are assigned to them so they land in My Tasks. */
  username: string;
  /** Due date preset from the bucket the add started in; null = none. */
  presetDueDate: string | null;
  /** Preferred target project (e.g. the active filter); falls back to first. */
  defaultProgramId: string | null;
  /** Called after a successful create (host refreshes and closes). */
  onCreated: () => void;
  /** Called when the user cancels (Escape) or after a create. */
  onClose: () => void;
  /** Compact = inline composer row/card; default = popover layout. */
  compact?: boolean;
}

/** Project/section/name create form shared by the toolbar popover and the
    inline bucket composers — the form always renders where the add started. */
export function AddTaskForm({
  programs,
  uiLanguage,
  username,
  presetDueDate,
  defaultProgramId,
  onCreated,
  onClose,
  compact = false,
}: AddTaskFormProps): ReactElement {
  const t = STRINGS[uiLanguage];
  const { push } = useToasts();
  const [programId, setProgramId] = useState<string | null>(null);
  const [packageId, setPackageId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);

  // Default target: the caller's preferred project when set, else the first.
  useEffect(() => {
    const fallback = defaultProgramId ?? programs[0]?.id ?? null;
    setProgramId((current) =>
      current && programs.some((p) => p.id === current) ? current : fallback,
    );
  }, [defaultProgramId, programs]);

  const program = programs.find((p) => p.id === programId) ?? null;
  const packages = program?.packages ?? [];
  const pkgId =
    packageId && packages.some((p) => p.id === packageId) ? packageId : (packages[0]?.id ?? null);

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
      onCreated();
      onClose();
    } catch {
      push({ message: t.actionFailed });
    } finally {
      setPending(false);
    }
  };

  return (
    <form
      className={compact ? "mt-create mt-create-inline" : "mt-create"}
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") onClose();
      }}
    >
      {compact ? null : <p className="mt-create-heading">{t.myTasksPickTarget}</p>}
      <TargetFields
        t={t}
        programs={programs}
        programId={programId}
        pkgId={pkgId}
        packages={packages}
        onProgram={(id) => {
          setProgramId(id);
          setPackageId(null);
        }}
        onPackage={setPackageId}
      />
      <label className="mt-create-field">
        <span>{t.taskName}</span>
        <input
          autoFocus
          value={name}
          placeholder={t.addTaskPlaceholder}
          onChange={(event) => setName(event.target.value)}
        />
      </label>
      <div className="mt-create-actions">
        <button
          type="submit"
          className="mt-create-submit"
          disabled={pending || !name.trim() || !pkgId}
        >
          {t.addTask}
        </button>
        {compact ? (
          <button type="button" className="mt-ghost-btn" onClick={onClose}>
            {t.cancel}
          </button>
        ) : null}
      </div>
    </form>
  );
}
