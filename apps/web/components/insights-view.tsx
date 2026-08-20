"use client";

import { Diamond } from "lucide-react";
import type { Program, Task } from "@xcollab/core";
import type { Severity } from "../lib/program-insights.ts";
import { computeInsights } from "../lib/program-insights.ts";
import type { UiLanguage } from "../lib/i18n.ts";
import { STRINGS } from "../lib/i18n.ts";
import { fullName, useWorkspaceUsers } from "./assignee-picker.tsx";
import { Avatar } from "./ui/avatar.tsx";
import { Chip } from "./ui/chip.tsx";
import { Icon } from "./ui/icon.tsx";

type Strings = (typeof STRINGS)["en"];

const STATUS_ORDER: Task["status"][] = ["todo", "in_progress", "blocked", "done"];
const SEVERITY_ORDER: Severity[] = ["critical", "high", "medium", "low"];

function localTodayIso(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

function statusLabels(t: Strings): Record<Task["status"], string> {
  return {
    todo: t.statusTodo,
    in_progress: t.statusInProgress,
    blocked: t.statusBlocked,
    done: t.statusDone,
  };
}

function severityLabels(t: Strings): Record<Severity, string> {
  return {
    low: t.severityLow,
    medium: t.severityMedium,
    high: t.severityHigh,
    critical: t.severityCritical,
  };
}

function MetricTile({ value, label, alert = false }: { value: string; label: string; alert?: boolean }) {
  return (
    <div className={alert ? "in-tile in-tile-alert" : "in-tile"}>
      <span className="in-tile-value num">{value}</span>
      <span className="in-tile-label">{label}</span>
    </div>
  );
}

/** CSS-only program analytics: metric tiles, per-package progress bars, a
    stacked status bar, team load, overdue tasks, milestones and risks. */
export function InsightsView({
  program,
  uiLanguage,
  onTaskSelect,
}: {
  program: Program;
  uiLanguage: UiLanguage;
  /** When provided, overdue task rows open the task panel. */
  onTaskSelect?: (taskId: string) => void;
}) {
  const t = STRINGS[uiLanguage];
  const ins = computeInsights(program, localTodayIso());
  const users = useWorkspaceUsers();
  const namesByUsername = new Map(users.map((user) => [user.username, fullName(user)]));
  const dateFormat = new Intl.DateTimeFormat(uiLanguage === "ar" ? "ar" : "en", {
    month: "short",
    day: "numeric",
  });
  const totalTasks = STATUS_ORDER.reduce((sum, s) => sum + ins.statusCounts[s], 0);
  const openTasks = totalTasks - ins.statusCounts.done;
  const maxLoad = Math.max(1, ...ins.assigneeLoad.map((row) => row.open + row.done));
  const sLabels = statusLabels(t);

  return (
    <div className="in-region" dir={program.language === "ar" ? "rtl" : "ltr"}>
      <div className="in-tiles">
        <MetricTile value={`${ins.completionPct}%`} label={t.insightCompletion} />
        <MetricTile value={String(openTasks)} label={t.insightOpenTasks} />
        <MetricTile
          value={String(ins.overdueTasks.length)}
          label={t.overdueLabel}
          alert={ins.overdueTasks.length > 0}
        />
        <MetricTile value={String(ins.dueThisWeek.length)} label={t.insightDueThisWeek} />
      </div>

      <div className="in-grid">
        <section className="in-section">
          <h3 className="in-subhead">{t.insightsPackageProgress}</h3>
          {ins.perPackage.map((pkg) => (
            <div key={pkg.id} className="in-progress-row">
              <span className="in-progress-label">
                <span className="in-progress-name">{pkg.name}</span>
                <span className="in-progress-pct num">{pkg.pct}%</span>
              </span>
              <span className="in-track" role="presentation">
                <span className="in-fill" style={{ inlineSize: `${pkg.pct}%` }} />
              </span>
            </div>
          ))}
        </section>

        <section className="in-section">
          <h3 className="in-subhead">{t.insightsStatusBreakdown}</h3>
          <span className="in-stack" role="presentation">
            {STATUS_ORDER.filter((s) => ins.statusCounts[s] > 0).map((status) => (
              <span
                key={status}
                className={`in-seg in-seg-${status}`}
                style={{ inlineSize: `${(ins.statusCounts[status] / Math.max(1, totalTasks)) * 100}%` }}
                title={`${sLabels[status]} · ${ins.statusCounts[status]}`}
              />
            ))}
          </span>
          <ul className="in-legend">
            {STATUS_ORDER.map((status) => (
              <li key={status}>
                <span className={`in-dot in-seg-${status}`} />
                {sLabels[status]} <span className="num">{ins.statusCounts[status]}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="in-section">
          <h3 className="in-subhead">{t.insightsTeamLoad}</h3>
          {ins.assigneeLoad.map((row) => {
            const name = row.assignee
              ? (namesByUsername.get(row.assignee) ?? row.assignee)
              : t.noAssignee;
            return (
              <div key={row.assignee ?? "__none"} className="in-load-row">
                <Avatar name={name} className={row.assignee ? undefined : "in-avatar-none"} />
                <span className="in-load-name">{name}</span>
                <span className="in-load-bar" role="presentation">
                  <span className="in-load-done" style={{ inlineSize: `${(row.done / maxLoad) * 100}%` }} />
                  <span className="in-load-open" style={{ inlineSize: `${(row.open / maxLoad) * 100}%` }} />
                </span>
                <span className="in-load-counts num" title={`${sLabels.done} ${row.done}`}>
                  {row.open} / {row.done}
                </span>
              </div>
            );
          })}
        </section>

        <section className="in-section">
          <h3 className="in-subhead">{t.overdueLabel}</h3>
          {ins.overdueTasks.length === 0 ? (
            <p className="in-empty">{t.insightsNoOverdue}</p>
          ) : (
            ins.overdueTasks.slice(0, 5).map((task) => (
              <button
                key={task.id}
                type="button"
                className="in-task-row"
                onClick={() => onTaskSelect?.(task.id)}
              >
                <span className="in-task-name">{task.name}</span>
                {task.dueDate ? (
                  <Chip variant="dueDate" overdue title={`${t.overdueLabel} · ${task.dueDate}`}>
                    {dateFormat.format(new Date(`${task.dueDate}T00:00:00`))}
                  </Chip>
                ) : null}
              </button>
            ))
          )}
        </section>

        <section className="in-section">
          <h3 className="in-subhead">{t.milestonesHeading}</h3>
          {ins.milestoneHealth.length === 0 ? (
            <p className="in-empty">{t.insightsNoMilestones}</p>
          ) : (
            ins.milestoneHealth.map((ms) => (
              <div key={ms.id} className={ms.state === "past" ? "in-ms-row past" : "in-ms-row"}>
                <Icon icon={Diamond} size={12} className="in-ms-icon" />
                <span className="in-ms-name">{ms.name}</span>
                <span className="in-ms-date num">{ms.dueDate}</span>
              </div>
            ))
          )}
        </section>

        <section className="in-section">
          <h3 className="in-subhead">{t.risksHeading}</h3>
          {program.risks.length === 0 ? (
            <p className="in-empty">{t.insightsNoRisks}</p>
          ) : (
            <div className="in-risk-chips">
              {SEVERITY_ORDER.filter((sev) => ins.riskCounts[sev] > 0).map((sev) => (
                <span key={sev} className={`in-risk-chip in-risk-${sev}`}>
                  {severityLabels(t)[sev]} <span className="num">{ins.riskCounts[sev]}</span>
                </span>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
