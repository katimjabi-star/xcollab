"use client";

import Link from "next/link";
import type { Program } from "@xcollab/core";
import type { STRINGS, UiLanguage } from "../lib/i18n.ts";
import { programColor, programDisplayName } from "../lib/program-format.ts";
import { Avatar } from "./ui/avatar.tsx";

type Strings = (typeof STRINGS)["en"];

/** Avatars shown before the "+N" overflow bubble collapses the rest. */
const AVATAR_CAP = 2;

/** "3 hours ago" / "قبل ٣ ساعات" — coarse buckets are enough for a list. */
export function relativeTime(iso: string, uiLanguage: UiLanguage): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return iso;
  const rtf = new Intl.RelativeTimeFormat(uiLanguage === "ar" ? "ar" : "en", {
    numeric: "auto",
  });
  const minutes = Math.round((then - Date.now()) / 60_000); // negative = past
  if (minutes > -60) return rtf.format(Math.min(minutes, 0), "minute");
  const hours = Math.round(minutes / 60);
  if (hours > -24) return rtf.format(hours, "hour");
  const days = Math.round(hours / 24);
  if (days > -30) return rtf.format(days, "day");
  const months = Math.round(days / 30);
  if (months > -12) return rtf.format(months, "month");
  return rtf.format(Math.round(months / 12), "year");
}

export interface ProjectRowProps {
  program: Program;
  /** Display names of the connected team's members (already resolved to full
      names where known); empty when the program has no team. */
  memberNames: string[];
  /** ISO timestamp of the newest ledger entry for this program, or null when
      the ledger carries no program-scoped entries yet (fresh generation). */
  lastModifiedIso: string | null;
  uiLanguage: UiLanguage;
  t: Strings;
}

/** One Browse-projects table row: swatch icon + name + "Joined" subline,
    overlapping member avatar stack with "+N" overflow, relative last-modified.
    The whole row is the project link (grid columns come from browse.css). */
export function ProjectRow({
  program,
  memberNames,
  lastModifiedIso,
  uiLanguage,
  t,
}: ProjectRowProps) {
  const shown = memberNames.slice(0, AVATAR_CAP);
  const overflow = memberNames.length - shown.length;
  return (
    <li>
      <Link className="browse-row" href={`/projects/${program.id}`}>
        <span className="browse-row-main">
          <span
            className="browse-swatch"
            style={{ background: programColor(program.id) }}
            aria-hidden
          />
          <span className="browse-row-titles">
            <span className="browse-row-name" dir="auto">
              {programDisplayName(program)}
            </span>
            <span className="browse-row-joined">{t.browseJoined}</span>
          </span>
        </span>
        <span className="browse-row-members">
          {shown.map((name) => (
            <Avatar key={name} name={name} size={24} className="browse-stack-avatar" />
          ))}
          {overflow > 0 ? (
            <span className="browse-stack-more num" aria-label={`+${overflow}`}>
              +{overflow}
            </span>
          ) : null}
        </span>
        <span className="browse-row-modified" dir="auto">
          {lastModifiedIso ? relativeTime(lastModifiedIso, uiLanguage) : "—"}
        </span>
      </Link>
    </li>
  );
}
