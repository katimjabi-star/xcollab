"use client";

import { useEffect, useRef, useState } from "react";
import { Link2, Trash2, X } from "lucide-react";
import type { LedgerEntry, Program, Task } from "@xcollab/core";
import {
  API_BASE,
  ApiError,
  WORKSPACE,
  createTask,
  deleteTask,
  programTeamId,
  updateTask,
  type TaskPatch,
} from "../lib/api-client.ts";
import { STRINGS, type UiLanguage } from "../lib/i18n.ts";
import { useToasts } from "../lib/toast-context.tsx";
import { Chip } from "./ui/chip.tsx";
import { Icon } from "./ui/icon.tsx";
import { TaskActivity } from "./task-activity.tsx";
import { AttachmentsSection } from "./attachments-section.tsx";
import { STATUS_LABEL_KEYS, TaskPanelFields } from "./task-panel-fields.tsx";

const DISARM_MS = 3000;

export interface LocatedTask {
  task: Task;
  packageId: string;
  packageName: string;
  lastInPackage: boolean;
}

export function locateTask(program: Program, taskId: string): LocatedTask | null {
  for (const pkg of program.packages) {
    const task = pkg.tasks.find((candidate) => candidate.id === taskId);
    if (task) {
      return {
        task,
        packageId: pkg.id,
        packageName: pkg.name,
        lastInPackage: pkg.tasks.length === 1,
      };
    }
  }
  return null;
}

interface TaskPanelContentProps {
  program: Program;
  located: LocatedTask;
  uiLanguage: UiLanguage;
  entries: LedgerEntry[];
  onClose: () => void;
  onProgramUpdate: (program: Program) => void;
  /** Called after each successful mutation so the host can refresh activity. */
  onMutated: () => void;
}

