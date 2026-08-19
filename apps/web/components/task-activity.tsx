import type { LedgerEntry } from "@xcollab/core";
import type { UiLanguage } from "../lib/i18n.ts";

const MINUTE_MS = 60_000;
const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

/** Friendly relative time; falls back to a local date string past 7 days. */
export function formatRelativeTime(iso: string, lang: UiLanguage, now = Date.now()): string {
  const diffMs = new Date(iso).getTime() - now;
  const abs = Math.abs(diffMs);
  if (Number.isNaN(abs) || abs >= 7 * DAY_MS) return new Date(iso).toLocaleDateString(lang);
  const rtf = new Intl.RelativeTimeFormat(lang, { numeric: "auto" });
  if (abs >= DAY_MS) return rtf.format(Math.round(diffMs / DAY_MS), "day");
  if (abs >= HOUR_MS) return rtf.format(Math.round(diffMs / HOUR_MS), "hour");
  return rtf.format(Math.round(diffMs / MINUTE_MS), "minute");
}

/** Read-only ledger slice for one task — reuses .stack/.date/.empty verbatim. */
export function TaskActivity({
  entries,
  uiLanguage,
  emptyLabel,
}: {
  entries: LedgerEntry[];
  uiLanguage: UiLanguage;
  emptyLabel: string;
}) {
  if (entries.length === 0) return <p className="empty">{emptyLabel}</p>;
  return (
    <ul className="stack">
      {entries.map((entry) => (
        <li key={entry.seq}>
          <span className="date">{formatRelativeTime(entry.occurredAt, uiLanguage)}</span>
          <span>{entry.action}</span>
        </li>
      ))}
    </ul>
  );
}
