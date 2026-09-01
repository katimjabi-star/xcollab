/**
 * KDS dark-mode tokens, ported 1:1 from apps/web/app/styles/tokens.css
 * (EDGE Brand Guidelines V9 / 2026-08 design-language brief). The mobile app
 * ships dark-only for now — the web's dark theme is the reference surface.
 *
 * Dark elevation = surface ladder + white-alpha borders, ZERO shadows.
 * Type: 13px UI base — hierarchy via weight + color, not size.
 */
export const colors = {
  background: "#121212",
  card: "#212121",
  surface: "#1e1e1e",
  surfaceSidebar: "#1a1a1a",
  sheet: "#262626",
  border: "rgba(255, 255, 255, 0.10)",
  borderStrong: "rgba(255, 255, 255, 0.16)",
  hairline: "rgba(242, 242, 243, 0.07)",
  inputLine: "rgba(176, 178, 181, 0.4)",
  text: "#ffffff",
  textHigh: "rgba(255, 255, 255, 0.85)",
  textMedium: "rgba(255, 255, 255, 0.65)",
  textLow: "rgba(255, 255, 255, 0.35)",
  subtext: "#aaaaaa",
  brand: "#ff5622",
  buttonPrimary: "#f55c36",
  textBrand: "#f55c36",
  onPrimary: "#ffffff",
  chipSelected: "#341a14",
  chipSelectedBorder: "#792f15",
  success: "#32d74b",
  successTint: "rgba(50, 215, 75, 0.14)",
  error: "#ff453a",
  errorTint: "rgba(255, 69, 58, 0.14)",
  surfaceThin: "rgba(179, 180, 181, 0.12)",
  avatarBg: "#3d3d3d",
  avatarFg: "#cccccc",
  ring: "#ff6a45",
};

/** Semantic status — full-strength fg + ~13% tint bg, never saturated fills. */
export const statusTokens: Record<string, { fg: string; bg: string }> = {
  todo: { fg: "#9aa2ad", bg: "rgba(154, 162, 173, 0.13)" },
  in_progress: { fg: "#e2b93b", bg: "rgba(226, 185, 59, 0.13)" },
  done: { fg: "#32d74b", bg: "rgba(50, 215, 75, 0.13)" },
  blocked: { fg: "#ff6259", bg: "rgba(255, 98, 89, 0.13)" },
};

/** Project accent swatches — muted mid-tones (same 8 as the web). */
export const swatches = [
  "#5da283", // green
  "#4573d2", // blue
  "#8d84e8", // purple
  "#f26fb2", // pink
  "#ec8d71", // orange
  "#4ecbc4", // teal
  "#f1bd6c", // yellow
  "#f06a6a", // red
] as const;

/** 13px UI base scale (web --text-*). */
export const type = {
  xs: 11,
  sm: 12,
  md: 13,
  lg: 15,
  xl: 18,
  xxl: 20,
};

export const font = {
  regular: "Inter_400Regular",
  medium: "Inter_500Medium",
  semibold: "Inter_600SemiBold",
};

/** Strict 4px scale (web --space-*). */
export const spacing = { 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 7: 28, 8: 32 };

export const radius = { sm: 4, md: 6, lg: 8, card: 10, full: 999 };
