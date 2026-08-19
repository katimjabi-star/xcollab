import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import { verifyChain, type LedgerEntry } from "@xcollab/core";
import { AiGateway } from "@xcollab/ai-gateway";
import { migrate } from "../src/db/migrate.ts";
import { WorkGraphRepository } from "../src/repository.ts";

const ADMIN_URL =
  process.env.DATABASE_URL ?? "postgres://xcollab:xcollab_dev_only@localhost:5432/xcollab";
const APP_URL =
  process.env.APP_DATABASE_URL ?? "postgres://xcollab_app:app_dev_only@localhost:5432/xcollab";

const WORKSPACE = `ws-test-${process.pid}`;

let admin: Pool;
let app: Pool;
let repo: WorkGraphRepository;
const gateway = new AiGateway([]);

beforeAll(async () => {
  admin = new Pool({ connectionString: ADMIN_URL });
  await migrate(admin);
  app = new Pool({ connectionString: APP_URL });
  repo = new WorkGraphRepository(app);
});

afterAll(async () => {
  await admin.query("DELETE FROM ledger_entries WHERE workspace_id = $1", [WORKSPACE]);
  await admin.query("DELETE FROM programs WHERE workspace_id = $1", [WORKSPACE]);
  await app.end();
  await admin.end();
});

describe("program creation with ledgered generation", () => {
  it("persists the program and its ledger row in one transaction", async () => {
    const generation = await gateway.generateProgram({
      mission: "Integration test program",
      language: "en",
      timeline: { start: "2026-09-01", end: "2026-10-01" },
    });
    const created = await repo.createProgram(WORKSPACE, generation, {
      kind: "human",
      id: "tester",
    });

    const fetched = await repo.getProgram(WORKSPACE, created.program.id);
    expect(fetched?.mission).toBe("Integration test program");

    const ledger = await repo.getLedger(WORKSPACE);
    expect(ledger.length).toBeGreaterThan(0);
    expect(ledger.at(-1)?.action).toBe("program.generate");
    expect(verifyChain(ledger as LedgerEntry[])).toEqual({ valid: true });
  });

  it("chains a second entry onto the first", async () => {
    const generation = await gateway.generateProgram({
      mission: "Second integration program",
      language: "ar",
    });
    await repo.createProgram(WORKSPACE, generation, { kind: "service", id: "api-test" });
    const ledger = await repo.getLedger(WORKSPACE);
    expect(ledger.length).toBeGreaterThanOrEqual(2);
    expect(verifyChain(ledger as LedgerEntry[])).toEqual({ valid: true });
    expect(ledger[1]?.prevHash).toBe(ledger[0]?.hash);
  });

  it("lists programs for the workspace", async () => {
    const programs = await repo.listPrograms(WORKSPACE);
    expect(programs.length).toBeGreaterThanOrEqual(2);
  });
});

describe("ledger append-only enforcement (database layer, not convention)", () => {
  it("denies UPDATE on ledger entries to the app role", async () => {
    await expect(
      app.query("UPDATE ledger_entries SET output = 'forged' WHERE workspace_id = $1", [WORKSPACE]),
    ).rejects.toThrow(/permission denied/i);
  });

  it("denies DELETE on ledger entries to the app role", async () => {
    await expect(
      app.query("DELETE FROM ledger_entries WHERE workspace_id = $1", [WORKSPACE]),
    ).rejects.toThrow(/permission denied/i);
  });

  it("rejects a ledger insert with a broken chain (bad prevHash)", async () => {
    await expect(
      repo.appendLedgerEntry(WORKSPACE, {
        actor: { kind: "ai", id: "rogue" },
        action: "model.read",
        input: "x",
        output: "y",
        prevHashOverride: "f".repeat(64),
      }),
    ).rejects.toThrow(/chain/i);
  });
});
