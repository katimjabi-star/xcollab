import { describe, expect, it } from "vitest";
import {
  addDaysIso,
  bucketOf,
  bucketTasks,
  BUCKET_ORDER,
  formatDueRange,
  isDueOverdue,
  localTodayIso,
} from "../lib/my-tasks.ts";

const TODAY = "2026-08-20";

describe("bucketOf", () => {
  it("puts undated tasks in recentlyAssigned", () => {
    expect(bucketOf(undefined, TODAY)).toBe("recentlyAssigned");
  });

  it("puts a task due today in doToday", () => {
    expect(bucketOf(TODAY, TODAY)).toBe("doToday");
  });

  it("puts overdue tasks in doToday", () => {
    expect(bucketOf("2026-08-19", TODAY)).toBe("doToday");
    expect(bucketOf("2025-12-31", TODAY)).toBe("doToday");
  });

  it("puts tomorrow through today+7 in doNextWeek (inclusive boundary)", () => {
    expect(bucketOf("2026-08-21", TODAY)).toBe("doNextWeek");
    expect(bucketOf("2026-08-27", TODAY)).toBe("doNextWeek"); // exactly +7
  });

  it("puts today+8 and beyond in doLater", () => {
    expect(bucketOf("2026-08-28", TODAY)).toBe("doLater");
    expect(bucketOf("2027-01-01", TODAY)).toBe("doLater");
  });

  it("handles the +7 window across a month boundary", () => {
    expect(bucketOf("2026-09-02", "2026-08-30")).toBe("doNextWeek");
    expect(bucketOf("2026-09-07", "2026-08-30")).toBe("doLater");
  });
});

describe("addDaysIso / localTodayIso", () => {
  it("adds days across month ends", () => {
    expect(addDaysIso("2026-08-30", 7)).toBe("2026-09-06");
    expect(addDaysIso("2026-12-28", 7)).toBe("2027-01-04");
  });

  it("formats a local date as YYYY-MM-DD", () => {
    expect(localTodayIso(new Date(2026, 0, 5, 23, 30))).toBe("2026-01-05");
  });
});

describe("bucketTasks", () => {
  it("partitions into all four buckets, preserving order, empty buckets present", () => {
    const tasks = [
      { id: "a", dueDate: "2026-08-19" }, // overdue → doToday
      { id: "b" }, // no date → recentlyAssigned
      { id: "c", dueDate: TODAY }, // today → doToday
      { id: "d", dueDate: "2026-08-27" }, // +7 → doNextWeek
      { id: "e", dueDate: "2026-09-15" }, // → doLater
    ];
    const buckets = bucketTasks(tasks, TODAY);
    expect(Object.keys(buckets).sort()).toEqual([...BUCKET_ORDER].sort());
    expect(buckets.recentlyAssigned.map((t) => t.id)).toEqual(["b"]);
    expect(buckets.doToday.map((t) => t.id)).toEqual(["a", "c"]);
    expect(buckets.doNextWeek.map((t) => t.id)).toEqual(["d"]);
    expect(buckets.doLater.map((t) => t.id)).toEqual(["e"]);
  });

  it("yields four empty buckets for no tasks", () => {
    const buckets = bucketTasks([], TODAY);
    for (const id of BUCKET_ORDER) expect(buckets[id]).toEqual([]);
  });
});

describe("formatDueRange / isDueOverdue", () => {
  it("renders a single due date, substituting the today label", () => {
    expect(formatDueRange({ dueDate: "2026-08-24" }, TODAY, "en", "Today")).toBe("Aug 24, 2026");
    expect(formatDueRange({ dueDate: TODAY }, TODAY, "en", "Today")).toBe("Today");
  });

  it("renders a start–due range when startDate is set", () => {
    expect(
      formatDueRange({ startDate: TODAY, dueDate: "2026-08-24" }, TODAY, "en", "Today"),
    ).toBe("Today – Aug 24, 2026");
  });

  it("returns null when undated and collapses equal start/due", () => {
    expect(formatDueRange({}, TODAY, "en", "Today")).toBeNull();
    expect(formatDueRange({ startDate: TODAY, dueDate: TODAY }, TODAY, "en", "Today")).toBe(
      "Today",
    );
  });

  it("marks strictly-before-today as overdue, today as not", () => {
    expect(isDueOverdue("2026-08-19", TODAY)).toBe(true);
    expect(isDueOverdue(TODAY, TODAY)).toBe(false);
    expect(isDueOverdue(undefined, TODAY)).toBe(false);
  });
});
