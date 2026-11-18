import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { test } from "node:test";
import { ADAPTERS, CREDENTIAL_REFERENCE, WEBHOOK_SLUGS, canSend } from "../src/modules/inbox/adapters";
import { WebhookPayloadError, type WebhookRequest } from "../src/modules/inbox/adapters/types";
import { whatsappAdapter, whatsappSignature } from "../src/modules/inbox/adapters/whatsapp";
import { attachmentFileName, attachmentPath, sniffAttachment } from "../src/modules/inbox/attachments";
import { MAX_EVENT_ATTEMPTS, deliveryTransition, eventRetry } from "../src/modules/inbox/policy";

// Test secrets and fictional numbers only (+44 7700 900xxx). Nothing here contacts a provider.
const SECRET = "test-app-secret-not-real-0001";
const NOW = Date.parse("2026-11-04T10:00:00Z");
const seconds = (iso: string) => String(Math.floor(Date.parse(iso) / 1000));

function payload(value: Record<string, unknown>) {
  return JSON.stringify({object: "whatsapp_business_account", entry: [{id: "WABA-TEST", changes: [{field: "messages", value: {messaging_product: "whatsapp", metadata: {display_phone_number: "447700900001", phone_number_id: "100000000000001"}, ...value}}]}]});
}
function request(rawBody: string, signature: string | null = whatsappSignature(rawBody, SECRET)): WebhookRequest {
  return {rawBody, contentType: "application/json", headers: {"x-hub-signature-256": signature}, url: "https://crm.example.test/api/inbox/webhooks/whatsapp/x", now: NOW};
}
const textMessage = payload({contacts: [{wa_id: "447700900123", profile: {name: "Layla Example"}}],
  messages: [{from: "447700900123", id: "wamid.TEST1", timestamp: seconds("2026-11-04T09:59:00Z"), type: "text", text: {body: "Is the Marina apartment available?"}}]});

test("WhatsApp signatures: HMAC-SHA256 of the exact body with the app secret, compared in constant time", () => {
  assert.equal(whatsappSignature("abc", "k"), "sha256=" + createHmac("sha256", "k").update("abc").digest("hex"));
  assert.equal(whatsappAdapter.verifyWebhook(request(textMessage), SECRET), true, "a correctly signed body is accepted");
  assert.equal(whatsappAdapter.verifyWebhook(request(textMessage), "another-secret-000000"), false, "another app's secret is refused");
  assert.equal(whatsappAdapter.verifyWebhook(request(textMessage.replace("Marina", "Marinb"), whatsappSignature(textMessage, SECRET)), SECRET), false, "a tampered body is refused");
  assert.equal(whatsappAdapter.verifyWebhook(request(textMessage, null), SECRET), false, "an unsigned request is refused");
  assert.equal(whatsappAdapter.verifyWebhook(request(textMessage, whatsappSignature(textMessage, SECRET).toUpperCase()), SECRET), false, "only the documented format is accepted");
  assert.equal(whatsappAdapter.verifyWebhook(request(textMessage, "sha256=" + "0".repeat(64)), SECRET), false);
  assert.equal(whatsappAdapter.verifyWebhook(request(textMessage), ""), false, "no secret, no verification");
});

test("the WhatsApp subscription handshake returns the challenge only for the right verify token", () => {
  const url = (query: string) => new URL(`https://crm.example.test/api/inbox/webhooks/whatsapp/x?${query}`);
  assert.equal(whatsappAdapter.handshake(url("hub.mode=subscribe&hub.verify_token=verify-token-1&hub.challenge=1158201444"), "verify-token-1"), "1158201444");
  assert.equal(whatsappAdapter.handshake(url("hub.mode=subscribe&hub.verify_token=wrong-token-1&hub.challenge=1158201444"), "verify-token-1"), null);
  assert.equal(whatsappAdapter.handshake(url("hub.mode=unsubscribe&hub.verify_token=verify-token-1&hub.challenge=1"), "verify-token-1"), null);
  assert.equal(whatsappAdapter.handshake(url("hub.mode=subscribe&hub.verify_token=verify-token-1&hub.challenge=%3Cscript%3E"), "verify-token-1"), null, "the challenge is echoed only when it is plain");
  assert.equal(whatsappAdapter.handshake(url("hub.mode=subscribe&hub.verify_token=&hub.challenge=1"), ""), null);
});

