import {
  ASSISTANT_TOOLS,
  ChatGateway,
  DeterministicChatAdapter,
  type ChatEvent,
  type ChatMessage,
} from "@xcollab/ai-gateway";

/**
 * Minimal stand-in for the services/api agent loop, for evals only: runs the
 * deterministic adapter through the validating ChatGateway seam and answers
 * its list_projects snapshot requests from a fixed fixture. No network, no
 * api dependency — the harness stays <60s and offline (Charter fast evals).
 */

export interface ChatTurnOutcome {
  toolCall?: { name: string; args: unknown };
  text: string;
}

const TURN_BUDGET = 3;

export async function driveDeterministicTurn(
  utterance: string,
  options: {
    today: string;
    snapshot: unknown;
    searchTasksResult?: unknown;
    listTeamsResult?: unknown;
    listUsersResult?: unknown;
  },
): Promise<ChatTurnOutcome> {
  const gateway = new ChatGateway([new DeterministicChatAdapter({ today: options.today })]);
  const messages: ChatMessage[] = [{ role: "user", content: utterance }];
  /** Tool results the driver auto-answers from a fixture, feeding a fresh turn. */
  const autoAnswered: Record<string, unknown> = { list_projects: options.snapshot };
  if (options.searchTasksResult !== undefined) autoAnswered.search_tasks = options.searchTasksResult;
  if (options.listTeamsResult !== undefined) autoAnswered.list_teams = options.listTeamsResult;
  if (options.listUsersResult !== undefined) autoAnswered.list_users = options.listUsersResult;

  for (let turn = 0; turn < TURN_BUDGET; turn += 1) {
    const events = await collect(
      gateway.runTurn({ system: "", messages, tools: [...ASSISTANT_TOOLS] }),
    );
    const invalid = events.find((e) => e.type === "tool_call_invalid");
    if (invalid && invalid.type === "tool_call_invalid") {
      throw new Error(`gateway rejected a tool call: ${invalid.message}`);
    }
    const text = events
      .filter((e): e is Extract<ChatEvent, { type: "text_delta" }> => e.type === "text_delta")
      .map((e) => e.text)
      .join("");
    const call = events.find((e): e is Extract<ChatEvent, { type: "tool_call" }> => e.type === "tool_call");
    if (!call) return { text };
    if (!(call.name in autoAnswered)) {
      return { toolCall: { name: call.name, args: call.args }, text };
    }
    messages.push(
      { role: "assistant", content: "", toolCalls: [{ id: call.id, name: call.name, args: call.args }] },
      {
        role: "tool_result",
        tool: call.name,
        content: JSON.stringify(autoAnswered[call.name]),
        toolCallId: call.id,
      },
    );
  }
  throw new Error(`turn budget exhausted for utterance: ${utterance}`);
}

async function collect(iterable: AsyncIterable<ChatEvent>): Promise<ChatEvent[]> {
  const events: ChatEvent[] = [];
  for await (const event of iterable) events.push(event);
  return events;
}
