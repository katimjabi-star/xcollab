import { createHash } from "node:crypto";
import { z } from "zod";

/** prevHash of the first entry in every workspace chain. */
export const GENESIS_HASH = "0".repeat(64);

const LedgerActorSchema = z.object({
  kind: z.enum(["human", "ai", "service"]),
  id: z.string().min(1),
});

const LedgerEntryContentSchema = z.object({
  workspaceId: z.string().min(1),
  seq: z.number().int().positive(),
  actor: LedgerActorSchema,
  action: z.string().min(1).max(100),
  modelId: z.string().min(1).max(200).optional(),
  // Full prompts/outputs are retained by design (ADR 0002); the ceiling only
  // rejects pathological rows, never legitimate model traffic.
  input: z.string().max(1_000_000),
  output: z.string().max(1_000_000),
  occurredAt: z.iso.datetime(),
  prevHash: z.string().length(64),
});

export type LedgerEntryContent = z.infer<typeof LedgerEntryContentSchema>;
export type LedgerEntry = LedgerEntryContent & { hash: string };

/**
 * Canonical content hash. Field order is fixed here — changing it breaks every
 * existing chain, so treat this serialization as an immutable contract.
 */
export function computeEntryHash(entry: LedgerEntryContent & { hash?: string }): string {
  const canonical = JSON.stringify([
    entry.workspaceId,
    entry.seq,
    entry.actor.kind,
    entry.actor.id,
    entry.action,
    entry.modelId ?? null,
    entry.input,
    entry.output,
    entry.occurredAt,
    entry.prevHash,
  ]);
  return createHash("sha256").update(canonical).digest("hex");
}

export const LedgerEntrySchema = LedgerEntryContentSchema.extend({
  hash: z.string().length(64),
}).refine((entry) => computeEntryHash(entry) === entry.hash, {
  message: "ledger entry hash does not match its content",
});

export type ChainVerification = { valid: true } | { valid: false; brokenAtSeq: number };

/**
 * Verifies content hashes, prev-hash links, gapless sequence numbering, AND
 * the genesis anchor: a non-empty chain must start at seq 1 with GENESIS_HASH,
 * so a truncated chain (first N entries dropped) never verifies clean. Callers
 * verifying a partial window must fetch back to seq 1 — partial verification
 * is deliberately unsupported for an append-only audit log.
 */
export function verifyChain(entries: LedgerEntry[]): ChainVerification {
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i] as LedgerEntry;
    if (computeEntryHash(entry) !== entry.hash) {
      return { valid: false, brokenAtSeq: entry.seq };
    }
    if (i === 0) {
      if (entry.seq !== 1 || entry.prevHash !== GENESIS_HASH) {
        return { valid: false, brokenAtSeq: entry.seq };
      }
      continue;
    }
    const prev = entries[i - 1] as LedgerEntry;
    if (entry.prevHash !== prev.hash || entry.seq !== prev.seq + 1) {
      return { valid: false, brokenAtSeq: entry.seq };
    }
  }
  return { valid: true };
}
