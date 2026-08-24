"use client";

import { X } from "lucide-react";
import { useState, type FormEvent, type KeyboardEvent } from "react";
import { API_BASE, WORKSPACE } from "../lib/api-client.ts";
import { createTeam, type Team } from "../lib/api-teams.ts";
import { invalidateTeamsCache } from "./teams-data.tsx";
import { useToasts } from "../lib/toast-context.tsx";
import { useUi } from "../lib/ui-context.tsx";
import { Icon } from "./ui/icon.tsx";

interface TeamsCreateFormProps {
  /** Current team names, for the duplicate guard (case-insensitive). */
  existingNames: readonly string[];
  onCreated: (team: Team) => void;
  onClose: () => void;
}

/** Create-team card in the quick-create dialog language (fix-wave-I):
    header with title + close, large borderless name-first input, description,
    and a primary-action footer. Enter submits, Escape closes. The API accepts
    duplicate names silently (201), so duplicates are blocked client-side with
    a visible inline error; request failures surface inline too. */
export function TeamsCreateForm({ existingNames, onCreated, onClose }: TeamsCreateFormProps) {
  const { t } = useUi();
  const { push } = useToasts();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  const trimmed = name.trim();
  const duplicate =
    trimmed !== "" &&
    existingNames.some((existing) => existing.toLowerCase() === trimmed.toLowerCase());

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!trimmed || duplicate || pending) return;
    setFailed(false);
    setPending(true);
    createTeam(API_BASE, {
      workspaceId: WORKSPACE,
      name: trimmed,
      description: description.trim() || undefined,
    })
      .then((team) => {
        invalidateTeamsCache();
        push({ message: t.teamCreated });
        onCreated(team);
      })
      .catch(() => setFailed(true)) // keep the typed values so the user can retry
      .finally(() => setPending(false));
  };

  const closeOnEscape = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "Escape") onClose();
  };

  return (
    <section className="tm-create" role="group" aria-label={t.newTeam} onKeyDown={closeOnEscape}>
      <div className="tm-create-head">
        <h3>{t.newTeam}</h3>
        <button type="button" className="team-icon-btn" onClick={onClose} aria-label={t.close}>
          <Icon icon={X} size={16} />
        </button>
      </div>
      <form className="tm-create-form" onSubmit={submit}>
        {/* Placeholders show an example pattern, not a bare label (audit #17) */}
        <input
          autoFocus
          className="tm-create-name"
          placeholder={t.teamNamePlaceholder}
          aria-label={t.teamNameLabel}
          aria-invalid={duplicate || undefined}
          maxLength={500}
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <textarea
          className="tm-create-desc"
          placeholder={t.teamDescriptionPlaceholder}
          aria-label={t.teamDescriptionLabel}
          rows={2}
          maxLength={500}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
        {duplicate ? (
          <p className="error-note" role="alert">
            {t.teamDuplicateNameError}
          </p>
        ) : null}
        {failed ? (
          <p className="error-note" role="alert">
            {t.actionFailed}
          </p>
        ) : null}
        <div className="tm-create-foot">
          <button type="button" className="btn-secondary" onClick={onClose}>
            {t.cancel}
          </button>
          <button
            type="submit"
            className="btn-primary"
            disabled={!trimmed || duplicate || pending}
          >
            {t.createTeamAction}
          </button>
        </div>
      </form>
    </section>
  );
}
