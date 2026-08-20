"use client";

import Link from "next/link";
import { PanelLeft, Users } from "lucide-react";
import { STRINGS, type UiLanguage } from "../lib/i18n.ts";
import { NAV_ITEMS } from "../lib/nav.ts";
import { BrandLogo } from "./brand-logo.tsx";
import { Icon } from "./ui/icon.tsx";

interface SidebarProps {
  uiLanguage: UiLanguage;
  pathname: string;
  collapsed: boolean;
  onToggleCollapsed: () => void;
}

export function Sidebar({ uiLanguage, pathname, collapsed, onToggleCollapsed }: SidebarProps) {
  const t = STRINGS[uiLanguage];
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <aside className="sidebar">
      <div className="sidebar-head">
        {!collapsed && (
          <span className="brand">
            <BrandLogo />
          </span>
        )}
        <button
          type="button"
          className="sidebar-toggle"
          onClick={onToggleCollapsed}
          aria-pressed={collapsed}
          aria-label={collapsed ? t.sidebarExpand : t.sidebarCollapse}
          title={collapsed ? t.sidebarExpand : t.sidebarCollapse}
        >
          <Icon icon={PanelLeft} directional />
        </button>
      </div>
      <nav className="nav" aria-label="primary">
        {NAV_ITEMS.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={active ? "nav-item active" : "nav-item"}
              aria-current={active ? "page" : undefined}
              title={collapsed ? t[item.labelKey] : undefined}
            >
              <span className="nav-icon" aria-hidden>
                <Icon icon={item.icon} />
              </span>
              <span className="nav-label">{t[item.labelKey]}</span>
            </Link>
          );
        })}
        <span className="nav-item" aria-disabled title={collapsed ? t.navTeams : undefined}>
          <span className="nav-icon" aria-hidden>
            <Icon icon={Users} />
          </span>
          <span className="nav-label">{t.navTeams}</span>
          <span className="nav-soon">{t.navSoon}</span>
        </span>
      </nav>
      <div className="sidebar-foot">
        <span className="workspace-dot" aria-hidden />
        <span className="sidebar-foot-label">{t.workspace}</span>
      </div>
    </aside>
  );
}
