import { Retell, verify } from "retell-sdk";
import type { CallStatus } from "../model";
import { normalizeCallNumber } from "../phone";
import { ProviderNotSupportedError, WebhookPayloadError, type ProviderCallEvent, type TelephonyAdapter } from "./types";

/*
 * Retell AI (docs/TELEPHONY_PROVIDERS.md#retell). Used only for the future AI
 * voice assistant (docs/AI_VOICE_ARCHITECTURE.md), never to place agents'
 * calls: EstateOS does not start AI phone calls. Webhooks carry
 * X-Retell-Signature (v=<ms>,d=<hex HMAC-SHA256 of raw body + timestamp>),
 * verified with the SDK's verify(), which also rejects timestamps more than
 * five minutes away (replays). The secret is a Retell API key with webhook
 * access.
 */

const AGENT_ID = /^[A-Za-z0-9_-]{6,80}$/;
const EVENTS = ["call_started", "call_ended", "call_analyzed", "transcript_updated"] as const;
type RetellEvent = (typeof EVENTS)[number];

/** How a call ended (Retell's disconnection_reason) as an EstateOS connection status. */
export function retellEndStatus(reason: string | undefined, answered: boolean): CallStatus {
  switch (reason) {
    case "dial_no_answer": case "voicemail_reached": case "user_declined": return "NO_ANSWER";
    case "dial_busy": return "BUSY";
    case "registered_call_timeout": case "manual_stopped": return answered ? "COMPLETED" : "CANCELLED";
    case "dial_failed": case "invalid_destination": case "telephony_provider_permission_denied": case "telephony_provider_unavailable":
    case "sip_routing_error": case "network_blocked": case "marked_as_spam": case "concurrency_limit_reached": case "no_concurrency_fallback":
    case "no_valid_payment": case "credit_exhausted": case "budget_reached": case "scam_detected": return answered ? "COMPLETED" : "FAILED";
    default: return reason?.startsWith("error_") && !answered ? "FAILED" : "COMPLETED";
  }
}

const iso = (ms: unknown) => typeof ms === "number" && Number.isFinite(ms) && ms > 0 ? new Date(ms).toISOString() : null;

export const retellAdapter: TelephonyAdapter = {
  type: "RETELL",
  label: "Retell AI (voice assistant platform)",
  capabilities: {outboundCalls: false, endCall: false, statusEvents: true, inboundEvents: true, recordingEvents: true, transcripts: true, voiceAgent: true, verifiedWebhooks: true},
  signatureHeader: "x-retell-signature",
  accountIdLabel: "Retell agent ID",
  accountIdPattern: AGENT_ID,

  async verifyWebhook(request, apiKey) {
    if (!request.signature || !apiKey) return false;
    try { return await verify(request.rawBody, apiKey, request.signature); } catch { return false; }
  },

  parseWebhook(request) {
    let body: {event?: unknown; call?: Record<string, unknown>};
    try { body = JSON.parse(request.rawBody); } catch { throw new WebhookPayloadError("The body is not JSON."); }
    const event = body?.event;
    const call = body?.call;
    if (typeof event !== "string" || !EVENTS.includes(event as RetellEvent) || !call || typeof call !== "object") throw new WebhookPayloadError("Unknown Retell event.");
    const callId = typeof call.call_id === "string" ? call.call_id : "";
    if (!/^[A-Za-z0-9_-]{6,80}$/.test(callId)) throw new WebhookPayloadError("Missing or malformed call_id.");
    if (call.call_type !== undefined && call.call_type !== "phone_call") return [];
    const started = iso(call.start_timestamp), ended = iso(call.end_timestamp);
    const answered = Boolean(started) && call.call_status !== "not_connected";
    const reason = typeof call.disconnection_reason === "string" ? call.disconnection_reason : undefined;
    const kind = event === "call_analyzed" ? "ANALYSIS" : event === "transcript_updated" ? "TRANSCRIPT" : "CALL_STATUS";
    const status: CallStatus | null = event === "call_started" ? "IN_PROGRESS"
      : event === "call_ended" ? (call.call_status === "not_connected" ? "FAILED" : retellEndStatus(reason, answered))
      : null;
    const duration = typeof call.duration_ms === "number" && call.duration_ms >= 0 ? Math.round(call.duration_ms / 1000) : null;
    const event_: ProviderCallEvent = {
      eventKey: `${callId}:${event}`, kind, providerCallId: callId, accountId: typeof call.agent_id === "string" ? call.agent_id : null,
      direction: call.direction === "inbound" ? "INBOUND" : call.direction === "outbound" ? "OUTBOUND" : null, leg: "CUSTOMER",
      from: normalizeCallNumber(typeof call.from_number === "string" ? call.from_number : null), to: normalizeCallNumber(typeof call.to_number === "string" ? call.to_number : null),
      status, occurredAt: event === "call_started" ? started : ended ?? started, durationSeconds: event === "call_ended" ? duration : null, detail: reason ?? null,
    };
    return [event_];
  },

  webhookResponse() {
    return {body: "", contentType: "text/plain"};
  },

  async verifyCredentials(account, apiKey) {
    const agentId = account.externalAccountId ?? "";
    if (!AGENT_ID.test(agentId)) return {ok: false, note: "Enter the Retell agent ID used for the voice assistant."};
    const agent = await new Retell({apiKey}).agent.retrieve(agentId);
    return agent.agent_id === agentId ? {ok: true, note: "Retell confirmed the agent exists for this API key."} : {ok: false, note: "Retell did not return this agent."};
  },

  async initiateCall() { throw new ProviderNotSupportedError("starting calls"); },
  async endCall() { throw new ProviderNotSupportedError("ending calls"); },
};
