import { describe, expect, it } from "vitest";
import type { Program } from "@xcollab/core";
import { makeRefResolver } from "../lib/assistant-refs.ts";

const program = {
  id: "prog-1",
  name: "Coastal Readiness Cell",
  packages: [
    {
      id: "wbp-1",
      name: "Mobilization",
      tasks: [{ id: "task-9", name: "Field kit audit" }],
    },
  ],
} as unknown as Program;

const resolve = makeRefResolver([program]);

describe("makeRefResolver", () => {
  it("resolves programId, packageId, and taskId to display names", () => {
    const args = { programId: "prog-1", packageId: "wbp-1", taskId: "task-9" };
    expect(resolve("programId", args)).toBe("Coastal Readiness Cell");
    expect(resolve("packageId", args)).toBe("Mobilization");
    expect(resolve("taskId", args)).toBe("Field kit audit");
  });

  it("returns null for unknown ids and unrelated keys", () => {
    expect(resolve("programId", { programId: "prog-x" })).toBeNull();
    expect(resolve("packageId", { programId: "prog-1", packageId: "wbp-x" })).toBeNull();
    expect(resolve("taskId", { programId: "prog-1", taskId: "task-x" })).toBeNull();
    expect(resolve("teamId", { programId: "prog-1", teamId: "team-1" })).toBeNull();
  });

  it("returns null when the args carry no known programId", () => {
    expect(resolve("packageId", { packageId: "wbp-1" })).toBeNull();
  });
});
