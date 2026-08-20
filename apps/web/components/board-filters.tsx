"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ListFilter, SlidersHorizontal, X } from "lucide-react";
import type { BoardFilter, BoardSort, DueFilter } from "../lib/board-filter.ts";
import {
  EMPTY_FILTER,
  anyFilterActive,
  carryForeignParams,
  parseBoardQuery,
  serializeBoardQuery,
} from "../lib/board-filter.ts";
import type { WorkspaceUser } from "../lib/api-client.ts";
import type { STRINGS } from "../lib/i18n.ts";
import { fullName } from "./assignee-picker.tsx";
import { Icon } from "./ui/icon.tsx";
import { Popover } from "./ui/popover.tsx";

type Strings = (typeof STRINGS)["en"];

const SORTS: readonly BoardSort[] = ["default", "dueDate", "name", "estimate"];
const DUES: readonly DueFilter[] = ["overdue", "thisWeek", "noDate"];

/** Filter + sort state lives in the URL (?q&pkg&role&due&sort) so a reload or
    a shared link reproduces the exact board. `replace` keeps history clean. */
export function useBoardQuery(): {
  filter: BoardFilter;
  sort: BoardSort;
  setFilter: (filter: BoardFilter) => void;
  setSort: (sort: BoardSort) => void;
  clearFilters: () => void;
} {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const { filter, sort } = parseBoardQuery(search);
  const apply = (nextFilter: BoardFilter, nextSort: BoardSort) => {
    const params = serializeBoardQuery(nextFilter, nextSort);
    // Every param the board doesn't own (?view=, ?task= deep links, …) must
    // survive a rewrite — copy them all, not just the ones we know about.
    carryForeignParams(params, search.entries());
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };
  return {
    filter,
    sort,
    setFilter: (next) => apply(next, sort),
    setSort: (next) => apply(filter, next),
    clearFilters: () => apply(EMPTY_FILTER, sort),
  };
}

interface BoardFilterBarProps {
  t: Strings;
  filter: BoardFilter;
  sort: BoardSort;
  packages: { id: string; name: string }[];
  roles: string[];
  users: WorkspaceUser[];
  onFilterChange: (filter: BoardFilter) => void;
  onSortChange: (sort: BoardSort) => void;
  onClearFilters: () => void;
}

/** Sub-header toolbar: Filter popover + removable active-filter chips at the
    start, the "Display" (sort) popover at the end. Fully logical-flow / RTL. */
