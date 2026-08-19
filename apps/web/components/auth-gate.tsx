"use client";

import type { ReactNode } from "react";
import { useAuth } from "../lib/auth-context.tsx";
import { LoginGate } from "./login-gate.tsx";

/**
 * Auth switch: nothing until the session bootstrap settles (no gate flash
 * during the code exchange), the login gate when unauthenticated, and the
 * normal app tree once signed in.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const { ready, user } = useAuth();
  if (!ready) return null;
  if (!user) return <LoginGate />;
  return <>{children}</>;
}
