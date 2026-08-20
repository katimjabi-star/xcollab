"use client";

import { useEffect, useState } from "react";
import { Bot, Server, ShieldAlert, ShieldCheck } from "lucide-react";
import type { LedgerEntry } from "@xcollab/core";
import { ApiError, getLedger } from "../../lib/api-client.ts";
import { useToasts } from "../../lib/toast-context.tsx";
import { useUi } from "../../lib/ui-context.tsx";
import { useWorkspaceData } from "../../lib/use-workspace-data.ts";
import { humanizeAction } from "../../components/task-activity.tsx";
import { Icon } from "../../components/ui/icon.tsx";
import { Skeleton } from "../../components/ui/skeleton.tsx";

/** Skeletons appear only once loading has visibly taken longer than 300ms. */
function useSkeletonGate(loaded: boolean): boolean {
  const [pastDelay, setPastDelay] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setPastDelay(true), 300);
    return () => clearTimeout(id);
  }, []);
  return pastDelay && !loaded;
}

/** Truncated mono hash, click-to-copy (full value in the tooltip). */
function HashChip({ hash, copyLabel }: { hash: string; copyLabel: string }) {
  const { push } = useToasts();
  const copy = () => {
    // navigator.clipboard is undefined on insecure origins — fail soft.
    Promise.resolve()
      .then(() => navigator.clipboard.writeText(hash))
      .then(() => push({ message: copyLabel }))
      .catch(() => {
        /* no clipboard — the tooltip still exposes the full hash */
      });
  };
  return (
    <button type="button" className="hash hash-copy" title={hash} dir="ltr" onClick={copy}>
      {hash.slice(0, 12)}…
    </button>
  );
}

const RELATIVE_UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ["year", 31_536_000],
  ["month", 2_592_000],
  ["week", 604_800],
  ["day", 86_400],
  ["hour", 3_600],
  ["minute", 60],
];

function relativeTime(iso: string, rtf: Intl.RelativeTimeFormat): string {
  const seconds = (new Date(iso).getTime() - Date.now()) / 1000;
  for (const [unit, size] of RELATIVE_UNITS) {
    if (Math.abs(seconds) >= size) return rtf.format(Math.round(seconds / size), unit);
  }
  return rtf.format(Math.round(seconds), "second");
}

/** Initials for the human actor chip (first two alphanumeric-ish segments). */
function initials(id: string): string {
  const parts = id.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  const chars = parts.slice(0, 2).map((p) => p[0] ?? "");
  return (chars.join("") || id.slice(0, 2)).toUpperCase();
}

/** Actor chip; the model id (when present) rides in the tooltip instead of
    spending a mostly-empty table column (audit §ledger). */
function ActorChip({ entry, label }: { entry: LedgerEntry; label: string }) {
  const kind = entry.actor.kind;
  const title = entry.modelId ? `${label} · ${entry.modelId}` : label;
  return (
    <span className="actor-chip" title={title}>
      {kind === "human" ? (
        <span className="actor-initials" aria-hidden>
          {initials(entry.actor.id)}
        </span>
      ) : (
        <Icon icon={kind === "ai" ? Bot : Server} size={12} />
      )}
      <span className="actor-id" dir="ltr">
        {entry.actor.id}
      </span>
    </span>
  );
}

function LedgerSkeleton({ label }: { label: string }) {
  return (
    <>
      <Skeleton width="100%" height="32px" radius="6px" label={label} />
      <div className="table-wrap">
        <div className="table-skeleton">
          {Array.from({ length: 6 }, (_, i) => (
            <div className="row-skeleton" key={i}>
              <Skeleton width="2rem" height="12px" />
              <Skeleton width="9rem" height="20px" radius="999px" />
              <Skeleton width="30%" height="12px" />
              <Skeleton width="6rem" height="12px" />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

export default function LedgerPage() {
  const { t, language } = useUi();
  const { data: ledger, error, loaded } = useWorkspaceData(getLedger);
  const showSkeleton = useSkeletonGate(loaded);

  if (error) {
    return (
      <div className="content">
        <p className="error-note" role="alert">
          {t.errorGeneric}
          {error instanceof ApiError ? ` (${error.message})` : ""}
        </p>
      </div>
    );
  }

  if (!ledger) {
    return (
      <div className="content">
        <div className="section-head">
          <h2 className="page-title">{t.ledgerHeading}</h2>
        </div>
        {showSkeleton ? <LedgerSkeleton label={t.skeletonLoading} /> : null}
      </div>
    );
  }

  const actorLabels: Record<LedgerEntry["actor"]["kind"], string> = {
    human: t.actorHuman,
    ai: t.actorAi,
    service: t.actorService,
  };

  const locale = language === "ar" ? "ar" : "en";
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  const entries = [...ledger.entries].sort((a, b) => a.seq - b.seq);
  const { valid, reason } = ledger.verification;

  return (
    <div className="content">
      <div className="section-head">
        <h2 className="page-title">{t.ledgerHeading}</h2>
      </div>

      {/* Compact 32px verification strip */}
      <div className={`ledger-banner ${valid ? "good" : "bad"}`} role="status">
        <Icon icon={valid ? ShieldCheck : ShieldAlert} />
        <span className="ledger-banner-title">
          {valid ? t.ledgerVerified : t.chainBrokenAt} · <span className="num">{entries.length}</span>{" "}
          {t.entriesLabel}
        </span>
        <span className="ledger-banner-detail">
          {valid ? t.chainIntact : (reason ?? t.ledgerInvalid)}
        </span>
      </div>

      {entries.length === 0 ? (
        <p className="empty">{t.ledgerEmpty}</p>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t.colSeq}</th>
                <th>{t.colActor}</th>
                <th>{t.colAction}</th>
                <th>{t.colTime}</th>
                <th>{t.colPrevHash}</th>
                <th>{t.colHash}</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.hash}>
                  <td className="num">{entry.seq}</td>
                  <td>
                    <ActorChip entry={entry} label={actorLabels[entry.actor.kind]} />
                  </td>
                  {/* Humanized sentence; raw code stays in the tooltip. */}
                  <td title={entry.action}>{humanizeAction(entry.action, language)}</td>
                  <td>
                    <span className="time-rel" title={entry.occurredAt}>
                      {relativeTime(entry.occurredAt, rtf)}
                    </span>
                  </td>
                  <td>
                    <HashChip hash={entry.prevHash} copyLabel={t.hashCopied} />
                  </td>
                  <td>
                    <HashChip hash={entry.hash} copyLabel={t.hashCopied} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
