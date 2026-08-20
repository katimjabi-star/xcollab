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
  { icon: FolderKanban, labelKey: "navPrograms", href: "/programs" },
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
