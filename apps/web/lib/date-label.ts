import { STRINGS, type UiLanguage } from "./i18n.ts";

/** Visual tone of a due date. Judged by the due date (range end):
    overdue = past + incomplete (red), soon = today/tomorrow + incomplete
    (green), muted = completed, neutral = everything else. */
export type DueTone = "overdue" | "soon" | "neutral" | "muted";

function utcOf(iso: string): number {
  return Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));
}

/** Whole-day difference `iso - todayIso` (calendar dates, DST-safe via UTC). */
export function dayDiff(iso: string, todayIso: string): number {
  return Math.round((utcOf(iso) - utcOf(todayIso)) / 86_400_000);
}

const locales: Record<UiLanguage, string> = { en: "en-US", ar: "ar" };

function fmt(iso: string, language: UiLanguage, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat(locales[language], options).format(new Date(`${iso}T00:00:00`));
}

/** True when the reference model renders this date as a relative word or
    weekday instead of an absolute month-day. */
function isRelative(diff: number): boolean {
  return diff >= -1 && diff <= 6;
}

/** Reference-model single-date label: Today / Tomorrow / Yesterday, weekday
    inside the next 6 days, "Aug 21" in the current year, "Aug 21, 2025"
    otherwise. Localized for both UI languages. */
export function dateLabel(iso: string, language: UiLanguage, todayIso: string): string {
  const t = STRINGS[language];
  const diff = dayDiff(iso, todayIso);
  if (diff === 0) return t.timelineTodayLabel;
  if (diff === 1) return t.dateTomorrow;
  if (diff === -1) return t.dateYesterday;
  if (isRelative(diff)) return fmt(iso, language, { weekday: "long" });
  const sameYear = iso.slice(0, 4) === todayIso.slice(0, 4);
  return fmt(
    iso,
    language,
    sameYear ? { month: "short", day: "numeric" } : { month: "short", day: "numeric", year: "numeric" },
  );
}

/** Range/date text for a task row or card, en-dash separated. Two absolute
    endpoints in the same month and year collapse the end to its day number
    ("Aug 21 – 25"); relative endpoints keep their words ("Today – Aug 24").
    Null when the task has no due date. */
export function dueRangeLabel(
  task: { startDate?: string; dueDate?: string },
  language: UiLanguage,
  todayIso: string,
): string | null {
  if (!task.dueDate) return null;
  const due = task.dueDate;
  if (!task.startDate || task.startDate === due) return dateLabel(due, language, todayIso);
  const start = task.startDate;
  const bothAbsolute =
    !isRelative(dayDiff(start, todayIso)) && !isRelative(dayDiff(due, todayIso));
  const sameMonth = start.slice(0, 7) === due.slice(0, 7);
  const sameYearAsToday = start.slice(0, 4) === todayIso.slice(0, 4);
  if (bothAbsolute && sameMonth && sameYearAsToday) {
    return `${dateLabel(start, language, todayIso)} – ${fmt(due, language, { day: "numeric" })}`;
  }
  return `${dateLabel(start, language, todayIso)} – ${dateLabel(due, language, todayIso)}`;
}

/** Tone for the date text; completed tasks are always muted, never red. */
export function dueTone(
  dueDate: string | undefined,
  done: boolean,
  todayIso: string,
): DueTone {
  if (done) return "muted";
  if (!dueDate) return "neutral";
  const diff = dayDiff(dueDate, todayIso);
  if (diff < 0) return "overdue";
  if (diff <= 1) return "soon";
  return "neutral";
}

/** Days a due date is past, for "Overdue by N days"; 0 when not overdue. */
export function overdueDays(dueDate: string, todayIso: string): number {
  return Math.max(0, -dayDiff(dueDate, todayIso));
}
