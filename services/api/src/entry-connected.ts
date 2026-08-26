import { AnthropicAdapter, createChatGateway, type ModelAdapter } from "@xcollab/ai-gateway";
import { bootServer } from "./boot.ts";

/**
 * CONNECTED build profile (Charter invariant 3): hosted model keys allowed,
 * synthetic data only. Adapter preference: Anthropic (cost-routed) when a key
 * is configured, then OpenRouter, deterministic fallback always present.
 */

// Gitignored local secrets (ANTHROPIC_API_KEY / OPENROUTER_API_KEY). Real
// environment variables take precedence; absent file is fine (CI, fresh dev).
try {
  process.loadEnvFile(new URL("../.env.local", import.meta.url).pathname);
} catch {
  /* no .env.local */
}

const modelPlane: ModelAdapter[] = [];
const apiKey = process.env.ANTHROPIC_API_KEY;
if (apiKey) {
  modelPlane.push(new AnthropicAdapter({ apiKey }));
}

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

await bootServer({
  name: "connected",
  modelPlane,
  chatPlane: {
    adapter: {
      id: "chat-gateway",
      modelId: chatGateway.primary.modelId,
      runTurn: (req) => chatGateway.runTurn(req),
    },
    label: chatGateway.primary.id,
  },
});
