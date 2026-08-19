import type { Pool, PoolClient } from "pg";

const APP_ROLE_PASSWORD = process.env.APP_DB_PASSWORD ?? "app_dev_only";

/**
 * Idempotent schema migration. Append-only ledger is enforced at the DATABASE
 * layer (Charter invariant 2, ADR 0002): the application role holds INSERT and
 * SELECT on ledger_entries — UPDATE/DELETE are never granted.
 * occurred_at is stored as the exact ISO string used in the content hash.
 */
// Serializes concurrent migrate() calls (e.g. parallel test workers): Postgres
// throws "tuple concurrently updated" on concurrent GRANTs to the same objects.
const MIGRATE_LOCK_KEY = 727_001;

export async function migrate(admin: Pool): Promise<void> {
  const client = await admin.connect();
  try {
    await client.query("SELECT pg_advisory_lock($1)", [MIGRATE_LOCK_KEY]);
    try {
      await runMigration(client);
    } finally {
      await client.query("SELECT pg_advisory_unlock($1)", [MIGRATE_LOCK_KEY]);
    }
  } finally {
    client.release();
  }
}

async function runMigration(admin: PoolClient): Promise<void> {
  await admin.query(`
    CREATE TABLE IF NOT EXISTS programs (
      workspace_id TEXT NOT NULL,
      id TEXT NOT NULL,
      data JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (workspace_id, id)
    );

    CREATE TABLE IF NOT EXISTS ledger_entries (
      workspace_id TEXT NOT NULL,
      seq INTEGER NOT NULL CHECK (seq > 0),
      actor_kind TEXT NOT NULL CHECK (actor_kind IN ('human', 'ai', 'service')),
      actor_id TEXT NOT NULL,
      action TEXT NOT NULL,
      model_id TEXT,
      input TEXT NOT NULL,
      output TEXT NOT NULL,
      occurred_at TEXT NOT NULL,
      prev_hash CHAR(64) NOT NULL,
      hash CHAR(64) NOT NULL,
      PRIMARY KEY (workspace_id, seq)
    );
  `);

  const quotedPassword = `'${APP_ROLE_PASSWORD.replaceAll("'", "''")}'`;
  await admin.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'xcollab_app') THEN
        CREATE ROLE xcollab_app LOGIN PASSWORD ${quotedPassword};
      END IF;
    END $$;
  `);

  await admin.query(`
    GRANT SELECT, INSERT, UPDATE, DELETE ON programs TO xcollab_app;
    GRANT SELECT, INSERT ON ledger_entries TO xcollab_app;
    REVOKE UPDATE, DELETE ON ledger_entries FROM xcollab_app;
  `);
}
