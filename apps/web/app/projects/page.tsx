"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import type { LedgerEntry, Program } from "@xcollab/core";
import {
  API_BASE,
  ApiError,
  WORKSPACE,
  getLedger,
  listPrograms,
  programTeamId,
} from "../../lib/api-client.ts";
import type { Team } from "../../lib/api-teams.ts";
import { setDocumentTitle } from "../../lib/nav.ts";
import { programDisplayName, programStatus } from "../../lib/program-format.ts";
import { useUi } from "../../lib/ui-context.tsx";
import { useWorkspaceData } from "../../lib/use-workspace-data.ts";
import { fullName, useWorkspaceUsers } from "../../components/assignee-picker.tsx";
import { findTeam, useWorkspaceTeams } from "../../components/teams-data.tsx";
import {
  BrowseFilterChips,
  EMPTY_BROWSE_FILTER,
  type BrowseFilter,
} from "../../components/browse-filters.tsx";
import { BrowseTemplates } from "../../components/browse-templates.tsx";
import { ProjectRow } from "../../components/project-row.tsx";
import { Icon } from "../../components/ui/icon.tsx";
import { Skeleton } from "../../components/ui/skeleton.tsx";

/** Newest ledger timestamp per program. Entry inputs are JSON written by the
    API; task/program/attachment actions carry { programId }. program.generate
    entries carry the raw model interaction instead (no programId), so freshly
    generated, untouched programs legitimately stay unmapped → "—". Entries
    arrive in seq order, so the last write per program wins. */
function lastModifiedByProgram(entries: LedgerEntry[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const entry of entries) {
    try {
      const input = JSON.parse(entry.input) as { programId?: unknown };
      if (typeof input.programId === "string") map.set(input.programId, entry.occurredAt);
    } catch {
      /* non-JSON input — a generation interaction, never program-scoped */
    }
  }
  return map;
}

function matchesFilter(
  program: Program,
  team: Team | undefined,
  filter: BrowseFilter,
  query: string,
): boolean {
  if (query && !programDisplayName(program).toLowerCase().includes(query)) return false;
  if (filter.status !== null && programStatus(program) !== filter.status) return false;
  const members = team?.members ?? [];
  if (
    filter.owner !== null &&
    !members.some((m) => m.role === "lead" && m.username === filter.owner)
  ) {
    return false;
  }
  if (filter.member !== null && !members.some((m) => m.username === filter.member)) return false;
  return true;
}

function BrowseSkeleton({ label }: { label: string }) {
  return (
    <ul className="browse-rows" aria-hidden={false}>
      {Array.from({ length: 5 }, (_, i) => (
        <li className="browse-row browse-row-skeleton" key={i}>
          <Skeleton width="28px" height="28px" radius="8px" label={i === 0 ? label : undefined} />
          <Skeleton width="30%" height="13px" />
          <Skeleton width="52px" height="24px" radius="999px" />
        </li>
      ))}
    </ul>
  );
}

export default function BrowseProjectsPage() {
  const { t, language } = useUi();
  useEffect(() => {
    setDocumentTitle([t.browseTitle]);
  }, [t.browseTitle]);

  const { data, error, loaded } = useWorkspaceData(listPrograms);
  const teams = useWorkspaceTeams();
  const users = useWorkspaceUsers();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<BrowseFilter>(EMPTY_BROWSE_FILTER);
  const [modified, setModified] = useState<Map<string, string>>(new Map());

  // Last-modified derives from the workspace ledger (single existing fetch,
  // same endpoint the overview uses). Fail-soft: rows show "—" without it.
  useEffect(() => {
    let cancelled = false;
    getLedger(API_BASE, WORKSPACE)
      .then((ledger) => {
        if (!cancelled) setModified(lastModifiedByProgram(ledger.entries));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const nameOf = useMemo(() => {
    const map = new Map(users.map((user) => [user.username, fullName(user) || user.username]));
    return (username: string) => map.get(username) ?? username;
  }, [users]);

  const q = query.trim().toLowerCase();
  const rows = useMemo(() => {
    const programs = data ? [...data].reverse() : [];
    return programs
      .map((program) => ({
        program,
        team: findTeam(teams, programTeamId(program)),
        lastModifiedIso: modified.get(program.id) ?? null,
      }))
      .filter((row) => matchesFilter(row.program, row.team, filter, q))
      .sort((a, b) => {
        // Newest ledger activity first; unmapped programs keep list order last.
        if (a.lastModifiedIso === b.lastModifiedIso) return 0;
        if (a.lastModifiedIso === null) return 1;
        if (b.lastModifiedIso === null) return -1;
        return a.lastModifiedIso < b.lastModifiedIso ? 1 : -1;
      });
  }, [data, teams, modified, filter, q]);

  const showSkeleton = !loaded && !error;

  return (
    <div className="content browse-page">
      <div className="browse-head">
        <h1 className="browse-title">{t.browseTitle}</h1>
        <Link className="browse-create-btn" href="/">
          <Icon icon={Plus} size={14} />
          {t.browseCreateProject}
        </Link>
      </div>

      <label className="browse-search">
        <Icon icon={Search} size={14} className="browse-search-icon" />
        <input
          type="search"
          value={query}
          placeholder={t.browseFindPlaceholder}
          aria-label={t.browseFindPlaceholder}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>

      <BrowseFilterChips t={t} users={users} filter={filter} onChange={setFilter} />

      {error ? (
        <p className="error-note" role="alert">
          {t.errorGeneric}
          {error instanceof ApiError ? ` (${error.message})` : ""}
        </p>
      ) : null}

      <div className="browse-table">
        <div className="browse-table-head" aria-hidden>
          <span className="browse-col-name">{t.sortName}</span>
          <span className="browse-col-members">{t.browseMembersCol}</span>
          <span className="browse-col-modified">↓ {t.browseLastModified}</span>
        </div>
        {showSkeleton ? <BrowseSkeleton label={t.skeletonLoading} /> : null}
        {loaded && !error && rows.length === 0 ? (
          <p className="empty">{data && data.length > 0 ? t.browseNoMatches : t.emptyState}</p>
        ) : null}
        {rows.length > 0 ? (
          <ul className="browse-rows">
            {rows.map(({ program, team, lastModifiedIso }) => (
              <ProjectRow
                key={program.id}
                program={program}
                memberNames={(team?.members ?? []).map((member) => nameOf(member.username))}
                lastModifiedIso={lastModifiedIso}
                uiLanguage={language}
                t={t}
              />
            ))}
          </ul>
        ) : null}
      </div>

      <BrowseTemplates t={t} />
    </div>
  );
}
