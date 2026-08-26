import { describe, expect, it } from "vitest";
import { buildChatSystemPrompt } from "@xcollab/ai-gateway";
import { CHAT_SNAPSHOT, CHAT_TODAY, GOLDEN_CHATS } from "../golden/chats.ts";
import { driveDeterministicTurn } from "../src/chat-driver.ts";
import { checkReplyLanguage } from "../src/chat-heuristics.ts";

describe("fast evals — deterministic chat adapter golden intents", () => {
  for (const {
    key,
    language,
    utterance,
    expected,
    searchTasksResult,
    listTeamsResult,
    listUsersResult,
  } of GOLDEN_CHATS) {
    it(`golden[${key}] resolves to the expected ${expected.kind}`, async () => {
      const outcome = await driveDeterministicTurn(utterance, {
        today: CHAT_TODAY,
        snapshot: CHAT_SNAPSHOT,
        system: buildChatSystemPrompt({
          language,
          today: CHAT_TODAY,
          workspaceId: "ws-eval",
          username: "jabbir",
        }),
        searchTasksResult,
        listTeamsResult,
        listUsersResult,
      });
      if (expected.kind === "tool_call") {
        expect(outcome.toolCall).toEqual({ name: expected.tool, args: expected.args });
      } else {
        expect(outcome.toolCall).toBeUndefined();
        expect(outcome.text).toContain(expected.contains);
        // Charter invariant 4: a TEXT reply must be in the case's language.
        expect(checkReplyLanguage(language, outcome.text)).toEqual([]);
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