export function TaskPanelContent({
  program,
  located,
  uiLanguage,
  entries,
  onClose,
  onProgramUpdate,
  onMutated,
}: TaskPanelContentProps) {
  const t = STRINGS[uiLanguage];
  const { push } = useToasts();
  const { task, packageId, packageName, lastInPackage } = located;
  const [name, setName] = useState(task.name);
  const [status, setStatus] = useState<Task["status"]>(task.status);
  const [failed, setFailed] = useState(false);
  const [armed, setArmed] = useState(false);
  const statusPending = useRef(false);
  const disarmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (disarmTimer.current) clearTimeout(disarmTimer.current);
    },
    [],
  );

  const commitPatch = async (patch: TaskPatch): Promise<boolean> => {
    try {
      const result = await updateTask(API_BASE, {
        workspaceId: WORKSPACE,
        programId: program.id,
        taskId: task.id,
        patch,
      });
      setFailed(false);
      onProgramUpdate(result.program);
      push({ message: t.taskUpdated });
      onMutated();
      return true;
    } catch {
      setFailed(true);
      return false;
    }
  };

  const commitName = () => {
    const trimmed = name.trim();
    if (!trimmed || trimmed === task.name) {
      setName(task.name); // empty/whitespace or unchanged → revert, no request
      return;
    }
    void commitPatch({ name: trimmed }).then((ok) => {
      if (!ok) setName(task.name);
    });
  };

  const handleStatusChange = (to: Task["status"]) => {
    if (statusPending.current || to === status) return; // in-flight guard
    const previous = status;
    statusPending.current = true;
    setStatus(to);
    void commitPatch({ status: to })
      .then((ok) => {
        if (!ok) setStatus(previous);
      })
      .finally(() => {
        statusPending.current = false;
      });
  };

  const copyLink = () => {
    const url = `${window.location.origin}${window.location.pathname}?task=${encodeURIComponent(task.id)}`;
    // navigator.clipboard is undefined on insecure origins — fail via the toast.
    Promise.resolve()
      .then(() => navigator.clipboard.writeText(url))
      .then(() => push({ message: t.linkCopied }))
      .catch(() => push({ message: t.errorGeneric }));
  };

  const restoreTask = async (programId: string, pkgId: string, snapshot: Task) => {
    try {
      const created = await createTask(API_BASE, {
        workspaceId: WORKSPACE,
        programId,
        packageId: pkgId,
        name: snapshot.name,
        estimateDays: snapshot.estimateDays,
        assigneeRole: snapshot.assigneeRole,
        startDate: snapshot.startDate,
        dueDate: snapshot.dueDate,
        description: snapshot.description,
      });
      let next = created.program;
      if (snapshot.status !== "todo") {
        const patched = await updateTask(API_BASE, {
          workspaceId: WORKSPACE,
          programId,
          taskId: created.task.id,
          patch: { status: snapshot.status },
        });
        next = patched.program;
      }
      onProgramUpdate(next);
      push({ message: t.taskCreated });
    } catch {
      push({ message: t.errorGeneric });
    }
  };

  const handleDelete = () => {
    if (!armed) {
      setArmed(true);
      disarmTimer.current = setTimeout(() => setArmed(false), DISARM_MS);
      return;
    }
    if (disarmTimer.current) clearTimeout(disarmTimer.current);
    setArmed(false);
    const snapshot: Task = { ...task };
    const programId = program.id;
    const pkgId = packageId;
    deleteTask(API_BASE, { workspaceId: WORKSPACE, programId, taskId: task.id })
      .then((result) => {
        onProgramUpdate(result.program);
        onClose();
        push({
          message: t.taskDeleted,
          undo: () => {
            void restoreTask(programId, pkgId, snapshot);
          },
        });
      })
      .catch((cause: unknown) => {
        if (cause instanceof ApiError && cause.status === 409) {
          push({ message: t.lastTaskInPackage });
        } else {
          setFailed(true);
        }
      });
  };

  return (
    <>
      <div className="task-panel-strip">
        <Chip variant="status" status={status}>
          {t[STATUS_LABEL_KEYS[status]]}
        </Chip>
        <div className="task-panel-strip-actions">
          <button
            type="button"
            className="panel-icon-btn"
            aria-label={t.panelCopyLink}
            title={t.panelCopyLink}
            onClick={copyLink}
          >
            <Icon icon={Link2} />
          </button>
          <button
            type="button"
            className={`panel-icon-btn panel-delete-btn${armed ? " armed" : ""}`}
            aria-label={armed ? t.confirmDelete : t.deleteTask}
            title={lastInPackage ? t.lastTaskInPackage : armed ? t.confirmDelete : t.deleteTask}
            disabled={lastInPackage}
            onClick={handleDelete}
          >
            <Icon icon={Trash2} />
          </button>
          <button
            type="button"
            className="panel-icon-btn"
            aria-label={t.close}
            title={t.close}
            onClick={onClose}
          >
            <Icon icon={X} />
          </button>
        </div>
      </div>
      <div className="task-panel-head">
        <input
          className="task-panel-name"
          value={name}
          aria-label={t.taskName}
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
          }}
          onBlur={commitName}
        />
      </div>
      <div className="task-panel-body">
        {failed ? (
          <p className="error-note" role="alert">
            {t.errorGeneric}
          </p>
        ) : null}
        <TaskPanelFields
          task={task}
          uiLanguage={uiLanguage}
          status={status}
          onStatusChange={handleStatusChange}
          packageName={packageName}
          programTeamId={programTeamId(program)}
          commit={commitPatch}
        />
        {/* Attachments — under Description (TaskPanelFields ends with it). */}
        <AttachmentsSection
          programId={program.id}
          taskId={task.id}
          uiLanguage={uiLanguage}
          heading={t.attachmentsHeading}
          onChanged={onMutated}
        />
        <section className="panel-section">
          <h3 className="panel-section-label">{t.activityHeading}</h3>
          <TaskActivity entries={entries} uiLanguage={uiLanguage} emptyLabel={t.taskActivityEmpty} />
        </section>
      </div>
    </>
  );
}
