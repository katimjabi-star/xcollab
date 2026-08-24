import type { AssistantEvent } from "@xcollab/core";
import type { ChatAdapter, ChatEvent, ChatTurnRequest } from "@xcollab/ai-gateway";

/**
 * Scripted ChatAdapter: each runTurn replays the next event batch. Lets the
 * integration tests drive the loop deterministically without a model.
 */
export class ScriptedChatAdapter implements ChatAdapter {
  readonly id = "scripted";
  readonly modelId = "scripted-model";
  private readonly script: ChatEvent[][];
  private turn = 0;
  readonly requests: ChatTurnRequest[] = [];

  constructor(script: ChatEvent[][]) {
    this.script = script;
  }

  async *runTurn(req: ChatTurnRequest): AsyncGenerator<ChatEvent> {
    this.requests.push(req);
    const events = this.script[this.turn] ?? [{ type: "finish", reason: "stop" }];
    this.turn += 1;
    yield* events;
  }
}

/** Drains an SSE response body into the typed assistant events it carried. */
export async function readSseEvents(res: Response): Promise<AssistantEvent[]> {
  const text = await res.text();
  const events: AssistantEvent[] = [];
  for (const block of text.split("\n\n")) {
    const data = block
      .split("\n")
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trimStart())
      .join("\n");
    if (data) events.push(JSON.parse(data) as AssistantEvent);
  }
  return events;
}

export function eventsOfType<T extends AssistantEvent["type"]>(
  events: AssistantEvent[],
  type: T,
): Extract<AssistantEvent, { type: T }>[] {
  return events.filter((event): event is Extract<AssistantEvent, { type: T }> => {
    return event.type === type;
  });
}
