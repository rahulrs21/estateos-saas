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

// Phase 7E.2: click-to-WhatsApp ads (docs/LEAD_ATTRIBUTION_PLAN.md).
test("a message from a click-to-WhatsApp ad carries the ad, bounded and cleaned; other messages carry none", async () => {
  const {parseAdReferral} = await import("../src/modules/inbox/ad-referral");
  const adMessage = payload({contacts: [{wa_id: "447700900124", profile: {name: "Omar Example"}}], messages: [{from: "447700900124", id: "wamid.AD1", timestamp: seconds("2026-11-04T09:59:00Z"), type: "text", text: {body: "Hi, is this still available?"},
    referral: {source_url: "https://fb.me/2AbCdEf?utm=secret", source_id: "120200000000000001", source_type: "ad", headline: "Marina_Launch 2-bed\u0000 from AED 1.2M", body: "Waterfront living", media_type: "image", image_url: "https://scontent.example.test/x.jpg", ctwa_clid: "ARAkLkA8rmlFeiCktEJQ-QTwRiyYHAFDLMNDBH0CD3qpjd0HR4irJ6LEkR7JwFF4XvnO2E4Nx0-eM-GABDLOPaOdRMv-_zfUQ2a"}}]});
  const [event] = whatsappAdapter.parseWebhook(request(adMessage));
  assert.equal(event.kind, "MESSAGE");
  assert.deepEqual(event.kind === "MESSAGE" ? event.referral : null, {sourceId: "120200000000000001", sourceType: "ad", headline: "Marina_Launch 2-bed from AED 1.2M", body: "Waterfront living",
    sourceHost: "fb.me", sourcePath: "/2AbCdEf", ctwaClid: "ARAkLkA8rmlFeiCktEJQ-QTwRiyYHAFDLMNDBH0CD3qpjd0HR4irJ6LEkR7JwFF4XvnO2E4Nx0-eM-GABDLOPaOdRMv-_zfUQ2a", campaignKey: "marina launch 2 bed from aed 1.2m"},
    "the link keeps host and path only; control characters are removed");
  const [plain] = whatsappAdapter.parseWebhook(request(textMessage));
  assert.equal(plain.kind === "MESSAGE" && "referral" in plain, false, "a message without an ad has no referral");

  assert.equal(parseAdReferral(null), null);
  assert.equal(parseAdReferral("ad"), null);
  assert.equal(parseAdReferral({media_type: "image"}), null, "a referral naming no ad is ignored");
  assert.deepEqual(parseAdReferral({source_id: "12'; DROP", source_type: "<b>ad</b>", source_url: "javascript:alert(1)", headline: "x".repeat(400), ctwa_clid: "bad id with spaces"}),
    {sourceId: null, sourceType: null, headline: "x".repeat(300), body: null, sourceHost: null, sourcePath: null, ctwaClid: null, campaignKey: "x".repeat(200)}, "untrusted values are refused or bounded");
  assert.deepEqual(parseAdReferral({source_id: 987654321, source_type: "post"}), {sourceId: "987654321", sourceType: "post", headline: null, body: null, sourceHost: null, sourcePath: null, ctwaClid: null, campaignKey: "meta ad 987654321"},
    "without a headline the ad is grouped by its ID");
});

test("a conversation's ad is kept, a newer ad replaces it after 30 days, and a lead takes the conversation's source only when it came from the conversation", async () => {
  const {conversationLeadChannel, linkSourceAction, replacesReferral} = await import("../src/modules/inbox/ad-referral");
  const now = Date.parse("2026-11-24T10:00:00Z");
  assert.equal(replacesReferral(null, now), true, "no ad yet");
  assert.equal(replacesReferral("2026-11-20T10:00:00Z", now), false, "a recent ad is kept");
  assert.equal(replacesReferral("2026-10-20T10:00:00Z", now), true, "an ad older than 30 days is replaced");

  assert.equal(conversationLeadChannel({channel: "WHATSAPP", adReferredAt: "2026-11-20T10:00:00Z"}), "WHATSAPP_AD");
  assert.equal(conversationLeadChannel({channel: "WHATSAPP", adReferredAt: null}), "WHATSAPP");
  assert.equal(conversationLeadChannel({channel: "EMAIL"}), "EMAIL");
  assert.equal(conversationLeadChannel({channel: "WEBSITE"}), null, "website enquiries already have their source");
  assert.equal(conversationLeadChannel({channel: "INTERNAL"}), null);

  const conversation = {channel: "WHATSAPP", createdAt: "2026-11-20T10:00:00.123456Z", adReferredAt: "2026-11-20T10:00:00.123456Z"};
  const after = "2026-11-20T10:05:00Z";
  assert.equal(linkSourceAction(conversation, {createdAt: after, source: null}), "INSERT", "a lead created from the conversation takes its source");
  assert.equal(linkSourceAction(conversation, {createdAt: after, source: {channel: "MANUAL", campaignKey: null}}), "REPLACE", "a lead added by hand without a campaign takes the conversation's source");
  assert.equal(linkSourceAction(conversation, {createdAt: after, source: {channel: "MANUAL", campaignKey: "marina launch"}}), null, "a campaign chosen by hand is kept");
  assert.equal(linkSourceAction(conversation, {createdAt: after, source: {channel: "WEBSITE_FORM", campaignKey: null}}), null, "a lead keeps the source it was created with");
  assert.equal(linkSourceAction(conversation, {createdAt: "2026-11-01T10:00:00Z", source: null}), null, "an older lead was not created from it");
  assert.equal(linkSourceAction(conversation, {createdAt: "2026-11-01T10:00:00Z", source: {channel: "MANUAL", campaignKey: null}}), null);
  assert.equal(linkSourceAction({...conversation, channel: "WEBSITE"}, {createdAt: after, source: null}), null);
});

