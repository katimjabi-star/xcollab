import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, createProgram, getLedger, listPrograms } from "../lib/api-client.ts";

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

afterEach(() => vi.unstubAllGlobals());

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
});
