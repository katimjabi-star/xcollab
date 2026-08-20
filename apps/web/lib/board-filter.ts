import type { Task } from "@xcollab/core";

/** A task flattened onto the board with its owning package's identity. */
export interface BoardCard {
  task: Task;
  packageId: string;
  packageName: string;
}

export type DueFilter = "overdue" | "thisWeek" | "noDate";

export interface BoardFilter {
  /** Case-insensitive substring match against the task name. */
  query: string;
  packageId: string | null;
  role: string | null;
  /** Exact username match against task.assignee (case-sensitive). */
  assignee: string | null;
  due: DueFilter | null;
}

export type BoardSort = "default" | "dueDate" | "name" | "estimate";

export const EMPTY_FILTER: BoardFilter = {
  query: "",
  packageId: null,
  role: null,
  assignee: null,
  due: null,
};

const DUE_VALUES: readonly DueFilter[] = ["overdue", "thisWeek", "noDate"];
const SORT_VALUES: readonly BoardSort[] = ["default", "dueDate", "name", "estimate"];

/** ISO date (YYYY-MM-DD) + n days, computed in UTC so it is clock/TZ-free. */
function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const shifted = new Date(Date.UTC(y ?? 0, (m ?? 1) - 1, (d ?? 0) + days));
  return shifted.toISOString().slice(0, 10);
}

/** True when the task is dated strictly before `today` (due today is not overdue). */
export function isOverdue(task: Task, today: string): boolean {
  return task.dueDate !== undefined && task.dueDate < today;
}

function matchesDue(task: Task, due: DueFilter, today: string): boolean {
  switch (due) {
    case "overdue":
      return isOverdue(task, today);
    case "thisWeek":
      // Due between today and today+7, inclusive. ISO dates compare lexically.
      return (
        task.dueDate !== undefined && task.dueDate >= today && task.dueDate <= addDays(today, 7)
      );
    case "noDate":
      return task.dueDate === undefined;
  }
}

export function anyFilterActive(filter: BoardFilter): boolean {
  return (
    filter.query.trim() !== "" ||
    filter.packageId !== null ||
    filter.role !== null ||
    filter.assignee !== null ||
    filter.due !== null
  );
}

/** Pure AND-combination of all active filter dimensions. `today` is injected
    as an ISO date so the function stays clock-free and testable. */
export function filterTasks(cards: BoardCard[], filter: BoardFilter, today: string): BoardCard[] {
  const query = filter.query.trim().toLowerCase();
  return cards.filter(({ task, packageId }) => {
    if (query && !task.name.toLowerCase().includes(query)) return false;
    if (filter.packageId !== null && packageId !== filter.packageId) return false;
    if (filter.role !== null && task.assigneeRole !== filter.role) return false;
    if (filter.assignee !== null && task.assignee !== filter.assignee) return false;
    if (filter.due !== null && !matchesDue(task, filter.due, today)) return false;
    return true;
  });
}

/** Stable, non-mutating sort. "dueDate" is ascending — overdue (earliest)
    dates naturally lead — with undated cards last. */
export function sortTasks(cards: BoardCard[], sort: BoardSort): BoardCard[] {
  const copy = [...cards];
  switch (sort) {
    case "default":
      return copy;
    case "dueDate":
      return copy.sort((a, b) => {
        const da = a.task.dueDate;
        const db = b.task.dueDate;
        if (da === undefined && db === undefined) return 0;
        if (da === undefined) return 1;
        if (db === undefined) return -1;
        return da < db ? -1 : da > db ? 1 : 0;
      });
    case "name":
      return copy.sort((a, b) => a.task.name.localeCompare(b.task.name));
    case "estimate":
      return copy.sort((a, b) => a.task.estimateDays - b.task.estimateDays);
  }
}

/** Read filter + sort out of URL search params, dropping unknown tokens. */
export function parseBoardQuery(params: Pick<URLSearchParams, "get">): {
  filter: BoardFilter;
  sort: BoardSort;
} {
  const due = params.get("due");
  const sort = params.get("sort");
  return {
    filter: {
      query: params.get("q") ?? "",
      packageId: params.get("pkg"),
      role: params.get("role"),
      assignee: params.get("assignee"),
      due: DUE_VALUES.find((v) => v === due) ?? null,
    },
    sort: SORT_VALUES.find((v) => v === sort) ?? "default",
  };
}

/** Serialize filter + sort into URL search params, omitting defaults so the
    pristine board keeps a clean URL. */
export function serializeBoardQuery(filter: BoardFilter, sort: BoardSort): URLSearchParams {
  const params = new URLSearchParams();
  if (filter.query.trim()) params.set("q", filter.query.trim());
  if (filter.packageId !== null) params.set("pkg", filter.packageId);
  if (filter.role !== null) params.set("role", filter.role);
  if (filter.assignee !== null) params.set("assignee", filter.assignee);
  if (filter.due !== null) params.set("due", filter.due);
  if (sort !== "default") params.set("sort", sort);
  return params;
}
