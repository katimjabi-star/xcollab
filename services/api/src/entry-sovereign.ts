import { ChatGateway } from "@xcollab/ai-gateway/src/chat.ts";
import { DeterministicChatAdapter } from "@xcollab/ai-gateway/src/adapters/deterministic-chat.ts";
import { OllamaAdapter } from "@xcollab/ai-gateway/src/adapters/ollama.ts";
import type { ModelAdapter } from "@xcollab/ai-gateway/src/gateway.ts";
import { bootServer } from "./boot.ts";

/**
 * SOVEREIGN build profile (Charter invariant 3): in-boundary inference only.
 * This entry imports the deterministic chat adapter and (optionally) the
 * Ollama program-synthesis adapter by their MODULE PATHS — never the package
 * index, never a factory that references hosted adapters — so the bundled
 * artifact cannot contain the Anthropic/OpenRouter adapter code. Enforced by
 * bin/verify-sovereign.sh against the bundle in the Docker build.
 */

const modelPlane: ModelAdapter[] = [];
const ollamaBaseUrl = process.env.OLLAMA_BASE_URL;
const ollamaModel = process.env.OLLAMA_MODEL;
if (ollamaBaseUrl && ollamaModel) {
  modelPlane.push(new OllamaAdapter({ modelId: ollamaModel, baseUrl: ollamaBaseUrl }));
}

const chatGateway = new ChatGateway([new DeterministicChatAdapter()]);

await bootServer({
  name: "sovereign",
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
