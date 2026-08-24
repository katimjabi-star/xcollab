import type { Subtask } from "@xcollab/core";

/** Server-enforced per-task checklist cap (the API answers 409 beyond it). */
export const SUBTASK_CAP = 50;

/**
 * A subtask's displayed done state: the optimistic override (an in-flight
 * toggle) wins over the last server state.
 */
export function subtaskDone(
  subtask: Subtask,
  overrides: Readonly<Record<string, boolean>>,
): boolean {
  return overrides[subtask.id] ?? subtask.done;
}

export interface SubtaskProgress {
  done: number;
  total: number;
}

/** Progress counts for the "done/total" chip, override-aware. */
export function subtaskProgress(
  subtasks: readonly Subtask[] | undefined,
  overrides: Readonly<Record<string, boolean>> = {},
): SubtaskProgress {
  const list = subtasks ?? [];
  return {
    done: list.filter((subtask) => subtaskDone(subtask, overrides)).length,
    total: list.length,
  };
}
