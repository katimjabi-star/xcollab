"use client";

import { useRouter } from "next/navigation";
import { CornerDownLeft, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Program } from "@xcollab/core";
import { API_BASE, WORKSPACE, listPrograms } from "../lib/api-client.ts";
import { useUi } from "../lib/ui-context.tsx";
import {
  buildPaletteIndex,
  filterPaletteItems,
  pushRecent,
  readRecents,
  type PaletteItem,
} from "./shell/palette-data.ts";
import { Icon } from "./ui/icon.tsx";

const DEBOUNCE_MS = 150;

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

/** ⌘K command palette: client-side index over projects/sections/tasks plus
    navigation commands. Arrow keys move, Enter opens, Escape closes; picks
    are remembered as recents (localStorage). */
export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const { t, toggleLanguage } = useUi();
  const router = useRouter();
  const [programs, setPrograms] = useState<Program[] | null>(null);
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [recents, setRecents] = useState<string[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);

  /* Index data loads on first open — never on app boot. */
  useEffect(() => {
    if (!open || programs !== null) return;
    let cancelled = false;
    listPrograms(API_BASE, WORKSPACE)
      .then((data) => {
        if (!cancelled) setPrograms(data);
      })
      .catch(() => {
        if (!cancelled) setPrograms([]); // commands still work without the index
      });
    return () => {
      cancelled = true;
    };
  }, [open, programs]);

  useEffect(() => {
    if (open) {
      setRecents(readRecents());
      setQuery("");
      setDebounced("");
      setActiveIndex(0);
    }
  }, [open]);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(query), DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [query]);

  const index = useMemo(() => buildPaletteIndex(programs, t), [programs, t]);
  const results = useMemo(
    () => filterPaletteItems(index, debounced, recents),
    [index, debounced, recents],
  );
  const clamped = Math.min(activeIndex, Math.max(results.length - 1, 0));

  useEffect(() => {
    listRef.current
      ?.querySelector('[aria-selected="true"]')
      ?.scrollIntoView({ block: "nearest" });
  }, [clamped, results]);

  if (!open) return null;

  function select(item: PaletteItem) {
    setRecents(pushRecent(item.id));
    onClose();
    if (item.command === "switch-language") toggleLanguage();
    else if (item.href) router.push(item.href);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex(Math.min(clamped + 1, results.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex(Math.max(clamped - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const item = results[clamped];
      if (item) select(item);
    } else if (event.key === "Escape") {
      event.preventDefault();
      onClose();
    }
  }

  const groupLabels: Record<PaletteItem["group"], string> = {
    commands: t.paletteCommands,
    projects: t.programsHeading,
    sections: t.packagesHeading,
    tasks: t.statTasks,
  };
  /* On an empty query the leading results are resolved recents — they get one
     "Recent" header; everything after headers by its own group. */
  const recentCount =
    debounced.trim() === "" ? results.filter((item) => recents.includes(item.id)).length : 0;
  const displayGroupOf = (i: number): string =>
    i < recentCount ? t.paletteRecent : groupLabels[results[i]?.group ?? "commands"];

  return (
    <div className="s2-palette-overlay" onPointerDown={onClose}>
      <div
        className="s2-palette"
        role="dialog"
        aria-modal="true"
        aria-label={t.searchLabel}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <div className="s2-palette-head">
          <Icon icon={Search} size={16} />
          <input
            className="s2-palette-input"
            autoFocus
            value={query}
            placeholder={t.palettePlaceholder}
            aria-label={t.searchLabel}
            onChange={(event) => {
              setQuery(event.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={onKeyDown}
          />
        </div>
        {results.length === 0 ? (
          <p className="s2-palette-empty">{t.paletteNoResults}</p>
        ) : (
          <ul className="s2-palette-list" role="listbox" ref={listRef}>
            {results.map((item, i) => {
              const group = displayGroupOf(i);
              const header = i === 0 || displayGroupOf(i - 1) !== group ? group : null;
              return (
                <li key={item.id}>
                  {header ? <p className="s2-palette-group">{header}</p> : null}
                  <button
                    type="button"
                    role="option"
                    aria-selected={i === clamped}
                    className={i === clamped ? "s2-palette-item active" : "s2-palette-item"}
                    onPointerMove={() => setActiveIndex(i)}
                    onClick={() => select(item)}
                  >
                    <span className="s2-palette-item-label" dir="auto">
                      {item.label}
                    </span>
                    {item.hint ? (
                      <span className="s2-palette-item-hint" dir="auto">
                        {item.hint}
                      </span>
                    ) : null}
                    {i === clamped ? (
                      <span className="s2-palette-enter" aria-hidden>
                        <Icon icon={CornerDownLeft} size={12} />
                      </span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
