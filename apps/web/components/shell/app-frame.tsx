"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { routeLabelKey, setDocumentTitle } from "../../lib/nav.ts";
import { useUi } from "../../lib/ui-context.tsx";
import { CommandPalette } from "../command-palette.tsx";
import { IconRail } from "./icon-rail.tsx";
import { SideNav } from "./side-nav.tsx";
import { TopBar } from "./top-bar.tsx";

const SIDEBAR_STORAGE_KEY = "xcollab.sidebar.collapsed";

/** App chrome: full-width top bar over icon rail + context sidebar + content.
    The sidebar collapse persists across sessions; ⌘K / Ctrl+K opens the
    command palette from anywhere. */
export function AppFrame({ children }: { children: ReactNode }) {
  const { language, t, dir } = useUi();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

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

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((open) => !open);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  /* "<PageLabel> · XCollab" — detail pages append deeper parts themselves
     via setDocumentTitle. */
  const pageLabel = t[routeLabelKey(pathname)];
  useEffect(() => {
    setDocumentTitle([pageLabel]);
  }, [pageLabel]);

  return (
    <div className={collapsed ? "s2-app s2-collapsed" : "s2-app"} dir={dir} lang={language}>
      <a className="skip-link" href="#main-content">
        {t.skipToContent}
      </a>
      <TopBar
        collapsed={collapsed}
        onToggleCollapsed={toggleCollapsed}
        onOpenPalette={() => setPaletteOpen(true)}
        t={t}
      />
      <IconRail pathname={pathname} t={t} />
      <SideNav pathname={pathname} t={t} />
      <main className="s2-main" id="main-content">
        {children}
      </main>
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
}
