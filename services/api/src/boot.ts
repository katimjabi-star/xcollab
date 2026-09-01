import { randomUUID } from "node:crypto";
import { serve } from "@hono/node-server";
import { Pool } from "pg";
import { AiGateway, type ModelAdapter } from "@xcollab/ai-gateway/src/gateway.ts";
import type { ChatAdapter } from "@xcollab/ai-gateway/src/chat.ts";
import { createApp } from "./app.ts";
import { migrate } from "./db/migrate.ts";
import { WorkGraphRepository } from "./repository.ts";
import type { X4AuthOptions } from "./routes-x4auth.ts";
import { AttachmentStore } from "./storage.ts";

/**
 * A build profile (Charter invariant 3) is exactly what its entry module
 * wires in: entry-connected.ts and entry-sovereign.ts each construct their
 * own adapters and hand them here. This module imports NO adapter — only the
 * gateway seams — so a bundle contains only what its entry imported.
 */
export interface ServerProfile {
  name: "connected" | "sovereign";
  modelPlane: ModelAdapter[];
  chatPlane: { adapter: ChatAdapter; label: string };
  /** Optional outbound channels (connected profile only, e.g. WhatsApp). */
  channels?: Parameters<typeof createApp>[4];
}

/**
 * Katim ID (X4Auth) push login is profile-independent, so it is wired from
 * env here rather than per entry. X4AUTH_MODE=mock fakes device approval
 * (POC/demo); the live trio X4AUTH_BASE_URL + X4AUTH_CLIENT_ID +
 * X4AUTH_CLIENT_SECRET enables the real upstream. Neither → password only.
 */
function x4authFromEnv(): X4AuthOptions | undefined {
  const emailDomain = process.env.X4AUTH_EMAIL_DOMAIN;
  if (process.env.X4AUTH_MODE === "mock") {
    return { mode: "mock", ...(emailDomain ? { emailDomain } : {}) };
  }
  const baseUrl = process.env.X4AUTH_BASE_URL;
  const clientId = process.env.X4AUTH_CLIENT_ID;
  const clientSecret = process.env.X4AUTH_CLIENT_SECRET;
  if (!baseUrl || !clientId || !clientSecret) return undefined;
  return {
    mode: "live",
    baseUrl: baseUrl.replace(/\/+$/, ""),
    clientId,
    clientSecret,
    ...(process.env.X4AUTH_SCOPE ? { scope: process.env.X4AUTH_SCOPE } : {}),
    ...(emailDomain ? { emailDomain } : {}),
  };
}

export async function bootServer(profile: ServerProfile): Promise<void> {
  const adminUrl =
    process.env.DATABASE_URL ?? "postgres://xcollab:xcollab_dev_only@localhost:5432/xcollab";
  const appUrl =
    process.env.APP_DATABASE_URL ?? "postgres://xcollab_app:app_dev_only@localhost:5432/xcollab";
  const port = Number(process.env.PORT ?? 4000);

  const admin = new Pool({ connectionString: adminUrl });
  await migrate(admin);
  await admin.end();

  const store = new AttachmentStore();
  await store.ensureBucket();

  const repo = new WorkGraphRepository(new Pool({ connectionString: appUrl }));

  // XCollab AI chat plane (spec §2.6/§2.7): the boot nonce authenticates the
  // in-process executor dispatch for ai-actor ledger attribution — process
  // memory only, never logged, never in env.
  const assistantNonce = randomUUID();

  const x4auth = x4authFromEnv();
  const app = createApp(
    repo,
    new AiGateway(profile.modelPlane),
    store,
    { adapter: profile.chatPlane.adapter, nonce: assistantNonce },
    { ...profile.channels, ...(x4auth ? { x4auth } : {}) },
  );

  serve({ fetch: app.fetch, port });
  console.log(
    `xcollab api listening on :${port} [${profile.name}]` +
      ` — model plane: ${profile.modelPlane[0]?.id ?? "deterministic-synthesizer"}` +
      ` — chat plane: ${profile.chatPlane.label}` +
      (profile.channels?.whatsapp ? " — channels: whatsapp" : "") +
      (x4auth ? ` — x4auth: ${x4auth.mode}` : ""),
  );
}
