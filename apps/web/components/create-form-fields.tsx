"use client";

import type { STRINGS } from "../lib/i18n.ts";
import { Skeleton } from "./ui/skeleton.tsx";

type Strings = (typeof STRINGS)["en"];

/** Mission textarea + its inline required-error (create-project hero form).
    Name-first prominence per the quick-add reference: large borderless input,
    the card is the frame, autofocused on arrival. The host form is noValidate
    so the localized inline error handles empty AND whitespace briefs. */
export function MissionBrief({
  t,
  mission,
  name,
  busy,
  showError,
  onChange,
  onName,
}: {
  t: Strings;
  mission: string;
  /** Optional explicit project name — overrides the AI-derived name. */
  name: string;
  busy: boolean;
  showError: boolean;
  onChange: (value: string) => void;
  onName: (value: string) => void;
}) {
  return (
    <>
      <textarea
        autoFocus
        id="mission"
        className="create-mission"
        value={mission}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t.missionPlaceholder}
        aria-label={t.missionLabel}
        disabled={busy}
        required
        maxLength={20000}
        aria-invalid={showError || undefined}
        aria-describedby={showError ? "mission-error" : undefined}
      />
      {showError ? (
        <p className="error-note" id="mission-error" role="alert">
          {t.missionRequiredError}
        </p>
      ) : null}
      <div className="create-field create-name-field">
        <label htmlFor="project-name">{t.projectNameLabel}</label>
        <input
          id="project-name"
          type="text"
          value={name}
          maxLength={500}
          disabled={busy}
          placeholder={t.projectNamePlaceholder}
          onChange={(e) => onName(e.target.value)}
        />
      </div>
    </>
  );
}

/** Loading skeleton for the stats + recent-projects blocks (moved out of the
    page to keep it within the max-lines cap). */
export function OverviewSkeleton({ label }: { label: string }) {
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

/** Start/target-end date pair; `invalid` marks both for the shared inline
    order error (rendered by the host under the form row). */
export function TimelineFields({
  t,
  start,
  end,
  invalid,
  onStart,
  onEnd,
}: {
  t: Strings;
  start: string;
  end: string;
  invalid: boolean;
  onStart: (value: string) => void;
  onEnd: (value: string) => void;
}) {
  const aria = {
    "aria-invalid": invalid || undefined,
    "aria-describedby": invalid ? "create-dates-error" : undefined,
  };
  return (
    <>
      <div className="create-field">
        <label htmlFor="start">{t.timelineStart}</label>
        <input
          id="start"
          type="date"
          value={start}
          max={end || undefined}
          {...aria}
          onChange={(e) => onStart(e.target.value)}
        />
      </div>
      <div className="create-field">
        <label htmlFor="end">{t.timelineEnd}</label>
        <input
          id="end"
          type="date"
          value={end}
          min={start || undefined}
          {...aria}
          onChange={(e) => onEnd(e.target.value)}
        />
      </div>
    </>
  );
}
