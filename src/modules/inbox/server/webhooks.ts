import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { after } from "next/server";
import { enforceRateLimit, requestClientIp } from "@/lib/rate-limit/server";
import { getAppOrigin } from "@/modules/auth/server/config";
import { stableUuid } from "@/modules/automations/ids";
import { isDuplicate, sdk, serverDataConnect } from "@/modules/communications/server/data";
import { readBody } from "@/modules/communications/server/webhooks";
import { canonicalUuid } from "@/modules/organizations/server/identifiers";
import { ADAPTERS, WEBHOOK_SLUGS } from "../adapters";
import { WebhookPayloadError, type NormalizedEvent, type WebhookRequest } from "../adapters/types";
import type { ChannelProvider, DeliveryStatus } from "../model";
import { deliveryTransition, eventRetry } from "../policy";
import { VERIFY_TOKEN_SUFFIX, readInboxSecret } from "./connections";
import { ingestInbound } from "./ingest";
import { fetchPendingWhatsAppMedia } from "./whatsapp-media";

/*
 * Verified inbox webhooks and durable events (docs/INBOX_SECURITY.md#webhooks).
 * 1. The connection is found by the ID in the URL; the company comes from it,
 *    never from the payload.
 * 2. The adapter verifies the signature with the secret the connection names,
 *    over the exact raw body.
 * 3. Every account in the payload must be the connection's account.
 * 4. Each normalized event is recorded once (unique key) before it is applied:
 *    provider retries and replays are no-ops.
 * 5. A failed application is retried by the worker with growing delays, then
 *    left DEAD. The provider still gets 200 once the event is recorded.
 * Responses never say why a request was refused beyond the status code.
 */

const MAX_BODY_BYTES = 256 * 1024;
const MAX_EVENT_JSON = 12_000;
const STALE_RECEIVED_MS = 2 * 60_000;
const WEBHOOK_RULES = {
  connection: {scope: "inbox.webhook.connection", limit: 600, windowSeconds: 60},
  ip: {scope: "inbox.webhook.ip", limit: 1200, windowSeconds: 60},
};

export interface EventConnection { organizationId: string; id: string; provider: ChannelProvider }
export type EventOutcome =
  | {status: "PROCESSED"; result: string; created?: boolean; conversationId?: string | null; messageId?: string | null}
  | {status: "DUPLICATE"; conversationId?: string | null}
  | {status: "FAILED" | "DEAD"; errorCode: string};

const reject = (status: number) => new Response(null, {status, headers: {"Cache-Control": "no-store"}});
const log = (event: string, detail: Record<string, unknown>) => console.warn(JSON.stringify({event: `inbox.webhook.${event}`, ...detail}));
const sha256 = (value: string) => createHash("sha256").update(value, "utf8").digest("hex");

async function findConnection(slug: string, rawConnectionId: string) {
  const provider = WEBHOOK_SLUGS[slug];
  let id: string;
  try { id = canonicalUuid(rawConnectionId); } catch { return null; }
  if (!provider) return null;
  const row = (await sdk.inboxWebhookConnection(serverDataConnect(), {id})).data.connections[0];
  if (!row || row.provider !== provider || row.connectionStatus === "DISABLED" || row.connectionStatus === "NOT_CONFIGURED") return null;
  // An adapter that cannot receive events yet (Gmail, Microsoft 365 in Phase 7A) accepts nothing.
  if (ADAPTERS[provider].capabilities.RECEIVE_EVENTS !== "SUPPORTED") return null;
  return {organizationId: canonicalUuid(row.organizationId), id, provider, credentialReference: row.credentialReference ?? null, externalAccountReference: row.externalAccountReference ?? null};
}

async function limited(request: Request, connectionId: string) {
  try {
    await enforceRateLimit([{rule: WEBHOOK_RULES.connection, subject: connectionId}, {rule: WEBHOOK_RULES.ip, subject: requestClientIp(request) ?? "unknown"}], "Too many requests.");
    return false;
  } catch { return true; }
}

