import type { Language } from "@xcollab/core";

/**
 * Golden chat cases for the deterministic intent-parser adapter — one per
 * supported intent, EN + AR (spec §2.7 grammar table). Evaluated with a
 * pinned `today` and a fixed workspace snapshot so runs are reproducible.
 * Synthetic content only — Connected-profile rule.
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

export type GoldenChatExpectation =
  | { kind: "tool_call"; tool: string; args: Record<string, unknown> }
  | { kind: "text"; contains: string };

export interface GoldenChatCase {
  key: string;
  language: Language;
  utterance: string;
  expected: GoldenChatExpectation;
}

export const GOLDEN_CHATS: readonly GoldenChatCase[] = [
  // create_project
  {
    key: "en-create-project",
    language: "en",
    utterance: "create a project Field comms modernization from 2026-09-01 to 2026-11-30",
    expected: {
      kind: "tool_call",
      tool: "create_project",
      args: {
        mission: "Field comms modernization",
        language: "en",
        timeline: { start: "2026-09-01", end: "2026-11-30" },
      },
    },
  },
  {
    key: "ar-create-project",
    language: "ar",
    utterance: "أنشئ مشروع تحديث أنظمة الاتصال الميداني من 2026-09-01 إلى 2026-11-30",
    expected: {
      kind: "tool_call",
      tool: "create_project",
      args: {
        mission: "تحديث أنظمة الاتصال الميداني",
        language: "ar",
        timeline: { start: "2026-09-01", end: "2026-11-30" },
      },
    },
  },
  // create_task
  {
    key: "en-create-task",
    language: "en",
    utterance: "add a task Antenna alignment in Falcon section Build due 2026-09-10 assigned to omar",
    expected: {
      kind: "tool_call",
      tool: "create_task",
      args: {
        programId: "prog-falcon",
        packageId: "pkg-build",
        name: "Antenna alignment",
        dueDate: "2026-09-10",
        assignee: "omar",
      },
    },
  },
  {
    key: "ar-create-task",
    language: "ar",
    utterance: "أضف مهمة تدقيق الترجمة في منصة التعاون تستحق غداً",
    expected: {
      kind: "tool_call",
      tool: "create_task",
      args: {
        programId: "prog-taawun",
        packageId: "pkg-design",
        name: "تدقيق الترجمة",
        dueDate: "2026-08-25",
      },
    },
  },
  // update_task — status
  {
    key: "en-set-status",
    language: "en",
    utterance: "mark Field kit audit as done",
    expected: {
      kind: "tool_call",
      tool: "update_task",
      args: { programId: "prog-falcon", taskId: "task-audit", patch: { status: "done" } },
    },
  },
  {
    key: "ar-set-status",
    language: "ar",
    utterance: "علّم مراجعة الواجهة كمنجزة",
    expected: {
      kind: "tool_call",
      tool: "update_task",
      args: { programId: "prog-taawun", taskId: "task-review", patch: { status: "done" } },
    },
  },
  // update_task — due date
  {
    key: "en-reschedule",
    language: "en",
    utterance: "set the due date of Radio survey to next week",
    expected: {
      kind: "tool_call",
      tool: "update_task",
      args: { programId: "prog-falcon", taskId: "task-radio", patch: { dueDate: "2026-08-31" } },
    },
  },
  {
    key: "ar-reschedule",
    language: "ar",
    utterance: "غيّر موعد استحقاق مراجعة الواجهة إلى 2026-10-01",
    expected: {
      kind: "tool_call",
      tool: "update_task",
      args: { programId: "prog-taawun", taskId: "task-review", patch: { dueDate: "2026-10-01" } },
    },
  },
  // update_task — assignee
  {
    key: "en-assign",
    language: "en",
    utterance: "assign Rig assembly to sara",
    expected: {
      kind: "tool_call",
      tool: "update_task",
      args: { programId: "prog-falcon", taskId: "task-rig", patch: { assignee: "sara" } },
    },
  },
  {
    key: "ar-assign",
    language: "ar",
    utterance: "عيّن مراجعة الواجهة إلى sara",
    expected: {
      kind: "tool_call",
      tool: "update_task",
      args: { programId: "prog-taawun", taskId: "task-review", patch: { assignee: "sara" } },
    },
  },
  {
    key: "en-unassign",
    language: "en",
    utterance: "unassign Radio survey",
    expected: {
      kind: "tool_call",
      tool: "update_task",
      args: { programId: "prog-falcon", taskId: "task-radio", patch: { assignee: null } },
    },
  },
  {
    key: "ar-unassign",
    language: "ar",
    utterance: "ألغ تعيين مراجعة الواجهة",
    expected: {
      kind: "tool_call",
      tool: "update_task",
      args: { programId: "prog-taawun", taskId: "task-review", patch: { assignee: null } },
    },
  },
  // update_task — description
  {
    key: "en-describe",
    language: "en",
    utterance: "update description of Rig assembly to Verify torque on every bolt",
    expected: {
      kind: "tool_call",
      tool: "update_task",
      args: {
        programId: "prog-falcon",
        taskId: "task-rig",
        patch: { description: "Verify torque on every bolt" },
      },
    },
  },
  {
    key: "ar-describe",
    language: "ar",
    utterance: "حدّث وصف مراجعة الواجهة إلى تدقيق شاشات لوحة التحكم",
    expected: {
      kind: "tool_call",
      tool: "update_task",
      args: {
        programId: "prog-taawun",
        taskId: "task-review",
        patch: { description: "تدقيق شاشات لوحة التحكم" },
      },
    },
  },
  // search_tasks — my tasks
  {
    key: "en-my-overdue",
    language: "en",
    utterance: "show my overdue tasks",
    expected: { kind: "tool_call", tool: "search_tasks", args: { assignee: "me", overdue: true } },
  },
  {
    key: "ar-my-overdue",
    language: "ar",
    utterance: "اعرض مهامي المتأخرة",
    expected: { kind: "tool_call", tool: "search_tasks", args: { assignee: "me", overdue: true } },
  },
  {
    key: "en-due-this-week",
    language: "en",
    utterance: "show my tasks due this week",
    expected: {
      kind: "tool_call",
      tool: "search_tasks",
      args: { assignee: "me", dueAfter: "2026-08-24", dueBefore: "2026-08-31" },
    },
  },
  {
    key: "ar-due-this-week",
    language: "ar",
    utterance: "اعرض مهامي المستحقة هذا الأسبوع",
    expected: {
      kind: "tool_call",
      tool: "search_tasks",
      args: { assignee: "me", dueAfter: "2026-08-24", dueBefore: "2026-08-31" },
    },
  },
  // search_tasks — project queries
  {
    key: "en-blocked-in-project",
    language: "en",
    utterance: "what's blocked in Falcon?",
    expected: {
      kind: "tool_call",
      tool: "search_tasks",
      args: { programId: "prog-falcon", status: "blocked" },
    },
  },
  {
    key: "ar-overdue-in-project",
    language: "ar",
    utterance: "ما هو المتأخر في منصة التعاون؟",
    expected: { kind: "tool_call", tool: "search_tasks", args: { programId: "prog-taawun", overdue: true } },
  },
  // get_project_summary
  {
    key: "en-summarize",
    language: "en",
    utterance: "summarize Falcon",
    expected: { kind: "tool_call", tool: "get_project_summary", args: { programId: "prog-falcon" } },
  },
  {
    key: "ar-summarize",
    language: "ar",
    utterance: "لخص منصة التعاون",
    expected: { kind: "tool_call", tool: "get_project_summary", args: { programId: "prog-taawun" } },
  },
  // outside the grammar — capability reply, never a hallucinated call
  {
    key: "en-unknown",
    language: "en",
    utterance: "write me a poem about routers",
    expected: { kind: "text", contains: "I can create" },
  },
  {
    key: "ar-unknown",
    language: "ar",
    utterance: "اكتب لي قصيدة عن الشبكات",
    expected: { kind: "text", contains: "يمكنني" },
  },
];
