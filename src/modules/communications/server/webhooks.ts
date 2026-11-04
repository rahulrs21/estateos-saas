import "server-only";

import { randomUUID } from "node:crypto";
import { enforceRateLimit, requestClientIp } from "@/lib/rate-limit/server";
import { getAppOrigin } from "@/modules/auth/server/config";
import { canonicalUuid } from "@/modules/organizations/server/identifiers";
import { isFinal, statusChange, transition } from "../call-state";
import type { CallDirection, CallStatus } from "../model";
import { ADAPTERS } from "../providers";
import { WebhookPayloadError, type ProviderCallEvent, type ProviderType } from "../providers/types";
import { isDuplicate, sdk, serverDataConnect } from "./data";
import { readProviderSecret } from "./providers";

/*
 * Signed provider webhooks (docs/TELEPHONY_PROVIDERS.md#webhooks).
 * 1. The connection is found by the ID in the URL; the company comes from it.
 * 2. The signature is checked with that connection's own secret, over the
 *    public URL (APP_ORIGIN, never the Host header) and the raw body.
 * 3. The provider account in the payload must be the connection's account.
 * 4. Each event is recorded once (unique key): retries and replays are no-ops.
 * 5. Status changes go through the call state machine with compare-and-set,
 *    so late or out-of-order events cannot move a call backwards.
 * Responses never say why a request was refused beyond the status code.
 */

const MAX_BODY_BYTES = 64 * 1024;
const WEBHOOK_RULES = {
  connection: {scope: "communications.webhook.connection", limit: 600, windowSeconds: 60},
  ip: {scope: "communications.webhook.ip", limit: 1200, windowSeconds: 60},
};
const SLUGS: Record<string, ProviderType> = {twilio: "TWILIO", retell: "RETELL"};

type Connection = {organizationId: string; id: string; providerType: string; connectionStatus: string; secretRef?: string | null; externalAccountId?: string | null};
export type EventResult = "APPLIED" | "DUPLICATE" | "NO_CHANGE" | "FINAL" | "OUT_OF_ORDER" | "NOT_ALLOWED" | "UNMATCHED" | "NOT_ELIGIBLE" | "IGNORED";

const reject = (status: number) => new Response(null, {status, headers: {"Cache-Control": "no-store"}});
const log = (event: string, detail: Record<string, unknown>) => console.warn(JSON.stringify({event: `communications.webhook.${event}`, ...detail}));

async function readBody(request: Request): Promise<string | null> {
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_BODY_BYTES || !request.body) return declared > MAX_BODY_BYTES ? null : "";
  // Read with a running cap, so a body without a length (chunked) cannot grow without limit.
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const {done, value} = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BODY_BYTES) { await reader.cancel().catch(() => undefined); return null; }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder().decode(bytes);
}

export async function providerWebhookResponse(request: Request, slug: string, rawConnectionId: string): Promise<Response> {
  const type = SLUGS[slug];
  let connectionId: string;
  try { connectionId = canonicalUuid(rawConnectionId); } catch { return reject(404); }
  if (!type || !/^[0-9a-f-]{32,36}$/.test(connectionId)) return reject(404);
  try {
    await enforceRateLimit([{rule: WEBHOOK_RULES.connection, subject: connectionId}, {rule: WEBHOOK_RULES.ip, subject: requestClientIp(request) ?? "unknown"}], "Too many requests.");
  } catch { return reject(429); }

  const rawBody = await readBody(request);
  if (rawBody === null) return reject(413);
  const dc = serverDataConnect();
  const connection: Connection | undefined = (await sdk.providerConnectionForWebhook(dc, {id: connectionId})).data.connections[0];
  if (!connection || connection.providerType !== type || connection.connectionStatus === "DISABLED" || connection.connectionStatus === "NOT_CONFIGURED") return reject(404);
  const adapter = ADAPTERS[type];
  const secret = readProviderSecret(connection.secretRef);
  if (!secret) { log("secret_missing", {connectionId}); return reject(503); }

  const url = new URL(request.url);
  const webhookRequest = {rawBody, contentType: request.headers.get("content-type") ?? "", signature: adapter.signatureHeader ? request.headers.get(adapter.signatureHeader) : null, url: `${getAppOrigin()}${url.pathname}${url.search}`};
  if (!await adapter.verifyWebhook(webhookRequest, secret)) { log("signature_rejected", {connectionId, provider: type}); return reject(401); }

  let events: ProviderCallEvent[];
  try { events = adapter.parseWebhook(webhookRequest); } catch (error) {
    if (error instanceof WebhookPayloadError) { log("payload_rejected", {connectionId, reason: error.message}); return reject(400); }
    throw error;
  }
  if (!connection.externalAccountId || events.some(event => event.accountId !== connection.externalAccountId)) { log("account_mismatch", {connectionId}); return reject(403); }
  for (const event of events) await processProviderEvent(connection, event);
  const reply = adapter.webhookResponse();
  return new Response(reply.body, {status: 200, headers: {"Content-Type": reply.contentType, "Cache-Control": "no-store"}});
}

