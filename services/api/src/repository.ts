import { randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import {
  computeEntryHash,
  GENESIS_HASH,
  ProgramSchema,
  type LedgerEntry,
  type Program,
  type Task,
} from "@xcollab/core";
import type { GenerationResult } from "@xcollab/ai-gateway";

import {
  createTaskTx,
  deleteTaskTx,
  updateTaskTx,
  type AppendFn,
  type DeleteTaskResult,
  type NewTaskInput,
  type TaskFieldChanges,
} from "./repository-tasks.ts";

import { TeamsRepository } from "./repository-teams.ts";
import { AttachmentsRepository } from "./repository-attachments.ts";
import { updateProgramTeamTx, type ProgramTeamResult } from "./repository-programs.ts";

export type { DeleteTaskResult, NewTaskInput, TaskFieldChanges } from "./repository-tasks.ts";
export type { TeamFieldChanges, TeamMutationResult } from "./repository-teams.ts";
export type { NewAttachmentInput } from "./repository-attachments.ts";
export type { ProgramTeamResult } from "./repository-programs.ts";

export interface LedgerActor {
  kind: "human" | "ai" | "service";
  id: string;
}

export interface AppendInput {
  actor: LedgerActor;
  action: string;
  modelId?: string;
  input: string;
  output: string;
  /** Test hook: assert the chain rejects a stated prev-hash that mismatches. */
  prevHashOverride?: string;
}

interface LedgerRow {
  workspace_id: string;
  seq: number;
  actor_kind: LedgerActor["kind"];
  actor_id: string;
  action: string;
  model_id: string | null;
  input: string;
  output: string;
  occurred_at: string;
  prev_hash: string;
  hash: string;
}

function rowToEntry(row: LedgerRow): LedgerEntry {
  return {
    workspaceId: row.workspace_id,
    seq: row.seq,
    actor: { kind: row.actor_kind, id: row.actor_id },
    action: row.action,
    ...(row.model_id === null ? {} : { modelId: row.model_id }),
    input: row.input,
    output: row.output,
    occurredAt: row.occurred_at,
    prevHash: row.prev_hash,
    hash: row.hash,
  };
}

export class WorkGraphRepository {
  private readonly pool: Pool;

  /** Team CRUD shares the same chain-append logic and transaction invariants. */
  readonly teams: TeamsRepository;

  /** Attachment metadata shares the same chain-append logic and invariants. */
  readonly attachments: AttachmentsRepository;

  constructor(pool: Pool) {
    this.pool = pool;
    const append: AppendFn = (client, workspaceId, input) =>
      this.appendWithClient(client, workspaceId, input);
    this.teams = new TeamsRepository(pool, append);
    this.attachments = new AttachmentsRepository(pool, append);
  }

  /**
   * AI-originated mutation: the program row and its ledger row commit in ONE
   * transaction (ADR 0002). The per-workspace advisory lock serializes chain
   * appends so the hash chain never forks under concurrency.
   */
  async createProgram(
    workspaceId: string,
    generation: GenerationResult,
    actor: LedgerActor,
  ): Promise<{ program: Program; ledgerSeq: number }> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [workspaceId]);

      // Persistent identity is assigned here, not by the model plane: adapter
      // and synthesizer ids are template values and would collide across creates.
      const program: Program = { ...generation.program, id: `prog-${randomUUID()}` };
      await client.query(
        "INSERT INTO programs (workspace_id, id, data) VALUES ($1, $2, $3)",
        [workspaceId, program.id, JSON.stringify(program)],
      );
      const seq = await this.appendWithClient(client, workspaceId, {
        actor,
        action: "program.generate",
        ...(generation.interaction.modelId ? { modelId: generation.interaction.modelId } : {}),
        input: generation.interaction.input,
        output: generation.interaction.output,
      });

      await client.query("COMMIT");
      return { program, ledgerSeq: seq };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  /** Bound append so task transactions ledger through the same chain logic. */
  private readonly append: AppendFn = (client, workspaceId, input) =>
    this.appendWithClient(client, workspaceId, input);

  /**
   * Human-originated mutation: task status change and its ledger row commit in
   * ONE transaction (ADR 0002). Returns null when the program or task is
   * missing — the transaction rolls back and no ledger row is appended.
   * Status-only convenience over updateTask; keeps the "task.status_update"
   * ledger action.
   */
  async updateTaskStatus(
    workspaceId: string,
    programId: string,
    taskId: string,
    status: Task["status"],
    actor: LedgerActor,
  ): Promise<{ program: Program; ledgerSeq: number } | null> {
    return this.updateTask(workspaceId, programId, taskId, { status }, actor);
  }

  /**
   * Applies a subset of task field changes in ONE transaction. Ledger action is
   * "task.status_update" when status is the only change key, "task.update"
   * (with a per-field {from, to} map) otherwise.
   */
  async updateTask(
    workspaceId: string,
    programId: string,
    taskId: string,
    changes: TaskFieldChanges,
    actor: LedgerActor,
  ): Promise<{ program: Program; ledgerSeq: number } | null> {
    return updateTaskTx(this.pool, this.append, workspaceId, programId, taskId, changes, actor);
  }

  /** Adds a task to a package; null when the program or package is unknown. */
  async createTask(
    workspaceId: string,
    programId: string,
    packageId: string,
    input: NewTaskInput,
    actor: LedgerActor,
  ): Promise<{ program: Program; task: Task; ledgerSeq: number } | null> {
    return createTaskTx(this.pool, this.append, workspaceId, programId, packageId, input, actor);
  }

  /**
   * Removes a task; "last_task" (no write, no ledger row) when it is the only
   * task in its package, because WorkPackageSchema requires tasks.min(1).
   */
  async deleteTask(
    workspaceId: string,
    programId: string,
    taskId: string,
    actor: LedgerActor,
  ): Promise<DeleteTaskResult> {
    return deleteTaskTx(this.pool, this.append, workspaceId, programId, taskId, actor);
  }

  /** Links (teamId) or unlinks (null) a workspace team on a program. */
  async updateProgramTeam(
    workspaceId: string,
    programId: string,
    teamId: string | null,
    actor: LedgerActor,
  ): Promise<ProgramTeamResult> {
    return updateProgramTeamTx(this.pool, this.append, workspaceId, programId, teamId, actor);
  }

  /** Non-mutating model interactions are ledgered through the same chain. */
  async appendLedgerEntry(workspaceId: string, input: AppendInput): Promise<number> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [workspaceId]);
      const seq = await this.appendWithClient(client, workspaceId, input);
      await client.query("COMMIT");
      return seq;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  private async appendWithClient(
    client: PoolClient,
    workspaceId: string,
    input: AppendInput,
  ): Promise<number> {
    const head = await client.query<{ seq: number; hash: string }>(
      "SELECT seq, hash FROM ledger_entries WHERE workspace_id = $1 ORDER BY seq DESC LIMIT 1",
      [workspaceId],
    );
    const prevSeq = head.rows[0]?.seq ?? 0;
    const expectedPrevHash = head.rows[0]?.hash ?? GENESIS_HASH;

    if (input.prevHashOverride !== undefined && input.prevHashOverride !== expectedPrevHash) {
      throw new Error(
        `ledger chain mismatch: stated prev hash does not match the workspace chain head`,
      );
    }

    const content = {
      workspaceId,
      seq: prevSeq + 1,
      actor: input.actor,
      action: input.action,
      ...(input.modelId === undefined ? {} : { modelId: input.modelId }),
      input: input.input,
      output: input.output,
      occurredAt: new Date().toISOString(),
      prevHash: expectedPrevHash,
    };
    const hash = computeEntryHash(content);

    await client.query(
      `INSERT INTO ledger_entries
       (workspace_id, seq, actor_kind, actor_id, action, model_id, input, output, occurred_at, prev_hash, hash)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        workspaceId,
        content.seq,
        content.actor.kind,
        content.actor.id,
        content.action,
        input.modelId ?? null,
        content.input,
        content.output,
        content.occurredAt,
        content.prevHash,
        hash,
      ],
    );
    return content.seq;
  }

  async getProgram(workspaceId: string, id: string): Promise<Program | null> {
    const result = await this.pool.query<{ data: unknown }>(
      "SELECT data FROM programs WHERE workspace_id = $1 AND id = $2",
      [workspaceId, id],
    );
    const row = result.rows[0];
    return row ? ProgramSchema.parse(row.data) : null;
  }

  async listPrograms(workspaceId: string): Promise<Program[]> {
    const result = await this.pool.query<{ data: unknown }>(
      "SELECT data FROM programs WHERE workspace_id = $1 ORDER BY created_at",
      [workspaceId],
    );
    return result.rows.map((r) => ProgramSchema.parse(r.data));
  }

  async getLedger(workspaceId: string): Promise<LedgerEntry[]> {
    const result = await this.pool.query<LedgerRow>(
      "SELECT * FROM ledger_entries WHERE workspace_id = $1 ORDER BY seq",
      [workspaceId],
    );
    return result.rows.map(rowToEntry);
  }
}
