import assert from "node:assert/strict";
import { test } from "node:test";
import { emailHtmlForStorage, htmlForStorage } from "../src/modules/inbox/email";
import {
  microsoftScopesGranted, normalizeOutlookMessage, outlookAutomatedReason, outlookCursorAfter, outlookFileAttachments, outlookHeaders, outlookHtmlForStorage, outlookReplyComment, outlookSince,
  outlookThreadId, OUTLOOK_BACKFILL_MS, type OutlookMessage,
} from "../src/modules/inbox/outlook";

/* Phase 7C.2: Microsoft 365 / Outlook messages (Microsoft Graph) under the same rules as Gmail. */

const MAILBOX = "sales@agency.example.test";
const message = (overrides: Partial<OutlookMessage> = {}): OutlookMessage => ({
  id: "AAkALgAAAAAAHYQDEapmEc2byACqAC-EWg0AmRJyzi4v-E6DIdBVrL9EhQAAA4i1rAAA=", conversationId: "AAQkAGVmMDEzMTM4LTZmYWUtNDdkNC1hMDZiLTU1OGY5OTZhYmY4OAAQAKOMt6bUBk2T=",
  receivedDateTime: "2026-11-12T09:30:00Z", subject: "  Villa 12\r\n viewing ", isDraft: false,
  from: {emailAddress: {address: "Layla.Customer@Example.test", name: "Layla Customer"}}, toRecipients: [{emailAddress: {address: MAILBOX}}],
  internetMessageId: "<abc123@mail.example.test>",
  internetMessageHeaders: [{name: "From", value: "Layla Customer <layla.customer@example.test>"}, {name: "Subject", value: "Villa 12 viewing"}],
  body: {contentType: "html", content: "<html><body><p>Is Villa 12 still available?</p><div>On Mon, someone wrote:</div><blockquote>old</blockquote></body></html>"},
  uniqueBody: {contentType: "html", content: "<p>Is Villa 12 still available?</p>"},
  ...overrides,
});

test("Microsoft must grant both reading and sending, with or without the Graph prefix", () => {
  assert.equal(microsoftScopesGranted("https://graph.microsoft.com/Mail.Read https://graph.microsoft.com/Mail.Send https://graph.microsoft.com/User.Read").ok, true);
  assert.equal(microsoftScopesGranted("Mail.Read Mail.Send openid profile").ok, true);
  assert.equal(microsoftScopesGranted("https://graph.microsoft.com/Mail.Read User.Read").ok, false, "reading alone is refused");
  assert.equal(microsoftScopesGranted("").ok, false);
  assert.equal(microsoftScopesGranted(null).ok, false);
});

test("an Outlook message is normalized: the new part only (uniqueBody), the sender, the thread and bounded fields", () => {
  const now = Date.parse("2026-11-12T10:00:00Z");
  const normalized = normalizeOutlookMessage(message(), now);
  assert.equal(normalized.text, "Is Villa 12 still available?");
  assert.deepEqual(normalized.from, {email: "layla.customer@example.test", name: "Layla Customer"});
  assert.equal(normalized.to, MAILBOX);
  assert.equal(normalized.subject, "Villa 12 viewing", "line breaks and extra spaces are removed");
  assert.equal(normalized.internetMessageId, "<abc123@mail.example.test>");
  assert.equal(normalized.threadId, "m365:" + message().conversationId);
  assert.equal(normalized.timestamp, "2026-11-12T09:30:00.000Z");
  // No uniqueBody: the body is used, with its quoted history cut.
  assert.equal(normalizeOutlookMessage(message({uniqueBody: undefined})).text, "Is Villa 12 still available?");
  // Plain-text bodies are used as they are; a time in the future is capped.
  const plain = normalizeOutlookMessage(message({uniqueBody: {contentType: "text", content: "Line one\nLine two"}, receivedDateTime: "2030-01-01T00:00:00Z"}), now);
  assert.equal(plain.text, "Line one\nLine two");
  assert.equal(plain.timestamp, "2026-11-12T10:05:00.000Z");
  // Mail inside one organisation has no internet headers: the sender comes from Graph's own field.
  assert.equal(normalizeOutlookMessage(message({internetMessageHeaders: undefined})).from.email, "layla.customer@example.test");
  assert.deepEqual(outlookHeaders(message({internetMessageHeaders: undefined})).find(item => item.name === "From"), {name: "From", value: "\"Layla Customer\" <Layla.Customer@Example.test>"});
  assert.ok(outlookThreadId(message({conversationId: "x".repeat(400)})).length <= 200, "an over-long thread ID is hashed to fit");
  assert.ok(normalizeOutlookMessage(message({uniqueBody: {contentType: "html", content: "<p>word</p>".repeat(3000)}})).text.length <= 8000, "text is bounded");
});

