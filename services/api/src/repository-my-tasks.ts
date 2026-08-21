import type { Task } from "@xcollab/core";
import type { WorkGraphRepository } from "./repository.ts";

/** A task annotated with its owning program/package for cross-program lists. */
export type AssignedTask = Task & {
  programId: string;
  programName: string;
  packageId: string;
  packageName: string;
};

/**
 * Aggregates every task in the workspace whose assignee equals `username`,
 * annotated with program/package identity. Pure read over the programs the
 * repository already validates (ProgramSchema.parse) — no ledger write.
 * Order is stable: program created_at, then package order, then task order.
 */
export async function listAssignedTasks(
  repo: WorkGraphRepository,
  workspaceId: string,
  username: string,
): Promise<AssignedTask[]> {
  const programs = await repo.listPrograms(workspaceId);
  const assigned: AssignedTask[] = [];
  for (const program of programs) {
    for (const pkg of program.packages) {
      for (const task of pkg.tasks) {
        if (task.assignee !== username) continue;
        assigned.push({
          ...task,
          programId: program.id,
          programName: program.name,
          packageId: pkg.id,
          packageName: pkg.name,
        });
      }
    }
  }
  return assigned;
}
