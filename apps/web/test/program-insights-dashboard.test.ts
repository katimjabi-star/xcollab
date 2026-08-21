import { describe, expect, it } from "vitest";
import type { Program, Task, WorkPackage } from "@xcollab/core";
import {
  completionSeries,
  dashboardStats,
  donutSegments,
  sectionCounts,
  type CompletionEvent,
} from "../lib/program-insights.ts";

const TODAY = "2026-08-20";
const PROGRAM_ID = "prog-1";

function task(overrides: Partial<Task> & { id: string }): Task {
  return {
    id: overrides.id,
    name: overrides.name ?? `Task ${overrides.id}`,
    status: overrides.status ?? "todo",
    estimateDays: 1,
    ...(overrides.dueDate ? { dueDate: overrides.dueDate } : {}),
  };
}

function pkg(id: string, name: string, tasks: Task[]): WorkPackage {
  return { id, name, scope: "s", dependsOn: [], tasks };
}

/** Two-section fixture mirroring the computeInsights one: a1 done (past due),
    a2/b1 open past due, a3 due later, b2 undated. */
function program(packages?: WorkPackage[]): Program {
  return {
    id: PROGRAM_ID,
    name: "Field Logistics",
    mission: "Stand up hubs",
    language: "en",
    timeline: { start: "2026-06-01", end: "2026-12-31" },
    teams: [{ id: "team-1", name: "Ops", kind: "internal" }],
    packages: packages ?? [
      pkg("pkg-1", "Alpha", [
        task({ id: "a1", status: "done", dueDate: "2026-08-01" }),
        task({ id: "a2", status: "in_progress", dueDate: "2026-08-18" }),
        task({ id: "a3", status: "todo", dueDate: "2026-08-22" }),
      ]),
      pkg("pkg-2", "Bravo", [task({ id: "b1", status: "blocked", dueDate: "2026-08-10" }), task({ id: "b2" })]),
    ],
    milestones: [],
    risks: [],
  };
}

describe("dashboardStats: widget stat cards", () => {
  it("counts completed / incomplete / overdue / total across all packages", () => {
    // 5 tasks: a1 done; b1 (08-10) and a2 (08-18) open before today → overdue.
    expect(dashboardStats(program(), TODAY)).toEqual({
      completed: 1,
      incomplete: 4,
      overdue: 2,
      total: 5,
    });
  });

  it("a done task past its due date is completed, never overdue", () => {
    const p = program([pkg("pkg-1", "Alpha", [task({ id: "t1", status: "done", dueDate: "2026-08-01" })])]);
    expect(dashboardStats(p, TODAY)).toEqual({ completed: 1, incomplete: 0, overdue: 0, total: 1 });
  });

  it("a task due today is incomplete but not overdue", () => {
    const p = program([pkg("pkg-1", "Alpha", [task({ id: "t1", dueDate: TODAY })])]);
    expect(dashboardStats(p, TODAY)).toEqual({ completed: 0, incomplete: 1, overdue: 0, total: 1 });
  });
});

describe("donutSegments: completion-status donut", () => {
  it("orders done → in_progress → todo → blocked with count/total fractions", () => {
    expect(donutSegments({ todo: 2, in_progress: 1, blocked: 1, done: 4 })).toEqual({
      total: 8,
      segments: [
        { status: "done", count: 4, fraction: 0.5 },
        { status: "in_progress", count: 1, fraction: 0.125 },
        { status: "todo", count: 2, fraction: 0.25 },
        { status: "blocked", count: 1, fraction: 0.125 },
      ],
    });
  });

  it("omits zero-count statuses so no zero-length arcs render", () => {
    const donut = donutSegments({ todo: 0, in_progress: 0, blocked: 0, done: 3 });
    expect(donut.segments).toEqual([{ status: "done", count: 3, fraction: 1 }]);
  });

  it("an empty program yields total 0 and no segments", () => {
    expect(donutSegments({ todo: 0, in_progress: 0, blocked: 0, done: 0 })).toEqual({
      total: 0,
      segments: [],
    });
  });
});

describe("sectionCounts: tasks-by-section bars", () => {
  it("returns one datum per package in program order", () => {
    expect(sectionCounts(program())).toEqual([
      { id: "pkg-1", name: "Alpha", count: 3 },
      { id: "pkg-2", name: "Bravo", count: 2 },
    ]);
  });
});

describe("completionSeries: daily done-transitions from the ledger", () => {
  const event = (overrides: Partial<CompletionEvent>): CompletionEvent => ({
    action: "task.status_update",
    input: JSON.stringify({ programId: PROGRAM_ID, taskId: "a1", from: "todo", to: "done" }),
    occurredAt: "2026-08-19T10:00:00.000Z",
    ...overrides,
  });

  it("zero-fills the trailing window when there are no entries", () => {
    expect(completionSeries([], PROGRAM_ID, TODAY, 3)).toEqual([
      { date: "2026-08-18", count: 0 },
      { date: "2026-08-19", count: 0 },
      { date: "2026-08-20", count: 0 },
    ]);
  });

  it("defaults to an 11-day window ending today, oldest first", () => {
    const series = completionSeries([], PROGRAM_ID, TODAY);
    expect(series).toHaveLength(11);
    expect(series[0]?.date).toBe("2026-08-10");
    expect(series[10]?.date).toBe(TODAY);
  });

  it("counts status_update→done and task.update with changes.status.to=done", () => {
    const entries = [
      event({}),
      event({ occurredAt: "2026-08-19T15:30:00.000Z" }),
      event({
        action: "task.update",
        input: JSON.stringify({
          programId: PROGRAM_ID,
          taskId: "a2",
          changes: { status: { from: "todo", to: "done" }, name: { from: "x", to: "y" } },
        }),
        occurredAt: "2026-08-20T08:00:00.000Z",
      }),
    ];
    expect(completionSeries(entries, PROGRAM_ID, TODAY, 3)).toEqual([
      { date: "2026-08-18", count: 0 },
      { date: "2026-08-19", count: 2 },
      { date: "2026-08-20", count: 1 },
    ]);
  });

  it("ignores other programs, non-done moves, other actions, out-of-window days and malformed input", () => {
    const entries = [
      event({ input: JSON.stringify({ programId: "other", to: "done" }) }),
      event({ input: JSON.stringify({ programId: PROGRAM_ID, from: "done", to: "todo" }) }),
      event({ action: "task.create" }),
      event({ occurredAt: "2026-08-01T00:00:00.000Z" }),
      event({ input: "{not json" }),
    ];
    expect(completionSeries(entries, PROGRAM_ID, TODAY, 2)).toEqual([
      { date: "2026-08-19", count: 0 },
      { date: "2026-08-20", count: 0 },
    ]);
  });
});
