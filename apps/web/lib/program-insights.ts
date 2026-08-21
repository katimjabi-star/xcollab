import type { Program, Task } from "@xcollab/core";
import { isOverdue } from "./board-filter.ts";

export type Severity = Program["risks"][number]["severity"];

/** Milestone timing bucket — "past" strictly before today, "done-window"
    inside the today..today+7 due window, "upcoming" beyond it. */
export type MilestoneState = "past" | "upcoming" | "done-window";

export interface PackageProgress {
  id: string;
  name: string;
  done: number;
  total: number;
  pct: number;
}

export interface AssigneeLoad {
  /** Keycloak username; null is the "unassigned" bucket (always listed last). */
  assignee: string | null;
  open: number;
  done: number;
}

export interface MilestoneHealth {
  id: string;
  name: string;
  dueDate: string;
  state: MilestoneState;
}

export interface ProgramInsights {
  /** Rounded done/total percent across all packages. */
  completionPct: number;
  perPackage: PackageProgress[];
  statusCounts: Record<Task["status"], number>;
  /** Non-done tasks dated strictly before today, earliest due first. */
  overdueTasks: Task[];
  /** Non-done tasks due today..today+7 inclusive, earliest due first. */
  dueThisWeek: Task[];
  assigneeLoad: AssigneeLoad[];
  milestoneHealth: MilestoneHealth[];
  riskCounts: Record<Severity, number>;
}

/** ISO date (YYYY-MM-DD) + n days, computed in UTC so it is clock/TZ-free. */
function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const shifted = new Date(Date.UTC(y ?? 0, (m ?? 1) - 1, (d ?? 0) + days));
  return shifted.toISOString().slice(0, 10);
}

function pct(done: number, total: number): number {
  return total === 0 ? 0 : Math.round((done / total) * 100);
}

/** Ascending by dueDate (all inputs are dated); stable within ties. */
function byDueDate(a: Task, b: Task): number {
  const da = a.dueDate ?? "";
  const db = b.dueDate ?? "";
  return da < db ? -1 : da > db ? 1 : 0;
}

function loadOrder(a: AssigneeLoad, b: AssigneeLoad): number {
  // Unassigned bucket always trails; people sort open desc, done desc, name asc.
  if (a.assignee === null) return 1;
  if (b.assignee === null) return -1;
  if (a.open !== b.open) return b.open - a.open;
  if (a.done !== b.done) return b.done - a.done;
  return a.assignee.localeCompare(b.assignee);
}

function milestoneState(dueDate: string, today: string, weekEnd: string): MilestoneState {
  if (dueDate < today) return "past";
  return dueDate <= weekEnd ? "done-window" : "upcoming";
}

/** Pure, clock-free program analytics — `today` is injected as an ISO date
    (YYYY-MM-DD) so results are deterministic and testable. */
export function computeInsights(program: Program, today: string): ProgramInsights {
  const weekEnd = addDays(today, 7);
  const statusCounts: Record<Task["status"], number> = {
    todo: 0,
    in_progress: 0,
    blocked: 0,
    done: 0,
  };
  const riskCounts: Record<Severity, number> = { low: 0, medium: 0, high: 0, critical: 0 };
  const perPackage: PackageProgress[] = [];
  const overdueTasks: Task[] = [];
  const dueThisWeek: Task[] = [];
  const loads = new Map<string | null, AssigneeLoad>();

  for (const pkg of program.packages) {
    let done = 0;
    for (const task of pkg.tasks) {
      statusCounts[task.status] += 1;
      const isDone = task.status === "done";
      if (isDone) done += 1;
      if (!isDone && isOverdue(task, today)) overdueTasks.push(task);
      if (!isDone && task.dueDate !== undefined && task.dueDate >= today && task.dueDate <= weekEnd) {
        dueThisWeek.push(task);
      }
      const key = task.assignee ?? null;
      const load = loads.get(key) ?? { assignee: key, open: 0, done: 0 };
      if (isDone) load.done += 1;
      else load.open += 1;
      loads.set(key, load);
    }
    perPackage.push({
      id: pkg.id,
      name: pkg.name,
      done,
      total: pkg.tasks.length,
      pct: pct(done, pkg.tasks.length),
    });
  }

  for (const risk of program.risks) riskCounts[risk.severity] += 1;

  const total = perPackage.reduce((sum, p) => sum + p.total, 0);
  const doneTotal = statusCounts.done;

  return {
    completionPct: pct(doneTotal, total),
    perPackage,
    statusCounts,
    overdueTasks: overdueTasks.sort(byDueDate),
    dueThisWeek: dueThisWeek.sort(byDueDate),
    assigneeLoad: [...loads.values()].sort(loadOrder),
    milestoneHealth: program.milestones.map((ms) => ({
      id: ms.id,
      name: ms.name,
      dueDate: ms.dueDate,
      state: milestoneState(ms.dueDate, today, weekEnd),
    })),
    riskCounts,
  };
}

