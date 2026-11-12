import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { test } from "node:test";
// Phase 7C.2: the Microsoft 365 / Outlook rules run with these (tests/inbox-outlook.test.ts).
import "./inbox-outlook.test";
import { openSecret, sealSecret, TokenVaultError, vaultKey } from "../src/modules/inbox/vault";
import { newOAuthState, openOAuthState, pkceChallenge, sealOAuthState } from "../src/modules/inbox/oauth-state";
import {
  automatedReason, buildReplyMessage, cutQuotedHistory, decodeEncodedWords, encodeHeaderText, headerValue, htmlToText, internetMessageIdOf, messageParts, messageText,
  emailHtmlForStorage, hasRemoteContent, mailboxImportDecision, normalizeGmailMessage, parseMailbox, parseMailboxes, replySubject, sanitizeEmailHtml, type GmailMessage,
} from "../src/modules/inbox/email";

const key = randomBytes(32);
const binding = {purpose: "mailbox-grant", organizationId: "10000000-0000-4000-8000-000000000001", recordId: "20000000-0000-4000-8000-000000000002"};
const b64 = (text: string) => Buffer.from(text, "utf8").toString("base64url");

test("the vault round-trips a grant and refuses tampering, another record, another key and a missing key", () => {
  const sealed = sealSecret("1//refresh-token-value", binding, key);
  assert.match(sealed.ciphertext, /^v1:[\w-]{16}:[\w-]{22}:[\w-]+$/);
  assert.equal(sealed.ciphertext.includes("refresh-token"), false, "the stored form never contains the token");
  assert.equal(openSecret(sealed.ciphertext, sealed.keyId, binding, key), "1//refresh-token-value");
  assert.notEqual(sealSecret("1//refresh-token-value", binding, key).ciphertext, sealed.ciphertext, "a fresh IV each time");
  const [v, iv, tag, body] = sealed.ciphertext.split(":");
  const flipped = body.slice(0, -2) + (body.at(-2) === "A" ? "B" : "A") + body.at(-1);
  const unreadable = (stored: string, keyId = sealed.keyId, other = binding, withKey: Buffer | null = key) =>
    assert.throws(() => openSecret(stored, keyId, other, withKey), (error: unknown) => error instanceof TokenVaultError);
  unreadable([v, iv, tag, flipped].join(":"));
  unreadable([v, iv, tag.slice(0, 10), body].join(":"), sealed.keyId); // a shortened tag is refused
  unreadable(sealed.ciphertext, sealed.keyId, {...binding, recordId: "20000000-0000-4000-8000-000000000003"}); // copied to another connection
  unreadable(sealed.ciphertext, sealed.keyId, {...binding, organizationId: "10000000-0000-4000-8000-000000000009"}); // another company
  unreadable(sealed.ciphertext, sealed.keyId, {...binding, purpose: "oauth-state"});
  unreadable(sealed.ciphertext, sealed.keyId, binding, randomBytes(32));
  unreadable(sealed.ciphertext, "k0");
  assert.throws(() => sealSecret("x", binding, null), (error: unknown) => error instanceof TokenVaultError && error.code === "NO_KEY");
  assert.equal(vaultKey({}), null);
  assert.equal(vaultKey({INBOX_TOKEN_ENCRYPTION_KEY: "too-short"}), null);
  assert.equal(vaultKey({INBOX_TOKEN_ENCRYPTION_KEY: randomBytes(16).toString("base64")}), null, "a 16-byte key is not AES-256");
  assert.equal(vaultKey({INBOX_TOKEN_ENCRYPTION_KEY: key.toString("base64")})?.equals(key), true);
});

