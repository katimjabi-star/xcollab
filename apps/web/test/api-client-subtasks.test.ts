import { afterEach, describe, expect, it, vi } from "vitest";
import {
  addSubtask,
  deleteProgram,
  deleteSubtask,
  setAuthTokenProvider,
  updateSubtask,
} from "../lib/api-client.ts";

const BASE = "http://localhost:4000";

function mockFetch(status: number, body: unknown): ReturnType<typeof vi.fn> {
  const fn = vi.fn().mockResolvedValue(
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    }),
  );
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => {
  vi.unstubAllGlobals();
  setAuthTokenProvider(() => null);
});

describe("api client — subtasks and program delete (fix-wave-S)", () => {
  it("POSTs a subtask and returns program, task and subtask", async () => {
    const fn = mockFetch(201, {
      program: { id: "prog-1" },
      task: { id: "task-1" },
      subtask: { id: "sub-1", name: "Check", done: false },
      ledgerSeq: 7,
    });
    const result = await addSubtask(BASE, {
      workspaceId: "hq",
      programId: "prog-1",
      taskId: "task-1",
      name: "Check",
    });
    expect(result.subtask.id).toBe("sub-1");
    expect(result.ledgerSeq).toBe(7);
    const [url, init] = fn.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${BASE}/api/programs/prog-1/tasks/task-1/subtasks`);
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({ workspaceId: "hq", name: "Check" });
  });

  it("throws ApiError 409 when adding beyond the subtask cap", async () => {
    mockFetch(409, { error: "subtask cap" });
    await expect(
      addSubtask(BASE, { workspaceId: "hq", programId: "prog-1", taskId: "task-1", name: "x" }),
    ).rejects.toMatchObject({ name: "ApiError", status: 409 });
  });

  it("PATCHes a subtask with only the given patch fields", async () => {
    const fn = mockFetch(200, {
      program: { id: "prog-1" },
      task: { id: "task-1" },
      subtask: { id: "sub-1", name: "Check", done: true },
      ledgerSeq: 8,
    });
    const result = await updateSubtask(BASE, {
      workspaceId: "hq",
      programId: "prog-1",
      taskId: "task-1",
      subtaskId: "sub-1",
      patch: { done: true },
    });
    expect(result.subtask.done).toBe(true);
    const [url, init] = fn.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${BASE}/api/programs/prog-1/tasks/task-1/subtasks/sub-1`);
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body as string)).toEqual({ workspaceId: "hq", done: true });
  });

  it("DELETEs a subtask with workspaceId in the query", async () => {
    const fn = mockFetch(200, { program: { id: "prog-1" }, task: { id: "task-1" }, ledgerSeq: 9 });
    const result = await deleteSubtask(BASE, {
      workspaceId: "hq",
      programId: "prog-1",
      taskId: "task-1",
      subtaskId: "sub-1",
    });
    expect(result.program.id).toBe("prog-1");
    const [url, init] = fn.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${BASE}/api/programs/prog-1/tasks/task-1/subtasks/sub-1?workspaceId=hq`);
    expect(init.method).toBe("DELETE");
    expect(init.body).toBeUndefined();
  });

  it("DELETEs a program with workspaceId in the query", async () => {
    const fn = mockFetch(200, { ledgerSeq: 10 });
    const result = await deleteProgram(BASE, { workspaceId: "hq", programId: "prog-1" });
    expect(result.ledgerSeq).toBe(10);
    const [url, init] = fn.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${BASE}/api/programs/prog-1?workspaceId=hq`);
    expect(init.method).toBe("DELETE");
  });

  it("throws ApiError 404 when deleting an unknown program", async () => {
    mockFetch(404, { error: "unknown program" });
    await expect(
      deleteProgram(BASE, { workspaceId: "hq", programId: "prog-missing" }),
    ).rejects.toMatchObject({ name: "ApiError", status: 404 });
  });

});
