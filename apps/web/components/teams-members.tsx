"use client";

import { X } from "lucide-react";
import { useRef } from "react";
import { API_BASE, ApiError, WORKSPACE } from "../lib/api-client.ts";
import { removeTeamMember, type Team, type WorkspaceUser } from "../lib/api-teams.ts";
import { useToasts } from "../lib/toast-context.tsx";
import { useUi } from "../lib/ui-context.tsx";
import { Icon } from "./ui/icon.tsx";
import { findUser, fullNameOf, MemberAvatar } from "./teams-avatar.tsx";
import { TeamsPeoplePicker } from "./teams-people-picker.tsx";

interface TeamMembersProps {
  team: Team;
  users: readonly WorkspaceUser[] | null;
  usersError: boolean;
  onChange: (team: Team) => void;
}

/** Expanded card body: 32px member rows + the add-member picker.
    Removing the last lead 409s server-side and surfaces as a toast. */
export function TeamMembers({ team, users, usersError, onChange }: TeamMembersProps) {
  const { t } = useUi();
  const { push } = useToasts();
  const pending = useRef(false);

  const remove = (username: string) => {
    if (pending.current) return;
    pending.current = true;
    removeTeamMember(API_BASE, { workspaceId: WORKSPACE, teamId: team.id, username })
      .then((next) => {
        onChange(next);
        push({ message: t.memberRemoved });
      })
      .catch((cause: unknown) => {
        const lastLead = cause instanceof ApiError && cause.status === 409;
        push({ message: lastLead ? t.lastLeadError : t.actionFailed });
      })
      .finally(() => {
        pending.current = false;
      });
  };

  return (
    <div className="team-card-body">
      <ul className="team-member-list">
        {team.members.map((member) => {
          const user = findUser(users, member.username);
          return (
            <li className="team-member-row" key={member.username}>
              <MemberAvatar username={member.username} user={user} />
              <span className="team-member-username">{member.username}</span>
              <span className="team-member-fullname">{fullNameOf(user)}</span>
              <span className={member.role === "lead" ? "ui-chip role-chip-lead" : "ui-chip"}>
                {member.role === "lead" ? t.roleLead : t.roleMember}
              </span>
              <button
                type="button"
                className="team-icon-btn team-member-remove"
                aria-label={`${t.removeMember} — ${member.username}`}
                title={t.removeMember}
                onClick={() => remove(member.username)}
              >
                <Icon icon={X} size={14} />
              </button>
            </li>
          );
        })}
      </ul>
      <TeamsPeoplePicker team={team} users={users} usersError={usersError} onChange={onChange} />
    </div>
  );
}
