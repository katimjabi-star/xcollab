import { createHmac, timingSafeEqual } from "node:crypto";
import type { Hono } from "hono";
import type { AssistantEvent, Language } from "@xcollab/core";
import {
  ASSISTANT_READ_TOOL_SPECS,
  buildChatSystemPrompt,
  type ChatAdapter,
} from "@xcollab/ai-gateway";
import type { AuthEnv } from "./auth.ts";
import { ProposalStore } from "./assistant-proposals.ts";
import type { AssistantConfig } from "./assistant-actor.ts";
import { runAssistantLoop } from "./assistant-loop.ts";

/**
 * WhatsApp channel bridge (Meta Cloud API, connected profile only).
 *
 * Inbound webhook messages from mapped phone numbers run the assistant loop
 * with READ tools only — this surface cannot mutate or even propose (the
 * structural confirm gate stays in the product UI). Replies and project-start
 * notifications go out through the Graph API. The webhook itself is public
 * (Meta calls it), authenticated by the verify token + HMAC app signature.
 */

export interface WhatsAppChannelOptions {
  verifyToken: string;
  accessToken: string;
  phoneNumberId: string;
  /** Meta app secret; when set, X-Hub-Signature-256 is enforced. */
  appSecret?: string;
  /** E.164 digits (no +) -> XCollab username. Unmapped senders are ignored. */
  userMap: Record<string, string>;
  workspaceId: string;
  /** Mints a bearer for internal read-tool calls on behalf of the user. */
  mintAuthorization: (username: string) => Promise<string>;
  graphBaseUrl?: string;
  fetchImpl?: typeof fetch;
}

interface WhatsAppChannelDeps extends WhatsAppChannelOptions {
  adapter: ChatAdapter;
  proposals: ProposalStore;
}

export interface WhatsAppChannelHandle {
  notifyProgramCreated(programName: string, workspaceId: string): void;
}

/**
 * One-call wiring for createApp: owns the ProposalStore and registers the
 * webhook (pre-auth position is the caller's responsibility) when configured.
 */
export function wireWhatsAppChannel(
  app: Hono<AuthEnv>,
  assistant: AssistantConfig | undefined,
  options: WhatsAppChannelOptions | undefined,
): { proposals?: ProposalStore; whatsapp?: WhatsAppChannelHandle } {
  if (!assistant) return {};
  const proposals = new ProposalStore();
  if (!options) return { proposals };
  const whatsapp = registerWhatsAppChannel(app, {
    ...options,
    adapter: assistant.adapter,
    proposals,
  });
  return { proposals, whatsapp };
}

const MESSAGE_CHUNK = 3_800;
const MAX_REPLY_CHUNKS = 3;
const SEEN_CAP = 500;

const ARABIC = /[؀-ۿ]/u;

interface InboundMessage {
  id: string;
  from: string;
  text: string;
}

function toInbound(raw: unknown): InboundMessage | undefined {
  const msg = raw as { id?: string; from?: string; type?: string; text?: { body?: string } };
  if (msg.type !== "text" || !msg.id || !msg.from || !msg.text?.body) return undefined;
  return { id: msg.id, from: msg.from, text: msg.text.body };
}

function extractTextMessages(payload: unknown): InboundMessage[] {
  const entries = (payload as { entry?: unknown[] })?.entry ?? [];
  return entries
    .flatMap((entry) => (entry as { changes?: unknown[] })?.changes ?? [])
    .flatMap((change) => (change as { value?: { messages?: unknown[] } })?.value?.messages ?? [])
    .map(toInbound)
    .filter((message): message is InboundMessage => message !== undefined);
}

