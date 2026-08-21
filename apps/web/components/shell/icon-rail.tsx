"use client";

import Link from "next/link";
import { Briefcase, Ellipsis, Sparkles, Users } from "lucide-react";
import { useState } from "react";
import type { STRINGS } from "../../lib/i18n.ts";
import { MORE_NAV_ITEMS, railContextOf } from "../../lib/nav.ts";
import { Icon } from "../ui/icon.tsx";
import { Popover } from "../ui/popover.tsx";

type Strings = (typeof STRINGS)["en"];

/** Fixed ~64px vertical icon rail: Work · AI · People switch the sidebar
    context (Work → main nav, AI → AI plane, People → /teams); More opens a
    menu with the routes outside those contexts. */
export function IconRail({ pathname, t }: { pathname: string; t: Strings }) {
  const context = railContextOf(pathname);
  const [moreOpen, setMoreOpen] = useState(false);

  const items = [
    { id: "work", icon: Briefcase, label: t.railWork, href: "/home" },
    { id: "ai", icon: Sparkles, label: t.railAi, href: "/ai" },
    { id: "people", icon: Users, label: t.railPeople, href: "/teams" },
  ] as const;

  return (
    <nav className="s2-rail" aria-label={t.railWork}>
      {items.map((item) => {
        const active = context === item.id;
        return (
          <Link
            key={item.id}
            href={item.href}
            className={active ? "s2-rail-item active" : "s2-rail-item"}
            aria-current={active ? "true" : undefined}
          >
            <span className="s2-rail-glyph" aria-hidden>
              <Icon icon={item.icon} size={18} />
            </span>
            <span className="s2-rail-label">{item.label}</span>
          </Link>
        );
      })}
      <Popover
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        align="start"
        role="menu"
        className="s2-rail-more"
        anchor={
          <button
            type="button"
            className="s2-rail-item"
            aria-haspopup="menu"
            aria-expanded={moreOpen}
            onClick={() => setMoreOpen((o) => !o)}
          >
            <span className="s2-rail-glyph" aria-hidden>
              <Icon icon={Ellipsis} size={18} />
            </span>
            <span className="s2-rail-label">{t.railMore}</span>
          </button>
        }
      >
        {MORE_NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            role="menuitem"
            className="s2-menu-item"
            onClick={() => setMoreOpen(false)}
          >
            <Icon icon={item.icon} size={14} />
            {t[item.labelKey]}
          </Link>
        ))}
      </Popover>
    </nav>
  );
}
