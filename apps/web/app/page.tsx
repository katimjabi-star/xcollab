"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import type { Program, Task } from "@xcollab/core";
import { API_BASE, WORKSPACE, createProgram, getLedger, listPrograms } from "../lib/api-client.ts";
import { setDocumentTitle } from "../lib/nav.ts";
import { useToasts } from "../lib/toast-context.tsx";
import { useUi } from "../lib/ui-context.tsx";
import { StatsRow } from "../components/stats-row.tsx";
import { programColor, programDisplayName, programStatus } from "../lib/program-format.ts";
import { MissionBrief, TimelineFields } from "../components/create-form-fields.tsx";
import { useWorkspaceTeams } from "../components/teams-data.tsx";
import { Chip } from "../components/ui/chip.tsx";
import { Icon } from "../components/ui/icon.tsx";
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

function OverviewSkeleton({ label }: { label: string }) {
  return (
    <>
      <div className="create-stats">
        {Array.from({ length: 4 }, (_, i) => (
          <div className="create-stat" key={i}>
            <Skeleton width="60%" height="12px" label={i === 0 ? label : undefined} />
            <Skeleton width="32px" height="20px" />
          </div>
        ))}
      </div>
      <section className="create-card">
        <div className="create-card-head">
          <Skeleton width="8rem" height="15px" />
        </div>
        <div className="create-recent-list">
          {Array.from({ length: 4 }, (_, i) => (
            <div className="create-row-skeleton" key={i}>
              <Skeleton width="28px" height="28px" radius="8px" />
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
  const router = useRouter();
  const { push } = useToasts();
  const [mission, setMission] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [parentId, setParentId] = useState("");
  const [teamId, setTeamId] = useState("");
  const teams = useWorkspaceTeams();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [missionError, setMissionError] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [ledgerValid, setLedgerValid] = useState<boolean | null>(null);
  const [ledgerCount, setLedgerCount] = useState(0);

  useEffect(() => {
    setDocumentTitle([t.createTitle]);
  }, [t.createTitle]);

  // Mount fetch with unmount cancellation — a fast navigation away must not
  // set state on the unmounted page.
  useEffect(() => {
    let cancelled = false;
    Promise.all([listPrograms(API_BASE, WORKSPACE), getLedger(API_BASE, WORKSPACE)])
      .then(([list, ledger]) => {
        if (cancelled) return;
        setPrograms(list.reverse());
        setLedgerValid(ledger.verification.valid);
        setLedgerCount(ledger.entries.length);
        setLoaded(true);
      })
      .catch(() => {
        if (cancelled) return;
        setError(true);
        setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // ISO YYYY-MM-DD compares lexicographically; both set and out of order = invalid.
  const datesInvalid = start !== "" && end !== "" && start > end;

  const showSkeleton = useSkeletonGate(loaded);

  const statusLabels: Record<Task["status"], string> = {
    todo: t.statusTodo,
    in_progress: t.statusInProgress,
    blocked: t.statusBlocked,
    done: t.statusDone,
  };

  async function onGenerate(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    // Visible field errors block the submit: whitespace-only mission (passes
    // the native `required`) and a start after the target end.
    if (!mission.trim()) {
      setMissionError(true);
      return;
    }
    if (datesInvalid) return; // inline error already showing under the dates
    setBusy(true);
    setError(false);
    try {
      const created = await createProgram(API_BASE, {
        workspaceId: WORKSPACE,
        mission: mission.trim(),
        language,
        ...(start && end ? { timeline: { start, end } } : {}),
        ...(parentId ? { parentId } : {}),
        ...(teamId ? { teamId } : {}),
      });
      // Success: confirm via toast (survives navigation — the stack lives in
      // the root layout) and land on the new project. busy stays true until
      // the route change unmounts this page, so no double-submit window.
      push({ message: t.projectCreated });
      router.push(`/projects/${created.program.id}`);
    } catch {
      setError(true);
      setBusy(false);
    }
  }

  const recent = programs.slice(0, RECENT_LIMIT);

  return (
    <div className="content create-page">
      <header className="create-head">
        <h1 className="create-title">{t.createTitle}</h1>
        <p className="create-tagline">{t.tagline}</p>
      </header>

      {/* Mission composer — the product's signature action, the hero card. */}
      <form className="create-card create-hero" onSubmit={onGenerate}>
        <div className="create-card-head">
          <span className="create-hero-icon" aria-hidden>
            <Icon icon={Sparkles} size={16} />
          </span>
          <h2>{t.createWithAi}</h2>
        </div>
        <MissionBrief
          t={t}
          mission={mission}
          busy={busy}
          showError={missionError}
          onChange={(value) => {
            setMission(value);
            if (value.trim()) setMissionError(false);
          }}
        />
        {/* One meta row: dates · parent · team, labels above inputs, primary
            action pinned inline-end. */}
        <div className="create-form-row">
          <TimelineFields
            t={t}
            start={start}
            end={end}
            invalid={datesInvalid}
            onStart={setStart}
            onEnd={setEnd}
          />
          {programs.length > 0 ? (
            <div className="create-field">
              <label htmlFor="parent-program">{t.parentProgramLabel}</label>
              <select
                id="parent-program"
                value={parentId}
                onChange={(e) => setParentId(e.target.value)}
              >
                <option value="">{t.parentNone}</option>
                {programs.map((program) => (
                  <option key={program.id} value={program.id}>
                    {programDisplayName(program)}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          {teams.length > 0 ? (
            <div className="create-field">
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
          <button
            className="create-generate-btn"
            type="submit"
            disabled={busy || datesInvalid}
            aria-busy={busy}
          >
            {busy ? <span className="create-spinner" aria-hidden /> : null}
            {busy ? t.generating : t.generate}
          </button>
        </div>
        {datesInvalid ? (
          <p className="error-note" id="create-dates-error" role="alert">
            {t.createDatesOrderError}
          </p>
        ) : null}
        {error ? (
          <p className="error-note" role="alert">
            {t.errorGeneric}
          </p>
        ) : null}
      </form>

      {showSkeleton ? (
        <OverviewSkeleton label={t.skeletonLoading} />
      ) : (
        <>
          <StatsRow
            programs={programs}
            ledgerValid={ledgerValid}
            ledgerCount={ledgerCount}
            uiLanguage={language}
          />

          <section className="create-card">
            <div className="create-card-head">
              <h2>{t.recentProgramsHeading}</h2>
              <Link className="create-card-link" href="/projects">
                {t.viewAllLabel}
              </Link>
            </div>
            {loaded && recent.length === 0 ? (
              <p className="empty">{t.emptyState}</p>
            ) : (
              <ul className="create-recent-list">
                {recent.map((program) => {
                  const taskCount = program.packages.reduce((n, pkg) => n + pkg.tasks.length, 0);
                  const status = programStatus(program);
                  return (
                    <li key={program.id}>
                      <Link className="create-recent-row" href={`/projects/${program.id}`}>
                        <span
                          className="create-swatch"
                          style={{ background: programColor(program.id) }}
                          aria-hidden
                        />
                        <span className="create-recent-name" dir="auto">
                          {programDisplayName(program)}
                        </span>
                        <span className="create-recent-meta">
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
        </>
      )}
    </div>
  );
}
