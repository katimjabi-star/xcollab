"use client";

import { useEffect, useState } from "react";
import { Check, ChevronDown, X } from "lucide-react";
import { API_BASE, WORKSPACE, listUsers, type WorkspaceUser } from "../lib/api-client.ts";
import type { STRINGS } from "../lib/i18n.ts";
import { Avatar } from "./ui/avatar.tsx";
import { Icon } from "./ui/icon.tsx";
import { Popover } from "./ui/popover.tsx";
import { findTeam, useWorkspaceTeams } from "./teams-data.tsx";

type Strings = (typeof STRINGS)["en"];

export function fullName(user: WorkspaceUser): string {
  return `${user.firstName} ${user.lastName}`.trim();
}

let usersCache: Promise<WorkspaceUser[]> | null = null;

/**
 * Workspace members, fetched once per session and shared by every assignee
 * surface (panel picker, board filter, card avatars). Fails soft to an empty
 * list — consumers fall back to plain usernames.
 */
export function useWorkspaceUsers(): WorkspaceUser[] {
  const [users, setUsers] = useState<WorkspaceUser[]>([]);
  useEffect(() => {
    let cancelled = false;
    usersCache ??= listUsers(API_BASE, { workspaceId: WORKSPACE });
    usersCache
      .then((list) => {
        if (!cancelled) setUsers(list);
      })
      .catch(() => {
        usersCache = null; // allow a retry on the next mount
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return users;
}

interface AssigneePickerProps {
  /** Current assignee username, or null when unassigned. */
  assignee: string | null;
  /** Fires with the picked username, or null for "Unassign". */
  onSelect: (username: string | null) => void;
  /** Connected team of the program — its members group first; null/missing
      team falls back to the flat everyone list (fail-soft). */
  programTeamId?: string | null;
  t: Strings;
}

/** Chip-shaped trigger opening a searchable people popover: avatar + full
    name + username rows, current assignee checked, Unassign row when set.
    With a resolvable programTeamId, team members sort first under an 11px
    team-name label and the rest under "Everyone" — all stay assignable. */
/** Search filter + team-first split; without a resolvable team everything
    lands in `others` (the flat pre-team list shape). */
function groupMatches(
  users: WorkspaceUser[],
  team: ReturnType<typeof findTeam>,
  query: string,
): { teamMatches: WorkspaceUser[]; otherMatches: WorkspaceUser[] } {
  const q = query.trim().toLowerCase();
  const matches = q
    ? users.filter(
        (user) =>
          user.username.toLowerCase().includes(q) || fullName(user).toLowerCase().includes(q),
      )
    : users;
  if (!team) return { teamMatches: [], otherMatches: matches };
  const memberSet = new Set(team.members.map((member) => member.username));
  return {
    teamMatches: matches.filter((user) => memberSet.has(user.username)),
    otherMatches: matches.filter((user) => !memberSet.has(user.username)),
  };
}

export function AssigneePicker({ assignee, onSelect, programTeamId = null, t }: AssigneePickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const users = useWorkspaceUsers();
  const team = findTeam(useWorkspaceTeams(), programTeamId);
  const current = users.find((user) => user.username === assignee);
  const { teamMatches, otherMatches } = groupMatches(users, team, query);

  const close = () => {
    setOpen(false);
    setQuery("");
  };
  const pick = (username: string | null) => {
    close();
    if (username !== assignee) onSelect(username);
  };

  return (
    <Popover
      open={open}
      onClose={close}
      role="dialog"
      align="start"
      anchor={
        <button
          type="button"
          className={`assignee-trigger${assignee ? "" : " empty"}`}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-label={t.taskAssignee}
          onClick={() => (open ? close() : setOpen(true))}
        >
          {assignee ? <Avatar name={current ? fullName(current) : assignee} size={16} /> : null}
          <span className="assignee-trigger-name">
            {assignee ? (current ? fullName(current) : assignee) : t.noAssignee}
          </span>
          <Icon icon={ChevronDown} size={12} />
        </button>
      }
    >
      <div className="assignee-pop">
        <input
          type="search"
          className="assignee-search"
          placeholder={t.searchPeoplePlaceholder}
          aria-label={t.searchPeoplePlaceholder}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <div className="assignee-list" role="listbox" aria-label={t.taskAssignee}>
          {assignee ? (
            <button type="button" className="assignee-row assignee-unassign" onClick={() => pick(null)}>
              <Icon icon={X} size={14} />
              {t.unassign}
            </button>
          ) : null}
          <AssigneeOptions
            teamName={team?.name}
            teamMatches={teamMatches}
            otherMatches={otherMatches}
            assignee={assignee}
            pick={pick}
            t={t}
          />
        </div>
      </div>
    </Popover>
  );
}

/** Option list body: team members first under an 11px team-name label, the
    rest under "Everyone"; flat when no team grouping applies. */
function AssigneeOptions({
  teamName,
  teamMatches,
  otherMatches,
  assignee,
  pick,
  t,
}: {
  teamName: string | undefined;
  teamMatches: WorkspaceUser[];
  otherMatches: WorkspaceUser[];
  assignee: string | null;
  pick: (username: string) => void;
  t: Strings;
}) {
  if (teamMatches.length === 0 && otherMatches.length === 0) {
    return <p className="assignee-empty">{t.noPeopleFound}</p>;
  }
  const grouped = teamName !== undefined && teamMatches.length > 0;
  return (
    <>
      {grouped ? (
        <p className="assignee-group-label" dir="auto">
          {teamName}
        </p>
      ) : null}
      {teamMatches.map((user) => (
        <AssigneeRow key={user.username} user={user} assignee={assignee} pick={pick} />
      ))}
      {grouped && otherMatches.length > 0 ? (
        <p className="assignee-group-label">{t.everyoneLabel}</p>
      ) : null}
      {otherMatches.map((user) => (
        <AssigneeRow key={user.username} user={user} assignee={assignee} pick={pick} />
      ))}
    </>
  );
}

/** One selectable person row (avatar · full name / username · check). */
function AssigneeRow({
  user,
  assignee,
  pick,
}: {
  user: WorkspaceUser;
  assignee: string | null;
  pick: (username: string) => void;
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={user.username === assignee}
      className="assignee-row"
      onClick={() => pick(user.username)}
    >
      <Avatar name={fullName(user)} />
      <span className="assignee-row-text">
        <span className="assignee-row-name">{fullName(user)}</span>
        <span className="assignee-row-username">{user.username}</span>
      </span>
      {user.username === assignee ? <Icon icon={Check} size={14} /> : null}
    </button>
  );
}
