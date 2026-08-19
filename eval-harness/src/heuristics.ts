import { findDependencyCycle, ProgramSchema } from "@xcollab/core";
import type { ProgramBrief } from "@xcollab/synthesizer";

export interface HeuristicReport {
  pass: boolean;
  failures: string[];
}

const ARABIC_PATTERN = /[؀-ۿ]/;

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
