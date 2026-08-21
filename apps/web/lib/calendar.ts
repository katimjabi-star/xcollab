import type { UiLanguage } from "./i18n.ts";

/** Pure date math for the calendar view: UTC day ordinals only — no clock or
    timezone leaks into grid geometry. All ISO strings are YYYY-MM-DD. */

export const MS_PER_DAY = 86_400_000;

/** ISO date → UTC day ordinal (days since epoch). */
export function dayIndex(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y ?? 0, (m ?? 1) - 1, d ?? 1) / MS_PER_DAY;
}

/** UTC day ordinal → ISO date. */
export function isoFromIndex(index: number): string {
  return new Date(index * MS_PER_DAY).toISOString().slice(0, 10);
}

/** Today in the user's local timezone (the one place local time matters). */
export function localTodayIso(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

/** First column of the week grid (getUTCDay convention, 0 = Sunday).
    English weeks start Sunday (reference grid SUN..SAT); Arabic weeks start
    Saturday (السبت..الجمعة) — rendered right-to-left by the container. */
export function firstWeekday(language: UiLanguage): number {
  return language === "ar" ? 6 : 0;
}

/* 2023-01-01 was a Sunday — a stable anchor for weekday-name formatting. */
const SUNDAY_ANCHOR_IDX = Date.UTC(2023, 0, 1) / MS_PER_DAY;

/** Localized short weekday names in grid-column order (first weekday first). */
export function weekdayNames(language: UiLanguage): string[] {
  const first = firstWeekday(language);
  const format = new Intl.DateTimeFormat(language === "ar" ? "ar" : "en", {
    weekday: "short",
    timeZone: "UTC",
  });
  return Array.from({ length: 7 }, (_, i) =>
    format.format(new Date((SUNDAY_ANCHOR_IDX + ((first + i) % 7)) * MS_PER_DAY)),
  );
}

export interface DayCell {
  iso: string;
  dayOfMonth: number;
  /** False for the dimmed leading/trailing days of adjacent months. */
  inMonth: boolean;
}

function cellsFrom(startIdx: number, count: number, monthPrefix: string | null): DayCell[] {
  return Array.from({ length: count }, (_, i) => {
    const iso = isoFromIndex(startIdx + i);
    return {
      iso,
      dayOfMonth: Number(iso.slice(8, 10)),
      inMonth: monthPrefix === null || iso.startsWith(monthPrefix),
    };
  });
}

function chunkWeeks(cells: DayCell[]): DayCell[][] {
  const weeks: DayCell[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

/** Full month grid: complete week rows covering the anchor's month, aligned to
    the language's first weekday. Adjacent-month cells carry inMonth: false. */
export function monthGrid(anchorIso: string, language: UiLanguage): DayCell[][] {
  const year = Number(anchorIso.slice(0, 4));
  const month = Number(anchorIso.slice(5, 7));
  const monthStartIdx = Date.UTC(year, month - 1, 1) / MS_PER_DAY;
  const daysInMonth = Date.UTC(year, month, 1) / MS_PER_DAY - monthStartIdx;
  const lead = (new Date(monthStartIdx * MS_PER_DAY).getUTCDay() - firstWeekday(language) + 7) % 7;
  const total = Math.ceil((lead + daysInMonth) / 7) * 7;
  return chunkWeeks(cellsFrom(monthStartIdx - lead, total, anchorIso.slice(0, 7)));
}

/** Weeks density: the week containing anchor plus the following weeks
    (count total), aligned to the language's first weekday. No dimming. */
export function weeksGrid(anchorIso: string, language: UiLanguage, count = 4): DayCell[][] {
  const anchorIdx = dayIndex(anchorIso);
  const dow = new Date(anchorIdx * MS_PER_DAY).getUTCDay();
  const weekStart = anchorIdx - ((dow - firstWeekday(language) + 7) % 7);
  return chunkWeeks(cellsFrom(weekStart, count * 7, null));
}

/** First day of the month `delta` months away from the anchor's month. */
export function addMonths(anchorIso: string, delta: number): string {
  const year = Number(anchorIso.slice(0, 4));
  const month = Number(anchorIso.slice(5, 7));
  return isoFromIndex(Date.UTC(year, month - 1 + delta, 1) / MS_PER_DAY);
}

/** Week-stepped anchor for the weeks density (delta in weeks). */
export function addWeeks(anchorIso: string, delta: number): string {
  return isoFromIndex(dayIndex(anchorIso) + delta * 7);
}

/** Toolbar label: localized "August 2026". */
export function monthTitle(anchorIso: string, language: UiLanguage): string {
  return new Intl.DateTimeFormat(language === "ar" ? "ar" : "en", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(dayIndex(anchorIso) * MS_PER_DAY));
}

export interface ItemSpan {
  id: string;
  startIdx: number;
  /** Inclusive; always ≥ startIdx. */
  endIdx: number;
}

/** Dated span of an item: startDate→dueDate, a single-dated item spans its one
    date, an undated item renders nowhere. An inverted range clamps to 1 day. */
export function itemSpan(id: string, startDate?: string, dueDate?: string): ItemSpan | null {
  const anchor = startDate ?? dueDate;
  if (!anchor) return null;
  const startIdx = dayIndex(anchor);
  return { id, startIdx, endIdx: Math.max(dayIndex(dueDate ?? anchor), startIdx) };
}

export interface WeekSegment {
  id: string;
  /** 0-based columns in grid order (first weekday = 0); endCol inclusive. */
  startCol: number;
  endCol: number;
  /** Stacking row within the week (0 = topmost). */
  lane: number;
  /** True when the item extends into the previous/next week row. */
  continuesBefore: boolean;
  continuesAfter: boolean;
}

/** Clip spans to one week row and pack them into lanes (greedy first-fit over
    spans sorted by start, longer first — stable via id tiebreak). */
export function layoutWeek(weekStartIdx: number, spans: ItemSpan[]): WeekSegment[] {
  const weekEndIdx = weekStartIdx + 6;
  const clipped = spans
    .filter((s) => s.startIdx <= weekEndIdx && s.endIdx >= weekStartIdx)
    .map((s) => ({
      id: s.id,
      startCol: Math.max(s.startIdx, weekStartIdx) - weekStartIdx,
      endCol: Math.min(s.endIdx, weekEndIdx) - weekStartIdx,
      continuesBefore: s.startIdx < weekStartIdx,
      continuesAfter: s.endIdx > weekEndIdx,
    }))
    .sort((a, b) => a.startCol - b.startCol || b.endCol - a.endCol || a.id.localeCompare(b.id));
  const laneEnds: number[] = [];
  return clipped.map((seg) => {
    let lane = laneEnds.findIndex((end) => end < seg.startCol);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(seg.endCol);
    } else {
      laneEnds[lane] = seg.endCol;
    }
    return { ...seg, lane };
  });
}
