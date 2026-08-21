import { describe, expect, it } from "vitest";
import {
  addMonths,
  addWeeks,
  dayIndex,
  firstWeekday,
  isoFromIndex,
  itemSpan,
  layoutWeek,
  monthGrid,
  monthTitle,
  weekdayNames,
  weeksGrid,
} from "../lib/calendar.ts";

describe("day ordinals", () => {
  it("round-trips ISO dates", () => {
    expect(isoFromIndex(dayIndex("2026-08-20"))).toBe("2026-08-20");
    expect(dayIndex("2026-08-21") - dayIndex("2026-08-20")).toBe(1);
  });
});

describe("monthGrid", () => {
  it("pads August 2026 (starts Saturday) to full Sunday-first weeks", () => {
    const weeks = monthGrid("2026-08-01", "en");
    expect(weeks).toHaveLength(6);
    expect(weeks.every((w) => w.length === 7)).toBe(true);
    expect(weeks[0]?.[0]).toEqual({ iso: "2026-07-26", dayOfMonth: 26, inMonth: false });
    expect(weeks[0]?.[6]).toEqual({ iso: "2026-08-01", dayOfMonth: 1, inMonth: true });
    expect(weeks[5]?.[6]).toEqual({ iso: "2026-09-05", dayOfMonth: 5, inMonth: false });
  });

  it("February 2026 fits exactly four weeks with no padding", () => {
    const weeks = monthGrid("2026-02-01", "en");
    expect(weeks).toHaveLength(4);
    expect(weeks.flat().every((c) => c.inMonth)).toBe(true);
    expect(weeks[0]?.[0]?.iso).toBe("2026-02-01");
    expect(weeks[3]?.[6]?.iso).toBe("2026-02-28");
  });

  it("Arabic grid starts weeks on Saturday", () => {
    const weeks = monthGrid("2026-08-01", "ar");
    expect(weeks).toHaveLength(5);
    // Aug 1 2026 is a Saturday → no leading cells at all.
    expect(weeks[0]?.[0]).toEqual({ iso: "2026-08-01", dayOfMonth: 1, inMonth: true });
    expect(weeks[4]?.[6]?.iso).toBe("2026-09-04");
  });
});

describe("weekday order", () => {
  it("is SUN..SAT in English and starts السبت in Arabic", () => {
    expect(firstWeekday("en")).toBe(0);
    expect(firstWeekday("ar")).toBe(6);
    expect(weekdayNames("en")).toEqual(["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]);
    const ar = weekdayNames("ar");
    expect(ar).toHaveLength(7);
    expect(ar[0]).toBe("السبت");
    expect(ar[6]).toBe("الجمعة");
  });
});

describe("weeksGrid", () => {
  it("returns the anchor week plus the next three", () => {
    const weeks = weeksGrid("2026-08-20", "en", 4);
    expect(weeks).toHaveLength(4);
    expect(weeks[0]?.[0]?.iso).toBe("2026-08-16"); // Sunday of the anchor week
    expect(weeks[3]?.[6]?.iso).toBe("2026-09-12");
    expect(weeks.flat().every((c) => c.inMonth)).toBe(true);
  });
});

describe("anchor stepping", () => {
  it("addMonths crosses year edges to the first of month", () => {
    expect(addMonths("2026-12-15", 1)).toBe("2027-01-01");
    expect(addMonths("2026-01-05", -1)).toBe("2025-12-01");
  });

  it("addWeeks steps exactly seven days", () => {
    expect(addWeeks("2026-08-20", 1)).toBe("2026-08-27");
    expect(addWeeks("2026-08-20", -1)).toBe("2026-08-13");
  });

  it("monthTitle localizes month + year", () => {
    expect(monthTitle("2026-08-01", "en")).toBe("August 2026");
    expect(monthTitle("2026-08-01", "ar")).toContain("أغسطس");
    expect(monthTitle("2026-08-01", "ar")).toMatch(/2026|٢٠٢٦/);
  });
});

describe("itemSpan", () => {
  it("spans start→due, single-dates one day, drops undated", () => {
    expect(itemSpan("a", "2026-08-20", "2026-08-25")).toEqual({
      id: "a",
      startIdx: dayIndex("2026-08-20"),
      endIdx: dayIndex("2026-08-25"),
    });
    expect(itemSpan("b", undefined, "2026-08-20")?.endIdx).toBe(dayIndex("2026-08-20"));
    expect(itemSpan("b", undefined, "2026-08-20")?.startIdx).toBe(dayIndex("2026-08-20"));
    expect(itemSpan("c")).toBeNull();
    // Inverted range clamps to a 1-day bar at the start date.
    expect(itemSpan("d", "2026-08-20", "2026-08-01")?.endIdx).toBe(dayIndex("2026-08-20"));
  });
});

describe("layoutWeek", () => {
  const week = dayIndex("2026-08-16"); // Sunday-first week SUN 16 .. SAT 22

  it("splits a span across the week boundary with continuation flags", () => {
    const spans = [
      { id: "a", startIdx: dayIndex("2026-08-20"), endIdx: dayIndex("2026-08-25") },
    ];
    const first = layoutWeek(week, spans);
    expect(first).toEqual([
      { id: "a", startCol: 4, endCol: 6, lane: 0, continuesBefore: false, continuesAfter: true },
    ]);
    const second = layoutWeek(week + 7, spans);
    expect(second).toEqual([
      { id: "a", startCol: 0, endCol: 2, lane: 0, continuesBefore: true, continuesAfter: false },
    ]);
  });

  it("stacks overlapping bars into lanes and reuses free lanes", () => {
    const segs = layoutWeek(week, [
      { id: "a", startIdx: week, endIdx: week + 2 },
      { id: "b", startIdx: week + 1, endIdx: week + 3 },
      { id: "c", startIdx: week + 4, endIdx: week + 5 }, // fits back into lane 0
    ]);
    const lanes = Object.fromEntries(segs.map((s) => [s.id, s.lane]));
    expect(lanes).toEqual({ a: 0, b: 1, c: 0 });
  });

  it("excludes spans that never touch the week", () => {
    expect(layoutWeek(week, [{ id: "x", startIdx: week + 9, endIdx: week + 10 }])).toEqual([]);
    expect(layoutWeek(week, [{ id: "y", startIdx: week - 3, endIdx: week - 1 }])).toEqual([]);
  });
});
