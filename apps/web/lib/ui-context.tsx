"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { STRINGS, type UiLanguage } from "./i18n.ts";
import {
  cycleThemeMode,
  setThemeMode as persistThemeMode,
  THEME_STORAGE_KEY,
  type ThemeMode,
} from "./theme.ts";

interface UiContextValue {
  language: UiLanguage;
  toggleLanguage: () => void;
  themeMode: ThemeMode;
  /** Pin an explicit mode (settings radio row). */
  setTheme: (mode: ThemeMode) => void;
  /** Step light → dark → system (topbar toggle). */
  cycleTheme: () => void;
  t: (typeof STRINGS)["en"];
  dir: "ltr" | "rtl";
}

const UiContext = createContext<UiContextValue | null>(null);

export function UiProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<UiLanguage>("en");
  const [themeMode, setThemeMode] = useState<ThemeMode>("system");

  useEffect(() => {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === "light" || stored === "dark") setThemeMode(stored);
  }, []);

  function setTheme(next: ThemeMode) {
    setThemeMode(next);
    persistThemeMode(next);
  }

  const value: UiContextValue = {
    language,
    toggleLanguage: () => setLanguage(language === "en" ? "ar" : "en"),
    themeMode,
    setTheme,
    cycleTheme: () => setTheme(cycleThemeMode(themeMode)),
    t: STRINGS[language],
    dir: language === "ar" ? "rtl" : "ltr",
  };
  return <UiContext.Provider value={value}>{children}</UiContext.Provider>;
}

export function useUi(): UiContextValue {
  const ctx = useContext(UiContext);
  if (!ctx) throw new Error("useUi must be used within UiProvider");
  return ctx;
}
