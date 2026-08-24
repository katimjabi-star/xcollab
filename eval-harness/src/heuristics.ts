import { findDependencyCycle, ProgramSchema, type Task } from "@xcollab/core";
import type { ProgramBrief } from "@xcollab/synthesizer";

export interface HeuristicReport {
  pass: boolean;
  failures: string[];
}

const ARABIC_PATTERN = /[؀-ۿ]/;

/** Every generated task must be scheduled: dated, ordered, inside the
    program timeline (Timeline/Calendar views are empty otherwise). */
function checkTaskDates(
  program: { timeline: { start: string; end: string }; packages: { tasks: Task[] }[] },
  failures: string[],
): void {
  for (const task of program.packages.flatMap((pkg) => pkg.tasks)) {
    if (!task.startDate || !task.dueDate) {
      failures.push(`task "${task.id}" is missing startDate/dueDate`);
      continue;
    }
    if (task.dueDate < task.startDate) {
      failures.push(`task "${task.id}" is due before it starts`);
    }
    if (task.startDate < program.timeline.start || task.dueDate > program.timeline.end) {
      failures.push(`task "${task.id}" falls outside the timeline`);
    }
  }
}

/**
 * Fast, model-free checks — the PR-gate layer of eval-driven development.
 * Judge-based scoring is the nightly layer and lives elsewhere.
 */
export function runHeuristics(brief: ProgramBrief, candidate: unknown): HeuristicReport {
  const failures: string[] = [];

  const parsed = ProgramSchema.safeParse(candidate);
  if (!parsed.success) {
    return { pass: false, failures: [`schema: ${parsed.error.message}`] };
  }
  const program = parsed.data;

  if (findDependencyCycle(program.packages)) failures.push("dependency graph has a cycle");
  if (program.language !== brief.language) failures.push("language does not match brief");
  checkTaskDates(program, failures);

  if (brief.timeline) {
    if (program.timeline.start !== brief.timeline.start || program.timeline.end !== brief.timeline.end) {
      failures.push("timeline does not honor the brief");
    }
    for (const m of program.milestones) {
      if (m.dueDate < brief.timeline.start || m.dueDate > brief.timeline.end) {
        failures.push(`milestone "${m.id}" falls outside the timeline`);
      }
    }
  }

  if (brief.language === "ar") {
    const fields = [program.name, ...program.packages.map((p) => p.name)];
    if (!fields.every((f) => ARABIC_PATTERN.test(f))) {
      failures.push("Arabic brief produced non-Arabic names");
    }
  }

  for (const hint of brief.teamHints ?? []) {
    const needle = hint.trim().toLowerCase();
    if (!program.teams.some((t) => t.name.toLowerCase().includes(needle))) {
      failures.push(`hinted team "${hint}" missing`);
    }
  }

  return { pass: failures.length === 0, failures };
}
