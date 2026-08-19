import { describe, expect, it } from "vitest";
import { synthesizeProgram, type ProgramBrief } from "@xcollab/synthesizer";
import { AiGateway, ProgramGenerationError, type ModelAdapter } from "../src/index.ts";

const brief: ProgramBrief = {
  mission: "Field logistics coordination platform",
  language: "en",
  timeline: { start: "2026-09-01", end: "2026-10-30" },
};

function fakeAdapter(produce: (b: ProgramBrief) => unknown): ModelAdapter {
  return {
    id: "fake",
    modelId: "fake-model-1",
    generateProgram: (b) => Promise.resolve(produce(b)),
  };
}

describe("AiGateway.generateProgram", () => {
  it("returns a schema-valid program plus ledgerable interaction metadata", async () => {
    const gateway = new AiGateway([fakeAdapter((b) => synthesizeProgram(b))]);
    const { program, interaction } = await gateway.generateProgram(brief);
    expect(program.mission).toBe(brief.mission);
    expect(interaction.adapterId).toBe("fake");
    expect(interaction.modelId).toBe("fake-model-1");
    expect(interaction.input).toContain(brief.mission);
    expect(interaction.output.length).toBeGreaterThan(0);
  });

  it("falls back to the deterministic synthesizer when no adapter is registered", async () => {
    const gateway = new AiGateway([]);
    const { program, interaction } = await gateway.generateProgram(brief);
    expect(interaction.adapterId).toBe("synthesizer");
    expect(interaction.modelId).toBe("deterministic-synthesizer");
    expect(program.timeline).toEqual(brief.timeline);
  });

  it("rejects adapter output that fails the schema", async () => {
    const gateway = new AiGateway([fakeAdapter(() => ({ nonsense: true }))]);
    await expect(gateway.generateProgram(brief)).rejects.toBeInstanceOf(ProgramGenerationError);
  });

  it("rejects adapter output containing a dependency cycle", async () => {
    const cyclic = () => {
      const program = synthesizeProgram(brief);
      const [first] = program.packages;
      if (first) first.dependsOn = [program.packages.at(-1)?.id ?? ""];
      return program;
    };
    const gateway = new AiGateway([fakeAdapter(cyclic)]);
    await expect(gateway.generateProgram(brief)).rejects.toBeInstanceOf(ProgramGenerationError);
  });

  it("falls back to the synthesizer when the adapter itself fails", async () => {
    const failing: ModelAdapter = {
      id: "flaky",
      modelId: "flaky-model",
      generateProgram: () => Promise.reject(new Error("upstream unavailable")),
    };
    const gateway = new AiGateway([failing]);
    const { interaction } = await gateway.generateProgram(brief);
    expect(interaction.adapterId).toBe("synthesizer");
    expect(interaction.degradedFrom).toBe("flaky");
  });
});

describe("AnthropicAdapter availability", () => {
  it("refuses to construct without an API key", async () => {
    const { AnthropicAdapter } = await import("../src/adapters/anthropic.ts");
    expect(() => new AnthropicAdapter({ apiKey: "" })).toThrow(/api key/i);
  });
});
