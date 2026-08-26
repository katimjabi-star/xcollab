import { describe, expect, it } from "vitest";
import { synthesizeProgram, type ProgramBrief } from "@xcollab/synthesizer";
import { runHeuristics } from "../src/heuristics.ts";

/* Negative controls for the PR gate: every heuristic must be shown to FAIL on
   the defect it exists to catch. Without these, a broken (always-green) gate
   is indistinguishable from a healthy one. */

const brief: ProgramBrief = {
  mission: "Build a secure collaboration platform for sovereign environments",
  language: "en",
  timeline: { start: "2026-09-01", end: "2026-12-01" },
  teamHints: ["Design"],
};

const baseline = () => synthesizeProgram(brief);

function firstTask(program: ReturnType<typeof baseline>) {
  const task = program.packages[0]?.tasks[0];
  if (!task) throw new Error("baseline program has no tasks");
  return task;
}

describe("fast-eval heuristics — negative controls", () => {
  it("baseline sanity: the unmutated program passes", () => {
    expect(runHeuristics(brief, baseline()).pass).toBe(true);
  });

  it("fails schema-invalid output", () => {
    const report = runHeuristics(brief, { not: "a program" });
    expect(report.pass).toBe(false);
    expect(report.failures[0]).toContain("schema");
  });

  it("fails a dependency cycle", () => {
    const program = baseline();
    const [a, b] = program.packages;
    if (!a || !b) throw new Error("baseline has fewer than two packages");
    a.dependsOn = [b.id];
    b.dependsOn = [a.id];
    const report = runHeuristics(brief, program);
    expect(report.pass).toBe(false);
    expect(report.failures).toContain("dependency graph has a cycle");
  });

  it("fails a language mismatch", () => {
    const report = runHeuristics({ ...brief, language: "ar" }, baseline());
    expect(report.pass).toBe(false);
    expect(report.failures).toContain("language does not match brief");
  });

  it("fails an undated task", () => {
    const program = baseline();
    delete firstTask(program).startDate;
    delete firstTask(program).dueDate;
    const report = runHeuristics(brief, program);
    expect(report.pass).toBe(false);
    expect(report.failures.some((f) => f.includes("missing startDate/dueDate"))).toBe(true);
  });

  it("fails a task outside the timeline", () => {
    const program = baseline();
    firstTask(program).startDate = "2027-01-01";
    firstTask(program).dueDate = "2027-01-02";
    const report = runHeuristics(brief, program);
    expect(report.pass).toBe(false);
    expect(report.failures.some((f) => f.includes("outside the timeline"))).toBe(true);
  });

  it("fails a timeline that does not honor the brief", () => {
    const program = baseline();
    program.timeline = { start: "2026-10-01", end: "2026-12-01" };
    const report = runHeuristics(brief, program);
    expect(report.pass).toBe(false);
    expect(report.failures).toContain("timeline does not honor the brief");
  });

  it("fails a milestone outside the timeline", () => {
    const program = baseline();
    const milestone = program.milestones[0];
    if (!milestone) throw new Error("baseline has no milestones");
    milestone.dueDate = "2027-06-01";
    const report = runHeuristics(brief, program);
    expect(report.pass).toBe(false);
    expect(report.failures.some((f) => f.includes("falls outside the timeline"))).toBe(true);
  });

  it("fails an Arabic brief answered with non-Arabic names", () => {
    const arabicBrief: ProgramBrief = { ...brief, language: "ar", teamHints: [] };
    const program = synthesizeProgram(arabicBrief);
    program.name = "English name";
    const report = runHeuristics(arabicBrief, program);
    expect(report.pass).toBe(false);
    expect(report.failures).toContain("Arabic brief produced non-Arabic names");
  });

  it("fails a missing hinted team", () => {
    const program = baseline();
    program.teams = program.teams.filter((team) => team.name !== "Design");
    const report = runHeuristics(brief, program);
    expect(report.pass).toBe(false);
    expect(report.failures).toContain('hinted team "Design" missing');
  });
});
