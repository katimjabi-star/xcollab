import { describe, expect, it } from "vitest";
import {
  addDays,
  parseDateToken,
  parseUtterance,
  type ParsedIntent,
} from "../src/adapters/deterministic-intent.ts";

const TODAY = "2026-08-24";

/** Table-driven grammar cases — spec §2.7 grammar table, EN + AR mirrored. */
const CASES: ReadonlyArray<{ utterance: string; language: "en" | "ar"; intent: ParsedIntent }> = [
  // create_project
  {
    utterance: "create a project Falcon comms upgrade from 2026-09-01 to 2026-10-01",
    language: "en",
    intent: {
      kind: "create_project",
      mission: "Falcon comms upgrade",
      start: "2026-09-01",
      end: "2026-10-01",
    },
  },
  {
    utterance: "new project Deploy to staging",
    language: "en",
    intent: { kind: "create_project", mission: "Deploy to staging" },
  },
  {
    utterance: "start a program Radio pilot by 15-10-2026",
    language: "en",
    intent: { kind: "create_project", mission: "Radio pilot", end: "2026-10-15" },
  },
  {
    utterance: "أنشئ مشروع منصة الميدان من 2026-09-01 إلى 2026-10-01",
    language: "ar",
    intent: {
      kind: "create_project",
      mission: "منصة الميدان",
      start: "2026-09-01",
      end: "2026-10-01",
    },
  },
  // create_task
  {
    utterance: "add a task Cable check in Falcon due 2026-09-05 assigned to omar",
    language: "en",
    intent: {
      kind: "create_task",
      name: "Cable check",
      projectRef: "Falcon",
      dueDate: "2026-09-05",
      assignee: "omar",
    },
  },
  {
    utterance: "create task Wiring in Falcon section Build",
    language: "en",
    intent: { kind: "create_task", name: "Wiring", projectRef: "Falcon", packageRef: "Build" },
  },
  {
    utterance: "add task Sync review to Falcon due tomorrow",
    language: "en",
    intent: {
      kind: "create_task",
      name: "Sync review",
      projectRef: "Falcon",
      dueDate: addDays(TODAY, 1),
    },
  },
  {
    utterance: "أضف مهمة فحص الكابلات في منصة التعاون تستحق غداً",
    language: "ar",
    intent: {
      kind: "create_task",
      name: "فحص الكابلات",
      projectRef: "منصة التعاون",
      dueDate: addDays(TODAY, 1),
    },
  },
  // set status
  {
    utterance: "mark Field kit audit as done",
    language: "en",
    intent: { kind: "set_status", taskRef: "Field kit audit", status: "done" },
  },
  {
    utterance: "set Radio survey to in progress",
    language: "en",
    intent: { kind: "set_status", taskRef: "Radio survey", status: "in_progress" },
  },
  {
    utterance: "move Rig assembly to blocked",
    language: "en",
    intent: { kind: "set_status", taskRef: "Rig assembly", status: "blocked" },
  },
  {
    utterance: "علّم مراجعة الواجهة كمنجزة",
    language: "ar",
    intent: { kind: "set_status", taskRef: "مراجعة الواجهة", status: "done" },
  },
  {
    utterance: "انقل مراجعة الواجهة إلى قيد التنفيذ",
    language: "ar",
    intent: { kind: "set_status", taskRef: "مراجعة الواجهة", status: "in_progress" },
  },
  // assign / unassign
  {
    utterance: "assign Radio survey to sara",
    language: "en",
    intent: { kind: "assign", taskRef: "Radio survey", assignee: "sara" },
  },
  {
    utterance: "unassign Radio survey",
    language: "en",
    intent: { kind: "assign", taskRef: "Radio survey", assignee: null },
  },
  {
    utterance: "عيّن مراجعة الواجهة إلى sara",
    language: "ar",
    intent: { kind: "assign", taskRef: "مراجعة الواجهة", assignee: "sara" },
  },
  {
    utterance: "ألغ تعيين مراجعة الواجهة",
    language: "ar",
    intent: { kind: "assign", taskRef: "مراجعة الواجهة", assignee: null },
  },
  // reschedule
  {
    utterance: "set the due date of Radio survey to tomorrow",
    language: "en",
    intent: { kind: "reschedule", taskRef: "Radio survey", dueDate: addDays(TODAY, 1) },
  },
  {
    utterance: "change due of Rig assembly to 2026-11-02",
    language: "en",
    intent: { kind: "reschedule", taskRef: "Rig assembly", dueDate: "2026-11-02" },
  },
  {
    utterance: "غيّر موعد استحقاق مراجعة الواجهة إلى الأسبوع القادم",
    language: "ar",
    intent: { kind: "reschedule", taskRef: "مراجعة الواجهة", dueDate: addDays(TODAY, 7) },
  },
  // describe
  {
    utterance: "update description of Radio survey to Check all antennas first",
    language: "en",
    intent: {
      kind: "describe",
      taskRef: "Radio survey",
      description: "Check all antennas first",
    },
  },
  {
    utterance: "حدّث وصف مراجعة الواجهة إلى تدقيق الشاشات الرئيسية",
    language: "ar",
    intent: {
      kind: "describe",
      taskRef: "مراجعة الواجهة",
      description: "تدقيق الشاشات الرئيسية",
    },
  },
  // my tasks
  { utterance: "show my tasks", language: "en", intent: { kind: "my_tasks" } },
  {
    utterance: "list my overdue tasks",
    language: "en",
    intent: { kind: "my_tasks", overdue: true },
  },
  {
    utterance: "show my blocked tasks",
    language: "en",
    intent: { kind: "my_tasks", status: "blocked" },
  },
  {
    utterance: "show my tasks due this week",
    language: "en",
    intent: { kind: "my_tasks", dueWithinWeek: true },
  },
  { utterance: "اعرض مهامي", language: "ar", intent: { kind: "my_tasks" } },
  {
    utterance: "اعرض مهامي المتأخرة",
    language: "ar",
    intent: { kind: "my_tasks", overdue: true },
  },
  {
    utterance: "أظهر مهامي المعطلة",
    language: "ar",
    intent: { kind: "my_tasks", status: "blocked" },
  },
  {
    utterance: "اعرض مهامي المستحقة هذا الأسبوع",
    language: "ar",
    intent: { kind: "my_tasks", dueWithinWeek: true },
  },
  // project query
  {
    utterance: "what's blocked in Falcon?",
    language: "en",
    intent: { kind: "project_query", projectRef: "Falcon", status: "blocked" },
  },
  {
    utterance: "what is overdue in Falcon",
    language: "en",
    intent: { kind: "project_query", projectRef: "Falcon", overdue: true },
  },
  {
    utterance: "ما هو المتأخر في منصة التعاون؟",
    language: "ar",
    intent: { kind: "project_query", projectRef: "منصة التعاون", overdue: true },
  },
  {
    utterance: "ما المعطل في منصة التعاون",
    language: "ar",
    intent: { kind: "project_query", projectRef: "منصة التعاون", status: "blocked" },
  },
  // summarize
  {
    utterance: "summarize Falcon",
    language: "en",
    intent: { kind: "summarize", projectRef: "Falcon" },
  },
  {
    utterance: "how is Falcon doing?",
    language: "en",
    intent: { kind: "summarize", projectRef: "Falcon" },
  },
  {
    utterance: "لخص منصة التعاون",
    language: "ar",
    intent: { kind: "summarize", projectRef: "منصة التعاون" },
  },
  {
    utterance: "كيف يسير مشروع منصة التعاون؟",
    language: "ar",
    intent: { kind: "summarize", projectRef: "منصة التعاون" },
  },
  // outside the grammar
  { utterance: "hello there, what can you do?", language: "en", intent: { kind: "unknown" } },
  { utterance: "مرحباً، ماذا تستطيع أن تفعل؟", language: "ar", intent: { kind: "unknown" } },
];