test("the OAuth state is sealed, single-purpose, expires and must equal the returned state", () => {
  const now = Date.UTC(2026, 10, 10, 9);
  const state = newOAuthState({uid: "owner-a", organizationId: binding.organizationId, provider: "GMAIL", personal: false, displayName: "Sales", connectionId: null}, now);
  assert.match(state.state, /^[\w-]{32}$/);
  assert.match(pkceChallenge(state.verifier), /^[\w-]{43}$/);
  const cookie = sealOAuthState(state, key);
  assert.equal(cookie.includes(state.verifier), false);
  const opened = openOAuthState(cookie, state.state, now + 1000, key);
  assert.ok(opened.ok && opened.state.uid === "owner-a" && opened.state.organizationId === binding.organizationId);
  assert.deepEqual(openOAuthState(cookie, "another-state-value-of-the-same-length", now, key), {ok: false, reason: "MISMATCH"});
  assert.deepEqual(openOAuthState(cookie, state.state.slice(0, -1) + (state.state.endsWith("A") ? "B" : "A"), now, key), {ok: false, reason: "MISMATCH"});
  assert.deepEqual(openOAuthState(cookie, state.state, now + 11 * 60_000, key), {ok: false, reason: "EXPIRED"});
  assert.deepEqual(openOAuthState(null, state.state, now, key), {ok: false, reason: "MISSING"});
  assert.deepEqual(openOAuthState(cookie, null, now, key), {ok: false, reason: "MISSING"});
  // Flip a character inside the ciphertext (the last base64url character may only carry unused padding bits).
  const parts = cookie.split(":");
  const middle = Math.floor(parts[3].length / 2);
  parts[3] = parts[3].slice(0, middle) + (parts[3][middle] === "A" ? "B" : "A") + parts[3].slice(middle + 1);
  assert.deepEqual(openOAuthState(parts.join(":"), state.state, now, key), {ok: false, reason: "UNREADABLE"});
  assert.deepEqual(openOAuthState(cookie, state.state, now, randomBytes(32)), {ok: false, reason: "UNREADABLE"});
  // A sealed mailbox grant can never pass as an OAuth state (different purpose).
  assert.deepEqual(openOAuthState(sealSecret(JSON.stringify(state), binding, key).ciphertext, state.state, now, key), {ok: false, reason: "UNREADABLE"});
});

test("addresses and header words are decoded; names are untrusted text", () => {
  assert.deepEqual(parseMailbox("\"Layla Hassan\" <Layla.Hassan@Example.Test>"), {address: "layla.hassan@example.test", name: "Layla Hassan"});
  assert.deepEqual(parseMailbox("plain@example.test"), {address: "plain@example.test", name: null});
  assert.deepEqual(parseMailbox("=?UTF-8?B?2YTZitmE2Yk=?= <arabic@example.test>"), {address: "arabic@example.test", name: "ليلى"});
  assert.deepEqual(parseMailbox("\"Smith, John\" <john@example.test>, other@example.test"), {address: "john@example.test", name: "Smith, John"});
  assert.equal(parseMailbox("not an address"), null);
  assert.equal(parseMailbox("<script>@example.test"), null);
  assert.deepEqual(parseMailboxes("a@example.test, \"B, C\" <b@example.test>, junk"), ["a@example.test", "b@example.test"]);
  assert.equal(decodeEncodedWords("=?ISO-8859-1?Q?Caf=E9_au_lait?="), "Café au lait");
  assert.equal(decodeEncodedWords("=?UTF-8?B?SGVsbG8=?= =?UTF-8?B?V29ybGQ=?="), "HelloWorld", "adjacent encoded words join without the space");
});

test("email HTML becomes plain text: no scripts, styles or markup; links keep their address", () => {
  const html = `<html><head><title>x</title><style>p{color:red}</style><script>alert(1)</script></head><body><!-- tracking -->
    <p>Hello&nbsp;team,</p><p>I&#39;m interested in <b>Villa 12</b> &amp; its garden.</p><ul><li>3 bedrooms</li><li>Budget AED&nbsp;4M</li></ul>
    <a href="https://listings.example.test/villa-12">See the listing</a><br><img src="https://tracker.example.test/p.gif"><a href="javascript:alert(1)">click</a></body></html>`;
  const text = htmlToText(html);
  assert.equal(text, "Hello team,\n\nI'm interested in Villa 12 & its garden.\n\n• 3 bedrooms\n• Budget AED 4M\n\nSee the listing [https://listings.example.test/villa-12]\nclick");
  assert.doesNotMatch(text, /alert|color|tracking|tracker|<|>/);
  assert.equal(htmlToText("<p>&#x1F600; &#0; &#xD800; &bogus;</p>"), "😀 &bogus;", "invalid code points are dropped, unknown entities kept as text");
});

