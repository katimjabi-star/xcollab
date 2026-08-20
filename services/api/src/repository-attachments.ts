import type { Pool, PoolClient } from "pg";
import { AttachmentSchema, type Attachment } from "@xcollab/core";
import type { AppendFn } from "./repository-tasks.ts";
import type { LedgerActor } from "./repository.ts";

export interface NewAttachmentInput {
  id: string;
  programId: string;
  taskId: string | null;
  filename: string;
  contentType: string;
  sizeBytes: number;
  sha256: string;
  uploadedBy: string;
  storageKey: string;
}

interface AttachmentRow {
  id: string;
  workspace_id: string;
  program_id: string;
  task_id: string | null;
  filename: string;
  content_type: string;
  size_bytes: string | number;
  sha256: string;
  uploaded_by: string;
  storage_key: string;
  created_at: Date;
}

/** storage_key never leaves services/api; every read re-validates the shape. */
function toAttachment(row: AttachmentRow): Attachment {
  return AttachmentSchema.parse({
    id: row.id,
    workspaceId: row.workspace_id,
    programId: row.program_id,
    taskId: row.task_id,
    filename: row.filename,
    contentType: row.content_type,
    sizeBytes: Number(row.size_bytes),
    sha256: row.sha256,
    uploadedBy: row.uploaded_by,
    createdAt: row.created_at.toISOString(),
  });
}

/**
 * Attachment metadata with the same invariants as programs and teams
 * (ADR 0002): the row and its ledger entry commit in ONE transaction under
 * the per-workspace advisory lock. The MinIO object write happens OUTSIDE
 * (before) the transaction — the caller removes the object if this rolls back.
 */
export class AttachmentsRepository {
  private readonly pool: Pool;
  private readonly append: AppendFn;

  constructor(pool: Pool, append: AppendFn) {
    this.pool = pool;
    this.append = append;
  }

  /** Ledgers doc.attach with the sha256; null when the program is unknown. */
  async create(
    workspaceId: string,
    input: NewAttachmentInput,
    actor: LedgerActor,
  ): Promise<{ attachment: Attachment; ledgerSeq: number } | null> {
    return this.withTx(workspaceId, async (client) => {
      const program = await client.query(
        "SELECT 1 FROM programs WHERE workspace_id = $1 AND id = $2",
        [workspaceId, input.programId],
      );
      if (program.rowCount === 0) return null;

      const inserted = await client.query<AttachmentRow>(
        `INSERT INTO attachments
         (id, workspace_id, program_id, task_id, filename, content_type, size_bytes, sha256, uploaded_by, storage_key)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING *`,
        [
          input.id,
          workspaceId,
          input.programId,
          input.taskId,
          input.filename,
          input.contentType,
          input.sizeBytes,
          input.sha256,
          input.uploadedBy,
          input.storageKey,
        ],
      );
      const attachment = toAttachment(inserted.rows[0] as AttachmentRow);
      const ledgerSeq = await this.append(client, workspaceId, {
        actor,
        action: "doc.attach",
        input: JSON.stringify({
          programId: attachment.programId,
          taskId: attachment.taskId,
          filename: attachment.filename,
          contentType: attachment.contentType,
          sizeBytes: attachment.sizeBytes,
          sha256: attachment.sha256,
        }),
        output: JSON.stringify({ applied: true, attachmentId: attachment.id }),
      });
      return { attachment, ledgerSeq };
    });
  }

  async list(
    workspaceId: string,
    programId: string,
    filter: { taskId?: string; programOnly?: boolean },
  ): Promise<Attachment[]> {
    const params: string[] = [workspaceId, programId];
    let where = "workspace_id = $1 AND program_id = $2";
    if (filter.taskId !== undefined) {
      params.push(filter.taskId);
      where += " AND task_id = $3";
    } else if (filter.programOnly) {
      where += " AND task_id IS NULL";
    }
    const result = await this.pool.query<AttachmentRow>(
      `SELECT * FROM attachments WHERE ${where} ORDER BY created_at, id`,
      params,
    );
    return result.rows.map(toAttachment);
  }

  async get(
    workspaceId: string,
    id: string,
  ): Promise<{ attachment: Attachment; storageKey: string } | null> {
    const result = await this.pool.query<AttachmentRow>(
      "SELECT * FROM attachments WHERE workspace_id = $1 AND id = $2",
      [workspaceId, id],
    );
    const row = result.rows[0];
    return row ? { attachment: toAttachment(row), storageKey: row.storage_key } : null;
  }

  /**
   * Deletes the row and ledgers doc.remove with the full snapshot in one
   * transaction; the caller removes the MinIO object AFTER the commit.
   */
  async remove(
    workspaceId: string,
    id: string,
    actor: LedgerActor,
  ): Promise<{ attachment: Attachment; storageKey: string; ledgerSeq: number } | null> {
    return this.withTx(workspaceId, async (client) => {
      const result = await client.query<AttachmentRow>(
        "SELECT * FROM attachments WHERE workspace_id = $1 AND id = $2 FOR UPDATE",
        [workspaceId, id],
      );
      const row = result.rows[0];
      if (!row) return null;
      const attachment = toAttachment(row);
      await client.query("DELETE FROM attachments WHERE workspace_id = $1 AND id = $2", [
        workspaceId,
        id,
      ]);
      const ledgerSeq = await this.append(client, workspaceId, {
        actor,
        action: "doc.remove",
        input: JSON.stringify({ attachment }),
        output: JSON.stringify({ applied: true }),
      });
      return { attachment, storageKey: row.storage_key, ledgerSeq };
    });
  }

  /** Transaction shell (ADR 0002): advisory lock; null from step = rollback. */
  private async withTx<T>(
    workspaceId: string,
    step: (client: PoolClient) => Promise<T | null>,
  ): Promise<T | null> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [workspaceId]);
      const value = await step(client);
      await client.query(value === null ? "ROLLBACK" : "COMMIT");
      return value;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}
