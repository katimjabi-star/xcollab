import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import type { Program, Subtask, Task } from "@xcollab/core";
import { runProgramMutation, writeProgram, type AppendFn } from "./repository-tasks.ts";
import type { LedgerActor } from "./repository.ts";
import type { MutationProvenance } from "./repository-provenance.ts";

/** Mirrors the z.array(SubtaskSchema).max(50) bound on TaskSchema.subtasks. */
export const MAX_SUBTASKS = 50;

/** Subset of subtask fields a caller may change on PATCH. */
export interface SubtaskFieldChanges {
  name?: string;
  done?: boolean;
}

export type AddSubtaskResult =
  | { outcome: "added"; program: Program; task: Task; subtask: Subtask; ledgerSeq: number }
  | { outcome: "not_found" }
  | { outcome: "limit" };

export type UpdateSubtaskResult = {
  program: Program;
  task: Task;
  subtask: Subtask;
  ledgerSeq: number;
} | null;

export type DeleteSubtaskResult = { program: Program; task: Task; ledgerSeq: number } | null;

type AppendVia = (provenance?: MutationProvenance) => AppendFn;

interface TaskEdit {
  packages: Program["packages"];
  after: Task | null;
}

/** Rewrites one task in place across packages; after stays null when unknown. */
function editTask(stored: Program, taskId: string, edit: (task: Task) => Task): TaskEdit {
  let after: Task | null = null;
  const packages = stored.packages.map((pkg) => ({
    ...pkg,
    tasks: pkg.tasks.map((task) => {
      if (task.id !== taskId) return task;
      after = edit(task);
      return after;
    }),
  }));
  return { packages, after };
}

/**
 * Checklist subtasks with the same invariants as task mutations (ADR 0002):
 * the program write and its ledger row commit in ONE transaction under the
 * per-workspace advisory lock; a rollback appends no ledger row.
 */
export class SubtasksRepository {
  private readonly pool: Pool;
  private readonly appendVia: AppendVia;

  constructor(pool: Pool, appendVia: AppendVia) {
    this.pool = pool;
    this.appendVia = appendVia;
  }

  /** Ledgers "task.subtask_add"; server-minted `sub-<uuid>` id, done=false. */
  async add(
    workspaceId: string,
    programId: string,
    taskId: string,
    name: string,
    actor: LedgerActor,
    provenance?: MutationProvenance,
  ): Promise<AddSubtaskResult> {
    const append = this.appendVia(provenance);
    const result = await runProgramMutation<AddSubtaskResult>(
      this.pool,
      workspaceId,
      programId,
      async (client, stored) => {
        const subtask: Subtask = { id: `sub-${randomUUID()}`, name, done: false };
        let limited = false;
        const edit = editTask(stored, taskId, (task) => {
          const existing = task.subtasks ?? [];
          if (existing.length >= MAX_SUBTASKS) {
            limited = true;
            return task;
          }
          return { ...task, subtasks: [...existing, subtask] };
        });
        if (edit.after === null) return { commit: false, value: { outcome: "not_found" } };
        if (limited) return { commit: false, value: { outcome: "limit" } };
        const program = await writeProgram(client, workspaceId, programId, {
          ...stored,
          packages: edit.packages,
        });
        const ledgerSeq = await append(client, workspaceId, {
          actor,
          action: "task.subtask_add",
          input: JSON.stringify({ programId, taskId, subtask }),
          output: JSON.stringify({ applied: true }),
        });
        return {
          commit: true,
          value: { outcome: "added", program, task: edit.after, subtask, ledgerSeq },
        };
      },
    );
    return result ?? { outcome: "not_found" };
  }

  /** Ledgers "task.subtask_update" with a per-field {from, to} changes map. */
  async update(
    workspaceId: string,
    programId: string,
    taskId: string,
    subtaskId: string,
    changes: SubtaskFieldChanges,
    actor: LedgerActor,
    provenance?: MutationProvenance,
  ): Promise<UpdateSubtaskResult> {
    const append = this.appendVia(provenance);
    return runProgramMutation(this.pool, workspaceId, programId, async (client, stored) => {
      let before: Subtask | null = null;
      let next: Subtask | null = null;
      const edit = editTask(stored, taskId, (task) => ({
        ...task,
        subtasks: (task.subtasks ?? []).map((st) => {
          if (st.id !== subtaskId) return st;
          before = st;
          next = {
            ...st,
            ...(changes.name === undefined ? {} : { name: changes.name }),
            ...(changes.done === undefined ? {} : { done: changes.done }),
          };
          return next;
        }),
      }));
      if (edit.after === null || before === null || next === null) {
        return { commit: false, value: null };
      }
      const from: Subtask = before;
      const subtask: Subtask = next;
      const changesMap: Record<string, { from: unknown; to: unknown }> = {};
      if (changes.name !== undefined) changesMap["name"] = { from: from.name, to: changes.name };
      if (changes.done !== undefined) changesMap["done"] = { from: from.done, to: changes.done };
      const program = await writeProgram(client, workspaceId, programId, {
        ...stored,
        packages: edit.packages,
      });
      const ledgerSeq = await append(client, workspaceId, {
        actor,
        action: "task.subtask_update",
        input: JSON.stringify({ programId, taskId, subtaskId, changes: changesMap }),
        output: JSON.stringify({ applied: true }),
      });
      return { commit: true, value: { program, task: edit.after, subtask, ledgerSeq } };
    });
  }

  /** Ledgers "task.subtask_delete" with the full subtask snapshot. */
  async remove(
    workspaceId: string,
    programId: string,
    taskId: string,
    subtaskId: string,
    actor: LedgerActor,
    provenance?: MutationProvenance,
  ): Promise<DeleteSubtaskResult> {
    const append = this.appendVia(provenance);
    return runProgramMutation(this.pool, workspaceId, programId, async (client, stored) => {
      let snapshot: Subtask | null = null;
      const edit = editTask(stored, taskId, (task) => ({
        ...task,
        subtasks: (task.subtasks ?? []).filter((st) => {
          if (st.id !== subtaskId) return true;
          snapshot = st;
          return false;
        }),
      }));
      if (edit.after === null || snapshot === null) return { commit: false, value: null };
      const program = await writeProgram(client, workspaceId, programId, {
        ...stored,
        packages: edit.packages,
      });
      const ledgerSeq = await append(client, workspaceId, {
        actor,
        action: "task.subtask_delete",
        input: JSON.stringify({ programId, taskId, subtask: snapshot }),
        output: JSON.stringify({ applied: true }),
      });
      return { commit: true, value: { program, task: edit.after, ledgerSeq } };
    });
  }
}
