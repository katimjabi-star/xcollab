/** XCollab dark theme — charcoal ground, brand-orange accent (logo bar). */
export const colors = {
  bg: "#0F1216",
  card: "#171C22",
  cardRaised: "#1E252D",
  border: "#2A323B",
  text: "#E8EAED",
  textDim: "#98A0A8",
  accent: "#FF5622",
  accentSoft: "#3A2118",
  good: "#3FB950",
  warn: "#D29922",
  bad: "#F85149",
  info: "#4493F8",
};

export const statusColors: Record<string, string> = {
  todo: colors.textDim,
  in_progress: colors.info,
  blocked: colors.warn,
  done: colors.good,
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 };
