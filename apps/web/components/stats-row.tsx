import type { Program } from "@xcollab/core";
import { STRINGS, type UiLanguage } from "../lib/i18n.ts";

interface StatsRowProps {
  programs: Program[];
  ledgerValid: boolean | null;
  ledgerCount: number;
  uiLanguage: UiLanguage;
}

export function StatsRow({ programs, ledgerValid, ledgerCount, uiLanguage }: StatsRowProps) {
  const t = STRINGS[uiLanguage];
  const packages = programs.reduce((n, p) => n + p.packages.length, 0);
  const tasks = programs.reduce((n, p) => n + p.packages.reduce((m, k) => m + k.tasks.length, 0), 0);
  return (
    <div className="stats-row">
      <div className="stat-card">
        <span className="stat-value">{programs.length}</span>
        <span className="stat-label">{t.statPrograms}</span>
      </div>
      <div className="stat-card">
        <span className="stat-value">{packages}</span>
        <span className="stat-label">{t.statPackages}</span>
      </div>
      <div className="stat-card">
        <span className="stat-value">{tasks}</span>
        <span className="stat-label">{t.statTasks}</span>
      </div>
      <div className={`stat-card ${ledgerValid === false ? "stat-bad" : "stat-good"}`}>
        <span className="stat-value">
          {ledgerValid === null ? "—" : ledgerValid ? `✓ ${ledgerCount}` : `✗ ${ledgerCount}`}
        </span>
        <span className="stat-label">{t.statChain}</span>
      </div>
    </div>
  );
}
