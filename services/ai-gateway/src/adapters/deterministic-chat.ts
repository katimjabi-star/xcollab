import type { Language } from "@xcollab/core";
import type { ChatAdapter, ChatEvent, ChatMessage, ChatTurnRequest } from "../chat.ts";
import { addDays, parseUtterance, type ParsedIntent } from "./deterministic-intent.ts";
import {
  ambiguousReply,
  capabilityReply,
  extractSnapshot,
  narrateSummary,
  narrateTaskList,
  notFoundReply,
  resolvePackage,
  resolveProgram,
  type SnapshotProgram,
} from "./deterministic-snapshot.ts";
import { call, collabMutation, resolveTaskTarget, say } from "./deterministic-chat-collab.ts";

/**
 * Air-gapped / no-key chat adapter — spec §2.7. NOT an LLM: a rule intent
 * parser over the last user message plus the workspace snapshot recovered
 * from prior list_projects tool results. Emits the same tool-call shapes a
 * live model would, so the api loop and UI cannot tell the difference.
 * Deterministic: same input + snapshot ⇒ same output.
 */
export class DeterministicChatAdapter implements ChatAdapter {
  readonly id = "deterministic";
  readonly modelId = "deterministic-intent-parser";
  private readonly today: string;

  constructor(options: { today?: string } = {}) {
    this.today = options.today ?? new Date().toISOString().slice(0, 10);
  }

  async *runTurn(req: ChatTurnRequest): AsyncGenerator<ChatEvent> {
    yield* this.buildTurn(req.messages);
  }

  buildTurn(messages: ChatMessage[]): ChatEvent[] {
    const lastUserIndex = findLastUserIndex(messages);
    const lastUser = lastUserIndex === -1 ? undefined : messages[lastUserIndex];
    if (!lastUser || lastUser.role !== "user") return say(capabilityReply("en"));

    const { language, intent } = parseUtterance(lastUser.content, this.today);
    const results = toolResultsAfter(messages, lastUserIndex);

    switch (intent.kind) {
      case "unknown":
        return say(capabilityReply(language));
      case "create_project":
        return call("create_project", createProjectArgs(intent, language));
      case "my_tasks":
        return this.myTasks(intent, language, results);
      case "project_query":
      case "summarize":
        return this.projectRead(intent, language, results, messages);
      case "delete_task":
      case "delete_project":
      case "team_member":
      case "add_subtask":
        return collabMutation(intent, language, messages);
      default:
        return this.mutation(intent, language, messages);
    }
  }

  private myTasks(
    intent: Extract<ParsedIntent, { kind: "my_tasks" }>,
    language: Language,
    results: Map<string, string>,
  ): ChatEvent[] {
    const found = results.get("search_tasks");
    if (found !== undefined) return say(narrateTaskList(language, parseJson(found)));
    return call("search_tasks", {
      assignee: "me",
      ...(intent.overdue ? { overdue: true } : {}),
      ...(intent.status === undefined ? {} : { status: intent.status }),
      ...(intent.dueWithinWeek
        ? { dueAfter: this.today, dueBefore: addDays(this.today, 7) }
        : {}),
    });
  }

  private projectRead(
    intent: Extract<ParsedIntent, { kind: "project_query" | "summarize" }>,
    language: Language,
    results: Map<string, string>,
    messages: ChatMessage[],
  ): ChatEvent[] {
    const resultTool = intent.kind === "summarize" ? "get_project_summary" : "search_tasks";
    const found = results.get(resultTool);
    if (found !== undefined) {
      const payload = parseJson(found);
      return say(
        intent.kind === "summarize"
          ? narrateSummary(language, payload)
          : narrateTaskList(language, payload),
      );
    }
    const snapshot = extractSnapshot(messages);
    if (!snapshot) return call("list_projects", {});
    const program = requireProgram(snapshot, intent.projectRef, language);
    if ("reply" in program) return say(program.reply);
    if (intent.kind === "summarize") {
      return call("get_project_summary", { programId: program.match.id });
    }
    return call("search_tasks", {
      programId: program.match.id,
      ...(intent.overdue ? { overdue: true } : {}),
      ...(intent.status === undefined ? {} : { status: intent.status }),
    });
  }

