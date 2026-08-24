import type { Task } from "@xcollab/core";
import type { WorkGraphRepository } from "./repository.ts";

/** A task annotated with its owning program/package (AssignedTask, generalized). */
export type WorkspaceTask = Task & {
  programId: string;
  programName: string;
  packageId: string;
  packageName: string;
};

export interface TaskSearchFilters {
  programId?: string;
  status?: Task["status"];
  /** Exact username — the "me" alias is resolved by the route, not here. */
  assignee?: string;
  /** dueDate strictly before `today` AND status is not done. */
  overdue?: boolean;
  dueBefore?: string;
  dueAfter?: string;
  /** Case-insensitive substring over name + description. */
  text?: string;
  limit: number;
}

function matchesDates(task: Task, filters: TaskSearchFilters, today: string): boolean {
  if (filters.overdue === true) {
    if (!task.dueDate || task.dueDate >= today || task.status === "done") return false;
  }
  if (filters.overdue === false && task.dueDate && task.dueDate < today && task.status !== "done") {
    return false;
  }
  if (filters.dueBefore && (!task.dueDate || task.dueDate >= filters.dueBefore)) return false;
  if (filters.dueAfter && (!task.dueDate || task.dueDate <= filters.dueAfter)) return false;
  return true;
}

function matchesTask(task: Task, filters: TaskSearchFilters, today: string): boolean {
  if (filters.status && task.status !== filters.status) return false;
  if (filters.assignee && task.assignee !== filters.assignee) return false;
  if (!matchesDates(task, filters, today)) return false;
  if (filters.text) {
    const needle = filters.text.toLowerCase();
    const haystack = `${task.name}\n${task.description ?? ""}`.toLowerCase();
    if (!haystack.includes(needle)) return false;
  }
  return true;
}

/**
 * Workspace-wide task search over the repository's validated programs — the
 * listAssignedTasks pattern generalized to arbitrary filters. Pure read, no
 * ledger write. `today` (ISO date) is injected by the route so repositories
 * stay clock-free. Order is stable: program created_at, package order, task
 * order; results are capped at filters.limit.
 */
export async function searchWorkspaceTasks(
  repo: WorkGraphRepository,
  workspaceId: string,
  filters: TaskSearchFilters,
  today: string,
): Promise<WorkspaceTask[]> {
  const programs = await repo.listPrograms(workspaceId);
  const matches: WorkspaceTask[] = [];
  for (const program of programs) {
    if (filters.programId && program.id !== filters.programId) continue;
    for (const pkg of program.packages) {
      for (const task of pkg.tasks) {
        if (!matchesTask(task, filters, today)) continue;
        matches.push({
          ...task,
          programId: program.id,
          programName: program.name,
          packageId: pkg.id,
          packageName: pkg.name,
        });
        if (matches.length >= filters.limit) return matches;
      }
    }
  }
  return matches;
}
