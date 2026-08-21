import { describe, expect, it } from "vitest";
import type { Program, Task } from "@xcollab/core";
import { computeInsights } from "../lib/program-insights.ts";

const TODAY = "2026-08-20";

function task(overrides: Partial<Task> & { id: string }): Task {
  return {
    id: overrides.id,
    name: overrides.name ?? `Task ${overrides.id}`,
    status: overrides.status ?? "todo",
    estimateDays: overrides.estimateDays ?? 1,
    ...(overrides.assigneeRole ? { assigneeRole: overrides.assigneeRole } : {}),
    ...(overrides.assignee ? { assignee: overrides.assignee } : {}),
    ...(overrides.startDate ? { startDate: overrides.startDate } : {}),
    ...(overrides.dueDate ? { dueDate: overrides.dueDate } : {}),
  };
}

function program(overrides: Partial<Program> = {}): Program {
  return {
    id: "prog-1",
    name: "Field Logistics",
    mission: "Stand up hubs",
    language: "en",
    timeline: { start: "2026-06-01", end: "2026-12-31" },
    teams: [{ id: "team-1", name: "Ops", kind: "internal" }],
    packages: [
      {
        id: "pkg-1",
        name: "Alpha",
        scope: "Foundations",
        dependsOn: [],
        tasks: [
          task({ id: "a1", status: "done", assignee: "jdoe", dueDate: "2026-08-01" }),
          task({ id: "a2", status: "in_progress", assignee: "jdoe", dueDate: "2026-08-18" }),
          task({ id: "a3", status: "todo", assignee: "asmith", dueDate: "2026-08-22" }),
        ],
      },
      {
        id: "pkg-2",
        name: "Bravo",
        scope: "Rollout",
        dependsOn: ["pkg-1"],
        tasks: [
          task({ id: "b1", status: "blocked", dueDate: "2026-08-10" }),
          task({ id: "b2", status: "todo" }),
        ],
      },
    ],
    milestones: [
      { id: "ms-1", name: "Kickoff", dueDate: "2026-06-15" },
      { id: "ms-2", name: "Mid review", dueDate: "2026-08-24" },
      { id: "ms-3", name: "Handover", dueDate: "2026-12-01" },
    ],
    risks: [
      { id: "r1", title: "Supply delay", severity: "high" },
      { id: "r2", title: "Budget drift", severity: "high" },
      { id: "r3", title: "Vendor exit", severity: "critical" },
    ],
    ...overrides,
  };
}

describe("computeInsights: completion + per-package progress", () => {
  it("computes overall completion as rounded done/total percent", () => {
    // 1 done of 5 tasks → 20%
    expect(computeInsights(program(), TODAY).completionPct).toBe(20);
  });

  it("rounds completion to the nearest integer", () => {
    const p = program({
      packages: [
        {
          id: "pkg-1",
          name: "Alpha",
          scope: "s",
          dependsOn: [],
          tasks: [task({ id: "t1", status: "done" }), task({ id: "t2" }), task({ id: "t3" })],
        },
      ],
    });
    expect(computeInsights(p, TODAY).completionPct).toBe(33);
  });

  it("reports per-package done/total/pct in program package order", () => {
    expect(computeInsights(program(), TODAY).perPackage).toEqual([
      { id: "pkg-1", name: "Alpha", done: 1, total: 3, pct: 33 },
      { id: "pkg-2", name: "Bravo", done: 0, total: 2, pct: 0 },
    ]);
  });
});

describe("computeInsights: status counts", () => {
  it("counts every status, including zeroes", () => {
    expect(computeInsights(program(), TODAY).statusCounts).toEqual({
      todo: 2,
      in_progress: 1,
      blocked: 1,
      done: 1,
    });
  });
});

