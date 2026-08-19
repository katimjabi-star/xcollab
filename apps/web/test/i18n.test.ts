import { describe, expect, it } from "vitest";
import { STRINGS, type UiLanguage } from "../lib/i18n.ts";

const ARABIC_PATTERN = /[؀-ۿ]/;

describe("i18n dictionaries", () => {
  it("has identical key sets for en and ar (Arabic parity gate)", () => {
    expect(Object.keys(STRINGS.ar).sort()).toEqual(Object.keys(STRINGS.en).sort());
  });

  it("has no empty strings in either language", () => {
    for (const lang of ["en", "ar"] as UiLanguage[]) {
      for (const [key, value] of Object.entries(STRINGS[lang])) {
        expect(value.trim(), `${lang}.${key}`).not.toBe("");
      }
    }
  });

  it("renders Arabic script for core Arabic strings", () => {
    expect(STRINGS.ar.missionLabel).toMatch(ARABIC_PATTERN);
    expect(STRINGS.ar.generate).toMatch(ARABIC_PATTERN);
    expect(STRINGS.ar.tagline).toMatch(ARABIC_PATTERN);
  });
});
