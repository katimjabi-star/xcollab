import { createHash, randomUUID } from "node:crypto";
import { Readable } from "node:stream";
import type { Hono } from "hono";
import { z } from "zod";
import type { AuthEnv } from "./auth.ts";
import type { LedgerActor, WorkGraphRepository } from "./repository.ts";
import type { AttachmentStore } from "./storage.ts";

export const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;

const UploadFieldsSchema = z.object({
  workspaceId: z.string().min(1),
  programId: z.string().min(1),
  taskId: z.string().min(1).optional(),
});

/** Header-injection guard: quotes and CR/LF cannot survive into the header. */
const dispositionFilename = (filename: string): string =>
  filename.replaceAll(/[\r\n"\\]/g, "_");

/** Attachment routes; auth middleware is already installed on /api/* by app.ts. */
export function registerAttachmentRoutes(
  app: Hono<AuthEnv>,
  repo: WorkGraphRepository,
  store: AttachmentStore,
): void {
  const humanActor = (c: { get: (key: "username") => string }): LedgerActor => ({
    kind: "human",
    id: c.get("username"),
  });

  app.post("/api/attachments", async (c) => {
    const body = await c.req.parseBody().catch(() => ({}) as Record<string, never>);
    const { file, ...fields } = body;
    const parsed = UploadFieldsSchema.safeParse(fields);
    if (!parsed.success) {
      return c.json({ error: "invalid request", issues: parsed.error.issues }, 400);
    }
    if (!(file instanceof File)) return c.json({ error: "file is required" }, 400);
    if (file.size > MAX_ATTACHMENT_BYTES) return c.json({ error: "too_large" }, 413);
    const { workspaceId, programId, taskId } = parsed.data;
    if (!(await repo.getProgram(workspaceId, programId))) {
      return c.json({ error: "unknown_program" }, 404);
    }

    const content = Buffer.from(await file.arrayBuffer());
    const id = `att-${randomUUID()}`;
    const input = {
      id,
      programId,
      taskId: taskId ?? null,
      filename: file.name,
      contentType: file.type || "application/octet-stream",
      sizeBytes: content.length,
      sha256: createHash("sha256").update(content).digest("hex"),
      uploadedBy: c.get("username"),
      storageKey: id,
    };

    // Object write happens BEFORE the metadata+ledger transaction; on any
    // transaction failure the object is removed best-effort (ADR 0002 keeps
    // the row and its ledger entry atomic — MinIO is outside that boundary).
    await store.put(input.storageKey, content, input.contentType);
    try {
      const result = await repo.attachments.create(workspaceId, input, humanActor(c));
      if (!result) {
        await store.removeQuietly(input.storageKey);
        return c.json({ error: "unknown_program" }, 404);
      }
      return c.json({ attachment: result.attachment }, 201);
    } catch (error) {
      await store.removeQuietly(input.storageKey);
      throw error;
    }
  });

  app.get("/api/attachments", async (c) => {
    const workspaceId = c.req.query("workspaceId");
    const programId = c.req.query("programId");
    if (!workspaceId || !programId) {
      return c.json({ error: "workspaceId and programId are required" }, 400);
    }
    const taskId = c.req.query("taskId");
    const attachments = await repo.attachments.list(workspaceId, programId, {
      ...(taskId === undefined ? {} : { taskId }),
      programOnly: c.req.query("scope") === "program",
    });
    return c.json({ attachments });
  });

  app.get("/api/attachments/:id/content", async (c) => {
    const workspaceId = c.req.query("workspaceId");
    if (!workspaceId) return c.json({ error: "workspaceId is required" }, 400);
    const found = await repo.attachments.get(workspaceId, c.req.param("id"));
    if (!found) return c.json({ error: "not_found" }, 404);
    const stream = await store.get(found.storageKey);
    c.header("content-type", found.attachment.contentType);
    c.header(
      "content-disposition",
      `attachment; filename="${dispositionFilename(found.attachment.filename)}"`,
    );
    c.header("content-length", String(found.attachment.sizeBytes));
    return c.body(Readable.toWeb(stream) as ReadableStream);
  });

  app.delete("/api/attachments/:id", async (c) => {
    const workspaceId = c.req.query("workspaceId");
    if (!workspaceId) return c.json({ error: "workspaceId is required" }, 400);
    const removed = await repo.attachments.remove(workspaceId, c.req.param("id"), humanActor(c));
    if (!removed) return c.json({ error: "not_found" }, 404);
    // Best-effort AFTER the commit: the row+ledger are authoritative already.
    await store.removeQuietly(removed.storageKey);
    return c.json({ deleted: true });
  });
}