test("automated Outlook mail, drafts and EstateOS's own mailbox are not imported; people are", () => {
  assert.equal(outlookAutomatedReason(message(), MAILBOX), null);
  assert.equal(outlookAutomatedReason(message({isDraft: true}), MAILBOX), "DRAFT");
  const withHeader = (name: string, value: string) => message({internetMessageHeaders: [...message().internetMessageHeaders!, {name, value}]});
  assert.equal(outlookAutomatedReason(withHeader("List-Unsubscribe", "<https://example.test/u>"), MAILBOX), "MAILING_LIST");
  assert.equal(outlookAutomatedReason(withHeader("Auto-Submitted", "auto-replied"), MAILBOX), "AUTO_SUBMITTED");
  assert.equal(outlookAutomatedReason(withHeader("Precedence", "bulk"), MAILBOX), "BULK");
  assert.equal(outlookAutomatedReason(message({internetMessageHeaders: [{name: "From", value: "Shop <no-reply@shop.example.test>"}]}), MAILBOX), "ROBOT_SENDER");
  assert.equal(outlookAutomatedReason(message({internetMessageHeaders: [{name: "From", value: MAILBOX}]}), MAILBOX), "FROM_SELF");
});

test("the formatted version is cleaned like Gmail's, and a plain-text body has none", () => {
  const stored = outlookHtmlForStorage({contentType: "html", content: "<html><head><style>p{color:red}</style></head><body><p onclick=x()>Hi</p><script>alert(1)</script><a href=\"javascript:x\">bad</a></body></html>"});
  assert.ok(stored && stored.includes("<style>p{color:red}</style>") && stored.includes("<p>Hi</p>"), String(stored));
  assert.equal(/script|onclick|javascript:/i.test(stored!), false);
  assert.equal(outlookHtmlForStorage({contentType: "text", content: "plain"}), null);
  assert.equal(outlookHtmlForStorage(undefined), null);
  assert.equal(htmlForStorage("<p>same</p>"), "<p>same</p>", "Gmail and Outlook share one cleaner");
  assert.equal(emailHtmlForStorage(undefined), null);
});

test("only real file attachments are taken, bounded, with their names cleaned", () => {
  const files = outlookFileAttachments([
    {"@odata.type": "#microsoft.graph.fileAttachment", id: "A1", name: "brochure\u0000.pdf", contentType: "Application/PDF", size: 1200},
    {"@odata.type": "#microsoft.graph.itemAttachment", id: "A2", name: "forwarded email"},
    {"@odata.type": "#microsoft.graph.referenceAttachment", id: "A3", name: "a link"},
    ...Array.from({length: 15}, (_, index) => ({"@odata.type": "#microsoft.graph.fileAttachment", id: "F" + index, name: "f" + index + ".png", contentType: "image/png", size: 10})),
  ]);
  assert.equal(files.length, 10, "at most ten per message");
  assert.deepEqual(files[0], {id: "A1", fileName: "brochure .pdf", mimeType: "application/pdf", sizeBytes: 1200, inline: false});
  assert.equal(files.some(file => file.id === "A2" || file.id === "A3"), false, "attached emails and links are not files");
});

test("the sync cursor starts three days back, resumes at the newest message read, and never reaches further back than three days", () => {
  const now = Date.parse("2026-11-12T12:00:00Z");
  const threeDays = new Date(now - OUTLOOK_BACKFILL_MS).toISOString().replace(/\.\d{3}Z$/, "Z");
  assert.equal(outlookSince(null, false, now), threeDays, "first sync: the last three days");
  assert.equal(outlookSince("2026-11-12T11:00:00Z", false, now), threeDays, "not backfilled yet: still the backfill window");
  assert.equal(outlookSince("2026-11-12T11:00:00Z", true, now), "2026-11-12T11:00:00Z");
  assert.equal(outlookSince("2026-10-01T00:00:00Z", true, now), threeDays, "a long pause cannot flood the inbox");
  assert.equal(outlookSince("not a date", true, now), threeDays);
  assert.equal(outlookCursorAfter("2026-11-12T11:00:00Z", [{receivedDateTime: "2026-11-12T11:30:00Z"}, {receivedDateTime: "2026-11-12T11:10:00Z"}, {}]), "2026-11-12T11:30:00Z");
  assert.equal(outlookCursorAfter("2026-11-12T11:00:00Z", []), "2026-11-12T11:00:00Z", "nothing new: unchanged");
});

test("a reply's comment is the approved text, escaped, with its lines kept (Outlook quotes the original below it)", () => {
  assert.equal(outlookReplyComment("Hello <Layla> & \"team\"\nSee you Tuesday\r\nRegards"), "<div>Hello &lt;Layla&gt; &amp; &quot;team&quot;<br>See you Tuesday<br>Regards</div>");
  assert.equal(outlookReplyComment("<script>alert(1)</script>").includes("<script>"), false, "the reply text can never become markup");
});
