/**
 * Three-valued theme contract shared with the Katim mobile apps: the UI must
 * NOT follow the OS unless the user chose "system" — "light" and "dark" pin
 * the theme regardless of the device setting.
 */
export type ThemeMode = "light" | "dark" | "system";

export const THEME_STORAGE_KEY = "xcollab.theme";

const CYCLE: Record<ThemeMode, ThemeMode> = { light: "dark", dark: "system", system: "light" };

export function cycleThemeMode(mode: ThemeMode): ThemeMode {
  return CYCLE[mode] ?? "light";
}

export function resolveTheme(mode: ThemeMode, systemDark: boolean): "light" | "dark" {
  if (mode === "light" || mode === "dark") return mode;
  return systemDark ? "dark" : "light";
}
