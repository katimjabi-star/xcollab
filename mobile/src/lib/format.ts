/** Display helpers ported from apps/web/lib/program-format.ts. */
import { swatches } from "../theme";
import type { Language, Program, Task } from "./types";

/** Generated names arrive as "Program: X" / "مشروع: X" — strip the prefix at
    render so titles carry the identity, not the type. */
export function programDisplayName(program: { name: string }): string {
  return (
    program.name.replace(/^\s*(program|project|مشروع|برنامج)\s*[:：]\s*/i, "").trim() ||
    program.name
  );
}

/** Stable per-project accent swatch: hash the id onto the 8-color palette —
    same hash as the web, so a project keeps its color across surfaces. */
export function programColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return swatches[hash % swatches.length] as string;
}

/** "2026-10-03" → "Oct 3, 2026" (locale-aware). */
export function formatIsoDate(iso: string, language: Language): string {
  const date = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat(language === "ar" ? "ar" : "en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

/** Roll-up status for a program: blocked > done > in progress > todo. */
export function programStatus(program: Program): Task["status"] {
  const tasks = program.packages.flatMap((pkg) => pkg.tasks);
  if (tasks.some((task) => task.status === "blocked")) return "blocked";
  if (tasks.length > 0 && tasks.every((task) => task.status === "done")) return "done";
  if (tasks.some((task) => task.status !== "todo")) return "in_progress";
  return "todo";
}

/** "jabbir" → "JA", "Demo User" → "DU" — web avatar initials. */
export function initials(nameOrUsername: string): string {
  const parts = nameOrUsername.trim().split(/\s+/);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return nameOrUsername.slice(0, 2).toUpperCase();
}
