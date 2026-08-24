"use client";

import Link from "next/link";
import { ChevronDown, ChevronUp, Pencil, Trash2, Users } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Program } from "@xcollab/core";
import { API_BASE, WORKSPACE, programTeamId } from "../lib/api-client.ts";
import { deleteTeam, updateTeam, type Team, type WorkspaceUser } from "../lib/api-teams.ts";
import { formatMemberCount } from "../lib/i18n.ts";
import { programColor, programDisplayName } from "../lib/program-format.ts";
import { useToasts } from "../lib/toast-context.tsx";
import { useUi } from "../lib/ui-context.tsx";
import { Icon } from "./ui/icon.tsx";
import { MemberAvatarStack } from "./teams-avatar.tsx";
import { invalidateTeamsCache } from "./teams-data.tsx";
import { TeamMembers } from "./teams-members.tsx";

/** Same arm/disarm window as the task panel delete. */
const DISARM_MS = 3000;

/** Linked-project chips shown before the "+N" overflow collapses the rest. */
const CHIP_CAP = 3;

interface TeamCardProps {
  team: Team;
  users: readonly WorkspaceUser[] | null;
  usersError: boolean;
  /** Workspace programs (fetched once by the page); null while loading. */
  programs: readonly Program[] | null;
  onChange: (team: Team) => void;
  onDeleted: (teamId: string) => void;
}

/** Chip row of the programs connected to this team (client-join on teamId). */
function TeamProjectChips({
  team,
  programs,
}: {
  team: Team;
  programs: readonly Program[] | null;
}) {
  const { t } = useUi();
  if (programs === null) return null;
  const linked = programs.filter((program) => programTeamId(program) === team.id);
  return (
    <div className="tm-card-projects">
      <p className="tm-card-projects-label">
        {t.teamProjectsLabel}
        <span className="tm-card-projects-count num">{linked.length}</span>
      </p>
      {linked.length === 0 ? (
        <p className="tm-card-projects-empty">{t.teamProgramsEmpty}</p>
      ) : (
        <div className="tm-chips">
          {linked.slice(0, CHIP_CAP).map((program) => (
            <Link key={program.id} className="tm-chip" href={`/projects/${program.id}`}>
              <span
                className="tm-chip-dot"
                style={{ background: programColor(program.id) }}
                aria-hidden
              />
              <span className="tm-chip-name" dir="auto">
                {programDisplayName(program)}
              </span>
            </Link>
          ))}
          {linked.length > CHIP_CAP ? (
            <span className="tm-chip tm-chip-more num">+{linked.length - CHIP_CAP}</span>
          ) : null}
        </div>
      )}
    </div>
  );
}

/** Card header: tinted team glyph, name (inline-renamable), hover actions. */
function TeamCardHead({
  team,
  name,
  renaming,
  armed,
  onName,
  onRenameStart,
  onRenameCommit,
  onRenameCancel,
  onDelete,
}: {
  team: Team;
  name: string;
  renaming: boolean;
  armed: boolean;
  onName: (next: string) => void;
  onRenameStart: () => void;
  onRenameCommit: () => void;
  onRenameCancel: () => void;
  onDelete: () => void;
}) {
  const { t } = useUi();
  return (
    <div className="tm-card-head">
      <span className="tm-card-glyph" aria-hidden>
        <Icon icon={Users} size={15} />
      </span>
      {renaming ? (
        <input
          className="team-rename-input"
          autoFocus
          value={name}
          aria-label={t.teamNameLabel}
          onChange={(event) => onName(event.target.value)}
          onBlur={onRenameCommit}
          onKeyDown={(event) => {
            if (event.key === "Enter") onRenameCommit();
            else if (event.key === "Escape") onRenameCancel();
          }}
        />
      ) : (
        <span className="tm-card-name" dir="auto">
          {team.name}
        </span>
      )}
      <div className="tm-card-actions">
        <button
          type="button"
          className="team-icon-btn"
          aria-label={t.renameTeamAction}
          title={t.renameTeamAction}
          onClick={onRenameStart}
        >
          <Icon icon={Pencil} size={14} />
        </button>
        <button
          type="button"
          className={armed ? "team-icon-btn armed" : "team-icon-btn"}
          aria-label={armed ? t.confirmDelete : t.deleteTeamAction}
          title={armed ? t.confirmDelete : t.deleteTeamAction}
          onClick={onDelete}
        >
          <Icon icon={Trash2} size={14} />
        </button>
      </div>
    </div>
  );
}

/** Team card in the app's card design language (home-grid ladder): tinted
    glyph + name, description, member avatar stack + count, linked-project
    chips, and an expandable member-management body (add/remove members). */
export function TeamCard({ team, users, usersError, programs, onChange, onDeleted }: TeamCardProps) {
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
        invalidateTeamsCache();
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
        invalidateTeamsCache();
        onDeleted(team.id);
        push({ message: t.teamDeleted });
      })
      .catch(() => push({ message: t.actionFailed }));
  };

  return (
    <article className="tm-card">
      <TeamCardHead
        team={team}
        name={name}
        renaming={renaming}
        armed={armed}
        onName={setName}
        onRenameStart={() => setRenaming(true)}
        onRenameCommit={commitRename}
        onRenameCancel={() => {
          setName(team.name);
          setRenaming(false);
        }}
        onDelete={handleDelete}
      />
      <p className={team.description ? "tm-card-desc" : "tm-card-desc tm-card-desc-empty"} dir="auto">
        {team.description || t.teamNoDescription}
      </p>
      <div className="tm-card-people">
        <MemberAvatarStack members={team.members} users={users} />
        <span className="tm-card-people-count">{formatMemberCount(t, team.members.length)}</span>
      </div>
      <TeamProjectChips team={team} programs={programs} />
      <button
        type="button"
        className="tm-card-toggle"
        aria-expanded={expanded}
        onClick={() => setExpanded((prev) => !prev)}
      >
        <Icon icon={expanded ? ChevronUp : ChevronDown} size={14} />
        {expanded ? t.collapseTeam : t.expandTeam}
      </button>
      {expanded ? (
        <TeamMembers team={team} users={users} usersError={usersError} onChange={onChange} />
      ) : null}
    </article>
  );
}
