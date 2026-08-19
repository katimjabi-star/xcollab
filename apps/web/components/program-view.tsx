import type { Program, Task } from "@xcollab/core";
import type { UiLanguage } from "../lib/i18n.ts";
import { STRINGS } from "../lib/i18n.ts";
import { TaskQuickAdd } from "./quick-add.tsx";

type Severity = Program["risks"][number]["severity"];

/** The three spans of a task row — shared between plain and clickable rows. */
function TaskRowContent({
  task,
  statusLabel,
  estimateSuffix,
}: {
  task: Task;
  statusLabel: string;
  estimateSuffix: string;
}) {
  return (
    <>
      <span>{task.name}</span>
      <span className="task-meta">
        {task.estimateDays} {estimateSuffix}
        {task.assigneeRole ? ` · ${task.assigneeRole}` : ""}
      </span>
      <span className={`status-pill ${task.status}`}>{statusLabel}</span>
    </>
  );
}

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
  onTaskSelect,
  onProgramUpdate,
}: {
  program: Program;
  uiLanguage: UiLanguage;
  detail?: boolean;
  /** When provided, task rows become buttons that open the task panel. */
  onTaskSelect?: (taskId: string) => void;
  /** When provided, each package gains a quick-add row. */
  onProgramUpdate?: (program: Program) => void;
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
                <>
                  <ul className="task-list">
                    {pkg.tasks.map((task) => (
                      <li key={task.id}>
                        {onTaskSelect ? (
                          <button
                            type="button"
                            className="task-row-btn"
                            onClick={() => onTaskSelect(task.id)}
                          >
                            <TaskRowContent
                              task={task}
                              statusLabel={statusLabels[task.status]}
                              estimateSuffix={t.estimateDaysSuffix}
                            />
                          </button>
                        ) : (
                          <TaskRowContent
                            task={task}
                            statusLabel={statusLabels[task.status]}
                            estimateSuffix={t.estimateDaysSuffix}
                          />
                        )}
                      </li>
                    ))}
                  </ul>
                  {onProgramUpdate ? (
                    <TaskQuickAdd
                      variant="list"
                      programId={program.id}
                      packageId={pkg.id}
                      uiLanguage={uiLanguage}
                      onProgramUpdate={onProgramUpdate}
                    />
                  ) : null}
                </>
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
