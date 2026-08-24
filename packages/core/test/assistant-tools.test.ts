import { describe, expect, it } from "vitest";
import {
  ASSISTANT_MUTATION_TOOL_NAMES,
  ASSISTANT_READ_TOOL_NAMES,
  AssistantEventSchema,
  assistantToolDefinition,
  assistantToolSpecs,
  CreateTaskArgsSchema,
  isAssistantMutationTool,
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
