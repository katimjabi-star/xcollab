import { findDependencyCycle, ProgramSchema } from "@xcollab/core";
import {
  createProgram,
  request,
  type CreateProgramInput,
  type CreateProgramResult,
} from "./api-client.ts";

/**
 * Browser-relay demo AI. The k2 cluster has no internet egress, so in demo
 * mode the OPERATOR'S BROWSER calls Anthropic directly and hands the result
 * to the cluster API, which re-validates and ledgers it as client-supplied.
 *
 * The key is pasted by the demo operator (Settings), lives ONLY in this
 * tab's sessionStorage, rides only the direct browser→Anthropic request,
 * and is never sent to the cluster or baked into the bundle. Keyless
 * browsers keep the normal server-side path (in-cluster engine).
 */
const KEY_STORAGE = "xcollab.demoAiKey";
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
/** Cost-tiered: synthesis is the hard task, chat replies are not. */
const PROGRAM_MODEL = "claude-sonnet-5";
const CHAT_MODEL = "claude-haiku-4-5-20251001";

export function getDemoKey(): string | null {
  try {
    return window.sessionStorage.getItem(KEY_STORAGE);
  } catch {
    return null;
  }
}

export function setDemoKey(key: string): void {
  try {
    if (key) window.sessionStorage.setItem(KEY_STORAGE, key);
    else window.sessionStorage.removeItem(KEY_STORAGE);
  } catch {
    /* storage unavailable — demo mode simply stays off */
  }
}

async function anthropic(
  key: string,
  body: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<string> {
  const response = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": key,
      "anthropic-version": ANTHROPIC_VERSION,
      // Anthropic's explicit browser-use opt-in. Safe HERE because the key is
      // the operator's own, session-scoped, never shipped in the bundle.
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify(body),
    ...(signal ? { signal } : {}),
  });
  if (!response.ok) throw new Error(`anthropic → ${response.status}`);
  const data = (await response.json()) as { content: { type: string; text?: string }[] };
  return data.content
    .map((block) => (block.type === "text" && typeof block.text === "string" ? block.text : ""))
    .join("");
}

/** Mirror of services/ai-gateway/src/program-prompt.ts (kept in sync by the
    relay parity test) — duplicated because the web bundle must not depend on
    the gateway package. */
export function buildRelayProgramPrompt(brief: {
  mission: string;
  language: string;
  timeline?: { start: string; end: string };
  teamHints?: string[];
}): string {
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

export function extractJson(text: string): string {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("model response contained no JSON object");
  return text.slice(start, end + 1);
}

interface ImportProgramInput {
  workspaceId: string;
  mission: string;
  language: "en" | "ar";
  modelId: string;
  /** Full generated program — the API re-validates schema + acyclicity. */
  program: unknown;
  parentId?: string;
  teamId?: string;
}

function importProgram(base: string, input: ImportProgramInput): Promise<CreateProgramResult> {
  return request<CreateProgramResult>(`${base}/api/programs/import`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
}

/** Same-signature drop-in for createProgram: relays through the browser when
    the demo key is present, and NEVER breaks the flow — any relay failure
    falls back to the server-side path (in-cluster engine). */
export async function createProgramSmart(
  base: string,
  input: CreateProgramInput,
): Promise<CreateProgramResult> {
  const key = getDemoKey();
  if (!key) return createProgram(base, input);
  try {
    const text = await anthropic(key, {
      model: PROGRAM_MODEL,
      max_tokens: 16384,
      messages: [{ role: "user", content: buildRelayProgramPrompt(input) }],
    });
    // Client-side pre-check for fast feedback; the API re-validates anyway.
    const program = ProgramSchema.parse(JSON.parse(extractJson(text)));
    if (findDependencyCycle(program.packages)) throw new Error("dependency cycle");
    return await importProgram(base, {
      workspaceId: input.workspaceId,
      mission: input.mission,
      language: input.language,
      modelId: PROGRAM_MODEL,
      program,
      ...(input.parentId ? { parentId: input.parentId } : {}),
      ...(input.teamId ? { teamId: input.teamId } : {}),
    });
  } catch {
    return createProgram(base, input);
  }
}

/** One relay chat turn: workspace context + transcript → Claude. Read-only —
    proposals/actions stay with the in-cluster assistant. */
export async function relayChatTurn(
  transcript: { role: "user" | "assistant"; content: string }[],
  context: { language: "en" | "ar"; programsDigest: string },
  signal?: AbortSignal,
): Promise<string> {
  const key = getDemoKey();
  if (!key) throw new Error("no demo key");
  return anthropic(
    key,
    {
      model: CHAT_MODEL,
      max_tokens: 1024,
      system: [
        "You are the XCollab assistant — an AI-native work-management platform.",
        `Answer in ${context.language === "ar" ? "Arabic" : "English"}, concise and concrete.`,
        "You are in demo relay mode: you can discuss and advise on the workspace",
        "below, but you cannot execute actions — point the user at the UI instead.",
        `Workspace snapshot:\n${context.programsDigest}`,
      ].join("\n"),
      messages: transcript,
    },
    signal,
  );
}