test("quoted history and signatures are cut from replies, unless nothing would remain", () => {
  assert.deepEqual(cutQuotedHistory("Yes, Tuesday works.\n\nOn Mon, 9 Nov 2026 at 10:00, Sales <sales@agency.test> wrote:\n> Are you free?"), {text: "Yes, Tuesday works.", cut: true});
  assert.deepEqual(cutQuotedHistory("Sounds good\nOn Mon, 9 Nov 2026 at 10:00, Sales Team\n<sales@agency.test> wrote:\n> old"), {text: "Sounds good", cut: true}, "a wrapped quote header");
  assert.equal(cutQuotedHistory("Thanks!\n\n-----Original Message-----\nFrom: a").text, "Thanks!");
  assert.equal(cutQuotedHistory("Call me.\n\nFrom: Sales <sales@agency.test>\nSent: Monday\nTo: me\nSubject: Villa").text, "Call me.");
  assert.equal(cutQuotedHistory("unsubscribe\n\nSent from my iPhone").text, "unsubscribe", "so a one-word opt-out is still recognised");
  assert.equal(cutQuotedHistory("Regards\n-- \nLayla\n+971 50 000 0000").text, "Regards");
  assert.equal(cutQuotedHistory("نعم\n\nفي الاثنين، 9 نوفمبر 2026، كتب Sales:\n> سؤال").text, "نعم");
  assert.deepEqual(cutQuotedHistory("> only a quote\n> nothing new"), {text: "> only a quote\n> nothing new", cut: false});
});

test("bodies prefer text/plain, decode charsets, and list real attachments only", () => {
  const payload = {mimeType: "multipart/mixed", parts: [
    {mimeType: "multipart/alternative", parts: [
      {mimeType: "text/plain", headers: [{name: "Content-Type", value: "text/plain; charset=\"windows-1252\""}], body: {data: Buffer.from([0x43, 0x61, 0x66, 0xe9]).toString("base64url")}},
      {mimeType: "text/html", body: {data: b64("<p>HTML version</p>")}},
    ]},
    {partId: "2", mimeType: "application/pdf", filename: "brochure.pdf", headers: [{name: "Content-Disposition", value: "attachment"}], body: {size: 1200, attachmentId: "ATT-1"}},
  ]};
  const parts = messageParts(payload);
  assert.equal(parts.plain, "Café");
  assert.deepEqual(parts.attachments, [{partId: "2", fileName: "brochure.pdf", mimeType: "application/pdf", sizeBytes: 1200, attachmentId: "ATT-1", inlineData: null}]);
  assert.equal(messageText({mimeType: "text/html", body: {data: b64("<div>Only <i>HTML</i></div>")}}), "Only HTML");
  assert.equal(messageText({mimeType: "text/plain", body: {data: b64("x".repeat(9000))}}).length, 8000, "bounded");
});

const message = (headers: Record<string, string>, labelIds = ["INBOX", "UNREAD", "CATEGORY_PERSONAL"]): GmailMessage => ({
  id: "18c0f00d", threadId: "18c0aaaa", labelIds, internalDate: String(Date.UTC(2026, 10, 10, 8)),
  payload: {mimeType: "text/plain", headers: Object.entries(headers).map(([name, value]) => ({name, value})), body: {data: b64("Is the villa still available?")}},
});

test("automated mail is not imported; a person writing is", () => {
  const person = {From: "Layla <layla@example.test>", To: "sales@agency.test", Subject: "Villa 12", "Message-ID": "<CAB123@mail.example.test>"};
  assert.equal(automatedReason(message(person), "sales@agency.test"), null);
  const reasons: Array<[GmailMessage, string]> = [
    [message(person, ["SPAM"]), "LABEL_SPAM"],
    [message(person, ["INBOX", "CATEGORY_PROMOTIONS"]), "LABEL_CATEGORY_PROMOTIONS"],
    [message(person, ["INBOX", "CATEGORY_UPDATES"]), "LABEL_CATEGORY_UPDATES"],
    [message(person, ["SENT"]), "NOT_IN_INBOX"],
    [message({...person, "List-Unsubscribe": "<mailto:unsub@example.test>"}), "MAILING_LIST"],
    [message({...person, Precedence: "bulk"}), "BULK"],
    [message({...person, "Auto-Submitted": "auto-replied"}), "AUTO_SUBMITTED"],
    [message({...person, "Return-Path": "<>"}), "BOUNCE"],
    [message({...person, From: "No Reply <no-reply@portal.example.test>"}), "ROBOT_SENDER"],
    [message({...person, From: "MAILER-DAEMON@mail.example.test"}), "ROBOT_SENDER"],
    [message({...person, From: "Sales <Sales@Agency.test>"}), "FROM_SELF"],
    [message({...person, "X-EstateOS-Message": "abc"}), "OWN_MESSAGE"],
    [message({...person, From: "nobody"}), "NO_SENDER"],
  ];
  for (const [candidate, reason] of reasons) assert.equal(automatedReason(candidate, "sales@agency.test"), reason);
  assert.equal(automatedReason(message({...person, "Auto-Submitted": "no"}), "sales@agency.test"), null);
});

