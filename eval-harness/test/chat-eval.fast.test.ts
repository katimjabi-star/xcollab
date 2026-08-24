import { describe, expect, it } from "vitest";
import { CHAT_SNAPSHOT, CHAT_TODAY, GOLDEN_CHATS } from "../golden/chats.ts";
import { driveDeterministicTurn } from "../src/chat-driver.ts";

describe("fast evals — deterministic chat adapter golden intents", () => {
  for (const { key, utterance, expected } of GOLDEN_CHATS) {
    it(`golden[${key}] resolves to the expected ${expected.kind}`, async () => {
      const outcome = await driveDeterministicTurn(utterance, {
        today: CHAT_TODAY,
        snapshot: CHAT_SNAPSHOT,
      });
      if (expected.kind === "tool_call") {
        expect(outcome.toolCall).toEqual({ name: expected.tool, args: expected.args });
      } else {
        expect(outcome.toolCall).toBeUndefined();
        expect(outcome.text).toContain(expected.contains);
      }
    });
  }

  it("is reproducible: the same case yields an identical outcome twice", async () => {
    const run = () =>
      driveDeterministicTurn("mark Field kit audit as done", {
        today: CHAT_TODAY,
        snapshot: CHAT_SNAPSHOT,
      });
    expect(await run()).toEqual(await run());
  });
});
