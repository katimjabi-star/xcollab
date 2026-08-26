import { z } from "zod";
import {
  LanguageSchema,
  SubtaskSchema,
  TaskSchema,
  TaskStatusSchema,
  TimelineSchema,
} from "./schemas.ts";

/**
 * XCollab AI tool contract (cross-team: api loop, gateway adapters, web UI).
 * READ tools auto-execute inside the agent loop against GET routes only;
 * MUTATION tools never execute in the loop — they become proposal cards and
 * run only through POST /api/assistant/execute after an explicit user confirm.
 */

// ---------- READ tool argument schemas ----------

export const SearchTasksArgsSchema = z.object({
  programId: z.string().min(1).optional(),
  status: TaskStatusSchema.optional(),
  /** A username, or the literal "me" (resolved server-side to the token user). */
  assignee: z.string().min(1).max(200).optional(),
  /** dueDate strictly before today AND status is not done. */
  overdue: z.boolean().optional(),
  dueBefore: z.iso.date().optional(),
  dueAfter: z.iso.date().optional(),
  /** Case-insensitive substring over task name + description. */
  text: z.string().min(1).max(200).optional(),
  limit: z.number().int().min(1).max(50).optional(),
});

export const GetProjectArgsSchema = z.object({ programId: z.string().min(1) });
export const GetProjectSummaryArgsSchema = z.object({ programId: z.string().min(1) });
export const ListProjectsArgsSchema = z.object({});
export const ListUsersArgsSchema = z.object({});
export const ListTeamsArgsSchema = z.object({});

// ---------- MUTATION tool argument schemas ----------

export const CreateProjectArgsSchema = z.object({
  mission: z.string().min(1).max(20_000),
  language: LanguageSchema,
  timeline: TimelineSchema.optional(),
  teamHints: z.array(z.string().trim().min(1).max(500)).max(20).optional(),
  teamId: z.string().min(1).optional(),
});

export const CreateTaskArgsSchema = z
  .object({
    programId: z.string().min(1),
    packageId: z.string().min(1),
    name: TaskSchema.shape.name,
    estimateDays: TaskSchema.shape.estimateDays.optional(),
    assignee: TaskSchema.shape.assignee,
    assigneeRole: TaskSchema.shape.assigneeRole,
    startDate: TaskSchema.shape.startDate,
    dueDate: TaskSchema.shape.dueDate,
    description: TaskSchema.shape.description,
  })
  .refine((a) => !a.startDate || !a.dueDate || a.startDate <= a.dueDate, {
    message: "task startDate must be on or before dueDate",
    path: ["dueDate"],
  });

const UPDATE_TASK_PATCH_KEYS = [
  "status",
  "name",
  "estimateDays",
  "assigneeRole",
  "assignee",
  "startDate",
  "dueDate",
  "description",
] as const;

/** Field validators come from TaskSchema.shape; null clears an optional field. */
export const UpdateTaskArgsSchema = z.object({
  programId: z.string().min(1),
  taskId: z.string().min(1),
  patch: z
    .object({
      status: TaskSchema.shape.status.optional(),
      name: TaskSchema.shape.name.optional(),
      estimateDays: TaskSchema.shape.estimateDays.optional(),
      assigneeRole: TaskSchema.shape.assigneeRole.nullable(),
      assignee: TaskSchema.shape.assignee.nullable(),
      startDate: TaskSchema.shape.startDate.nullable(),
      dueDate: TaskSchema.shape.dueDate.nullable(),
      description: TaskSchema.shape.description.nullable(),
    })
    .refine((patch) => UPDATE_TASK_PATCH_KEYS.some((key) => patch[key] !== undefined), {
      message: "at least one task field is required",
    }),
});

export const UpdateProjectArgsSchema = z.object({
  programId: z.string().min(1),
  /** null unlinks; a string links to an existing workspace team. */
  teamId: z.string().min(1).nullable(),
});

export const DeleteTaskArgsSchema = z.object({
  programId: z.string().min(1),
  taskId: z.string().min(1),
});

export const DeleteProjectArgsSchema = z.object({ programId: z.string().min(1) });

export const AddTeamMemberArgsSchema = z.object({
  teamId: z.string().min(1),
  username: z.string().min(1).max(200),
});

export const RemoveTeamMemberArgsSchema = z.object({
  teamId: z.string().min(1),
  username: z.string().min(1).max(200),
});

export const AddSubtaskArgsSchema = z.object({
  programId: z.string().min(1),
  taskId: z.string().min(1),
  name: SubtaskSchema.shape.name,
});

// ---------- Registry ----------

export interface AssistantToolDefinition {
  readonly description: string;
  readonly args: z.ZodType;
}

export const ASSISTANT_READ_TOOLS = {
  search_tasks: {
    description:
      "Search tasks across the workspace with exact filters (assignee, status, due windows, " +
      "overdue, program, text). Use assignee 'me' for the requesting user.",
    args: SearchTasksArgsSchema,
  },
  get_project: {
    description: "Fetch one project (program) with its work packages and tasks by programId.",
    args: GetProjectArgsSchema,
  },
  list_projects: {
    description: "List every project (program) in the workspace with package ids and names.",
    args: ListProjectsArgsSchema,
  },
  get_project_summary: {
    description:
      "Deterministic project digest: task counts by status, overdue count, next milestone, " +
      "open risks by severity, per-package progress.",
    args: GetProjectSummaryArgsSchema,
  },
  list_users: { description: "List workspace member usernames.", args: ListUsersArgsSchema },
  list_teams: { description: "List workspace teams and their members.", args: ListTeamsArgsSchema },
} as const satisfies Record<string, AssistantToolDefinition>;

