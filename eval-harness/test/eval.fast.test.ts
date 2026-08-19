import { describe, expect, it } from "vitest";
import { AiGateway } from "@xcollab/ai-gateway";
import { synthesizeProgram } from "@xcollab/synthesizer";
import { GOLDEN_BRIEFS } from "../golden/briefs.ts";
import { runHeuristics } from "../src/heuristics.ts";

describe("fast evals — deterministic synthesizer baseline", () => {
  for (const { key, brief } of GOLDEN_BRIEFS) {
    it(`golden[${key}] passes every heuristic`, () => {
      const report = runHeuristics(brief, synthesizeProgram(brief));
      expect(report.failures).toEqual([]);
      expect(report.pass).toBe(true);
    });
  }
});

describe("fast evals — gateway zero-connectivity path", () => {
  for (const { key, brief } of GOLDEN_BRIEFS) {
    it(`golden[${key}] generates and validates through the gateway`, async () => {
      const { program, interaction } = await new AiGateway([]).generateProgram(brief);
      expect(runHeuristics(brief, program).pass).toBe(true);
      expect(interaction.modelId).toBe("deterministic-synthesizer");
      expect(interaction.input).toContain(brief.mission);
    });
  }
});
