"use client";

import type { STRINGS } from "../lib/i18n.ts";

type Strings = (typeof STRINGS)["en"];

/** Mission textarea + its inline required-error (create-project hero form). */
export function MissionBrief({
  t,
  mission,
  busy,
  showError,
  onChange,
}: {
  t: Strings;
  mission: string;
  busy: boolean;
  showError: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <>
      <label htmlFor="mission">{t.missionLabel}</label>
      <textarea
        id="mission"
        value={mission}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t.missionPlaceholder}
        disabled={busy}
        required
        aria-invalid={showError || undefined}
        aria-describedby={showError ? "mission-error" : undefined}
      />
      {showError ? (
        <p className="error-note" id="mission-error" role="alert">
          {t.missionRequiredError}
        </p>
      ) : null}
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
          {...aria}
          onChange={(e) => onStart(e.target.value)}
        />
      </div>
      <div className="create-field">
        <label htmlFor="end">{t.timelineEnd}</label>
        <input id="end" type="date" value={end} {...aria} onChange={(e) => onEnd(e.target.value)} />
      </div>
    </>
  );
}
