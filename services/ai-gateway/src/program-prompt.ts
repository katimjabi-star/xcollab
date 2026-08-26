import type { ProgramBrief } from "@xcollab/synthesizer";

/**
 * Shared program-synthesis prompt. Lives outside every adapter so the
 * Sovereign build can bundle OllamaAdapter without pulling the Connected
 * (hosted) adapter modules in transitively (Charter invariant 3).
 */
export function buildProgramPrompt(brief: ProgramBrief): string {
  return [
    "Design a complete program plan as a single JSON object, no prose.",
    "Required shape: { id, name, mission, language, timeline: {start, end},",
    "teams: [{id, name, kind: 'internal'|'vendor'}],",
    "packages: [{id, name, scope, tasks: [{id, name, status: 'todo', estimateDays}], dependsOn: [packageId]}],",
    "milestones: [{id, name, dueDate}], risks: [{id, title, severity: 'low'|'medium'|'high'|'critical'}] }.",
    "Rules: dependsOn must reference existing package ids and MUST be acyclic;",
    "dates are YYYY-MM-DD inside the timeline; every text field in the brief's language.",
    `Language: ${brief.language}.`,
    brief.timeline ? `Timeline: ${brief.timeline.start} to ${brief.timeline.end}.` : "",
    brief.teamHints?.length ? `Required teams: ${brief.teamHints.join(", ")}.` : "",
    `Mission brief: ${brief.mission}`,
  ]
    .filter(Boolean)
    .join("\n");
}