test("a Gmail message is normalized to a thread, a sender, a subject, its Message-ID and bounded text", () => {
  const normalized = normalizeGmailMessage(message({From: "\"Layla\" <LAYLA@example.test>", To: "Sales <sales@agency.test>", Subject: "=?UTF-8?B?VmlsbGEgMTIg4oCTIHZpZXdpbmc=?=", "Message-ID": "<CAB123@mail.example.test>"}));
  assert.deepEqual({...normalized, attachments: undefined}, {
    externalMessageId: "18c0f00d", threadId: "gmail:18c0aaaa", from: {email: "layla@example.test", name: "Layla"}, to: "sales@agency.test", subject: "Villa 12 – viewing",
    internetMessageId: "<CAB123@mail.example.test>", text: "Is the villa still available?", timestamp: "2026-11-10T08:00:00.000Z", attachments: undefined,
  });
  assert.equal(internetMessageIdOf("not-an-id"), null);
  assert.equal(internetMessageIdOf("<a b>"), null);
});

test("replies are plain text with threading headers, and no header can be injected", () => {
  const raw = buildReplyMessage({from: "sales@agency.test", fromName: "Sales Team", to: "layla@example.test", subject: replySubject("Villa 12\r\nBcc: everyone@example.test"),
    text: "Hello Layla,\nTuesday at 10 works.", inReplyTo: "<CAB123@mail.example.test>", references: ["<CAA000@mail.example.test>", "bogus"], estateosMessageId: "30000000-0000-4000-8000-000000000003", date: new Date(Date.UTC(2026, 10, 10, 9))});
  const decoded = Buffer.from(raw, "base64url").toString("utf8");
  const [head, body] = decoded.split("\r\n\r\n");
  const lines = head.split("\r\n");
  assert.deepEqual(lines, [
    "From: \"Sales Team\" <sales@agency.test>", "To: layla@example.test", "Subject: Re: Villa 12 Bcc: everyone@example.test", "Date: Tue, 10 Nov 2026 09:00:00 +0000",
    "Message-ID: <estateos.30000000-0000-4000-8000-000000000003@agency.test>", "In-Reply-To: <CAB123@mail.example.test>", "References: <CAA000@mail.example.test> <CAB123@mail.example.test>",
    "X-EstateOS-Message: 30000000-0000-4000-8000-000000000003", "MIME-Version: 1.0", "Content-Type: text/plain; charset=UTF-8", "Content-Transfer-Encoding: base64",
  ]);
  assert.equal(lines.some(line => /^bcc:/i.test(line)), false, "an injected header stays inside the subject");
  assert.equal(Buffer.from(body.replace(/\r\n/g, ""), "base64").toString("utf8"), "Hello Layla,\r\nTuesday at 10 works.");
  assert.equal(replySubject("Re: Villa"), "Re: Villa");
  assert.equal(replySubject(""), "Re: Your enquiry");
  assert.equal(encodeHeaderText("مرحبا"), "=?UTF-8?B?2YXYsdit2KjYpw==?=");
  assert.equal(headerValue("a\r\nb\u0000c"), "a bc");
  assert.throws(() => buildReplyMessage({from: "sales@agency.test", to: "victim@example.test\r\nBcc: x@example.test", subject: "x", text: "x", estateosMessageId: "30000000-0000-4000-8000-000000000003"}));
  assert.throws(() => buildReplyMessage({from: "not-an-address", to: "layla@example.test", subject: "x", text: "x", estateosMessageId: "30000000-0000-4000-8000-000000000003"}));
});

