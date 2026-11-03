import assert from "node:assert/strict";
import { createHash, createHmac } from "node:crypto";
import { test } from "node:test";
import twilio from "twilio";
import { sign } from "retell-sdk";
import { DEFAULT_RULES } from "../src/modules/communications/compliance";
import { LIVE_CALLING_ATTESTATION, liveCallBlockers, type DialFacts } from "../src/modules/communications/dial-policy";
import { ADAPTERS, SECRET_REF, webhookPath } from "../src/modules/communications/providers";
import { retellEndStatus } from "../src/modules/communications/providers/retell";
import { WebhookPayloadError } from "../src/modules/communications/providers/types";

// Synthetic credentials and identifiers only; nothing here reaches a provider.
const TOKEN = "test-auth-token-not-real-0123456789";
const URL_ = "https://estateos.example.test/api/communications/webhooks/twilio/0b5c2b9e-6a9c-4c8e-9a51-6c9a3f0f8a11";
const ACCOUNT = "AC" + "a".repeat(32);
const PARENT = "CA" + "1".repeat(32);
const CHILD = "CA" + "2".repeat(32);
const twilioForm = (params: Record<string, string>) => new URLSearchParams(params).toString();
const statusParams = (extra: Record<string, string> = {}) => ({CallSid: PARENT, AccountSid: ACCOUNT, From: "+971500000001", To: "+971500000002", CallStatus: "ringing", Direction: "outbound-api", ...extra});

test("Twilio webhooks verify with the official helper over the exact URL and parameters", async () => {
  const adapter = ADAPTERS.TWILIO;
  const params = statusParams();
  const signature = twilio.getExpectedTwilioSignature(TOKEN, URL_, params);
  const request = {rawBody: twilioForm(params), contentType: "application/x-www-form-urlencoded", signature, url: URL_};
  assert.equal(await adapter.verifyWebhook(request, TOKEN), true);
  assert.equal(await adapter.verifyWebhook({...request, signature: null}, TOKEN), false, "missing signature");
  assert.equal(await adapter.verifyWebhook({...request, signature: signature.slice(0, -2) + "AA"}, TOKEN), false, "forged signature");
  assert.equal(await adapter.verifyWebhook(request, TOKEN + "x"), false, "another account's token");
  assert.equal(await adapter.verifyWebhook({...request, url: URL_.replace("twilio", "retell")}, TOKEN), false, "another URL (another connection)");
  assert.equal(await adapter.verifyWebhook({...request, rawBody: twilioForm({...params, CallStatus: "completed"})}, TOKEN), false, "tampered status");
  assert.equal(await adapter.verifyWebhook({...request, rawBody: request.rawBody + "&CallStatus=completed"}, TOKEN), false, "a repeated parameter is refused");
  assert.equal(await adapter.verifyWebhook(request, ""), false, "no credential, no acceptance");

  const json = JSON.stringify({CallSid: PARENT, AccountSid: ACCOUNT, CallStatus: "completed"});
  const jsonUrl = `${URL_}?bodySHA256=${createHash("sha256").update(json).digest("hex")}`;
  const jsonRequest = {rawBody: json, contentType: "application/json", signature: twilio.getExpectedTwilioSignature(TOKEN, jsonUrl, {}), url: jsonUrl};
  assert.equal(await adapter.verifyWebhook(jsonRequest, TOKEN), true, "JSON bodies use bodySHA256");
  assert.equal(await adapter.verifyWebhook({...jsonRequest, rawBody: json.replace("completed", "busy")}, TOKEN), false, "a JSON body that no longer matches its hash");
});

