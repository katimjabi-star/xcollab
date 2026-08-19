import type { Program, Task } from "@xcollab/core";
import type { UiLanguage } from "../lib/i18n.ts";
import { STRINGS } from "../lib/i18n.ts";

type Severity = Program["risks"][number]["severity"];

/** Shared card header — the single copy of the name/timeline/mission block. */
export function ProgramCardHeader({
  program,
  headingLevel: Heading = "h3",
}: {
  program: Program;
  headingLevel?: "h2" | "h3";
}) {
  return (
    <header>
      <Heading>{program.name}</Heading>
      <p className="program-meta">
        {program.timeline.start} → {program.timeline.end}
      </p>
      <p className="program-meta">{program.mission}</p>
    </header>
  );
}

export function ProgramView({
  program,
  uiLanguage,
  detail = false,
}: {
  program: Program;
  uiLanguage: UiLanguage;
  detail?: boolean;
}) {
  const t = STRINGS[uiLanguage];
  const statusLabels: Record<Task["status"], string> = {
    todo: t.statusTodo,
    in_progress: t.statusInProgress,
    blocked: t.statusBlocked,
    done: t.statusDone,
  };
  const severityLabels: Record<Severity, string> = {
    low: t.severityLow,
    medium: t.severityMedium,
    high: t.severityHigh,
    critical: t.severityCritical,
  };

  return (
    <article className="program-card" dir={program.language === "ar" ? "rtl" : "ltr"}>
      <ProgramCardHeader program={program} headingLevel={detail ? "h2" : "h3"} />

      <div>
        <p className="subhead">{t.packagesHeading}</p>
        <div className="pkg-grid">
          {program.packages.map((pkg) => (
            <div className="pkg" key={pkg.id}>
              <strong>{pkg.name}</strong>
              <span className="scope">{pkg.scope}</span>
              {detail ? (
                <ul className="task-list">
                  {pkg.tasks.map((task) => (
                    <li key={task.id}>
                      <span>{task.name}</span>
                      <span className="task-meta">
                        {task.estimateDays} {t.estimateDaysSuffix}
                        {task.assigneeRole ? ` · ${task.assigneeRole}` : ""}
                      </span>
                      <span className={`status-pill ${task.status}`}>
                        {statusLabels[task.status]}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <span className="count">
                  {pkg.tasks.length} {t.tasksLabel}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="two-col">
        <div>
          <p className="subhead">{t.milestonesHeading}</p>
          <ul className="stack">
            {program.milestones.map((ms) => (
              <li key={ms.id}>
                <span className="date">{ms.dueDate}</span>
                <span>{ms.name}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="subhead">{t.risksHeading}</p>
          <ul className="stack">
            {program.risks.map((risk) => (
              <li key={risk.id}>
                <span className="date">{severityLabels[risk.severity]}</span>
                <span>{risk.title}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {detail ? (
        <div>
          <p className="subhead">{t.teamsHeading}</p>
          <ul className="stack">
            {program.teams.map((team) => (
              <li key={team.id}>
                <span>{team.name}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </article>
  );
}