test("WhatsApp payloads normalize messages, media references, unknown types and receipts", () => {
  const [message] = whatsappAdapter.parseWebhook(request(textMessage));
  assert.deepEqual(message, {kind: "MESSAGE", accountId: "100000000000001", channel: "WHATSAPP", externalMessageId: "wamid.TEST1", threadId: "wa:+447700900123",
    from: {phone: "+447700900123", name: "Layla Example"}, to: "447700900001", subject: null, messageType: "TEXT", text: "Is the Marina apartment available?",
    timestamp: "2026-11-04T09:59:00.000Z", attachments: []});

  const media = whatsappAdapter.parseWebhook(request(payload({messages: [
    {from: "447700900124", id: "wamid.IMG", timestamp: seconds("2026-11-04T09:00:00Z"), type: "image", image: {id: "MEDIA-1", mime_type: "image/jpeg", caption: "The view"}},
    {from: "447700900124", id: "wamid.NEW", timestamp: seconds("2026-11-04T09:00:00Z"), type: "reaction_v9", reaction_v9: {}},
  ]})));
  assert.equal(media[0].kind === "MESSAGE" && media[0].text, "The view");
  assert.deepEqual(media[0].kind === "MESSAGE" && media[0].attachments, [{providerMediaId: "MEDIA-1", mimeType: "image/jpeg", fileName: null, sizeBytes: null}], "media is a reference; nothing is downloaded");
  assert.equal(media[1].kind === "MESSAGE" && media[1].messageType, "UNKNOWN", "an unknown type is kept, not dropped");
  assert.match(media[1].kind === "MESSAGE" ? media[1].text ?? "" : "", /Unsupported WhatsApp message type/);

  const receipts = whatsappAdapter.parseWebhook(request(payload({statuses: [
    {id: "wamid.OUT1", status: "delivered", timestamp: seconds("2026-11-04T09:30:00Z"), recipient_id: "447700900123"},
    {id: "wamid.OUT2", status: "failed", timestamp: seconds("2026-11-04T09:31:00Z"), errors: [{code: 131047, title: "Re-engagement message"}]},
    {id: "wamid.OUT3", status: "deleted_v2", timestamp: seconds("2026-11-04T09:32:00Z")},
  ]})));
  assert.deepEqual(receipts.map(item => item.kind === "STATUS" && [item.status, item.errorCode]), [["DELIVERED", null], ["FAILED", "131047"], ["UNKNOWN", null]]);
  assert.equal(receipts[2].kind === "STATUS" && receipts[2].raw, "deleted_v2", "an unrecognised status is kept as raw text");
});

test("malformed or implausible WhatsApp payloads are refused", () => {
  const refuse = (body: string, message: RegExp) => assert.throws(() => whatsappAdapter.parseWebhook(request(body)), (error: unknown) => error instanceof WebhookPayloadError && message.test(error.message));
  refuse("not json", /not JSON/);
  refuse(JSON.stringify({object: "page", entry: []}), /Not a WhatsApp/);
  refuse(JSON.stringify({object: "whatsapp_business_account", entry: [{changes: [{field: "messages", value: {messages: []}}]}]}), /phone_number_id/);
  refuse(payload({messages: [{from: "447700900123", id: "wamid.F", timestamp: seconds("2026-11-04T11:00:00Z"), type: "text", text: {body: "from the future"}}]}), /future/);
  const many = payload({messages: Array.from({length: 150}, (_, index) => ({from: "447700900123", id: `wamid.M${index}`, timestamp: seconds("2026-11-04T09:00:00Z"), type: "text", text: {body: "x"}}))});
  assert.equal(whatsappAdapter.parseWebhook(request(many)).length, 100, "events per request are bounded");
});

