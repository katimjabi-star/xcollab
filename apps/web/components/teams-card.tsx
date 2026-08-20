"use client";

import { ChevronDown, ChevronUp, Pencil, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { API_BASE, WORKSPACE } from "../lib/api-client.ts";
import { deleteTeam, updateTeam, type Team, type WorkspaceUser } from "../lib/api-teams.ts";
import { useToasts } from "../lib/toast-context.tsx";
import { useUi } from "../lib/ui-context.tsx";
import { Icon } from "./ui/icon.tsx";
import { MemberAvatarStack } from "./teams-avatar.tsx";
import { TeamMembers } from "./teams-members.tsx";

/** Same arm/disarm window as the task panel delete. */
const DISARM_MS = 3000;

interface TeamCardProps {
  team: Team;
  users: readonly WorkspaceUser[] | null;
  usersError: boolean;
  onChange: (team: Team) => void;
  onDeleted: (teamId: string) => void;
}

/** Dense expandable card: header (avatar stack · name 13/500 · desc 12 muted ·
    hover-revealed rename/delete), body = member rows + add-member picker. */
export function TeamCard({ team, users, usersError, onChange, onDeleted }: TeamCardProps) {
  const { t } = useUi();
  const { push } = useToasts();
  const [expanded, setExpanded] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(team.name);
  const [armed, setArmed] = useState(false);
  const disarmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => setName(team.name), [team.name]);
  useEffect(
    () => () => {
      if (disarmTimer.current) clearTimeout(disarmTimer.current);
    },
    [],
  );

  const commitRename = () => {
    setRenaming(false);
    const trimmed = name.trim();
    if (!trimmed || trimmed === team.name) {
      setName(team.name); // empty/unchanged → revert, no request
      return;
    }
    updateTeam(API_BASE, { workspaceId: WORKSPACE, teamId: team.id, patch: { name: trimmed } })
      .then((next) => {
        onChange(next);
        push({ message: t.teamUpdated });
      })
      .catch(() => {
        setName(team.name);
        push({ message: t.actionFailed });
      });
  };

  const handleDelete = () => {
    if (!armed) {
      setArmed(true);
      disarmTimer.current = setTimeout(() => setArmed(false), DISARM_MS);
      return;
    }
    if (disarmTimer.current) clearTimeout(disarmTimer.current);
    setArmed(false);
    deleteTeam(API_BASE, { workspaceId: WORKSPACE, teamId: team.id })
      .then(() => {
        onDeleted(team.id);
        push({ message: t.teamDeleted });
      })
      .catch(() => push({ message: t.actionFailed }));
  };

  const toggle = () => setExpanded((v) => !v);

  return (
    <article className="team-card">
      <div className="team-card-head" onClick={renaming ? undefined : toggle}>
        <MemberAvatarStack members={team.members} users={users} />
        {renaming ? (
          <input
            className="team-rename-input"
            autoFocus
            value={name}
            aria-label={t.teamNameLabel}
            onClick={(event) => event.stopPropagation()}
            onChange={(event) => setName(event.target.value)}
            onBlur={commitRename}
            onKeyDown={(event) => {
              if (event.key === "Enter") commitRename();
              else if (event.key === "Escape") {
                setName(team.name);
                setRenaming(false);
              }
            }}
          />
        ) : (
          <button
            type="button"
            className="team-card-titles"
            aria-expanded={expanded}
            title={expanded ? t.collapseTeam : t.expandTeam}
            onClick={(event) => {
              event.stopPropagation();
              toggle();
            }}
          >
            <span className="team-card-name">{name}</span>
            <span className="team-card-desc">
              {team.description || `${team.members.length} ${t.membersCountLabel}`}
            </span>
          </button>
        )}
        <div className="team-card-actions" onClick={(event) => event.stopPropagation()}>
          <button
            type="button"
            className="team-icon-btn"
            aria-label={t.renameTeamAction}
            title={t.renameTeamAction}
            onClick={() => setRenaming(true)}
          >
            <Icon icon={Pencil} size={14} />
          </button>
          <button
            type="button"
            className={armed ? "team-icon-btn armed" : "team-icon-btn"}
            aria-label={armed ? t.confirmDelete : t.deleteTeamAction}
            title={armed ? t.confirmDelete : t.deleteTeamAction}
            onClick={handleDelete}
          >
            <Icon icon={Trash2} size={14} />
          </button>
        </div>
        <span className="team-card-chevron" aria-hidden>
          <Icon icon={expanded ? ChevronUp : ChevronDown} size={14} />
        </span>
      </div>
      {expanded ? (
        <TeamMembers team={team} users={users} usersError={usersError} onChange={onChange} />
      ) : null}
    </article>
  );
}
