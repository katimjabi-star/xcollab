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
