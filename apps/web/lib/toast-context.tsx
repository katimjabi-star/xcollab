"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

export interface ToastItem {
  id: number;
  message: string;
  undo?: () => void;
  /** Set ~200ms before removal so CSS can play the exit transition. */
  leaving: boolean;
}

export interface ToastInput {
  message: string;
  undo?: () => void;
}

interface ToastContextValue {
  toasts: ToastItem[];
  push: (toast: ToastInput) => void;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const MAX_TOASTS = 4;
const TOAST_TTL_MS = 5000;
const TOAST_LEAVE_MS = 4800;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(0);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>[]>());

  // Clear every outstanding timer when the provider unmounts.
  useEffect(() => {
    const map = timers.current;
    return () => {
      for (const list of map.values()) for (const timer of list) clearTimeout(timer);
      map.clear();
    };
  }, []);

  const dismiss = useCallback((id: number) => {
    for (const timer of timers.current.get(id) ?? []) clearTimeout(timer);
    timers.current.delete(id);
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback(
    ({ message, undo }: ToastInput) => {
      nextId.current += 1;
      const id = nextId.current;
      // Newest appended at the bottom; oldest evicted beyond MAX_TOASTS.
      // Evicted toasts' timers still resolve through dismiss(), a no-op then.
      setToasts((prev) => [...prev, { id, message, undo, leaving: false }].slice(-MAX_TOASTS));
      const leaveTimer = setTimeout(() => {
        setToasts((prev) =>
          prev.map((toast) => (toast.id === id ? { ...toast, leaving: true } : toast)),
        );
      }, TOAST_LEAVE_MS);
      const removeTimer = setTimeout(() => dismiss(id), TOAST_TTL_MS);
      timers.current.set(id, [leaveTimer, removeTimer]);
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={{ toasts, push, dismiss }}>{children}</ToastContext.Provider>
  );
}

export function useToasts(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToasts must be used within ToastProvider");
  return ctx;
}
