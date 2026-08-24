"use client";

import { useRouter } from "next/navigation";
import { FolderKanban, Menu, Plus, Search, SquareCheckBig, Users } from "lucide-react";
import { useState } from "react";
import type { STRINGS } from "../../lib/i18n.ts";
import { Icon } from "../ui/icon.tsx";
import { Popover } from "../ui/popover.tsx";
import { UserMenu } from "../user-menu.tsx";

type Strings = (typeof STRINGS)["en"];

interface TopBarProps {
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onOpenPalette: () => void;
  /** Opens the global quick-create task dialog (owned by the app frame). */
  onCreateTask: () => void;
  t: Strings;
}

/** Full-width ~44px top bar: hamburger (sidebar collapse) · "+ Create" pill ·
    centered search affordance (opens the ⌘K palette) · avatar menu. */
export function TopBar({ collapsed, onToggleCollapsed, onOpenPalette, onCreateTask, t }: TopBarProps) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);

  /* Task opens the global quick-create dialog in place (reference behavior);
     Project → the mission composer, Team → /teams. */
  const createItems = [
    { label: t.createTask, icon: SquareCheckBig, action: onCreateTask },
    { label: t.createProject, icon: FolderKanban, action: () => router.push("/") },
    { label: t.createTeam, icon: Users, action: () => router.push("/teams") },
  ] as const;

  function goCreate(action: () => void) {
    setCreateOpen(false);
    action();
  }

  return (
    <header className="s2-topbar">
      <div className="s2-topbar-side">
        <button
          type="button"
          className="s2-icon-btn"
          onClick={onToggleCollapsed}
          aria-pressed={collapsed}
          aria-label={collapsed ? t.sidebarExpand : t.sidebarCollapse}
          title={collapsed ? t.sidebarExpand : t.sidebarCollapse}
        >
          <Icon icon={Menu} size={18} />
        </button>
        <Popover
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          align="start"
          role="menu"
          className="s2-create"
          anchor={
            <button
              type="button"
              className="s2-create-btn"
              aria-haspopup="menu"
              aria-expanded={createOpen}
              onClick={() => setCreateOpen((o) => !o)}
            >
              <span className="s2-create-badge" aria-hidden>
                <Icon icon={Plus} size={12} />
              </span>
              {t.createMenuLabel}
            </button>
          }
        >
          {createItems.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              className="s2-menu-item"
              onClick={() => goCreate(item.action)}
            >
              <Icon icon={item.icon} size={14} />
              {item.label}
            </button>
          ))}
        </Popover>
      </div>
      <div className="s2-topbar-center">
        <button
          type="button"
          className="s2-search-btn"
          onClick={onOpenPalette}
          aria-keyshortcuts="Meta+K Control+K"
        >
          <Icon icon={Search} size={14} />
          <span className="s2-search-text">{t.searchLabel}</span>
          <kbd className="s2-kbd" aria-hidden>
            ⌘K
          </kbd>
        </button>
      </div>
      <div className="s2-topbar-side s2-topbar-end">
        <UserMenu />
      </div>
    </header>
  );
}
