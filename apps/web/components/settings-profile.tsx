"use client";

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

/** Read-only identity rows from the OIDC profile + the existing logout. */
export function SettingsProfile() {
  const { t } = useUi();
  const { user, logout } = useAuth();
  if (!user) return null;

  return (
    <section className="settings-section" aria-labelledby="settings-profile-title">
      <h3 id="settings-profile-title" className="settings-section-title">
        {t.settingsProfileHeading}
      </h3>
      <div className="settings-row">
        <span className="settings-label">{t.settingsDisplayName}</span>
        <span className="settings-value">
          <span className="settings-avatar" aria-hidden>
            {initialsOf(user.fullName, user.username)}
          </span>
          {user.fullName}
        </span>
      </div>
      <div className="settings-row">
        <span className="settings-label">{t.settingsUsername}</span>
        <span className="settings-value">{user.username}</span>
      </div>
      <div className="settings-row">
        <span className="settings-label">{t.settingsEmail}</span>
        <span className="settings-value">{user.email}</span>
      </div>
      <p className="settings-note">{t.settingsIdentityNote}</p>
      <div className="settings-row">
        <button type="button" className="btn-secondary" onClick={logout}>
          {t.signOut}
        </button>
      </div>
    </section>
  );
}
