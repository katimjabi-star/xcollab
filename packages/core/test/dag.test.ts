import { describe, expect, it } from "vitest";
import { findDependencyCycle } from "../src/index.ts";

const pkg = (id: string, dependsOn: string[]) => ({ id, dependsOn });

describe("findDependencyCycle", () => {
  it("returns null for an empty graph", () => {
    expect(findDependencyCycle([])).toBeNull();
  });

  it("returns null for a valid chain", () => {
    expect(
      findDependencyCycle([pkg("a", []), pkg("b", ["a"]), pkg("c", ["b"])]),
    ).toBeNull();
  });

  it("returns null for a diamond (shared dependency, no cycle)", () => {
    expect(
      findDependencyCycle([
        pkg("a", []),
        pkg("b", ["a"]),
        pkg("c", ["a"]),
        pkg("d", ["b", "c"]),
      ]),
    ).toBeNull();
  });

  it("detects a direct two-node cycle", () => {
    const cycle = findDependencyCycle([pkg("a", ["b"]), pkg("b", ["a"])]);
    expect(cycle).not.toBeNull();
    expect(cycle).toContain("a");
    expect(cycle).toContain("b");
  });

  it("detects a self-dependency", () => {
    expect(findDependencyCycle([pkg("a", ["a"])])).toEqual(["a", "a"]);
  });

  it("detects a deep cycle", () => {
    const cycle = findDependencyCycle([
      pkg("a", []),
      pkg("b", ["a", "d"]),
      pkg("c", ["b"]),
      pkg("d", ["c"]),
    ]);
    expect(cycle).not.toBeNull();
  });
});
