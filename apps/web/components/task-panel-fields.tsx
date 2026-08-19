"use client";

import { useState } from "react";
import type { Task } from "@xcollab/core";
import type { TaskPatch } from "../lib/api-client.ts";
import { STRINGS, type UiLanguage } from "../lib/i18n.ts";

interface TaskPanelFieldsProps {
  task: Task;
  uiLanguage: UiLanguage;
  /** Resolves true on a successful PATCH; false means "revert your local value". */
  commit: (patch: TaskPatch) => Promise<boolean>;
}

/**
 * The dates/estimate/assignee grid plus the description textarea.
 * All controls hold local state and commit per the field's semantics
 * (dates on change, the rest on blur). Remounted per task via key.
 */
export function TaskPanelFields({ task, uiLanguage, commit }: TaskPanelFieldsProps) {
  const t = STRINGS[uiLanguage];
  const [startDate, setStartDate] = useState(task.startDate ?? "");
  const [dueDate, setDueDate] = useState(task.dueDate ?? "");
  const [estimate, setEstimate] = useState(String(task.estimateDays));
  const [assignee, setAssignee] = useState(task.assigneeRole ?? "");
  const [description, setDescription] = useState(task.description ?? "");

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
      <div className="field-grid">
        <div className="field">
          <label className="field-label" htmlFor="task-panel-start">
            {t.taskStartDate}
          </label>
          <input
            id="task-panel-start"
            type="date"
            className="panel-input"
            value={startDate}
            onChange={(event) =>
              commitDate("startDate", event.target.value, setStartDate, task.startDate ?? "")
            }
          />
        </div>
        <div className="field">
          <label className="field-label" htmlFor="task-panel-due">
            {t.taskDueDate}
          </label>
          <input
            id="task-panel-due"
            type="date"
            className="panel-input"
            value={dueDate}
            onChange={(event) =>
              commitDate("dueDate", event.target.value, setDueDate, task.dueDate ?? "")
            }
          />
        </div>
        <div className="field">
          <label className="field-label" htmlFor="task-panel-estimate">
            {t.taskEstimate}
          </label>
          <input
            id="task-panel-estimate"
            type="number"
            min={0.5}
            step={0.5}
            className="panel-input"
            value={estimate}
            onChange={(event) => setEstimate(event.target.value)}
            onBlur={commitEstimate}
          />
        </div>
        <div className="field">
          <label className="field-label" htmlFor="task-panel-assignee">
            {t.taskAssigneeRole}
          </label>
          <input
            id="task-panel-assignee"
            type="text"
            className="panel-input"
            value={assignee}
            onChange={(event) => setAssignee(event.target.value)}
            onBlur={commitAssignee}
          />
        </div>
      </div>
      <div>
        <label className="field-label" htmlFor="task-panel-description">
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
