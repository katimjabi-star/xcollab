import type { Pool } from "pg";
import type { Program } from "@xcollab/core";
import { runProgramMutation, writeProgram, type AppendFn } from "./repository-tasks.ts";
import type { LedgerActor } from "./repository.ts";

export type ProgramTeamResult =
  | { outcome: "ok"; program: Program; ledgerSeq: number }
  | { outcome: "not_found" }
  | { outcome: "unknown_team" };

/**
 * Links (teamId) or unlinks (null) a workspace team on a program. Same
 * invariants as task mutations (ADR 0002): the team existence check, the
 * program write, and the "program.update" ledger row share ONE transaction
 * under the per-workspace advisory lock, so the link can never reference a
 * team deleted concurrently.
 */
export type ProgramRenameResult =
  | { outcome: "ok"; program: Program; ledgerSeq: number }
  | { outcome: "not_found" };

/** Renames a program; the write and its "program.update" ledger row share one
    transaction under the per-workspace advisory lock (ADR 0002). */
export async function updateProgramNameTx(
  pool: Pool,
  append: AppendFn,
  workspaceId: string,
  programId: string,
  name: string,
  actor: LedgerActor,
): Promise<ProgramRenameResult> {
  const result = await runProgramMutation<ProgramRenameResult>(
    pool,
    workspaceId,
    programId,
    async (client, stored) => {
      const from = stored.name;
      const program = await writeProgram(client, workspaceId, programId, { ...stored, name });
      const ledgerSeq = await append(client, workspaceId, {
        actor,
        action: "program.update",
        input: JSON.stringify({ programId, changes: { name: { from, to: name } } }),
        output: JSON.stringify({ applied: true }),
      });
      return { commit: true, value: { outcome: "ok", program, ledgerSeq } };
    },
  );
  return result ?? { outcome: "not_found" };
}

export async function updateProgramTeamTx(
  pool: Pool,
  append: AppendFn,
  workspaceId: string,
  programId: string,
  teamId: string | null,
  actor: LedgerActor,
): Promise<ProgramTeamResult> {
  const result = await runProgramMutation<ProgramTeamResult>(
    pool,
    workspaceId,
    programId,
    async (client, stored) => {
      if (teamId !== null) {
        const team = await client.query(
          "SELECT 1 FROM teams WHERE workspace_id = $1 AND id = $2",
          [workspaceId, teamId],
        );
        if (team.rowCount === 0) {
          return { commit: false, value: { outcome: "unknown_team" } };
        }
      }
      const from = stored.teamId ?? null;
      const next: Program = { ...stored };
      if (teamId === null) delete next.teamId;
      else next.teamId = teamId;
      const program = await writeProgram(client, workspaceId, programId, next);
      const ledgerSeq = await append(client, workspaceId, {
        actor,
        action: "program.update",
        input: JSON.stringify({ programId, changes: { teamId: { from, to: teamId } } }),
        output: JSON.stringify({ applied: true }),
      });
      return { commit: true, value: { outcome: "ok", program, ledgerSeq } };
    },
  );
  return result ?? { outcome: "not_found" };
}
