import { STRINGS, type UiLanguage } from "../lib/i18n.ts";

const NAV_ICONS = { overview: "▦", programs: "◫", ledger: "⛓", teams: "◔" } as const;

export function Sidebar({ uiLanguage }: { uiLanguage: UiLanguage }) {
  const t = STRINGS[uiLanguage];
  const items = [
    { icon: NAV_ICONS.overview, label: t.navOverview, active: true },
    { icon: NAV_ICONS.programs, label: t.navPrograms, active: false },
    { icon: NAV_ICONS.ledger, label: t.navLedger, active: false },
    { icon: NAV_ICONS.teams, label: t.navTeams, active: false },
  ];
  return (
    <aside className="sidebar">
      <span className="brand">{t.brand}</span>
      <nav className="nav" aria-label="primary">
        {items.map((item) => (
          <button
            key={item.label}
            type="button"
            className={item.active ? "nav-item active" : "nav-item"}
            disabled={!item.active}
          >
            <span className="nav-icon" aria-hidden>
              {item.icon}
            </span>
            <span className="nav-label">{item.label}</span>
            {item.active ? null : <span className="nav-soon">{t.navSoon}</span>}
          </button>
        ))}
      </nav>
      <div className="sidebar-foot">
        <span className="workspace-dot" aria-hidden />
        {t.workspace}
      </div>
    </aside>
  );
}
