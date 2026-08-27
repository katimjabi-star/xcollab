import {
  ASSISTANT_MUTATION_TOOL_NAMES,
  ASSISTANT_MUTATION_TOOLS,
  ASSISTANT_READ_TOOLS,
  isAssistantMutationTool,
} from "@xcollab/core";
import type { ToolSpec } from "./chat.ts";

/**
 * ToolSpec views over the canonical assistant tool contract in
 * packages/core/src/assistant-tools.ts (spec §2.3, M0) — the zod schemas are
 * defined once there so field rules can never drift from the API.
 */

export const ASSISTANT_TOOLS: readonly ToolSpec[] = Object.entries({
  ...ASSISTANT_READ_TOOLS,
  ...ASSISTANT_MUTATION_TOOLS,
}).map(([name, definition]) => ({
  name,
  description: definition.description,
  argsSchema: definition.args,
}));

/**
 * Read-only view for channels that must never mutate (e.g. the WhatsApp
 * bridge): with no mutation tools in the projection, the model cannot even
 * propose a change on that surface.
 */
export const ASSISTANT_READ_TOOL_SPECS: readonly ToolSpec[] = Object.entries(
  ASSISTANT_READ_TOOLS,
).map(([name, definition]) => ({
  name,
  description: definition.description,
  argsSchema: definition.args,
}));

/** Read tools auto-run in the api loop; mutation tools always stop at a proposal. */
export const MUTATION_TOOLS: ReadonlySet<string> = new Set(ASSISTANT_MUTATION_TOOL_NAMES);

export { isAssistantMutationTool as isMutationTool };

export {
  CreateProjectArgsSchema,
  CreateTaskArgsSchema,
  GetProjectArgsSchema,
  GetProjectSummaryArgsSchema,
  ListProjectsArgsSchema,
  ListTeamsArgsSchema,
  ListUsersArgsSchema,
  SearchTasksArgsSchema,
  UpdateProjectArgsSchema,
  UpdateTaskArgsSchema,
} from "@xcollab/core";
