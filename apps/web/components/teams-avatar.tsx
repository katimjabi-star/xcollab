import type { TeamMember, WorkspaceUser } from "../lib/api-teams.ts";

/** Directory lookup — members carry only usernames; names come from /api/users. */
export function findUser(
  users: readonly WorkspaceUser[] | null,
  username: string,
): WorkspaceUser | undefined {
  return users?.find((user) => user.username === username);
}

export function fullNameOf(user: WorkspaceUser | undefined): string {
  return user ? `${user.firstName} ${user.lastName}`.trim() : "";
}

/** First graphemes of first/last name; fallback: first two of username. */
export function initialsFor(username: string, user: WorkspaceUser | undefined): string {
  if (user) {
    const first = Array.from(user.firstName)[0] ?? "";
    const last = Array.from(user.lastName)[0] ?? "";
    if (first || last) return `${first}${last}`;
  }
  return Array.from(username).slice(0, 2).join("");
}

interface MemberAvatarProps {
  username: string;
  user: WorkspaceUser | undefined;
  title?: string;
}

/** 20px initials disc (`.avatar` metric from the shell sheet). */
export function MemberAvatar({ username, user, title }: MemberAvatarProps) {
  return (
    <span className="avatar" title={title} aria-hidden>
      {initialsFor(username, user)}
    </span>
  );
}

const STACK_CAP = 3;

interface MemberAvatarStackProps {
  members: readonly TeamMember[];
  users: readonly WorkspaceUser[] | null;
}

/** Overlapping 20px stack capped at 3, then a "+N" overflow disc. */
export function MemberAvatarStack({ members, users }: MemberAvatarStackProps) {
  const shown = members.slice(0, STACK_CAP);
  const extra = members.length - shown.length;
  return (
    <span className="team-avatar-stack" aria-hidden>
      {shown.map((member) => (
        <MemberAvatar
          key={member.username}
          username={member.username}
          user={findUser(users, member.username)}
        />
      ))}
      {extra > 0 ? <span className="avatar avatar-overflow num">+{extra}</span> : null}
    </span>
  );
}
