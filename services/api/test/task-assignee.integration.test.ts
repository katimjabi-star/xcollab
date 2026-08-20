import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import { verifyChain, type LedgerEntry, type Program, type Task } from "@xcollab/core";
import { AiGateway } from "@xcollab/ai-gateway";
import { migrate } from "../src/db/migrate.ts";
import { WorkGraphRepository } from "../src/repository.ts";
import { createApp } from "../src/app.ts";
import { getAccessToken } from "./keycloak.ts";

const ADMIN_URL =
  process.env.DATABASE_URL ?? "postgres://xcollab:xcollab_dev_only@localhost:5432/xcollab";
const APP_URL =
  process.env.APP_DATABASE_URL ?? "postgres://xcollab_app:app_dev_only@localhost:5432/xcollab";

const WORKSPACE = `ws-assignee-${process.pid}`;
const gateway = new AiGateway([]);

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
  await admin.query("DELETE FROM ledger_entries WHERE workspace_id = $1", [WORKSPACE]);
  await admin.query("DELETE FROM programs WHERE workspace_id = $1", [WORKSPACE]);
  await appPool.end();
  await admin.end();
});

async function patchTask(programId: string, taskId: string, body: object): Promise<Response> {
  return app.request(`/api/programs/${programId}/tasks/${taskId}`, {
    method: "PATCH",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify({ workspaceId: WORKSPACE, ...body }),
  });
}

async function storedTask(programId: string, taskId: string): Promise<Task | undefined> {
  const program = await repo.getProgram(WORKSPACE, programId);
  return program?.packages.flatMap((p) => p.tasks).find((t) => t.id === taskId);
}

describe("PATCH task assignee", () => {
  it("sets and clears assignee, landing in the task.update changes map", async () => {
    const generation = await gateway.generateProgram({ mission: "Assignee test", language: "en" });
    const { program } = await repo.createProgram(WORKSPACE, generation, {
      kind: "human",
      id: "tester",
    });
    const task = program.packages[0]?.tasks[0];
    if (!task) throw new Error("program has no tasks");

    const set = await patchTask(program.id, task.id, { assignee: "sara" });
    expect(set.status).toBe(200);
    const setBody = (await set.json()) as { program: Program };
    expect(
      setBody.program.packages.flatMap((p) => p.tasks).find((t) => t.id === task.id)?.assignee,
    ).toBe("sara");
    expect((await storedTask(program.id, task.id))?.assignee).toBe("sara");

    let last = (await repo.getLedger(WORKSPACE)).at(-1);
    expect(last?.action).toBe("task.update");
    expect(last?.actor).toEqual({ kind: "human", id: "jabbir" });
    expect(JSON.parse(last?.input ?? "{}")).toEqual({
      programId: program.id,
      taskId: task.id,
      changes: { assignee: { from: null, to: "sara" } },
    });

    const clear = await patchTask(program.id, task.id, { assignee: null });
    expect(clear.status).toBe(200);
    expect((await storedTask(program.id, task.id))?.assignee).toBeUndefined();

    last = (await repo.getLedger(WORKSPACE)).at(-1);
    expect(JSON.parse(last?.input ?? "{}")).toEqual({
      programId: program.id,
      taskId: task.id,
      changes: { assignee: { from: "sara", to: null } },
    });
    expect(verifyChain((await repo.getLedger(WORKSPACE)) as LedgerEntry[])).toEqual({
      valid: true,
    });
  });

  it("rejects an empty-string assignee", async () => {
    const generation = await gateway.generateProgram({ mission: "Assignee bad", language: "en" });
    const { program } = await repo.createProgram(WORKSPACE, generation, {
      kind: "human",
      id: "tester",
    });
    const task = program.packages[0]?.tasks[0];
    if (!task) throw new Error("program has no tasks");
    expect((await patchTask(program.id, task.id, { assignee: "" })).status).toBe(400);
  });
});
