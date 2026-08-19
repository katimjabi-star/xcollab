import type { STRINGS } from "./i18n.ts";

type DictionaryKey = keyof (typeof STRINGS)["en"];

export interface NavItem {
  icon: string;
  labelKey: DictionaryKey;
  href: string;
}

/** Single source of truth for primary routes — sidebar items and topbar titles. */
export const NAV_ITEMS: readonly NavItem[] = [
  { icon: "▦", labelKey: "navOverview", href: "/" },
  { icon: "◫", labelKey: "navPrograms", href: "/programs" },
  { icon: "⛓", labelKey: "navLedger", href: "/ledger" },
];

export function routeLabelKey(pathname: string): DictionaryKey {
  const match = NAV_ITEMS.find((item) => item.href !== "/" && pathname.startsWith(item.href));
  return match ? match.labelKey : "navOverview";
}
