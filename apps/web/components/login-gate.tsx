"use client";

import { ShieldCheck, Smartphone, Sparkles, Users } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { API_BASE } from "../lib/api-client.ts";
import { TokenGrantError, useAuth } from "../lib/auth-context.tsx";
import { useUi } from "../lib/ui-context.tsx";
import { BrandLogo } from "./brand-logo.tsx";
import { Icon } from "./ui/icon.tsx";

/** POC convenience: prefill the form so a demo visitor only presses Sign in.
    BUILD-time (inlined into the client bundle — anyone can read it), so it is
    off unless the env is set for that specific build. Never set these on a
    build whose realm holds real accounts. */
const DEMO_USERNAME = process.env.NEXT_PUBLIC_DEMO_USERNAME ?? "";
const DEMO_PASSWORD = process.env.NEXT_PUBLIC_DEMO_PASSWORD ?? "";

const POLL_MS = 2000;

/** A push transaction in flight — everything needed to poll and complete. */
interface PushSession {
  transactionId: string;
  completionSecret: string;
  verificationCode: string;
}

async function postJson(path: string, body: unknown): Promise<Response> {
  return fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

/** Full-viewport sign-in — rendered INSTEAD of the app shell. The Mahara
    model: Katim ID push (approve on your device) is the primary door when
    the API has X4Auth configured; the password form is the fallback. The
    end panel is the product pitch — the only marketing surface in the app. */
export function LoginGate() {
  const { t, dir, language } = useUi();
  const { loginWithPassword, adoptLocalSession, expired } = useAuth();
  const [mode, setMode] = useState<"katim" | "password">("password");
  const [katimAvailable, setKatimAvailable] = useState(false);
  const [push, setPush] = useState<PushSession | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Which doors exist is the API's call — password-only until it says so.
  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE}/api/auth/x4auth/config`)
      .then((res) => (res.ok ? (res.json() as Promise<{ configured: boolean }>) : null))
      .then((config) => {
        if (!cancelled && config?.configured) {
          setKatimAvailable(true);
          setMode("katim");
        }
      })
      .catch(() => {
        /* password door stays */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Waiting for device approval: poll status, then trade the completion
  // secret for a session. Tokens never ride the status endpoint.
  useEffect(() => {
    if (!push) return;
    let stopped = false;
    const fail = (message: string) => {
      setPush(null);
      setError(message);
    };
    const id = window.setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE}/api/auth/x4auth/status/${push.transactionId}`);
        if (!res.ok) throw new Error(`status ${res.status}`);
        const { status } = (await res.json()) as { status: string };
        if (stopped || status === "pending") return;
        window.clearInterval(id);
        if (status !== "approved") {
          fail(status === "denied" ? t.x4Denied : t.x4Expired);
          return;
        }
        const done = await postJson("/api/auth/x4auth/complete", {
          transactionId: push.transactionId,
          completionSecret: push.completionSecret,
        });
        if (!done.ok) throw new Error(`complete ${done.status}`);
        const session = (await done.json()) as {
          accessToken: string;
          expiresIn: number;
          profile: { username: string; fullName: string; email: string };
        };
        adoptLocalSession(session.accessToken, session.expiresIn, session.profile);
      } catch {
        if (!stopped) {
          window.clearInterval(id);
          fail(t.x4Failed);
        }
      }
    }, POLL_MS);
    return () => {
      stopped = true;
      window.clearInterval(id);
    };
  }, [push, adoptLocalSession, t]);

  async function onKatimSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const identifier = String(new FormData(event.currentTarget).get("identifier") ?? "").trim();
    if (!identifier) return;
    setBusy(true);
    setError(null);
    try {
      const res = await postJson("/api/auth/x4auth/initiate", { username: identifier });
      if (!res.ok) throw new Error(`initiate ${res.status}`);
      setPush((await res.json()) as PushSession);
    } catch {
      setError(t.x4Failed);
    } finally {
      setBusy(false);
    }
  }

  async function onPasswordSubmit(event: FormEvent<HTMLFormElement>) {
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

  function switchMode(next: "katim" | "password") {
    setMode(next);
    setPush(null);
    setError(null);
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
          {mode === "katim" && push && (
            <div className="login-push-wait" role="status">
              <span className="login-push-pulse" aria-hidden>
                <Icon icon={Smartphone} size={22} />
              </span>
              <p className="login-push-title">{t.x4Waiting}</p>
              <p className="login-push-hint">{t.x4WaitingHint}</p>
              <p className="login-push-code">
                <span>{t.x4CodeLabel}</span>
                <strong dir="ltr">{push.verificationCode}</strong>
              </p>
              <button type="button" className="login-alt" onClick={() => switchMode("katim")}>
                {t.cancel}
              </button>
            </div>
          )}
          {mode === "katim" && !push && (
            <form className="login-form" onSubmit={onKatimSubmit}>
              <label className="login-field">
                <span>{t.x4IdentifierLabel}</span>
                {/* Identifiers are Latin-script in this realm — pin LTR in AR */}
                <input
                  name="identifier"
                  autoComplete="username"
                  required
                  autoFocus
                  dir="ltr"
                  defaultValue={DEMO_USERNAME}
                />
              </label>
              <button type="submit" className="login-cta" disabled={busy}>
                {busy ? t.signingIn : t.x4Cta}
              </button>
            </form>
          )}
          {mode === "password" && (
            <form className="login-form" onSubmit={onPasswordSubmit}>
              <label className="login-field">
                <span>{t.usernameLabel}</span>
                <input
                  name="username"
                  autoComplete="username"
                  required
                  autoFocus
                  dir="ltr"
                  defaultValue={DEMO_USERNAME}
                />
              </label>
              <label className="login-field">
                <span>{t.passwordLabel}</span>
                <input
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  dir="ltr"
                  defaultValue={DEMO_PASSWORD}
                />
              </label>
              <button type="submit" className="login-cta" disabled={busy}>
                {busy ? t.signingIn : t.signIn}
              </button>
            </form>
          )}
          {katimAvailable && !push && (
            <button
              type="button"
              className="login-alt"
              onClick={() => switchMode(mode === "katim" ? "password" : "katim")}
            >
              {mode === "katim" ? t.x4UsePassword : t.x4UseKatim}
            </button>
          )}
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