test("capabilities are explicit, and adapters existing never means connected or able to send", () => {
  // Phase 7C: Gmail (7C.1) and Microsoft 365 (7C.2) connect through OAuth and are polled; they have no webhook, so nothing is ever verified or parsed from one.
  for (const provider of ["GMAIL", "MICROSOFT_365"] as const) {
    assert.equal(ADAPTERS[provider].capabilities.VALIDATE_CONNECTION, "SUPPORTED");
    assert.equal(ADAPTERS[provider].capabilities.SEND_MESSAGE, "SUPPORTED");
    assert.equal(ADAPTERS[provider].capabilities.DELIVERY_RECEIPTS === "SUPPORTED", false, "email has no delivery receipts");
    assert.equal(Object.values(WEBHOOK_SLUGS).includes(provider), false, `${provider} has no webhook route`);
    assert.equal(ADAPTERS[provider].send, undefined, "mailbox sending is server-only, never through the registry");
  }
  for (const provider of ["GMAIL", "MICROSOFT_365"] as const) {
    const adapter = ADAPTERS[provider];
    assert.equal(adapter.verifyWebhook(request(textMessage), SECRET), false, `${provider} verifies no webhook`);
    assert.deepEqual(adapter.parseWebhook(request(textMessage)), []);
  }
  // Phase 7B.1: WhatsApp check and send are built, but sending is decided on the server (verified, enabled, test recipients), never by the adapter registry.
  assert.equal(ADAPTERS.WHATSAPP_CLOUD.capabilities.SEND_MESSAGE, "SUPPORTED");
  assert.equal(ADAPTERS.WHATSAPP_CLOUD.capabilities.VALIDATE_CONNECTION, "SUPPORTED");
  assert.equal(ADAPTERS.WHATSAPP_CLOUD.send, undefined, "the shared adapter has no send; the server-only Cloud API client does");
  assert.deepEqual((Object.keys(ADAPTERS) as Array<keyof typeof ADAPTERS>).filter(canSend), ["DEVELOPMENT_SIMULATOR"], "the registry alone lets only the developer simulator send");
  assert.ok(CREDENTIAL_REFERENCE.test("INBOX_WHATSAPP_APP_SECRET"));
  for (const bad of ["inbox_lower", "COMMS_TWILIO_TOKEN", "INBOX_", "INBOX_A B", "EAAG...actual-token"]) assert.ok(!CREDENTIAL_REFERENCE.test(bad), bad);
});

test("delivery receipts move outbound messages forward only", () => {
  assert.deepEqual(deliveryTransition("QUEUED", "SENT"), {apply: true, status: "SENT"});
  assert.deepEqual(deliveryTransition("SENT", "READ"), {apply: true, status: "READ"}, "a skipped receipt is fine");
  assert.deepEqual(deliveryTransition("READ", "DELIVERED"), {apply: false, reason: "OUT_OF_ORDER"}, "a late receipt changes nothing");
  assert.deepEqual(deliveryTransition("DELIVERED", "DELIVERED"), {apply: false, reason: "DUPLICATE"});
  assert.deepEqual(deliveryTransition("SENT", "FAILED"), {apply: true, status: "FAILED"});
  assert.deepEqual(deliveryTransition("DELIVERED", "FAILED"), {apply: false, reason: "OUT_OF_ORDER"});
  assert.deepEqual(deliveryTransition("FAILED", "DELIVERED"), {apply: false, reason: "FINAL"});
  assert.deepEqual(deliveryTransition("RECEIVED", "READ"), {apply: false, reason: "NOT_OUTBOUND"}, "receipts never touch inbound messages");
  assert.deepEqual(deliveryTransition("DRAFT", "SENT"), {apply: false, reason: "NOT_OUTBOUND"}, "a receipt cannot mark an unsent draft as sent");
  assert.deepEqual(deliveryTransition("SENT", "UNKNOWN"), {apply: false, reason: "RAW_ONLY"});
});

test("failed events are retried with growing delays, then left dead", () => {
  const first = eventRetry(0, NOW), second = eventRetry(1, NOW);
  assert.ok(!first.dead && !second.dead);
  assert.equal(!first.dead && first.nextAttemptAt, new Date(NOW + 60_000).toISOString());
  assert.equal(!second.dead && second.nextAttemptAt, new Date(NOW + 5 * 60_000).toISOString());
  assert.deepEqual(eventRetry(MAX_EVENT_ATTEMPTS - 1, NOW), {dead: true});
});

