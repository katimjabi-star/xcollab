import type { Program } from "@xcollab/core";
import type { STRINGS } from "../../lib/i18n.ts";
import { programDisplayName } from "../../lib/program-format.ts";

type Strings = (typeof STRINGS)["en"];

export interface PaletteItem {
  id: string;
  group: "commands" | "projects" | "sections" | "tasks";
  label: string;
  /** Secondary context (program name for sections/tasks). */
  hint?: string;
  href?: string;
  command?: "switch-language";
}

export const RECENTS_KEY = "xcollab.palette.recents";
const RECENTS_MAX = 8;
export const RESULTS_MAX = 15;

/** Static navigation + action commands, then the workspace index:
    projects → sections → tasks (deep links straight into the board peek). */
export function buildPaletteIndex(programs: Program[] | null, t: Strings): PaletteItem[] {
  const goto: Array<[string, string]> = [
    [t.navHome, "/home"],
    [t.navInbox, "/inbox"],
    [t.navMyTasks, "/my-tasks"],
    [t.navPrograms, "/projects"],
    [t.navTeams, "/teams"],
    [t.navLedger, "/ledger"],
  ];
  const items: PaletteItem[] = goto.map(([label, href]) => ({
    id: `cmd:${href}`,
    group: "commands",
    label: `${t.paletteGoTo} ${label}`,
    href,
  }));
  items.push({
    id: "cmd:switch-language",
    group: "commands",
    label: t.paletteSwitchLanguage,
    command: "switch-language",
  });
  for (const program of programs ?? []) {
    const programName = programDisplayName(program);
    items.push({
      id: `project:${program.id}`,
      group: "projects",
      label: programName,
      href: `/projects/${program.id}`,
    });
    for (const pkg of program.packages) {
      items.push({
        id: `section:${program.id}:${pkg.id}`,
        group: "sections",
        label: pkg.name,
        hint: programName,
        href: `/projects/${program.id}`,
      });
      for (const task of pkg.tasks) {
        items.push({
          id: `task:${program.id}:${task.id}`,
          group: "tasks",
          label: task.name,
          hint: programName,
          href: `/projects/${program.id}?view=board&task=${task.id}`,
        });
      }
    }
  }
  return items;
}

const GROUP_ORDER: ReadonlyArray<PaletteItem["group"]> = [
  "commands",
  "projects",
  "sections",
  "tasks",
];

/** Case-insensitive substring match over label+hint; group-ordered, capped.
    An empty query surfaces recents first, then the command list. */
export function filterPaletteItems(
  items: PaletteItem[],
  query: string,
  recentIds: string[],
): PaletteItem[] {
  const q = query.trim().toLowerCase();
  if (!q) {
    const byId = new Map(items.map((item) => [item.id, item]));
    const recents = recentIds
      .map((id) => byId.get(id))
      .filter((item): item is PaletteItem => item !== undefined);
    const rest = items.filter(
      (item) => item.group === "commands" && !recentIds.includes(item.id),
    );
    return [...recents, ...rest].slice(0, RESULTS_MAX);
  }
  const matches = items.filter(
    (item) =>
      item.label.toLowerCase().includes(q) || (item.hint?.toLowerCase().includes(q) ?? false),
  );
  matches.sort((a, b) => GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group));
  return matches.slice(0, RESULTS_MAX);
}

export function readRecents(): string[] {
  try {
    const raw = window.localStorage.getItem(RECENTS_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

export function pushRecent(id: string): string[] {
  const next = [id, ...readRecents().filter((known) => known !== id)].slice(0, RECENTS_MAX);
  try {
    window.localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
  } catch {
    /* storage full/blocked — recents just don't persist */
  }
  return next;
}
