import { CHAT_TEAMS, CHAT_USERS, type GoldenChatCase } from "./chat-fixtures.ts";

/**
 * Golden cases for the collaboration intents — delete task/project, team
 * membership, subtasks — EN + AR, asserting the exact expected tool + args.
 * Split out of chats.ts to keep that file under the repo's max-lines budget.
 * Synthetic content only — Connected-profile rule.
 */

const TEAM_FIXTURES = { listTeamsResult: CHAT_TEAMS, listUsersResult: CHAT_USERS };

export const GOLDEN_CHATS_COLLAB: readonly GoldenChatCase[] = [
  // delete_task
  {
    key: "en-delete-task",
    language: "en",
    utterance: "delete task Radio survey in Falcon",
    expected: {
      kind: "tool_call",
      tool: "delete_task",
      args: { programId: "prog-falcon", taskId: "task-radio" },
    },
  },
  {
    key: "ar-delete-task",
    language: "ar",
    utterance: "احذف مهمة مراجعة الواجهة",
    expected: {
      kind: "tool_call",
      tool: "delete_task",
      args: { programId: "prog-taawun", taskId: "task-review" },
    },
  },
  // delete_project
  {
    key: "en-delete-project",
    language: "en",
    utterance: "delete project Falcon",
    expected: { kind: "tool_call", tool: "delete_project", args: { programId: "prog-falcon" } },
  },
  {
    key: "ar-delete-project",
    language: "ar",
    utterance: "احذف مشروع منصة التعاون",
    expected: { kind: "tool_call", tool: "delete_project", args: { programId: "prog-taawun" } },
  },
  // add_team_member (username resolution is case-insensitive → canonical casing)
  {
    key: "en-add-team-member",
    language: "en",
    utterance: "add Omar to team Field Crew",
    expected: {
      kind: "tool_call",
      tool: "add_team_member",
      args: { teamId: "team-field", username: "omar" },
    },
    ...TEAM_FIXTURES,
  },
  {
    key: "ar-add-team-member",
    language: "ar",
    utterance: "أضف omar إلى فريق التصميم",
    expected: {
      kind: "tool_call",
      tool: "add_team_member",
      args: { teamId: "team-design", username: "omar" },
    },
    ...TEAM_FIXTURES,
  },
  // remove_team_member (resolved against the team's own member list)
  {
    key: "en-remove-team-member",
    language: "en",
    utterance: "remove sara from team Field Crew",
    expected: {
      kind: "tool_call",
      tool: "remove_team_member",
      args: { teamId: "team-field", username: "sara" },
    },
    ...TEAM_FIXTURES,
  },
  {
    key: "ar-remove-team-member",
    language: "ar",
    utterance: "أزل sara من فريق التصميم",
    expected: {
      kind: "tool_call",
      tool: "remove_team_member",
      args: { teamId: "team-design", username: "sara" },
    },
    ...TEAM_FIXTURES,
  },
  // add_subtask
  {
    key: "en-add-subtask",
    language: "en",
    utterance: 'add subtask "Check torque" to Rig assembly in Falcon',
    expected: {
      kind: "tool_call",
      tool: "add_subtask",
      args: { programId: "prog-falcon", taskId: "task-rig", name: "Check torque" },
    },
  },
  {
    key: "ar-add-subtask",
    language: "ar",
    utterance: "أضف مهمة فرعية تدقيق الألوان إلى مراجعة الواجهة",
    expected: {
      kind: "tool_call",
      tool: "add_subtask",
      args: { programId: "prog-taawun", taskId: "task-review", name: "تدقيق الألوان" },
    },
  },
];
