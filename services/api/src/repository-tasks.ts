import { randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { ProgramSchema, type Program, type Task } from "@xcollab/core";
import type { AppendInput, LedgerActor } from "./repository.ts";

/** Subset of task fields a human may change; null clears an optional field. */
export interface TaskFieldChanges {
  status?: Task["status"];
  name?: string;
  estimateDays?: number;
  assigneeRole?: string | null;
  assignee?: string | null;
  startDate?: string | null;
  dueDate?: string | null;
  description?: string | null;
}

export interface NewTaskInput {
  name: string;
  estimateDays?: number;
  assigneeRole?: string;
  startDate?: string;
  dueDate?: string;
  description?: string;
}

/**
 * Cross-field rule violation (start after due) on the MERGED task — only
 * detectable once request changes are applied over the stored task. Thrown
 * inside the mutation transaction so it rolls back with no ledger row; the
 * route layer maps it to a structured 400.
 */
export class InvalidTaskDatesError extends Error {
  readonly code = "invalid_task_dates";

  constructor() {
    super("task startDate must be on or before dueDate");
    this.name = "InvalidTaskDatesError";
  }
}

function assertDateOrder(task: Task): void {
  if (task.startDate && task.dueDate && task.startDate > task.dueDate) {
    throw new InvalidTaskDatesError();
  }
}

export type DeleteTaskResult =
  | { outcome: "deleted"; program: Program; ledgerSeq: number }
  | { outcome: "not_found" }
  | { outcome: "last_task" };

export type AppendFn = (
  client: PoolClient,
  workspaceId: string,
  input: AppendInput,
) => Promise<number>;

const UPDATABLE_TASK_KEYS = [
  "status",
  "name",
  "estimateDays",
  "assigneeRole",
  "assignee",
  "startDate",
  "dueDate",
  "description",
] as const;

type MutationOutcome<T> = { commit: true; value: T } | { commit: false; value: T | null };

/**
 * Shared transaction shell for human task mutations (ADR 0002): advisory lock,
 * SELECT ... FOR UPDATE, then the step decides commit vs rollback. A rollback
 * leaves the program untouched and appends no ledger row.
 */
export async function runProgramMutation<T>(
  pool: Pool,
  workspaceId: string,
  programId: string,
  step: (client: PoolClient, stored: Program) => Promise<MutationOutcome<T>>,
): Promise<T | null> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [workspaceId]);
    const result = await client.query<{ data: unknown }>(
      "SELECT data FROM programs WHERE workspace_id = $1 AND id = $2 FOR UPDATE",
      [workspaceId, programId],
    );
    const row = result.rows[0];
    if (!row) {
      await client.query("ROLLBACK");
      return null;
    }
    const outcome = await step(client, ProgramSchema.parse(row.data));
    if (!outcome.commit) {
      await client.query("ROLLBACK");
      return outcome.value;
    }
    await client.query("COMMIT");
    return outcome.value;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/** Validates the candidate program (ProgramSchema.parse) before writing it. */
export async function writeProgram(
  client: PoolClient,
  workspaceId: string,
  programId: string,
  candidate: unknown,
): Promise<Program> {
  const program = ProgramSchema.parse(candidate);
  await client.query("UPDATE programs SET data = $3 WHERE workspace_id = $1 AND id = $2", [
    workspaceId,
    programId,
    JSON.stringify(program),
  ]);
  return program;
}

function applyChanges(task: Task, changes: TaskFieldChanges): Task {
  const next: Task = { ...task };
  if (changes.status !== undefined) next.status = changes.status;
  if (changes.name !== undefined) next.name = changes.name;
  if (changes.estimateDays !== undefined) next.estimateDays = changes.estimateDays;
  for (const key of ["assigneeRole", "assignee", "startDate", "dueDate", "description"] as const) {
    const value = changes[key];
    if (value === undefined) continue;
    // null clears the field; undefined keys are dropped by JSON serialization.
    next[key] = value === null ? undefined : value;
  }
  return next;
}

function buildChangesMap(
  before: Task,
  changes: TaskFieldChanges,
): Record<string, { from: unknown; to: unknown }> {
  const map: Record<string, { from: unknown; to: unknown }> = {};
  for (const key of UPDATABLE_TASK_KEYS) {
    const to = changes[key];
    if (to === undefined) continue;
    map[key] = { from: before[key] ?? null, to };
  }
  return map;
}

