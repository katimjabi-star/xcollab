"use client";

import type { LedgerEntry } from "@xcollab/core";
import { ApiError, getLedger } from "../../lib/api-client.ts";
import { useUi } from "../../lib/ui-context.tsx";
import { useWorkspaceData } from "../../lib/use-workspace-data.ts";

function shortHash(hash: string) {
  return (
    <span className="hash" title={hash}>
      {hash.slice(0, 12)}…
    </span>
  );
}

export default function LedgerPage() {
  const { t } = useUi();
  const { data: ledger, error } = useWorkspaceData(getLedger);

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
    return <div className="content" />;
  }

  const actorLabels: Record<LedgerEntry["actor"]["kind"], string> = {
    human: t.actorHuman,
    ai: t.actorAi,
    service: t.actorService,
  };

  const entries = [...ledger.entries].sort((a, b) => a.seq - b.seq);
  const { valid, reason } = ledger.verification;

  return (
    <div className="content">
      <div className="section-head">
        <h2>{t.ledgerHeading}</h2>
      </div>

      {valid ? (
        <div className="banner good">
          ✓ {t.ledgerVerified} · {entries.length} — {t.chainIntact}
        </div>
      ) : (
        <div className="banner bad">
          {t.chainBrokenAt}
          {reason ? ` — ${reason}` : ""}
        </div>
      )}

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
                <th>{t.colModel}</th>
                <th>{t.colTime}</th>
                <th>{t.colPrevHash}</th>
                <th>{t.colHash}</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.hash}>
                  <td>{entry.seq}</td>
                  <td>
                    {actorLabels[entry.actor.kind]}:{entry.actor.id}
                  </td>
                  <td>{entry.action}</td>
                  <td>{entry.modelId ?? "—"}</td>
                  <td>
                    <span className="hash">{entry.occurredAt}</span>
                  </td>
                  <td>{shortHash(entry.prevHash)}</td>
                  <td>{shortHash(entry.hash)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
