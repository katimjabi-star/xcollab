import type { Program, Task } from "@xcollab/core";

/** "2026-10-03" → "Oct 3, 2026" (locale-aware); ISO stays in tooltips only.
    Program language drives the locale — timelines render inside program-dir
    content. Invalid/empty input falls back to the raw string. */
export function formatIsoDate(iso: string, language: Program["language"]): string {
  const date = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat(language === "ar" ? "ar" : "en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

/** Generated names arrive as "Program: X" / "مشروع: X" — strip the prefix at
    render so titles carry the identity, not the type (audit §global-3). */
export function programDisplayName(program: { name: string }): string {
  return (
    program.name.replace(/^\s*(program|project|مشروع|برنامج)\s*[:：]\s*/i, "").trim() ||
    program.name
  );
}

/** Roll-up status for a program: blocked > done > in progress > todo. */
export function programStatus(program: Program): Task["status"] {
  const tasks = program.packages.flatMap((pkg) => pkg.tasks);
  if (tasks.some((task) => task.status === "blocked")) return "blocked";
  if (tasks.length > 0 && tasks.every((task) => task.status === "done")) return "done";
  if (tasks.some((task) => task.status !== "todo")) return "in_progress";
  return "todo";
}
