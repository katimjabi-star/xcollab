"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "../lib/auth-context.tsx";
import { useUi } from "../lib/ui-context.tsx";

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
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (!user) return null;

  function signOut() {
    setOpen(false);
    logout();
  }

  return (
    <div className="user-menu" ref={rootRef}>
      <button
        type="button"
        className="user-menu-trigger"
        ref={triggerRef}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="avatar" aria-hidden>
          {initialsOf(user.fullName, user.username)}
        </span>
        <span className="user-menu-name">{user.username}</span>
      </button>
      {open && (
        <div className="user-menu-popover" role="menu">
          <div className="user-menu-identity">
            <span className="user-menu-eyebrow">{t.loggedInAs}</span>
            <span className="user-menu-fullname">{user.fullName}</span>
            <span className="user-menu-email">{user.email}</span>
          </div>
          <button type="button" className="user-menu-item" role="menuitem" onClick={signOut}>
            {t.signOut}
          </button>
        </div>
      )}
    </div>
  );
}