// Phase 7G.1: what a WhatsApp customer shares besides text and files.
test("shared locations, contacts and reactions become bounded messages with checked details", async () => {
  const {mapsUrl, parseContacts, parseLocation, readDetails, serializeDetails} = await import("../src/modules/inbox/message-details");
  const shared = payload({contacts: [{wa_id: "447700900125", profile: {name: "Sara Example"}}], messages: [
    {from: "447700900125", id: "wamid.LOC1", timestamp: seconds("2026-11-04T09:59:00Z"), type: "location", location: {latitude: 25.0805, longitude: 55.1403, name: "Marina Gate\u0000 Tower 1", address: "Dubai Marina, Dubai"}},
    {from: "447700900125", id: "wamid.CON1", timestamp: seconds("2026-11-04T09:59:00Z"), type: "contacts", contacts: [{name: {formatted_name: "Omar Buyer", first_name: "Omar"}, phones: [{phone: "+971 50 123 4567", wa_id: "971501234567", type: "CELL"}], emails: [{email: "Omar@Example.test"}]}]},
    {from: "447700900125", id: "wamid.REA1", timestamp: seconds("2026-11-04T09:59:00Z"), type: "reaction", reaction: {message_id: "wamid.X", emoji: "👍"}},
  ]});
  const [location, contact, reaction] = whatsappAdapter.parseWebhook(request(shared));
  assert.ok(location.kind === "MESSAGE" && contact.kind === "MESSAGE" && reaction.kind === "MESSAGE");
  assert.equal(location.messageType, "LOCATION");
  assert.equal(location.text, "Location: Marina Gate Tower 1, Dubai Marina, Dubai", "control characters removed");
  assert.deepEqual(readDetails(location.details), {kind: "location", latitude: 25.0805, longitude: 55.1403, name: "Marina Gate Tower 1", address: "Dubai Marina, Dubai"});
  assert.equal(location.attachments.length, 0, "a location is not a file");
  assert.equal(contact.messageType, "CONTACTS");
  assert.equal(contact.text, "Contact: Omar Buyer (+971501234567)");
  assert.deepEqual(readDetails(contact.details), {kind: "contacts", contacts: [{name: "Omar Buyer", phones: [{phone: "+971501234567", waId: "971501234567"}], emails: ["omar@example.test"]}]});
  assert.equal(reaction.messageType, "TEXT");
  assert.equal(reaction.text, "Reacted 👍 to a message");

  assert.equal(parseLocation({latitude: 91, longitude: 55}), null, "coordinates must be in range");
  assert.equal(parseLocation({latitude: "25.1", longitude: "abc"}), null);
  assert.equal(parseContacts([{name: {}, phones: [{phone: "call me"}]}]), null, "a contact with neither a name nor a number is ignored");
  assert.equal(parseContacts(Array.from({length: 9}, (_, index) => ({name: {formatted_name: `P${index}`}})))!.details.kind === "contacts" && (parseContacts(Array.from({length: 9}, (_, index) => ({name: {formatted_name: `P${index}`}})))!.details as {contacts: unknown[]}).contacts.length, 5, "at most 5 contacts");
  assert.equal(readDetails('{"kind":"location","latitude":200,"longitude":1}'), null, "stored details are checked again");
  assert.equal(readDetails('{"kind":"script","src":"x"}'), null);
  assert.equal(readDetails("not json"), null);
  assert.equal(serializeDetails({kind: "contacts", contacts: Array.from({length: 5}, () => ({name: "x".repeat(160), phones: [], emails: Array.from({length: 3}, () => `${"a".repeat(64)}@${"b".repeat(190)}`)}))}), null, "too large to store");
  assert.equal(mapsUrl(25.0805, 55.1403), "https://www.google.com/maps/search/?api=1&query=25.0805%2C55.1403");
});
