import { describe, expect, it } from "vitest";
import type { Task } from "@xcollab/core";
import {
  filterTasks,
  parseBoardQuery,
  serializeBoardQuery,
  sortTasks,
  type BoardCard,
  type BoardFilter,
} from "../lib/board-filter.ts";

const NO_FILTER: BoardFilter = { query: "", packageId: null, role: null, assignee: null, due: null };

function card(overrides: Partial<Task> & { id: string }, pkg = "pkg-1", pkgName = "Alpha"): BoardCard {
  const task: Task = {
    id: overrides.id,
    name: overrides.name ?? `Task ${overrides.id}`,
    status: overrides.status ?? "todo",
    estimateDays: overrides.estimateDays ?? 1,
    ...(overrides.assigneeRole ? { assigneeRole: overrides.assigneeRole } : {}),
    ...(overrides.assignee ? { assignee: overrides.assignee } : {}),
    ...(overrides.dueDate ? { dueDate: overrides.dueDate } : {}),
  };
  return { task, packageId: pkg, packageName: pkgName };
}

const TODAY = "2026-08-20";

describe("filterTasks", () => {
  it("returns all cards for the empty filter", () => {
    const cards = [card({ id: "a" }), card({ id: "b" })];
    expect(filterTasks(cards, NO_FILTER, TODAY)).toEqual(cards);
  });

  it("matches the query case-insensitively against the task name", () => {
    const cards = [
      card({ id: "a", name: "Provision network" }),
      card({ id: "b", name: "Draft charter" }),
    ];
    expect(filterTasks(cards, { ...NO_FILTER, query: "NETWORK" }, TODAY).map((c) => c.task.id)).toEqual(["a"]);
    expect(filterTasks(cards, { ...NO_FILTER, query: "  charter " }, TODAY).map((c) => c.task.id)).toEqual(["b"]);
  });

  it("filters by package id", () => {
    const cards = [card({ id: "a" }, "pkg-1"), card({ id: "b" }, "pkg-2")];
    expect(filterTasks(cards, { ...NO_FILTER, packageId: "pkg-2" }, TODAY).map((c) => c.task.id)).toEqual(["b"]);
  });

  it("filters by assignee role; cards without a role never match a role filter", () => {
    const cards = [card({ id: "a", assigneeRole: "Engineer" }), card({ id: "b" })];
    expect(filterTasks(cards, { ...NO_FILTER, role: "Engineer" }, TODAY).map((c) => c.task.id)).toEqual(["a"]);
    expect(filterTasks(cards, { ...NO_FILTER, role: "Analyst" }, TODAY)).toEqual([]);
  });

  it("overdue = dated strictly before today (due today is not overdue)", () => {
    const cards = [
      card({ id: "past", dueDate: "2026-08-19" }),
      card({ id: "today", dueDate: "2026-08-20" }),
      card({ id: "future", dueDate: "2026-08-21" }),
      card({ id: "undated" }),
    ];
    expect(filterTasks(cards, { ...NO_FILTER, due: "overdue" }, TODAY).map((c) => c.task.id)).toEqual(["past"]);
  });

  it("thisWeek = today through today+7 inclusive, across month boundaries", () => {
    const cards = [
      card({ id: "past", dueDate: "2026-08-27" }),
      card({ id: "today", dueDate: "2026-08-28" }),
      card({ id: "edge", dueDate: "2026-09-04" }),
      card({ id: "beyond", dueDate: "2026-09-05" }),
      card({ id: "undated" }),
    ];
    const ids = filterTasks(cards, { ...NO_FILTER, due: "thisWeek" }, "2026-08-28").map((c) => c.task.id);
    expect(ids).toEqual(["today", "edge"]);
  });

  it("noDate keeps only undated cards", () => {
    const cards = [card({ id: "a", dueDate: "2026-08-25" }), card({ id: "b" })];
    expect(filterTasks(cards, { ...NO_FILTER, due: "noDate" }, TODAY).map((c) => c.task.id)).toEqual(["b"]);
  });

  it("filters by assignee with an exact username match; unassigned cards never match", () => {
    const cards = [
      card({ id: "a", assignee: "jdoe" }),
      card({ id: "b", assignee: "jdoe2" }),
      card({ id: "c" }),
    ];
    expect(filterTasks(cards, { ...NO_FILTER, assignee: "jdoe" }, TODAY).map((c) => c.task.id)).toEqual(["a"]);
    expect(filterTasks(cards, { ...NO_FILTER, assignee: "JDOE" }, TODAY)).toEqual([]);
    expect(filterTasks(cards, { ...NO_FILTER, assignee: "nobody" }, TODAY)).toEqual([]);
  });

  it("ANDs all active dimensions together", () => {
    const cards = [
      card({ id: "hit", name: "Deploy hub", assigneeRole: "Engineer", assignee: "jdoe", dueDate: "2026-08-10" }, "pkg-2"),
      card({ id: "wrong-pkg", name: "Deploy hub", assigneeRole: "Engineer", assignee: "jdoe", dueDate: "2026-08-10" }, "pkg-1"),
      card({ id: "not-overdue", name: "Deploy hub", assigneeRole: "Engineer", assignee: "jdoe", dueDate: "2026-08-25" }, "pkg-2"),
      card({ id: "wrong-user", name: "Deploy hub", assigneeRole: "Engineer", assignee: "asmith", dueDate: "2026-08-10" }, "pkg-2"),
    ];
    const ids = filterTasks(
      cards,
      { query: "deploy", packageId: "pkg-2", role: "Engineer", assignee: "jdoe", due: "overdue" },
      TODAY,
    ).map((c) => c.task.id);
    expect(ids).toEqual(["hit"]);
  });
});

