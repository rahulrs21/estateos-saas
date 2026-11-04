import { createHmac, timingSafeEqual } from "node:crypto";
import type { DeliveryStatus, MessageType } from "../model";
import { WebhookPayloadError, type ChannelAdapter, type NormalizedEvent, type WebhookRequest } from "./types";

/*
 * Meta WhatsApp Business Cloud API (docs/WHATSAPP_INTEGRATION_PLAN.md).
 * Implemented in Phase 7A: webhook signature verification (X-Hub-Signature-256,
 * HMAC-SHA256 of the exact body with the app secret), the subscription
 * handshake (hub.mode / hub.verify_token / hub.challenge) and normalization of
 * message and status events. Not implemented: sending, media download and
 * connection checks, which need a verified business account (Phase 7B).
 */

const MAX_EVENTS = 100;
/** Events dated further in the future than this are refused (clock skew allowance). */
const FUTURE_SKEW_MS = 5 * 60_000;

const STATUS: Record<string, DeliveryStatus> = {sent: "SENT", delivered: "DELIVERED", read: "READ", failed: "FAILED"};
const TYPES: Record<string, MessageType> = {text: "TEXT", image: "IMAGE", document: "DOCUMENT", audio: "AUDIO", video: "VIDEO", sticker: "IMAGE", template: "TEMPLATE", button: "TEXT", interactive: "TEXT"};

export function whatsappSignature(rawBody: string, appSecret: string) {
  return "sha256=" + createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex");
}

const str = (value: unknown, max: number) => typeof value === "string" ? value.slice(0, max) : null;
const seconds = (value: unknown, now: number) => {
  const number = typeof value === "string" ? Number(value) : typeof value === "number" ? value : NaN;
  if (!Number.isFinite(number) || number <= 0) return null;
  const ms = number * 1000;
  if (ms > now + FUTURE_SKEW_MS) throw new WebhookPayloadError("Event timestamp is in the future.");
  return new Date(ms).toISOString();
};

export const whatsappAdapter: ChannelAdapter = {
  provider: "WHATSAPP_CLOUD", channel: "WHATSAPP", label: "WhatsApp Business Cloud API",
  capabilities: {
    VALIDATE_CONNECTION: "PLANNED", RECEIVE_EVENTS: "SUPPORTED", NORMALIZE_MESSAGE: "SUPPORTED", SYNC_HISTORY: "UNSUPPORTED",
    SEND_MESSAGE: "PLANNED", DELIVERY_RECEIPTS: "SUPPORTED", RESOLVE_MESSAGE_ID: "SUPPORTED", HEALTH_CHECK: "PLANNED", DISCONNECT: "PLANNED",
  },
  signatureHeader: "x-hub-signature-256",

  verifyWebhook(request: WebhookRequest, secret: string) {
    const header = request.headers["x-hub-signature-256"];
    if (!header || !secret || !/^sha256=[0-9a-f]{64}$/.test(header)) return false;
    const expected = Buffer.from(whatsappSignature(request.rawBody, secret));
    const actual = Buffer.from(header);
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  },

  handshake(url: URL, verifyToken: string) {
    if (url.searchParams.get("hub.mode") !== "subscribe" || !verifyToken) return null;
    const token = url.searchParams.get("hub.verify_token") ?? "";
    const a = Buffer.from(token), b = Buffer.from(verifyToken);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    const challenge = url.searchParams.get("hub.challenge") ?? "";
    return /^[A-Za-z0-9_-]{1,200}$/.test(challenge) ? challenge : null;
  },

  parseWebhook(request: WebhookRequest) {
    let body: unknown;
    try { body = JSON.parse(request.rawBody); } catch { throw new WebhookPayloadError("The body is not JSON."); }
    const root = body as {object?: unknown; entry?: unknown};
    if (root.object !== "whatsapp_business_account" || !Array.isArray(root.entry)) throw new WebhookPayloadError("Not a WhatsApp Business Account event.");
    const events: NormalizedEvent[] = [];
    for (const entry of root.entry.slice(0, 20) as Array<{changes?: unknown}>) {
      for (const change of (Array.isArray(entry.changes) ? entry.changes : []).slice(0, 20) as Array<{field?: unknown; value?: Record<string, unknown>}>) {
        if (change.field !== "messages" || !change.value) continue;
        const value = change.value;
        const accountId = str((value.metadata as {phone_number_id?: unknown} | undefined)?.phone_number_id, 64);
        if (!accountId) throw new WebhookPayloadError("Missing phone_number_id.");
        const businessNumber = str((value.metadata as {display_phone_number?: unknown} | undefined)?.display_phone_number, 32);
        const names = new Map<string, string>();
        for (const contact of (Array.isArray(value.contacts) ? value.contacts : []).slice(0, 50) as Array<{wa_id?: unknown; profile?: {name?: unknown}}>) {
          const id = str(contact.wa_id, 32), name = str(contact.profile?.name, 160);
          if (id && name) names.set(id, name);
        }
        for (const message of (Array.isArray(value.messages) ? value.messages : []).slice(0, MAX_EVENTS) as Array<Record<string, unknown>>) {
          const id = str(message.id, 200), from = str(message.from, 32);
          if (!id || !from) continue;
          const rawType = str(message.type, 30) ?? "unknown";
          const type = TYPES[rawType] ?? "UNKNOWN";
          const part = message[rawType] as Record<string, unknown> | undefined;
          const text = rawType === "text" ? str((part as {body?: unknown} | undefined)?.body, 8000)
            : rawType === "button" ? str((part as {text?: unknown} | undefined)?.text, 8000)
            : str(part?.caption, 8000) ?? (type === "UNKNOWN" ? `[Unsupported WhatsApp message type: ${rawType}]` : null);
          const mediaId = part && typeof part.id === "string" ? part.id.slice(0, 200) : null;
          events.push({
            kind: "MESSAGE", accountId, channel: "WHATSAPP", externalMessageId: id, threadId: `wa:+${from.replace(/\D/g, "")}`, from: {phone: `+${from.replace(/\D/g, "")}`, name: names.get(from) ?? null},
            to: businessNumber, subject: null, messageType: type, text, timestamp: seconds(message.timestamp, request.now),
            attachments: mediaId ? [{providerMediaId: mediaId, mimeType: str(part?.mime_type, 100) ?? "application/octet-stream", fileName: str(part?.filename, 200), sizeBytes: null}] : [],
          });
        }
        for (const status of (Array.isArray(value.statuses) ? value.statuses : []).slice(0, MAX_EVENTS) as Array<Record<string, unknown>>) {
          const id = str(status.id, 200), raw = str(status.status, 40) ?? "";
          if (!id) continue;
          const errors = Array.isArray(status.errors) ? status.errors as Array<{code?: unknown}> : [];
          events.push({kind: "STATUS", accountId, externalMessageId: id, status: STATUS[raw] ?? "UNKNOWN", raw, timestamp: seconds(status.timestamp, request.now),
            errorCode: errors[0]?.code != null ? String(errors[0].code).slice(0, 40) : null});
        }
      }
    }
    return events.slice(0, MAX_EVENTS);
  },
};
