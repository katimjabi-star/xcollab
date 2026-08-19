import { randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import {
  computeEntryHash,
  GENESIS_HASH,
  ProgramSchema,
  type LedgerEntry,
  type Program,
} from "@xcollab/core";
import type { GenerationResult } from "@xcollab/ai-gateway";

export interface LedgerActor {
  kind: "human" | "ai" | "service";
  id: string;
}

interface AppendInput {
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

  constructor(pool: Pool) {
    this.pool = pool;
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
