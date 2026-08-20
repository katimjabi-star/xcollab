"use client";

import { useEffect, useState } from "react";
import { API_BASE, WORKSPACE } from "../../lib/api-client.ts";
import {
  listTeams,
  listUsers,
  setTeamsAuthTokenProvider,
  type Team,
  type WorkspaceUser,
} from "../../lib/api-teams.ts";
import { useAuth } from "../../lib/auth-context.tsx";
import { useUi } from "../../lib/ui-context.tsx";
import { Skeleton } from "../../components/ui/skeleton.tsx";
import { TeamCard } from "../../components/teams-card.tsx";
import { TeamsCreateForm } from "../../components/teams-create-form.tsx";

/** Skeletons appear only once loading has visibly taken longer than 300ms. */
function useSkeletonGate(loaded: boolean): boolean {
  const [pastDelay, setPastDelay] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setPastDelay(true), 300);
    return () => clearTimeout(id);
  }, []);
  return pastDelay && !loaded;
}

export default function TeamsPage() {
  const { t } = useUi();
  const { getToken } = useAuth();
  const [teams, setTeams] = useState<Team[] | null>(null);
  const [teamsError, setTeamsError] = useState(false);
  const [users, setUsers] = useState<WorkspaceUser[] | null>(null);
  const [usersError, setUsersError] = useState(false);
  const [creating, setCreating] = useState(false);
  const showSkeleton = useSkeletonGate(teams !== null || teamsError);

  useEffect(() => {
    // Register the Bearer source BEFORE the first fetch fires (same effect).
    setTeamsAuthTokenProvider(getToken);
    let cancelled = false;
    listTeams(API_BASE, WORKSPACE)
      .then((data) => {
        if (!cancelled) setTeams(data);
      })
      .catch(() => {
        if (!cancelled) setTeamsError(true);
      });
    listUsers(API_BASE, WORKSPACE)
      .then((data) => {
        if (!cancelled) setUsers(data);
      })
      .catch(() => {
        if (!cancelled) setUsersError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [getToken]);

  const applyTeam = (next: Team) =>
    setTeams((prev) => prev?.map((team) => (team.id === next.id ? next : team)) ?? prev);
  const dropTeam = (id: string) =>
    setTeams((prev) => prev?.filter((team) => team.id !== id) ?? prev);

  return (
    <div className="content">
      <div className="section-head">
        <h2 className="page-title">
          {t.teamsHeading}
          {teams ? (
            <>
              {" · "}
              <span className="num">{teams.length}</span>
            </>
          ) : null}
        </h2>
        <button type="button" className="btn-primary" onClick={() => setCreating(true)}>
          + {t.newTeam}
        </button>
      </div>

      {creating ? (
        <TeamsCreateForm
          onCreated={(team) => {
            setTeams((prev) => (prev ? [...prev, team] : [team]));
            setCreating(false);
          }}
          onClose={() => setCreating(false)}
        />
      ) : null}

      {teamsError ? (
        <p className="error-note" role="alert">
          {t.loadFailed}
        </p>
      ) : teams === null ? (
        showSkeleton ? (
          <div className="teams-list">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton
                key={i}
                width="100%"
                height="44px"
                radius="8px"
                label={i === 0 ? t.skeletonLoading : undefined}
              />
            ))}
          </div>
        ) : null
      ) : teams.length === 0 && !creating ? (
        <p className="empty">{t.teamsEmpty}</p>
      ) : (
        <div className="teams-list">
          {teams.map((team) => (
            <TeamCard
              key={team.id}
              team={team}
              users={users}
              usersError={usersError}
              onChange={applyTeam}
              onDeleted={dropTeam}
            />
          ))}
        </div>
      )}
    </div>
  );
}
