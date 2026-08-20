"use client";

import { useEffect, useState } from "react";
import { API_BASE, WORKSPACE } from "../lib/api-client.ts";
import { listTeams, setTeamsAuthTokenProvider, type Team } from "../lib/api-teams.ts";
import { useAuth } from "../lib/auth-context.tsx";

let teamsCache: Promise<Team[]> | null = null;

/**
 * Workspace teams, fetched once per session and shared by every connected-team
 * surface (composer select, program card chips, header chip popover, assignee
 * grouping). Registers the teams Bearer source in the same effect, before the
 * fetch fires (mirror of the teams page wiring). Fails soft to an empty list —
 * consumers render nothing / ungrouped when teams can't load.
 */
export function useWorkspaceTeams(): Team[] {
  const { getToken } = useAuth();
  const [teams, setTeams] = useState<Team[]>([]);
  useEffect(() => {
    setTeamsAuthTokenProvider(getToken);
    let cancelled = false;
    teamsCache ??= listTeams(API_BASE, WORKSPACE);
    teamsCache
      .then((list) => {
        if (!cancelled) setTeams(list);
      })
      .catch(() => {
        teamsCache = null; // allow a retry on the next mount
      });
    return () => {
      cancelled = true;
    };
  }, [getToken]);
  return teams;
}

/** Client-join helper — undefined when the id is unset or no longer resolves. */
export function findTeam(teams: readonly Team[], teamId: string | null): Team | undefined {
  if (!teamId) return undefined;
  return teams.find((team) => team.id === teamId);
}