export async function updateTaskTx(
  pool: Pool,
  append: AppendFn,
  workspaceId: string,
  programId: string,
  taskId: string,
  changes: TaskFieldChanges,
  actor: LedgerActor,
): Promise<{ program: Program; ledgerSeq: number } | null> {
  return runProgramMutation(pool, workspaceId, programId, async (client, stored) => {
    let before: Task | null = null;
    const packages = stored.packages.map((pkg) => ({
      ...pkg,
      tasks: pkg.tasks.map((task) => {
        if (task.id !== taskId) return task;
        before = task;
        const merged = applyChanges(task, changes);
        assertDateOrder(merged);
        return merged;
      }),
    }));
    if (before === null) return { commit: false, value: null };
    const beforeTask: Task = before;
    const program = await writeProgram(client, workspaceId, programId, { ...stored, packages });

    const providedKeys = UPDATABLE_TASK_KEYS.filter((key) => changes[key] !== undefined);
    let action: string;
    let input: string;
    if (providedKeys.length === 1 && changes.status !== undefined) {
      // Status-only change keeps the historical ledger shape (existing behavior).
      action = "task.status_update";
      input = JSON.stringify({ programId, taskId, from: beforeTask.status, to: changes.status });
    } else {
      action = "task.update";
      input = JSON.stringify({ programId, taskId, changes: buildChangesMap(beforeTask, changes) });
    }
    const seq = await append(client, workspaceId, {
      actor,
      action,
      input,
      output: JSON.stringify({ applied: true }),
    });
    return { commit: true, value: { program, ledgerSeq: seq } };
  });
}

export async function createTaskTx(
  pool: Pool,
  append: AppendFn,
  workspaceId: string,
  programId: string,
  packageId: string,
  input: NewTaskInput,
  actor: LedgerActor,
): Promise<{ program: Program; task: Task; ledgerSeq: number } | null> {
  return runProgramMutation(pool, workspaceId, programId, async (client, stored) => {
    if (!stored.packages.some((pkg) => pkg.id === packageId)) {
      return { commit: false, value: null };
    }
    const task: Task = {
      id: `task-${randomUUID()}`,
      name: input.name,
      status: "todo",
      estimateDays: input.estimateDays ?? 1,
      ...(input.assigneeRole === undefined ? {} : { assigneeRole: input.assigneeRole }),
      ...(input.startDate === undefined ? {} : { startDate: input.startDate }),
      ...(input.dueDate === undefined ? {} : { dueDate: input.dueDate }),
      ...(input.description === undefined ? {} : { description: input.description }),
    };
    assertDateOrder(task);
    const packages = stored.packages.map((pkg) =>
      pkg.id === packageId ? { ...pkg, tasks: [...pkg.tasks, task] } : pkg,
    );
    const program = await writeProgram(client, workspaceId, programId, { ...stored, packages });
    const seq = await append(client, workspaceId, {
      actor,
      action: "task.create",
      input: JSON.stringify({ programId, packageId, task }),
      output: JSON.stringify({ applied: true }),
    });
    return { commit: true, value: { program, task, ledgerSeq: seq } };
  });
}

export async function deleteTaskTx(
  pool: Pool,
  append: AppendFn,
  workspaceId: string,
  programId: string,
  taskId: string,
  actor: LedgerActor,
): Promise<DeleteTaskResult> {
  const result = await runProgramMutation<DeleteTaskResult>(
    pool,
    workspaceId,
    programId,
    async (client, stored) => {
      const pkg = stored.packages.find((p) => p.tasks.some((t) => t.id === taskId));
      const snapshot = pkg?.tasks.find((t) => t.id === taskId);
      if (!pkg || !snapshot) return { commit: false, value: null };
      // WorkPackageSchema requires at least one task; refuse instead of corrupting.
      if (pkg.tasks.length === 1) return { commit: false, value: { outcome: "last_task" } };
      const packages = stored.packages.map((p) =>
        p.id === pkg.id ? { ...p, tasks: p.tasks.filter((t) => t.id !== taskId) } : p,
      );
      const program = await writeProgram(client, workspaceId, programId, { ...stored, packages });
      const seq = await append(client, workspaceId, {
        actor,
        action: "task.delete",
        input: JSON.stringify({ programId, taskId, task: snapshot }),
        output: JSON.stringify({ applied: true }),
      });
      return { commit: true, value: { outcome: "deleted", program, ledgerSeq: seq } };
    },
  );
  return result ?? { outcome: "not_found" };
}
