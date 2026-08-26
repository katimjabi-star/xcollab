import { describe, expect, it } from "vitest";
import { findDependencyCycle, ProgramSchema } from "@xcollab/core";
import { synthesizeProgram, type ProgramBrief } from "../src/index.ts";

const timeline = { start: "2026-09-01", end: "2026-11-30" };
const brief: ProgramBrief = {
  mission: "Build a cross-team collaboration platform for secure environments",
  language: "en",
  timeline,
  teamHints: ["design", "qa"],
};

describe("synthesizeProgram", () => {
  it("produces a program that passes the canonical schema", () => {
    expect(() => ProgramSchema.parse(synthesizeProgram(brief))).not.toThrow();
  });

  it("produces an acyclic dependency graph — always", () => {
    for (const mission of ["tiny", brief.mission, "x".repeat(2000)]) {
      const program = synthesizeProgram({ ...brief, mission });
      expect(findDependencyCycle(program.packages)).toBeNull();
    }
  });

  it("honors the requested timeline", () => {
    const program = synthesizeProgram(brief);
    expect(program.timeline).toEqual(timeline);
    for (const milestone of program.milestones) {
      expect(milestone.dueDate >= timeline.start).toBe(true);
      expect(milestone.dueDate <= timeline.end).toBe(true);
    }
  });

  it("includes every hinted team", () => {
    const names = synthesizeProgram(brief).teams.map((t) => t.name.toLowerCase());
    expect(names.some((n) => n.includes("design"))).toBe(true);
    expect(names.some((n) => n.includes("qa"))).toBe(true);
  });

  it("generates Arabic content for Arabic briefs", () => {
    const arabic = synthesizeProgram({
      ...brief,
      language: "ar",
      mission: "بناء منصة تعاون آمنة للبيئات السيادية",
    });
    const arabicPattern = /[؀-ۿ]/;
    expect(arabicPattern.test(arabic.name)).toBe(true);
    expect(arabic.packages.every((p) => arabicPattern.test(p.name))).toBe(true);
  });

  it("is deterministic for identical briefs", () => {
    expect(synthesizeProgram(brief)).toEqual(synthesizeProgram(brief));
  });

  it("dates every task inside the timeline, sections in sequence", () => {
    const program = synthesizeProgram(brief);
    let previousStart = timeline.start;
    for (const pkg of program.packages) {
      for (const task of pkg.tasks) {
        expect(task.startDate, `${task.id} startDate`).toBeDefined();
        expect(task.dueDate, `${task.id} dueDate`).toBeDefined();
        const startDate = task.startDate ?? "";
        const dueDate = task.dueDate ?? "";
        expect(dueDate >= startDate, `${task.id} due >= start`).toBe(true);
        expect(startDate >= timeline.start, `${task.id} inside start`).toBe(true);
        expect(dueDate <= timeline.end, `${task.id} inside end`).toBe(true);
        // Sections run in sequence; tasks within a section are staggered.
        expect(startDate >= previousStart, `${task.id} staggered`).toBe(true);
        previousStart = startDate;
      }
    }
  });

  it("keeps task dates inside even a degenerate 2-day timeline", () => {
    const tiny = { start: "2026-09-01", end: "2026-09-02" };
    const program = synthesizeProgram({ ...brief, timeline: tiny });
    for (const task of program.packages.flatMap((pkg) => pkg.tasks)) {
      expect((task.startDate ?? "") >= tiny.start).toBe(true);
      expect((task.dueDate ?? "") <= tiny.end).toBe(true);
      expect((task.dueDate ?? "") >= (task.startDate ?? "")).toBe(true);
    }
  });

  it("dates every task inside the defaulted timeline too", () => {
    const program = synthesizeProgram({ mission: brief.mission, language: "en" });
    for (const task of program.packages.flatMap((pkg) => pkg.tasks)) {
      expect((task.startDate ?? "") >= program.timeline.start).toBe(true);
      expect((task.dueDate ?? "") <= program.timeline.end).toBe(true);
    }
  });

  it("defaults the timeline when none is given", () => {
    const program = synthesizeProgram({ mission: brief.mission, language: "en" });
    expect(() => ProgramSchema.parse(program)).not.toThrow();
  });

  it("drops whitespace-only team hints instead of emitting a schema-invalid team", () => {
    const program = synthesizeProgram({
      ...brief,
      teamHints: ["  ", "Design", "\t", "  QA  "],
    });
    expect(() => ProgramSchema.parse(program)).not.toThrow();
    const hinted = program.teams.slice(1).map((team) => team.name);
    expect(hinted).toEqual(["Design", "QA"]);
  });

  it("degrades a malformed or inverted timeline to the default window instead of throwing", () => {
    const malformed = synthesizeProgram({
      ...brief,
      timeline: { start: "not-a-date", end: "2026-12-01" },
    });
    expect(() => ProgramSchema.parse(malformed)).not.toThrow();
    const inverted = synthesizeProgram({
      ...brief,
      timeline: { start: "2026-12-01", end: "2026-09-01" },
    });
    expect(() => ProgramSchema.parse(inverted)).not.toThrow();
    expect(inverted.timeline.end > inverted.timeline.start).toBe(true);
  });
});
