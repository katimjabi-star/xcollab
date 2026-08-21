"use client";

import { useMemo, useState } from "react";
import {
  CalendarRange,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ListFilter,
  Plus,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { STRINGS, type UiLanguage } from "../lib/i18n.ts";
import {
  addMonths,
  addWeeks,
  dayIndex,
  itemSpan,
  layoutWeek,
  localTodayIso,
  monthGrid,
  monthTitle,
  weekdayNames,
  weeksGrid,
  type DayCell,
  type ItemSpan,
} from "../lib/calendar.ts";
import { Icon } from "./ui/icon.tsx";

export interface CalendarItem {
  id: string;
  name: string;
  startDate?: string;
  dueDate?: string;
  color: string;
  programId: string;
  done?: boolean;
}

type Density = "month" | "weeks";

/* Bar geometry (px): number strip at the top of each cell, then lanes. */
const HEAD_PX = 34;
const BAR_PX = 24;
const GAP_PX = 4;

function WeekRow({
  week,
  spans,
  itemById,
  todayIso,
  t,
  onOpenItem,
  onAddDay,
}: {
  week: DayCell[];
  spans: ItemSpan[];
  itemById: Map<string, CalendarItem>;
  todayIso: string;
  t: (typeof STRINGS)["en"];
  onOpenItem: (item: CalendarItem) => void;
  onAddDay?: (isoDate: string) => void;
}) {
  const segments = layoutWeek(dayIndex(week[0]?.iso ?? "1970-01-01"), spans);
  const lanes = segments.reduce((max, seg) => Math.max(max, seg.lane + 1), 0);
  return (
    <div
      className="cal-week"
      style={{ minHeight: `${HEAD_PX + lanes * (BAR_PX + GAP_PX) + 44}px` }}
    >
      {week.map((cell) => (
        <div key={cell.iso} className={cell.inMonth ? "cal-day" : "cal-day cal-day-out"}>
          <span className={cell.iso === todayIso ? "cal-daynum cal-daynum-today" : "cal-daynum"}>
            {cell.dayOfMonth}
          </span>
          {onAddDay ? (
            <button type="button" className="cal-add-ghost" onClick={() => onAddDay(cell.iso)}>
              <Icon icon={Plus} size={14} /> {t.calAddTask}
            </button>
          ) : null}
        </div>
      ))}
      {segments.map((seg) => {
        const item = itemById.get(seg.id);
        if (!item) return null;
        const classes = [
          "cal-bar",
          seg.continuesBefore ? "cal-bar-cont-before" : null,
          seg.continuesAfter ? "cal-bar-cont-after" : null,
          item.done ? "cal-bar-done" : null,
        ]
          .filter(Boolean)
          .join(" ");
        return (
          <button
            key={`${seg.id}:${seg.startCol}`}
            type="button"
            className={classes}
            style={{
              insetInlineStart: `calc(${(seg.startCol / 7) * 100}% + 2px)`,
              width: `calc(${((seg.endCol - seg.startCol + 1) / 7) * 100}% - 4px)`,
              top: `${HEAD_PX + seg.lane * (BAR_PX + GAP_PX)}px`,
              background: item.color,
            }}
            title={item.name}
            onClick={() => onOpenItem(item)}
          >
            <span className="cal-bar-name">{item.name}</span>
          </button>
        );
      })}
    </div>
  );
}

export function CalendarView({
  items,
  uiLanguage,
  onOpenItem,
  onAddDay,
}: {
  items: CalendarItem[];
  uiLanguage: UiLanguage;
  onOpenItem: (item: CalendarItem) => void;
  onAddDay?: (isoDate: string) => void;
}) {
  const t = STRINGS[uiLanguage];
  const todayIso = localTodayIso();
  const [density, setDensity] = useState<Density>("month");
  const [anchor, setAnchor] = useState<string>(() => addMonths(localTodayIso(), 0));

  const weeks = useMemo(
    () =>
      density === "month" ? monthGrid(anchor, uiLanguage) : weeksGrid(anchor, uiLanguage, 4),
    [density, anchor, uiLanguage],
  );
  const spans = useMemo(
    () =>
      items
        .map((item) => itemSpan(item.id, item.startDate, item.dueDate))
        .filter((span): span is ItemSpan => span !== null),
    [items],
  );
  const itemById = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);
  const names = weekdayNames(uiLanguage);

  const step = (delta: number) =>
    setAnchor(density === "month" ? addMonths(anchor, delta) : addWeeks(anchor, delta));
  const goToday = () => setAnchor(density === "month" ? addMonths(todayIso, 0) : todayIso);
  const switchDensity = (next: Density) => {
    setDensity(next);
    // Month normalizes to its first day; weeks re-anchor to today when the
    // user is still on today's month (spec: current + next 3 weeks).
    if (next === "month") setAnchor(addMonths(anchor, 0));
    else setAnchor(anchor === addMonths(todayIso, 0) ? todayIso : anchor);
  };

  return (
    <div className="calendar-view" dir={uiLanguage === "ar" ? "rtl" : "ltr"}>
      <div className="cal-toolbar">
        <div className="cal-toolbar-start">
          <div className="cal-add-split">
            <button
              type="button"
              className="cal-add-main"
              onClick={onAddDay ? () => onAddDay(todayIso) : undefined}
            >
              <Icon icon={Plus} size={14} /> {t.calAddTask}
            </button>
            <button type="button" className="cal-add-caret" aria-label={t.calAddTaskMenuLabel}>
              <Icon icon={ChevronDown} size={14} />
            </button>
          </div>
          <button
            type="button"
            className="cal-nav-btn"
            aria-label={t.calPrevPeriod}
            onClick={() => step(-1)}
          >
            <Icon icon={ChevronLeft} size={14} directional />
          </button>
          <button type="button" className="cal-today-btn" onClick={goToday}>
            {t.timelineTodayLabel}
          </button>
          <button
            type="button"
            className="cal-nav-btn"
            aria-label={t.calNextPeriod}
            onClick={() => step(1)}
          >
            <Icon icon={ChevronRight} size={14} directional />
          </button>
          <span className="cal-title">{monthTitle(anchor, uiLanguage)}</span>
        </div>
        <div className="cal-toolbar-end">
          <div className="cal-density" role="group" aria-label={t.viewSwitcherLabel}>
            <button
              type="button"
              aria-pressed={density === "weeks"}
              onClick={() => switchDensity("weeks")}
            >
              <Icon icon={CalendarRange} size={14} /> {t.calWeeks}
            </button>
            <button
              type="button"
              aria-pressed={density === "month"}
              onClick={() => switchDensity("month")}
            >
              {t.calMonth}
            </button>
          </div>
          <button type="button" className="board-tool-btn">
            <Icon icon={ListFilter} size={14} /> {t.filterLabel}
          </button>
          <button type="button" className="board-tool-btn">
            <Icon icon={SlidersHorizontal} size={14} /> {t.calOptions}
          </button>
          <button type="button" className="board-tool-btn" aria-label={t.calSearchLabel}>
            <Icon icon={Search} size={14} />
          </button>
        </div>
      </div>
      <div className="cal-head" role="row">
        {names.map((name) => (
          <span key={name} className="cal-head-cell">
            {name}
          </span>
        ))}
      </div>
      <div
        className={density === "weeks" ? "cal-body cal-body-weeks" : "cal-body"}
        role="grid"
        aria-label={t.calGridLabel}
      >
        {weeks.map((week) => (
          <WeekRow
            key={week[0]?.iso}
            week={week}
            spans={spans}
            itemById={itemById}
            todayIso={todayIso}
            t={t}
            onOpenItem={onOpenItem}
            onAddDay={onAddDay}
          />
        ))}
      </div>
    </div>
  );
}
