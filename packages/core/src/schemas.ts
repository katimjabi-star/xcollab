import { z } from "zod";

export const LanguageSchema = z.enum(["en", "ar"]);
export type Language = z.infer<typeof LanguageSchema>;

export const TaskStatusSchema = z.enum(["todo", "in_progress", "blocked", "done"]);

export const TaskSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  status: TaskStatusSchema,
  estimateDays: z.number().positive(),
  assigneeRole: z.string().min(1).optional(),
  /** Keycloak username of the assigned person (assigneeRole stays the role hint). */
  assignee: z.string().min(1).optional(),
  startDate: z.iso.date().optional(),
  dueDate: z.iso.date().optional(),
  description: z.string().max(4000).optional(),
});
export type Task = z.infer<typeof TaskSchema>;

export const WorkPackageSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  scope: z.string().min(1),
  tasks: z.array(TaskSchema).min(1),
  dependsOn: z.array(z.string().min(1)),
});
export type WorkPackage = z.infer<typeof WorkPackageSchema>;

export const TeamSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
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
  name: z.string().min(1),
  description: z.string().max(500).optional(),
  members: z.array(TeamMemberSchema),
});
export type WorkspaceTeam = z.infer<typeof WorkspaceTeamSchema>;

export const MilestoneSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  dueDate: z.iso.date(),
});

export const RiskSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  severity: z.enum(["low", "medium", "high", "critical"]),
  owner: z.string().min(1).optional(),
});

export const TimelineSchema = z
  .object({ start: z.iso.date(), end: z.iso.date() })
  .refine((t) => t.end > t.start, { message: "timeline must end after it starts" });

export const ProgramSchema = z
  .object({
    id: z.string().min(1),
    /** Optional parent program id (same workspace) for program hierarchies. */
    parentId: z.string().min(1).optional(),
    name: z.string().min(1),
    mission: z.string().min(1),
    language: LanguageSchema,
    timeline: TimelineSchema,
    teams: z.array(TeamSchema).min(1),
    packages: z.array(WorkPackageSchema).min(1),
    milestones: z.array(MilestoneSchema),
    risks: z.array(RiskSchema),
  })
  .superRefine((program, ctx) => {
    const ids = new Set(program.packages.map((p) => p.id));
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
