import { findDependencyCycle, ProgramSchema, type Program } from "@xcollab/core";
import { synthesizeProgram, type ProgramBrief } from "@xcollab/synthesizer";

/**
 * A model adapter produces an UNVALIDATED candidate program. Validation and
 * acyclicity are enforced here, at the seam, for every adapter equally.
 */
export interface ModelAdapter {
  id: string;
  modelId: string;
  generateProgram(brief: ProgramBrief): Promise<unknown>;
}

/** Everything services/api needs to append a ledger entry for this call. */
export interface InteractionMetadata {
  adapterId: string;
  modelId: string;
  input: string;
  output: string;
  degradedFrom?: string;
}

export class ProgramGenerationError extends Error {
  readonly adapterId: string;

  constructor(message: string, adapterId: string) {
    super(message);
    this.name = "ProgramGenerationError";
    this.adapterId = adapterId;
  }
}

export interface GenerationResult {
  program: Program;
  interaction: InteractionMetadata;
}

export class AiGateway {
  private readonly adapters: ModelAdapter[];

  constructor(adapters: ModelAdapter[]) {
    this.adapters = adapters;
  }

  async generateProgram(brief: ProgramBrief): Promise<GenerationResult> {
    const input = JSON.stringify(brief);
    const adapter = this.adapters[0];

    if (!adapter) return this.synthesize(brief, input);

    let candidate: unknown;
    try {
      candidate = await adapter.generateProgram(brief);
    } catch (error) {
      // Adapter failure degrades to the deterministic path — never an outage,
      // but the degrade must be operator-visible (status/message only, no key).
      console.error(
        `generation adapter degraded: ${adapter.id} -> deterministic: ${error instanceof Error ? error.message : String(error)}`,
      );
      return this.synthesize(brief, input, adapter.id);
    }

    const parsed = ProgramSchema.safeParse(candidate);
    if (!parsed.success) {
      throw new ProgramGenerationError(
        `adapter "${adapter.id}" produced schema-invalid output: ${parsed.error.message}`,
        adapter.id,
      );
    }
    const cycle = findDependencyCycle(parsed.data.packages);
    if (cycle) {
      throw new ProgramGenerationError(
        `adapter "${adapter.id}" produced a dependency cycle: ${cycle.join(" -> ")}`,
        adapter.id,
      );
    }

    return {
      program: parsed.data,
      interaction: {
        adapterId: adapter.id,
        modelId: adapter.modelId,
        input,
        output: JSON.stringify(parsed.data),
      },
    };
  }

  private synthesize(brief: ProgramBrief, input: string, degradedFrom?: string): GenerationResult {
    // Same seam contract as adapters: no candidate reaches the caller unvalidated.
    const parsed = ProgramSchema.safeParse(synthesizeProgram(brief));
    if (!parsed.success) {
      throw new ProgramGenerationError(
        `synthesizer produced schema-invalid output: ${parsed.error.message}`,
        "synthesizer",
      );
    }
    const program = parsed.data;
    const interaction: InteractionMetadata = {
      adapterId: "synthesizer",
      modelId: "deterministic-synthesizer",
      input,
      output: JSON.stringify(program),
      ...(degradedFrom === undefined ? {} : { degradedFrom }),
    };
    return { program, interaction };
  }
}
