"use client";

import type { STRINGS } from "../lib/i18n.ts";
import { Chip } from "./ui/chip.tsx";

type Strings = (typeof STRINGS)["en"];

/** Start/due date rows of the task peek's property grid, plus the shared
    order-error note. Ordering is double-enforced: native min/max on the
    inputs and the host's cross-field check (which owns `dateError`). */
export function DateRows({
  t,
  startDate,
  dueDate,
  dateError,
  overdueChip,
  onStart,
  onDue,
}: {
  t: Strings;
  startDate: string;
  dueDate: string;
  dateError: boolean;
  /** "Overdue by N days" text; null hides the chip. */
  overdueChip: string | null;
  onStart: (value: string) => void;
  onDue: (value: string) => void;
}) {
  const describedBy = dateError ? "task-panel-dates-error" : undefined;
  return (
    <>
      <div className="prop-row">
        <label className="prop-label" htmlFor="task-panel-start">
          {t.taskStartDate}
        </label>
        <div className="prop-value">
          <input
            id="task-panel-start"
            type="date"
            className="prop-input"
            max={dueDate || undefined}
            value={startDate}
            aria-invalid={dateError || undefined}
            aria-describedby={describedBy}
            onChange={(event) => onStart(event.target.value)}
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
            min={startDate || undefined}
            value={dueDate}
            aria-invalid={dateError || undefined}
            aria-describedby={describedBy}
            onChange={(event) => onDue(event.target.value)}
          />
          {overdueChip !== null ? (
            <Chip variant="dueDate" overdue>
              {overdueChip}
            </Chip>
          ) : null}
        </div>
      </div>
      {dateError ? (
        <p className="error-note" id="task-panel-dates-error" role="alert">
          {t.taskDatesOrderError}
        </p>
      ) : null}
    </>
  );
}
