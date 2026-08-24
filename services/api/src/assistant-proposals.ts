import { randomUUID } from "node:crypto";

/**
 * Single-use proposal ids (spec §2.2/D6): a mutation proposal is minted when
 * the loop streams its proposal card and consumed exactly once by
 * POST /api/assistant/execute. The transcript stays client-held; this store
 * only pins WHO may execute WHAT — workspace, user, tool, and the exact args
 * previewed — so a confirm can never execute something other than the card
 * the user saw. In-memory by design (demo scale; single api process).
 */

export interface ProposalRecord {
  workspaceId: string;
  username: string;
  tool: string;
  /** stableStringify of the zod-validated args shown on the proposal card. */
  argsKey: string;
  modelId: string;
  expiresAt: number;
}

export type ProposalConsumeResult =
  | { outcome: "ok"; record: ProposalRecord }
  | { outcome: "unknown" }
  | { outcome: "mismatch" };

const TTL_MS = 15 * 60_000;
const MAX_PENDING = 1_000;

/** Deterministic serialization: sorted keys, undefined values dropped. */
export function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => entry !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

export class ProposalStore {
  private readonly pending = new Map<string, ProposalRecord>();

  private readonly now: () => number;

  constructor(now: () => number = Date.now) {
    this.now = now;
  }

  mint(record: Omit<ProposalRecord, "expiresAt">): string {
    this.evictExpired();
    // Bounded memory: drop the oldest pending proposal beyond the cap.
    while (this.pending.size >= MAX_PENDING) {
      const oldest = this.pending.keys().next().value;
      if (oldest === undefined) break;
      this.pending.delete(oldest);
    }
    const proposalId = randomUUID();
    this.pending.set(proposalId, { ...record, expiresAt: this.now() + TTL_MS });
    return proposalId;
  }

  /**
   * Single-use: the id is removed on the FIRST consume attempt, matching or
   * not — a mismatched confirm burns the proposal rather than allowing a
   * second, corrected replay.
   */
  consume(
    proposalId: string,
    claim: Pick<ProposalRecord, "workspaceId" | "username" | "tool" | "argsKey">,
  ): ProposalConsumeResult {
    const record = this.pending.get(proposalId);
    this.pending.delete(proposalId);
    if (!record || record.expiresAt < this.now()) return { outcome: "unknown" };
    const matches =
      record.workspaceId === claim.workspaceId &&
      record.username === claim.username &&
      record.tool === claim.tool &&
      record.argsKey === claim.argsKey;
    return matches ? { outcome: "ok", record } : { outcome: "mismatch" };
  }

  private evictExpired(): void {
    const now = this.now();
    for (const [id, record] of this.pending) {
      if (record.expiresAt < now) this.pending.delete(id);
    }
  }
}
