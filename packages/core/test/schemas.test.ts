import { describe, expect, it } from "vitest";
import {
  LanguageSchema,
  ProgramSchema,
  TaskSchema,
  TeamMemberSchema,
  WorkPackageSchema,
  WorkspaceTeamSchema,
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

describe("TaskSchema.assignee", () => {
  it("accepts an optional assignee username", () => {
    expect(TaskSchema.parse({ ...validTask, assignee: "sara" }).assignee).toBe("sara");
    expect(TaskSchema.parse(validTask).assignee).toBeUndefined();
  });

  it("rejects an empty assignee", () => {
    expect(() => TaskSchema.parse({ ...validTask, assignee: "" })).toThrow();
  });
});

describe("ProgramSchema.parentId", () => {
  it("round-trips an optional parentId", () => {
    expect(ProgramSchema.parse({ ...validProgram, parentId: "prog-0" }).parentId).toBe("prog-0");
    expect(ProgramSchema.parse(validProgram).parentId).toBeUndefined();
  });

  it("rejects an empty parentId", () => {
    expect(() => ProgramSchema.parse({ ...validProgram, parentId: "" })).toThrow();
  });
});

const validMember = { username: "jabbir", role: "lead" };

const validWorkspaceTeam = {
  id: "team-1",
  name: "Platform Squad",
  description: "Owns the API and ledger",
  members: [validMember, { username: "sara", role: "member" }],
};

describe("TeamMemberSchema", () => {
  it("accepts lead and member roles", () => {
    expect(TeamMemberSchema.parse(validMember).role).toBe("lead");
    expect(TeamMemberSchema.parse({ username: "omar", role: "member" }).role).toBe("member");
  });

  it("rejects unknown roles and empty usernames", () => {
    expect(() => TeamMemberSchema.parse({ username: "jabbir", role: "owner" })).toThrow();
    expect(() => TeamMemberSchema.parse({ username: "", role: "lead" })).toThrow();
  });
});

describe("WorkspaceTeamSchema", () => {
  it("accepts a valid team and keeps description optional", () => {
    expect(WorkspaceTeamSchema.parse(validWorkspaceTeam).members).toHaveLength(2);
    const noDescription = { ...validWorkspaceTeam, description: undefined };
    expect(WorkspaceTeamSchema.parse(noDescription).description).toBeUndefined();
  });

  it("rejects empty id or name and over-long descriptions", () => {
    expect(() => WorkspaceTeamSchema.parse({ ...validWorkspaceTeam, id: "" })).toThrow();
    expect(() => WorkspaceTeamSchema.parse({ ...validWorkspaceTeam, name: "" })).toThrow();
    expect(() =>
      WorkspaceTeamSchema.parse({ ...validWorkspaceTeam, description: "x".repeat(501) }),
    ).toThrow();
  });

  it("rejects a member with an invalid role", () => {
    const bad = { ...validWorkspaceTeam, members: [{ username: "jabbir", role: "boss" }] };
    expect(() => WorkspaceTeamSchema.parse(bad)).toThrow();
  });
});
