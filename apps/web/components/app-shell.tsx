"use client";

import { usePathname } from "next/navigation";
import { ChevronRight, Monitor, Moon, Sun } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { routeLabelKey } from "../lib/nav.ts";
import { useUi } from "../lib/ui-context.tsx";
import { Sidebar } from "./sidebar.tsx";
import { UserMenu } from "./user-menu.tsx";
import { Icon } from "./ui/icon.tsx";

const SIDEBAR_STORAGE_KEY = "xcollab.sidebar.collapsed";

export function AppShell({ children }: { children: ReactNode }) {
  const { language, toggleLanguage, themeMode, cycleTheme, t, dir } = useUi();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  /* Hydrate after mount — SSR markup must match the client's first render. */
  useEffect(() => {
    setCollapsed(window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === "1");
  }, []);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      window.localStorage.setItem(SIDEBAR_STORAGE_KEY, next ? "1" : "0");
      return next;
    });
  }

  const pageLabel = t[routeLabelKey(pathname)];
  const themeLabel =
    themeMode === "light" ? t.themeLight : themeMode === "dark" ? t.themeDark : t.themeSystem;
  const themeIcon = themeMode === "light" ? Sun : themeMode === "dark" ? Moon : Monitor;

  return (
    <div className={collapsed ? "app sidebar-collapsed" : "app"} dir={dir} lang={language}>
      <Sidebar
        uiLanguage={language}
        pathname={pathname}
        collapsed={collapsed}
        onToggleCollapsed={toggleCollapsed}
      />
      <main className="main">
        <header className="topbar">
          <nav className="breadcrumbs" aria-label="breadcrumb">
            <span className="breadcrumb-root">{t.breadcrumbWorkspace}</span>
            <span className="breadcrumb-sep" aria-hidden>
              <Icon icon={ChevronRight} size={14} directional />
            </span>
            <span className="breadcrumb-current" aria-current="page">
              {pageLabel}
            </span>
          </nav>
          <div className="masthead-controls">
            <button type="button" className="theme-toggle" onClick={cycleTheme}>
              <Icon icon={themeIcon} size={14} />
              {themeLabel}
            </button>
            <button type="button" className="lang-toggle" onClick={toggleLanguage}>
              {t.languageToggle}
            </button>
            <UserMenu />
          </div>
        </header>
        {children}
      </main>
    </div>
  );
}
