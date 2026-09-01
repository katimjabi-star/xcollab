import { describe, expect, it } from "vitest";
import { buildProgramPrompt } from "../../../services/ai-gateway/src/program-prompt.ts";
import { buildRelayProgramPrompt, extractJson } from "../lib/demo-ai.ts";

describe("browser-relay prompt parity", () => {
  it("produces byte-identical prompts to the gateway for every brief shape", () => {
    const briefs = [
      { mission: "Launch portal", language: "en" as const },
      {
        mission: "أطلق البوابة",
        language: "ar" as const,
        timeline: { start: "2026-09-01", end: "2026-12-01" },
      },
      {
        mission: "Full brief",
        language: "en" as const,
        timeline: { start: "2026-01-01", end: "2026-06-30" },
        teamHints: ["Design", "Platform"],
      },
    ];
    for (const brief of briefs) {
      expect(buildRelayProgramPrompt(brief)).toBe(buildProgramPrompt(brief));
    }
  });
});

describe("extractJson", () => {
  it("strips prose around the JSON object", () => {
    expect(extractJson('Sure! Here is the plan:\n{"a":1}\nHope it helps')).toBe('{"a":1}');
  });

  it("throws when no JSON object is present", () => {
    expect(() => extractJson("no json here")).toThrow();
  });
});
