import type { ProgramBrief } from "@xcollab/synthesizer";
import type { ModelAdapter } from "../gateway.ts";

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
      max_tokens: 4096,
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

export function buildProgramPrompt(brief: ProgramBrief): string {
  return [
    "Design a complete program plan as a single JSON object, no prose.",
    "Required shape: { id, name, mission, language, timeline: {start, end},",
    "teams: [{id, name, kind: 'internal'|'vendor'}],",
    "packages: [{id, name, scope, tasks: [{id, name, status: 'todo', estimateDays}], dependsOn: [packageId]}],",
    "milestones: [{id, name, dueDate}], risks: [{id, title, severity: 'low'|'medium'|'high'|'critical'}] }.",
    "Rules: dependsOn must reference existing package ids and MUST be acyclic;",
    "dates are YYYY-MM-DD inside the timeline; every text field in the brief's language.",
    `Language: ${brief.language}.`,
    brief.timeline ? `Timeline: ${brief.timeline.start} to ${brief.timeline.end}.` : "",
    brief.teamHints?.length ? `Required teams: ${brief.teamHints.join(", ")}.` : "",
    `Mission brief: ${brief.mission}`,
  ]
    .filter(Boolean)
    .join("\n");
}

function extractJson(text: string): string {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("model response contained no JSON object");
  return text.slice(start, end + 1);
}
