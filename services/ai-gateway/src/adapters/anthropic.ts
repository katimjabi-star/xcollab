import type { ProgramBrief } from "@xcollab/synthesizer";
import type { ModelAdapter } from "../gateway.ts";
import { buildProgramPrompt } from "../program-prompt.ts";

const DEFAULT_MODEL = "claude-sonnet-5";

/**
 * Connected-profile adapter. Excluded from Sovereign builds at compile time
 * (Charter invariant 3). Synthetic or cleared data only — never mission data.
 */
export class AnthropicAdapter implements ModelAdapter {
  readonly id = "anthropic";
  readonly modelId: string;
  private readonly apiKey: string;

  constructor(options: { apiKey: string; modelId?: string }) {
    if (!options.apiKey) {
      throw new Error("AnthropicAdapter requires an API key (ANTHROPIC_API_KEY)");
    }
    this.apiKey = options.apiKey;
    this.modelId = options.modelId ?? DEFAULT_MODEL;
  }

  async generateProgram(brief: ProgramBrief): Promise<unknown> {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic({ apiKey: this.apiKey });
    const response = await client.messages.create({
      model: this.modelId,
      // Large programs (10+ packages) exceed 4K output tokens and a truncated
      // JSON body silently degrades generation to the deterministic template.
      max_tokens: 16384,
      messages: [{ role: "user", content: buildProgramPrompt(brief) }],
    });
    const text = response.content
      .map((block: { type: string; text?: string }) =>
        block.type === "text" && typeof block.text === "string" ? block.text : "",
      )
      .join("");
    return JSON.parse(extractJson(text));
  }
}

function extractJson(text: string): string {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("model response contained no JSON object");
  return text.slice(start, end + 1);
}
