"use client";

import { useState } from "react";
import { useAuth } from "../lib/auth-context.tsx";
import { useUi } from "../lib/ui-context.tsx";
import { Popover } from "./ui/popover.tsx";

/** First grapheme of first + last name parts; fallback: first two of username. */
function initialsOf(fullName: string, username: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  const first = parts[0];
  const last = parts.length > 1 ? parts[parts.length - 1] : undefined;
  if (first && last) {
    return `${Array.from(first)[0] ?? ""}${Array.from(last)[0] ?? ""}`;
  }
  return Array.from(username).slice(0, 2).join("");
}

export function UserMenu() {
  const { t } = useUi();
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);

  if (!user) return null;

  function signOut() {
    setOpen(false);
    logout();
  }

  return (
    <Popover
      open={open}
      onClose={() => setOpen(false)}
      align="end"
      role="menu"
      className="user-menu"
      anchor={
        <button
          type="button"
          className="user-menu-trigger"
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          <span className="avatar" aria-hidden>
            {initialsOf(user.fullName, user.username)}
          </span>
          <span className="user-menu-name">{user.username}</span>
        </button>
      }
    >
      <div className="user-menu-identity">
        <span className="user-menu-eyebrow">{t.loggedInAs}</span>
        <span className="user-menu-fullname">{user.fullName}</span>
        <span className="user-menu-email">{user.email}</span>
      </div>
      <button type="button" className="user-menu-item" role="menuitem" onClick={signOut}>
        {t.signOut}
      </button>
    </Popover>
  );
}
