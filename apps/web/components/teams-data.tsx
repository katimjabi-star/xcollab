"use client";

import { useEffect, useState } from "react";
import { API_BASE, WORKSPACE } from "../lib/api-client.ts";
import { listTeams, setTeamsAuthTokenProvider, type Team } from "../lib/api-teams.ts";
import { useAuth } from "../lib/auth-context.tsx";

let teamsCache: Promise<Team[]> | null = null;
const cacheListeners = new Set<() => void>();

/**
 * Drop the shared teams cache and refresh every mounted consumer. Call after
 * any team mutation (create / rename / delete / member change) so the composer
 * select, program chips, and assignee grouping never serve stale teams.
 */
export function invalidateTeamsCache(): void {
  teamsCache = null;
  for (const notify of cacheListeners) notify();
}

/**
 * Workspace teams, fetched once per session and shared by every connected-team
 * surface (composer select, program card chips, header chip popover, assignee
 * grouping). Registers the teams Bearer source in the same effect, before the
 * fetch fires (mirror of the teams page wiring). Fails soft to an empty list —
 * consumers render nothing / ungrouped when teams can't load. Team mutations
 * call invalidateTeamsCache(), which re-runs the fetch for mounted consumers.
 */
export function useWorkspaceTeams(): Team[] {
  const { getToken } = useAuth();
  const [teams, setTeams] = useState<Team[]>([]);
  useEffect(() => {
    setTeamsAuthTokenProvider(getToken);
    let cancelled = false;
    const load = () => {
      teamsCache ??= listTeams(API_BASE, WORKSPACE);
      teamsCache
        .then((list) => {
          if (!cancelled) setTeams(list);
        })
        .catch(() => {
          teamsCache = null; // allow a retry on the next mount
        });
    };
    load();
    cacheListeners.add(load);
    return () => {
      cancelled = true;
      cacheListeners.delete(load);
    };
  }, [getToken]);
  return teams;
}

/** Client-join helper — undefined when the id is unset or no longer resolves. */
export function findTeam(teams: readonly Team[], teamId: string | null): Team | undefined {
  if (!teamId) return undefined;
  return teams.find((team) => team.id === teamId);
}
