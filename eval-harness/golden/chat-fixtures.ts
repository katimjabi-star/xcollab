import type { Language } from "@xcollab/core";

/**
 * Shared fixtures for the golden chat cases (split out of chats.ts to keep
 * that file under the repo's max-lines budget). Synthetic content only —
 * Connected-profile rule.
 */

export const CHAT_TODAY = "2026-08-24";

/** Fixed workspace snapshot (shape of a list_projects tool result). */
export const CHAT_SNAPSHOT = [
  {
    id: "prog-falcon",
    name: "Falcon Rollout",
    packages: [
      {
        id: "pkg-discovery",
        name: "Discovery",
        tasks: [
          { id: "task-audit", name: "Field kit audit", status: "todo" },
          { id: "task-radio", name: "Radio survey", status: "blocked" },
        ],
      },
      {
        id: "pkg-build",
        name: "Build",
        tasks: [{ id: "task-rig", name: "Rig assembly", status: "in_progress" }],
      },
    ],
  },
  {
    id: "prog-taawun",
    name: "منصة التعاون",
    packages: [
      {
        id: "pkg-design",
        name: "التصميم",
        tasks: [{ id: "task-review", name: "مراجعة الواجهة", status: "todo" }],
      },
    ],
  },
];

/** Fixed team snapshot (shape of the api's leaned list_teams digest). */
export const CHAT_TEAMS = [
  { id: "team-field", name: "Field Crew", members: ["jabbir", "sara"] },
  { id: "team-design", name: "فريق التصميم", members: ["jabbir", "sara"] },
];

/** Fixed user snapshot (shape of the api's list_users digest). */
export const CHAT_USERS = [
  { username: "jabbir" },
  { username: "sara" },
  { username: "omar" },
];

export type GoldenChatExpectation =
  | { kind: "tool_call"; tool: string; args: Record<string, unknown> }
  | { kind: "text"; contains: string };

export interface GoldenChatCase {
  key: string;
  language: Language;
  utterance: string;
  expected: GoldenChatExpectation;
  /** Fixture answering a search_tasks call the driver should auto-continue
      (task-ref resolution fallback when the snapshot has no match). */
  searchTasksResult?: unknown;
  /** Fixture answering a list_teams call (team membership intents). */
  listTeamsResult?: unknown;
  /** Fixture answering a list_users call (username resolution for add). */
  listUsersResult?: unknown;
}