test("Twilio events map both click-to-call legs to one EstateOS call", () => {
  const parse = (params: Record<string, string>) => ADAPTERS.TWILIO.parseWebhook({rawBody: twilioForm(params), contentType: "application/x-www-form-urlencoded", signature: "x", url: URL_});
  const [agentLeg] = parse(statusParams({CallStatus: "in-progress"}));
  assert.equal(agentLeg.leg, "AGENT");
  assert.equal(agentLeg.status, "IN_PROGRESS");
  assert.equal(agentLeg.providerCallId, PARENT);
  assert.equal(agentLeg.eventKey, `${PARENT}:in-progress`);
  const [customerLeg] = parse({...statusParams({CallSid: CHILD, ParentCallSid: PARENT, Direction: "outbound-dial", CallStatus: "completed", CallDuration: "125"})});
  assert.equal(customerLeg.leg, "CUSTOMER");
  assert.equal(customerLeg.providerCallId, PARENT, "the customer leg is matched to the call EstateOS started");
  assert.equal(customerLeg.status, "COMPLETED");
  assert.equal(customerLeg.durationSeconds, 125);
  assert.equal(customerLeg.direction, "OUTBOUND");
  const [inbound] = parse(statusParams({Direction: "inbound", CallStatus: "no-answer"}));
  assert.equal(inbound.direction, "INBOUND");
  assert.equal(inbound.status, "NO_ANSWER");
  assert.equal(parse(statusParams({CallStatus: "something-new"}))[0].status, null, "unknown statuses change nothing");
  const [recording] = parse(statusParams({RecordingSid: "RE" + "3".repeat(32), RecordingStatus: "completed", RecordingDuration: "60"}));
  assert.equal(recording.kind, "RECORDING");
  assert.equal(recording.eventKey, `recording:RE${"3".repeat(32)}:completed`);
  assert.throws(() => parse({CallSid: "CA123", AccountSid: ACCOUNT}), WebhookPayloadError);
  assert.throws(() => parse({CallSid: PARENT, AccountSid: "nope"}), WebhookPayloadError);
});

test("Retell webhooks verify with the SDK and reject tampering, other keys and replays older than five minutes", async () => {
  const adapter = ADAPTERS.RETELL;
  const body = JSON.stringify({event: "call_ended", call: {call_id: "call_test_0001", agent_id: "agent_test_0001", call_type: "phone_call", call_status: "ended", direction: "inbound",
    from_number: "+971500000003", to_number: "+971500000004", start_timestamp: 1_790_000_000_000, end_timestamp: 1_790_000_090_000, duration_ms: 90_000, disconnection_reason: "user_hangup"}});
  const signature = await sign(body, TOKEN);
  const request = {rawBody: body, contentType: "application/json", signature, url: "https://estateos.example.test/x"};
  assert.equal(await adapter.verifyWebhook(request, TOKEN), true);
  assert.equal(await adapter.verifyWebhook({...request, rawBody: body.replace("inbound", "outbound")}, TOKEN), false, "tampered body");
  assert.equal(await adapter.verifyWebhook(request, TOKEN + "x"), false, "another API key");
  assert.equal(await adapter.verifyWebhook({...request, signature: null}, TOKEN), false);
  const old = Date.now() - 6 * 60_000;
  const stale = `v=${old},d=${createHmac("sha256", TOKEN).update(body + old).digest("hex")}`;
  assert.equal(await adapter.verifyWebhook({...request, signature: stale}, TOKEN), false, "a replay older than five minutes");

  const [event] = adapter.parseWebhook(request);
  assert.equal(event.eventKey, "call_test_0001:call_ended");
  assert.equal(event.status, "COMPLETED");
  assert.equal(event.direction, "INBOUND");
  assert.equal(event.durationSeconds, 90);
  assert.equal(event.accountId, "agent_test_0001");
  assert.equal(retellEndStatus("dial_no_answer", false), "NO_ANSWER");
  assert.equal(retellEndStatus("voicemail_reached", true), "NO_ANSWER", "a voicemail is not the customer answering");
  assert.equal(retellEndStatus("dial_busy", false), "BUSY");
  assert.equal(retellEndStatus("dial_failed", false), "FAILED");
  assert.equal(retellEndStatus("error_unknown", false), "FAILED");
  assert.equal(retellEndStatus("agent_hangup", true), "COMPLETED");
  assert.equal(adapter.parseWebhook({...request, rawBody: JSON.stringify({event: "call_started", call: {call_id: "call_test_0002", call_type: "phone_call"}})})[0].status, "IN_PROGRESS");
  assert.deepEqual(adapter.parseWebhook({...request, rawBody: JSON.stringify({event: "call_started", call: {call_id: "call_test_0003", call_type: "web_call"}})}), [], "web calls are not phone calls");
  assert.throws(() => adapter.parseWebhook({...request, rawBody: JSON.stringify({event: "unknown", call: {call_id: "call_test_0004"}})}), WebhookPayloadError);
  assert.throws(() => adapter.parseWebhook({...request, rawBody: "not json"}), WebhookPayloadError);
  assert.equal(adapter.capabilities.outboundCalls, false, "EstateOS never starts AI phone calls");
  await assert.rejects(adapter.initiateCall({externalAccountId: null}, TOKEN, {from: "+971500000001", agentNumber: "+971500000002", customerNumber: "+971500000003", statusCallbackUrl: URL_}));
});