describe("computeInsights: overdue + due this week", () => {
  it("overdue = dated strictly before today and not done, sorted by dueDate ascending", () => {
    const ids = computeInsights(program(), TODAY).overdueTasks.map((t) => t.id);
    // a1 is done (excluded); b1 (08-10) before a2 (08-18); a3/b2 not overdue.
    expect(ids).toEqual(["b1", "a2"]);
  });

  it("a task due today is not overdue", () => {
    const p = program({
      packages: [
        {
          id: "pkg-1",
          name: "Alpha",
          scope: "s",
          dependsOn: [],
          tasks: [task({ id: "t1", dueDate: TODAY })],
        },
      ],
    });
    expect(computeInsights(p, TODAY).overdueTasks).toEqual([]);
  });

  it("dueThisWeek = open tasks due today..today+7 inclusive, sorted ascending", () => {
    const p = program({
      packages: [
        {
          id: "pkg-1",
          name: "Alpha",
          scope: "s",
          dependsOn: [],
          tasks: [
            task({ id: "past", dueDate: "2026-08-19" }),
            task({ id: "edge", dueDate: "2026-08-27" }),
            task({ id: "today", dueDate: "2026-08-20" }),
            task({ id: "beyond", dueDate: "2026-08-28" }),
            task({ id: "done", status: "done", dueDate: "2026-08-21" }),
            task({ id: "undated" }),
          ],
        },
      ],
    });
    const ids = computeInsights(p, TODAY).dueThisWeek.map((t) => t.id);
    expect(ids).toEqual(["today", "edge"]);
  });

  it("handles the week window across a month boundary", () => {
    const p = program({
      packages: [
        {
          id: "pkg-1",
          name: "Alpha",
          scope: "s",
          dependsOn: [],
          tasks: [task({ id: "sept", dueDate: "2026-09-03" })],
        },
      ],
    });
    expect(computeInsights(p, "2026-08-28").dueThisWeek.map((t) => t.id)).toEqual(["sept"]);
  });
});

describe("computeInsights: assignee load", () => {
  it("buckets unassigned tasks last and sorts assignees by open desc, done desc", () => {
    expect(computeInsights(program(), TODAY).assigneeLoad).toEqual([
      { assignee: "jdoe", open: 1, done: 1 },
      { assignee: "asmith", open: 1, done: 0 },
      { assignee: null, open: 2, done: 0 },
    ]);
  });

  it("ties on open break by done desc, then name ascending", () => {
    const p = program({
      packages: [
        {
          id: "pkg-1",
          name: "Alpha",
          scope: "s",
          dependsOn: [],
          tasks: [
            task({ id: "t1", assignee: "zed" }),
            task({ id: "t2", assignee: "amy" }),
            task({ id: "t3", assignee: "amy", status: "done" }),
          ],
        },
      ],
    });
    expect(computeInsights(p, TODAY).assigneeLoad).toEqual([
      { assignee: "amy", open: 1, done: 1 },
      { assignee: "zed", open: 1, done: 0 },
    ]);
  });
});

describe("computeInsights: milestone health", () => {
  it("classifies past (< today), done-window (today..today+7) and upcoming (later)", () => {
    expect(computeInsights(program(), TODAY).milestoneHealth).toEqual([
      { id: "ms-1", name: "Kickoff", dueDate: "2026-06-15", state: "past" },
      { id: "ms-2", name: "Mid review", dueDate: "2026-08-24", state: "done-window" },
      { id: "ms-3", name: "Handover", dueDate: "2026-12-01", state: "upcoming" },
    ]);
  });

  it("a milestone due today is in the window, not past", () => {
    const p = program({ milestones: [{ id: "m", name: "Today", dueDate: TODAY }] });
    expect(computeInsights(p, TODAY).milestoneHealth[0]?.state).toBe("done-window");
  });
});

describe("computeInsights: risk counts", () => {
  it("counts risks by severity with zeroes for unused severities", () => {
    expect(computeInsights(program(), TODAY).riskCounts).toEqual({
      low: 0,
      medium: 0,
      high: 2,
      critical: 1,
    });
  });

  it("returns all-zero counts when there are no risks", () => {
    const p = program({ risks: [] });
    expect(computeInsights(p, TODAY).riskCounts).toEqual({
      low: 0,
      medium: 0,
      high: 0,
      critical: 0,
    });
  });
});
/* Dashboard widget calculators are covered in program-insights-dashboard.test.ts
   (kept separate to honor the 300-line lint cap). */

