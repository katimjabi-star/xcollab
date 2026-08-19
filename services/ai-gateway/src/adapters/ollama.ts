import type { ProgramBrief } from "@xcollab/synthesizer";
import type { ModelAdapter } from "../gateway.ts";
import { buildProgramPrompt } from "./anthropic.ts";

/**
 * Sovereign-profile adapter: in-boundary inference over an OpenAI-compatible
 * or Ollama endpoint. Local rehearsal target for the Phase 0 qualification gate.
 */
export class OllamaAdapter implements ModelAdapter {
  readonly id = "ollama";
  readonly modelId: string;
  private readonly baseUrl: string;

  constructor(options: { modelId: string; baseUrl?: string }) {
    this.modelId = options.modelId;
    this.baseUrl = options.baseUrl ?? "http://localhost:11434";
  }

  async generateProgram(brief: ProgramBrief): Promise<unknown> {
    const response = await fetch(`${this.baseUrl}/api/generate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: this.modelId,
        prompt: buildProgramPrompt(brief),
        format: "json",
        stream: false,
      }),
    });
    if (!response.ok) {
      throw new Error(`ollama request failed: ${response.status}`);
    }
    const payload = (await response.json()) as { response: string };
    return JSON.parse(payload.response);
  }
}
