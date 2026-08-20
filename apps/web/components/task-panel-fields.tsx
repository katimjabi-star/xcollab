"use client";

import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import type { Task } from "@xcollab/core";
import type { TaskPatch } from "../lib/api-client.ts";
import { STRINGS, type UiLanguage } from "../lib/i18n.ts";
import { AssigneePicker } from "./assignee-picker.tsx";
import { Chip } from "./ui/chip.tsx";
import { Icon } from "./ui/icon.tsx";
import { Popover } from "./ui/popover.tsx";

type Strings = (typeof STRINGS)["en"];

export const STATUS_LABEL_KEYS: Record<
  Task["status"],
  "statusTodo" | "statusInProgress" | "statusBlocked" | "statusDone"
> = {
  todo: "statusTodo",
  in_progress: "statusInProgress",
  blocked: "statusBlocked",
  done: "statusDone",
};

const STATUS_ORDER: Task["status"][] = ["todo", "in_progress", "blocked", "done"];

/** Chip-shaped trigger opening a popover status menu (replaces the <select>). */
function StatusEditor({
  status,
  onChange,
  t,
}: {
  status: Task["status"];
  onChange: (to: Task["status"]) => void;
  t: Strings;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover
      open={open}
      onClose={() => setOpen(false)}
      role="menu"
      align="start"
      anchor={
        <button
          type="button"
          className={`panel-status-trigger ui-chip ui-chip-${status}`}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label={t.taskStatus}
          onClick={() => setOpen((prev) => !prev)}
        >
          {t[STATUS_LABEL_KEYS[status]]}
          <Icon icon={ChevronDown} size={12} />
        </button>
      }
    >
      {STATUS_ORDER.map((option) => (
        <button
          key={option}
          type="button"
          role="menuitemradio"
          aria-checked={option === status}
          className="panel-menu-item"
          onClick={() => {
            setOpen(false);
            onChange(option);
          }}
        >
          <Chip variant="status" status={option}>
            {t[STATUS_LABEL_KEYS[option]]}
          </Chip>
          {option === status ? <Icon icon={Check} size={14} /> : null}
        </button>
      ))}
    </Popover>
  );
}

