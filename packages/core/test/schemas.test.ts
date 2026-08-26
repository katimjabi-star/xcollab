import { describe, expect, it } from "vitest";
import {
  AttachmentSchema,
  LanguageSchema,
  ProgramSchema,
  SubtaskSchema,
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

  it("rejects duplicate package ids", () => {
    // Duplicate ids would silently collapse in findDependencyCycle's Map.
    const bad = {
      ...validProgram,
      packages: [validPackage, { ...validPackage, name: "Duplicate id, other name" }],
    };
    expect(() => ProgramSchema.parse(bad)).toThrow();
  });

  it("bounds name and mission at 500 and 20000 characters", () => {
    expect(() => ProgramSchema.parse({ ...validProgram, name: "x".repeat(501) })).toThrow();
    expect(ProgramSchema.parse({ ...validProgram, name: "x".repeat(500) }).name).toHaveLength(500);
    expect(() =>
      ProgramSchema.parse({ ...validProgram, mission: "x".repeat(20_001) }),
    ).toThrow();
  });
});

describe("TaskSchema", () => {
  it("rejects unknown status values", () => {
    expect(() => TaskSchema.parse({ ...validTask, status: "someday" })).toThrow();
  });

  it("rejects non-positive estimates", () => {
    expect(() => TaskSchema.parse({ ...validTask, estimateDays: 0 })).toThrow();
  });

  it("rejects an over-long name", () => {
    expect(() => TaskSchema.parse({ ...validTask, name: "x".repeat(501) })).toThrow();
    expect(TaskSchema.parse({ ...validTask, name: "x".repeat(500) }).name).toHaveLength(500);
  });
});

describe("TaskSchema.subtasks / SubtaskSchema", () => {
  const validSubtask = { id: "sub-1", name: "Write the checklist", done: false };

  it("accepts a task with subtasks and keeps them optional", () => {
    const parsed = TaskSchema.parse({ ...validTask, subtasks: [validSubtask] });
    expect(parsed.subtasks).toEqual([validSubtask]);
    expect(TaskSchema.parse(validTask).subtasks).toBeUndefined();
    expect(TaskSchema.parse({ ...validTask, subtasks: [] }).subtasks).toEqual([]);
  });

  it("rejects more than 50 subtasks", () => {
    const many = Array.from({ length: 51 }, (_, i) => ({ ...validSubtask, id: `sub-${i}` }));
    expect(() => TaskSchema.parse({ ...validTask, subtasks: many })).toThrow();
    expect(
      TaskSchema.parse({ ...validTask, subtasks: many.slice(0, 50) }).subtasks,
    ).toHaveLength(50);
  });

  it("rejects empty ids, empty or over-long names, and non-boolean done", () => {
    expect(() => SubtaskSchema.parse({ ...validSubtask, id: "" })).toThrow();
    expect(() => SubtaskSchema.parse({ ...validSubtask, name: "" })).toThrow();
    expect(() => SubtaskSchema.parse({ ...validSubtask, name: "x".repeat(501) })).toThrow();
    expect(() => SubtaskSchema.parse({ ...validSubtask, done: "yes" })).toThrow();
    expect(SubtaskSchema.parse({ ...validSubtask, name: "x".repeat(500) }).name).toHaveLength(500);
  });

  it("rejects a subtask missing done", () => {
    expect(() => SubtaskSchema.parse({ id: "sub-1", name: "No done flag" })).toThrow();
  });
});

describe("TaskSchema dates", () => {
  it("rejects a startDate after the dueDate", () => {
    const bad = { ...validTask, startDate: "2026-10-01", dueDate: "2026-09-01" };
    expect(() => TaskSchema.parse(bad)).toThrow();
  });

  it("accepts equal start and due dates and single-ended ranges", () => {
    const sameDay = { ...validTask, startDate: "2026-09-01", dueDate: "2026-09-01" };
    expect(TaskSchema.parse(sameDay).dueDate).toBe("2026-09-01");
    expect(TaskSchema.parse({ ...validTask, dueDate: "2026-09-01" }).startDate).toBeUndefined();
    expect(TaskSchema.parse({ ...validTask, startDate: "2026-09-01" }).dueDate).toBeUndefined();
  });

  it("rejects calendar-invalid and non-date strings", () => {
    for (const garbage of ["2026-13-45", "2026-02-31", "not-a-date", "2026-1-1", ""]) {
      expect(() => TaskSchema.parse({ ...validTask, dueDate: garbage }), garbage).toThrow();
    }
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

describe("ProgramSchema.teamId", () => {
  it("round-trips an optional teamId", () => {
    expect(ProgramSchema.parse({ ...validProgram, teamId: "team-9" }).teamId).toBe("team-9");
    expect(ProgramSchema.parse(validProgram).teamId).toBeUndefined();
  });

  it("rejects an empty teamId", () => {
    expect(() => ProgramSchema.parse({ ...validProgram, teamId: "" })).toThrow();
  });
});

const validAttachment = {
  id: "att-1",
  workspaceId: "ws-1",
  programId: "prog-1",
  taskId: null,
  filename: "spec.pdf",
  contentType: "application/pdf",
  sizeBytes: 1024,
  sha256: "a".repeat(64),
  uploadedBy: "jabbir",
  createdAt: "2026-08-20T09:00:00.000Z",
};

describe("AttachmentSchema", () => {
  it("accepts a program-scoped attachment (taskId null)", () => {
    expect(AttachmentSchema.parse(validAttachment).taskId).toBeNull();
  });

  it("accepts a task-scoped attachment", () => {
    expect(AttachmentSchema.parse({ ...validAttachment, taskId: "task-1" }).taskId).toBe("task-1");
  });

  it("rejects a malformed sha256 and negative sizes", () => {
    expect(() => AttachmentSchema.parse({ ...validAttachment, sha256: "zz" })).toThrow();
    expect(() => AttachmentSchema.parse({ ...validAttachment, sizeBytes: -1 })).toThrow();
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
