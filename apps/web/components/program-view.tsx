"use client";

import type { ReactElement } from "react";
import type { Program } from "@xcollab/core";
import type { UiLanguage } from "../lib/i18n.ts";
import { STRINGS } from "../lib/i18n.ts";
import { formatIsoDate, programDisplayName } from "../lib/program-format.ts";
import { AttachmentsSection } from "./attachments-section.tsx";
import { ProgramTeamChip } from "./teams-program-chip.tsx";

type Severity = Program["risks"][number]["severity"];

/** Secondary program facts demoted below the task table (fix-wave-A): the
    mission/description, connected team, documents, and the milestones /
    risks / teams columns. The spreadsheet list above stays the primary
    content, matching the reference design. */
export function ProgramOverview({
  program,
  uiLanguage,
  onProgramUpdate,
}: {
  program: Program;
  uiLanguage: UiLanguage;
  onProgramUpdate?: (program: Program) => void;
}): ReactElement {
  const t = STRINGS[uiLanguage];
  const severityLabels: Record<Severity, string> = {
    low: t.severityLow,
    medium: t.severityMedium,
    high: t.severityHigh,
    critical: t.severityCritical,
  };
  const name = programDisplayName(program);
  const mission = program.mission.trim();

  return (
    <section className="proj-overview" dir={program.language === "ar" ? "rtl" : "ltr"}>
      <h2 className="proj-overview-heading">{t.overviewHeading}</h2>
      {/* Mission only when it says more than the title (audit §global-3). */}
      {mission && mission !== name && mission !== program.name ? (
        <p className="proj-overview-mission">{mission}</p>
      ) : null}
      {/* Connected-team editor chip — optimistic PATCH, revert + toast on failure. */}
      <div className="program-head-chips">
        <ProgramTeamChip program={program} onProgramUpdate={onProgramUpdate} />
      </div>

      {/* Program-level documents, shared component in program scope. */}
      <AttachmentsSection
        programId={program.id}
        uiLanguage={uiLanguage}
        heading={t.documentsHeading}
        collapsible
      />

      <div className="two-col">
        <div>
          <p className="subhead">{t.milestonesHeading}</p>
          <ul className="stack">
            {program.milestones.map((ms) => (
              <li key={ms.id}>
                <span className="date" title={ms.dueDate}>
                  {formatIsoDate(ms.dueDate, program.language)}
                </span>
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
    </section>
  );
}
