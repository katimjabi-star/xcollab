"use client";

import Link from "next/link";
import { ApiError, listPrograms } from "../../lib/api-client.ts";
import { useUi } from "../../lib/ui-context.tsx";
import { useWorkspaceData } from "../../lib/use-workspace-data.ts";
import { ProgramCardHeader } from "../../components/program-view.tsx";

export default function ProgramsPage() {
  const { t, dir } = useUi();
  const { data, error, loaded } = useWorkspaceData(listPrograms);
  const programs = data ? [...data].reverse() : [];

  return (
    <div className="content">
      {error ? (
        <p className="error-note" role="alert">
          {t.errorGeneric}
          {error instanceof ApiError ? ` (${error.message})` : ""}
        </p>
      ) : null}

      {loaded && !error && programs.length === 0 ? (
        <p className="empty">{t.emptyState}</p>
      ) : null}

      {programs.length > 0 ? (
        <div className="programs-grid">
          {programs.map((program) => {
            const taskCount = program.packages.reduce((sum, pkg) => sum + pkg.tasks.length, 0);
            return (
              <Link key={program.id} className="card-link" href={`/programs/${program.id}`}>
                <article
                  className="program-card"
                  dir={program.language === "ar" ? "rtl" : "ltr"}
                >
                  <ProgramCardHeader program={program} />
                  {/* Counts are labeled in the UI language, so they keep the UI
                      direction even inside a card that renders the other way. */}
                  <p className="subhead" dir={dir}>
                    {program.packages.length} {t.packagesHeading} · {taskCount} {t.tasksLabel}
                  </p>
                  <span className="back-link">{t.openProgram}</span>
                </article>
              </Link>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
