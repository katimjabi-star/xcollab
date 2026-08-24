import type { GoldenChatCase } from "./chat-fixtures.ts";

/**
 * Golden cases for the task-ref → search_tasks resolution fallback (used
 * when the list_projects digest is lean, i.e. has no task data) and for
 * quoted-name stripping in create_task. Split out of chats.ts to keep that
 * file under the repo's max-lines budget. Synthetic content only —
 * Connected-profile rule.
 */
export const GOLDEN_CHATS_SEARCH_FALLBACK: readonly GoldenChatCase[] = [
  // update_task — status resolved via a search_tasks fallback (no snapshot match)
  {
    key: "en-set-status-via-search-fallback",
    language: "en",
    utterance: "mark Ground station calibration as done",
    expected: {
      kind: "tool_call",
      tool: "update_task",
      args: { programId: "prog-falcon", taskId: "task-ground", patch: { status: "done" } },
    },
    searchTasksResult: [
      {
        programId: "prog-falcon",
        programName: "Falcon Rollout",
        packageId: "pkg-build",
        packageName: "Build",
        id: "task-ground",
        name: "Ground station calibration",
        status: "todo",
      },
    ],
  },
  {
    key: "ar-set-status-via-search-fallback",
    language: "ar",
    utterance: "علّم فحص محطة الأرض كمنجزة",
    expected: {
      kind: "tool_call",
      tool: "update_task",
      args: { programId: "prog-taawun", taskId: "task-ground-ar", patch: { status: "done" } },
    },
    searchTasksResult: [
      {
        programId: "prog-taawun",
        programName: "منصة التعاون",
        packageId: "pkg-design",
        packageName: "التصميم",
        id: "task-ground-ar",
        name: "فحص محطة الأرض",
        status: "todo",
      },
    ],
  },
  // create_task — a quoted name loses its delimiting quotes
  {
    key: "en-create-task-quoted-name",
    language: "en",
    utterance: 'add task "P1" to Falcon',
    expected: {
      kind: "tool_call",
      tool: "create_task",
      args: { programId: "prog-falcon", packageId: "pkg-discovery", name: "P1" },
    },
  },
];
