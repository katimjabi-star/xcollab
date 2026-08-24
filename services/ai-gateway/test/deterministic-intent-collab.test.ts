import { describe, expect, it } from "vitest";
import { parseUtterance, type ParsedIntent } from "../src/adapters/deterministic-intent.ts";

const TODAY = "2026-08-24";

/** Collaboration-intent grammar cases — delete task/project, team membership,
    subtasks — EN + AR mirrored, in the style of deterministic-intent.test.ts. */
const CASES: ReadonlyArray<{ utterance: string; language: "en" | "ar"; intent: ParsedIntent }> = [
  // delete_task
  {
    utterance: "delete task Radio survey",
    language: "en",
    intent: { kind: "delete_task", taskRef: "Radio survey" },
  },
  {
    utterance: "delete task Radio survey in Falcon",
    language: "en",
    intent: { kind: "delete_task", taskRef: "Radio survey", projectRef: "Falcon" },
  },
  {
    utterance: 'remove the task "Rig assembly"',
    language: "en",
    intent: { kind: "delete_task", taskRef: "Rig assembly" },
  },
  {
    utterance: "احذف مهمة مراجعة الواجهة",
    language: "ar",
    intent: { kind: "delete_task", taskRef: "مراجعة الواجهة" },
  },
  {
    utterance: "احذف مهمة مراجعة الواجهة في مشروع منصة التعاون",
    language: "ar",
    intent: { kind: "delete_task", taskRef: "مراجعة الواجهة", projectRef: "منصة التعاون" },
  },
  // delete_project
  {
    utterance: "delete project Falcon",
    language: "en",
    intent: { kind: "delete_project", projectRef: "Falcon" },
  },
  {
    utterance: "delete the program Radio pilot",
    language: "en",
    intent: { kind: "delete_project", projectRef: "Radio pilot" },
  },
  {
    utterance: "احذف مشروع منصة التعاون",
    language: "ar",
    intent: { kind: "delete_project", projectRef: "منصة التعاون" },
  },
  // team membership
  {
    utterance: "add omar to team Field Crew",
    language: "en",
    intent: { kind: "team_member", op: "add", username: "omar", teamRef: "Field Crew" },
  },
  {
    utterance: "remove sara from the team Field Crew",
    language: "en",
    intent: { kind: "team_member", op: "remove", username: "sara", teamRef: "Field Crew" },
  },
  {
    utterance: "أضف omar إلى فريق التصميم",
    language: "ar",
    intent: { kind: "team_member", op: "add", username: "omar", teamRef: "التصميم" },
  },
  {
    utterance: "أزل sara من فريق التصميم",
    language: "ar",
    intent: { kind: "team_member", op: "remove", username: "sara", teamRef: "التصميم" },
  },
  // add_subtask
  {
    utterance: 'add subtask "Check torque" to Rig assembly',
    language: "en",
    intent: { kind: "add_subtask", name: "Check torque", taskRef: "Rig assembly" },
  },
  {
    utterance: 'add a subtask "Check torque" to Rig assembly in Falcon',
    language: "en",
    intent: {
      kind: "add_subtask",
      name: "Check torque",
      taskRef: "Rig assembly",
      projectRef: "Falcon",
    },
  },
  {
    utterance: "أضف مهمة فرعية تدقيق الألوان إلى مراجعة الواجهة",
    language: "ar",
    intent: { kind: "add_subtask", name: "تدقيق الألوان", taskRef: "مراجعة الواجهة" },
  },
  // the AR subtask rule must win over the AR create_task rule
  {
    utterance: "أضف مهمة فحص الكابلات في منصة التعاون",
    language: "ar",
    intent: { kind: "create_task", name: "فحص الكابلات", projectRef: "منصة التعاون" },
  },
];

describe("deterministic intent grammar — collaboration intents", () => {
  for (const { utterance, language, intent } of CASES) {
    it(`[${language}] "${utterance}"`, () => {
      expect(parseUtterance(utterance, TODAY)).toEqual({ language, intent });
    });
  }

  it("keeps 'add a task …' on the create_task rule (no subtask/member capture)", () => {
    expect(parseUtterance("add a task Wiring in Falcon", TODAY).intent).toEqual({
      kind: "create_task",
      name: "Wiring",
      projectRef: "Falcon",
    });
  });
});
