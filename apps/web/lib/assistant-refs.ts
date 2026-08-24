import type { Program } from "@xcollab/core";

export type RefResolver = (key: string, args: Record<string, unknown>) => string | null;

/**
 * Maps proposal-card id args (programId / packageId / taskId) to display
 * names from the loaded program list; null when unresolved, in which case
 * the card falls back to showing the raw id.
 */
export function makeRefResolver(programs: readonly Program[]): RefResolver {
  return (key, args) => {
    const program = programs.find((p) => p.id === args["programId"]);
    if (key === "programId") return program?.name ?? null;
    if (!program) return null;
    if (key === "packageId") {
      return program.packages.find((pkg) => pkg.id === args["packageId"])?.name ?? null;
    }
    if (key === "taskId") {
      for (const pkg of program.packages) {
        const task = pkg.tasks.find((item) => item.id === args["taskId"]);
        if (task) return task.name;
      }
    }
    return null;
  };
}
