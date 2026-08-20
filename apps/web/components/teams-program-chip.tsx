"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Users } from "lucide-react";
import type { Program } from "@xcollab/core";
import { API_BASE, WORKSPACE, programTeamId, updateProgramTeam } from "../lib/api-client.ts";
import { useToasts } from "../lib/toast-context.tsx";
import { useUi } from "../lib/ui-context.tsx";
import { Icon } from "./ui/icon.tsx";
import { Popover } from "./ui/popover.tsx";
import { findTeam, useWorkspaceTeams } from "./teams-data.tsx";

/** Read-only neutral chip (program cards): team name when the program has a
    connected team that still resolves; renders nothing otherwise (fail-soft). */
export function TeamNameChip({ program }: { program: Program }) {
  const teams = useWorkspaceTeams();
  const team = findTeam(teams, programTeamId(program));
  if (!team) return null;
  return (
    <span className="mini-chip" dir="auto" title={team.name}>
      {team.name}
    </span>
  );
}

/** Detail-header editor chip: opens a popover listing every team plus
    "No team" → PATCHes the connection, optimistic with revert + failure toast. */
export function ProgramTeamChip({
  program,
  onProgramUpdate,
}: {
  program: Program;
  /** Freshest server program after a successful PATCH (host page state). */
  onProgramUpdate?: (program: Program) => void;
}) {
  const { t } = useUi();
  const { push } = useToasts();
  const teams = useWorkspaceTeams();
  const [open, setOpen] = useState(false);
  const [teamId, setTeamId] = useState<string | null>(programTeamId(program));
  const pending = useRef(false);

  // Re-sync when the host swaps in fresher server state (or another program).
  const serverTeamId = programTeamId(program);
  useEffect(() => setTeamId(serverTeamId), [serverTeamId, program.id]);

  const current = findTeam(teams, teamId);

  const pick = (next: string | null) => {
    setOpen(false);
    if (next === teamId || pending.current) return;
    const previous = teamId;
    pending.current = true;
    setTeamId(next); // optimistic
    updateProgramTeam(API_BASE, { workspaceId: WORKSPACE, programId: program.id, teamId: next })
      .then((updated) => {
        onProgramUpdate?.(updated);
      })
      .catch(() => {
        setTeamId(previous); // revert
        push({ message: t.actionFailed });
      })
      .finally(() => {
        pending.current = false;
      });
  };

  return (
    <Popover
      open={open}
      onClose={() => setOpen(false)}
      role="menu"
      align="start"
      anchor={
        <button
          type="button"
          className={`program-team-trigger${current ? "" : " empty"}`}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label={t.teamLabel}
          title={t.teamLabel}
          onClick={() => setOpen((prev) => !prev)}
        >
          <Icon icon={Users} size={12} />
          <span className="program-team-name" dir="auto">
            {current ? current.name : t.teamNone}
          </span>
          <Icon icon={ChevronDown} size={12} />
        </button>
      }
    >
      <button
        type="button"
        role="menuitemradio"
        aria-checked={teamId === null}
        className="panel-menu-item"
        onClick={() => pick(null)}
      >
        <span className="program-team-none">{t.teamNone}</span>
        {teamId === null ? <Icon icon={Check} size={14} /> : null}
      </button>
      {teams.map((team) => (
        <button
          key={team.id}
          type="button"
          role="menuitemradio"
          aria-checked={team.id === teamId}
          className="panel-menu-item"
          onClick={() => pick(team.id)}
        >
          <span dir="auto">{team.name}</span>
          {team.id === teamId ? <Icon icon={Check} size={14} /> : null}
        </button>
      ))}
    </Popover>
  );
}
