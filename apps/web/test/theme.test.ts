import { describe, expect, it } from "vitest";
import { cycleThemeMode, resolveTheme, THEME_STORAGE_KEY, type ThemeMode } from "../lib/theme.ts";

describe("theme mode (KDS three-valued contract)", () => {
  it("cycles light → dark → system → light", () => {
    expect(cycleThemeMode("light")).toBe("dark");
    expect(cycleThemeMode("dark")).toBe("system");
    expect(cycleThemeMode("system")).toBe("light");
  });

  it("pins light and dark regardless of the system setting", () => {
    for (const systemDark of [true, false]) {
      expect(resolveTheme("light", systemDark)).toBe("light");
      expect(resolveTheme("dark", systemDark)).toBe("dark");
    }
  });

  it("only system mode consults the OS", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
  });

  it("uses the shared storage key contract", () => {
    expect(THEME_STORAGE_KEY).toBe("xcollab.theme");
  });

  it("treats unknown persisted values as system", () => {
    expect(resolveTheme("bogus" as ThemeMode, true)).toBe("dark");
    expect(resolveTheme("bogus" as ThemeMode, false)).toBe("light");
  });
});
