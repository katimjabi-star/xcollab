"use client";

import { Fragment } from "react";
import type { Program, Task } from "@xcollab/core";
import { isOverdue } from "../lib/board-filter.ts";
import { localTodayIso } from "../lib/my-tasks.ts";
import type { UiLanguage } from "../lib/i18n.ts";
import { STRINGS } from "../lib/i18n.ts";

/** Fixed inline-start name column; lanes get 120px per month (min 640px). */
const NAME_COL_PX = 200;
const MONTH_MIN_PX = 120;
const LANE_MIN_PX = 640;
const MS_PER_DAY = 86_400_000;

/** UTC day ordinal for an ISO date — clock/TZ-free bar math. */
function dayIndex(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y ?? 0, (m ?? 1) - 1, d ?? 1) / MS_PER_DAY;
}


interface MonthCell {
  key: string;
  label: string;
  widthPct: number;
}

/** Month header cells sized by each month's day-overlap with the timeline. */
function monthCells(start: string, end: string, locale: string): MonthCell[] {
  const startIdx = dayIndex(start);
  const endIdx = dayIndex(end);
  const total = endIdx - startIdx + 1;
  const spansYears = start.slice(0, 4) !== end.slice(0, 4);
  const format = new Intl.DateTimeFormat(locale, {
    month: "short",
    timeZone: "UTC",
    ...(spansYears ? { year: "2-digit" as const } : {}),
  });
  const cells: MonthCell[] = [];
  let cursor = Date.UTC(Number(start.slice(0, 4)), Number(start.slice(5, 7)) - 1, 1);
  const lastMonth = Date.UTC(Number(end.slice(0, 4)), Number(end.slice(5, 7)) - 1, 1);
  while (cursor <= lastMonth) {
    const date = new Date(cursor);
    const next = Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1);
    const from = Math.max(cursor / MS_PER_DAY, startIdx);
    const to = Math.min(next / MS_PER_DAY - 1, endIdx);
    cells.push({
      key: date.toISOString().slice(0, 7),
      label: format.format(date),
      widthPct: ((to - from + 1) / total) * 100,
    });
    cursor = next;
  }
  return cells;
}

/** Bar span in lane percentages. startDate→dueDate; a single-dated task gets
    a 1-day bar at its one date; an undated task gets no bar (a note instead).
    Out-of-range days clamp to the program window. */
function barGeometry(
  task: Task,
  startIdx: number,
  totalDays: number,
): { startPct: number; widthPct: number } | null {
  const anchor = task.startDate ?? task.dueDate;
  if (!anchor) return null;
  const endDate = task.dueDate ?? anchor;
  const from = Math.min(Math.max(dayIndex(anchor), startIdx), startIdx + totalDays - 1);
  const rawTo = Math.max(dayIndex(endDate), from);
  const to = Math.min(rawTo, startIdx + totalDays - 1);
  return {
    startPct: ((from - startIdx) / totalDays) * 100,
    widthPct: ((to - from + 1) / totalDays) * 100,
  };
}

function barClass(task: Task, today: string): string {
  if (task.status === "done") return "tl-bar tl-bar-done";
  if (isOverdue(task, today)) return "tl-bar tl-bar-overdue";
  return `tl-bar tl-bar-${task.status}`;
}

/** Read-only Gantt: month header, milestone diamond lane, package-grouped
    task rows with status-tinted bars, and a "today" rule. Scrolls inside its
    own region (the page never scrolls sideways); all math is logical-inline
    so RTL programs flow right-to-left. */
