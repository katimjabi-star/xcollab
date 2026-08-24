import type { ParsedIntent } from "./deterministic-intent.ts";

/**
 * Collaboration-intent grammar (delete task/project, team membership,
 * subtasks) for the deterministic EN/AR parser — split out of
 * deterministic-intent.ts to keep both files under the repo's max-lines
 * budget. These rule tables run BEFORE the base tables: the AR subtask rule
 * must win over the AR create_task rule ("أضف مهمة فرعية…" would otherwise
 * parse as a task named "فرعية …").
 */

export type Rule = {
  pattern: RegExp;
  build: (m: RegExpExecArray, today: string) => ParsedIntent | undefined;
};

/** Delimiter pairs the grammar tolerates around a quoted name/ref span. */
const QUOTE_PAIRS: ReadonlyArray<readonly [string, string]> = [
  ['"', '"'],
  ["“", "”"], // “ ”
  ["«", "»"], // « »
];

/** Strips a single matching pair of delimiting quotes captured by the
    grammar (e.g. `"P1"` → `P1`); inner quotes that are part of the name
    survive since only the outermost delimiter pair is removed. */
export function stripQuotes(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length < 2) return trimmed;
  const first = trimmed[0];
  const last = trimmed[trimmed.length - 1];
  const isQuoted = QUOTE_PAIRS.some(([open, close]) => open === first && close === last);
  return isQuoted ? trimmed.slice(1, -1).trim() : trimmed;
}

function optionalRef(value: string | undefined): { projectRef?: string } {
  return value === undefined ? {} : { projectRef: stripQuotes(value) };
}

export const EN_COLLAB_RULES: Rule[] = [
  {
    pattern: /^add\s+(\S+)\s+to\s+(?:the\s+)?team\s+(.+)$/i,
    build: (m) => ({
      kind: "team_member",
      op: "add",
      username: m[1] ?? "",
      teamRef: stripQuotes(m[2] ?? ""),
    }),
  },
  {
    pattern: /^remove\s+(\S+)\s+from\s+(?:the\s+)?team\s+(.+)$/i,
    build: (m) => ({
      kind: "team_member",
      op: "remove",
      username: m[1] ?? "",
      teamRef: stripQuotes(m[2] ?? ""),
    }),
  },
  {
    pattern: /^add\s+(?:a\s+)?subtask\s+(.+?)\s+to\s+(?:task\s+)?(.+?)(?:\s+in\s+(?:project\s+)?(.+))?$/i,
    build: (m) => ({
      kind: "add_subtask",
      name: stripQuotes(m[1] ?? ""),
      taskRef: stripQuotes(m[2] ?? ""),
      ...optionalRef(m[3]),
    }),
  },
  {
    pattern: /^(?:delete|remove)\s+(?:the\s+)?task\s+(.+?)(?:\s+in\s+(?:project\s+)?(.+))?$/i,
    build: (m) => ({
      kind: "delete_task",
      taskRef: stripQuotes(m[1] ?? ""),
      ...optionalRef(m[2]),
    }),
  },
  {
    pattern: /^(?:delete|remove)\s+(?:the\s+)?(?:project|program)\s+(.+)$/i,
    build: (m) => ({ kind: "delete_project", projectRef: stripQuotes(m[1] ?? "") }),
  },
];

export const AR_COLLAB_RULES: Rule[] = [
  {
    pattern: /^(?:اضف|أضف)\s+(\S+)\s+(?:الى|إلى)\s+(?:ال)?فريق\s+(.+)$/,
    build: (m) => ({
      kind: "team_member",
      op: "add",
      username: m[1] ?? "",
      teamRef: stripQuotes(m[2] ?? ""),
    }),
  },
  {
    pattern: /^(?:ازل|أزل|احذف|أحذف)\s+(\S+)\s+من\s+(?:ال)?فريق\s+(.+)$/,
    build: (m) => ({
      kind: "team_member",
      op: "remove",
      username: m[1] ?? "",
      teamRef: stripQuotes(m[2] ?? ""),
    }),
  },
  {
    pattern: new RegExp(
      String.raw`^(?:اضف|أضف)\s+مهمة\s+فرعية\s+(.+?)\s+(?:الى|إلى)\s+(?:مهمة\s+)?` +
        String.raw`(.+?)(?:\s+في\s+(?:مشروع\s+)?(.+))?$`,
    ),
    build: (m) => ({
      kind: "add_subtask",
      name: stripQuotes(m[1] ?? ""),
      taskRef: stripQuotes(m[2] ?? ""),
      ...optionalRef(m[3]),
    }),
  },
  {
    pattern: /^(?:احذف|أحذف|امسح)\s+(?:ال)?مهمة\s+(.+?)(?:\s+في\s+(?:مشروع\s+)?(.+))?$/,
    build: (m) => ({
      kind: "delete_task",
      taskRef: stripQuotes(m[1] ?? ""),
      ...optionalRef(m[2]),
    }),
  },
  {
    pattern: /^(?:احذف|أحذف|امسح)\s+(?:ال)?(?:مشروع|برنامج)\s+(.+)$/,
    build: (m) => ({ kind: "delete_project", projectRef: stripQuotes(m[1] ?? "") }),
  },
];
