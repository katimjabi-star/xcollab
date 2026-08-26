import { z } from "zod";

export const LanguageSchema = z.enum(["en", "ar"]);
export type Language = z.infer<typeof LanguageSchema>;

export const TaskStatusSchema = z.enum(["todo", "in_progress", "blocked", "done"]);

/** Checklist-style subtask embedded in a task (flat list, not a task tree). */
export const SubtaskSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(500),
  done: z.boolean(),
});
export type Subtask = z.infer<typeof SubtaskSchema>;

export const TaskSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1).max(500),
    status: TaskStatusSchema,
    estimateDays: z.number().positive(),
    assigneeRole: z.string().min(1).max(200).optional(),
    /** Keycloak username of the assigned person (assigneeRole stays the role hint). */
    assignee: z.string().min(1).max(200).optional(),
    startDate: z.iso.date().optional(),
    dueDate: z.iso.date().optional(),
    description: z.string().max(4000).optional(),
    subtasks: z.array(SubtaskSchema).max(50).optional(),
  })
  .refine((t) => !t.startDate || !t.dueDate || t.startDate <= t.dueDate, {
    message: "task startDate must be on or before dueDate",
    path: ["dueDate"],
  });
export type Task = z.infer<typeof TaskSchema>;

export const WorkPackageSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(500),
  scope: z.string().min(1).max(4000),
  tasks: z.array(TaskSchema).min(1).max(200),
  dependsOn: z.array(z.string().min(1)).max(50),
});
export type WorkPackage = z.infer<typeof WorkPackageSchema>;

export const TeamSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(500),
  kind: z.enum(["internal", "vendor"]),
});

export const TeamMemberSchema = z.object({
  username: z.string().min(1),
  role: z.enum(["lead", "member"]),
});
export type TeamMember = z.infer<typeof TeamMemberSchema>;

/** Standalone workspace team (distinct from the embedded per-program TeamSchema). */
export const WorkspaceTeamSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(500),
  description: z.string().max(500).optional(),
  members: z.array(TeamMemberSchema),
});
export type WorkspaceTeam = z.infer<typeof WorkspaceTeamSchema>;

export const MilestoneSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(500),
  dueDate: z.iso.date(),
});

export const RiskSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(500),
  severity: z.enum(["low", "medium", "high", "critical"]),
  owner: z.string().min(1).max(200).optional(),
});

export const TimelineSchema = z
  .object({ start: z.iso.date(), end: z.iso.date() })
  .refine((t) => t.end > t.start, { message: "timeline must end after it starts" });

export const ProgramSchema = z
  .object({
    id: z.string().min(1),
    /** Optional parent program id (same workspace) for program hierarchies. */
    parentId: z.string().min(1).optional(),
    /** Optional linked workspace team id (WorkspaceTeamSchema, same workspace). */
    teamId: z.string().min(1).optional(),
    name: z.string().min(1).max(500),
    mission: z.string().min(1).max(20_000),
    language: LanguageSchema,
    timeline: TimelineSchema,
    teams: z.array(TeamSchema).min(1).max(50),
    packages: z.array(WorkPackageSchema).min(1).max(100),
    milestones: z.array(MilestoneSchema).max(100),
    risks: z.array(RiskSchema).max(100),
  })
  .superRefine((program, ctx) => {
    const ids = new Set(program.packages.map((p) => p.id));
    if (ids.size !== program.packages.length) {
      ctx.addIssue({
        code: "custom",
        message: "package ids must be unique",
        path: ["packages"],
      });
    }
    for (const pkg of program.packages) {
      for (const dep of pkg.dependsOn) {
        if (!ids.has(dep)) {
          ctx.addIssue({
            code: "custom",
            message: `package "${pkg.id}" depends on unknown package "${dep}"`,
            path: ["packages"],
          });
        }
      }
    }
  });
export type Program = z.infer<typeof ProgramSchema>;

/**
 * File attachment metadata as served by the API. The object content lives in
 * MinIO under a storage key that never leaves services/api; the sha256 is
 * ledgered on attach so content tampering is detectable against the chain.
 */
export const AttachmentSchema = z.object({
  id: z.string().min(1),
  workspaceId: z.string().min(1),
  programId: z.string().min(1),
  /** null for program-level documents; a task id for task-scoped ones. */
  taskId: z.string().min(1).nullable(),
  filename: z.string().min(1).max(255),
  contentType: z.string().min(1).max(200),
  // Contract ceiling only; the upload route enforces its own (smaller) cap.
  sizeBytes: z
    .number()
    .int()
    .nonnegative()
    .max(1024 * 1024 * 1024),
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
  uploadedBy: z.string().min(1),
  createdAt: z.iso.datetime(),
});
export type Attachment = z.infer<typeof AttachmentSchema>;
