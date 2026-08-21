"use client";

import Link from "next/link";
import { UserPlus } from "lucide-react";
import { listPrograms } from "../../lib/api-client.ts";
import type { STRINGS } from "../../lib/i18n.ts";
import { AI_NAV_ITEMS, WORK_NAV_ITEMS, railContextOf, type NavItem } from "../../lib/nav.ts";
import { programColor, programDisplayName } from "../../lib/program-format.ts";
import { useWorkspaceData } from "../../lib/use-workspace-data.ts";
import { Icon } from "../ui/icon.tsx";

type Strings = (typeof STRINGS)["en"];

function NavRow({ item, pathname, t }: { item: NavItem; pathname: string; t: Strings }) {
  const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
  return (
    <Link
      href={item.href}
      className={active ? "s2-nav-item active" : "s2-nav-item"}
      aria-current={active ? "page" : undefined}
    >
      <span className="s2-nav-icon" aria-hidden>
        <Icon icon={item.icon} />
      </span>
      <span className="s2-nav-label">{t[item.labelKey]}</span>
    </Link>
  );
}

/** ~240px context sidebar. Work context: primary nav + the workspace's
    projects (12px color swatch + name) + an invite affordance pinned at the
    bottom. AI context: the AI-plane pages. Collapse hides the whole pane
    (the shell drops the grid column). */
export function SideNav({ pathname, t }: { pathname: string; t: Strings }) {
  const context = railContextOf(pathname);
  const { data: programs } = useWorkspaceData(listPrograms);
  const workContext = context !== "ai";
  const items = workContext ? WORK_NAV_ITEMS : AI_NAV_ITEMS;
  const groupLabel = workContext ? t.railWork : t.railAi;

  return (
    <aside className="s2-sidebar">
      <nav className="s2-sidebar-scroll" aria-label={groupLabel}>
        <p className="s2-group-label">{groupLabel}</p>
        <div className="s2-nav-group">
          {items.map((item) => (
            <NavRow key={item.href} item={item} pathname={pathname} t={t} />
          ))}
        </div>
        {workContext ? (
          <>
            <hr className="s2-divider" />
            <p className="s2-group-label">{t.workspace}</p>
            <div className="s2-nav-group">
              {(programs ?? []).map((program) => {
                const href = `/projects/${program.id}`;
                const active = pathname.startsWith(href);
                return (
                  <Link
                    key={program.id}
                    href={href}
                    className={active ? "s2-nav-item active" : "s2-nav-item"}
                    aria-current={active ? "page" : undefined}
                  >
                    <span
                      className="s2-swatch"
                      style={{ background: programColor(program.id) }}
                      aria-hidden
                    />
                    <span className="s2-nav-label" dir="auto">
                      {programDisplayName(program)}
                    </span>
                  </Link>
                );
              })}
            </div>
          </>
        ) : null}
      </nav>
      {workContext ? (
        <div className="s2-sidebar-foot">
          <Link href="/teams" className="s2-invite-btn">
            <Icon icon={UserPlus} size={14} />
            {t.inviteTeammate}
          </Link>
        </div>
      ) : null}
    </aside>
  );
}
