"use client";

import { ShieldCheck, Sparkles, Users } from "lucide-react";
import { useState, type FormEvent } from "react";
import { TokenGrantError, useAuth } from "../lib/auth-context.tsx";
import { useUi } from "../lib/ui-context.tsx";
import { BrandLogo } from "./brand-logo.tsx";
import { Icon } from "./ui/icon.tsx";

/** Full-viewport sign-in — rendered INSTEAD of the app shell. One screen:
    the credential card talks to Keycloak's token endpoint directly (direct
    grant), so there is no second, IdP-hosted login page. The end panel is
    the product pitch — the only marketing surface in the app. */
export function LoginGate() {
  const { t, dir, language } = useUi();
  const { loginWithPassword, expired } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const username = String(form.get("username") ?? "").trim();
    const password = String(form.get("password") ?? "");
    if (!username || !password) return;
    setBusy(true);
    setError(null);
    try {
      await loginWithPassword(username, password);
    } catch (cause) {
      setError(
        cause instanceof TokenGrantError && cause.status === 401
          ? t.invalidCredentials
          : t.loginFailed,
      );
      setBusy(false);
    }
  }

  const pitchCards = [
    { icon: Sparkles, title: t.loginMktAiTitle, desc: t.loginMktAiDesc },
    { icon: Users, title: t.loginMktTeamsTitle, desc: t.loginMktTeamsDesc },
    { icon: ShieldCheck, title: t.loginMktSovTitle, desc: t.loginMktSovDesc },
  ] as const;

  const note = error ?? (expired ? t.sessionExpired : null);

  return (
    <div className="login-gate" dir={dir} lang={language}>
      <section className="login-pane">
        <div className="login-card">
          <BrandLogo />
          <div className="login-card-head">
            <h1 className="login-title">{t.loginTitle}</h1>
            <p className="login-tagline">{t.signInHint}</p>
          </div>
          {note && (
            <p className="login-note" role="alert">
              {note}
            </p>
          )}
          <form className="login-form" onSubmit={onSubmit}>
            <label className="login-field">
              <span>{t.usernameLabel}</span>
              {/* Identifiers are Latin-script in this realm — pin LTR in AR */}
              <input name="username" autoComplete="username" required autoFocus dir="ltr" />
            </label>
            <label className="login-field">
              <span>{t.passwordLabel}</span>
              <input
                name="password"
                type="password"
                autoComplete="current-password"
                required
                dir="ltr"
              />
            </label>
            <button type="submit" className="login-cta" disabled={busy}>
              {busy ? t.signingIn : t.signIn}
            </button>
          </form>
        </div>
        <footer className="login-foot">
          {t.sovereignDeployment} · {t.workspace}
        </footer>
      </section>
      <aside className="login-pitch">
        <div className="login-pitch-body">
          <p className="login-pitch-kicker">{t.loginMktKicker}</p>
          <h2 className="login-pitch-title">{t.loginMktTitle}</h2>
          <p className="login-pitch-sub">{t.loginMktSubtitle}</p>
          <ul className="login-pitch-cards">
            {pitchCards.map((card) => (
              <li key={card.title} className="login-pitch-card">
                <span className="login-pitch-glyph" aria-hidden>
                  <Icon icon={card.icon} size={16} />
                </span>
                <span className="login-pitch-card-text">
                  <span className="login-pitch-card-title">{card.title}</span>
                  <span className="login-pitch-card-desc">{card.desc}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  );
}
