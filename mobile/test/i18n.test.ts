import { describe, expect, it } from "vitest";
import { ar, en } from "../src/lib/i18n";

describe("i18n EN/AR parity", () => {
  it("has the same keys in both languages", () => {
    expect(Object.keys(ar).sort()).toEqual(Object.keys(en).sort());
  });

  it("has no empty strings", () => {
    for (const strings of [en, ar]) {
      for (const [key, value] of Object.entries(strings)) {
        expect(value.length, `empty string for ${key}`).toBeGreaterThan(0);
      }
    }
  });
});
