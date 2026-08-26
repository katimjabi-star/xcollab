import { describe, expect, it } from "vitest";
import {
  AddSubtaskArgsSchema,
  AddTeamMemberArgsSchema,
  ASSISTANT_MUTATION_TOOL_NAMES,
  ASSISTANT_READ_TOOL_NAMES,
  AssistantEventSchema,
  assistantToolDefinition,
  assistantToolSpecs,
  CreateTaskArgsSchema,
  DeleteProjectArgsSchema,
  DeleteTaskArgsSchema,
  isAssistantMutationTool,
  RemoveTeamMemberArgsSchema,
  SearchTasksArgsSchema,
  UpdateTaskArgsSchema,
} from "../src/assistant-tools.ts";

describe("assistant tool registry", () => {
  it("classifies reads and mutations disjointly", () => {
    expect(ASSISTANT_READ_TOOL_NAMES).toContain("search_tasks");
    expect(ASSISTANT_MUTATION_TOOL_NAMES).toEqual([
      "create_project",
      "create_task",
      "update_task",
      "update_project",
      "delete_task",
      "delete_project",
      "add_team_member",
      "remove_team_member",
      "add_subtask",
    ]);
    for (const name of ASSISTANT_READ_TOOL_NAMES) {
      expect(isAssistantMutationTool(name)).toBe(false);
    }
    for (const name of ASSISTANT_MUTATION_TOOL_NAMES) {
      expect(isAssistantMutationTool(name)).toBe(true);
    }
    expect(assistantToolDefinition("nope")).toBeUndefined();
  });

  it("generates a JSON Schema spec per tool from the zod contract", () => {
    const specs = assistantToolSpecs();
    expect(specs).toHaveLength(
      ASSISTANT_READ_TOOL_NAMES.length + ASSISTANT_MUTATION_TOOL_NAMES.length,
    );
    for (const spec of specs) {
      expect(spec.description.length).toBeGreaterThan(10);
      expect(spec.inputSchema["type"]).toBe("object");
      // The generated schema must carry the zod contract's actual fields —
      // a spec with an empty properties object would be silently useless.
      const definition = assistantToolDefinition(spec.name);
      expect(definition).toBeDefined();
      const accepted = definition?.args.safeParse({});
      const properties = (spec.inputSchema["properties"] ?? {}) as Record<string, unknown>;
      // Either the tool takes no args ({} parses) or the JSON Schema names them.
      if (accepted?.success !== true) {
        expect(Object.keys(properties).length).toBeGreaterThan(0);
      }
    }
  });
});

describe("mutation arg schemas", () => {
  it("rejects a create_task whose startDate is after dueDate", () => {
    const parsed = CreateTaskArgsSchema.safeParse({
      programId: "p1",
      packageId: "wp1",
      name: "Task",
      startDate: "2026-09-02",
      dueDate: "2026-09-01",
    });
    expect(parsed.success).toBe(false);
  });

  it("accepts a minimal create_task and drops nothing valid", () => {
    const parsed = CreateTaskArgsSchema.safeParse({
      programId: "p1",
      packageId: "wp1",
      name: "Task",
      assignee: "jabbir",
      dueDate: "2026-09-01",
    });
    expect(parsed.success).toBe(true);
  });

  it("requires both ids on delete_task and rejects extras being absent", () => {
    expect(DeleteTaskArgsSchema.safeParse({ programId: "p1", taskId: "t1" }).success).toBe(true);
    expect(DeleteTaskArgsSchema.safeParse({ programId: "p1" }).success).toBe(false);
    expect(DeleteTaskArgsSchema.safeParse({ programId: "", taskId: "t1" }).success).toBe(false);
  });

  it("requires a non-empty programId on delete_project", () => {
    expect(DeleteProjectArgsSchema.safeParse({ programId: "p1" }).success).toBe(true);
    expect(DeleteProjectArgsSchema.safeParse({}).success).toBe(false);
    expect(DeleteProjectArgsSchema.safeParse({ programId: "" }).success).toBe(false);
  });

  it("requires teamId and username on both team member tools", () => {
    const ok = { teamId: "team-1", username: "omar" };
    expect(AddTeamMemberArgsSchema.safeParse(ok).success).toBe(true);
    expect(RemoveTeamMemberArgsSchema.safeParse(ok).success).toBe(true);
    expect(AddTeamMemberArgsSchema.safeParse({ teamId: "team-1" }).success).toBe(false);
    expect(RemoveTeamMemberArgsSchema.safeParse({ username: "omar" }).success).toBe(false);
    expect(
      AddTeamMemberArgsSchema.safeParse({ teamId: "team-1", username: "x".repeat(201) }).success,
    ).toBe(false);
  });

  it("bounds the add_subtask name to 1..500 characters", () => {
    const base = { programId: "p1", taskId: "t1" };
    expect(AddSubtaskArgsSchema.safeParse({ ...base, name: "Check cables" }).success).toBe(true);
    expect(AddSubtaskArgsSchema.safeParse({ ...base, name: "" }).success).toBe(false);
    expect(AddSubtaskArgsSchema.safeParse({ ...base, name: "x".repeat(501) }).success).toBe(false);
    expect(AddSubtaskArgsSchema.safeParse({ ...base, name: "x".repeat(500) }).success).toBe(true);
  });

  it("classifies every new mutation tool as a mutation", () => {
    for (const name of [
      "delete_task",
      "delete_project",
      "add_team_member",
      "remove_team_member",
      "add_subtask",
    ]) {
      expect(isAssistantMutationTool(name)).toBe(true);
      expect(assistantToolDefinition(name)).toBeDefined();
    }
  });

  it("requires at least one update_task patch field; null clears", () => {
    const empty = UpdateTaskArgsSchema.safeParse({ programId: "p", taskId: "t", patch: {} });
    expect(empty.success).toBe(false);
    const clears = UpdateTaskArgsSchema.safeParse({
      programId: "p",
      taskId: "t",
      patch: { assignee: null, status: "done" },
    });
    expect(clears.success).toBe(true);
  });
});

describe("read arg schemas", () => {
  it("bounds search_tasks filters", () => {
    expect(SearchTasksArgsSchema.safeParse({ limit: 51 }).success).toBe(false);
    expect(SearchTasksArgsSchema.safeParse({ dueBefore: "not-a-date" }).success).toBe(false);
    expect(
      SearchTasksArgsSchema.safeParse({
        assignee: "me",
        overdue: true,
        status: "blocked",
        text: "audit",
        limit: 5,
      }).success,
    ).toBe(true);
  });
});

describe("AssistantEventSchema", () => {
  it("parses the SSE event union and rejects unknown types", () => {
    const proposal = AssistantEventSchema.safeParse({
      type: "proposal",
      proposalId: "0d6c2c9f-9a19-4f4b-8f43-0f6a51a86f5b",
      tool: "update_task",
      args: { programId: "p", taskId: "t", patch: { status: "done" } },
      preview: { title: "update_task", fields: [{ label: "status", value: "done" }] },
    });
    expect(proposal.success).toBe(true);
    expect(AssistantEventSchema.safeParse({ type: "nope" }).success).toBe(false);
    expect(
      AssistantEventSchema.safeParse({ type: "done", finishReason: "proposal" }).success,
    ).toBe(true);
  });
});