/* ------------------------------------------------------------------ */
/* Dashboard widget calculators (2026-08 widget sprint) — pure, clock- */
/* free: `today` is always injected as an ISO date (YYYY-MM-DD).       */
/* ------------------------------------------------------------------ */

export interface DashboardStats {
  completed: number;
  incomplete: number;
  overdue: number;
  total: number;
}

/** Stat-card counters: completed = done; incomplete = everything else;
    overdue = open tasks dated strictly before today. */
export function dashboardStats(program: Program, today: string): DashboardStats {
  let completed = 0;
  let overdue = 0;
  let total = 0;
  for (const pkg of program.packages) {
    for (const task of pkg.tasks) {
      total += 1;
      if (task.status === "done") completed += 1;
      else if (isOverdue(task, today)) overdue += 1;
    }
  }
  return { completed, incomplete: total - completed, overdue, total };
}

export interface DonutSegment {
  status: Task["status"];
  count: number;
  /** count / total, 0..1 — the arc sweep for stroke-dasharray rendering. */
  fraction: number;
}

export interface DonutData {
  total: number;
  /** Fixed paint order done → in_progress → todo → blocked; zero-count
      statuses are omitted so no zero-length arcs render. */
  segments: DonutSegment[];
}

const DONUT_ORDER: Task["status"][] = ["done", "in_progress", "todo", "blocked"];

export function donutSegments(counts: Record<Task["status"], number>): DonutData {
  const total = DONUT_ORDER.reduce((sum, status) => sum + counts[status], 0);
  const segments = DONUT_ORDER.filter((status) => counts[status] > 0).map((status) => ({
    status,
    count: counts[status],
    fraction: counts[status] / total,
  }));
  return { total, segments };
}

/** Named-count bar datum ("tasks by section" / "tasks by project"). */
export interface BarDatum {
  id: string;
  name: string;
  count: number;
}

export function sectionCounts(program: Program): BarDatum[] {
  return program.packages.map((pkg) => ({ id: pkg.id, name: pkg.name, count: pkg.tasks.length }));
}

/** Minimal ledger-entry shape the completion series reads — matches
    @xcollab/core LedgerEntry structurally without importing it. */
export interface CompletionEvent {
  action: string;
  input: string;
  occurredAt: string;
}

export interface DailyCount {
  /** ISO date (YYYY-MM-DD, UTC day of occurredAt). */
  date: string;
  count: number;
}

/** True when the entry records a task of `programId` moving to "done" —
    either a status-only move or a wider task.update whose changes include
    status → done. Malformed input JSON never throws (ledger is untrusted). */
function isCompletionEvent(entry: CompletionEvent, programId: string): boolean {
  if (entry.action !== "task.status_update" && entry.action !== "task.update") return false;
  try {
    const input = JSON.parse(entry.input) as {
      programId?: string;
      to?: string;
      changes?: { status?: { to?: string } };
    };
    if (input.programId !== programId) return false;
    if (entry.action === "task.status_update") return input.to === "done";
    return input.changes?.status?.to === "done";
  } catch {
    return false;
  }
}

/** Daily done-transition counts for the trailing `days` window ending at
    `today` (inclusive), zero-filled so every day charts a point. */
export function completionSeries(
  entries: CompletionEvent[],
  programId: string,
  today: string,
  days = 11,
): DailyCount[] {
  const perDay = new Map<string, number>();
  for (let i = days - 1; i >= 0; i -= 1) perDay.set(addDays(today, -i), 0);
  for (const entry of entries) {
    if (!isCompletionEvent(entry, programId)) continue;
    const day = entry.occurredAt.slice(0, 10);
    const current = perDay.get(day);
    if (current !== undefined) perDay.set(day, current + 1);
  }
  return [...perDay.entries()].map(([date, count]) => ({ date, count }));
}
