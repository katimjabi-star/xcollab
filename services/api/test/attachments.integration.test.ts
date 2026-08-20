import { createHash } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import { verifyChain, type LedgerEntry, type Program } from "@xcollab/core";
import { AiGateway } from "@xcollab/ai-gateway";
import { migrate } from "../src/db/migrate.ts";
import { WorkGraphRepository } from "../src/repository.ts";
import { AttachmentStore } from "../src/storage.ts";
import { createApp } from "../src/app.ts";
import { getAccessToken } from "./keycloak.ts";

const ADMIN_URL =
  process.env.DATABASE_URL ?? "postgres://xcollab:xcollab_dev_only@localhost:5432/xcollab";
const APP_URL =
  process.env.APP_DATABASE_URL ?? "postgres://xcollab_app:app_dev_only@localhost:5432/xcollab";

const WORKSPACE = `ws-attach-${process.pid}`;
const gateway = new AiGateway([]);

interface Attachment {
  id: string;
  workspaceId: string;
  programId: string;
  taskId: string | null;
  filename: string;
  contentType: string;
  sizeBytes: number;
  sha256: string;
  uploadedBy: string;
  createdAt: string;
}

let admin: Pool;
let appPool: Pool;
let repo: WorkGraphRepository;
let app: ReturnType<typeof createApp>;
let token: string;
let program: Program;
let taskId: string;

beforeAll(async () => {
  admin = new Pool({ connectionString: ADMIN_URL });
  await migrate(admin);
  appPool = new Pool({ connectionString: APP_URL });
  repo = new WorkGraphRepository(appPool);
  const store = new AttachmentStore();
  await store.ensureBucket();
  app = createApp(repo, gateway, store);
  token = await getAccessToken();

  const res = await app.request("/api/programs", {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ workspaceId: WORKSPACE, mission: "Attachment host", language: "en" }),
  });
  expect(res.status).toBe(201);
  program = ((await res.json()) as { program: Program }).program;
  const firstTask = program.packages[0]?.tasks[0];
  if (!firstTask) throw new Error("synthesized program has no tasks");
  taskId = firstTask.id;
});

afterAll(async () => {
  await admin.query("DELETE FROM attachments WHERE workspace_id = $1", [WORKSPACE]);
  await admin.query("DELETE FROM ledger_entries WHERE workspace_id = $1", [WORKSPACE]);
  await admin.query("DELETE FROM programs WHERE workspace_id = $1", [WORKSPACE]);
  await appPool.end();
  await admin.end();
});

async function api(method: string, path: string, body?: FormData): Promise<Response> {
  return app.request(path, { method, headers: { authorization: `Bearer ${token}` }, body });
}

function uploadForm(
  bytes: Uint8Array | string,
  filename: string,
  contentType: string,
  opts: { taskId?: string; programId?: string } = {},
): FormData {
  const form = new FormData();
  form.set("workspaceId", WORKSPACE);
  form.set("programId", opts.programId ?? program.id);
  if (opts.taskId !== undefined) form.set("taskId", opts.taskId);
  form.set("file", new File([bytes], filename, { type: contentType }));
  return form;
}

async function upload(
  bytes: Uint8Array | string,
  filename: string,
  contentType: string,
  opts: { taskId?: string; programId?: string } = {},
): Promise<Response> {
  return api("POST", "/api/attachments", uploadForm(bytes, filename, contentType, opts));
}

async function listAttachments(query = ""): Promise<Attachment[]> {
  const res = await api(
    "GET",
    `/api/attachments?workspaceId=${WORKSPACE}&programId=${program.id}${query}`,
  );
  expect(res.status).toBe(200);
  return ((await res.json()) as { attachments: Attachment[] }).attachments;
}

async function ledgerLength(): Promise<number> {
  return (await repo.getLedger(WORKSPACE)).length;
}

const sha256hex = (bytes: Uint8Array | string): string =>
  createHash("sha256").update(bytes).digest("hex");

describe("auth on attachment endpoints", () => {
  it("rejects unauthenticated upload, list, download, and delete", async () => {
    const post = await app.request("/api/attachments", {
      method: "POST",
      body: uploadForm("x", "x.txt", "text/plain"),
    });
    expect(post.status).toBe(401);
    const list = await app.request(`/api/attachments?workspaceId=${WORKSPACE}&programId=x`);
    expect(list.status).toBe(401);
    const content = await app.request(`/api/attachments/att-x/content?workspaceId=${WORKSPACE}`);
    expect(content.status).toBe(401);
    const del = await app.request(`/api/attachments/att-x?workspaceId=${WORKSPACE}`, {
      method: "DELETE",
    });
    expect(del.status).toBe(401);
  });
});