test("a company mailbox imports people writing; a personal one only CRM customers, assigned to its owner", () => {
  const matched = {status: "MATCHED" as const, contactId: "c1", leadId: "l1"};
  assert.deepEqual(mailboxImportDecision({automated: "MAILING_LIST", ownerMembershipId: null, existingThread: false, match: null}), {import: false, reason: "MAILING_LIST"});
  assert.deepEqual(mailboxImportDecision({automated: null, ownerMembershipId: null, existingThread: false, match: null}), {import: true, link: null}, "unknown senders to a company mailbox wait for matching");
  assert.deepEqual(mailboxImportDecision({automated: null, ownerMembershipId: "m1", existingThread: false, match: {status: "UNKNOWN"}}), {import: false, reason: "NOT_A_CRM_CONTACT"});
  assert.deepEqual(mailboxImportDecision({automated: null, ownerMembershipId: "m1", existingThread: false, match: {status: "AMBIGUOUS"}}), {import: false, reason: "NOT_A_CRM_CONTACT"}, "an ambiguous sender is not imported from a personal mailbox");
  assert.deepEqual(mailboxImportDecision({automated: null, ownerMembershipId: "m1", existingThread: false, match: matched}), {import: true, link: {contactId: "c1", leadId: "l1", assignedMembershipId: "m1"}});
  assert.deepEqual(mailboxImportDecision({automated: null, ownerMembershipId: "m1", existingThread: true, match: null}), {import: true, link: null}, "later messages in an imported thread follow it");
  assert.deepEqual(mailboxImportDecision({automated: "LABEL_SPAM", ownerMembershipId: "m1", existingThread: true, match: matched}), {import: false, reason: "LABEL_SPAM"}, "automated mail is never imported, even in a known thread");
});

test("email HTML keeps its layout but loses everything active: scripts, handlers, frames, forms, unsafe URLs and CSS tricks", () => {
  const dirty = `<!doctype html><html><head><meta http-equiv="refresh" content="0;url=https://evil.example.test"><base href="https://evil.example.test/"><title>x</title>
    <style>.box{color:#123;background:url(javascript:alert(1))} @import url(https://evil.example.test/a.css); </style><style>p{margin:0}</style></head>
    <body onload="alert(1)"><div class="box" style="color:red">Order <b>#16466</b></div>
    <script>alert(1)</script><SCRIPT src="https://evil.example.test/x.js"></SCRIPT><iframe src="https://evil.example.test"></iframe><object data="x.swf"></object>
    <img src="https://shop.example.test/logo.png" onerror="alert(1)" alt="Logo"><img src="javascript:alert(1)"><img src="cid:logo@shop"><img src="data:image/png;base64,iVBORw0KGgo=">
    <a href="https://fazahome.example.test/orders/16466">View order</a> <a href="javascript:alert(1)">bad</a> <a href=" java&#x73;cript:alert(1)">encoded</a> <a href="mailto:help@example.test">mail</a>
    <form action="https://evil.example.test"><input name="password"><button>Go</button></form><p style="width:expression(alert(1))">x</p><svg onload=alert(1)><circle/></svg>
    <img src=x onerror=alert(1)><div title="</style><script>alert(1)</script>">t</div></body></html>`;
  const clean = sanitizeEmailHtml(dirty);
  assert.ok(clean);
  const all = `${clean.css}\n${clean.body}`;
  assert.doesNotMatch(all, /<script|<iframe|<object|<form|<input|<button|<meta|<base|<title|onload|onerror|javascript:|expression\(|@import|evil\.example\.test/i);
  assert.match(clean.body, /Order <b>#16466<\/b>/, "formatting is kept");
  assert.match(clean.body, /<a rel="noopener noreferrer" target="_blank" href="https:\/\/fazahome\.example\.test\/orders\/16466">View order<\/a>/, "safe links open in a new tab without a referrer");
  assert.match(clean.body, /href="mailto:help@example\.test"/);
  assert.match(clean.body, /src="https:\/\/shop\.example\.test\/logo\.png"/, "remote images are kept (the frame shows them only on request)");
  assert.match(clean.body, /src="cid:logo@shop"/);
  assert.match(clean.body, /src="data:image\/png;base64,/);
  assert.match(clean.body, /style="color:red"/);
  assert.match(clean.css, /p\{margin:0\}/);
  assert.doesNotMatch(clean.css, /<\/style/i, "the email's CSS can never close its style element");
  assert.equal(sanitizeEmailHtml(""), null);
  assert.equal(sanitizeEmailHtml("<script>alert(1)</script>"), null, "nothing usable");
  assert.equal(sanitizeEmailHtml("x".repeat(900_001)), null, "too large");
  assert.equal(hasRemoteContent(clean.body), true);
  assert.equal(hasRemoteContent(`<img src="cid:a">`), false);
  const stored = emailHtmlForStorage({mimeType: "text/html", body: {data: b64("<p onclick=\"x()\">Hi</p>")}});
  assert.equal(stored, "<p>Hi</p>");
});
