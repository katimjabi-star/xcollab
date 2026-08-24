import type { Language } from "@xcollab/core";
import {
  AR_COLLAB_RULES,
  EN_COLLAB_RULES,
  stripQuotes,
  type Rule,
} from "./deterministic-intent-collab.ts";

/**
 * Deterministic EN/AR intent grammar — spec §2.7 table, implemented as pure
 * functions (same utterance + today ⇒ same intent). References to tasks and
 * projects stay unresolved strings here; resolution against the workspace
 * snapshot happens in deterministic-snapshot.ts. The collaboration rules
 * (delete task/project, team membership, subtasks) live in
 * deterministic-intent-collab.ts and run before these base tables.
 */

export { stripQuotes, type Rule } from "./deterministic-intent-collab.ts";

export type TaskStatus = "todo" | "in_progress" | "blocked" | "done";

export type ParsedIntent =
  | { kind: "create_project"; mission: string; start?: string; end?: string }
  | {
      kind: "create_task";
      name: string;
      projectRef: string;
      packageRef?: string;
      dueDate?: string;
      assignee?: string;
    }
  | { kind: "set_status"; taskRef: string; status: TaskStatus }
  | { kind: "assign"; taskRef: string; assignee: string | null }
  | { kind: "reschedule"; taskRef: string; dueDate: string }
  | { kind: "describe"; taskRef: string; description: string }
  | { kind: "my_tasks"; overdue?: boolean; status?: TaskStatus; dueWithinWeek?: boolean }
  | { kind: "project_query"; projectRef: string; overdue?: boolean; status?: TaskStatus }
  | { kind: "summarize"; projectRef: string }
  | { kind: "delete_task"; taskRef: string; projectRef?: string }
  | { kind: "delete_project"; projectRef: string }
  | { kind: "team_member"; op: "add" | "remove"; username: string; teamRef: string }
  | { kind: "add_subtask"; name: string; taskRef: string; projectRef?: string }
  | { kind: "unknown" };

export interface ParsedUtterance {
  language: Language;
  intent: ParsedIntent;
}

const ARABIC_PATTERN = /[؀-ۿ]/;

/** Recognized date tokens: ISO, DD-MM-YYYY, and relative words in both languages. */
const DATE =
  String.raw`\d{4}-\d{2}-\d{2}|\d{1,2}-\d{1,2}-\d{4}` +
  String.raw`|today|tomorrow|next week|اليوم|غداً|غدا|الأسبوع القادم|الاسبوع القادم`;

export function addDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function parseDateToken(token: string, today: string): string | undefined {
  const value = token.trim().toLowerCase();
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const dmy = /^(\d{1,2})-(\d{1,2})-(\d{4})$/.exec(value);
  if (dmy) return `${dmy[3]}-${dmy[2]?.padStart(2, "0")}-${dmy[1]?.padStart(2, "0")}`;
  if (value === "today" || value === "اليوم") return today;
  if (value === "tomorrow" || value === "غدا" || value === "غداً") return addDays(today, 1);
  if (value === "next week" || value === "الاسبوع القادم" || value === "الأسبوع القادم") {
    return addDays(today, 7);
  }
  return undefined;
}

const EN_STATUS: Record<string, TaskStatus> = {
  done: "done",
  blocked: "blocked",
  "in progress": "in_progress",
  in_progress: "in_progress",
  todo: "todo",
};

const AR_STATUS: Record<string, TaskStatus> = {
  منجزة: "done",
  منجز: "done",
  مكتملة: "done",
  مكتمل: "done",
  معطلة: "blocked",
  معطل: "blocked",
  محظورة: "blocked",
  محظور: "blocked",
  "قيد التنفيذ": "in_progress",
  "قيد الانتظار": "todo",
};

function statusOf(table: Record<string, TaskStatus>, raw: string): TaskStatus | undefined {
  return table[raw.trim().toLowerCase().replace(/\s+/g, " ")];
}