describe("upload → list → download roundtrip", () => {
  const bytes = new TextEncoder().encode("xcollab attachment payload \u{1F680} bytes");

  it("uploads a program-scoped document and ledgers doc.attach with the sha256", async () => {
    const res = await upload(bytes, "notes.txt", "text/plain");
    expect(res.status).toBe(201);
    const { attachment } = (await res.json()) as { attachment: Attachment };
    expect(attachment.id).toMatch(/^att-/);
    expect(attachment.workspaceId).toBe(WORKSPACE);
    expect(attachment.programId).toBe(program.id);
    expect(attachment.taskId).toBeNull();
    expect(attachment.filename).toBe("notes.txt");
    expect(attachment.contentType).toBe("text/plain");
    expect(attachment.sizeBytes).toBe(bytes.length);
    expect(attachment.sha256).toBe(sha256hex(bytes));
    expect(attachment.uploadedBy).toBe("jabbir");
    expect(Object.keys(attachment)).not.toContain("storageKey");
    expect(Object.keys(attachment)).not.toContain("storage_key");

    const last = (await repo.getLedger(WORKSPACE)).at(-1);
    expect(last?.action).toBe("doc.attach");
    expect(last?.actor).toEqual({ kind: "human", id: "jabbir" });
    expect(JSON.parse(last?.input ?? "{}")).toEqual({
      programId: program.id,
      taskId: null,
      filename: "notes.txt",
      contentType: "text/plain",
      sizeBytes: bytes.length,
      sha256: sha256hex(bytes),
    });
  });

  it("lists the uploaded document and downloads byte-identical content", async () => {
    const listed = await listAttachments();
    const attachment = listed.find((a) => a.filename === "notes.txt");
    if (!attachment) throw new Error("uploaded attachment missing from listing");

    const res = await api(
      "GET",
      `/api/attachments/${attachment.id}/content?workspaceId=${WORKSPACE}`,
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/plain");
    expect(res.headers.get("content-disposition")).toContain('filename="notes.txt"');
    const downloaded = new Uint8Array(await res.arrayBuffer());
    expect(downloaded).toEqual(bytes);
    expect(sha256hex(downloaded)).toBe(attachment.sha256);
  });
});

describe("task-scoped vs program-scoped listing", () => {
  it("filters by taskId and by scope=program", async () => {
    const res = await upload("task-level document", "task-doc.txt", "text/plain", { taskId });
    expect(res.status).toBe(201);
    const { attachment } = (await res.json()) as { attachment: Attachment };
    expect(attachment.taskId).toBe(taskId);

    const taskScoped = await listAttachments(`&taskId=${taskId}`);
    expect(taskScoped.map((a) => a.filename)).toEqual(["task-doc.txt"]);

    const programScoped = await listAttachments("&scope=program");
    expect(programScoped.every((a) => a.taskId === null)).toBe(true);
    expect(programScoped.map((a) => a.filename)).toContain("notes.txt");
    expect(programScoped.map((a) => a.filename)).not.toContain("task-doc.txt");

    const all = await listAttachments();
    expect(all.map((a) => a.filename)).toContain("notes.txt");
    expect(all.map((a) => a.filename)).toContain("task-doc.txt");
  });
});

describe("upload guards", () => {
  it("rejects a file over 25MB with 413 too_large and appends no ledger row", async () => {
    const before = await ledgerLength();
    const oversize = new Uint8Array(25 * 1024 * 1024 + 1);
    const res = await upload(oversize, "huge.bin", "application/octet-stream");
    expect(res.status).toBe(413);
    expect(await res.json()).toEqual({ error: "too_large" });
    expect(await ledgerLength()).toBe(before);
  });

  it("rejects an unknown program with 404 and appends no ledger row", async () => {
    const before = await ledgerLength();
    const res = await upload("x", "x.txt", "text/plain", { programId: "prog-nope" });
    expect(res.status).toBe(404);
    expect(await ledgerLength()).toBe(before);
  });
});

describe("DELETE /api/attachments/:id", () => {
  it("deletes, ledgers doc.remove with the row snapshot, and stops serving content", async () => {
    const res = await upload("doomed content", "doomed.txt", "text/plain");
    expect(res.status).toBe(201);
    const { attachment } = (await res.json()) as { attachment: Attachment };

    const del = await api("DELETE", `/api/attachments/${attachment.id}?workspaceId=${WORKSPACE}`);
    expect(del.status).toBe(200);
    expect(await del.json()).toEqual({ deleted: true });

    const last = (await repo.getLedger(WORKSPACE)).at(-1);
    expect(last?.action).toBe("doc.remove");
    expect(last?.actor).toEqual({ kind: "human", id: "jabbir" });
    expect(JSON.parse(last?.input ?? "{}")).toEqual({ attachment });

    expect((await listAttachments()).map((a) => a.id)).not.toContain(attachment.id);
    const gone = await api(
      "GET",
      `/api/attachments/${attachment.id}/content?workspaceId=${WORKSPACE}`,
    );
    expect(gone.status).toBe(404);

    const missing = await api("DELETE", `/api/attachments/att-nope?workspaceId=${WORKSPACE}`);
    expect(missing.status).toBe(404);
  });
});

describe("ledger integrity after attachment operations", () => {
  it("keeps the hash chain valid and shows doc.* actions", async () => {
    const res = await api("GET", `/api/ledger?workspaceId=${WORKSPACE}`);
    const body = (await res.json()) as {
      entries: LedgerEntry[];
      verification: { valid: boolean };
    };
    expect(body.verification).toEqual({ valid: true });
    const actions = new Set(body.entries.map((e) => e.action));
    expect(actions).toContain("doc.attach");
    expect(actions).toContain("doc.remove");
    expect(verifyChain((await repo.getLedger(WORKSPACE)) as LedgerEntry[])).toEqual({
      valid: true,
    });
  });
});
