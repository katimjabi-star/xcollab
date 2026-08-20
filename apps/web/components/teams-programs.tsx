"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { FolderKanban } from "lucide-react";
import type { Program } from "@xcollab/core";
import { API_BASE, WORKSPACE, listPrograms, programTeamId } from "../lib/api-client.ts";
import { useUi } from "../lib/ui-context.tsx";
import { Icon } from "./ui/icon.tsx";

/** Expanded-team "Programs" list: the workspace programs whose teamId points
    at this team (client-join over listPrograms — the fetch is fresh per
    expand, so a just-connected program shows up). Fail-soft error note. */
export function TeamPrograms({ teamId }: { teamId: string }) {
  const { t } = useUi();
  const [programs, setPrograms] = useState<Program[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    listPrograms(API_BASE, WORKSPACE)
      .then((list) => {
        if (!cancelled) setPrograms(list);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const linked = (programs ?? []).filter((program) => programTeamId(program) === teamId);

  return (
    <div className="team-programs">
      <p className="team-programs-label">
        {t.programsHeading}
        {programs !== null ? (
          <span className="team-programs-count num">{linked.length}</span>
        ) : null}
      </p>
      {error ? (
        <p className="error-note" role="alert">
          {t.loadFailed}
        </p>
      ) : programs === null ? null : linked.length === 0 ? (
        <p className="team-programs-empty">{t.teamProgramsEmpty}</p>
      ) : (
        <ul className="team-programs-list">
          {linked.map((program) => {
            const taskCount = program.packages.reduce((sum, pkg) => sum + pkg.tasks.length, 0);
            return (
              <li key={program.id}>
                <Link className="team-program-row" href={`/programs/${program.id}`}>
                  <Icon icon={FolderKanban} size={14} />
                  <span className="team-program-name" dir="auto">
                    {program.name}
                  </span>
                  <span className="team-program-count num">
                    {taskCount} {t.tasksLabel}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
