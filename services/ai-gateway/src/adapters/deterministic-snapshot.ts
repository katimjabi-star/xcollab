import type { Language } from "@xcollab/core";
import type { ChatMessage } from "../chat.ts";

/**
 * Workspace snapshot for the deterministic adapter, recovered from prior
 * `list_projects` tool results in the turn history (the adapter never calls
 * the api itself — invariant 1). Parsing is tolerant: the executor may wrap
 * the program list or trim task fields.
 */

export interface SnapshotTask {
  id: string;
  name: string;
  status?: string;
}

export interface SnapshotPackage {
  id: string;
  name: string;
  tasks: SnapshotTask[];
}

export interface SnapshotProgram {
  id: string;
  name: string;
  packages: SnapshotPackage[];
}

export interface TaskMatch {
  program: SnapshotProgram;
  pkg: SnapshotPackage;
  task: SnapshotTask;
}

export interface Resolution<T> {
  match?: T;
  candidates: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readEntity(value: unknown): { id: string; name: string } | undefined {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.name !== "string") {
    return undefined;
  }
  return { id: value.id, name: value.name };
}

function readTask(value: unknown): SnapshotTask | undefined {
  const entity = readEntity(value);
  if (!entity) return undefined;
  const status = isRecord(value) && typeof value.status === "string" ? value.status : undefined;
  return { ...entity, ...(status === undefined ? {} : { status }) };
}

function readPackage(value: unknown): SnapshotPackage | undefined {
  const entity = readEntity(value);
  if (!entity) return undefined;
  const rawTasks = isRecord(value) && Array.isArray(value.tasks) ? value.tasks : [];
  const tasks = rawTasks.map(readTask).filter((t): t is SnapshotTask => t !== undefined);
  return { ...entity, tasks };
}

function readProgram(value: unknown): SnapshotProgram | undefined {
  const entity = readEntity(value);
  if (!entity) return undefined;
  const rawPackages = isRecord(value) && Array.isArray(value.packages) ? value.packages : [];
  const packages = rawPackages
    .map(readPackage)
    .filter((p): p is SnapshotPackage => p !== undefined);
  return { ...entity, packages };
}

/** Latest list_projects tool_result in the history wins (freshest snapshot). */
export function extractSnapshot(messages: ChatMessage[]): SnapshotProgram[] | undefined {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (!message || message.role !== "tool_result" || message.tool !== "list_projects") continue;
    let payload: unknown;
    try {
      payload = JSON.parse(message.content);
    } catch {
      continue;
    }
    const list = Array.isArray(payload)
      ? payload
      : isRecord(payload) && Array.isArray(payload.programs)
        ? payload.programs
        : undefined;
    if (!list) continue;
    return list.map(readProgram).filter((p): p is SnapshotProgram => p !== undefined);
  }
  return undefined;
}

/**
 * A `search_tasks` result row (packages/core/src/assistant-tools.ts): a flat
 * task carrying its parent program/package identity, used to resolve a task
 * reference when the (possibly lean) list_projects snapshot has no match.
 */
export interface SearchTaskRow {
  programId: string;
  programName: string;
  packageId: string;
  packageName: string;
  id: string;
  name: string;
  status?: string;
}

function readSearchTaskRow(value: unknown): SearchTaskRow | undefined {
  if (!isRecord(value)) return undefined;
  const { programId, programName, packageId, packageName, id, name, status } = value;
  if (
    typeof programId !== "string" ||
    typeof programName !== "string" ||
    typeof packageId !== "string" ||
    typeof packageName !== "string" ||
    typeof id !== "string" ||
    typeof name !== "string"
  ) {
    return undefined;
  }
  return {
    programId,
    programName,
    packageId,
    packageName,
    id,
    name,
    ...(typeof status === "string" ? { status } : {}),
  };
}

/** Latest search_tasks tool_result in the history wins — mirrors extractSnapshot. */
export function extractSearchTaskRows(messages: ChatMessage[]): SearchTaskRow[] | undefined {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (!message || message.role !== "tool_result" || message.tool !== "search_tasks") continue;
    let payload: unknown;
    try {
      payload = JSON.parse(message.content);
    } catch {
      continue;
    }
    const list = Array.isArray(payload)
      ? payload
      : isRecord(payload) && Array.isArray(payload.tasks)
        ? payload.tasks
        : undefined;
    if (!list) continue;
    return list.map(readSearchTaskRow).filter((r): r is SearchTaskRow => r !== undefined);
  }
  return undefined;
}

/** Case-insensitive matching with Arabic alef/yaa unification — never invents ids. */
function normalizeRef(value: string): string {
  return value.trim().toLowerCase().replace(/[أإآ]/g, "ا").replace(/ى/g, "ي");
}

export function resolveByName<T>(items: T[], ref: string, nameOf: (item: T) => string): Resolution<T> {
  const needle = normalizeRef(ref);
  const matches = items.filter((item) => normalizeRef(nameOf(item)).includes(needle));
  if (matches.length === 1) {
    const match = matches[0];
    if (match !== undefined) return { match, candidates: [nameOf(match)] };
  }
  return { candidates: matches.map(nameOf) };
}