test("PBX and other providers accept no webhooks and place no calls until a verified integration exists", async () => {
  for (const type of ["PBX", "OTHER_APPROVED_PROVIDER"] as const) {
    const adapter = ADAPTERS[type];
    assert.equal(await adapter.verifyWebhook({rawBody: "{}", contentType: "application/json", signature: "anything", url: URL_}, TOKEN), false);
    assert.equal(adapter.capabilities.outboundCalls, false);
    assert.equal(adapter.capabilities.verifiedWebhooks, false);
    assert.equal((await adapter.verifyCredentials({externalAccountId: "x"}, TOKEN)).ok, false);
  }
  assert.ok(SECRET_REF.test("COMMS_TWILIO_MAIN_AUTH"));
  for (const bad of ["ANTHROPIC_API_KEY", "COMMS_", "comms_twilio", "COMMS_X;rm", "FIREBASE_TOKEN"]) assert.equal(SECRET_REF.test(bad), false, bad);
  assert.equal(webhookPath("TWILIO", "abc"), "/api/communications/webhooks/twilio/abc");
});

test("live calling needs a verified provider, a current attestation, an active registered line and capacity", () => {
  const ready: DialFacts = {
    connection: {connectionStatus: "VERIFIED", capabilities: ADAPTERS.TWILIO.capabilities}, secretAvailable: true, publicOrigin: "https://estateos.example.test",
    rules: {...DEFAULT_RULES, liveCallingAttestedAt: "2026-11-03T08:00:00Z", liveCallingAttestationVersion: LIVE_CALLING_ATTESTATION.version},
    line: {status: "ACTIVE", registrationConfirmedAt: "2026-11-03T08:00:00Z", forwardToNumber: "+971500000005"},
    activeCompanyCalls: 0, agentHasActiveCall: false, agentCallsToday: 0,
  };
  assert.deepEqual(liveCallBlockers(ready), []);
  assert.deepEqual(liveCallBlockers({...ready, connection: null}), ["NO_VERIFIED_PROVIDER"]);
  assert.deepEqual(liveCallBlockers({...ready, connection: {connectionStatus: "CONFIGURED", capabilities: ADAPTERS.TWILIO.capabilities}}), ["NO_VERIFIED_PROVIDER"]);
  assert.deepEqual(liveCallBlockers({...ready, connection: {connectionStatus: "VERIFIED", capabilities: ADAPTERS.RETELL.capabilities}}), ["PROVIDER_CANNOT_DIAL"]);
  assert.deepEqual(liveCallBlockers({...ready, secretAvailable: false}), ["SECRET_MISSING"]);
  assert.deepEqual(liveCallBlockers({...ready, publicOrigin: "http://localhost:3000"}), ["PUBLIC_ORIGIN_MISSING"]);
  assert.deepEqual(liveCallBlockers({...ready, rules: {...ready.rules, liveCallingAttestedAt: null}}), ["NOT_ATTESTED"]);
  assert.deepEqual(liveCallBlockers({...ready, rules: {...ready.rules, liveCallingAttestationVersion: "2020-01-01"}}), ["ATTESTATION_OUTDATED"]);
  assert.deepEqual(liveCallBlockers({...ready, line: null}), ["NO_ACTIVE_LINE"]);
  assert.deepEqual(liveCallBlockers({...ready, line: {...ready.line!, registrationConfirmedAt: null, forwardToNumber: null}}), ["LINE_NOT_REGISTERED", "NO_FORWARDING_NUMBER"]);
  assert.deepEqual(liveCallBlockers({...ready, activeCompanyCalls: 5, agentHasActiveCall: true, agentCallsToday: 60}), ["COMPANY_CONCURRENCY_LIMIT", "AGENT_ON_A_CALL", "AGENT_DAILY_LIMIT"]);
  assert.equal(liveCallBlockers({...ready, connection: null, secretAvailable: false, rules: DEFAULT_RULES, line: null, publicOrigin: null}).length, 4, "the defaults block live calling");
});
