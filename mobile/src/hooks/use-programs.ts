import { useCallback, useEffect, useState } from "react";
import { useFocusEffect } from "expo-router";
import { listPrograms } from "../lib/api";
import { API_BASE, WORKSPACE } from "../lib/config";
import type { Program } from "../lib/types";

interface ProgramsState {
  programs: Program[] | null;
  error: boolean;
  refreshing: boolean;
  refresh: () => void;
  /** Replace one program in place after a mutation returns the fresh copy. */
  replaceProgram: (program: Program) => void;
}

export function usePrograms(): ProgramsState {
  const [programs, setPrograms] = useState<Program[] | null>(null);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [tick, setTick] = useState(0);

  // Refetch on every focus, not just mount: a mutation on another screen
  // (task status, new program) must be visible when the user tabs back.
  useFocusEffect(
    useCallback(() => {
      setTick((n) => n + 1);
    }, []),
  );

  useEffect(() => {
    if (tick === 0) return; // first fetch rides the initial focus
    let stale = false;
    setRefreshing(true);
    listPrograms(API_BASE, WORKSPACE)
      .then((next) => {
        if (stale) return;
        setPrograms(next);
        setError(false);
      })
      .catch(() => {
        if (!stale) setError(true);
      })
      .finally(() => {
        if (!stale) setRefreshing(false);
      });
    return () => {
      stale = true;
    };
  }, [tick]);

  const refresh = useCallback(() => setTick((n) => n + 1), []);

  const replaceProgram = useCallback((program: Program) => {
    setPrograms((prev) =>
      prev ? prev.map((p) => (p.id === program.id ? program : p)) : prev,
    );
  }, []);

  return { programs, error, refreshing, refresh, replaceProgram };
}

export function taskTotals(program: Program): { total: number; done: number } {
  let total = 0;
  let done = 0;
  for (const pkg of program.packages) {
    total += pkg.tasks.length;
    for (const task of pkg.tasks) if (task.status === "done") done += 1;
  }
  return { total, done };
}
