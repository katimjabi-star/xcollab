"use client";

import { useState } from "react";
import { useAuth } from "../lib/auth-context.tsx";
import { useUi } from "../lib/ui-context.tsx";
import { BrandLogo } from "./brand-logo.tsx";

/** Full-viewport sign-in gate — rendered INSTEAD of the app shell. */
export function LoginGate() {
  const { t, dir, language } = useUi();
  const { login, expired } = useAuth();
  const [redirecting, setRedirecting] = useState(false);

  function beginKeycloakRedirect() {
    setRedirecting(true);
    void login();
  }

  return (
    <div className="login-gate" dir={dir} lang={language}>
      <div className="login-body">
        <BrandLogo />
        <p className="login-tagline">{t.signInHint}</p>
        {expired && (
          <p className="login-note" role="alert">
            {t.sessionExpired}
          </p>
        )}
        <button
          type="button"
          className="login-cta"
          disabled={redirecting}
          autoFocus
          onClick={beginKeycloakRedirect}
        >
          {redirecting ? t.signingIn : t.signIn}
        </button>
      </div>
      <footer className="login-foot">Sovereign deployment · {t.workspace}</footer>
    </div>
  );
}