describe("sortTasks", () => {
  it("default keeps the incoming order and does not mutate the input", () => {
    const cards = [card({ id: "b" }), card({ id: "a" })];
    const out = sortTasks(cards, "default");
    expect(out.map((c) => c.task.id)).toEqual(["b", "a"]);
    expect(out).not.toBe(cards);
  });

  it("dueDate sorts ascending (overdue/earliest first) with undated last, stable within ties", () => {
    const cards = [
      card({ id: "none-1" }),
      card({ id: "late", dueDate: "2026-09-10" }),
      card({ id: "tie-1", dueDate: "2026-08-01" }),
      card({ id: "none-2" }),
      card({ id: "tie-2", dueDate: "2026-08-01" }),
    ];
    expect(sortTasks(cards, "dueDate").map((c) => c.task.id)).toEqual([
      "tie-1",
      "tie-2",
      "late",
      "none-1",
      "none-2",
    ]);
  });

  it("name sorts alphabetically", () => {
    const cards = [card({ id: "1", name: "delta" }), card({ id: "2", name: "Alpha" }), card({ id: "3", name: "charlie" })];
    expect(sortTasks(cards, "name").map((c) => c.task.name)).toEqual(["Alpha", "charlie", "delta"]);
  });

  it("estimate sorts ascending, stable within ties", () => {
    const cards = [
      card({ id: "big", estimateDays: 8 }),
      card({ id: "small-1", estimateDays: 2 }),
      card({ id: "small-2", estimateDays: 2 }),
    ];
    expect(sortTasks(cards, "estimate").map((c) => c.task.id)).toEqual(["small-1", "small-2", "big"]);
  });
});

describe("URL query round-trip", () => {
  it("parses defaults from an empty query", () => {
    const { filter, sort } = parseBoardQuery(new URLSearchParams());
    expect(filter).toEqual(NO_FILTER);
    expect(sort).toBe("default");
  });

  it("parses valid values and rejects unknown due/sort tokens", () => {
    const ok = parseBoardQuery(
      new URLSearchParams("q=hub&pkg=pkg-1&role=Engineer&assignee=jdoe&due=thisWeek&sort=estimate"),
    );
    expect(ok.filter).toEqual({
      query: "hub",
      packageId: "pkg-1",
      role: "Engineer",
      assignee: "jdoe",
      due: "thisWeek",
    });
    expect(ok.sort).toBe("estimate");

    const bad = parseBoardQuery(new URLSearchParams("due=someday&sort=chaos"));
    expect(bad.filter.due).toBeNull();
    expect(bad.filter.assignee).toBeNull();
    expect(bad.sort).toBe("default");
  });

  it("serializes only non-default values and round-trips", () => {
    expect(serializeBoardQuery(NO_FILTER, "default").toString()).toBe("");
    const filter: BoardFilter = { query: "hub", packageId: "pkg-1", role: null, assignee: "jdoe", due: "overdue" };
    const params = serializeBoardQuery(filter, "name");
    expect(params.get("assignee")).toBe("jdoe");
    const back = parseBoardQuery(params);
    expect(back.filter).toEqual(filter);
    expect(back.sort).toBe("name");
  });
});