/** Local YYYY-MM-DD (schema dates are calendar dates, not instants). */
function todayIso(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

interface TaskPanelFieldsProps {
  task: Task;
  uiLanguage: UiLanguage;
  status: Task["status"];
  onStatusChange: (to: Task["status"]) => void;
  packageName: string;
  /** Connected team of the program — the assignee picker sorts its members first. */
  programTeamId?: string | null;
  /** Resolves true on a successful PATCH; false means "revert your local value". */
  commit: (patch: TaskPatch) => Promise<boolean>;
}

/**
 * Two-column property grid (status/estimate/assignee/dates/package) plus the
 * description textarea. All controls hold local state and commit per the
 * field's semantics (dates on change, the rest on blur). Remounted per task.
 */
export function TaskPanelFields({
  task,
  uiLanguage,
  status,
  onStatusChange,
  packageName,
  programTeamId = null,
  commit,
}: TaskPanelFieldsProps) {
  const t = STRINGS[uiLanguage];
  const [startDate, setStartDate] = useState(task.startDate ?? "");
  const [dueDate, setDueDate] = useState(task.dueDate ?? "");
  const [estimate, setEstimate] = useState(String(task.estimateDays));
  const [assignee, setAssignee] = useState(task.assigneeRole ?? "");
  const [assigneeUser, setAssigneeUser] = useState<string | null>(task.assignee ?? null);
  const [description, setDescription] = useState(task.description ?? "");
  const overdue = dueDate !== "" && status !== "done" && dueDate < todayIso();

  const commitDate = (
    field: "startDate" | "dueDate",
    value: string,
    revert: (value: string) => void,
    previous: string,
  ) => {
    revert(value);
    void commit({ [field]: value === "" ? null : value }).then((ok) => {
      if (!ok) revert(previous);
    });
  };

  const commitEstimate = () => {
    const parsed = Number(estimate);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setEstimate(String(task.estimateDays)); // schema requires positive()
      return;
    }
    if (parsed === task.estimateDays) return;
    void commit({ estimateDays: parsed }).then((ok) => {
      if (!ok) setEstimate(String(task.estimateDays));
    });
  };

  // Optimistic: swap the avatar immediately, revert on a failed PATCH.
  const commitAssigneeUser = (username: string | null) => {
    const previous = task.assignee ?? null;
    setAssigneeUser(username);
    void commit({ assignee: username }).then((ok) => {
      if (!ok) setAssigneeUser(previous);
    });
  };

  const commitAssignee = () => {
    const trimmed = assignee.trim();
    const current = task.assigneeRole ?? "";
    setAssignee(trimmed);
    if (trimmed === current) return;
    void commit({ assigneeRole: trimmed === "" ? null : trimmed }).then((ok) => {
      if (!ok) setAssignee(current);
    });
  };

  const commitDescription = () => {
    const current = task.description ?? "";
    if (description === current) return;
    void commit({ description: description === "" ? null : description }).then((ok) => {
      if (!ok) setDescription(current);
    });
  };

  return (
    <>
      <div className="prop-grid">
        <div className="prop-row">
          <span className="prop-label">{t.taskStatus}</span>
          <div className="prop-value">
            <StatusEditor status={status} onChange={onStatusChange} t={t} />
          </div>
        </div>
        <div className="prop-row">
          <label className="prop-label" htmlFor="task-panel-estimate">
            {t.taskEstimate}
          </label>
          <div className="prop-value">
            <input
              id="task-panel-estimate"
              type="number"
              min={0.5}
              step={0.5}
              className="prop-input"
              value={estimate}
              onChange={(event) => setEstimate(event.target.value)}
              onBlur={commitEstimate}
            />
          </div>
        </div>
        <div className="prop-row">
          <span className="prop-label">{t.taskAssignee}</span>
          <div className="prop-value">
            <AssigneePicker
              assignee={assigneeUser}
              onSelect={commitAssigneeUser}
              programTeamId={programTeamId}
              t={t}
            />
          </div>
        </div>
        <div className="prop-row">
          <label className="prop-label" htmlFor="task-panel-assignee">
            {t.taskAssigneeRole}
          </label>
          <div className="prop-value">
            <input
              id="task-panel-assignee"
              type="text"
              className="prop-input"
              value={assignee}
              onChange={(event) => setAssignee(event.target.value)}
              onBlur={commitAssignee}
            />
          </div>
        </div>
        <div className="prop-row">
          <label className="prop-label" htmlFor="task-panel-start">
            {t.taskStartDate}
          </label>
          <div className="prop-value">
            <input
              id="task-panel-start"
              type="date"
              className="prop-input"
              value={startDate}
              onChange={(event) =>
                commitDate("startDate", event.target.value, setStartDate, task.startDate ?? "")
              }
            />
          </div>
        </div>
        <div className="prop-row">
          <label className="prop-label" htmlFor="task-panel-due">
            {t.taskDueDate}
          </label>
          <div className="prop-value">
            <input
              id="task-panel-due"
              type="date"
              className="prop-input"
              value={dueDate}
              onChange={(event) =>
                commitDate("dueDate", event.target.value, setDueDate, task.dueDate ?? "")
              }
            />
            {overdue ? (
              <Chip variant="dueDate" overdue>
                {t.overdueLabel}
              </Chip>
            ) : null}
          </div>
        </div>
        <div className="prop-row">
          <span className="prop-label">{t.taskPackage}</span>
          <div className="prop-value">
            <span className="prop-static">{packageName}</span>
          </div>
        </div>
      </div>
      <div className="panel-section">
        <label className="panel-section-label" htmlFor="task-panel-description">
          {t.taskDescription}
        </label>
        <textarea
          id="task-panel-description"
          className="panel-textarea"
          maxLength={4000}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          onBlur={commitDescription}
        />
      </div>
    </>
  );
}
