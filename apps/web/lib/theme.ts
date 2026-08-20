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

/**
 * Persist a mode and stamp it on <html> (browser only — callers are event
 * handlers). "system" removes the override so the prefers-color-scheme
 * token block applies, matching the layout's pre-paint bootstrap script.
 */
export function setThemeMode(mode: ThemeMode): void {
  window.localStorage.setItem(THEME_STORAGE_KEY, mode);
  if (mode === "system") {
    delete document.documentElement.dataset.theme;
  } else {
    document.documentElement.dataset.theme = mode;
  }
}
