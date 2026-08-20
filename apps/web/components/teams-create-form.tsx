"use client";

import { useState, type FormEvent, type KeyboardEvent } from "react";
import { API_BASE, WORKSPACE } from "../lib/api-client.ts";
import { createTeam, type Team } from "../lib/api-teams.ts";
import { useToasts } from "../lib/toast-context.tsx";
import { useUi } from "../lib/ui-context.tsx";

interface TeamsCreateFormProps {
  onCreated: (team: Team) => void;
  onClose: () => void;
}

/** Inline create form — 32px controls, Enter submits, Escape closes. */
export function TeamsCreateForm({ onCreated, onClose }: TeamsCreateFormProps) {
  const { t } = useUi();
  const { push } = useToasts();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || pending) return;
    setPending(true);
    createTeam(API_BASE, {
      workspaceId: WORKSPACE,
      name: trimmed,
      description: description.trim() || undefined,
    })
      .then((team) => {
        push({ message: t.teamCreated });
        onCreated(team);
      })
      .catch(() => setFailed(true)) // keep the typed values so the user can retry
      .finally(() => setPending(false));
  };

  const closeOnEscape = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") onClose();
  };

  return (
    <form className="team-create-form" onSubmit={submit}>
      <input
        autoFocus
        placeholder={t.teamNameLabel}
        aria-label={t.teamNameLabel}
        value={name}
        onChange={(event) => setName(event.target.value)}
        onKeyDown={closeOnEscape}
      />
      <input
        placeholder={t.teamDescriptionLabel}
        aria-label={t.teamDescriptionLabel}
        value={description}
        onChange={(event) => setDescription(event.target.value)}
        onKeyDown={closeOnEscape}
      />
      <button type="submit" className="btn-primary" disabled={!name.trim() || pending}>
        {t.createTeamAction}
      </button>
      <button type="button" className="btn-secondary" onClick={onClose}>
        {t.cancel}
      </button>
      {failed ? (
        <p className="error-note" role="alert">
          {t.actionFailed}
        </p>
      ) : null}
    </form>
  );
}
