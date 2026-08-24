import {
  assistantToolDefinition,
  isAssistantMutationTool,
  type AssistantEvent,
  type AssistantReadToolName,
  type ProposalPreview,
} from "@xcollab/core";
import type { ChatAdapter, ChatMessage, ToolSpec } from "@xcollab/ai-gateway";
import { stableStringify, type ProposalStore } from "./assistant-proposals.ts";
import { executeReadTool, type ReadToolContext } from "./assistant-reads.ts";

/**
 * The agent loop (spec §2.5). Reads auto-run through the real GET routes;
 * the FIRST mutating tool call stops the loop at a proposal event — mutation
 * tools have no execute path here, which is the structural confirm gate.
 */

const MODEL_CALL_BUDGET = 6;
const RESULT_DIGEST_LIMIT = 8_192;
const ARGS_SUMMARY_LIMIT = 200;

export interface AssistantLoopDeps {
  adapter: ChatAdapter;
  tools: ToolSpec[];
  system: string;
  proposals: ProposalStore;
  reads: ReadToolContext;
  workspaceId: string;
  username: string;
  emit: (event: AssistantEvent) => Promise<void>;
}

interface PendingToolCall {
  id: string;
  name: string;
  args: unknown;
}

interface ModelTurn {
  toolCalls: PendingToolCall[];
  invalid: { name: string; message: string }[];
  finish: "stop" | "tool_calls" | "length";
}

export async function runAssistantLoop(
  deps: AssistantLoopDeps,
  history: ChatMessage[],
): Promise<void> {
  for (let call = 0; call < MODEL_CALL_BUDGET; call += 1) {
    const turn = await collectModelTurn(deps, history);
    if (turn.toolCalls.length === 0 && turn.invalid.length === 0) {
      await deps.emit({
        type: "done",
        finishReason: turn.finish === "length" ? "length" : "stop",
      });
      return;
    }
    feedInvalidCalls(history, turn.invalid);
    if (await handleToolCalls(deps, history, turn.toolCalls)) return;
  }
  await deps.emit({
    type: "error",
    code: "budget_exhausted",
    message: `turn exceeded the ${MODEL_CALL_BUDGET}-model-call budget`,
  });
}

/** One model call: stream text out, collect tool calls, record the transcript. */
async function collectModelTurn(
  deps: AssistantLoopDeps,
  history: ChatMessage[],
): Promise<ModelTurn> {
  const turn: ModelTurn = { toolCalls: [], invalid: [], finish: "stop" };
  let text = "";
  // Snapshot: the adapter must never observe later mutations of the history.
  const stream = deps.adapter.runTurn({
    system: deps.system,
    messages: [...history],
    tools: deps.tools,
  });
  for await (const event of stream) {
    switch (event.type) {
      case "text_delta":
        text += event.text;
        await deps.emit({ type: "text_delta", text: event.text });
        break;
      case "tool_call":
        turn.toolCalls.push({ id: event.id, name: event.name, args: event.args });
        break;
      case "tool_call_invalid":
        turn.invalid.push({ name: event.name, message: event.message });
        break;
      case "degraded":
        // The fallback adapter restarts the turn; drop the partial transcript.
        text = "";
        turn.toolCalls = [];
        turn.invalid = [];
        break;
      case "finish":
        turn.finish = event.reason;
        break;
    }
  }
  if (text !== "" || turn.toolCalls.length > 0) {
    history.push({
      role: "assistant",
      content: text,
      ...(turn.toolCalls.length === 0 ? {} : { toolCalls: turn.toolCalls }),
    });
  }
  return turn;
}

/** Invalid calls are fed back as data so the model self-corrects (§2.5). */
function feedInvalidCalls(
  history: ChatMessage[],
  invalid: { name: string; message: string }[],
): void {
  for (const failure of invalid) {
    history.push({
      role: "tool_result",
      tool: failure.name,
      content: `error: ${failure.message}`,
    });
  }
}

