import { serve } from "@hono/node-server";
import { Pool } from "pg";
import { AiGateway, AnthropicAdapter, type ModelAdapter } from "@xcollab/ai-gateway";
import { createApp } from "./app.ts";
import { migrate } from "./db/migrate.ts";
import { WorkGraphRepository } from "./repository.ts";
import { AttachmentStore } from "./storage.ts";

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
const app = createApp(repo, new AiGateway(adapters), store);

serve({ fetch: app.fetch, port: PORT });
console.log(
  `xcollab api listening on :${PORT} — model plane: ${adapters[0]?.id ?? "deterministic-synthesizer"}`,
);
