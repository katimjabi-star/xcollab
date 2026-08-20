"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { Program, Task } from "@xcollab/core";
import { API_BASE, WORKSPACE, createProgram, getLedger, listPrograms } from "../lib/api-client.ts";
import { useUi } from "../lib/ui-context.tsx";
import { StatsRow } from "../components/stats-row.tsx";
import { useWorkspaceTeams } from "../components/teams-data.tsx";
import { Chip } from "../components/ui/chip.tsx";
import { Skeleton } from "../components/ui/skeleton.tsx";

const RECENT_LIMIT = 6;

/** Skeletons appear only once loading has visibly taken longer than 300ms. */
function useSkeletonGate(loaded: boolean): boolean {
  const [pastDelay, setPastDelay] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setPastDelay(true), 300);
    return () => clearTimeout(id);
  }, []);
  return pastDelay && !loaded;
}

/** Roll-up status for a program row: blocked > in progress > done > todo. */
function programStatus(program: Program): Task["status"] {
  const tasks = program.packages.flatMap((pkg) => pkg.tasks);
  if (tasks.some((task) => task.status === "blocked")) return "blocked";
  if (tasks.length > 0 && tasks.every((task) => task.status === "done")) return "done";
  if (tasks.some((task) => task.status !== "todo")) return "in_progress";
  return "todo";
}

function OverviewSkeleton({ label }: { label: string }) {
  return (
    <>
      <div className="stats-row">
        {Array.from({ length: 4 }, (_, i) => (
          <div className="stat-tile" key={i}>
            <Skeleton width="60%" height="12px" label={i === 0 ? label : undefined} />
            <Skeleton width="32px" height="20px" />
          </div>
        ))}
      </div>
      <section>
        <div className="section-head">
          <Skeleton width="8rem" height="13px" />
        </div>
        <div className="row-list">
          {Array.from({ length: 4 }, (_, i) => (
            <div className="row-skeleton" key={i}>
              <Skeleton width="14rem" height="13px" />
              <Skeleton width="5rem" height="20px" radius="999px" />
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

export default function Home() {
  const { language, t } = useUi();
  const [mission, setMission] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [parentId, setParentId] = useState("");
  const [teamId, setTeamId] = useState("");
  const teams = useWorkspaceTeams();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [ledgerValid, setLedgerValid] = useState<boolean | null>(null);
  const [ledgerCount, setLedgerCount] = useState(0);

  const refresh = useCallback(async () => {
    const [list, ledger] = await Promise.all([
      listPrograms(API_BASE, WORKSPACE),
      getLedger(API_BASE, WORKSPACE),
    ]);
    setPrograms(list.reverse());
    setLedgerValid(ledger.verification.valid);
    setLedgerCount(ledger.entries.length);
    setLoaded(true);
  }, []);

  useEffect(() => {
    refresh().catch(() => {
      setError(true);
      setLoaded(true);
    });
  }, [refresh]);

  const showSkeleton = useSkeletonGate(loaded);

  const statusLabels: Record<Task["status"], string> = {
    todo: t.statusTodo,
    in_progress: t.statusInProgress,
    blocked: t.statusBlocked,
    done: t.statusDone,
  };

  async function onGenerate(event: React.FormEvent) {
    event.preventDefault();
    if (!mission.trim() || busy) return;
    setBusy(true);
    setError(false);
    try {
      await createProgram(API_BASE, {
        workspaceId: WORKSPACE,
        mission: mission.trim(),
        language,
        ...(start && end ? { timeline: { start, end } } : {}),
        ...(parentId ? { parentId } : {}),
        ...(teamId ? { teamId } : {}),
      });
      setMission("");
      setParentId("");
      setTeamId("");
      await refresh();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  const recent = programs.slice(0, RECENT_LIMIT);

  return (
    <div className="content">
      {showSkeleton ? (
        <OverviewSkeleton label={t.skeletonLoading} />
      ) : (
        <StatsRow
          programs={programs}
          ledgerValid={ledgerValid}
          ledgerCount={ledgerCount}
          uiLanguage={language}
        />
      )}

      {/* Mission composer — the product's signature action, the one weighted card. */}
      <form className="mission-form" onSubmit={onGenerate}>
        <h2 className="mission-tagline">{t.tagline}</h2>
        <label htmlFor="mission">{t.missionLabel}</label>
        <textarea
          id="mission"
          value={mission}
          onChange={(e) => setMission(e.target.value)}
          placeholder={t.missionPlaceholder}
          required
        />
        <div className="form-row">
          <div className="field">
            <label htmlFor="start">{t.timelineStart}</label>
            <input id="start" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="end">{t.timelineEnd}</label>
            <input id="end" type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
          </div>
          <button className="generate-btn" type="submit" disabled={busy}>
            {busy ? t.generating : t.generate}
          </button>
        </div>
        {/* Optional hierarchy: 12px label row under the dates, default none. */}
        {programs.length > 0 ? (
          <div className="composer-parent-row">
            <label htmlFor="parent-program">{t.parentProgramLabel}</label>
            <select
              id="parent-program"
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
            >
              <option value="">{t.parentNone}</option>
              {programs.map((program) => (
                <option key={program.id} value={program.id}>
                  {program.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        {/* Optional connected team: 12px label + compact select, None default. */}
        {teams.length > 0 ? (
          <div className="composer-parent-row">
            <label htmlFor="program-team">{t.teamLabel}</label>
            <select id="program-team" value={teamId} onChange={(e) => setTeamId(e.target.value)}>
              <option value="">{t.teamNone}</option>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        {error ? (
          <p className="error-note" role="alert">
            {t.errorGeneric}
          </p>
        ) : null}
      </form>

      {showSkeleton ? null : (
        <section>
          <div className="section-head">
            <h2>{t.recentProgramsHeading}</h2>
          </div>
          {loaded && recent.length === 0 ? (
            <p className="empty">{t.emptyState}</p>
          ) : (
            <ul className="row-list">
              {recent.map((program) => {
                const taskCount = program.packages.reduce((n, pkg) => n + pkg.tasks.length, 0);
                const status = programStatus(program);
                return (
                  <li key={program.id}>
                    <Link className="program-row" href={`/projects/${program.id}`}>
                      <span className="program-row-name" dir="auto">
                        {program.name}
                      </span>
                      <span className="program-row-meta">
                        <span className="num">{program.packages.length}</span>{" "}
                        {t.packagesHeading} · <span className="num">{taskCount}</span>{" "}
                        {t.tasksLabel}
                      </span>
                      <Chip variant="status" status={status}>
                        {statusLabels[status]}
                      </Chip>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