/** Returns true when the loop must stop (a proposal was emitted). */
async function handleToolCalls(
  deps: AssistantLoopDeps,
  history: ChatMessage[],
  calls: PendingToolCall[],
): Promise<boolean> {
  for (let i = 0; i < calls.length; i += 1) {
    const call = calls[i];
    if (!call) continue;
    const parsed = parseCall(call);
    if (!parsed.ok) {
      history.push({ role: "tool_result", tool: call.name, content: parsed.message });
      continue;
    }
    if (isAssistantMutationTool(call.name)) {
      await emitProposal(deps, call.name, parsed.args, calls.length - i - 1);
      return true;
    }
    await runReadCall(deps, history, call.name as AssistantReadToolName, parsed.args);
  }
  return false;
}

function parseCall(
  call: PendingToolCall,
): { ok: true; args: Record<string, unknown> } | { ok: false; message: string } {
  const definition = assistantToolDefinition(call.name);
  if (!definition) return { ok: false, message: `error: unknown tool "${call.name}"` };
  const parsed = definition.args.safeParse(call.args);
  if (!parsed.success) {
    return { ok: false, message: `error: invalid args: ${parsed.error.message}` };
  }
  return { ok: true, args: parsed.data as Record<string, unknown> };
}

async function runReadCall(
  deps: AssistantLoopDeps,
  history: ChatMessage[],
  tool: AssistantReadToolName,
  args: Record<string, unknown>,
): Promise<void> {
  await deps.emit({
    type: "tool_started",
    tool,
    argsSummary: stableStringify(args).slice(0, ARGS_SUMMARY_LIMIT),
  });
  const outcome = await executeReadTool(deps.reads, tool, args);
  await deps.emit({ type: "tool_result", tool, result: outcome.result });
  const digest = truncateResultJson(outcome.result, RESULT_DIGEST_LIMIT);
  history.push({
    role: "tool_result",
    tool,
    content: outcome.ok ? digest : `error: ${digest}`,
  });
}

/**
 * 8KB result cap (spec §2.5/§5) that keeps the digest VALID JSON: oversize
 * results shed trailing array items (top level, or one level down) instead of
 * being sliced mid-token — a sliced digest would be unparseable to the model
 * and to the deterministic adapter's snapshot recovery.
 */
function truncateResultJson(result: unknown, limit: number): string {
  let json = JSON.stringify(result);
  if (json.length <= limit) return json;
  const clone: unknown = JSON.parse(json);
  const arrays: unknown[][] = [];
  if (Array.isArray(clone)) arrays.push(clone);
  else if (clone !== null && typeof clone === "object") {
    for (const value of Object.values(clone)) {
      if (Array.isArray(value)) arrays.push(value);
    }
  }
  while (json.length > limit && arrays.some((entries) => entries.length > 0)) {
    const longest = arrays.reduce((a, b) => (a.length >= b.length ? a : b));
    longest.pop();
    json = JSON.stringify(clone);
  }
  // Pathological single-item oversize: hard slice as the last resort.
  return json.length <= limit ? json : json.slice(0, limit);
}

/** One proposal per turn: later calls in the same model message are dropped. */
async function emitProposal(
  deps: AssistantLoopDeps,
  tool: string,
  args: Record<string, unknown>,
  droppedCalls: number,
): Promise<void> {
  if (droppedCalls > 0) {
    await deps.emit({
      type: "text_delta",
      text: `\n(One action per turn: ${droppedCalls} additional tool call(s) were not run.)`,
    });
  }
  const proposalId = deps.proposals.mint({
    workspaceId: deps.workspaceId,
    username: deps.username,
    tool,
    argsKey: stableStringify(args),
    modelId: deps.adapter.modelId,
  });
  await deps.emit({ type: "proposal", proposalId, tool, args, preview: buildPreview(tool, args) });
  await deps.emit({ type: "done", finishReason: "proposal" });
}

function buildPreview(tool: string, args: Record<string, unknown>): ProposalPreview {
  const fields: ProposalPreview["fields"] = [];
  for (const [key, value] of Object.entries(args)) {
    if (value === undefined) continue;
    if (key === "patch" && value !== null && typeof value === "object" && !Array.isArray(value)) {
      for (const [field, change] of Object.entries(value as Record<string, unknown>)) {
        if (change !== undefined) fields.push({ label: field, value: renderValue(change) });
      }
      continue;
    }
    fields.push({ label: key, value: renderValue(value) });
  }
  return { title: tool, fields };
}

function renderValue(value: unknown): string {
  return typeof value === "string" ? value : stableStringify(value);
}
