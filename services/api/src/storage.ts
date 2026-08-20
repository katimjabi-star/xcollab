import type { Readable } from "node:stream";
import { Client } from "minio";

export const ATTACHMENTS_BUCKET = "xcollab-attachments";

function clientFromEnv(): Client {
  return new Client({
    endPoint: process.env.MINIO_ENDPOINT ?? "localhost",
    port: Number(process.env.MINIO_PORT ?? 9000),
    useSSL: process.env.MINIO_USE_SSL === "true",
    accessKey: process.env.MINIO_ACCESS_KEY ?? "xcollab",
    secretKey: process.env.MINIO_SECRET_KEY ?? "xcollab_dev_only",
  });
}

/**
 * Object storage for attachment content. Only the bytes live here: metadata
 * and the tamper-evident sha256 stay in Postgres + the ledger, so MinIO is
 * never a source of truth for what was attached.
 */
export class AttachmentStore {
  private readonly client: Client;

  constructor(client: Client = clientFromEnv()) {
    this.client = client;
  }

  /** Idempotent; tolerates a concurrent create of the same bucket. */
  async ensureBucket(): Promise<void> {
    if (await this.client.bucketExists(ATTACHMENTS_BUCKET)) return;
    try {
      await this.client.makeBucket(ATTACHMENTS_BUCKET);
    } catch (error) {
      if (!(await this.client.bucketExists(ATTACHMENTS_BUCKET))) throw error;
    }
  }

  async put(key: string, content: Buffer, contentType: string): Promise<void> {
    await this.client.putObject(ATTACHMENTS_BUCKET, key, content, content.length, {
      "Content-Type": contentType,
    });
  }

  async get(key: string): Promise<Readable> {
    return this.client.getObject(ATTACHMENTS_BUCKET, key);
  }

  /**
   * Best-effort cleanup after a failed transaction or a committed delete;
   * an orphaned object must never mask the primary error or fail a commit
   * that already happened.
   */
  async removeQuietly(key: string): Promise<void> {
    try {
      await this.client.removeObject(ATTACHMENTS_BUCKET, key);
    } catch {
      // Orphaned object only; the authoritative state is Postgres + ledger.
    }
  }
}
