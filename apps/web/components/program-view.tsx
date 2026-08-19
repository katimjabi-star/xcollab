import type { Program } from "@xcollab/core";
import type { UiLanguage } from "../lib/i18n.ts";
import { STRINGS } from "../lib/i18n.ts";

export function ProgramView({ program, uiLanguage }: { program: Program; uiLanguage: UiLanguage }) {
  const t = STRINGS[uiLanguage];
  return (
    <article className="program-card" dir={program.language === "ar" ? "rtl" : "ltr"}>
      <header>
        <h3>{program.name}</h3>
        <p className="program-meta">
          {program.timeline.start} → {program.timeline.end} · {program.mission}
        </p>
      </header>

      <div>
        <p className="subhead">{t.packagesHeading}</p>
        <div className="pkg-grid">
          {program.packages.map((pkg) => (
            <div className="pkg" key={pkg.id}>
              <strong>{pkg.name}</strong>
              <span className="scope">{pkg.scope}</span>
              <span className="count">
                {pkg.tasks.length} {t.tasksLabel}
              </span>
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
                <span className="date">{risk.severity}</span>
                <span>{risk.title}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </article>
  );
}