export const ASSISTANT_MUTATION_TOOLS = {
  create_project: {
    description:
      "PROPOSE creating a new project from a mission brief. Requires user confirmation.",
    args: CreateProjectArgsSchema,
  },
  create_task: {
    description:
      "PROPOSE adding a task to an existing work package. Requires user confirmation. " +
      "Resolve programId/packageId via read tools first — never invent ids.",
    args: CreateTaskArgsSchema,
  },
  update_task: {
    description:
      "PROPOSE editing task fields (status, name, dates, assignee, description). " +
      "null clears a field. Requires user confirmation.",
    args: UpdateTaskArgsSchema,
  },
  update_project: {
    description:
      "PROPOSE linking (teamId) or unlinking (null) a workspace team on a project. " +
      "Requires user confirmation.",
    args: UpdateProjectArgsSchema,
  },
  delete_task: {
    description:
      "PROPOSE deleting a task from its work package. Requires user confirmation. " +
      "Resolve programId/taskId via read tools first — never invent ids.",
    args: DeleteTaskArgsSchema,
  },
  delete_project: {
    description:
      "PROPOSE deleting an entire project (program) and everything in it. " +
      "Requires user confirmation. Resolve programId via read tools first.",
    args: DeleteProjectArgsSchema,
  },
  add_team_member: {
    description:
      "PROPOSE adding a workspace user to a team. Requires user confirmation. " +
      "Resolve teamId via list_teams and the username via list_users first.",
    args: AddTeamMemberArgsSchema,
  },
  remove_team_member: {
    description:
      "PROPOSE removing a member from a team. Requires user confirmation. " +
      "Resolve teamId and the member username via list_teams first.",
    args: RemoveTeamMemberArgsSchema,
  },
  add_subtask: {
    description:
      "PROPOSE adding a checklist subtask to a task. Requires user confirmation. " +
      "Resolve programId/taskId via read tools first — never invent ids.",
    args: AddSubtaskArgsSchema,
  },
} as const satisfies Record<string, AssistantToolDefinition>;

export type AssistantReadToolName = keyof typeof ASSISTANT_READ_TOOLS;
export type AssistantMutationToolName = keyof typeof ASSISTANT_MUTATION_TOOLS;
export type AssistantToolName = AssistantReadToolName | AssistantMutationToolName;

export const ASSISTANT_READ_TOOL_NAMES = Object.keys(
  ASSISTANT_READ_TOOLS,
) as AssistantReadToolName[];
export const ASSISTANT_MUTATION_TOOL_NAMES = Object.keys(
  ASSISTANT_MUTATION_TOOLS,
) as AssistantMutationToolName[];

export function assistantToolDefinition(name: string): AssistantToolDefinition | undefined {
  if (name in ASSISTANT_READ_TOOLS) return ASSISTANT_READ_TOOLS[name as AssistantReadToolName];
  if (name in ASSISTANT_MUTATION_TOOLS) {
    return ASSISTANT_MUTATION_TOOLS[name as AssistantMutationToolName];
  }
  return undefined;
}

export function isAssistantMutationTool(name: string): name is AssistantMutationToolName {
  return name in ASSISTANT_MUTATION_TOOLS;
}

/** JSON Schema tool specs handed to chat adapters — generated, never hand-written. */
export function assistantToolSpecs(): {
  name: AssistantToolName;
  description: string;
  inputSchema: Record<string, unknown>;
}[] {
  const all = { ...ASSISTANT_READ_TOOLS, ...ASSISTANT_MUTATION_TOOLS };
  return (Object.keys(all) as AssistantToolName[]).map((name) => ({
    name,
    description: all[name].description,
    inputSchema: z.toJSONSchema(all[name].args) as Record<string, unknown>,
  }));
}

// ---------- SSE event contract (POST /api/assistant/messages) ----------

const ProposalPreviewSchema = z.object({
  title: z.string().min(1),
  fields: z.array(z.object({ label: z.string().min(1), value: z.string() })),
});
export type ProposalPreview = z.infer<typeof ProposalPreviewSchema>;

export const AssistantEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("text_delta"), text: z.string() }),
  z.object({ type: z.literal("tool_started"), tool: z.string().min(1), argsSummary: z.string() }),
  z.object({ type: z.literal("tool_result"), tool: z.string().min(1), result: z.unknown() }),
  z.object({
    type: z.literal("proposal"),
    proposalId: z.uuid(),
    tool: z.string().min(1),
    args: z.unknown(),
    preview: ProposalPreviewSchema,
  }),
  z.object({ type: z.literal("done"), finishReason: z.enum(["stop", "proposal", "length"]) }),
  z.object({ type: z.literal("error"), code: z.string().min(1), message: z.string() }),
]);
export type AssistantEvent = z.infer<typeof AssistantEventSchema>;
