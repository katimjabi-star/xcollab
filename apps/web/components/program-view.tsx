import type { Program, Task } from "@xcollab/core";
import type { UiLanguage } from "../lib/i18n.ts";
import { STRINGS } from "../lib/i18n.ts";
import { Chip } from "./ui/chip.tsx";
import { TaskQuickAdd } from "./quick-add.tsx";

type Severity = Program["risks"][number]["severity"];

function statusLabels(t: (typeof STRINGS)["en"]): Record<Task["status"], string> {
  return {
    todo: t.statusTodo,
    in_progress: t.statusInProgress,
    blocked: t.statusBlocked,
    done: t.statusDone,
  };
}

/** ISO "today" for lexicographic overdue comparison on YYYY-MM-DD dates. */
function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function isOverdue(task: Task, today: string): boolean {
  return Boolean(task.dueDate && task.dueDate < today && task.status !== "done");
}

/** Row chips: due-date chip (overdue tint) + status chip — right-aligned pair. */
function TaskRowChips({
  task,
  uiLanguage,
  today,
  dateFormat,
}: {
  task: Task;
  uiLanguage: UiLanguage;
  today: string;
  dateFormat: Intl.DateTimeFormat;
}) {
  const t = STRINGS[uiLanguage];
  const overdue = isOverdue(task, today);
  return (
    <span className="task-row-chips">
      {task.dueDate ? (
        <Chip
          variant="dueDate"
          overdue={overdue}
          title={`${overdue ? t.overdueLabel : t.dueLabel} · ${task.dueDate}`}
        >
          {dateFormat.format(new Date(`${task.dueDate}T00:00:00`))}
        </Chip>
      ) : null}
      <Chip variant="status" status={task.status}>
        {statusLabels(t)[task.status]}
      </Chip>
    </span>
  );
}

/** 36px task row body — max 3 metadata signals: role, due chip, status chip. */
function TaskRowContent({
  task,
  uiLanguage,
  today,
  dateFormat,
}: {
  task: Task;
  uiLanguage: UiLanguage;
  today: string;
  dateFormat: Intl.DateTimeFormat;
}) {
  return (
    <>
      <span className="task-row-name">{task.name}</span>
      {task.assigneeRole ? <span className="task-row-meta">{task.assigneeRole}</span> : null}
      <TaskRowChips task={task} uiLanguage={uiLanguage} today={today} dateFormat={dateFormat} />
    </>
  );
}

/** Shared program header — the single copy of the name/timeline/mission block. */
export function ProgramCardHeader({
  program,
  headingLevel: Heading = "h3",
}: {
  program: Program;
  headingLevel?: "h2" | "h3";
}) {
  return (
    <header className="program-head">
      <Heading className="program-title">{program.name}</Heading>
      <p className="program-meta">
        {program.timeline.start} → {program.timeline.end}
      </p>
      <p className="program-meta program-mission">{program.mission}</p>
    </header>
  );
}

/** Dense grid card: 12px pad, 13px/500 name, 12px muted counts, language chip. */
export function ProgramCard({
  program,
  uiLanguage,
}: {
  program: Program;
  uiLanguage: UiLanguage;
}) {
  const t = STRINGS[uiLanguage];
  const taskCount = program.packages.reduce((sum, pkg) => sum + pkg.tasks.length, 0);
  return (
    <article className="program-tile" dir={program.language === "ar" ? "rtl" : "ltr"}>
      <div className="program-tile-head">
        <h3 className="program-tile-name">{program.name}</h3>
        <span className="mini-chip" dir="auto">
          {program.language === "ar" ? t.langChipAr : t.langChipEn}
        </span>
      </div>
      <p className="program-tile-mission">{program.mission}</p>
      {/* Counts are labeled in the UI language, so they keep the UI direction
          even inside a card that renders the other way. */}
      <p className="program-tile-counts" dir={uiLanguage === "ar" ? "rtl" : "ltr"}>
        <span className="num">{program.packages.length}</span> {t.packagesHeading} ·{" "}
        <span className="num">{taskCount}</span> {t.tasksLabel}
        <span className="program-tile-dates">
          {program.timeline.start} → {program.timeline.end}
        </span>
      </p>
    </article>
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
  const severityLabels: Record<Severity, string> = {
    low: t.severityLow,
    medium: t.severityMedium,
    high: t.severityHigh,
    critical: t.severityCritical,
  };

  if (!detail) {
    return <ProgramCard program={program} uiLanguage={uiLanguage} />;
  }

  const today = todayIso();
  const dateFormat = new Intl.DateTimeFormat(uiLanguage === "ar" ? "ar" : "en", {
    month: "short",
    day: "numeric",
  });

  return (
    <article className="program-detail" dir={program.language === "ar" ? "rtl" : "ltr"}>
      <ProgramCardHeader program={program} headingLevel="h2" />

      <div className="task-groups">
        {program.packages.map((pkg) => (
          <section className="task-group" key={pkg.id}>
            {/* Sticky 36px group header: name + count; scope surfaces on hover. */}
            <header className="task-group-head" title={pkg.scope}>
              <span className="task-group-name">{pkg.name}</span>
              <span className="task-group-count num">{pkg.tasks.length}</span>
            </header>
            <ul className="task-rows">
              {pkg.tasks.map((task) => (
                <li key={task.id}>
                  {onTaskSelect ? (
                    <button
                      type="button"
                      className="task-row"
                      onClick={() => onTaskSelect(task.id)}
                    >
                      <TaskRowContent
                        task={task}
                        uiLanguage={uiLanguage}
                        today={today}
                        dateFormat={dateFormat}
                      />
                    </button>
                  ) : (
                    <div className="task-row">
                      <TaskRowContent
                        task={task}
                        uiLanguage={uiLanguage}
                        today={today}
                        dateFormat={dateFormat}
                      />
                    </div>
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
          </section>
        ))}
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
      </div>
    </article>
  );
}
