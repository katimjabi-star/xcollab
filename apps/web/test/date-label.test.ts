import { describe, expect, it } from "vitest";
import { dateLabel, dayDiff, dueRangeLabel, dueTone, overdueDays } from "../lib/date-label.ts";

// 2026-08-24 is a Monday (fixed reference "today" for all cases).
const TODAY = "2026-08-24";

describe("dayDiff", () => {
  it("computes signed whole-day differences", () => {
    expect(dayDiff("2026-08-24", TODAY)).toBe(0);
    expect(dayDiff("2026-08-25", TODAY)).toBe(1);
    expect(dayDiff("2026-08-23", TODAY)).toBe(-1);
    expect(dayDiff("2027-08-24", TODAY)).toBe(365);
  });
});

describe("dateLabel (en)", () => {
  it("uses relative words for today, tomorrow, yesterday", () => {
    expect(dateLabel("2026-08-24", "en", TODAY)).toBe("Today");
    expect(dateLabel("2026-08-25", "en", TODAY)).toBe("Tomorrow");
    expect(dateLabel("2026-08-23", "en", TODAY)).toBe("Yesterday");
  });
  it("uses the weekday inside the next six days", () => {
    expect(dateLabel("2026-08-26", "en", TODAY)).toBe("Wednesday");
    expect(dateLabel("2026-08-30", "en", TODAY)).toBe("Sunday");
  });
  it("drops the year for current-year dates beyond the week", () => {
    expect(dateLabel("2026-08-31", "en", TODAY)).toBe("Aug 31");
    expect(dateLabel("2026-12-01", "en", TODAY)).toBe("Dec 1");
    expect(dateLabel("2026-01-05", "en", TODAY)).toBe("Jan 5");
  });
  it("keeps the year for other years", () => {
    expect(dateLabel("2025-08-21", "en", TODAY)).toBe("Aug 21, 2025");
    expect(dateLabel("2027-02-01", "en", TODAY)).toBe("Feb 1, 2027");
  });
  it("weekday window can cross a year boundary", () => {
    expect(dateLabel("2027-01-02", "en", "2026-12-30")).toBe("Saturday");
  });
});

describe("dateLabel (ar)", () => {
  it("uses Arabic relative words", () => {
    expect(dateLabel("2026-08-24", "ar", TODAY)).toBe("اليوم");
    expect(dateLabel("2026-08-25", "ar", TODAY)).toBe("غدًا");
    expect(dateLabel("2026-08-23", "ar", TODAY)).toBe("أمس");
  });
  it("formats weekday and month-day via the ar locale", () => {
    expect(dateLabel("2026-08-26", "ar", TODAY)).toBe("الأربعاء");
    expect(dateLabel("2026-08-31", "ar", TODAY)).toContain("أغسطس");
  });
});

describe("dueRangeLabel", () => {
  it("returns null without a due date and a single label without a range", () => {
    expect(dueRangeLabel({}, "en", TODAY)).toBeNull();
    expect(dueRangeLabel({ dueDate: "2026-08-25" }, "en", TODAY)).toBe("Tomorrow");
    expect(dueRangeLabel({ startDate: "2026-08-25", dueDate: "2026-08-25" }, "en", TODAY)).toBe(
      "Tomorrow",
    );
  });
  it("keeps relative words per endpoint", () => {
    expect(dueRangeLabel({ startDate: "2026-08-24", dueDate: "2026-09-04" }, "en", TODAY)).toBe(
      "Today – Sep 4",
    );
  });
  it("collapses absolute same-month current-year ranges to a day number", () => {
    expect(dueRangeLabel({ startDate: "2026-09-21", dueDate: "2026-09-25" }, "en", TODAY)).toBe(
      "Sep 21 – 25",
    );
  });
  it("does not collapse across months or years", () => {
    expect(dueRangeLabel({ startDate: "2026-09-28", dueDate: "2026-10-02" }, "en", TODAY)).toBe(
      "Sep 28 – Oct 2",
    );
    expect(dueRangeLabel({ startDate: "2027-09-21", dueDate: "2027-09-25" }, "en", TODAY)).toBe(
      "Sep 21, 2027 – Sep 25, 2027",
    );
  });
});

describe("dueTone", () => {
  it("marks incomplete past dates overdue and near dates soon", () => {
    expect(dueTone("2026-08-23", false, TODAY)).toBe("overdue");
    expect(dueTone("2026-08-24", false, TODAY)).toBe("soon");
    expect(dueTone("2026-08-25", false, TODAY)).toBe("soon");
    expect(dueTone("2026-08-26", false, TODAY)).toBe("neutral");
  });
  it("mutes completed tasks regardless of date, neutral without a date", () => {
    expect(dueTone("2026-08-01", true, TODAY)).toBe("muted");
    expect(dueTone(undefined, false, TODAY)).toBe("neutral");
  });
});

describe("overdueDays", () => {
  it("counts days past due, zero when not overdue", () => {
    expect(overdueDays("2026-08-21", TODAY)).toBe(3);
    expect(overdueDays("2026-08-24", TODAY)).toBe(0);
    expect(overdueDays("2026-08-30", TODAY)).toBe(0);
  });
});
