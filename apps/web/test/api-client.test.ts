import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ApiError,
  createProgram,
  createTask,
  deleteTask,
  getLedger,
  listPrograms,
  listUsers,
  setAuthTokenProvider,
  updateTask,
  updateTaskStatus,
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

describe("api client", () => {
  it("POSTs a program brief and returns the created program", async () => {
    const fn = mockFetch(201, { program: { id: "prog-1" }, ledgerSeq: 1, generatedBy: "m" });
    const result = await createProgram(BASE, {
      workspaceId: "hq",
      mission: "Test mission",
      language: "en",
    });
    expect(result.program.id).toBe("prog-1");
    expect(result.ledgerSeq).toBe(1);
    const [url, init] = fn.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${BASE}/api/programs`);
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string).mission).toBe("Test mission");
  });

  it("POSTs the optional parentId when creating a sub-program", async () => {
    const fn = mockFetch(201, { program: { id: "prog-2" }, ledgerSeq: 2, generatedBy: "m" });
    await createProgram(BASE, {
      workspaceId: "hq",
      mission: "Child mission",
      language: "en",
      parentId: "prog-1",
    });
    const [, init] = fn.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string).parentId).toBe("prog-1");
  });

  it("omits parentId from the POST body when not provided", async () => {
    const fn = mockFetch(201, { program: { id: "prog-3" }, ledgerSeq: 3, generatedBy: "m" });
    await createProgram(BASE, { workspaceId: "hq", mission: "Root mission", language: "en" });
    const [, init] = fn.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string)).not.toHaveProperty("parentId");
  });

  it("throws ApiError 422 when parentId is unknown", async () => {
    mockFetch(422, { error: "unknown_parent" });
    await expect(
      createProgram(BASE, { workspaceId: "hq", mission: "m", language: "en", parentId: "nope" }),
    ).rejects.toMatchObject({ name: "ApiError", status: 422 });
  });

  it("lists workspace users from GET /api/users", async () => {
    const fn = mockFetch(200, {
      users: [{ username: "jdoe", firstName: "Jane", lastName: "Doe", email: "j@x.io" }],
    });
    const users = await listUsers(BASE, { workspaceId: "hq" });
    expect(users).toEqual([
      { username: "jdoe", firstName: "Jane", lastName: "Doe", email: "j@x.io" },
    ]);
    expect(fn.mock.calls[0]?.[0]).toBe(`${BASE}/api/users?workspaceId=hq`);
  });

  it("throws ApiError carrying the status when listUsers fails", async () => {
    mockFetch(401, { error: "unauthorized" });
    await expect(listUsers(BASE, { workspaceId: "hq" })).rejects.toMatchObject({
      name: "ApiError",
      status: 401,
    });
  });

  it("throws ApiError with the status on a non-2xx response", async () => {
    mockFetch(400, { error: "invalid request" });
    await expect(
      createProgram(BASE, { workspaceId: "hq", mission: "", language: "en" }),
    ).rejects.toThrowError(ApiError);
  });

  it("lists programs scoped to a workspace", async () => {
    const fn = mockFetch(200, { programs: [{ id: "a" }, { id: "b" }] });
    const programs = await listPrograms(BASE, "hq");
    expect(programs).toHaveLength(2);
    expect(fn.mock.calls[0]?.[0]).toBe(`${BASE}/api/programs?workspaceId=hq`);
  });

  it("returns ledger entries with the verification verdict", async () => {
    mockFetch(200, { entries: [{ seq: 1 }], verification: { valid: true } });
    const ledger = await getLedger(BASE, "hq");
    expect(ledger.verification.valid).toBe(true);
    expect(ledger.entries).toHaveLength(1);
  });

  it("PATCHes a task status and returns the updated program with the ledger seq", async () => {
    const fn = mockFetch(200, { program: { id: "prog-1" }, ledgerSeq: 7 });
    const result = await updateTaskStatus(BASE, {
      workspaceId: "hq",
      programId: "prog-1",
      taskId: "task-9",
      status: "done",
    });
    expect(result.program.id).toBe("prog-1");
    expect(result.ledgerSeq).toBe(7);
    const [url, init] = fn.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${BASE}/api/programs/prog-1/tasks/task-9`);
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body as string)).toEqual({ workspaceId: "hq", status: "done" });
  });

  it("throws ApiError carrying the status when the task PATCH fails", async () => {
    mockFetch(404, { error: "task not found" });
    await expect(
      updateTaskStatus(BASE, {
        workspaceId: "hq",
        programId: "prog-1",
        taskId: "missing",
        status: "blocked",
      }),
    ).rejects.toMatchObject({ name: "ApiError", status: 404 });
  });

  it("PATCHes arbitrary task fields via updateTask, nulls clearing optionals", async () => {
    const fn = mockFetch(200, { program: { id: "prog-1" }, ledgerSeq: 8 });
    const result = await updateTask(BASE, {
      workspaceId: "hq",
      programId: "prog-1",
      taskId: "task-9",
      patch: { name: "Renamed", estimateDays: 2.5, dueDate: null },
    });
    expect(result.ledgerSeq).toBe(8);
    const [url, init] = fn.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${BASE}/api/programs/prog-1/tasks/task-9`);
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body as string)).toEqual({
      workspaceId: "hq",
      name: "Renamed",
      estimateDays: 2.5,
      dueDate: null,
    });
  });

  it("PATCHes assignee as a username via updateTask", async () => {
    const fn = mockFetch(200, { program: { id: "prog-1" }, ledgerSeq: 11 });
    await updateTask(BASE, {
      workspaceId: "hq",
      programId: "prog-1",
      taskId: "task-9",
      patch: { assignee: "jdoe" },
    });
    expect(JSON.parse((fn.mock.calls[0] as [string, RequestInit])[1].body as string)).toEqual({
      workspaceId: "hq",
      assignee: "jdoe",
    });
  });

  it("PATCHes assignee: null to unassign, like other optional fields", async () => {
    const fn = mockFetch(200, { program: { id: "prog-1" }, ledgerSeq: 12 });
    await updateTask(BASE, {
      workspaceId: "hq",
      programId: "prog-1",
      taskId: "task-9",
      patch: { assignee: null },
    });
    expect(JSON.parse((fn.mock.calls[0] as [string, RequestInit])[1].body as string)).toEqual({
      workspaceId: "hq",
      assignee: null,
    });
  });

  it("throws ApiError carrying the status when updateTask fails", async () => {
    mockFetch(400, { error: "invalid patch" });
    await expect(
      updateTask(BASE, {
        workspaceId: "hq",
        programId: "prog-1",
        taskId: "task-9",
        patch: { name: "" },
      }),
    ).rejects.toMatchObject({ name: "ApiError", status: 400 });
  });

  it("POSTs a new task into a package via createTask", async () => {
    const fn = mockFetch(201, {
      program: { id: "prog-1" },
      task: { id: "task-new", status: "todo" },
      ledgerSeq: 9,
    });
    const result = await createTask(BASE, {
      workspaceId: "hq",
      programId: "prog-1",
      packageId: "pkg-1",
      name: "New task",
    });
    expect(result.task.id).toBe("task-new");
    expect(result.ledgerSeq).toBe(9);
    const [url, init] = fn.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${BASE}/api/programs/prog-1/tasks`);
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({
      workspaceId: "hq",
      packageId: "pkg-1",
      name: "New task",
    });
  });

  it("throws ApiError 404 when createTask targets an unknown package", async () => {
    mockFetch(404, { error: "package not found" });
    await expect(
      createTask(BASE, {
        workspaceId: "hq",
        programId: "prog-1",
        packageId: "missing",
        name: "New task",
      }),
    ).rejects.toMatchObject({ name: "ApiError", status: 404 });
  });

  it("DELETEs a task with workspaceId as a query parameter", async () => {
    const fn = mockFetch(200, { program: { id: "prog-1" }, ledgerSeq: 10 });
    const result = await deleteTask(BASE, {
      workspaceId: "hq",
      programId: "prog-1",
      taskId: "task-9",
    });
    expect(result.program.id).toBe("prog-1");
    const [url, init] = fn.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${BASE}/api/programs/prog-1/tasks/task-9?workspaceId=hq`);
    expect(init.method).toBe("DELETE");
    expect(init.body).toBeUndefined();
  });

  it("throws ApiError 409 when deleting the last task in a package", async () => {
    mockFetch(409, { error: "last task in package" });
    await expect(
      deleteTask(BASE, { workspaceId: "hq", programId: "prog-1", taskId: "task-only" }),
    ).rejects.toMatchObject({ name: "ApiError", status: 409 });
  });

  it("attaches Authorization: Bearer when the token provider returns a token", async () => {
    setAuthTokenProvider(() => "tok-123");
    const fn = mockFetch(200, { programs: [] });
    await listPrograms(BASE, "hq");
    const [, init] = fn.mock.calls[0] as [string, RequestInit];
    expect(new Headers(init.headers).get("authorization")).toBe("Bearer tok-123");
  });

  it("keeps content-type intact alongside the Authorization header", async () => {
    setAuthTokenProvider(() => "tok-123");
    const fn = mockFetch(201, { program: { id: "p" }, ledgerSeq: 1, generatedBy: "m" });
    await createProgram(BASE, { workspaceId: "hq", mission: "m", language: "en" });
    const [, init] = fn.mock.calls[0] as [string, RequestInit];
    const headers = new Headers(init.headers);
    expect(headers.get("authorization")).toBe("Bearer tok-123");
    expect(headers.get("content-type")).toBe("application/json");
  });

  it("sends no Authorization header when the provider returns null", async () => {
    setAuthTokenProvider(() => null);
    const fn = mockFetch(200, { programs: [] });
    await listPrograms(BASE, "hq");
    const [, init] = fn.mock.calls[0] as [string, RequestInit];
    expect(new Headers(init.headers).get("authorization")).toBeNull();
  });
});
