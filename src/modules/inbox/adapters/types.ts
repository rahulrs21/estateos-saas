import type { ChannelProvider, DeliveryStatus, InboxChannel, MessageType } from "../model";

/*
 * Channel adapters (docs/CHANNEL_ADAPTERS.md). One interface for every channel
 * provider; each adapter states which operations it supports. An adapter
 * existing never means a provider is connected: a connection is VERIFIED only
 * after a live check with the provider (Phase 7B/7C), and live sending stays
 * disabled in Phase 7A for every real provider.
 */

export const CAPABILITIES = [
  "VALIDATE_CONNECTION", "RECEIVE_EVENTS", "NORMALIZE_MESSAGE", "SYNC_HISTORY", "SEND_MESSAGE",
  "DELIVERY_RECEIPTS", "RESOLVE_MESSAGE_ID", "HEALTH_CHECK", "DISCONNECT",
] as const;
export type Capability = (typeof CAPABILITIES)[number];
/** SUPPORTED: implemented and tested. PLANNED: designed for a later phase, refused now. UNSUPPORTED: the provider has no such operation. */
export type CapabilityState = "SUPPORTED" | "PLANNED" | "UNSUPPORTED";

export interface WebhookRequest { rawBody: string; contentType: string; headers: Record<string, string | null>; url: string; now: number }

/** A provider file reference (fetched in Phase 7B), or a file EstateOS already stored and checked (the simulator). */
export interface NormalizedAttachment { providerMediaId: string | null; mimeType: string; fileName: string | null; sizeBytes: number | null; stored?: {attachmentId: string; storagePath: string} }

export type NormalizedEvent =
  | {kind: "MESSAGE"; accountId: string; channel: InboxChannel; externalMessageId: string; threadId: string; from: {phone?: string | null; email?: string | null; name?: string | null};
      to: string | null; subject: string | null; messageType: MessageType; text: string | null; timestamp: string | null; attachments: NormalizedAttachment[]}
  | {kind: "STATUS"; accountId: string; externalMessageId: string; status: DeliveryStatus; raw: string; timestamp: string | null; errorCode: string | null};

export class WebhookPayloadError extends Error {}

export interface ChannelAdapter {
  provider: ChannelProvider;
  channel: InboxChannel;
  label: string;
  capabilities: Record<Capability, CapabilityState>;
  /** The header carrying the signature, when the provider signs requests. */
  signatureHeader: string | null;
  /** Verifies a request with the connection's secret; never trusts anything in the body before this. */
  verifyWebhook(request: WebhookRequest, secret: string): boolean;
  /** The subscription handshake some providers make with a GET request (null when it does not match). */
  handshake(url: URL, verifyToken: string): string | null;
  /** Verified payload to normalized events (bounded; unknown parts are kept as UNKNOWN, never dropped silently). */
  parseWebhook(request: WebhookRequest): NormalizedEvent[];
  /** Delivers one message; only adapters with SEND_MESSAGE SUPPORTED have it. */
  send?(request: OutboundRequest): Promise<OutboundAck>;
}

export const refuseAll = (): Record<Capability, CapabilityState> => Object.fromEntries(CAPABILITIES.map(capability => [capability, "PLANNED"])) as Record<Capability, CapabilityState>;

/** One outbound message for an adapter that can send (Phase 7A: the developer simulator only). */
export interface OutboundRequest { conversationId: string; simulated: boolean; recipient: string; content: string }
/** The provider's acceptance: only this makes a queued message SENT. */
export type OutboundAck = {accepted: true; providerMessageId: string} | {accepted: false; reason: string};