  private mutation(
    intent: Extract<
      ParsedIntent,
      { kind: "create_task" | "set_status" | "assign" | "reschedule" | "describe" }
    >,
    language: Language,
    messages: ChatMessage[],
  ): ChatEvent[] {
    const snapshot = extractSnapshot(messages);
    if (!snapshot) return call("list_projects", {});
    if (intent.kind === "create_task") return createTask(intent, language, snapshot);

    return resolveTaskRefMutation(intent, language, snapshot, messages);
  }
}

/**
 * Resolves a task-ref mutation (set_status/assign/reschedule/describe) via
 * the shared snapshot-then-search_tasks resolution in
 * deterministic-chat-collab.ts (the lean list_projects digest ships
 * programs/packages but no tasks).
 */
function resolveTaskRefMutation(
  intent: Extract<ParsedIntent, { kind: "set_status" | "assign" | "reschedule" | "describe" }>,
  language: Language,
  snapshot: SnapshotProgram[],
  messages: ChatMessage[],
): ChatEvent[] {
  const resolved = resolveTaskTarget(intent.taskRef, language, snapshot, messages);
  if ("events" in resolved) return resolved.events;
  return call("update_task", { ...resolved.target, patch: patchOf(intent) });
}

function createProjectArgs(
  intent: Extract<ParsedIntent, { kind: "create_project" }>,
  language: Language,
): Record<string, unknown> {
  const timeline =
    intent.start !== undefined && intent.end !== undefined
      ? { timeline: { start: intent.start, end: intent.end } }
      : {};
  return { mission: intent.mission, language, ...timeline };
}

function createTask(
  intent: Extract<ParsedIntent, { kind: "create_task" }>,
  language: Language,
  snapshot: SnapshotProgram[],
): ChatEvent[] {
  const program = requireProgram(snapshot, intent.projectRef, language);
  if ("reply" in program) return say(program.reply);
  const pkg = resolvePackage(program.match, intent.packageRef);
  if (!pkg.match) {
    const ref = intent.packageRef ?? program.match.name;
    return say(
      pkg.candidates.length === 0
        ? notFoundReply(language, ref)
        : ambiguousReply(language, ref, pkg.candidates),
    );
  }
  return call("create_task", {
    programId: program.match.id,
    packageId: pkg.match.id,
    name: intent.name,
    ...(intent.dueDate === undefined ? {} : { dueDate: intent.dueDate }),
    ...(intent.assignee === undefined ? {} : { assignee: intent.assignee }),
  });
}

function patchOf(
  intent: Extract<ParsedIntent, { kind: "set_status" | "assign" | "reschedule" | "describe" }>,
): Record<string, unknown> {
  switch (intent.kind) {
    case "set_status":
      return { status: intent.status };
    case "assign":
      return { assignee: intent.assignee };
    case "reschedule":
      return { dueDate: intent.dueDate };
    case "describe":
      return { description: intent.description };
  }
}

function requireProgram(
  snapshot: SnapshotProgram[],
  ref: string,
  language: Language,
): { match: SnapshotProgram } | { reply: string } {
  const resolved = resolveProgram(snapshot, ref);
  if (resolved.match) return { match: resolved.match };
  return {
    reply:
      resolved.candidates.length === 0
        ? notFoundReply(language, ref)
        : ambiguousReply(language, ref, resolved.candidates),
  };
}

function findLastUserIndex(messages: ChatMessage[]): number {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i]?.role === "user") return i;
  }
  return -1;
}

/** Tool results produced after the last user message, i.e. within this turn. */
function toolResultsAfter(messages: ChatMessage[], index: number): Map<string, string> {
  const results = new Map<string, string>();
  for (const message of messages.slice(index + 1)) {
    if (message.role === "tool_result") results.set(message.tool, message.content);
  }
  return results;
}

function parseJson(content: string): unknown {
  try {
    return JSON.parse(content);
  } catch {
    return undefined;
  }
}
