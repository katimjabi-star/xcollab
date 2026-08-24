import type { ChatMessage } from "../chat.ts";
import { resolveByName, type Resolution } from "./deterministic-snapshot.ts";

/**
 * Team/user snapshots for the deterministic adapter, recovered from prior
 * `list_teams` / `list_users` tool results in the turn history — the adapter
 * never calls the api itself (invariant 1). Parsing is tolerant: the api's
 * digest ships members as usernames ({id, name, members: [string]}), but raw
 * {username} member objects and {teams: [...]} wrappers are accepted too.
 */

export interface SnapshotTeam {
  id: string;
  name: string;
  members: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readMember(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (isRecord(value) && typeof value.username === "string") return value.username;
  return undefined;
}

function readTeam(value: unknown): SnapshotTeam | undefined {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.name !== "string") {
    return undefined;
  }
  const rawMembers = Array.isArray(value.members) ? value.members : [];
  const members = rawMembers.map(readMember).filter((m): m is string => m !== undefined);
  return { id: value.id, name: value.name, members };
}

function latestListOf(messages: ChatMessage[], tool: string, wrapper: string): unknown[] | undefined {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (!message || message.role !== "tool_result" || message.tool !== tool) continue;
    let payload: unknown;
    try {
      payload = JSON.parse(message.content);
    } catch {
      continue;
    }
    if (Array.isArray(payload)) return payload;
    if (isRecord(payload) && Array.isArray(payload[wrapper])) return payload[wrapper] as unknown[];
  }
  return undefined;
}

/** Latest list_teams tool_result in the history wins — mirrors extractSnapshot. */
export function extractTeams(messages: ChatMessage[]): SnapshotTeam[] | undefined {
  const list = latestListOf(messages, "list_teams", "teams");
  if (!list) return undefined;
  return list.map(readTeam).filter((t): t is SnapshotTeam => t !== undefined);
}

/** Usernames from the latest list_users tool_result ({username} rows or strings). */
export function extractUsernames(messages: ChatMessage[]): string[] | undefined {
  const list = latestListOf(messages, "list_users", "users");
  if (!list) return undefined;
  return list.map(readMember).filter((u): u is string => u !== undefined);
}

/** Same unique-substring/ambiguity semantics as resolveProgram, over teams. */
export function resolveTeam(teams: SnapshotTeam[], ref: string): Resolution<SnapshotTeam> {
  const byId = teams.find((team) => team.id === ref.trim());
  if (byId) return { match: byId, candidates: [byId.name] };
  return resolveByName(teams, ref, (team) => team.name);
}

/** Case-insensitive username lookup returning the canonical (stored) casing. */
export function matchUsername(candidates: string[], username: string): string | undefined {
  const needle = username.trim().toLowerCase();
  return candidates.find((candidate) => candidate.toLowerCase() === needle);
}
