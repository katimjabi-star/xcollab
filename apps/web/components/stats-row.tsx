import { ShieldAlert, ShieldCheck } from "lucide-react";
import type { Program } from "@xcollab/core";
import { STRINGS, type UiLanguage } from "../lib/i18n.ts";
import { Icon } from "./ui/icon.tsx";

interface StatsRowProps {
  programs: Program[];
  ledgerValid: boolean | null;
  ledgerCount: number;
  uiLanguage: UiLanguage;
}

/** Compact metric tiles: 12px muted label over a 20px/600 tabular value. */
export function StatsRow({ programs, ledgerValid, ledgerCount, uiLanguage }: StatsRowProps) {
  const t = STRINGS[uiLanguage];
  const packages = programs.reduce((n, p) => n + p.packages.length, 0);
  const tasks = programs.reduce((n, p) => n + p.packages.reduce((m, k) => m + k.tasks.length, 0), 0);
  return (
    <div className="stats-row">
      <div className="stat-tile">
        <span className="stat-label">{t.statPrograms}</span>
        <span className="stat-value">{programs.length}</span>
      </div>
      <div className="stat-tile">
        <span className="stat-label">{t.statPackages}</span>
        <span className="stat-value">{packages}</span>
      </div>
      <div className="stat-tile">
        <span className="stat-label">{t.statTasks}</span>
        <span className="stat-value">{tasks}</span>
      </div>
      <div className="stat-tile">
        <span className="stat-label">{t.statChain}</span>
        {ledgerValid === null ? (
          <span className="stat-value">—</span>
        ) : (
          <span className={`stat-value ${ledgerValid ? "stat-good" : "stat-bad"}`}>
            <Icon icon={ledgerValid ? ShieldCheck : ShieldAlert} />
            {ledgerCount}
          </span>
        )}
      </div>
    </div>
  );
}
