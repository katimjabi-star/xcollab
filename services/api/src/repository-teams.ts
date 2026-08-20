import { randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { WorkspaceTeamSchema, type TeamMember, type WorkspaceTeam } from "@xcollab/core";
import type { AppendFn } from "./repository-tasks.ts";
import type { LedgerActor } from "./repository.ts";

export interface TeamFieldChanges {
  name?: string;
  description?: string;
}

export type TeamMutationResult =
  | { outcome: "ok"; team: WorkspaceTeam; ledgerSeq: number }
  | { outcome: "not_found" }
  | { outcome: "already_member" }
  | { outcome: "last_lead" };

type StepOutcome =
  | { commit: true; team: WorkspaceTeam; action: string; input: string }
  | { commit: false; result: TeamMutationResult };

/**
 * Team CRUD with the same invariants as programs (ADR 0002): every mutation
 * and its ledger row commit in ONE transaction under the per-workspace
 * advisory lock, and every candidate doc is schema-validated before write.
 */
export class TeamsRepository {
  private readonly pool: Pool;
  private readonly append: AppendFn;

  constructor(pool: Pool, append: AppendFn) {
    this.pool = pool;
    this.append = append;
  }

  async list(workspaceId: string): Promise<WorkspaceTeam[]> {
    const result = await this.pool.query<{ doc: unknown }>(
      "SELECT doc FROM teams WHERE workspace_id = $1 ORDER BY created_at",
      [workspaceId],
    );
    return result.rows.map((r) => WorkspaceTeamSchema.parse(r.doc));
  }

  async get(workspaceId: string, teamId: string): Promise<WorkspaceTeam | null> {
    const result = await this.pool.query<{ doc: unknown }>(
      "SELECT doc FROM teams WHERE workspace_id = $1 AND id = $2",
      [workspaceId, teamId],
    );
    const row = result.rows[0];
    return row ? WorkspaceTeamSchema.parse(row.doc) : null;
  }

  /** The caller becomes the sole lead; the id is assigned server-side. */
  async create(
    workspaceId: string,
    input: { name: string; description?: string },
    actor: LedgerActor,
  ): Promise<{ team: WorkspaceTeam; ledgerSeq: number }> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [workspaceId]);
      const team = WorkspaceTeamSchema.parse({
        id: `team-${randomUUID()}`,
        name: input.name,
        ...(input.description === undefined ? {} : { description: input.description }),
        members: [{ username: actor.id, role: "lead" }],
      });
      await client.query("INSERT INTO teams (id, workspace_id, doc) VALUES ($1, $2, $3)", [
        team.id,
        workspaceId,
        JSON.stringify(team),
      ]);
      const ledgerSeq = await this.append(client, workspaceId, {
        actor,
        action: "team.create",
        input: JSON.stringify({ team }),
        output: JSON.stringify({ applied: true }),
      });
      await client.query("COMMIT");
      return { team, ledgerSeq };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async update(
    workspaceId: string,
    teamId: string,
    changes: TeamFieldChanges,
    actor: LedgerActor,
  ): Promise<TeamMutationResult> {
    return this.mutate(workspaceId, teamId, actor, (stored) => {
      const changesMap: Record<string, { from: unknown; to: unknown }> = {};
      const next = { ...stored };
      for (const key of ["name", "description"] as const) {
        const to = changes[key];
        if (to === undefined) continue;
        changesMap[key] = { from: stored[key] ?? null, to };
        next[key] = to;
      }
      return {
        commit: true,
        team: next,
        action: "team.update",
        input: JSON.stringify({ teamId, changes: changesMap }),
      };
    });
  }

  async addMember(
    workspaceId: string,
    teamId: string,
    member: TeamMember,
    actor: LedgerActor,
  ): Promise<TeamMutationResult> {
    return this.mutate(workspaceId, teamId, actor, (stored) => {
      if (stored.members.some((m) => m.username === member.username)) {
        return { commit: false, result: { outcome: "already_member" } };
      }
      return {
        commit: true,
        team: { ...stored, members: [...stored.members, member] },
        action: "team.member_add",
        input: JSON.stringify({ teamId, member }),
      };
    });
  }

  async removeMember(
    workspaceId: string,
    teamId: string,
    username: string,
    actor: LedgerActor,
  ): Promise<TeamMutationResult> {
    return this.mutate(workspaceId, teamId, actor, (stored) => {
      const member = stored.members.find((m) => m.username === username);
      if (!member) return { commit: false, result: { outcome: "not_found" } };
      const leads = stored.members.filter((m) => m.role === "lead");
      if (member.role === "lead" && leads.length === 1) {
        return { commit: false, result: { outcome: "last_lead" } };
      }
      return {
        commit: true,
        team: { ...stored, members: stored.members.filter((m) => m.username !== username) },
        action: "team.member_remove",
        input: JSON.stringify({ teamId, member }),
      };
    });
  }

  async remove(
    workspaceId: string,
    teamId: string,
    actor: LedgerActor,
  ): Promise<{ deleted: true; ledgerSeq: number } | { deleted: false }> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [workspaceId]);
      const stored = await this.lockTeam(client, workspaceId, teamId);
      if (!stored) {
        await client.query("ROLLBACK");
        return { deleted: false };
      }
      await client.query("DELETE FROM teams WHERE workspace_id = $1 AND id = $2", [
        workspaceId,
        teamId,
      ]);
      const ledgerSeq = await this.append(client, workspaceId, {
        actor,
        action: "team.delete",
        input: JSON.stringify({ team: stored }),
        output: JSON.stringify({ applied: true }),
      });
      await client.query("COMMIT");
      return { deleted: true, ledgerSeq };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  private async lockTeam(
    client: PoolClient,
    workspaceId: string,
    teamId: string,
  ): Promise<WorkspaceTeam | null> {
    const result = await client.query<{ doc: unknown }>(
      "SELECT doc FROM teams WHERE workspace_id = $1 AND id = $2 FOR UPDATE",
      [workspaceId, teamId],
    );
    const row = result.rows[0];
    return row ? WorkspaceTeamSchema.parse(row.doc) : null;
  }

  /** Shared transaction shell: lock, load, step, validate, write doc + ledger row. */
  private async mutate(
    workspaceId: string,
    teamId: string,
    actor: LedgerActor,
    step: (stored: WorkspaceTeam) => StepOutcome,
  ): Promise<TeamMutationResult> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [workspaceId]);
      const stored = await this.lockTeam(client, workspaceId, teamId);
      if (!stored) {
        await client.query("ROLLBACK");
        return { outcome: "not_found" };
      }
      const outcome = step(stored);
      if (!outcome.commit) {
        await client.query("ROLLBACK");
        return outcome.result;
      }
      const team = WorkspaceTeamSchema.parse(outcome.team);
      await client.query(
        "UPDATE teams SET doc = $3, updated_at = now() WHERE workspace_id = $1 AND id = $2",
        [workspaceId, teamId, JSON.stringify(team)],
      );
      const ledgerSeq = await this.append(client, workspaceId, {
        actor,
        action: outcome.action,
        input: outcome.input,
        output: JSON.stringify({ applied: true }),
      });
      await client.query("COMMIT");
      return { outcome: "ok", team, ledgerSeq };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}
