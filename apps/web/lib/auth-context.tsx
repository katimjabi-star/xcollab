"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { setAuthTokenProvider } from "./api-client.ts";
import {
  buildAuthUrl,
  buildEndSessionUrl,
  parseTokenResponse,
  profileFromIdToken,
  randomVerifier,
  s256Challenge,
  shouldRefresh,
  tokenEndpoint,
  type AuthProfile,
  type AuthTokens,
  type TokenEndpointResponse,
} from "./auth.ts";

export const KEYCLOAK_ISSUER =
  process.env.NEXT_PUBLIC_KEYCLOAK_ISSUER ?? "http://localhost:8081/realms/xcollab";
export const KEYCLOAK_CLIENT_ID = process.env.NEXT_PUBLIC_KEYCLOAK_CLIENT_ID ?? "xcollab-web";

const PKCE_KEY = "xcollab.auth.pkce";
const SESSION_KEY = "xcollab.auth.session";
/** Deep link captured at login start; restored after the code exchange
    (the OIDC redirect_uri is always the origin, so Keycloak lands on "/"). */
const RETURN_KEY = "xcollab.auth.returnTo";
const REFRESH_POLL_MS = 30_000;

interface StoredSession {
  tokens: AuthTokens;
  profile: AuthProfile;
}

interface AuthContextValue {
  /** False until the stored session / redirect callback has been processed. */
  ready: boolean;
  user: AuthProfile | null;
  /** True when the gate was reached via an expired session or refresh failure. */
  expired: boolean;
  login: () => Promise<void>;
  logout: () => void;
  getToken: () => string | null;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function redirectUri(): string {
  return `${window.location.origin}/`;
}

function readStoredSession(): StoredSession | null {
  try {
    const raw = window.sessionStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as StoredSession) : null;
  } catch {
    return null;
  }
}

async function tokenGrant(body: URLSearchParams): Promise<AuthTokens> {
  const response = await fetch(tokenEndpoint(KEYCLOAK_ISSUER), {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!response.ok) throw new Error(`token endpoint → ${response.status}`);
  return parseTokenResponse((await response.json()) as TokenEndpointResponse);
}

function exchangeCode(code: string, verifier: string): Promise<AuthTokens> {
  return tokenGrant(
    new URLSearchParams({
      grant_type: "authorization_code",
      client_id: KEYCLOAK_CLIENT_ID,
      code,
      redirect_uri: redirectUri(),
      code_verifier: verifier,
    }),
  );
}

/** Strip the OIDC callback params without a navigation. */
function cleanCallbackUrl(): void {
  const url = new URL(window.location.href);
  for (const param of ["code", "state", "session_state", "iss"]) url.searchParams.delete(param);
  window.history.replaceState(null, "", url.pathname + url.search + url.hash);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<AuthProfile | null>(null);
  const [expired, setExpired] = useState(false);
  const sessionRef = useRef<StoredSession | null>(null);
  const refreshingRef = useRef(false);

  const getToken = useCallback(() => sessionRef.current?.tokens.accessToken ?? null, []);

  const adoptSession = useCallback((session: StoredSession) => {
    sessionRef.current = session;
    window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    setUser(session.profile);
    setExpired(false);
  }, []);

  const dropSession = useCallback((reason: "expired" | "logout") => {
    sessionRef.current = null;
    window.sessionStorage.removeItem(SESSION_KEY);
    setUser(null);
    if (reason === "expired") setExpired(true);
  }, []);

  const maybeRefresh = useCallback(async () => {
    const session = sessionRef.current;
    if (!session || refreshingRef.current || !shouldRefresh(session.tokens.expiresAt)) return;
    refreshingRef.current = true;
    try {
      if (!session.tokens.refreshToken) throw new Error("no refresh token");
      const tokens = await tokenGrant(
        new URLSearchParams({
          grant_type: "refresh_token",
          client_id: KEYCLOAK_CLIENT_ID,
          refresh_token: session.tokens.refreshToken,
        }),
      );
      adoptSession({
        tokens: { ...tokens, refreshToken: tokens.refreshToken ?? session.tokens.refreshToken },
        profile: tokens.idToken ? profileFromIdToken(tokens.idToken) : session.profile,
      });
    } catch {
      dropSession("expired");
    } finally {
      refreshingRef.current = false;
    }
  }, [adoptSession, dropSession]);

  useEffect(() => {
    setAuthTokenProvider(getToken);

    async function bootstrap(): Promise<void> {
      const params = new URLSearchParams(window.location.search);
      if (params.get("reason") === "expired") setExpired(true);

      const stored = readStoredSession();
      if (stored) {
        adoptSession(stored);
        return;
      }

      const code = params.get("code");
      const pkceRaw = window.sessionStorage.getItem(PKCE_KEY);
      if (!code || !pkceRaw) return;
      window.sessionStorage.removeItem(PKCE_KEY);
      const returnTo = window.sessionStorage.getItem(RETURN_KEY);
      window.sessionStorage.removeItem(RETURN_KEY);
      try {
        const pkce = JSON.parse(pkceRaw) as { verifier: string; state: string };
        if (params.get("state") !== pkce.state) return;
        const tokens = await exchangeCode(code, pkce.verifier);
        if (!tokens.idToken) throw new Error("no id_token in token response");
        adoptSession({ tokens, profile: profileFromIdToken(tokens.idToken) });
        if (returnTo && returnTo !== "/") {
          // Full navigation: history.replaceState alone won't re-render the
          // App Router route; the session is already in storage so the
          // reloaded page boots straight into the authenticated shell.
          window.location.replace(returnTo);
          return;
        }
      } catch {
        /* stay logged out — the gate renders */
      } finally {
        cleanCallbackUrl();
      }
    }

    // Back/forward cache: after logout the tab navigates to Keycloak's
    // end-session page, but Back can restore this document from bfcache with
    // the in-memory session intact. The stored session was dropped before the
    // navigation, so a persisted restore without one must not show live data —
    // reload, which boots into the sign-in gate.
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted && sessionRef.current && !readStoredSession()) {
        window.location.reload();
      }
    };
    window.addEventListener("pageshow", onPageShow);

    // Mount-only: processes the redirect callback exactly once.
    void bootstrap().finally(() => setReady(true));
    return () => window.removeEventListener("pageshow", onPageShow);
  }, []);

  useEffect(() => {
    if (!user) return;
    void maybeRefresh();
    const id = window.setInterval(() => void maybeRefresh(), REFRESH_POLL_MS);
    return () => window.clearInterval(id);
  }, [user, maybeRefresh]);

  const login = useCallback(async () => {
    const verifier = randomVerifier();
    const state = randomVerifier(16);
    const challenge = await s256Challenge(verifier);
    window.sessionStorage.setItem(PKCE_KEY, JSON.stringify({ verifier, state }));
    window.sessionStorage.setItem(
      RETURN_KEY,
      window.location.pathname + window.location.search + window.location.hash,
    );
    window.location.assign(
      buildAuthUrl(KEYCLOAK_ISSUER, KEYCLOAK_CLIENT_ID, redirectUri(), state, challenge),
    );
  }, []);

  const logout = useCallback(() => {
    const idToken = sessionRef.current?.tokens.idToken ?? undefined;
    dropSession("logout");
    window.location.assign(
      buildEndSessionUrl(KEYCLOAK_ISSUER, KEYCLOAK_CLIENT_ID, redirectUri(), idToken),
    );
  }, [dropSession]);

  const value: AuthContextValue = { ready, user, expired, login, logout, getToken };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
