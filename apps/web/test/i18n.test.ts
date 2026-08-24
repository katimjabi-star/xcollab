import { describe, expect, it } from "vitest";
import { formatDayCount, formatMemberCount, STRINGS, type UiLanguage } from "../lib/i18n.ts";

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

describe("count pluralization (fix-wave-C)", () => {
  it("pluralizes day counts in English", () => {
    expect(formatDayCount(STRINGS.en, 1)).toBe("1 day");
    expect(formatDayCount(STRINGS.en, 2)).toBe("2 days");
    expect(formatDayCount(STRINGS.en, 5)).toBe("5 days");
  });

  it("uses Arabic singular/dual/plural day forms", () => {
    expect(formatDayCount(STRINGS.ar, 1)).toBe("يوم واحد");
    expect(formatDayCount(STRINGS.ar, 2)).toBe("يومان");
    expect(formatDayCount(STRINGS.ar, 5)).toBe("5 أيام");
  });

  it("pluralizes member counts in both languages", () => {
    expect(formatMemberCount(STRINGS.en, 1)).toBe("1 member");
    expect(formatMemberCount(STRINGS.en, 3)).toBe("3 members");
    expect(formatMemberCount(STRINGS.ar, 1)).toBe("عضو واحد");
    expect(formatMemberCount(STRINGS.ar, 2)).toBe("عضوان");
    expect(formatMemberCount(STRINGS.ar, 4)).toBe("4 أعضاء");
  });
});
