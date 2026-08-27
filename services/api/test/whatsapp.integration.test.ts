import { createHmac, randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import { AiGateway } from "@xcollab/ai-gateway";
import { migrate } from "../src/db/migrate.ts";
import { WorkGraphRepository } from "../src/repository.ts";
import { createApp } from "../src/app.ts";
import type { WhatsAppChannelOptions } from "../src/routes-whatsapp.ts";
import { getAccessToken } from "./keycloak.ts";
import { ScriptedChatAdapter } from "./assistant-helpers.ts";

const ADMIN_URL =
  process.env.DATABASE_URL ?? "postgres://xcollab:xcollab_dev_only@localhost:5432/xcollab";
const APP_URL =
  process.env.APP_DATABASE_URL ?? "postgres://xcollab_app:app_dev_only@localhost:5432/xcollab";

const WORKSPACE = `ws-whatsapp-${process.pid}`;
const SENDER = "971500000001";

let admin: Pool;
let appPool: Pool;
let repo: WorkGraphRepository;
let token: string;

interface SentMessage {
  url: string;
  auth: string | null;
  body: { to: string; text: { body: string } };
}

function captureFetch(sent: SentMessage[]): typeof fetch {
  return (async (url: string | URL | Request, init?: RequestInit) => {
    sent.push({
      url: String(url),
      auth: new Headers(init?.headers).get("authorization"),
      body: JSON.parse(String(init?.body)),
    });
    return new Response("{}", { status: 200 });
  }) as typeof fetch;
}

function buildApp(options: {
  script?: ScriptedChatAdapter;
  sent: SentMessage[];
  appSecret?: string;
}): ReturnType<typeof createApp> {
  const adapter =
    options.script ??
    new ScriptedChatAdapter([
      [
        { type: "text_delta", text: "All green — nothing overdue." },
        { type: "finish", reason: "stop" },
      ],
    ]);
  const whatsapp: WhatsAppChannelOptions = {
    verifyToken: "verify-me",
    accessToken: "graph-token",
    phoneNumberId: "555001",
    userMap: { [SENDER]: "jabbir" },
    workspaceId: WORKSPACE,
    mintAuthorization: async () => `Bearer ${token}`,
    graphBaseUrl: "https://graph.test",
    fetchImpl: captureFetch(options.sent),
    ...(options.appSecret ? { appSecret: options.appSecret } : {}),
  };
  return createApp(
    repo,
    new AiGateway([]),
    undefined,
    { adapter, nonce: randomUUID() },
    { whatsapp },
  );
}

function inbound(text: string, from = SENDER, id = randomUUID()): string {
  return JSON.stringify({
    entry: [{ changes: [{ value: { messages: [{ id, from, type: "text", text: { body: text } }] } }] }],
  });
}

async function postWebhook(
  app: ReturnType<typeof createApp>,
  body: string,
  headers: Record<string, string> = {},
): Promise<Response> {
  return app.request("/api/channels/whatsapp/webhook", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body,
  });
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 150));

beforeAll(async () => {
  admin = new Pool({ connectionString: ADMIN_URL });
  await migrate(admin);
  appPool = new Pool({ connectionString: APP_URL });
  repo = new WorkGraphRepository(appPool);
  token = await getAccessToken();
});

afterAll(async () => {
  await admin.end();
  await appPool.end();
});

describe("whatsapp channel", () => {
  it("answers Meta's verification handshake only with the right token", async () => {
    const app = buildApp({ sent: [] });
    const ok = await app.request(
      "/api/channels/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=verify-me&hub.challenge=echo-123",
    );
    expect(ok.status).toBe(200);
    expect(await ok.text()).toBe("echo-123");
    const bad = await app.request(
      "/api/channels/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=x",
    );
    expect(bad.status).toBe(403);
  });

  it("runs the assistant for a mapped sender and replies via the Graph API", async () => {
    const sent: SentMessage[] = [];
    const app = buildApp({ sent });
    const res = await postWebhook(app, inbound("what is the project status?"));
    expect(res.status).toBe(200);
    await settle();
    expect(sent).toHaveLength(1);
    expect(sent[0]?.url).toBe("https://graph.test/555001/messages");
    expect(sent[0]?.auth).toBe("Bearer graph-token");
    expect(sent[0]?.body.to).toBe(SENDER);
    expect(sent[0]?.body.text.body).toContain("All green");
  });

  it("ignores unmapped senders and duplicate message ids", async () => {
    const sent: SentMessage[] = [];
    const app = buildApp({ sent });
    await postWebhook(app, inbound("hello", "971509999999"));
    const id = randomUUID();
    await postWebhook(app, inbound("status?", SENDER, id));
    await postWebhook(app, inbound("status?", SENDER, id));
    await settle();
    expect(sent).toHaveLength(1);
  });

  it("rejects a bad HMAC signature when the app secret is configured", async () => {
    const sent: SentMessage[] = [];
    const app = buildApp({ sent, appSecret: "top-secret" });
    const body = inbound("status?");
    const bad = await postWebhook(app, body, { "x-hub-signature-256": "sha256=deadbeef" });
    expect(bad.status).toBe(403);
    const signature = createHmac("sha256", "top-secret").update(body, "utf8").digest("hex");
    const good = await postWebhook(app, body, { "x-hub-signature-256": `sha256=${signature}` });
    expect(good.status).toBe(200);
    await settle();
    expect(sent).toHaveLength(1);
  });

  it("notifies mapped numbers when a project starts in the channel workspace", async () => {
    const sent: SentMessage[] = [];
    const app = buildApp({ sent });
    const res = await app.request("/api/programs", {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({
        workspaceId: WORKSPACE,
        mission: "Stand up the WhatsApp channel pilot",
        language: "en",
      }),
    });
    expect(res.status).toBe(201);
    await settle();
    expect(sent).toHaveLength(1);
    expect(sent[0]?.body.to).toBe(SENDER);
    expect(sent[0]?.body.text.body).toContain("New project started");
  });
});
