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

  it("defaults the timeline when none is given", () => {
    const program = synthesizeProgram({ mission: brief.mission, language: "en" });
    expect(() => ProgramSchema.parse(program)).not.toThrow();
  });
});
