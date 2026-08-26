import type { Language } from "@xcollab/core";

/**
 * Chat-reply language heuristics — Charter invariant 4 (every generation
 * feature is evaluated in both languages). Model-free, so usable both by the
 * fast PR gate (deterministic adapter) and the nightly judge layer over live
 * model replies.
 */

/** Arabic-script block (U+0600–U+06FF) — same check the program heuristics use. */
export const ARABIC_SCRIPT = /[؀-ۿ]/;

const ARABIC_LETTERS = new RegExp(ARABIC_SCRIPT.source, "g");
const LATIN_LETTERS = /[a-z]/gi;

function countMatches(text: string, pattern: RegExp): number {
  return text.match(pattern)?.length ?? 0;
}

/**
 * Checks that a TEXT reply is in the expected language. Majority rule over
 * letter counts so replies quoting the other script (ids, ISO dates, quoted
 * names) still pass: Arabic cases must be majority Arabic script; English
 * cases must not be. Empty text always fails — a silent reply proves nothing.
 */
export function checkReplyLanguage(language: Language, text: string): string[] {
  if (text.trim() === "") {
    return [`expected a ${language} reply but the text is empty`];
  }
  const arabic = countMatches(text, ARABIC_LETTERS);
  const latin = countMatches(text, LATIN_LETTERS);
  const majorityArabic = arabic > latin;
  if (language === "ar" && !majorityArabic) {
    return ["expected an Arabic reply but the text is not majority Arabic script"];
  }
  if (language === "en" && majorityArabic) {
    return ["expected an English reply but the text is majority Arabic script"];
  }
  return [];
}

/** Structural view of a golden chat case — only what the parity gate reads. */
export interface CorpusLanguageCase {
  language: Language;
  expected: { kind: "tool_call"; tool: string } | { kind: "text" };
}

/**
 * EN/AR corpus parity gate. Guarantees: every tool the corpus expects the
 * assistant to propose (mutations and reads alike) is exercised by at least
 * one English AND one Arabic golden case, and the no-tool TEXT fallback is
 * exercised in both languages. It does NOT guarantee 1:1 utterance pairing —
 * single-language edge-case variants (e.g. quoted-name stripping) are allowed
 * as long as their intent family is covered in both languages.
 */
export function checkCorpusLanguageParity(cases: readonly CorpusLanguageCase[]): string[] {
  const failures: string[] = [];
  const languagesByTool = new Map<string, Set<Language>>();
  const textLanguages = new Set<Language>();
  for (const c of cases) {
    if (c.expected.kind === "text") {
      textLanguages.add(c.language);
      continue;
    }
    const languages = languagesByTool.get(c.expected.tool) ?? new Set<Language>();
    languages.add(c.language);
    languagesByTool.set(c.expected.tool, languages);
  }
  for (const [tool, languages] of languagesByTool) {
    for (const language of ["en", "ar"] as const) {
      if (!languages.has(language)) failures.push(`tool "${tool}" has no ${language} golden case`);
    }
  }
  for (const language of ["en", "ar"] as const) {
    if (!textLanguages.has(language)) {
      failures.push(`text-reply fallback has no ${language} golden case`);
    }
  }
  return failures;
}
