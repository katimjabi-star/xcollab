import { FolderKanban, Home, ScrollText, type LucideIcon } from "lucide-react";
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
];

export function routeLabelKey(pathname: string): DictionaryKey {
  const match = NAV_ITEMS.find((item) => item.href !== "/" && pathname.startsWith(item.href));
  return match ? match.labelKey : "navOverview";
}
