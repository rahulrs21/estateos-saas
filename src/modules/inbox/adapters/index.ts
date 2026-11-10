import type { ChannelProvider } from "../model";
import { refuseAll, type ChannelAdapter, type Capability, type CapabilityState, type OutboundAck, type OutboundRequest } from "./types";
import { whatsappAdapter } from "./whatsapp";

/*
 * The adapter registry (docs/CHANNEL_ADAPTERS.md). Gmail (Phase 7C.1) connects
 * through OAuth and is read by polling (server/mail-sync.ts), so it has no
 * webhook. Microsoft 365 is still an interface only (Phase 7C.2): it verifies
 * nothing and accepts no events.
 */

const notBuilt = (provider: ChannelProvider, channel: ChannelAdapter["channel"], label: string): ChannelAdapter => ({
  provider, channel, label, capabilities: refuseAll(), signatureHeader: null,
  verifyWebhook: () => false, handshake: () => null, parseWebhook: () => [],
});

const internal = (provider: ChannelProvider, channel: ChannelAdapter["channel"], label: string, capabilities: Partial<Record<Capability, CapabilityState>>): ChannelAdapter => ({
  ...notBuilt(provider, channel, label),
  capabilities: {...Object.fromEntries(Object.keys(refuseAll()).map(key => [key, "UNSUPPORTED"])) as Record<Capability, CapabilityState>, ...capabilities},
});

/**
 * The developer simulator's "delivery": nothing leaves EstateOS. It accepts only
 * simulated conversations (fictional senders) and answers with a simulated
 * provider message ID, so receipts can be simulated through the normal pipeline.
 */
async function simulatorSend(request: OutboundRequest): Promise<OutboundAck> {
  if (!request.simulated) return {accepted: false, reason: "The developer simulator only delivers to simulated conversations."};
  if (!request.content.trim()) return {accepted: false, reason: "Empty message."};
  return {accepted: true, providerMessageId: `simwamid.${globalThis.crypto.randomUUID()}`};
}

export const ADAPTERS: Record<ChannelProvider, ChannelAdapter> = {
  WHATSAPP_CLOUD: whatsappAdapter,
  // Gmail (7C.1): OAuth (server/google.ts, server/mailboxes.ts); no webhook. Microsoft 365: Graph subscriptions or delta sync (7C.2).
  GMAIL: {...notBuilt("GMAIL", "EMAIL", "Gmail (Google Workspace)"), capabilities: {...refuseAll(), VALIDATE_CONNECTION: "SUPPORTED", DISCONNECT: "SUPPORTED", RECEIVE_EVENTS: "SUPPORTED", NORMALIZE_MESSAGE: "SUPPORTED", DELIVERY_RECEIPTS: "UNSUPPORTED"}},
  MICROSOFT_365: notBuilt("MICROSOFT_365", "EMAIL", "Microsoft 365 / Outlook"),
  // Website enquiries arrive through the lead capture transaction, not a webhook.
  WEBSITE_FORM: internal("WEBSITE_FORM", "WEBSITE", "EstateOS website forms", {RECEIVE_EVENTS: "SUPPORTED", NORMALIZE_MESSAGE: "SUPPORTED"}),
  INTERNAL: internal("INTERNAL", "INTERNAL", "EstateOS", {}),
  // The developer simulator "sends" only to simulated conversations and reports simulated receipts (developer tools only).
  DEVELOPMENT_SIMULATOR: {
    ...internal("DEVELOPMENT_SIMULATOR", "WHATSAPP", "Developer simulator", {RECEIVE_EVENTS: "SUPPORTED", NORMALIZE_MESSAGE: "SUPPORTED", SEND_MESSAGE: "SUPPORTED", DELIVERY_RECEIPTS: "SUPPORTED"}),
    send: simulatorSend,
  },
};

/** URL slugs of providers with webhook routes. Gmail is polled (no webhook), so its old route answers 404. */
export const WEBHOOK_SLUGS: Record<string, ChannelProvider> = {whatsapp: "WHATSAPP_CLOUD", "microsoft-365": "MICROSOFT_365"};

/** Secret names a connection may reference (server environment or Secret Manager); never a value. */
export const CREDENTIAL_REFERENCE = /^INBOX_[A-Z0-9_]{3,56}$/;

/** Only the developer simulator may send in Phase 7A; real providers need Phase 7B/7C and explicit enablement. */
export const canSend = (provider: ChannelProvider) => ADAPTERS[provider].capabilities.SEND_MESSAGE === "SUPPORTED" && provider === "DEVELOPMENT_SIMULATOR";