export function BoardFilterBar({
  t,
  filter,
  sort,
  packages,
  roles,
  users,
  onFilterChange,
  onSortChange,
  onClearFilters,
}: BoardFilterBarProps) {
  const [filterOpen, setFilterOpen] = useState(false);
  const [displayOpen, setDisplayOpen] = useState(false);
  const active = anyFilterActive(filter);
  const dueLabels: Record<DueFilter, string> = {
    overdue: t.filterOverdue,
    thisWeek: t.filterThisWeek,
    noDate: t.filterNoDate,
  };
  const sortLabels: Record<BoardSort, string> = {
    default: t.sortDefault,
    dueDate: t.sortDueDate,
    name: t.sortName,
    estimate: t.sortEstimate,
  };

  const chips: { key: string; label: string; onRemove: () => void }[] = [];
  if (filter.query.trim()) {
    chips.push({
      key: "q",
      label: `“${filter.query.trim()}”`,
      onRemove: () => onFilterChange({ ...filter, query: "" }),
    });
  }
  if (filter.packageId !== null) {
    chips.push({
      key: "pkg",
      label: packages.find((p) => p.id === filter.packageId)?.name ?? filter.packageId,
      onRemove: () => onFilterChange({ ...filter, packageId: null }),
    });
  }
  if (filter.role !== null) {
    chips.push({ key: "role", label: filter.role, onRemove: () => onFilterChange({ ...filter, role: null }) });
  }
  if (filter.assignee !== null) {
    const user = users.find((u) => u.username === filter.assignee);
    chips.push({
      key: "assignee",
      label: user ? fullName(user) : filter.assignee,
      onRemove: () => onFilterChange({ ...filter, assignee: null }),
    });
  }
  if (filter.due !== null) {
    chips.push({
      key: "due",
      label: dueLabels[filter.due],
      onRemove: () => onFilterChange({ ...filter, due: null }),
    });
  }

  return (
    <div className="board-toolbar">
      <div className="board-toolbar-start">
        <Popover
          open={filterOpen}
          onClose={() => setFilterOpen(false)}
          align="start"
          role="dialog"
          anchor={
            <button
              type="button"
              className={`board-tool-btn${active ? " active" : ""}`}
              aria-haspopup="dialog"
              aria-expanded={filterOpen}
              onClick={() => setFilterOpen((prev) => !prev)}
            >
              <Icon icon={ListFilter} size={14} />
              {t.filterLabel}
            </button>
          }
        >
          <div className="board-filter-pop">
            <input
              type="search"
              className="board-filter-search"
              placeholder={t.filterSearchPlaceholder}
              aria-label={t.filterSearchPlaceholder}
              value={filter.query}
              onChange={(event) => onFilterChange({ ...filter, query: event.target.value })}
            />
            <label className="board-filter-field">
              <span>{t.filterPackage}</span>
              <select
                value={filter.packageId ?? ""}
                onChange={(event) =>
                  onFilterChange({ ...filter, packageId: event.target.value || null })
                }
              >
                <option value="">{t.filterAll}</option>
                {packages.map((pkg) => (
                  <option key={pkg.id} value={pkg.id}>
                    {pkg.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="board-filter-field">
              <span>{t.filterRole}</span>
              <select
                value={filter.role ?? ""}
                onChange={(event) => onFilterChange({ ...filter, role: event.target.value || null })}
              >
                <option value="">{t.filterAll}</option>
                {roles.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </label>
            <label className="board-filter-field">
              <span>{t.filterAssignee}</span>
              <select
                value={filter.assignee ?? ""}
                onChange={(event) =>
                  onFilterChange({ ...filter, assignee: event.target.value || null })
                }
              >
                <option value="">{t.filterAll}</option>
                {users.map((user) => (
                  <option key={user.username} value={user.username}>
                    {fullName(user)}
                  </option>
                ))}
              </select>
            </label>
            <div className="board-filter-field">
              <span>{t.filterDueDate}</span>
              <div className="board-due-options">
                {DUES.map((due) => (
                  <button
                    key={due}
                    type="button"
                    className="board-due-option"
                    aria-pressed={filter.due === due}
                    onClick={() =>
                      onFilterChange({ ...filter, due: filter.due === due ? null : due })
                    }
                  >
                    {dueLabels[due]}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </Popover>

        {chips.map((chip) => (
          <button
            key={chip.key}
            type="button"
            className="board-filter-chip"
            aria-label={`${t.removeFilter}: ${chip.label}`}
            onClick={chip.onRemove}
          >
            <span className="board-filter-chip-label">{chip.label}</span>
            <Icon icon={X} size={12} />
          </button>
        ))}
        {active ? (
          <button type="button" className="board-clear-link" onClick={onClearFilters}>
            {t.filterClearAll}
          </button>
        ) : null}
      </div>

      <Popover
        open={displayOpen}
        onClose={() => setDisplayOpen(false)}
        align="end"
        role="dialog"
        anchor={
          <button
            type="button"
            className={`board-tool-btn${sort !== "default" ? " active" : ""}`}
            aria-haspopup="dialog"
            aria-expanded={displayOpen}
            onClick={() => setDisplayOpen((prev) => !prev)}
          >
            <Icon icon={SlidersHorizontal} size={14} />
            {t.displayLabel}
          </button>
        }
      >
        <div className="board-filter-pop">
          <div className="board-filter-field">
            <span>{t.sortLabel}</span>
            <div className="board-sort-options" role="radiogroup" aria-label={t.sortLabel}>
              {SORTS.map((option) => (
                <button
                  key={option}
                  type="button"
                  role="radio"
                  aria-checked={sort === option}
                  className="board-sort-option"
                  onClick={() => onSortChange(option)}
                >
                  {sortLabels[option]}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Popover>
    </div>
  );
}
