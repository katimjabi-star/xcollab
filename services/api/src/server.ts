import { randomUUID } from "node:crypto";
import { serve } from "@hono/node-server";
import { Pool } from "pg";
import {
  AiGateway,
  AnthropicAdapter,
  createChatGateway,
  type ChatAdapter,
  type ModelAdapter,
} from "@xcollab/ai-gateway";
import { createApp } from "./app.ts";
import { migrate } from "./db/migrate.ts";
import { WorkGraphRepository } from "./repository.ts";
import { AttachmentStore } from "./storage.ts";

// Gitignored local secrets (ANTHROPIC_API_KEY / OPENROUTER_API_KEY). Real
// environment variables take precedence; absent file is fine (CI, fresh dev).
try {
  process.loadEnvFile(new URL("../.env.local", import.meta.url).pathname);
} catch {
  /* no .env.local */
}

const ADMIN_URL =
  process.env.DATABASE_URL ?? "postgres://xcollab:xcollab_dev_only@localhost:5432/xcollab";
const APP_URL =
  process.env.APP_DATABASE_URL ?? "postgres://xcollab_app:app_dev_only@localhost:5432/xcollab";
const PORT = Number(process.env.PORT ?? 4000);

const adapters: ModelAdapter[] = [];
const apiKey = process.env.ANTHROPIC_API_KEY;
if (apiKey) {
  adapters.push(new AnthropicAdapter({ apiKey }));
}

const admin = new Pool({ connectionString: ADMIN_URL });
await migrate(admin);
await admin.end();

const store = new AttachmentStore();
await store.ensureBucket();

const repo = new WorkGraphRepository(new Pool({ connectionString: APP_URL }));

// XCollab AI chat plane (spec §2.6/§2.7): the boot nonce authenticates the
// in-process executor dispatch for ai-actor ledger attribution — process
// memory only, never logged, never in env. Adapter preference: Anthropic
// (cost-routed haiku/sonnet) when a key is configured, then OpenRouter,
// deterministic fallback always present.
const assistantNonce = randomUUID();
const openRouterApiKey = process.env.OPENROUTER_API_KEY;
const chatGateway = createChatGateway({
  ...(apiKey ? { anthropicApiKey: apiKey } : {}),
  ...(process.env.ANTHROPIC_SIMPLE_MODEL
    ? { anthropicSimpleModel: process.env.ANTHROPIC_SIMPLE_MODEL }
    : {}),
  ...(process.env.ANTHROPIC_COMPLEX_MODEL
    ? { anthropicComplexModel: process.env.ANTHROPIC_COMPLEX_MODEL }
    : {}),
  ...(openRouterApiKey ? { openRouterApiKey } : {}),
  ...(process.env.OPENROUTER_MODEL ? { openRouterModelId: process.env.OPENROUTER_MODEL } : {}),
});
const chatAdapter: ChatAdapter = {
  id: "chat-gateway",
  modelId: chatGateway.primary.modelId,
  runTurn: (req) => chatGateway.runTurn(req),
};

const app = createApp(repo, new AiGateway(adapters), store, {
  adapter: chatAdapter,
  nonce: assistantNonce,
});

serve({ fetch: app.fetch, port: PORT });
console.log(
  `xcollab api listening on :${PORT} — model plane: ${adapters[0]?.id ?? "deterministic-synthesizer"}` +
    ` — chat plane: ${chatGateway.primary.id}`,
);
