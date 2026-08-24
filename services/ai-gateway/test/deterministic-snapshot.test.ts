import { describe, expect, it } from "vitest";
import type { ChatMessage } from "../src/chat.ts";
import {
  extractSearchTaskRows,
  resolveSearchTask,
  type SearchTaskRow,
} from "../src/adapters/deterministic-snapshot.ts";

const toolResult = (tool: string, payload: unknown): ChatMessage => ({
  role: "tool_result",
  tool,
  content: JSON.stringify(payload),
});

const ROW_A: SearchTaskRow = {
  programId: "prog-falcon",
  programName: "Falcon Rollout",
  packageId: "pkg-build",
  packageName: "Build",
  id: "task-ground",
  name: "Ground station calibration",
  status: "todo",
};

const ROW_B: SearchTaskRow = {
  ...ROW_A,
  id: "task-ground-2",
  name: "Ground station inspection",
};

describe("extractSearchTaskRows", () => {
  it("parses a bare array search_tasks result", () => {
    const rows = extractSearchTaskRows([toolResult("search_tasks", [ROW_A])]);
    expect(rows).toEqual([ROW_A]);
  });

  it("parses a { tasks: [...] } wrapped result", () => {
    const rows = extractSearchTaskRows([toolResult("search_tasks", { tasks: [ROW_A] })]);
    expect(rows).toEqual([ROW_A]);
  });

  it("drops rows missing required identity fields", () => {
    const rows = extractSearchTaskRows([
      toolResult("search_tasks", [ROW_A, { id: "task-x", name: "No program on this row" }]),
    ]);
    expect(rows).toEqual([ROW_A]);
  });

  it("returns undefined when there is no search_tasks tool_result", () => {
    expect(extractSearchTaskRows([toolResult("list_projects", [])])).toBeUndefined();
  });

  it("returns undefined for unparsable JSON instead of throwing", () => {
    expect(
      extractSearchTaskRows([{ role: "tool_result", tool: "search_tasks", content: "not json" }]),
    ).toBeUndefined();
  });

  it("prefers the latest search_tasks tool_result when more than one is present", () => {
    const rows = extractSearchTaskRows([
      toolResult("search_tasks", [ROW_A]),
      toolResult("search_tasks", [ROW_B]),
    ]);
    expect(rows).toEqual([ROW_B]);
  });
});

describe("resolveSearchTask", () => {
  const rows = [ROW_A, ROW_B];

  it("resolves a unique substring match", () => {
    expect(resolveSearchTask(rows, "calibration")).toEqual({
      match: ROW_A,
      candidates: [ROW_A.name],
    });
  });

  it("resolves by exact id", () => {
    expect(resolveSearchTask(rows, "task-ground-2")).toEqual({
      match: ROW_B,
      candidates: [ROW_B.name],
    });
  });

  it("reports ambiguity with every matching candidate name", () => {
    const result = resolveSearchTask(rows, "ground station");
    expect(result.match).toBeUndefined();
    expect(result.candidates.sort()).toEqual([ROW_A.name, ROW_B.name].sort());
  });

  it("reports zero candidates when nothing matches", () => {
    expect(resolveSearchTask(rows, "nonexistent")).toEqual({ candidates: [] });
  });
});
