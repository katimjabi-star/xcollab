import { ChatGateway, type ChatAdapter } from "./chat.ts";
import { DeterministicChatAdapter } from "./adapters/deterministic-chat.ts";
import { OpenRouterChatAdapter } from "./adapters/openrouter.ts";
import { createAnthropicAdapter } from "./adapters/anthropic-router.ts";

/**
 * Boot-time adapter selection — spec §2.7: preference order is Anthropic
 * (direct, cost-routed) when ANTHROPIC_API_KEY is present, then OpenRouter
 * when OPENROUTER_API_KEY is present, then the deterministic adapter, which
 * is always last and always registered (air-gapped / no-key path).
 * services/api reads the env vars and passes the keys in; they are never
 * read from env here.
 */
export function createChatGateway(options: {
  anthropicApiKey?: string;
  anthropicSimpleModel?: string;
  anthropicComplexModel?: string;
  openRouterApiKey?: string;
  openRouterModelId?: string;
  today?: string;
} = {}): ChatGateway {
  const deterministic = new DeterministicChatAdapter(
    options.today === undefined ? {} : { today: options.today },
  );
  const adapters: ChatAdapter[] = [];
  if (options.anthropicApiKey) {
    adapters.push(
      createAnthropicAdapter({
        apiKey: options.anthropicApiKey,
        ...(options.anthropicSimpleModel === undefined
          ? {}
          : { simpleModel: options.anthropicSimpleModel }),
        ...(options.anthropicComplexModel === undefined
          ? {}
          : { complexModel: options.anthropicComplexModel }),
      }),
    );
  }
  if (options.openRouterApiKey) {
    adapters.push(
      new OpenRouterChatAdapter({
        apiKey: options.openRouterApiKey,
        ...(options.openRouterModelId === undefined ? {} : { modelId: options.openRouterModelId }),
      }),
    );
  }
  adapters.push(deterministic);
  return new ChatGateway(adapters);
}
