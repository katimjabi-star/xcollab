import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import type { Program, Task } from "@xcollab/core";
import { AiGateway } from "@xcollab/ai-gateway";
import { migrate } from "../src/db/migrate.ts";
import { WorkGraphRepository } from "../src/repository.ts";
import { createApp } from "../src/app.ts";
import { getAccessToken } from "./keycloak.ts";

const ADMIN_URL =
  process.env.DATABASE_URL ?? "postgres://xcollab:xcollab_dev_only@localhost:5432/xcollab";
const APP_URL =
  process.env.APP_DATABASE_URL ?? "postgres://xcollab_app:app_dev_only@localhost:5432/xcollab";

const WORKSPACE = `ws-mytasks-${process.pid}`;
const gateway = new AiGateway([]);

type AnnotatedTask = Task & {
  programId: string;
  programName: string;
  packageId: string;
  packageName: string;
};

let admin: Pool;
let appPool: Pool;
let repo: WorkGraphRepository;
let app: ReturnType<typeof createApp>;
let token: string;

const tester = { kind: "human", id: "tester" } as const;

async function seedProgram(mission: string): Promise<Program> {
  const generation = await gateway.generateProgram({ mission, language: "en" });
  const { program } = await repo.createProgram(WORKSPACE, generation, tester);
  return program;
}

async function assign(programId: string, taskId: string, assignee: string): Promise<void> {
  const result = await repo.updateTask(WORKSPACE, programId, taskId, { assignee }, tester);
  if (!result) throw new Error("assignment failed: task not found");
}

function firstTask(program: Program): Task {
  const task = program.packages[0]?.tasks[0];
  if (!task) throw new Error("program has no tasks");
  return task;
}

async function getMyTasks(query: string, auth?: string): Promise<Response> {
  return app.request(`/api/users/me/tasks${query}`, {
    headers: auth ? { authorization: auth } : {},
  });
}

beforeAll(async () => {
  admin = new Pool({ connectionString: ADMIN_URL });
  await migrate(admin);
  appPool = new Pool({ connectionString: APP_URL });
  repo = new WorkGraphRepository(appPool);
  app = createApp(repo, gateway);
  token = await getAccessToken(); // dev user "jabbir"
});

afterAll(async () => {
  await admin.query("DELETE FROM ledger_entries WHERE workspace_id = $1", [WORKSPACE]);
  await admin.query("DELETE FROM programs WHERE workspace_id = $1", [WORKSPACE]);
  await appPool.end();
  await admin.end();
});

describe("GET /api/users/me/tasks", () => {
  it("rejects requests without a bearer token", async () => {
    const res = await getMyTasks(`?workspaceId=${WORKSPACE}`);
    expect(res.status).toBe(401);
  });

  it("requires workspaceId", async () => {
    const res = await getMyTasks("", `Bearer ${token}`);
    expect(res.status).toBe(400);
  });

  it("aggregates the token user's tasks across programs, annotated, without a ledger write", async () => {
    const programA = await seedProgram("My tasks route A");
    const programB = await seedProgram("My tasks route B");

    // jabbir gets one task in each program; sara's task must not leak in.
    const mineA = firstTask(programA);
    const mineB = firstTask(programB);
    const otherTask = programA.packages.at(-1)?.tasks.at(-1);
    if (!otherTask || otherTask.id === mineA.id) throw new Error("need two distinct tasks");
    await assign(programA.id, mineA.id, "jabbir");
    await assign(programB.id, mineB.id, "jabbir");
    await assign(programA.id, otherTask.id, "sara");

    const ledgerBefore = (await repo.getLedger(WORKSPACE)).length;
    const res = await getMyTasks(`?workspaceId=${WORKSPACE}`, `Bearer ${token}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { tasks: AnnotatedTask[] };

    // Template generation reuses task ids across programs — key on the pair.
    const pairs = body.tasks.map((task) => `${task.programId}/${task.id}`).sort();
    expect(pairs).toEqual([`${programA.id}/${mineA.id}`, `${programB.id}/${mineB.id}`].sort());
    for (const task of body.tasks) {
      expect(task.assignee).toBe("jabbir");
    }

    const annotatedA = body.tasks.find(
      (task) => task.id === mineA.id && task.programId === programA.id,
    );
    const pkgA = programA.packages.find((pkg) => pkg.tasks.some((t) => t.id === mineA.id));
    expect(annotatedA?.programId).toBe(programA.id);
    expect(annotatedA?.programName).toBe(programA.name);
    expect(annotatedA?.packageId).toBe(pkgA?.id);
    expect(annotatedA?.packageName).toBe(pkgA?.name);

    const annotatedB = body.tasks.find(
      (task) => task.id === mineB.id && task.programId === programB.id,
    );
    expect(annotatedB?.programName).toBe(programB.name);

    // Read-only contract: the aggregate endpoint appends nothing to the chain.
    expect((await repo.getLedger(WORKSPACE)).length).toBe(ledgerBefore);
  });

  it("returns an empty list for a workspace with no matching assignee", async () => {
    const res = await getMyTasks(`?workspaceId=ws-mytasks-empty-${process.pid}`, `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(((await res.json()) as { tasks: AnnotatedTask[] }).tasks).toEqual([]);
  });
});
