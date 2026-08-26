import type { Pool, PoolClient } from "pg";
import type { AppendFn } from "./repository-tasks.ts";
import type { LedgerActor } from "./repository.ts";

export type WorkspaceRole = "owner" | "member";

export interface WorkspaceMember {
  username: string;
  role: WorkspaceRole;
}

/** claimed=false means zero member rows exist — the workspace is up for claim. */
export interface WorkspaceAccess {
  claimed: boolean;
  role: WorkspaceRole | null;
}

export type MemberMutationResult =
  | { outcome: "ok"; members: WorkspaceMember[]; ledgerSeq: number }
  | { outcome: "forbidden" }
  | { outcome: "already_member" }
  | { outcome: "not_found" }
  | { outcome: "last_owner" };

/**
 * Workspace membership with the same invariants as the other repositories
 * (ADR 0002): every membership mutation and its ledger row commit in ONE
 * transaction under the per-workspace advisory lock. The claim itself is NOT
 * ledgered — it is an access-control side effect of the first mutation, and
 * inserting a ledger row for it would fork the sequence every existing
 * consumer expects for that mutation.
 */
export class WorkspaceMembersRepository {
  private readonly pool: Pool;
  private readonly append: AppendFn;

  constructor(pool: Pool, append: AppendFn) {
    this.pool = pool;
    this.append = append;
  }

  async list(workspaceId: string): Promise<WorkspaceMember[]> {
    const result = await this.pool.query<WorkspaceMember>(
      "SELECT username, role FROM workspace_members WHERE workspace_id = $1 ORDER BY created_at",
      [workspaceId],
    );
    return result.rows;
  }

  /** Read-path check: never claims, never writes. */
  async access(workspaceId: string, username: string): Promise<WorkspaceAccess> {
    const result = await this.pool.query<{ claimed: boolean; role: WorkspaceRole | null }>(
      `SELECT
         EXISTS (SELECT 1 FROM workspace_members WHERE workspace_id = $1) AS claimed,
         (SELECT role FROM workspace_members
           WHERE workspace_id = $1 AND username = $2) AS role`,
      [workspaceId, username],
    );
    const row = result.rows[0];
    return { claimed: row?.claimed ?? false, role: row?.role ?? null };
  }

  /**
   * Mutation-path check: an unclaimed workspace is claimed atomically by the
   * caller, who becomes its owner. The advisory xact lock serializes racing
   * first mutations so exactly one claimant wins; the loser observes the
   * winner's row and comes back as a plain non-member.
   */
  async claimOrAccess(workspaceId: string, username: string): Promise<WorkspaceAccess> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [workspaceId]);
      const existing = await roleOf(client, workspaceId, username);
      if (existing !== null) {
        await client.query("COMMIT");
        return { claimed: true, role: existing };
      }
      const claimed = await isClaimed(client, workspaceId);
      if (claimed) {
        await client.query("COMMIT");
        return { claimed: true, role: null };
      }
      await client.query(
        "INSERT INTO workspace_members (workspace_id, username, role) VALUES ($1, $2, 'owner')",
        [workspaceId, username],
      );
      await client.query("COMMIT");
      return { claimed: true, role: "owner" };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  /** Owner-only; ledgers "workspace.member_add" in the same transaction. */
  async add(
    workspaceId: string,
    actor: LedgerActor,
    member: WorkspaceMember,
  ): Promise<MemberMutationResult> {
    return this.mutate(workspaceId, actor, async (client) => {
      if ((await roleOf(client, workspaceId, member.username)) !== null) {
        return { outcome: "already_member" };
      }
      await client.query(
        "INSERT INTO workspace_members (workspace_id, username, role) VALUES ($1, $2, $3)",
        [workspaceId, member.username, member.role],
      );
      return { action: "workspace.member_add", member };
    });
  }

  /**
   * Owner-only; ledgers "workspace.member_remove" in the same transaction.
   * The last owner can never be removed — a workspace, once claimed, always
   * has an owner.
   */
  async remove(
    workspaceId: string,
    actor: LedgerActor,
    username: string,
  ): Promise<MemberMutationResult> {
    return this.mutate(workspaceId, actor, async (client) => {
      const role = await roleOf(client, workspaceId, username);
      if (role === null) return { outcome: "not_found" };
      if (role === "owner" && (await ownerCount(client, workspaceId)) === 1) {
        return { outcome: "last_owner" };
      }
      await client.query(
        "DELETE FROM workspace_members WHERE workspace_id = $1 AND username = $2",
        [workspaceId, username],
      );
      return { action: "workspace.member_remove", member: { username, role } };
    });
  }

  /** Shared transaction shell: lock, verify owner, step, ledger, commit. */
  private async mutate(
    workspaceId: string,
    actor: LedgerActor,
    step: (
      client: PoolClient,
    ) => Promise<{ action: string; member: WorkspaceMember } | { outcome: "already_member" | "not_found" | "last_owner" }>,
  ): Promise<MemberMutationResult> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [workspaceId]);
      if ((await roleOf(client, workspaceId, actor.id)) !== "owner") {
        await client.query("ROLLBACK");
        return { outcome: "forbidden" };
      }
      const stepped = await step(client);
      if ("outcome" in stepped) {
        await client.query("ROLLBACK");
        return stepped;
      }
      const ledgerSeq = await this.append(client, workspaceId, {
        actor,
        action: stepped.action,
        input: JSON.stringify({ member: stepped.member }),
        output: JSON.stringify({ applied: true }),
      });
      const listed = await client.query<WorkspaceMember>(
        "SELECT username, role FROM workspace_members WHERE workspace_id = $1 ORDER BY created_at",
        [workspaceId],
      );
      await client.query("COMMIT");
      return { outcome: "ok", members: listed.rows, ledgerSeq };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}

async function roleOf(
  client: PoolClient,
  workspaceId: string,
  username: string,
): Promise<WorkspaceRole | null> {
  const result = await client.query<{ role: WorkspaceRole }>(
    "SELECT role FROM workspace_members WHERE workspace_id = $1 AND username = $2",
    [workspaceId, username],
  );
  return result.rows[0]?.role ?? null;
}

async function isClaimed(client: PoolClient, workspaceId: string): Promise<boolean> {
  const result = await client.query<{ claimed: boolean }>(
    "SELECT EXISTS (SELECT 1 FROM workspace_members WHERE workspace_id = $1) AS claimed",
    [workspaceId],
  );
  return result.rows[0]?.claimed ?? false;
}

async function ownerCount(client: PoolClient, workspaceId: string): Promise<number> {
  const result = await client.query<{ count: string }>(
    "SELECT count(*) AS count FROM workspace_members WHERE workspace_id = $1 AND role = 'owner'",
    [workspaceId],
  );
  return Number(result.rows[0]?.count ?? 0);
}
