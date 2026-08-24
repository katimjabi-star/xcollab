import { describe, expect, it } from "vitest";
import type { Program } from "@xcollab/core";
import { projectsIndex } from "../src/assistant-reads.ts";

function fakeProgram(i: number, taskCount: number): Program {
  return {
    id: `prog-${i}`,
    name: `Project number ${i} with a reasonably long descriptive name`,
    language: "en",
    packages: [
      {
        id: "wbp-1",
        name: "Discovery & Requirements",
        tasks: Array.from({ length: taskCount }, (_, t) => ({
          id: `task-${i}-${t}`,
          name: `A descriptive task name number ${t} for project ${i}`,
          status: "todo",
        })),
      },
    ],
  } as unknown as Program;
}

describe("projectsIndex digest", () => {
  it("keeps full outlines (with tasks) when they fit the budget", () => {
    const index = projectsIndex([fakeProgram(1, 3), fakeProgram(2, 3)]);
    expect(index).toHaveLength(2);
    const first = index[0] as { packages: { tasks: unknown[] }[] };
    expect(first.packages[0]?.tasks).toHaveLength(3);
  });

  it("keeps EVERY project resolvable when full outlines overflow the budget", () => {
    const programs = Array.from({ length: 40 }, (_, i) => fakeProgram(i, 12));
    expect(JSON.stringify(programs.map((p) => p)).length).toBeGreaterThan(8_000);
    const index = projectsIndex(programs);
    // Lean mode: all 40 projects present, names intact, no task lists.
    expect(index).toHaveLength(40);
    const last = index[39] as { name: string; packages: { tasks?: unknown }[] };
    expect(last.name).toContain("Project number 39");
    expect(last.packages[0]?.tasks).toBeUndefined();
    expect(JSON.stringify(index).length).toBeLessThanOrEqual(8_192);
  });
});