export function TimelineView({
  program,
  uiLanguage,
  onTaskSelect,
}: {
  program: Program;
  uiLanguage: UiLanguage;
  /** When provided, activating a task row opens the task panel. */
  onTaskSelect?: (taskId: string) => void;
}) {
  const t = STRINGS[uiLanguage];
  const locale = uiLanguage === "ar" ? "ar" : "en";
  const { start, end } = program.timeline;
  const startIdx = dayIndex(start);
  const totalDays = dayIndex(end) - startIdx + 1;
  const months = monthCells(start, end, locale);
  const laneWidth = Math.max(LANE_MIN_PX, months.length * MONTH_MIN_PX);
  const laneStyle = { inlineSize: `${laneWidth}px` };
  const today = localTodayIso();
  const todayInRange = today >= start && today <= end;
  const todayOffset =
    NAME_COL_PX + laneWidth * ((dayIndex(today) - startIdx + 0.5) / totalDays);
  const todayPct = ((dayIndex(today) - startIdx + 0.5) / totalDays) * 100;

  // Week grid: Monday ticks + Sat/Sun tint bands. Day indices are UTC-epoch
  // days (epoch day 0 = Thursday), so weekday math is pure arithmetic.
  const weekTicks: number[] = [];
  const weekendBands: { from: number; days: number }[] = [];
  for (let idx = startIdx; idx < startIdx + totalDays; idx++) {
    if (idx > startIdx && (idx + 3) % 7 === 0) weekTicks.push(idx); // Monday
    if ((idx + 5) % 7 === 0) weekendBands.push({ from: idx, days: Math.min(2, startIdx + totalDays - idx) }); // Saturday
  }
  const dayPx = (idx: number) => NAME_COL_PX + laneWidth * ((idx - startIdx) / totalDays);

  // Milestones sorted by date; a name label renders beside each diamond when
  // the gap to the next diamond (or the lane end) leaves room for one.
  const visibleMilestones = program.milestones
    .filter((ms) => ms.dueDate >= start && ms.dueDate <= end)
    .sort((a, b) => (a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : 0));
  const milestonePct = (iso: string) => ((dayIndex(iso) - startIdx + 0.5) / totalDays) * 100;

  return (
    <div className="tl-region" dir={program.language === "ar" ? "rtl" : "ltr"}>
      <div className="tl-scroller" tabIndex={0} role="region" aria-label={t.viewTimeline}>
        <div className="tl-inner">
          {/* Decorative week grid, painted behind rows (first in DOM order) */}
          {weekendBands.map((band) => (
            <span
              key={`we-${band.from}`}
              className="tl-weekend"
              aria-hidden="true"
              style={{
                insetInlineStart: `${dayPx(band.from)}px`,
                inlineSize: `${laneWidth * (band.days / totalDays)}px`,
              }}
            />
          ))}
          {weekTicks.map((idx) => (
            <span
              key={`wk-${idx}`}
              className="tl-tick"
              aria-hidden="true"
              style={{ insetInlineStart: `${dayPx(idx)}px` }}
            />
          ))}

          <div className="tl-row tl-months">
            <span className="tl-namecol" />
            <span className="tl-lane" style={laneStyle}>
              {months.map((month) => (
                <span key={month.key} className="tl-month" style={{ inlineSize: `${month.widthPct}%` }}>
                  {month.label}
                </span>
              ))}
              {todayInRange ? (
                <span
                  className="tl-today-chip"
                  style={{ insetInlineStart: `calc(${todayPct}% + 4px)` }}
                >
                  {t.timelineTodayLabel}
                </span>
              ) : null}
            </span>
          </div>

          {program.milestones.length > 0 ? (
            <div className="tl-row tl-ms-row">
              <span className="tl-namecol tl-ms-name">{t.milestonesHeading}</span>
              <span className="tl-lane" style={laneStyle}>
                {visibleMilestones.map((ms, i) => {
                  const pct = milestonePct(ms.dueDate);
                  const next = visibleMilestones[i + 1];
                  const nextPct = next ? milestonePct(next.dueDate) : 100;
                  const labelPx = (laneWidth * (nextPct - pct)) / 100 - 16;
                  return (
                    <Fragment key={ms.id}>
                      <span
                        className="tl-diamond"
                        title={`${ms.name} · ${ms.dueDate}`}
                        style={{ insetInlineStart: `${pct}%` }}
                      />
                      {labelPx >= 48 ? (
                        <span
                          className="tl-ms-label"
                          aria-hidden="true"
                          style={{
                            insetInlineStart: `calc(${pct}% + 10px)`,
                            maxInlineSize: `${labelPx}px`,
                          }}
                        >
                          {ms.name}
                        </span>
                      ) : null}
                    </Fragment>
                  );
                })}
              </span>
            </div>
          ) : null}

          {program.packages.map((pkg) => (
            <Fragment key={pkg.id}>
              {/* Sticky 36px package header: name + count; scope on hover. */}
              <div className="tl-row tl-pkg-head" title={pkg.scope}>
                <span className="tl-namecol tl-pkg-name">
                  <span className="tl-pkg-label">{pkg.name}</span>
                  <span className="tl-pkg-count num">{pkg.tasks.length}</span>
                </span>
                <span className="tl-lane" style={laneStyle} />
              </div>
              {pkg.tasks.map((task) => {
                const bar = barGeometry(task, startIdx, totalDays);
                const dates = task.startDate
                  ? `${task.startDate} → ${task.dueDate ?? task.startDate}`
                  : task.dueDate;
                // Identity beside the bar: label after the bar end when room
                // remains, so long charts don't force eye-travel to the name column.
                const barEndPct = bar ? bar.startPct + bar.widthPct : 0;
                const labelSpacePx = bar ? laneWidth * (1 - barEndPct / 100) - 12 : 0;
                const content = (
                  <>
                    <span className="tl-namecol tl-task-name" title={task.name}>
                      {task.name}
                    </span>
                    <span className="tl-lane" style={laneStyle}>
                      {bar ? (
                        <>
                          <span
                            className={barClass(task, today)}
                            title={`${task.name} · ${dates}`}
                            style={{
                              insetInlineStart: `${bar.startPct}%`,
                              inlineSize: `${bar.widthPct}%`,
                            }}
                          />
                          {labelSpacePx >= 48 ? (
                            <span
                              className="tl-bar-label"
                              aria-hidden="true"
                              style={{
                                insetInlineStart: `calc(${barEndPct}% + 8px)`,
                                maxInlineSize: `${labelSpacePx}px`,
                              }}
                            >
                              {task.name}
                            </span>
                          ) : null}
                        </>
                      ) : (
                        <span className="tl-nodates">{t.timelineNoDates}</span>
                      )}
                    </span>
                  </>
                );
                return onTaskSelect ? (
                  <button
                    key={task.id}
                    type="button"
                    className="tl-row tl-task"
                    onClick={() => onTaskSelect(task.id)}
                  >
                    {content}
                  </button>
                ) : (
                  <div key={task.id} className="tl-row tl-task">
                    {content}
                  </div>
                );
              })}
            </Fragment>
          ))}

          {todayInRange ? (
            <span
              className="tl-today"
              title={t.timelineTodayLabel}
              aria-hidden="true"
              style={{ insetInlineStart: `${todayOffset}px` }}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
