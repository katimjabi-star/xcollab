import { AnthropicAdapter, createChatGateway, type ModelAdapter } from "@xcollab/ai-gateway";
import { bootServer } from "./boot.ts";
import type { WhatsAppChannelOptions } from "./routes-whatsapp.ts";

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

/**
 * WhatsApp channel (Meta Cloud API) — enabled only when the full env quintet
 * is present. WHATSAPP_USER_MAP maps E.164 digits to usernames; the dev-realm
 * password grant mints per-user bearers for read tools (a dedicated Keycloak
 * service client replaces this before any production rollout).
 */
function whatsAppChannelFromEnv(): { whatsapp: WhatsAppChannelOptions } | undefined {
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const rawMap = process.env.WHATSAPP_USER_MAP;
  const password = process.env.WHATSAPP_USER_PASSWORD;
  if (!verifyToken || !accessToken || !phoneNumberId || !rawMap || !password) return undefined;
  const issuer = process.env.KEYCLOAK_ISSUER ?? "http://localhost:8081/realms/xcollab";
  const appSecret = process.env.WHATSAPP_APP_SECRET;
  return {
    whatsapp: {
      verifyToken,
      accessToken,
      phoneNumberId,
      userMap: JSON.parse(rawMap) as Record<string, string>,
      ...(appSecret ? { appSecret } : {}),
      workspaceId: process.env.WHATSAPP_WORKSPACE ?? "hq",
      mintAuthorization: async (username) => {
        const res = await fetch(`${issuer}/protocol/openid-connect/token`, {
          method: "POST",
          headers: { "content-type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            grant_type: "password",
            client_id: "xcollab-web",
            username,
            password,
          }).toString(),
        });
        if (!res.ok) throw new Error(`token grant failed: HTTP ${res.status}`);
        const json = (await res.json()) as { access_token: string };
        return `Bearer ${json.access_token}`;
      },
    },
  };
}

const channels = whatsAppChannelFromEnv();

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
  ...(channels ? { channels } : {}),
});
