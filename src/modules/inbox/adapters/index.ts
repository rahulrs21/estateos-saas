import type { ChannelProvider } from "../model";
import { refuseAll, type ChannelAdapter, type Capability, type CapabilityState } from "./types";
import { whatsappAdapter } from "./whatsapp";

/*
 * The adapter registry (docs/CHANNEL_ADAPTERS.md). Gmail and Microsoft 365 are
 * interfaces only in Phase 7A: they verify nothing and accept no events, so
 * their webhook routes refuse every request until the live connectors and
 * OAuth are built (Phase 7C, docs/EMAIL_INTEGRATION_PLAN.md).
 */

const notBuilt = (provider: ChannelProvider, channel: ChannelAdapter["channel"], label: string): ChannelAdapter => ({
  provider, channel, label, capabilities: refuseAll(), signatureHeader: null,
  verifyWebhook: () => false, handshake: () => null, parseWebhook: () => [],
});

const internal = (provider: ChannelProvider, channel: ChannelAdapter["channel"], label: string, capabilities: Partial<Record<Capability, CapabilityState>>): ChannelAdapter => ({
  ...notBuilt(provider, channel, label),
  capabilities: {...Object.fromEntries(Object.keys(refuseAll()).map(key => [key, "UNSUPPORTED"])) as Record<Capability, CapabilityState>, ...capabilities},
});

export const ADAPTERS: Record<ChannelProvider, ChannelAdapter> = {
  WHATSAPP_CLOUD: whatsappAdapter,
  // Gmail: Pub/Sub push (OIDC token) + history sync; Microsoft 365: Graph subscriptions (clientState, validationToken) + delta sync.
  GMAIL: notBuilt("GMAIL", "EMAIL", "Gmail (Google Workspace)"),
  MICROSOFT_365: notBuilt("MICROSOFT_365", "EMAIL", "Microsoft 365 / Outlook"),
  // Website enquiries arrive through the lead capture transaction, not a webhook.
  WEBSITE_FORM: internal("WEBSITE_FORM", "WEBSITE", "EstateOS website forms", {RECEIVE_EVENTS: "SUPPORTED", NORMALIZE_MESSAGE: "SUPPORTED"}),
  INTERNAL: internal("INTERNAL", "INTERNAL", "EstateOS", {}),
  // The developer simulator "sends" only to simulated conversations and reports simulated receipts (developer tools only).
  DEVELOPMENT_SIMULATOR: internal("DEVELOPMENT_SIMULATOR", "WHATSAPP", "Developer simulator", {RECEIVE_EVENTS: "SUPPORTED", NORMALIZE_MESSAGE: "SUPPORTED", SEND_MESSAGE: "SUPPORTED", DELIVERY_RECEIPTS: "SUPPORTED"}),
};

/** URL slugs of providers that accept webhooks in Phase 7A. */
export const WEBHOOK_SLUGS: Record<string, ChannelProvider> = {whatsapp: "WHATSAPP_CLOUD", gmail: "GMAIL", "microsoft-365": "MICROSOFT_365"};

/** Secret names a connection may reference (server environment or Secret Manager); never a value. */
export const CREDENTIAL_REFERENCE = /^INBOX_[A-Z0-9_]{3,56}$/;

/** Only the developer simulator may send in Phase 7A; real providers need Phase 7B/7C and explicit enablement. */
export const canSend = (provider: ChannelProvider) => ADAPTERS[provider].capabilities.SEND_MESSAGE === "SUPPORTED" && provider === "DEVELOPMENT_SIMULATOR";
