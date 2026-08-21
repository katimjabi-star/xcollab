"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { Task } from "@xcollab/core";
import type { WorkspaceUser } from "../lib/api-client.ts";
import type { STRINGS } from "../lib/i18n.ts";
import { fullName } from "./assignee-picker.tsx";
import { Icon } from "./ui/icon.tsx";
import { Popover } from "./ui/popover.tsx";

type Strings = (typeof STRINGS)["en"];

/** Statuses offered by the roll-up Status chip (programStatus values). */
const STATUSES: readonly Task["status"][] = ["todo", "in_progress", "blocked", "done"];

export interface BrowseFilter {
  /** Program's team lead must be this username. */
  owner: string | null;
  /** Program's team must include this username. */
  member: string | null;
  /** programStatus(program) roll-up must equal this. */
  status: Task["status"] | null;
}

export const EMPTY_BROWSE_FILTER: BrowseFilter = { owner: null, member: null, status: null };

/** One dropdown chip: closed label (or the picked value), option list inside
    an anchored popover. Single-select; picking the active option clears it. */
function FilterChip({
  label,
  value,
  options,
  onPick,
}: {
  label: string;
  value: string | null;
  options: { id: string; label: string }[];
  onPick: (id: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const picked = options.find((option) => option.id === value);
  return (
    <Popover
      open={open}
      onClose={() => setOpen(false)}
      align="start"
      role="menu"
      anchor={
        <button
          type="button"
          className={`browse-chip${value !== null ? " active" : ""}`}
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen((prev) => !prev)}
        >
          {picked ? picked.label : label}
          <Icon icon={ChevronDown} size={12} />
        </button>
      }
    >
      <div className="browse-chip-menu">
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            role="menuitemradio"
            aria-checked={value === option.id}
            className="browse-chip-option"
            onClick={() => {
              onPick(value === option.id ? null : option.id);
              setOpen(false);
            }}
          >
            {option.label}
          </button>
        ))}
      </div>
    </Popover>
  );
}

/** Owner · Members · Status dropdown chips (the reference's Portfolios chip is
    omitted — portfolios don't exist in this model and are never faked). */
export function BrowseFilterChips({
  t,
  users,
  filter,
  onChange,
}: {
  t: Strings;
  users: WorkspaceUser[];
  filter: BrowseFilter;
  onChange: (filter: BrowseFilter) => void;
}) {
  const statusLabels: Record<Task["status"], string> = {
    todo: t.statusTodo,
    in_progress: t.statusInProgress,
    blocked: t.statusBlocked,
    done: t.statusDone,
  };
  const people = [
    { id: "", label: t.browseAnyone },
    ...users.map((user) => ({ id: user.username, label: fullName(user) || user.username })),
  ];
  const pickPerson = (key: "owner" | "member") => (id: string | null) =>
    onChange({ ...filter, [key]: id === "" ? null : id });
  return (
    <div className="browse-chips">
      <FilterChip
        label={t.browseOwner}
        value={filter.owner}
        options={people}
        onPick={pickPerson("owner")}
      />
      <FilterChip
        label={t.browseMembersCol}
        value={filter.member}
        options={people}
        onPick={pickPerson("member")}
      />
      <FilterChip
        label={t.taskStatus}
        value={filter.status}
        options={STATUSES.map((status) => ({ id: status, label: statusLabels[status] }))}
        onPick={(id) => onChange({ ...filter, status: (id as Task["status"] | null) ?? null })}
      />
    </div>
  );
}