function signatureValid(secret: string, rawBody: string, header: string | undefined): boolean {
  if (!header?.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  const given = header.slice("sha256=".length);
  if (given.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(given, "utf8"), Buffer.from(expected, "utf8"));
}

export function registerWhatsAppChannel(
  app: Hono<AuthEnv>,
  deps: WhatsAppChannelDeps,
): WhatsAppChannelHandle {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const graphBase = deps.graphBaseUrl ?? "https://graph.facebook.com/v20.0";
  const seen = new Set<string>();

  async function sendText(to: string, body: string): Promise<void> {
    const chunks: string[] = [];
    for (let at = 0; at < body.length && chunks.length < MAX_REPLY_CHUNKS; at += MESSAGE_CHUNK) {
      chunks.push(body.slice(at, at + MESSAGE_CHUNK));
    }
    for (const chunk of chunks) {
      const res = await fetchImpl(`${graphBase}/${deps.phoneNumberId}/messages`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${deps.accessToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to,
          type: "text",
          text: { body: chunk },
        }),
      });
      // Status only — Graph error bodies can echo message content.
      if (!res.ok) console.error(`whatsapp send failed: HTTP ${res.status}`);
    }
  }

  async function answer(message: InboundMessage, username: string): Promise<void> {
    const language: Language = ARABIC.test(message.text) ? "ar" : "en";
    const authorization = await deps.mintAuthorization(username);
    const today = new Date().toISOString().slice(0, 10);
    const parts: string[] = [];
    const emit = async (event: AssistantEvent): Promise<void> => {
      if (event.type === "text_delta") parts.push(event.text);
    };
    await runAssistantLoop(
      {
        adapter: deps.adapter,
        tools: [...ASSISTANT_READ_TOOL_SPECS],
        system: buildChatSystemPrompt({
          language,
          today,
          workspaceId: deps.workspaceId,
          username,
        }),
        proposals: deps.proposals,
        reads: { app, authorization, workspaceId: deps.workspaceId, today },
        workspaceId: deps.workspaceId,
        username,
        emit,
      },
      [{ role: "user", content: message.text }],
    );
    const text = parts.join("").trim();
    await sendText(message.from, text.length > 0 ? text : fallbackReply(language));
  }

  function handleInbound(message: InboundMessage): void {
    if (seen.has(message.id)) return;
    if (seen.size >= SEEN_CAP) seen.clear();
    seen.add(message.id);
    const username = deps.userMap[message.from] ?? deps.userMap[`+${message.from}`];
    if (!username) return; // unmapped senders are silently ignored
    void answer(message, username).catch((error) => {
      console.error(`whatsapp turn failed: ${error instanceof Error ? error.message : "error"}`);
      void sendText(message.from, fallbackReply(ARABIC.test(message.text) ? "ar" : "en"));
    });
  }

  // Meta webhook verification handshake (public by design).
  app.get("/api/channels/whatsapp/webhook", (c) => {
    const mode = c.req.query("hub.mode");
    const token = c.req.query("hub.verify_token");
    const challenge = c.req.query("hub.challenge") ?? "";
    if (mode === "subscribe" && token === deps.verifyToken) return c.text(challenge);
    return c.text("forbidden", 403);
  });

  app.post("/api/channels/whatsapp/webhook", async (c) => {
    const raw = await c.req.text();
    const signature = c.req.header("x-hub-signature-256");
    if (deps.appSecret && !signatureValid(deps.appSecret, raw, signature)) {
      return c.json({ error: "invalid_signature" }, 403);
    }
    let payload: unknown;
    try {
      payload = JSON.parse(raw);
    } catch {
      return c.json({ error: "invalid_payload" }, 400);
    }
    // Ack fast (Meta retries slow webhooks); answers are sent asynchronously.
    for (const message of extractTextMessages(payload)) handleInbound(message);
    return c.json({ ok: true });
  });

  return {
    notifyProgramCreated(programName, workspaceId) {
      if (workspaceId !== deps.workspaceId) return;
      for (const phone of Object.keys(deps.userMap)) {
        void sendText(phone.replace(/^\+/u, ""), `🚀 New project started: ${programName}`).catch(
          () => {},
        );
      }
    },
  };
}

function fallbackReply(language: Language): string {
  return language === "ar"
    ? "عذراً — تعذّرت معالجة رسالتك الآن. حاول مرة أخرى."
    : "Sorry — I couldn't process that right now. Please try again.";
}
