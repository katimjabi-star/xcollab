import {
  FolderKanban,
  Home,
  Inbox,
  ScrollText,
  Settings,
  Sparkles,
  SquareCheckBig,
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

/** Sidebar "Work" group — the primary IA. /my-tasks is owned by the My-tasks
    screen; the link exists here even while that screen ships separately. */
export const WORK_NAV_ITEMS: readonly NavItem[] = [
  { icon: Home, labelKey: "navHome", href: "/home" },
  { icon: Inbox, labelKey: "navInbox", href: "/inbox" },
  { icon: SquareCheckBig, labelKey: "navMyTasks", href: "/my-tasks" },
  { icon: FolderKanban, labelKey: "navPrograms", href: "/projects" },
  { icon: Users, labelKey: "navTeams", href: "/teams" },
];

/** Sidebar "AI" group, shown while the AI rail context is active. */
export const AI_NAV_ITEMS: readonly NavItem[] = [
  { icon: Sparkles, labelKey: "aiTeammatesHeading", href: "/ai" },
  { icon: ScrollText, labelKey: "navLedger", href: "/ledger" },
];

/** Icon-rail "More" menu — routes outside the two sidebar contexts. */
export const MORE_NAV_ITEMS: readonly NavItem[] = [
  { icon: Settings, labelKey: "navSettings", href: "/settings" },
  { icon: ScrollText, labelKey: "navLedger", href: "/ledger" },
];

export type RailContext = "work" | "ai" | "people";

/** Which icon-rail item lights up (and which sidebar context renders). */
export function railContextOf(pathname: string): RailContext {
  if (pathname.startsWith("/ai") || pathname.startsWith("/ledger")) return "ai";
  if (pathname.startsWith("/teams")) return "people";
  return "work";
}

const ROUTE_LABELS: ReadonlyArray<[prefix: string, key: DictionaryKey]> = [
  ["/home", "navHome"],
  ["/inbox", "navInbox"],
  ["/my-tasks", "navMyTasks"],
  ["/projects", "navPrograms"],
  ["/teams", "navTeams"],
  ["/ledger", "navLedger"],
  ["/settings", "navSettings"],
  ["/ai", "aiTeammatesHeading"],
];

export function routeLabelKey(pathname: string): DictionaryKey {
  const match = ROUTE_LABELS.find(([prefix]) => pathname.startsWith(prefix));
  return match ? match[1] : "navOverview";
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