/** One verified event: recorded once, then applied to its call. */
export async function processProviderEvent(connection: Connection, event: ProviderCallEvent): Promise<EventResult> {
  const dc = serverDataConnect();
  const organizationId = connection.organizationId;
  const eventId = randomUUID();
  try {
    await sdk.recordCallProviderEvent(dc, {organizationId, id: eventId, providerConnectionId: connection.id, eventKey: event.eventKey.slice(0, 200), eventType: event.kind,
      providerCallId: event.providerCallId, callStatus: event.status ? sdk.CallStatus[event.status] : null, occurredAt: event.occurredAt});
  } catch (error) {
    if (isDuplicate(error)) return "DUPLICATE";
    throw error;
  }
  const mark = async (result: EventResult, callId: string | null = null) => {
    await sdk.markCallProviderEvent(dc, {organizationId, id: eventId, result, callId});
    return result;
  };
  // EstateOS does not ingest provider recordings, transcripts or analysis (docs/CALL_PRIVACY_COMPLIANCE.md#provider-recordings-and-transcripts).
  if (event.kind !== "CALL_STATUS") return mark("NOT_ELIGIBLE");
  if (!event.status) return mark("IGNORED");

  const inbound = event.direction === "INBOUND";
  const lineNumber = (inbound ? event.to : event.from) ?? "";
  const customerNumber = (inbound ? event.from : event.to) ?? "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const resolved = (await sdk.resolveProviderCall(dc, {organizationId, providerConnectionId: connection.id, providerCallId: event.providerCallId, lineNumber, customerNumber})).data;
    let call = resolved.calls[0];
    if (!call) {
      // Only incoming calls are created from events; EstateOS records outgoing calls when it starts them.
      const line = resolved.lines[0];
      if (!inbound || event.leg !== "CUSTOMER" || !line?.assignedMembershipId || line.assignedMembership?.status !== "ACTIVE" || !line.assignedMembership.userProfileUid) return mark("UNMATCHED");
      const contact = resolved.contacts.length === 1 ? resolved.contacts[0] : null;
      const lead = contact && contact.leads_on_contact.length === 1 ? contact.leads_on_contact[0] : null;
      const callId = randomUUID();
      try {
        await sdk.createIncomingProviderCall(dc, {organizationId, id: callId, providerConnectionId: connection.id, providerCallId: event.providerCallId, phoneLineId: line.id,
          agentMembershipId: line.assignedMembershipId, actorUid: line.assignedMembership.userProfileUid, callStatus: sdk.CallStatus.INITIATED, callerNumber: event.from,
          recipientNumber: line.phoneNumber, counterpartyNumber: event.from, contactId: contact?.id ?? null, leadId: lead?.id ?? null, startedAt: event.occurredAt ?? new Date().toISOString()});
      } catch (error) {
        if (!isDuplicate(error)) throw error;
        continue; // created by a concurrent delivery for the same call: resolve it again
      }
      call = {id: callId, callStatus: sdk.CallStatus.INITIATED, startedAt: event.occurredAt ?? new Date().toISOString(), answeredAt: null, revision: 1, direction: sdk.CallDirection.INBOUND, leadId: lead?.id ?? null, agentMembershipId: line.assignedMembershipId};
    }
    const current = call.callStatus as CallStatus;
    let next: CallStatus = event.status;
    if (event.leg === "AGENT") {
      // The leg ringing the agent: the customer's leg reports the call itself. If the agent never
      // connected (or hung up before the customer was dialled), the call ends as cancelled.
      if (!isFinal(next) || current !== "INITIATED") return mark("NO_CHANGE", call.id);
      next = "CANCELLED";
    }
    const decision = transition(current, next);
    if (!decision.apply) return mark(decision.reason === "DUPLICATE" ? "NO_CHANGE" : decision.reason, call.id);
    const at = event.occurredAt ?? new Date().toISOString();
    const change = statusChange(call as {direction: CallDirection; startedAt: string; answeredAt?: string | null}, next, at, event.durationSeconds);
    try {
      await sdk.applyProviderCallStatus(dc, {organizationId, id: call.id, expectedStatus: sdk.CallStatus[current], callStatus: sdk.CallStatus[next], answeredAt: change.answeredAt,
        endedAt: change.endedAt, durationSeconds: change.durationSeconds, emitFinal: change.trigger !== null, finalTrigger: change.trigger ?? "call.completed"});
      return mark("APPLIED", call.id);
    } catch (error) {
      // Another delivery changed the call first: decide again against its new status.
      if (attempt === 0 && /CALL_STATUS_CHANGED/.test(String((error as {message?: unknown})?.message ?? ""))) continue;
      throw error;
    }
  }
  return mark("NO_CHANGE");
}
