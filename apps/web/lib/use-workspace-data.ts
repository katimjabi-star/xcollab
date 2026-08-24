"use client";

import { useEffect, useState } from "react";
import { API_BASE, WORKSPACE } from "./api-client.ts";

/* Workspace-wide invalidation (the invalidateTeamsCache precedent): a program
   delete must reach hooks mounted in the persistent shell (sidebar, home),
   which otherwise keep their mount-time fetch across client navigations. */
let dataVersion = 0;
const versionListeners = new Set<() => void>();

/** Signals every mounted useWorkspaceData to refetch (e.g. after a program delete). */
export function invalidateWorkspaceData(): void {
  dataVersion += 1;
  for (const notify of versionListeners) notify();
}

export interface WorkspaceDataState<T> {
  data: T | null;
  /** The typed failure (ApiError for non-2xx responses) — never collapsed to a boolean. */
  error: Error | null;
  loaded: boolean;
}

/**
 * Fetches workspace-scoped data once on mount, with unmount cancellation so a
 * fast navigation cannot set state on an unmounted page. Pass a stable fetcher
 * (a module-level api-client function); a new fetcher identity refetches.
 */
export function useWorkspaceData<T>(
  fetcher: (base: string, workspaceId: string) => Promise<T>,
): WorkspaceDataState<T> {
  const [state, setState] = useState<WorkspaceDataState<T>>({
    data: null,
    error: null,
    loaded: false,
  });
  const [version, setVersion] = useState(dataVersion);

  useEffect(() => {
    const notify = () => setVersion(dataVersion);
    versionListeners.add(notify);
    return () => {
      versionListeners.delete(notify);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetcher(API_BASE, WORKSPACE)
      .then((data) => {
        if (!cancelled) setState({ data, error: null, loaded: true });
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setState({
            data: null,
            error: cause instanceof Error ? cause : new Error(String(cause)),
            loaded: true,
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [fetcher, version]);

  return state;
}