test("attachments are accepted by their content, never by their name", () => {
  const bytes = (...values: number[]) => Uint8Array.from(values);
  const text = (value: string) => new TextEncoder().encode(value);
  assert.equal(sniffAttachment(bytes(0xff, 0xd8, 0xff, 0xe0), "photo.png")?.mimeType, "image/jpeg", "the content decides the type");
  assert.equal(sniffAttachment(text("%PDF-1.7\n"), "brochure")?.extension, "pdf");
  assert.equal(sniffAttachment(bytes(0x50, 0x4b, 0x03, 0x04, 0, 0), "offer.docx")?.extension, "docx");
  assert.equal(sniffAttachment(bytes(0x50, 0x4b, 0x03, 0x04, 0, 0), "archive.zip"), null, "a plain archive is refused");
  assert.equal(sniffAttachment(text("MZ\x90\x00"), "brochure.pdf"), null, "an executable named as a PDF is refused");
  assert.equal(sniffAttachment(text("<html><script>alert(1)</script>"), "page.html"), null);
  assert.equal(sniffAttachment(text("<svg onload=alert(1)>"), "logo.png"), null, "SVG (active content) is refused");
  assert.equal(sniffAttachment(text("OggS\x00\x02"), "voice")?.mimeType, "audio/ogg");
  assert.equal(attachmentFileName("../../etc/passwd.pdf", {mimeType: "application/pdf", extension: "pdf", label: "PDF"}), ".. .. etc passwd.pdf", "no path separators survive");
  assert.equal(attachmentFileName("photo.exe", {mimeType: "image/jpeg", extension: "jpg", label: "JPEG"}), "photo.jpg", "the proven extension replaces the claimed one");
  assert.equal(attachmentPath("org-1", "att-1", "pdf"), "organizations/org-1/inbox/attachments/att-1.pdf");
});

test("the Connect WhatsApp popup is trusted only from Meta, and only a dedicated API number is accepted", async () => {
  const { fromMeta, parseSignupMessage } = await import("../src/modules/inbox/embedded-signup");
  for (const origin of ["https://www.facebook.com", "https://facebook.com", "https://business.facebook.com"]) assert.ok(fromMeta(origin), origin);
  for (const origin of ["https://evilfacebook.com", "http://www.facebook.com", "https://facebook.com.evil.test", "null", ""]) assert.equal(fromMeta(origin), false, origin);
  const message = (event: string, data: Record<string, unknown> = {}) => JSON.stringify({type: "WA_EMBEDDED_SIGNUP", event, data});
  const meta = "https://www.facebook.com";
  assert.deepEqual(parseSignupMessage(meta, message("FINISH", {phone_number_id: "106540352242922", waba_id: "524126980791429"})),
    {kind: "finish", phoneNumberId: "106540352242922", businessAccountId: "524126980791429"});
  assert.deepEqual(parseSignupMessage(meta, message("FINISH", {phone_number_id: "106540352242922", messaging_account_ids: ["524126980791429"]})),
    {kind: "finish", phoneNumberId: "106540352242922", businessAccountId: "524126980791429"}, "v5 names the account differently");
  assert.deepEqual(parseSignupMessage(meta, message("FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING", {phone_number_id: "1"})), {kind: "business_app"}, "a Business app number is refused");
  assert.deepEqual(parseSignupMessage(meta, message("FINISH", {phone_number_id: "../x"})), {kind: "no_number"});
  assert.deepEqual(parseSignupMessage(meta, message("FINISH_ONLY_WABA")), {kind: "no_number"});
  assert.deepEqual(parseSignupMessage(meta, message("CANCEL", {current_step: "PHONE_NUMBER_SETUP"})), {kind: "cancel", step: "PHONE_NUMBER_SETUP"});
  assert.deepEqual(parseSignupMessage(meta, message("ERROR", {error_message: "Something failed", error_code: "100"})), {kind: "error", message: "Something failed", code: "100"});
  assert.equal(parseSignupMessage("https://evilfacebook.com", message("FINISH", {phone_number_id: "106540352242922", waba_id: "524126980791429"})), null, "another site cannot pretend to be Meta");
  assert.equal(parseSignupMessage(meta, "not json"), null);
  assert.equal(parseSignupMessage(meta, JSON.stringify({type: "OTHER", event: "FINISH"})), null);
});
