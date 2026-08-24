import type { Language } from "@xcollab/core";
import type { ChatEvent, ChatMessage } from "../chat.ts";
import type { ParsedIntent } from "./deterministic-intent.ts";
import {
  ambiguousReply,
  extractSearchTaskRows,
  extractSnapshot,
  notFoundReply,
  resolveProgram,
  resolveSearchTask,
  resolveTask,
  type SnapshotProgram,
} from "./deterministic-snapshot.ts";
import {
  extractTeams,
  extractUsernames,
  matchUsername,
  resolveTeam,
} from "./deterministic-snapshot-teams.ts";

/**
 * Collaboration mutations for the deterministic adapter (delete task/project,
 * team membership, subtasks) — split out of deterministic-chat.ts to keep both
 * files under the repo's max-lines budget. Shares the base adapter's
 * invariants: ids come only from prior tool results, ambiguity becomes a
 * question, and every mutation stops at a proposal-shaped tool call.
 */

export function say(text: string): ChatEvent[] {
  return [
    { type: "text_delta", text },
    { type: "finish", reason: "stop" },
  ];
}

export function call(name: string, args: unknown): ChatEvent[] {
  return [
    { type: "tool_call", id: "det-1", name, args },
    { type: "finish", reason: "tool_calls" },
  ];
}

export interface TaskTarget {
  programId: string;
  taskId: string;
}

export type TaskTargetResolution = { target: TaskTarget } | { events: ChatEvent[] };

/**
 * Resolves a task reference against the snapshot first, then falls back to
 * `search_tasks` (the lean list_projects digest carries no tasks). An
 * ambiguous snapshot match is answered directly — every candidate name is
 * already known. `programId` (from an explicit "in <project>") narrows the
 * fallback search.
 */
export function resolveTaskTarget(
  taskRef: string,
  language: Language,
  snapshot: SnapshotProgram[],
  messages: ChatMessage[],
  programId?: string,
): TaskTargetResolution {
  const fromSnapshot = resolveTask(snapshot, taskRef);
  if (fromSnapshot.match) {
    const { program, task } = fromSnapshot.match;
    return { target: { programId: program.id, taskId: task.id } };
  }
  if (fromSnapshot.candidates.length > 0) {
    return { events: say(ambiguousReply(language, taskRef, fromSnapshot.candidates)) };
  }

  const rows = extractSearchTaskRows(messages);
  if (!rows) {
    return {
      events: call("search_tasks", {
        text: taskRef,
        ...(programId === undefined ? {} : { programId }),
      }),
    };
  }
  const fromSearch = resolveSearchTask(rows, taskRef);
  if (fromSearch.match) {
    return { target: { programId: fromSearch.match.programId, taskId: fromSearch.match.id } };
  }
  return {
    events: say(
      fromSearch.candidates.length === 0
        ? notFoundReply(language, taskRef)
        : ambiguousReply(language, taskRef, fromSearch.candidates),
    ),
  };
}

type CollabIntent = Extract<
  ParsedIntent,
  { kind: "delete_task" | "delete_project" | "team_member" | "add_subtask" }
>;

export function collabMutation(
  intent: CollabIntent,
  language: Language,
  messages: ChatMessage[],
): ChatEvent[] {
  if (intent.kind === "team_member") return teamMember(intent, language, messages);
  const snapshot = extractSnapshot(messages);
  if (!snapshot) return call("list_projects", {});
  if (intent.kind === "delete_project") {
    const program = resolveProgram(snapshot, intent.projectRef);
    if (!program.match) return say(unresolvedReply(language, intent.projectRef, program.candidates));
    return call("delete_project", { programId: program.match.id });
  }
  return taskScopedMutation(intent, language, snapshot, messages);
}

function taskScopedMutation(
  intent: Extract<CollabIntent, { kind: "delete_task" | "add_subtask" }>,
  language: Language,
  snapshot: SnapshotProgram[],
  messages: ChatMessage[],
): ChatEvent[] {
  let scope = snapshot;
  let programId: string | undefined;
  if (intent.projectRef !== undefined) {
    const program = resolveProgram(snapshot, intent.projectRef);
    if (!program.match) return say(unresolvedReply(language, intent.projectRef, program.candidates));
    scope = [program.match];
    programId = program.match.id;
  }
  const resolved = resolveTaskTarget(intent.taskRef, language, scope, messages, programId);
  if ("events" in resolved) return resolved.events;
  return intent.kind === "delete_task"
    ? call("delete_task", { ...resolved.target })
    : call("add_subtask", { ...resolved.target, name: intent.name });
}

function teamMember(
  intent: Extract<CollabIntent, { kind: "team_member" }>,
  language: Language,
  messages: ChatMessage[],
): ChatEvent[] {
  const teams = extractTeams(messages);
  if (!teams) return call("list_teams", {});
  const team = resolveTeam(teams, intent.teamRef);
  if (!team.match) return say(unresolvedReply(language, intent.teamRef, team.candidates));

  if (intent.op === "remove") {
    // The team's own member list is the authority for who can be removed.
    const member = matchUsername(team.match.members, intent.username);
    if (member === undefined) return say(notFoundReply(language, intent.username));
    return call("remove_team_member", { teamId: team.match.id, username: member });
  }

  const usernames = extractUsernames(messages);
  if (!usernames) return call("list_users", {});
  const username = matchUsername(usernames, intent.username);
  if (username === undefined) return say(notFoundReply(language, intent.username));
  return call("add_team_member", { teamId: team.match.id, username });
}

function unresolvedReply(language: Language, ref: string, candidates: string[]): string {
  return candidates.length === 0
    ? notFoundReply(language, ref)
    : ambiguousReply(language, ref, candidates);
}