/** The subscription handshake (WhatsApp: hub.mode, hub.verify_token, hub.challenge). */
export async function inboxWebhookHandshake(request: Request, slug: string, rawConnectionId: string): Promise<Response> {
  const connection = await findConnection(slug, rawConnectionId);
  if (!connection) return reject(404);
  if (await limited(request, connection.id)) return reject(429);
  const token = readInboxSecret(connection.credentialReference ? `${connection.credentialReference}${VERIFY_TOKEN_SUFFIX}` : null);
  if (!token) { log("verify_token_missing", {connectionId: connection.id}); return reject(503); }
  const challenge = ADAPTERS[connection.provider].handshake(new URL(request.url), token);
  if (challenge === null) { log("handshake_rejected", {connectionId: connection.id}); return reject(403); }
  return new Response(challenge, {status: 200, headers: {"Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store"}});
}

export async function inboxWebhookResponse(request: Request, slug: string, rawConnectionId: string): Promise<Response> {
  const connection = await findConnection(slug, rawConnectionId);
  if (!connection) return reject(404);
  if (await limited(request, connection.id)) return reject(429);
  const rawBody = await readBody(request, MAX_BODY_BYTES);
  if (rawBody === null) return reject(413);
  const adapter = ADAPTERS[connection.provider];
  const secret = readInboxSecret(connection.credentialReference);
  if (!secret) { log("secret_missing", {connectionId: connection.id}); return reject(503); }

  const url = new URL(request.url);
  const headers: Record<string, string | null> = {};
  if (adapter.signatureHeader) headers[adapter.signatureHeader] = request.headers.get(adapter.signatureHeader);
  const webhookRequest: WebhookRequest = {rawBody, contentType: request.headers.get("content-type") ?? "", headers, url: `${getAppOrigin()}${url.pathname}${url.search}`, now: Date.now()};
  if (!adapter.verifyWebhook(webhookRequest, secret)) { log("signature_rejected", {connectionId: connection.id, provider: connection.provider}); return reject(401); }

  let events: NormalizedEvent[];
  try { events = adapter.parseWebhook(webhookRequest); } catch (error) {
    if (error instanceof WebhookPayloadError) { log("payload_rejected", {connectionId: connection.id, reason: error.message}); return reject(400); }
    throw error;
  }
  if (!connection.externalAccountReference || events.some(event => event.accountId !== connection.externalAccountReference)) { log("account_mismatch", {connectionId: connection.id}); return reject(403); }
  const digest = sha256(rawBody);
  // Recording failures (the database is unreachable) give 500, so the provider delivers again.
  for (const event of events) await receiveEvent(connection, event, {payloadDigest: digest, simulated: false});
  // Phase 7B.2: photos and documents are downloaded just after Meta has its answer (the worker retries anything left).
  if (connection.provider === "WHATSAPP_CLOUD" && events.some(event => event.kind === "MESSAGE" && event.attachments.length > 0)) {
    after(() => fetchPendingWhatsAppMedia().then(() => undefined, error => console.warn(JSON.stringify({event: "inbox.media.after_failed", name: error instanceof Error ? error.name : typeof error}))));
  }
  return new Response(null, {status: 200, headers: {"Cache-Control": "no-store"}});
}

/** One key per provider event: a message once, each receipt status once. */
export function eventDedupKey(connectionId: string, event: NormalizedEvent) {
  const detail = event.kind === "MESSAGE" ? event.externalMessageId : `${event.externalMessageId}|${event.raw}`;
  return `${event.kind.toLowerCase()}:${sha256(`${connectionId}|${detail}`)}`;
}

/** The normalized event as stored for retries, bounded by shortening the text if needed. */
function storedJson(connection: EventConnection, event: NormalizedEvent) {
  let copy = event;
  for (;;) {
    const json = JSON.stringify({provider: connection.provider, event: copy});
    if (json.length <= MAX_EVENT_JSON || copy.kind !== "MESSAGE" || !copy.text) return json.slice(0, MAX_EVENT_JSON);
    copy = {...copy, text: copy.text.slice(0, Math.max(0, copy.text.length - (json.length - MAX_EVENT_JSON) - 16))};
  }
}

