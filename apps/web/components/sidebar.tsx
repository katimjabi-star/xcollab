import Link from "next/link";
import { STRINGS, type UiLanguage } from "../lib/i18n.ts";
import { NAV_ITEMS } from "../lib/nav.ts";
import { BrandLogo } from "./brand-logo.tsx";

interface SidebarProps {
  uiLanguage: UiLanguage;
  pathname: string;
}

export function Sidebar({ uiLanguage, pathname }: SidebarProps) {
  const t = STRINGS[uiLanguage];
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <aside className="sidebar">
      <span className="brand">
        <BrandLogo />
      </span>
      <nav className="nav" aria-label="primary">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={isActive(item.href) ? "nav-item active" : "nav-item"}
          >
            <span className="nav-icon" aria-hidden>
              {item.icon}
            </span>
            <span className="nav-label">{t[item.labelKey]}</span>
          </Link>
        ))}
        <span className="nav-item" aria-disabled>
          <span className="nav-icon" aria-hidden>
            ◔
          </span>
          <span className="nav-label">{t.navTeams}</span>
          <span className="nav-soon">{t.navSoon}</span>
        </span>
      </nav>
      <div className="sidebar-foot">
        <span className="workspace-dot" aria-hidden />
        {t.workspace}
      </div>
    </aside>
  );
}
