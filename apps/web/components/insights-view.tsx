"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { Check, ListFilter, Plus } from "lucide-react";
import type { Program, Task } from "@xcollab/core";
import { getLedger, listPrograms } from "../lib/api-client.ts";
import { localTodayIso } from "../lib/my-tasks.ts";
import type { BarDatum } from "../lib/program-insights.ts";
import {
  completionSeries,
  dashboardStats,
  donutSegments,
  sectionCounts,
} from "../lib/program-insights.ts";
import type { UiLanguage } from "../lib/i18n.ts";
import { STRINGS } from "../lib/i18n.ts";
import { programDisplayName } from "../lib/program-format.ts";
import { useWorkspaceData } from "../lib/use-workspace-data.ts";
import { AreaChart, BarChart, DonutChart, DONUT_COLORS } from "./insights-charts.tsx";
import { Icon } from "./ui/icon.tsx";
import { Popover } from "./ui/popover.tsx";

type Strings = (typeof STRINGS)["en"];

const WIDGET_IDS = ["bySection", "byStatus", "byProject", "overTime"] as const;
type WidgetId = (typeof WIDGET_IDS)[number];
type WidgetPrefs = Record<WidgetId, boolean>;

const WIDGETS_KEY = "xcollab.dashboard.widgets.v1";
const ALL_VISIBLE: WidgetPrefs = { bySection: true, byStatus: true, byProject: true, overTime: true };


function readWidgetPrefs(): WidgetPrefs {
  try {
    const raw = localStorage.getItem(WIDGETS_KEY);
    if (!raw) return ALL_VISIBLE;
    const parsed = JSON.parse(raw) as Partial<Record<WidgetId, boolean>>;
    return { ...ALL_VISIBLE, ...parsed };
  } catch {
    return ALL_VISIBLE;
  }
}

const DONUT_LEGEND: { status: Task["status"]; key: keyof Strings }[] = [
  { status: "done", key: "statusDone" },
  { status: "in_progress", key: "statusInProgress" },
  { status: "todo", key: "statusTodo" },
  { status: "blocked", key: "statusBlocked" },
];

/** Decorative filter chip in a card footer (reference anatomy). */
function FilterChip({ label }: { label: string }) {
  return (
    <span className="dash-filter-chip">
      <Icon icon={ListFilter} size={12} />
      {label}
    </span>
  );
}

function StatCard({ label, value, chip }: { label: string; value: number; chip: string }) {
  return (
    <div className="dash-card dash-stat">
      <h3 className="dash-card-title">{label}</h3>
      <span className="dash-stat-value dash-num">{value}</span>
      <div className="dash-card-footer dash-stat-footer">
        <FilterChip label={chip} />
      </div>
    </div>
  );
}

function ChartCard({
  title,
  chip,
  seeAll,
  children,
}: {
  title: string;
  chip: string;
  /** Optional deep link rendered as a ghost "See all" footer button. */
  seeAll?: { href: string; label: string };
  children: ReactNode;
}) {
  return (
    <section className="dash-card">
      <h3 className="dash-card-title">{title}</h3>
      <div className="dash-card-body" dir="ltr">
        {children}
      </div>
      <div className="dash-card-footer">
        <FilterChip label={chip} />
        {seeAll ? (
          <Link className="dash-see-all" href={seeAll.href}>
            {seeAll.label}
          </Link>
        ) : null}
      </div>
    </section>
  );
}

/** Widget dashboard: stat-card row + 2×2 inline-SVG chart grid, widget
    visibility toggled from the "+ Add widget" popover (localStorage). */
