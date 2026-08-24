import { describe, expect, it } from "vitest";
import type { Subtask } from "@xcollab/core";
import { SUBTASK_CAP, subtaskDone, subtaskProgress } from "../lib/subtasks.ts";

const list: Subtask[] = [
  { id: "sub-1", name: "One", done: true },
  { id: "sub-2", name: "Two", done: false },
  { id: "sub-3", name: "Three", done: false },
];

describe("subtaskDone", () => {
  it("returns the server state when no override exists", () => {
    expect(subtaskDone(list[0] as Subtask, {})).toBe(true);
    expect(subtaskDone(list[1] as Subtask, {})).toBe(false);
  });

  it("lets an optimistic override win over the server state", () => {
    expect(subtaskDone(list[0] as Subtask, { "sub-1": false })).toBe(false);
    expect(subtaskDone(list[1] as Subtask, { "sub-2": true })).toBe(true);
  });

  it("ignores overrides for other subtasks", () => {
    expect(subtaskDone(list[1] as Subtask, { "sub-1": false })).toBe(false);
  });
});

describe("subtaskProgress", () => {
  it("counts done/total from the server state", () => {
    expect(subtaskProgress(list)).toEqual({ done: 1, total: 3 });
  });

  it("is override-aware so the count chip updates optimistically", () => {
    expect(subtaskProgress(list, { "sub-2": true })).toEqual({ done: 2, total: 3 });
    expect(subtaskProgress(list, { "sub-1": false })).toEqual({ done: 0, total: 3 });
  });

  it("treats a task without subtasks as 0/0", () => {
    expect(subtaskProgress(undefined)).toEqual({ done: 0, total: 0 });
    expect(subtaskProgress([])).toEqual({ done: 0, total: 0 });
  });

  it("matches the server-enforced cap constant", () => {
    expect(SUBTASK_CAP).toBe(50);
  });
});
