"use client";

import { useCallback, useEffect, useState } from "react";
import type { Program } from "@xcollab/core";
import { createProgram, getLedger, listPrograms } from "../lib/api-client.ts";
import { STRINGS, type UiLanguage } from "../lib/i18n.ts";
import { ProgramView } from "../components/program-view.tsx";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const WORKSPACE = "hq";

export default function Home() {
  const [language, setLanguage] = useState<UiLanguage>("en");
  const [mission, setMission] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [ledgerValid, setLedgerValid] = useState<boolean | null>(null);
  const [ledgerCount, setLedgerCount] = useState(0);

  const t = STRINGS[language];
  const dir = language === "ar" ? "rtl" : "ltr";

  const refresh = useCallback(async () => {
    const [list, ledger] = await Promise.all([
      listPrograms(API_BASE, WORKSPACE),
      getLedger(API_BASE, WORKSPACE),
    ]);
    setPrograms(list.reverse());
    setLedgerValid(ledger.verification.valid);
    setLedgerCount(ledger.entries.length);
  }, []);

  useEffect(() => {
    refresh().catch(() => setError(STRINGS.en.errorGeneric));
  }, [refresh]);

  async function onGenerate(event: React.FormEvent) {
    event.preventDefault();
    if (!mission.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      await createProgram(API_BASE, {
        workspaceId: WORKSPACE,
        mission: mission.trim(),
        language,
        ...(start && end ? { timeline: { start, end } } : {}),
      });
      setMission("");
      await refresh();
    } catch {
      setError(t.errorGeneric);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="shell" dir={dir} lang={language}>
      <header className="masthead">
        <span className="brand">{t.brand}</span>
        <button
          type="button"
          className="lang-toggle"
          onClick={() => setLanguage(language === "en" ? "ar" : "en")}
        >
          {t.languageToggle}
        </button>
      </header>

      <section className="hero">
        <h1>{t.tagline}</h1>
      </section>

      <form className="mission-form" onSubmit={onGenerate}>
        <label htmlFor="mission">{t.missionLabel}</label>
        <textarea
          id="mission"
          value={mission}
          onChange={(e) => setMission(e.target.value)}
          placeholder={t.missionPlaceholder}
          required
        />
        <div className="form-row">
          <div className="field">
            <label htmlFor="start">{t.timelineStart}</label>
            <input id="start" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="end">{t.timelineEnd}</label>
            <input id="end" type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
          </div>
          <button className="generate-btn" type="submit" disabled={busy}>
            {busy ? t.generating : t.generate}
          </button>
        </div>
        {error ? <p className="error-note" role="alert">{error}</p> : null}
      </form>

      <section>
        <div className="section-head">
          <h2>{t.programsHeading}</h2>
          {ledgerValid === null ? null : (
            <span className={`chip ${ledgerValid ? "good" : "bad"}`}>
              {ledgerValid ? t.ledgerVerified : t.ledgerInvalid} · {ledgerCount}
            </span>
          )}
        </div>
        {programs.length === 0 ? (
          <p className="empty">{t.emptyState}</p>
        ) : (
          programs.map((program) => (
            <ProgramView key={program.id} program={program} uiLanguage={language} />
          ))
        )}
      </section>
    </main>
  );
}