export function InsightsView({
  program,
  uiLanguage,
}: {
  program: Program;
  uiLanguage: UiLanguage;
  /** Kept for page compatibility; the widget dashboard opens no task panel. */
  onTaskSelect?: (taskId: string) => void;
}) {
  const t = STRINGS[uiLanguage];
  const today = localTodayIso();
  const [menuOpen, setMenuOpen] = useState(false);
  const [prefs, setPrefs] = useState<WidgetPrefs>(ALL_VISIBLE);
  // Prefs load post-mount (localStorage is client-only; avoids hydration mismatch).
  useEffect(() => setPrefs(readWidgetPrefs()), []);
  const toggleWidget = (id: WidgetId) => {
    setPrefs((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      try {
        localStorage.setItem(WIDGETS_KEY, JSON.stringify(next));
      } catch {
        /* Private-mode storage failures only lose persistence, not the toggle. */
      }
      return next;
    });
  };

  const { data: allPrograms } = useWorkspaceData(listPrograms);
  const { data: ledger } = useWorkspaceData(getLedger);

  const stats = dashboardStats(program, today);
  const donut = donutSegments(
    (() => {
      const counts: Record<Task["status"], number> = { todo: 0, in_progress: 0, blocked: 0, done: 0 };
      for (const pkg of program.packages) for (const task of pkg.tasks) counts[task.status] += 1;
      return counts;
    })(),
  );
  const sections = sectionCounts(program);
  const children = (allPrograms ?? []).filter((p) => p.parentId === program.id);
  const byProject: BarDatum[] = children.map((child) => ({
    id: child.id,
    name: programDisplayName(child),
    count: child.packages.reduce((sum, pkg) => sum + pkg.tasks.length, 0),
  }));
  const series = completionSeries(ledger?.entries ?? [], program.id, today, 11);
  // No sub-projects → the card falls back to incomplete-by-section rather than
  // duplicating the total-by-section widget next to it.
  const incompleteSections: BarDatum[] = program.packages.map((pkg) => ({
    id: pkg.id,
    name: pkg.name,
    count: pkg.tasks.filter((task) => task.status !== "done").length,
  }));

  const widgetLabels: Record<WidgetId, string> = {
    bySection: t.dashBySection,
    byStatus: t.dashByStatus,
    byProject: byProject.length > 0 ? t.dashByProject : t.dashIncompleteBySection,
    overTime: t.dashOverTime,
  };

  return (
    <div className="dash-region" dir={uiLanguage === "ar" ? "rtl" : "ltr"}>
      <div className="dash-toolbar">
        <Popover
          open={menuOpen}
          onClose={() => setMenuOpen(false)}
          align="start"
          role="menu"
          anchor={
            <button
              type="button"
              className="dash-ghost-btn"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((open) => !open)}
            >
              <Icon icon={Plus} size={14} />
              {t.dashAddWidget}
            </button>
          }
        >
          <div className="dash-widget-menu">
            <span className="dash-widget-menu-label">{t.dashWidgetsMenuLabel}</span>
            {WIDGET_IDS.map((id) => (
              <button
                key={id}
                type="button"
                role="menuitemcheckbox"
                aria-checked={prefs[id]}
                className="dash-widget-item"
                onClick={() => toggleWidget(id)}
              >
                <span className="dash-widget-check">
                  {prefs[id] ? <Icon icon={Check} size={14} /> : null}
                </span>
                {widgetLabels[id]}
              </button>
            ))}
          </div>
        </Popover>
      </div>

      <div className="dash-stats">
        <StatCard label={t.dashTotalCompleted} value={stats.completed} chip={t.dashFilterOne} />
        <StatCard label={t.dashTotalIncomplete} value={stats.incomplete} chip={t.dashFilterOne} />
        <StatCard label={t.dashTotalOverdue} value={stats.overdue} chip={t.dashFilterOne} />
        <StatCard label={t.dashTotalTasks} value={stats.total} chip={t.dashFilterNone} />
      </div>

      <div className="dash-grid">
        {prefs.bySection ? (
          <ChartCard
            title={t.dashBySection}
            chip={t.dashFilterOne}
            seeAll={{ href: `/projects/${program.id}?view=board`, label: t.dashSeeAll }}
          >
            <BarChart data={sections} yTitle={t.dashAxisTasks} />
          </ChartCard>
        ) : null}
        {prefs.byStatus ? (
          <ChartCard title={t.dashByStatus} chip={t.dashFilterTwo}>
            <div className="dash-donut-row">
              <DonutChart donut={donut} title={t.dashByStatus} />
              <ul className="dash-legend" dir={uiLanguage === "ar" ? "rtl" : "ltr"}>
                {DONUT_LEGEND.map(({ status, key }) => (
                  <li key={status}>
                    <span className="dash-legend-swatch" style={{ background: DONUT_COLORS[status] }} />
                    {t[key]}
                  </li>
                ))}
              </ul>
            </div>
          </ChartCard>
        ) : null}
        {prefs.byProject ? (
          <ChartCard
            title={widgetLabels.byProject}
            chip={t.dashFilterNone}
            seeAll={{ href: "/projects", label: t.dashSeeAll }}
          >
            <BarChart data={byProject.length > 0 ? byProject : incompleteSections} yTitle={t.dashAxisTasks} />
          </ChartCard>
        ) : null}
        {prefs.overTime ? (
          <ChartCard title={t.dashOverTime} chip={t.dashFilterNone}>
            <AreaChart data={series} yTitle={t.dashAxisTasks} />
          </ChartCard>
        ) : null}
      </div>
    </div>
  );
}
