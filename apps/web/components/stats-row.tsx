import Link from "next/link";
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

/** Four linked metric tiles in the Home/Dashboard card frame (create.css):
    12px muted label over a 20px/600 tabular value. Each tile links to its
    surface (no dead-end metrics); the chain tile carries a 12px context line
    so the count isn't a naked ambiguous number. */
export function StatsRow({ programs, ledgerValid, ledgerCount, uiLanguage }: StatsRowProps) {
  const t = STRINGS[uiLanguage];
  const packages = programs.reduce((n, p) => n + p.packages.length, 0);
  const tasks = programs.reduce((n, p) => n + p.packages.reduce((m, k) => m + k.tasks.length, 0), 0);
  return (
    <div className="create-stats">
      <Link className="create-stat" href="/projects">
        <span className="create-stat-label">{t.statPrograms}</span>
        <span className="create-stat-value">{programs.length}</span>
      </Link>
      <Link className="create-stat" href="/projects">
        <span className="create-stat-label">{t.statPackages}</span>
        <span className="create-stat-value">{packages}</span>
      </Link>
      <Link className="create-stat" href="/projects">
        <span className="create-stat-label">{t.statTasks}</span>
        <span className="create-stat-value">{tasks}</span>
      </Link>
      <Link className="create-stat" href="/ledger">
        <span className="create-stat-label">{t.statChain}</span>
        {ledgerValid === null ? (
          <span className="create-stat-value">—</span>
        ) : (
          <>
            <span
              className={`create-stat-value ${ledgerValid ? "create-stat-good" : "create-stat-bad"}`}
            >
              <Icon icon={ledgerValid ? ShieldCheck : ShieldAlert} />
              {ledgerCount}
            </span>
            {/* Context only when the count means "verified" */}
            {ledgerValid ? <span className="create-stat-sub">{t.statChainVerified}</span> : null}
          </>
        )}
      </Link>
    </div>
  );
}
