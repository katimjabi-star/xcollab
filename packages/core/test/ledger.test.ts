import { describe, expect, it } from "vitest";
import {
  computeEntryHash,
  GENESIS_HASH,
  LedgerEntrySchema,
  verifyChain,
  type LedgerEntry,
} from "../src/index.ts";

function makeEntry(seq: number, prevHash: string, overrides?: Partial<LedgerEntry>): LedgerEntry {
  const base = {
    workspaceId: "ws-1",
    seq,
    actor: { kind: "ai" as const, id: "teammate-risk-watcher" },
    action: "model.read",
    modelId: "test-model",
    input: `input for ${seq}`,
    output: `output for ${seq}`,
    occurredAt: "2026-08-19T10:00:00.000Z",
    prevHash,
    ...overrides,
  };
  return { ...base, hash: computeEntryHash(base) };
}

describe("ledger hash chain", () => {
  it("validates a well-formed chain from genesis", () => {
    const e1 = makeEntry(1, GENESIS_HASH);
    const e2 = makeEntry(2, e1.hash);
    const e3 = makeEntry(3, e2.hash);
    expect(verifyChain([e1, e2, e3])).toEqual({ valid: true });
  });

  it("accepts an empty chain", () => {
    expect(verifyChain([])).toEqual({ valid: true });
  });

  it("detects content tampering", () => {
    const e1 = makeEntry(1, GENESIS_HASH);
    const e2 = makeEntry(2, e1.hash);
    const tampered = { ...e1, output: "forged output" };
    const result = verifyChain([tampered, e2]);
    expect(result.valid).toBe(false);
    expect(result.valid === false && result.brokenAtSeq).toBe(1);
  });

  it("detects a broken link", () => {
    const e1 = makeEntry(1, GENESIS_HASH);
    const e2 = makeEntry(2, GENESIS_HASH); // wrong prevHash: skips e1
    const result = verifyChain([e1, e2]);
    expect(result.valid).toBe(false);
  });

  it("detects a sequence gap", () => {
    const e1 = makeEntry(1, GENESIS_HASH);
    const e3 = makeEntry(3, e1.hash);
    const result = verifyChain([e1, e3]);
    expect(result.valid).toBe(false);
  });

  it("hash is deterministic and input-sensitive", () => {
    const e1 = makeEntry(1, GENESIS_HASH);
    expect(computeEntryHash(e1)).toBe(computeEntryHash({ ...e1 }));
    expect(computeEntryHash({ ...e1, input: "different" })).not.toBe(computeEntryHash(e1));
  });

  it("schema rejects an entry whose hash does not match its content", () => {
    const e1 = makeEntry(1, GENESIS_HASH);
    expect(() => LedgerEntrySchema.parse({ ...e1, hash: "0".repeat(64) })).toThrow();
  });
});
