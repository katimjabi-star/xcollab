import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import { verifyChain, type LedgerEntry, type Program } from "@xcollab/core";
import { AiGateway } from "@xcollab/ai-gateway";
import { migrate } from "../src/db/migrate.ts";
import { WorkGraphRepository } from "../src/repository.ts";
import { createApp } from "../src/app.ts";
import { getAccessToken } from "./keycloak.ts";

const ADMIN_URL =
  process.env.DATABASE_URL ?? "postgres://xcollab:xcollab_dev_only@localhost:5432/xcollab";
const APP_URL =
  process.env.APP_DATABASE_URL ?? "postgres://xcollab_app:app_dev_only@localhost:5432/xcollab";

const WORKSPACE = `ws-progdel-${process.pid}`;
const gateway = new AiGateway([]);
const tester = { kind: "human", id: "tester" } as const;

let admin: Pool;
let appPool: Pool;
let repo: WorkGraphRepository;
let app: ReturnType<typeof createApp>;
let token: string;

beforeAll(async () => {
  admin = new Pool({ connectionString: ADMIN_URL });
  await migrate(admin);
  appPool = new Pool({ connectionString: APP_URL });
  repo = new WorkGraphRepository(appPool);
  app = createApp(repo, gateway);
  token = await getAccessToken();
});

afterAll(async () => {
  await admin.query("DELETE FROM attachments WHERE workspace_id = $1", [WORKSPACE]);
  await admin.query("DELETE FROM ledger_entries WHERE workspace_id = $1", [WORKSPACE]);
  await admin.query("DELETE FROM programs WHERE workspace_id = $1", [WORKSPACE]);
  await appPool.end();
  await admin.end();
});

async function newProgram(mission: string): Promise<Program> {
  const generation = await gateway.generateProgram({ mission, language: "en" });
  return (await repo.createProgram(WORKSPACE, generation, tester)).program;
}

async function api(method: string, path: string): Promise<Response> {
  return app.request(path, { method, headers: { authorization: `Bearer ${token}` } });
}

function delProgram(programId: string): Promise<Response> {
  return api("DELETE", `/api/programs/${programId}?workspaceId=${WORKSPACE}`);
}

describe("DELETE /api/programs/:id", () => {
  it("deletes the program, ledgers program.delete, and later GETs are 404", async () => {
    const program = await newProgram("Program delete happy path");

    const res = await delProgram(program.id);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ledgerSeq: number };
    expect(body.ledgerSeq).toBeGreaterThan(0);

    const get = await api("GET", `/api/programs/${program.id}?workspaceId=${WORKSPACE}`);
    expect(get.status).toBe(404);
    expect(await repo.getProgram(WORKSPACE, program.id)).toBeNull();
    expect((await repo.listPrograms(WORKSPACE)).some((p) => p.id === program.id)).toBe(false);

    const ledger = await repo.getLedger(WORKSPACE);
    const last = ledger.at(-1);
    expect(last?.action).toBe("program.delete");
    expect(last?.actor).toEqual({ kind: "human", id: "jabbir" });
    expect(JSON.parse(last?.input ?? "{}")).toEqual({
      programId: program.id,
      name: program.name,
    });
    expect(last?.output).toBe(JSON.stringify({ applied: true }));
    expect(last?.seq).toBe(body.ledgerSeq);
    expect(verifyChain(ledger as LedgerEntry[])).toEqual({ valid: true });
  });

  it("removes the program's attachment metadata rows in the same delete", async () => {
    const program = await newProgram("Program delete with attachments");
    const taskId = program.packages[0]?.tasks[0]?.id ?? null;
    const attach = (id: string, tid: string | null) =>
      repo.attachments.create(
        WORKSPACE,
        {
          id,
          programId: program.id,
          taskId: tid,
          filename: "doc.pdf",
          contentType: "application/pdf",
          sizeBytes: 4,
          sha256: "a".repeat(64),
          uploadedBy: "tester",
          storageKey: id,
        },
        tester,
      );
    expect(await attach(`att-progdel-1-${process.pid}`, null)).not.toBeNull();
    expect(await attach(`att-progdel-2-${process.pid}`, taskId)).not.toBeNull();

    expect((await delProgram(program.id)).status).toBe(200);

    expect(await repo.attachments.list(WORKSPACE, program.id, {})).toEqual([]);
    const rows = await admin.query(
      "SELECT count(*)::int AS n FROM attachments WHERE workspace_id = $1 AND program_id = $2",
      [WORKSPACE, program.id],
    );
    expect(rows.rows[0]?.n).toBe(0);
    expect(verifyChain((await repo.getLedger(WORKSPACE)) as LedgerEntry[])).toEqual({
      valid: true,
    });
  });

  it("returns 404 for an unknown program, 400 without workspaceId, no ledger row", async () => {
    const before = (await repo.getLedger(WORKSPACE)).length;
    expect((await delProgram("prog-does-not-exist")).status).toBe(404);
    expect((await api("DELETE", "/api/programs/prog-x")).status).toBe(400);
    expect((await repo.getLedger(WORKSPACE)).length).toBe(before);
    expect(await repo.deleteProgram(WORKSPACE, "prog-does-not-exist", tester)).toBeNull();
  });
});
