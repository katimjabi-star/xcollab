import { describe, expect, it } from "vitest";
import { parseUtterance, stripQuotes } from "../src/adapters/deterministic-intent.ts";

/**
 * Defect 2 coverage: quoted names/refs must lose their delimiting quotes
 * (straight, curly, and Arabic-style guillemets) while any inner quotes
 * survive. Split out of deterministic-intent.test.ts to keep that file
 * under the repo's max-lines budget.
 */

const TODAY = "2026-08-24";

describe("stripQuotes", () => {
  it("strips a straight-double-quote pair", () => {
    expect(stripQuotes('"P1"')).toBe("P1");
  });

  it("strips curly typographic quotes", () => {
    expect(stripQuotes("“P1”")).toBe("P1");
  });

  it("strips Arabic-style guillemets", () => {
    expect(stripQuotes("«P1»")).toBe("P1");
  });

  it("leaves an unquoted value untouched", () => {
    expect(stripQuotes("P1")).toBe("P1");
  });

  it("leaves a mismatched delimiter pair untouched", () => {
    expect(stripQuotes('"P1”')).toBe('"P1”');
  });

  it("only removes the outermost pair, keeping inner quotes", () => {
    expect(stripQuotes('"the "best" plan"')).toBe('the "best" plan');
  });

  it("leaves a lone quote character untouched", () => {
    expect(stripQuotes('"')).toBe('"');
  });
});

describe("quoted spans lose their delimiters in the parsed intent", () => {
  it("[en] strips straight quotes from a create_task name and project ref", () => {
    expect(parseUtterance('add task "P1" to "Coastal Readiness Cell"', TODAY)).toEqual({
      language: "en",
      intent: { kind: "create_task", name: "P1", projectRef: "Coastal Readiness Cell" },
    });
  });

  it("[en] strips curly quotes from a task ref in a set_status utterance", () => {
    expect(parseUtterance("mark “Field kit audit” as done", TODAY)).toEqual({
      language: "en",
      intent: { kind: "set_status", taskRef: "Field kit audit", status: "done" },
    });
  });

  it("[en] strips quotes from a project ref in summarize", () => {
    expect(parseUtterance('summarize "Falcon Rollout"', TODAY)).toEqual({
      language: "en",
      intent: { kind: "summarize", projectRef: "Falcon Rollout" },
    });
  });

  it("[ar] strips Arabic guillemets from a create_task name and project ref", () => {
    expect(parseUtterance("أضف مهمة «فحص الكابلات» في «منصة التعاون»", TODAY)).toEqual({
      language: "ar",
      intent: { kind: "create_task", name: "فحص الكابلات", projectRef: "منصة التعاون" },
    });
  });

  it("[ar] strips quotes from a task ref in a set_status utterance", () => {
    expect(parseUtterance('علّم "مراجعة الواجهة" كمنجزة', TODAY)).toEqual({
      language: "ar",
      intent: { kind: "set_status", taskRef: "مراجعة الواجهة", status: "done" },
    });
  });
});
