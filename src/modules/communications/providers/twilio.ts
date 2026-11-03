import twilio from "twilio";
import type { CallStatus } from "../model";
import { normalizeCallNumber } from "../phone";
import { WebhookPayloadError, type ProviderCallEvent, type TelephonyAdapter } from "./types";

/*
 * Twilio Programmable Voice (docs/TELEPHONY_PROVIDERS.md#twilio).
 * Webhooks: X-Twilio-Signature, validated with the official helper over the
 * exact public URL and the form parameters (validateRequestWithBody for JSON
 * bodies carrying bodySHA256). Click-to-call: Twilio rings the agent's phone
 * from the company line, then <Dial>s the customer; the customer leg's status
 * callbacks carry ParentCallSid, so both legs map to one EstateOS call.
 */

const ACCOUNT_SID = /^AC[0-9a-f]{32}$/;
const CALL_SID = /^CA[0-9a-f]{32}$/;
const RECORDING_SID = /^RE[0-9a-f]{32}$/;

const STATUS: Record<string, CallStatus> = {
  queued: "INITIATED", initiated: "INITIATED", ringing: "RINGING", "in-progress": "IN_PROGRESS",
  completed: "COMPLETED", busy: "BUSY", failed: "FAILED", "no-answer": "NO_ANSWER", canceled: "CANCELLED",
};

function formParams(rawBody: string): Record<string, string> {
  const params: Record<string, string> = {};
  for (const [key, value] of new URLSearchParams(rawBody)) {
    if (key in params) throw new WebhookPayloadError(`Repeated parameter ${key}.`);
    params[key] = value;
  }
  return params;
}

const isJson = (contentType: string) => contentType.toLowerCase().includes("application/json");

function parse(rawBody: string, contentType: string): ProviderCallEvent[] {
  let params: Record<string, string>;
  if (isJson(contentType)) {
    let body: unknown;
    try { body = JSON.parse(rawBody); } catch { throw new WebhookPayloadError("The body is not JSON."); }
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new WebhookPayloadError("The body is not an object.");
    params = Object.fromEntries(Object.entries(body as Record<string, unknown>).filter(([, value]) => typeof value === "string" || typeof value === "number").map(([key, value]) => [key, String(value)]));
  } else {
    params = formParams(rawBody);
  }
  const callSid = params.CallSid ?? "";
  const accountSid = params.AccountSid ?? "";
  if (!CALL_SID.test(callSid) || !ACCOUNT_SID.test(accountSid)) throw new WebhookPayloadError("Missing or malformed CallSid or AccountSid.");
  const parent = params.ParentCallSid && CALL_SID.test(params.ParentCallSid) ? params.ParentCallSid : null;
  const twilioDirection = params.Direction ?? "";
  const occurred = params.Timestamp ? Date.parse(params.Timestamp) : NaN;
  const common = {
    providerCallId: parent ?? callSid,
    accountId: accountSid,
    direction: twilioDirection === "inbound" ? "INBOUND" as const : twilioDirection.startsWith("outbound") ? "OUTBOUND" as const : null,
    // The leg EstateOS started rings the agent ("outbound-api"); everything else is the customer's leg.
    leg: twilioDirection === "outbound-api" ? "AGENT" as const : "CUSTOMER" as const,
    from: normalizeCallNumber(params.From), to: normalizeCallNumber(params.To),
    occurredAt: Number.isFinite(occurred) ? new Date(occurred).toISOString() : null,
  };
  if (params.RecordingSid) {
    if (!RECORDING_SID.test(params.RecordingSid)) throw new WebhookPayloadError("Malformed RecordingSid.");
    return [{...common, eventKey: `recording:${params.RecordingSid}:${params.RecordingStatus ?? ""}`, kind: "RECORDING", status: null,
      durationSeconds: Number.isInteger(Number(params.RecordingDuration)) ? Number(params.RecordingDuration) : null, detail: params.RecordingStatus ?? null}];
  }
  const rawStatus = params.CallStatus ?? "";
  const duration = Number(params.CallDuration ?? params.DialCallDuration);
  return [{...common, eventKey: `${callSid}:${rawStatus}`, kind: "CALL_STATUS", status: STATUS[rawStatus] ?? null,
    durationSeconds: Number.isInteger(duration) && duration >= 0 ? duration : null, detail: rawStatus || null}];
}

export const twilioAdapter: TelephonyAdapter = {
  type: "TWILIO",
  label: "Twilio Programmable Voice",
  capabilities: {outboundCalls: true, endCall: true, statusEvents: true, inboundEvents: true, recordingEvents: true, transcripts: false, voiceAgent: false, verifiedWebhooks: true},
  signatureHeader: "x-twilio-signature",
  accountIdLabel: "Account SID (starts with AC)",
  accountIdPattern: ACCOUNT_SID,

  async verifyWebhook(request, authToken) {
    if (!request.signature || !authToken) return false;
    try {
      return isJson(request.contentType)
        ? twilio.validateRequestWithBody(authToken, request.signature, request.url, request.rawBody)
        : twilio.validateRequest(authToken, request.signature, request.url, formParams(request.rawBody));
    } catch {
      return false;
    }
  },

  parseWebhook(request) {
    return parse(request.rawBody, request.contentType);
  },

  webhookResponse() {
    return {body: "<?xml version=\"1.0\" encoding=\"UTF-8\"?><Response/>", contentType: "text/xml"};
  },

  async verifyCredentials(account, authToken) {
    const sid = account.externalAccountId ?? "";
    if (!ACCOUNT_SID.test(sid)) return {ok: false, note: "Enter the Twilio Account SID (it starts with AC)."};
    const result = await twilio(sid, authToken).api.v2010.accounts(sid).fetch();
    return result.status === "active" ? {ok: true, note: "Twilio confirmed the account is active."} : {ok: false, note: `Twilio reports the account as ${result.status}.`};
  },

  async initiateCall(account, authToken, request) {
    const sid = account.externalAccountId ?? "";
    const response = new twilio.twiml.VoiceResponse();
    const dial = response.dial({callerId: request.from, answerOnBridge: true, timeout: 30});
    dial.number({statusCallback: request.statusCallbackUrl, statusCallbackMethod: "POST", statusCallbackEvent: ["initiated", "ringing", "answered", "completed"]}, request.customerNumber);
    const call = await twilio(sid, authToken).calls.create({
      to: request.agentNumber, from: request.from, twiml: response.toString(), timeout: 30,
      statusCallback: request.statusCallbackUrl, statusCallbackMethod: "POST", statusCallbackEvent: ["initiated", "ringing", "answered", "completed"],
    });
    return {providerCallId: call.sid};
  },

  async endCall(account, authToken, providerCallId) {
    if (!CALL_SID.test(providerCallId)) throw new WebhookPayloadError("Malformed CallSid.");
    await twilio(account.externalAccountId ?? "", authToken).calls(providerCallId).update({status: "completed"});
  },
};
