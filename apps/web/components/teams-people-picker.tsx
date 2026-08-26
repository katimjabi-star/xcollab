"use client";

import { useRef, useState } from "react";
import { API_BASE, ApiError, WORKSPACE } from "../lib/api-client.ts";
import {
  addTeamMember,
  type Team,
  type TeamRole,
  type WorkspaceUser,
} from "../lib/api-teams.ts";
import { useToasts } from "../lib/toast-context.tsx";
import { useUi } from "../lib/ui-context.tsx";
import { Popover } from "./ui/popover.tsx";
import { fullNameOf, MemberAvatar } from "./teams-avatar.tsx";
import { invalidateTeamsCache } from "./teams-data.tsx";

interface TeamsPeoplePickerProps {
  team: Team;
  users: readonly WorkspaceUser[] | null;
  usersError: boolean;
  onChange: (team: Team) => void;
}

/** "Add member" popover: search-as-you-type over the workspace directory
    (existing members excluded), with a lead/member role choice. Stays open
    after an add for rapid entry; 409 already_member surfaces as a toast. */
export function TeamsPeoplePicker({ team, users, usersError, onChange }: TeamsPeoplePickerProps) {
  const { t } = useUi();
  const { push } = useToasts();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [role, setRole] = useState<TeamRole>("member");
  const pending = useRef(false);

  const memberNames = new Set(team.members.map((member) => member.username));
  const needle = query.trim().toLowerCase();
  const candidates = (users ?? []).filter(
    (user) =>
      !memberNames.has(user.username) &&
      (!needle ||
        [user.username, user.firstName, user.lastName].some(
          (field) => field !== undefined && field.toLowerCase().includes(needle),
        )),
  );

  const add = (username: string) => {
    if (pending.current) return;
    pending.current = true;
    addTeamMember(API_BASE, { workspaceId: WORKSPACE, teamId: team.id, username, role })
      .then((next) => {
        invalidateTeamsCache();
        onChange(next);
        push({ message: t.memberAdded });
      })
      .catch((cause: unknown) => {
        const conflict = cause instanceof ApiError && cause.status === 409;
        push({ message: conflict ? t.alreadyMemberError : t.actionFailed });
      })
      .finally(() => {
        pending.current = false;
      });
  };

  return (
    <Popover
      open={open}
      onClose={() => setOpen(false)}
      align="start"
      role="dialog"
      anchor={
        <button
          type="button"
          className="team-add-member"
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          + {t.addMember}
        </button>
      }
    >
      <div className="people-picker">
        <div className="settings-pills" role="radiogroup" aria-label={t.filterRole}>
          {(["member", "lead"] as const).map((value) => (
            <label className="settings-pill" key={value}>
              <input
                type="radio"
                name={`role-${team.id}`}
                value={value}
                checked={role === value}
                onChange={() => setRole(value)}
              />
              <span>{value === "lead" ? t.roleLead : t.roleMember}</span>
            </label>
          ))}
        </div>
        <input
          className="people-picker-search"
          autoFocus
          placeholder={t.searchPeoplePlaceholder}
          aria-label={t.searchPeoplePlaceholder}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        {usersError ? (
          <p className="people-picker-empty error-note" role="alert">
            {t.loadFailed}
          </p>
        ) : candidates.length === 0 ? (
          <p className="people-picker-empty">{t.noPeopleFound}</p>
        ) : (
          <ul className="people-picker-list">
            {candidates.map((user) => (
              <li key={user.username}>
                <button
                  type="button"
                  className="people-picker-item"
                  onClick={() => add(user.username)}
                >
                  <MemberAvatar username={user.username} user={user} />
                  <span className="team-member-username">{user.username}</span>
                  <span className="team-member-fullname">{fullNameOf(user)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Popover>
  );
}