const AR_STATUS_WORDS =
  "منجزة|منجز|مكتملة|مكتمل|معطلة|معطل|محظورة|محظور|قيد التنفيذ|قيد الانتظار";

// Rule order matters: describe/reschedule share verbs with set_status.
const EN_RULES: Rule[] = [
  {
    pattern: new RegExp(
      String.raw`^(?:create|new|start)\s+(?:a\s+)?(?:project|program)\s*[:,]?\s*` +
        String.raw`(.+?)(?:\s+from\s+(${DATE}))?(?:\s+(?:to|by)\s+(${DATE}))?$`,
      "i",
    ),
    build: (m, today) => ({
      kind: "create_project",
      mission: m[1] ?? "",
      ...dateField("start", m[2], today),
      ...dateField("end", m[3], today),
    }),
  },
  {
    pattern: new RegExp(
      String.raw`^(?:add|create)\s+(?:a\s+)?task\s+(?:named\s+|called\s+)?(.+?)\s+(?:in|to)\s+` +
        String.raw`(.+?)(?:\s+section\s+(.+?))?(?:\s+due\s+(${DATE}))?` +
        String.raw`(?:\s+assign(?:ed)?\s+to\s+(\S+))?$`,
      "i",
    ),
    build: (m, today) => ({
      kind: "create_task",
      name: stripQuotes(m[1] ?? ""),
      projectRef: stripQuotes(m[2] ?? ""),
      ...(m[3] === undefined ? {} : { packageRef: m[3] }),
      ...dateField("dueDate", m[4], today),
      ...(m[5] === undefined ? {} : { assignee: m[5] }),
    }),
  },
  {
    pattern: /^unassign\s+(.+)$/i,
    build: (m) => ({ kind: "assign", taskRef: stripQuotes(m[1] ?? ""), assignee: null }),
  },
  {
    pattern: /^assign\s+(.+?)\s+to\s+(\S+)$/i,
    build: (m) => ({ kind: "assign", taskRef: stripQuotes(m[1] ?? ""), assignee: m[2] ?? "" }),
  },
  {
    pattern: /^(?:set|update)\s+(?:the\s+)?description\s+of\s+(.+?)\s+to\s+(.+)$/i,
    build: (m) => ({ kind: "describe", taskRef: stripQuotes(m[1] ?? ""), description: m[2] ?? "" }),
  },
  {
    pattern: new RegExp(
      String.raw`^(?:move|set|change)\s+(?:the\s+)?due(?:\s+date)?\s+(?:of\s+)?(.+?)\s+to\s+(${DATE})$`,
      "i",
    ),
    build: (m, today) => {
      const dueDate = parseDateToken(m[2] ?? "", today);
      return dueDate ? { kind: "reschedule", taskRef: stripQuotes(m[1] ?? ""), dueDate } : undefined;
    },
  },
  {
    pattern: /^(?:mark|set|move)\s+(.+?)\s+(?:as\s+|to\s+)?(done|blocked|in progress|in_progress|todo)$/i,
    build: (m) => {
      const status = statusOf(EN_STATUS, m[2] ?? "");
      return status ? { kind: "set_status", taskRef: stripQuotes(m[1] ?? ""), status } : undefined;
    },
  },
  {
    pattern: /^(?:show|list)\s+(?:me\s+)?my\s+(?:(overdue|blocked|open)\s+)?tasks(\s+due\s+this\s+week)?$/i,
    build: (m) => myTasks(m[1], m[2]),
  },
  {
    pattern: /^what(?:'s|\s+is)\s+(blocked|overdue|in progress)\s+in\s+(.+)$/i,
    build: (m) => projectQuery(m[1] ?? "", m[2] ?? "", EN_STATUS),
  },
  {
    pattern: /^summari[sz]e\s+(?:project\s+)?(.+)$/i,
    build: (m) => ({ kind: "summarize", projectRef: stripQuotes(m[1] ?? "") }),
  },
  {
    pattern: /^how\s+is\s+(.+?)\s+(?:doing|going)$/i,
    build: (m) => ({ kind: "summarize", projectRef: stripQuotes(m[1] ?? "") }),
  },
];

const AR_RULES: Rule[] = [
  {
    pattern: new RegExp(
      String.raw`^(?:انشئ|أنشئ|انشىء|أنشىء|ابدأ|ابدا)\s+(?:مشروعا|مشروعاً|مشروع|برنامجا|برنامجاً|برنامج)` +
        String.raw`(?:\s+جديدا|\s+جديداً|\s+جديد)?\s*[:،]?\s*(.+?)(?:\s+من\s+(${DATE}))?(?:\s+(?:الى|إلى|حتى)\s+(${DATE}))?$`,
    ),
    build: (m, today) => ({
      kind: "create_project",
      mission: m[1] ?? "",
      ...dateField("start", m[2], today),
      ...dateField("end", m[3], today),
    }),
  },
  {
    pattern: new RegExp(
      String.raw`^(?:اضف|أضف|انشئ|أنشئ)\s+مهمة\s+(.+?)\s+(?:في|الى|إلى)\s+(?:مشروع\s+)?` +
        String.raw`(.+?)(?:\s+قسم\s+(.+?))?(?:\s+(?:تستحق|استحقاق)\s+(${DATE}))?` +
        String.raw`(?:\s+(?:وعينها|وعيّنها)\s+(?:الى|إلى|ل)\s*(\S+))?$`,
    ),
    build: (m, today) => ({
      kind: "create_task",
      name: stripQuotes(m[1] ?? ""),
      projectRef: stripQuotes(m[2] ?? ""),
      ...(m[3] === undefined ? {} : { packageRef: m[3] }),
      ...dateField("dueDate", m[4], today),
      ...(m[5] === undefined ? {} : { assignee: m[5] }),
    }),
  },
  {
    pattern: /^(?:الغ|ألغ|الغي|ألغي)\s+تعيين\s+(.+)$/,
    build: (m) => ({ kind: "assign", taskRef: stripQuotes(m[1] ?? ""), assignee: null }),
  },
  {
    pattern: /^(?:عين|عيّن|كلف|كلّف)\s+(.+?)\s+(?:الى|إلى|ل)\s+(\S+)$/,
    build: (m) => ({ kind: "assign", taskRef: stripQuotes(m[1] ?? ""), assignee: m[2] ?? "" }),
  },
  {
    pattern: /^(?:حدث|حدّث|عدل|عدّل)\s+وصف\s+(.+?)\s+(?:الى|إلى)\s+(.+)$/,
    build: (m) => ({ kind: "describe", taskRef: stripQuotes(m[1] ?? ""), description: m[2] ?? "" }),
  },
  {
    pattern: new RegExp(
      String.raw`^(?:غير|غيّر|حدد|حدّد|انقل)\s+(?:موعد\s+|تاريخ\s+)?(?:الاستحقاق|استحقاق|الإستحقاق)\s+` +
        String.raw`(?:لمهمة\s+|ل)?(.+?)\s+(?:الى|إلى)\s+(${DATE})$`,
    ),
    build: (m, today) => {
      const dueDate = parseDateToken(m[2] ?? "", today);
      return dueDate ? { kind: "reschedule", taskRef: stripQuotes(m[1] ?? ""), dueDate } : undefined;
    },
  },
  {
    pattern: new RegExp(
      String.raw`^(?:علم|علّم|حدد|حدّد|انقل|اجعل)\s+(.+?)\s+(?:الى\s+|إلى\s+)?ك?(${AR_STATUS_WORDS})$`,
    ),
    build: (m) => {
      const status = statusOf(AR_STATUS, m[2] ?? "");
      return status ? { kind: "set_status", taskRef: stripQuotes(m[1] ?? ""), status } : undefined;
    },
  },
  {
    pattern:
      /^(?:اعرض|أعرض|اظهر|أظهر)\s+مهامي(?:\s+(المتاخرة|المتأخرة|المعطلة|المحظورة|المفتوحة))?(\s+المستحقة\s+هذا\s+ال[أا]سبوع)?$/,
    build: (m) => myTasksAr(m[1], m[2]),
  },
  {
    pattern: /^ما\s+(?:هو\s+|هي\s+)?(المتاخر|المتأخر|المعطل|المحظور|قيد التنفيذ)\s+في\s+(?:مشروع\s+)?(.+)$/,
    build: (m) => projectQueryAr(m[1] ?? "", m[2] ?? ""),
  },
  {
    pattern: /^(?:لخص|لخّص)\s+(?:مشروع\s+)?(.+)$/,
    build: (m) => ({ kind: "summarize", projectRef: stripQuotes(m[1] ?? "") }),
  },
  {
    pattern: /^كيف\s+(?:يسير|تسير|حال)\s+(?:مشروع\s+)?(.+)$/,
    build: (m) => ({ kind: "summarize", projectRef: stripQuotes(m[1] ?? "") }),
  },
];

function dateField(
  key: "start" | "end" | "dueDate",
  token: string | undefined,
  today: string,
): Record<string, string> {
  const parsed = token === undefined ? undefined : parseDateToken(token, today);
  return parsed === undefined ? {} : { [key]: parsed };
}

function myTasks(filter: string | undefined, week: string | undefined): ParsedIntent {
  const f = filter?.toLowerCase();
  return {
    kind: "my_tasks",
    ...(f === "overdue" ? { overdue: true } : {}),
    ...(f === "blocked" ? { status: "blocked" as const } : {}),
    ...(week === undefined ? {} : { dueWithinWeek: true }),
  };
}

function myTasksAr(filter: string | undefined, week: string | undefined): ParsedIntent {
  const overdue = filter === "المتاخرة" || filter === "المتأخرة";
  const blocked = filter === "المعطلة" || filter === "المحظورة";
  return {
    kind: "my_tasks",
    ...(overdue ? { overdue: true } : {}),
    ...(blocked ? { status: "blocked" as const } : {}),
    ...(week === undefined ? {} : { dueWithinWeek: true }),
  };
}

function projectQuery(
  word: string,
  projectRef: string,
  table: Record<string, TaskStatus>,
): ParsedIntent {
  const ref = stripQuotes(projectRef);
  const normalized = word.trim().toLowerCase();
  if (normalized === "overdue") return { kind: "project_query", projectRef: ref, overdue: true };
  const status = statusOf(table, normalized) ?? "blocked";
  return { kind: "project_query", projectRef: ref, status };
}

function projectQueryAr(word: string, projectRef: string): ParsedIntent {
  const ref = stripQuotes(projectRef);
  if (word === "المتاخر" || word === "المتأخر") {
    return { kind: "project_query", projectRef: ref, overdue: true };
  }
  if (word === "قيد التنفيذ") return { kind: "project_query", projectRef: ref, status: "in_progress" };
  return { kind: "project_query", projectRef: ref, status: "blocked" };
}

export function parseUtterance(utterance: string, today: string): ParsedUtterance {
  const language: Language = ARABIC_PATTERN.test(utterance) ? "ar" : "en";
  const text = utterance.trim().replace(/\s+/g, " ").replace(/[?!.؟]+$/u, "").trim();
  const rules =
    language === "ar" ? [...AR_COLLAB_RULES, ...AR_RULES] : [...EN_COLLAB_RULES, ...EN_RULES];
  for (const rule of rules) {
    const match = rule.pattern.exec(text);
    if (!match) continue;
    const intent = rule.build(match, today);
    if (intent) return { language, intent };
  }
  return { language, intent: { kind: "unknown" } };
}
