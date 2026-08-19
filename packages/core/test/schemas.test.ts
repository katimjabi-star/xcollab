import { describe, expect, it } from "vitest";
import {
  LanguageSchema,
  ProgramSchema,
  TaskSchema,
  WorkPackageSchema,
} from "../src/index.ts";

const validTask = {
  id: "task-1",
  name: "Design sensor mesh topology",
  status: "todo",
  estimateDays: 3,
};

const validPackage = {
  id: "wbp-1",
  name: "Sensor Mesh",
  scope: "Radar and RF sensor integration",
  tasks: [validTask],
  dependsOn: [],
};

const validProgram = {
  id: "prog-1",
  name: "Counter-UAS Grid",
  mission: "Protect critical infrastructure from hostile UAS",
  language: "en",
  timeline: { start: "2026-09-01", end: "2026-12-01" },
  teams: [{ id: "team-1", name: "Systems Engineering", kind: "internal" }],
  packages: [validPackage],
  milestones: [{ id: "ms-1", name: "Grid live", dueDate: "2026-11-15" }],
  risks: [{ id: "risk-1", title: "GPU supply delay", severity: "high" }],
};

describe("ProgramSchema", () => {
  it("accepts a complete valid program", () => {
    expect(ProgramSchema.parse(validProgram)).toMatchObject({ id: "prog-1" });
  });

  it("rejects a program whose timeline ends before it starts", () => {
    const bad = { ...validProgram, timeline: { start: "2026-12-01", end: "2026-09-01" } };
    expect(() => ProgramSchema.parse(bad)).toThrow();
  });

  it("rejects an empty mission", () => {
    expect(() => ProgramSchema.parse({ ...validProgram, mission: "" })).toThrow();
  });

  it("rejects a package dependency on an unknown package id", () => {
    const bad = {
      ...validProgram,
      packages: [{ ...validPackage, dependsOn: ["wbp-does-not-exist"] }],
    };
    expect(() => ProgramSchema.parse(bad)).toThrow();
  });

  it("accepts Arabic as a first-class language", () => {
    expect(LanguageSchema.parse("ar")).toBe("ar");
    const arabic = { ...validProgram, language: "ar", name: "شبكة الدفاع" };
    expect(ProgramSchema.parse(arabic).name).toBe("شبكة الدفاع");
  });
});

describe("TaskSchema", () => {
  it("rejects unknown status values", () => {
    expect(() => TaskSchema.parse({ ...validTask, status: "someday" })).toThrow();
  });

  it("rejects non-positive estimates", () => {
    expect(() => TaskSchema.parse({ ...validTask, estimateDays: 0 })).toThrow();
  });
});

describe("WorkPackageSchema", () => {
  it("requires at least one task", () => {
    expect(() => WorkPackageSchema.parse({ ...validPackage, tasks: [] })).toThrow();
  });
});
