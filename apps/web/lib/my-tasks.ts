import type { UiLanguage } from "./i18n.ts";
import { formatIsoDate } from "./program-format.ts";

/** Derived My Tasks buckets (v1, no persistence):
    recentlyAssigned = no dueDate; doToday = dueDate ≤ today (incl. overdue);
    doNextWeek = today < dueDate ≤ today+7; doLater = dueDate > today+7. */

export type BucketId = "recentlyAssigned" | "doToday" | "doNextWeek" | "doLater";

/** Render order for sections/columns. */
export const BUCKET_ORDER: readonly BucketId[] = [
  "recentlyAssigned",
  "doToday",
  "doNextWeek",
  "doLater",
];

/** Local calendar date as ISO "YYYY-MM-DD" (not UTC — buckets follow the wall clock). */
export function localTodayIso(now: Date = new Date()): string {
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

/** ISO date + n days → ISO date (local, DST-safe via Date arithmetic). */
export function addDaysIso(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00`);
  date.setDate(date.getDate() + days);
  return localTodayIso(date);
}

/** Pure bucket rule. ISO dates compare lexicographically, so no Date parsing. */
export function bucketOf(dueDate: string | undefined, todayIso: string): BucketId {
  if (!dueDate) return "recentlyAssigned";
  if (dueDate <= todayIso) return "doToday";
  if (dueDate <= addDaysIso(todayIso, 7)) return "doNextWeek";
  return "doLater";
}

/** Partitions tasks into the four buckets, preserving input order.
    Every bucket key is present (empty sections still render). */
export function bucketTasks<T extends { dueDate?: string }>(
  tasks: readonly T[],
  todayIso: string,
): Record<BucketId, T[]> {
  const buckets: Record<BucketId, T[]> = {
    recentlyAssigned: [],
    doToday: [],
    doNextWeek: [],
    doLater: [],
  };
  for (const task of tasks) buckets[bucketOf(task.dueDate, todayIso)].push(task);
  return buckets;
}

/** Overdue = strictly before today (a task due today is not overdue). */
export function isDueOverdue(dueDate: string | undefined, todayIso: string): boolean {
  return dueDate !== undefined && dueDate < todayIso;
}

/** Row/card date text: "Aug 21, 2026", "Today – Aug 24, 2026" when startDate
    is set, `todayLabel` substituted for today's date. Null when undated. */
export function formatDueRange(
  task: { startDate?: string; dueDate?: string },
  todayIso: string,
  language: UiLanguage,
  todayLabel: string,
): string | null {
  if (!task.dueDate) return null;
  const fmt = (iso: string): string =>
    iso === todayIso ? todayLabel : formatIsoDate(iso, language);
  if (task.startDate && task.startDate !== task.dueDate) {
    return `${fmt(task.startDate)} – ${fmt(task.dueDate)}`;
  }
  return fmt(task.dueDate);
}
