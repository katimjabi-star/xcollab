import type { LedgerEntry } from "@xcollab/core";
import { STRINGS, type UiLanguage } from "../lib/i18n.ts";

/** Ledger action code → i18n sentence key. Shared with the ledger page so
    both surfaces humanize identically; unknown codes fall back to the raw
    string (which always stays available in the title tooltip for auditors). */
const ACTION_KEYS: Record<string, keyof (typeof STRINGS)["en"]> = {
  "program.generate": "actionProgramGenerate",
  "program.update": "actionProgramUpdate",
  "task.create": "actionTaskCreate",
  "task.update": "actionTaskUpdate",
  "task.status_update": "actionTaskStatusUpdate",
  "task.delete": "actionTaskDelete",
  "team.create": "actionTeamCreate",
  "team.update": "actionTeamUpdate",
  "team.member_add": "actionTeamMemberAdd",
  "team.member_remove": "actionTeamMemberRemove",
  "team.delete": "actionTeamDelete",
  "doc.attach": "actionDocAttach",
  "doc.remove": "actionDocRemove",
};

/** "doc.attach" → "attached a file"; unknown codes return the code itself. */
export function humanizeAction(action: string, lang: UiLanguage): string {
  const key = ACTION_KEYS[action];
  return key ? STRINGS[lang][key] : action;
}

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

/** "jabbir" → "JA", "field ops" → "FO". Unicode-aware; Arabic has no case. */
export function actorInitials(name: string): string {
  const [first, second] = name.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  if (first === undefined) return "?";
  const raw = second === undefined ? first.slice(0, 2) : first.charAt(0) + second.charAt(0);
  return raw.toUpperCase();
}

/** Read-only ledger feed for one task: 20px initials avatar, actor username,
    humanized action sentence (raw code in the tooltip), relative timestamp
    in the active UI locale. */
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
    <ul className="activity-feed">
      {entries.map((entry) => (
        <li key={entry.seq} className="activity-row">
          <span className="activity-avatar" aria-hidden>
            {actorInitials(entry.actor.id)}
          </span>
          <span className="activity-text" title={entry.action}>
            <span className="activity-actor">{entry.actor.id}</span>{" "}
            {humanizeAction(entry.action, uiLanguage)}
          </span>
          <time className="activity-time" dateTime={entry.occurredAt}>
            {formatRelativeTime(entry.occurredAt, uiLanguage)}
          </time>
        </li>
      ))}
    </ul>
  );
}
