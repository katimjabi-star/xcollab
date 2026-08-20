import {
  FolderKanban,
  Home,
  ScrollText,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { STRINGS } from "./i18n.ts";

type DictionaryKey = keyof (typeof STRINGS)["en"];

export interface NavItem {
  icon: LucideIcon;
  labelKey: DictionaryKey;
  href: string;
}

/** Single source of truth for primary routes — sidebar items and breadcrumbs. */
export const NAV_ITEMS: readonly NavItem[] = [
  { icon: Home, labelKey: "navOverview", href: "/" },
  { icon: FolderKanban, labelKey: "navPrograms", href: "/projects" },
  { icon: ScrollText, labelKey: "navLedger", href: "/ledger" },
  { icon: Users, labelKey: "navTeams", href: "/teams" },
];

/** Pinned at the sidebar bottom, above the workspace footer — not in the main list. */
export const SETTINGS_NAV_ITEM: NavItem = {
  icon: Settings,
  labelKey: "navSettings",
  href: "/settings",
};

export function routeLabelKey(pathname: string): DictionaryKey {
  const match = [...NAV_ITEMS, SETTINGS_NAV_ITEM].find(
    (item) => item.href !== "/" && pathname.startsWith(item.href),
  );
  return match ? match.labelKey : "navOverview";
}

/* The App Router re-applies the static metadata <title> asynchronously after
   each navigation commit, overwriting effect-set titles. The observer wins
   that race by re-asserting the desired title whenever <head> mutates; it
   never fires on its own writes (enforce() is a no-op once titles match). */
let desiredTitle: string | null = null;
let titleObserver: MutationObserver | null = null;

function enforceTitle(): void {
  if (desiredTitle !== null && document.title !== desiredTitle) {
    document.title = desiredTitle;
  }
}

/** Per-context document title: "Part · Part · XCollab" — most specific first
    (e.g. ["Task name", "Program name"]). Client-side only; call from an effect. */
export function setDocumentTitle(parts: string[]): void {
  const clean = parts.map((part) => part.trim()).filter(Boolean);
  desiredTitle = [...clean, "XCollab"].join(" · ");
  if (!titleObserver) {
    titleObserver = new MutationObserver(enforceTitle);
    titleObserver.observe(document.head, { subtree: true, childList: true, characterData: true });
  }
  enforceTitle();
}