describe("deterministic intent grammar (spec §2.7 table)", () => {
  for (const { utterance, language, intent } of CASES) {
    it(`[${language}] "${utterance}"`, () => {
      expect(parseUtterance(utterance, TODAY)).toEqual({ language, intent });
    });
  }

  it("is deterministic: same utterance and today produce identical intents", () => {
    const first = parseUtterance("set the due date of Radio survey to next week", TODAY);
    const second = parseUtterance("set the due date of Radio survey to next week", TODAY);
    expect(second).toEqual(first);
  });
});

describe("date token parsing", () => {
  it("accepts ISO, DD-MM-YYYY and relative words in both languages", () => {
    expect(parseDateToken("2026-12-01", TODAY)).toBe("2026-12-01");
    expect(parseDateToken("01-12-2026", TODAY)).toBe("2026-12-01");
    expect(parseDateToken("today", TODAY)).toBe(TODAY);
    expect(parseDateToken("اليوم", TODAY)).toBe(TODAY);
    expect(parseDateToken("tomorrow", TODAY)).toBe("2026-08-25");
    expect(parseDateToken("غداً", TODAY)).toBe("2026-08-25");
    expect(parseDateToken("next week", TODAY)).toBe("2026-08-31");
    expect(parseDateToken("الأسبوع القادم", TODAY)).toBe("2026-08-31");
    expect(parseDateToken("someday", TODAY)).toBeUndefined();
  });

  it("addDays crosses month boundaries in UTC", () => {
    expect(addDays("2026-08-31", 1)).toBe("2026-09-01");
    expect(addDays("2026-12-31", 7)).toBe("2027-01-07");
  });
});