export function resolveProgram(
  snapshot: SnapshotProgram[],
  ref: string,
): Resolution<SnapshotProgram> {
  const byId = snapshot.find((p) => p.id === ref.trim());
  if (byId) return { match: byId, candidates: [byId.name] };
  return resolveByName(snapshot, ref, (p) => p.name);
}

export function resolveTask(snapshot: SnapshotProgram[], ref: string): Resolution<TaskMatch> {
  const all: TaskMatch[] = snapshot.flatMap((program) =>
    program.packages.flatMap((pkg) => pkg.tasks.map((task) => ({ program, pkg, task }))),
  );
  const byId = all.find((m) => m.task.id === ref.trim());
  if (byId) return { match: byId, candidates: [byId.task.name] };
  return resolveByName(all, ref, (m) => m.task.name);
}

/** Same unique-substring/ambiguity semantics as resolveTask, over search_tasks rows. */
export function resolveSearchTask(rows: SearchTaskRow[], ref: string): Resolution<SearchTaskRow> {
  const byId = rows.find((r) => r.id === ref.trim());
  if (byId) return { match: byId, candidates: [byId.name] };
  return resolveByName(rows, ref, (r) => r.name);
}

export function resolvePackage(
  program: SnapshotProgram,
  ref: string | undefined,
): Resolution<SnapshotPackage> {
  if (ref === undefined) {
    const first = program.packages[0];
    return first ? { match: first, candidates: [first.name] } : { candidates: [] };
  }
  const byId = program.packages.find((p) => p.id === ref.trim());
  if (byId) return { match: byId, candidates: [byId.name] };
  return resolveByName(program.packages, ref, (p) => p.name);
}

// ---------------------------------------------------------------------------
// Canned replies (the deterministic adapter's prose, EN/AR)
// ---------------------------------------------------------------------------

export function notFoundReply(language: Language, ref: string): string {
  return language === "ar" ? `لم أعثر على "${ref}".` : `I couldn't find "${ref}".`;
}

export function ambiguousReply(language: Language, ref: string, candidates: string[]): string {
  const list = candidates.slice(0, 5).join("، ");
  const listEn = candidates.slice(0, 5).join(", ");
  return language === "ar"
    ? `وجدت أكثر من نتيجة لـ"${ref}": ${list}. أيها تقصد؟`
    : `"${ref}" matches more than one item: ${listEn}. Which one did you mean?`;
}

export function capabilityReply(language: Language): string {
  return language === "ar"
    ? "يمكنني إنشاء مشروع أو مهمة، تحديث حالة أو موعد أو تعيين مهمة، حذف مهمة أو مشروع، " +
        "إضافة أو إزالة عضو فريق، إضافة مهمة فرعية، البحث في المهام (مثل: اعرض مهامي المتأخرة)، وتلخيص مشروع."
    : "I can create a project or task, update a task's status, due date or assignee, " +
        "delete a task or project, add or remove a team member, add a subtask, " +
        "search tasks (e.g. \"show my overdue tasks\"), and summarize a project.";
}

export function narrateTaskList(language: Language, payload: unknown): string {
  const list = Array.isArray(payload)
    ? payload
    : isRecord(payload) && Array.isArray(payload.tasks)
      ? payload.tasks
      : [];
  const names = list
    .map((t) => (isRecord(t) && typeof t.name === "string" ? t.name : undefined))
    .filter((n): n is string => n !== undefined);
  if (names.length === 0) {
    return language === "ar" ? "لا توجد مهام مطابقة." : "No matching tasks.";
  }
  const shown = names.slice(0, 10).join(language === "ar" ? "، " : ", ");
  return language === "ar"
    ? `وجدت ${names.length} مهمة: ${shown}`
    : `Found ${names.length} task(s): ${shown}`;
}

export function narrateSummary(language: Language, payload: unknown): string {
  const digest = isRecord(payload) ? payload : {};
  const parts: string[] = [];
  if (isRecord(digest.statusCounts)) {
    const counts = Object.entries(digest.statusCounts)
      .map(([status, count]) => `${status}: ${String(count)}`)
      .join(language === "ar" ? "، " : ", ");
    parts.push(language === "ar" ? `الحالات — ${counts}` : `Status — ${counts}`);
  }
  if (typeof digest.overdue === "number") {
    parts.push(language === "ar" ? `متأخرة: ${digest.overdue}` : `Overdue: ${digest.overdue}`);
  }
  if (isRecord(digest.nextMilestone) && typeof digest.nextMilestone.name === "string") {
    parts.push(
      language === "ar"
        ? `المعلم التالي: ${digest.nextMilestone.name}`
        : `Next milestone: ${digest.nextMilestone.name}`,
    );
  }
  if (parts.length === 0) {
    return language === "ar" ? "ملخص المشروع جاهز أعلاه." : "The project summary is shown above.";
  }
  return (language === "ar" ? "ملخص المشروع: " : "Project summary: ") + parts.join(" · ");
}
