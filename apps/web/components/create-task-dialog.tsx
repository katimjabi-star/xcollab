"use client";

import { X } from "lucide-react";
import { useState, type ReactElement } from "react";
import { listPrograms } from "../lib/api-client.ts";
import { useAuth } from "../lib/auth-context.tsx";
import { localTodayIso } from "../lib/my-tasks.ts";
import { STRINGS, type UiLanguage } from "../lib/i18n.ts";
import { useWorkspaceData } from "../lib/use-workspace-data.ts";
import { AddTaskForm } from "./my-tasks-add-form.tsx";
import { Icon } from "./ui/icon.tsx";
import { Skeleton } from "./ui/skeleton.tsx";

interface CreateTaskDialogProps {
  uiLanguage: UiLanguage;
  onClose: () => void;
}

/** Global quick-create task dialog, opened from the top bar's "+ Create" menu
    on any screen. Floating card at the trailing bottom corner (reference
    product's quick-add position); reuses the shared AddTaskForm, adding a due
    date the form passes through as its preset. */
export function CreateTaskDialog({ uiLanguage, onClose }: CreateTaskDialogProps): ReactElement {
  const t = STRINGS[uiLanguage];
  const { user } = useAuth();
  const { data: programs, loaded } = useWorkspaceData(listPrograms);
  const [dueDate, setDueDate] = useState("");

  return (
    <div
      className="s2-taskdialog"
      role="dialog"
      aria-modal="false"
      aria-label={t.createTask}
      onKeyDown={(event) => {
        if (event.key === "Escape") onClose();
      }}
    >
      <div className="s2-taskdialog-head">
        <h2>{t.createTask}</h2>
        <button type="button" className="s2-icon-btn" onClick={onClose} aria-label={t.close}>
          <Icon icon={X} size={16} />
        </button>
      </div>
      <label className="mt-create-field s2-taskdialog-due">
        <span>{t.taskDueDate}</span>
        <input
          type="date"
          value={dueDate}
          onChange={(event) => setDueDate(event.target.value)}
        />
      </label>
      {dueDate && dueDate < localTodayIso() ? (
        <p className="s2-taskdialog-warn" role="status">
          {t.pastDueDateWarning}
        </p>
      ) : null}
      {loaded && programs ? (
        <AddTaskForm
          programs={programs}
          uiLanguage={uiLanguage}
          username={user?.username ?? ""}
          presetDueDate={dueDate || null}
          defaultProgramId={null}
          onCreated={onClose}
          onClose={onClose}
          compact
        />
      ) : (
        <Skeleton height="6rem" label={t.skeletonLoading} />
      )}
    </div>
  );
}
