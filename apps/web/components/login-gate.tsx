"use client";

import { useEffect, useState } from "react";
import { useAuth } from "../lib/auth-context.tsx";
import { useUi } from "../lib/ui-context.tsx";
import { BrandLogo } from "./brand-logo.tsx";

/** Guards against a redirect loop: only the first unauthenticated visit
    in a tab auto-forwards; after a sign-out or failed attempt the gate
    waits for an explicit click. */
const AUTO_FORWARD_KEY = "xcollab.auth.attempted";

/** Full-viewport sign-in gate — rendered INSTEAD of the app shell. */
export function LoginGate() {
  const { t, dir, language } = useUi();
  const { login, expired } = useAuth();
  const [redirecting, setRedirecting] = useState(false);

  function beginKeycloakRedirect() {
    setRedirecting(true);
    void login();
  }

  useEffect(() => {
    if (expired || sessionStorage.getItem(AUTO_FORWARD_KEY)) return;
    sessionStorage.setItem(AUTO_FORWARD_KEY, "1");
    setRedirecting(true);
    void login();
    // Fresh-visit auto-forward must fire exactly once per tab.
  }, []);

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
      <footer className="login-foot">{t.sovereignDeployment} · {t.workspace}</footer>
    </div>
  );
}
