"use client";

import { useState, type FormEvent } from "react";
import { getDemoKey, setDemoKey } from "../lib/demo-ai.ts";
import { useToasts } from "../lib/toast-context.tsx";
import { useUi } from "../lib/ui-context.tsx";

/**
 * Demo AI relay (Settings): the demo operator pastes their own Anthropic key
 * here. Session-only (this tab, gone on close), never sent to the cluster —
 * see lib/demo-ai.ts. While active, project generation and the assistant run
 * on the hosted model via the browser; without it, the in-cluster engine.
 */
export function SettingsDemoAi() {
  const { t } = useUi();
  const { push } = useToasts();
  const [active, setActive] = useState(() => Boolean(getDemoKey()));
  const [value, setValue] = useState("");

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const key = value.trim();
    if (!key) return;
    setDemoKey(key);
    setValue("");
    setActive(true);
    push({ message: t.demoAiActive });
  }

  function onClear() {
    setDemoKey("");
    setActive(false);
  }

  return (
    <section className="settings-section" aria-labelledby="settings-demo-ai-title">
      <h3 id="settings-demo-ai-title" className="settings-section-title">
        {t.demoAiTitle}
      </h3>
      <p className="settings-hint">{t.demoAiHint}</p>
      {active ? (
        <div className="settings-row">
          <span className="settings-label">{t.demoAiActive}</span>
          <button type="button" className="btn-secondary" onClick={onClear}>
            {t.demoAiClear}
          </button>
        </div>
      ) : (
        <form className="settings-row" onSubmit={onSubmit}>
          {/* password input: the key must never be shoulder-surfable */}
          <input
            className="settings-key-input"
            type="password"
            autoComplete="off"
            placeholder={t.demoAiPlaceholder}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            aria-label={t.demoAiTitle}
            dir="ltr"
          />
          <button type="submit" className="btn-secondary" disabled={!value.trim()}>
            {t.demoAiSave}
          </button>
        </form>
      )}
    </section>
  );
}
