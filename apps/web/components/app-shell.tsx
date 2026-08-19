"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { routeLabelKey } from "../lib/nav.ts";
import { useUi } from "../lib/ui-context.tsx";
import { Sidebar } from "./sidebar.tsx";

export function AppShell({ children }: { children: ReactNode }) {
  const { language, toggleLanguage, themeMode, cycleTheme, t, dir } = useUi();
  const pathname = usePathname();

  const title = t[routeLabelKey(pathname)];

  const themeLabel =
    themeMode === "light" ? t.themeLight : themeMode === "dark" ? t.themeDark : t.themeSystem;

  return (
    <div className="app" dir={dir} lang={language}>
      <Sidebar uiLanguage={language} pathname={pathname} />
      <main className="main">
        <header className="topbar">
          <h1 className="page-title">{title}</h1>
          <div className="masthead-controls">
            <button type="button" className="theme-toggle" onClick={cycleTheme}>
              {themeMode === "dark" ? "◐ " : themeMode === "light" ? "○ " : "◑ "}
              {themeLabel}
            </button>
            <button type="button" className="lang-toggle" onClick={toggleLanguage}>
              {t.languageToggle}
            </button>
          </div>
        </header>
        {children}
      </main>
    </div>
  );
}