/** Records a verified event once, then applies it. A duplicate is not applied again. */
export async function receiveEvent(connection: EventConnection, event: NormalizedEvent, options: {payloadDigest: string | null; simulated: boolean}): Promise<EventOutcome & {eventId: string | null}> {
  const id = randomUUID();
  try {
    await sdk.recordInboxEvent(serverDataConnect(), {
      organizationId: connection.organizationId, id, hasConnection: true, channelConnectionId: connection.id, kind: event.kind, dedupKey: eventDedupKey(connection.id, event),
      payloadDigest: options.payloadDigest, normalizedJson: storedJson(connection, event), simulated: options.simulated,
    });
  } catch (error) {
    if (isDuplicate(error)) return {status: "DUPLICATE", eventId: null};
    throw error;
  }
  return {...await applyRecorded(connection, id, 0, event, options.simulated), eventId: id};
}

async function applyRecorded(connection: EventConnection, eventId: string, attempts: number, event: NormalizedEvent, simulated: boolean): Promise<EventOutcome> {
  const dc = serverDataConnect();
  const organizationId = connection.organizationId;
  const complete = async (status: "PROCESSED" | "DUPLICATE" | "DEAD", errorCode: string | null, conversationId: string | null = null, messageId: string | null = null) => {
    await sdk.completeInboxEvent(dc, {organizationId, id: eventId, status: sdk.InboxEventStatus[status], errorCode, conversationId, messageId});
  };
  try {
    if (event.kind === "MESSAGE") {
      const result = await ingestInbound({
        organizationId, channelConnectionId: connection.id, channel: event.channel, externalThreadId: event.threadId, externalMessageId: event.externalMessageId,
        from: event.from, to: event.to, subject: event.subject, messageType: event.messageType, content: event.text, providerTimestamp: event.timestamp, simulated,
        internetMessageId: event.internetMessageId ?? null, referral: event.channel === "WHATSAPP" ? event.referral ?? null : null, ...(event.link ? {link: event.link} : {}),
      });
      if (result.status === "REJECTED") { await complete("DEAD", result.reason); return {status: "DEAD", errorCode: result.reason}; }
      if (result.status === "DUPLICATE") { await complete("DUPLICATE", null, result.conversationId); return {status: "DUPLICATE", conversationId: result.conversationId}; }
      await storeAttachmentRows(organizationId, result.conversationId, result.messageId, event);
      await complete("PROCESSED", null, result.conversationId, result.messageId);
      return {status: "PROCESSED", result: result.match, created: result.status === "CREATED", conversationId: result.conversationId, messageId: result.messageId};
    }
    const outcome = await applyDeliveryStatus(connection, event, simulated);
    await complete("PROCESSED", outcome.result, outcome.conversationId, outcome.messageId);
    return {status: "PROCESSED", ...outcome};
  } catch (error) {
    const errorCode = String((error as {code?: unknown})?.code ?? (error as Error)?.name ?? "ERROR").replace(/[^A-Za-z0-9_./-]/g, "_").slice(0, 64);
    log("event_failed", {eventId, errorCode});
    const retry = eventRetry(attempts, Date.now());
    if (retry.dead) { await complete("DEAD", errorCode).catch(() => undefined); return {status: "DEAD", errorCode}; }
    await sdk.failInboxEvent(dc, {organizationId, id: eventId, expectedAttempts: attempts, errorCode, nextAttemptAt: retry.nextAttemptAt}).catch(() => undefined);
    return {status: "FAILED", errorCode};
  }
}

/** Attachment rows for a stored message. Provider files are fetched only by a live connector (Phase 7B). */
async function storeAttachmentRows(organizationId: string, conversationId: string, messageId: string, event: Extract<NormalizedEvent, {kind: "MESSAGE"}>) {
  for (const [index, attachment] of event.attachments.slice(0, 10).entries()) {
    try {
      await sdk.createInboxAttachment(serverDataConnect(), {
        organizationId, id: attachment.stored?.attachmentId ?? stableUuid("inbox-attachment", organizationId, messageId, String(index)), messageId, conversationId,
        fileName: (attachment.fileName || `${event.messageType.toLowerCase()} attachment`).slice(0, 200), mimeType: attachment.mimeType.slice(0, 100), sizeBytes: attachment.sizeBytes ?? 0,
        storagePath: attachment.stored?.storagePath ?? null, providerMediaId: attachment.providerMediaId, scanStatus: sdk.InboxAttachmentScan.NOT_SCANNED,
      });
    } catch (error) {
      if (!isDuplicate(error)) throw error; // already stored by an earlier attempt
    }
  }
}

