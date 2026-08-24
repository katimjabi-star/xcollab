"use client";

import { X } from "lucide-react";
import { useState, type ReactElement } from "react";
import type { Program } from "@xcollab/core";
import { API_BASE, WORKSPACE, createTask, listPrograms, updateTask } from "../lib/api-client.ts";
import { useAuth } from "../lib/auth-context.tsx";
import { STRINGS, type UiLanguage } from "../lib/i18n.ts";
import { localTodayIso } from "../lib/my-tasks.ts";
import { programColor, programDisplayName } from "../lib/program-format.ts";
import { useToasts } from "../lib/toast-context.tsx";
import { useWorkspaceData } from "../lib/use-workspace-data.ts";
import { Icon } from "./ui/icon.tsx";
import { Skeleton } from "./ui/skeleton.tsx";

interface CreateTaskDialogProps {
  uiLanguage: UiLanguage;
  onClose: () => void;
}

/** Project / section / due-date picker row (split out to keep the form
    within the complexity cap). */
function PickerRow({
  t,
  programs,
  programId,
  pkgId,
  packages,
  dueDate,
  onProgram,
  onPackage,
  onDueDate,
}: {
  t: (typeof STRINGS)["en"];
  programs: Program[];
  programId: string;
  pkgId: string | null;
  packages: Program["packages"];
  dueDate: string;
  onProgram: (id: string) => void;
  onPackage: (id: string) => void;
  onDueDate: (value: string) => void;
}): ReactElement {
  return (
    <div className="s2-taskdialog-pickers">
      <label className="s2-taskdialog-picker">
        <span>{t.myTasksProjectLabel}</span>
        <span className="s2-taskdialog-picker-control">
          <span
            className="project-swatch"
            style={{ background: programColor(programId) }}
            aria-hidden
          />
          <select value={programId} onChange={(event) => onProgram(event.target.value)}>
            {programs.map((p) => (
              <option key={p.id} value={p.id}>
                {programDisplayName(p)}
              </option>
            ))}
          </select>
        </span>
      </label>
      <label className="s2-taskdialog-picker">
        <span>{t.taskPackage}</span>
        <span className="s2-taskdialog-picker-control">
          <select value={pkgId ?? ""} onChange={(event) => onPackage(event.target.value)}>
            {packages.map((pkg) => (
              <option key={pkg.id} value={pkg.id}>
                {pkg.name}
              </option>
            ))}
          </select>
        </span>
      </label>
      <label className="s2-taskdialog-picker">
        <span>{t.taskDueDate}</span>
        <span className="s2-taskdialog-picker-control">
          <input type="date" value={dueDate} onChange={(event) => onDueDate(event.target.value)} />
        </span>
      </label>
    </div>
  );
}

/** Body of the dialog once programs are loaded: name-first layout (large
    borderless input → description → project/section/due pickers → footer
    action), matching the reference quick-add. */
function CreateTaskForm({
  programs,
  uiLanguage,
  username,
  onClose,
}: {
  programs: Program[];
  uiLanguage: UiLanguage;
  username: string;
  onClose: () => void;
}): ReactElement {
  const t = STRINGS[uiLanguage];
  const { push } = useToasts();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [programId, setProgramId] = useState(programs[0]?.id ?? "");
  const [packageId, setPackageId] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const program = programs.find((p) => p.id === programId) ?? null;
  const packages = program?.packages ?? [];
  const pkgId =
    packageId && packages.some((p) => p.id === packageId) ? packageId : (packages[0]?.id ?? null);
  const pastDue = dueDate !== "" && dueDate < localTodayIso();

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
        ...(dueDate ? { dueDate } : {}),
        ...(description.trim() ? { description: description.trim() } : {}),
      });
      await updateTask(API_BASE, {
        workspaceId: WORKSPACE,
        programId: program.id,
        taskId: created.task.id,
        patch: { assignee: username },
      });
      push({ message: t.taskCreated });
      onClose();
    } catch {
      push({ message: t.actionFailed });
      setPending(false);
    }
  };

  return (
    <form
      className="s2-taskdialog-form"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <input
        autoFocus
        className="s2-taskdialog-name"
        value={name}
        placeholder={t.taskName}
        aria-label={t.taskName}
        maxLength={500}
        onChange={(event) => setName(event.target.value)}
      />
      <textarea
        className="s2-taskdialog-desc"
        value={description}
        placeholder={t.taskDescriptionPlaceholder}
        aria-label={t.taskDescription}
        rows={2}
        maxLength={4000}
        onChange={(event) => setDescription(event.target.value)}
      />
      <PickerRow
        t={t}
        programs={programs}
        programId={programId}
        pkgId={pkgId}
        packages={packages}
        dueDate={dueDate}
        onProgram={(id) => {
          setProgramId(id);
          setPackageId(null);
        }}
        onPackage={setPackageId}
        onDueDate={setDueDate}
      />
      {pastDue ? (
        <p className="s2-taskdialog-warn" role="status">
          {t.pastDueDateWarning}
        </p>
      ) : null}
      <div className="s2-taskdialog-foot">
        <button type="button" className="mt-ghost-btn" onClick={onClose}>
          {t.cancel}
        </button>
        <button type="submit" className="s2-taskdialog-submit" disabled={pending || !name.trim() || !pkgId}>
          {t.createTaskAction}
        </button>
      </div>
    </form>
  );
}

/** Global quick-create task dialog, opened from the top bar's "+ Create" menu
    on any screen. Floating card at the trailing bottom corner. */
export function CreateTaskDialog({ uiLanguage, onClose }: CreateTaskDialogProps): ReactElement {
  const t = STRINGS[uiLanguage];
  const { user } = useAuth();
  const { data: programs, loaded } = useWorkspaceData(listPrograms);

  return (
    <div
      className="s2-taskdialog"
      role="dialog"
      aria-modal="false"
      aria-label={t.createTaskAction}
      onKeyDown={(event) => {
        if (event.key === "Escape") onClose();
      }}
    >
      <div className="s2-taskdialog-head">
        <h2>{t.createTaskAction}</h2>
        <button type="button" className="s2-icon-btn" onClick={onClose} aria-label={t.close}>
          <Icon icon={X} size={16} />
        </button>
      </div>
      {loaded && programs ? (
        <CreateTaskForm
          programs={programs}
          uiLanguage={uiLanguage}
          username={user?.username ?? ""}
          onClose={onClose}
        />
      ) : (
        <Skeleton height="10rem" label={t.skeletonLoading} />
      )}
    </div>
  );
}
