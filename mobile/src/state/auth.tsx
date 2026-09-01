import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import * as SecureStore from "expo-secure-store";
import { setAuthTokenProvider } from "../lib/api";
import { passwordGrant, type SessionGrant } from "../lib/auth-api";
import { KEYCLOAK_CLIENT_ID, KEYCLOAK_ISSUER } from "../lib/config";

const STORE_KEY = "xcollab.session";

export interface Session {
  token: string;
  username: string;
  name?: string;
  door: "katim" | "password";
  /** Epoch ms; the session is dropped locally past this point. */
  expiresAt: number;
}

interface AuthValue {
  session: Session | null;
  /** False until the persisted session has been read back. */
  ready: boolean;
  loginWithPassword: (username: string, password: string) => Promise<void>;
  adoptSession: (grant: SessionGrant, door: Session["door"]) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

function toSession(grant: SessionGrant, door: Session["door"]): Session {
  return {
    token: grant.accessToken,
    username: grant.username,
    name: grant.name,
    door,
    expiresAt: Date.now() + grant.expiresIn * 1000,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const sessionRef = useRef<Session | null>(null);
  sessionRef.current = session;

  useEffect(() => {
    setAuthTokenProvider(() => {
      const current = sessionRef.current;
      return current && current.expiresAt > Date.now() ? current.token : null;
    });
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const raw = await SecureStore.getItemAsync(STORE_KEY);
        if (raw) {
          const stored = JSON.parse(raw) as Session;
          if (stored.expiresAt > Date.now()) setSession(stored);
          else await SecureStore.deleteItemAsync(STORE_KEY);
        }
      } catch {
        /* unreadable store — start signed out */
      } finally {
        setReady(true);
      }
    })();
  }, []);

  const persist = useCallback(async (next: Session) => {
    setSession(next);
    try {
      await SecureStore.setItemAsync(STORE_KEY, JSON.stringify(next));
    } catch {
      /* keep the in-memory session even if persistence fails */
    }
  }, []);

  const adoptSession = useCallback(
    (grant: SessionGrant, door: Session["door"]) => persist(toSession(grant, door)),
    [persist],
  );

  const loginWithPassword = useCallback(
    async (username: string, password: string) => {
      const grant = await passwordGrant(KEYCLOAK_ISSUER, KEYCLOAK_CLIENT_ID, username, password);
      await persist(toSession(grant, "password"));
    },
    [persist],
  );

  const signOut = useCallback(async () => {
    setSession(null);
    try {
      await SecureStore.deleteItemAsync(STORE_KEY);
    } catch {
      /* nothing else to clean */
    }
  }, []);

  return (
    <AuthContext.Provider value={{ session, ready, loginWithPassword, adoptSession, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth outside AuthProvider");
  return value;
}