async function applyDeliveryStatus(connection: EventConnection, event: Extract<NormalizedEvent, {kind: "STATUS"}>, simulated: boolean) {
  const dc = serverDataConnect();
  const organizationId = connection.organizationId;
  for (let attempt = 0; attempt < 2; attempt++) {
    const message = (await sdk.inboxMessageByExternalId(dc, {organizationId, channelConnectionId: connection.id, externalMessageId: event.externalMessageId})).data.messages[0];
    // Receipts for messages EstateOS did not send (for example from the provider's own app) are not applied.
    if (!message) return {result: "UNMATCHED", conversationId: null, messageId: null};
    const ids = {conversationId: canonicalUuid(message.conversationId), messageId: canonicalUuid(message.id)};
    if (message.direction !== "OUTBOUND") return {result: "NOT_OUTBOUND", ...ids};
    const current = message.deliveryStatus as DeliveryStatus;
    const decision = deliveryTransition(current, event.status);
    if (!decision.apply && decision.reason !== "RAW_ONLY") return {result: decision.reason, ...ids};
    const next = decision.apply ? decision.status : current;
    try {
      await sdk.applyInboxDeliveryStatus(dc, {organizationId, id: ids.messageId, conversationId: ids.conversationId, expectedStatus: sdk.InboxDeliveryStatus[current],
        deliveryStatus: sdk.InboxDeliveryStatus[next], raw: (event.errorCode ? `${event.raw}:${event.errorCode}` : event.raw).slice(0, 40) || null, providerTimestamp: event.timestamp, emitFailed: next === "FAILED" && current !== "FAILED", simulated: simulated || message.simulated});
      return {result: decision.apply ? "APPLIED" : "RAW_ONLY", ...ids};
    } catch (error) {
      // Another receipt changed the message first: decide again against its new status.
      if (attempt === 0 && /INBOX_DELIVERY_CHANGED/.test(String((error as {message?: unknown})?.message ?? ""))) continue;
      throw error;
    }
  }
  return {result: "NO_CHANGE", conversationId: null, messageId: null};
}

/**
 * Worker tick (docs/AUTOMATION_OPERATIONS.md#worker): applies events whose
 * retry is due, and events an interrupted request left recorded but not
 * applied. Safe to repeat: ingestion and receipts are idempotent.
 */
export async function retryInboxEvents(limit = 25) {
  const now = Date.now();
  const due = (await sdk.pendingInboxEvents(serverDataConnect(), {now: new Date(now).toISOString(), staleBefore: new Date(now - STALE_RECEIVED_MS).toISOString(), limit})).data.events;
  const counts = {processed: 0, failed: 0, dead: 0};
  for (const row of due) {
    const organizationId = canonicalUuid(row.organizationId), id = canonicalUuid(row.id);
    let stored: {provider: ChannelProvider; event: NormalizedEvent} | null = null;
    try { stored = row.normalizedJson ? JSON.parse(row.normalizedJson) : null; } catch { stored = null; }
    if (!stored || !row.channelConnectionId) {
      await sdk.completeInboxEvent(serverDataConnect(), {organizationId, id, status: sdk.InboxEventStatus.DEAD, errorCode: "EVENT_UNREADABLE"}).catch(() => undefined);
      counts.dead += 1;
      continue;
    }
    const outcome = await applyRecorded({organizationId, id: canonicalUuid(row.channelConnectionId), provider: stored.provider}, id, row.attempts, stored.event, row.simulated);
    if (outcome.status === "FAILED") counts.failed += 1; else if (outcome.status === "DEAD") counts.dead += 1; else counts.processed += 1;
  }
  return counts;
}
