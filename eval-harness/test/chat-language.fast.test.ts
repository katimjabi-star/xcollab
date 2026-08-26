import { describe, expect, it } from "vitest";
import { CHAT_SNAPSHOT, CHAT_TODAY, GOLDEN_CHATS } from "../golden/chats.ts";
import { driveDeterministicTurn } from "../src/chat-driver.ts";
import { checkCorpusLanguageParity, checkReplyLanguage } from "../src/chat-heuristics.ts";

/* Charter invariant 4 gates: EN/AR parity of the golden chat corpus, and the
   chat-reply language heuristic. Negative controls follow the pattern of
   heuristics.negative.test.ts: every gate must be shown to FAIL on the defect
   it exists to catch. */

describe("golden chat corpus — EN/AR parity gate", () => {
  it("every expected tool and the text fallback have both an EN and an AR case", () => {
    expect(checkCorpusLanguageParity(GOLDEN_CHATS)).toEqual([]);
  });

  it("negative control: fails when a tool loses its Arabic cases", () => {
    const doctored = GOLDEN_CHATS.filter(
      (c) => !(c.language === "ar" && c.expected.kind === "tool_call" && c.expected.tool === "delete_task"),
    );
    expect(checkCorpusLanguageParity(doctored)).toContain('tool "delete_task" has no ar golden case');
  });

  it("negative control: fails when the text fallback loses its English case", () => {
    const doctored = GOLDEN_CHATS.filter((c) => !(c.language === "en" && c.expected.kind === "text"));
    expect(checkCorpusLanguageParity(doctored)).toContain("text-reply fallback has no en golden case");
  });
});

describe("checkReplyLanguage — chat-reply language heuristic", () => {
  it("passes an Arabic reply for an Arabic case", () => {
    expect(checkReplyLanguage("ar", "يمكنني إنشاء مشروع أو مهمة وتلخيص مشروع.")).toEqual([]);
  });

  it("passes mixed text with majority Arabic (quoted Latin ids/dates allowed)", () => {
    expect(checkReplyLanguage("ar", 'لم أعثر على المهمة "P1" في مشروع منصة التعاون قبل 2026-10-01.')).toEqual([]);
  });

  it("passes an English reply for an English case", () => {
    expect(checkReplyLanguage("en", "I can create a project or task, and summarize a project.")).toEqual([]);
  });

  it("negative control: Arabic expected but English text fails", () => {
    const failures = checkReplyLanguage("ar", "I can create a project or task.");
    expect(failures).toEqual(["expected an Arabic reply but the text is not majority Arabic script"]);
  });

  it("negative control: Arabic expected but Arabic is a minority of the letters fails", () => {
    const failures = checkReplyLanguage("ar", "The task مراجعة was updated successfully by the assistant.");
    expect(failures).toEqual(["expected an Arabic reply but the text is not majority Arabic script"]);
  });

  it("negative control: English expected but majority-Arabic text fails", () => {
    const failures = checkReplyLanguage("en", "يمكنني إنشاء مشروع أو مهمة.");
    expect(failures).toEqual(["expected an English reply but the text is majority Arabic script"]);
  });

  it("negative control: empty or whitespace-only text fails for both languages", () => {
    expect(checkReplyLanguage("ar", "")).toHaveLength(1);
    expect(checkReplyLanguage("en", "   ")).toHaveLength(1);
  });
});

describe("wired language gate — negative control through the real driver", () => {
  it("an out-of-grammar English utterance yields a reply the Arabic gate rejects", async () => {
    const outcome = await driveDeterministicTurn("write me a poem about routers", {
      today: CHAT_TODAY,
      snapshot: CHAT_SNAPSHOT,
    });
    expect(outcome.toolCall).toBeUndefined();
    expect(checkReplyLanguage("en", outcome.text)).toEqual([]);
    expect(checkReplyLanguage("ar", outcome.text)).toEqual([
      "expected an Arabic reply but the text is not majority Arabic script",
    ]);
  });
});
