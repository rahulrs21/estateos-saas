import { createHash } from "node:crypto";
import { automatedReason, cutQuotedHistory, htmlForStorage, htmlToText, internetMessageIdOf, MAX_EMAIL_TEXT, parseMailbox, type GmailHeader } from "./email";
import { normalizeEmailIdentity } from "./identity";

/*
 * Microsoft 365 / Outlook messages (Microsoft Graph) reduced to the same shape and
 * rules as Gmail's (docs/EMAIL_INTEGRATION_PLAN.md#microsoft-365). Pure: no
 * network, no secrets. Incoming mail is untrusted: bounded plain text for
 * everything but display, the formatted version cleaned for a sandboxed frame.
 */

export interface OutlookAddress { emailAddress?: {address?: string; name?: string} }
export interface OutlookBody { contentType?: string; content?: string }
export interface OutlookMessage {
  id?: string; conversationId?: string; receivedDateTime?: string; subject?: string; isDraft?: boolean;
  from?: OutlookAddress; sender?: OutlookAddress; toRecipients?: OutlookAddress[];
  internetMessageId?: string; internetMessageHeaders?: GmailHeader[];
  body?: OutlookBody; uniqueBody?: OutlookBody; hasAttachments?: boolean;
}
export interface OutlookAttachment { "@odata.type"?: string; id?: string; name?: string; contentType?: string; size?: number; isInline?: boolean; contentBytes?: string }

/** The scopes EstateOS asks Microsoft for: read and send mail, the signed-in address, and lasting access. */
export const MICROSOFT_SCOPES = ["offline_access", "https://graph.microsoft.com/User.Read", "https://graph.microsoft.com/Mail.Read", "https://graph.microsoft.com/Mail.Send"] as const;
const REQUIRED = ["mail.read", "mail.send"];

/** Whether Microsoft granted both reading and sending (its token response lists scopes with or without the Graph prefix). */
export function microsoftScopesGranted(scope: string | null | undefined) {
  const granted = (scope ?? "").split(/\s+/).map(item => item.toLowerCase().replace(/^https:\/\/graph\.microsoft\.com\//, "")).filter(Boolean);
  return {ok: REQUIRED.every(wanted => granted.includes(wanted)), scopes: granted};
}

const addressOf = (value: OutlookAddress | undefined) => normalizeEmailIdentity(value?.emailAddress?.address ?? null);
const display = (value: OutlookAddress | undefined) => {
  const address = value?.emailAddress?.address ?? "", name = (value?.emailAddress?.name ?? "").replace(/["\r\n]/g, "").trim();
  return name && name.toLowerCase() !== address.toLowerCase() ? `"${name}" <${address}>` : address;
};

/** The message's internet headers, with From added from Graph's own field when the headers lack it (mail inside one organisation has none). */
export function outlookHeaders(message: OutlookMessage): GmailHeader[] {
  const headers = (message.internetMessageHeaders ?? []).filter(item => typeof item?.name === "string" && typeof item?.value === "string").slice(0, 200);
  const has = (name: string) => headers.some(item => item.name!.toLowerCase() === name);
  if (!has("from") && message.from?.emailAddress?.address) headers.push({name: "From", value: display(message.from)});
  if (!has("subject") && message.subject) headers.push({name: "Subject", value: message.subject});
  return headers;
}

/** Why a message is not imported (automated, a draft, our own), or null. Only the Inbox folder is read, so junk and sent mail never reach here. */
export function outlookAutomatedReason(message: OutlookMessage, mailboxAddress: string): string | null {
  if (message.isDraft) return "DRAFT";
  return automatedReason({labelIds: ["INBOX"], payload: {headers: outlookHeaders(message)}}, mailboxAddress);
}

/** A thread key that fits the conversation column: Graph's conversation ID, hashed only if it were ever too long. */
export function outlookThreadId(message: OutlookMessage) {
  const raw = String(message.conversationId ?? message.id ?? "");
  return `m365:${raw.length <= 190 ? raw : createHash("sha256").update(raw).digest("base64url")}`;
}

const bodyText = (body: OutlookBody | undefined) => {
  const content = body?.content ?? "";
  if (!content.trim()) return "";
  return (body?.contentType ?? "").toLowerCase() === "html" ? htmlToText(content) : content;
};

/** The message in EstateOS's normalized form. Graph's uniqueBody (the new part only) is preferred for the text. */
export function normalizeOutlookMessage(message: OutlookMessage, now = Date.now()) {
  const from = parseMailbox(outlookHeaders(message).find(item => item.name?.toLowerCase() === "from")?.value) ?? (addressOf(message.from) ? {address: addressOf(message.from)!, name: message.from?.emailAddress?.name ?? null} : null);
  const received = Date.parse(message.receivedDateTime ?? "");
  const unique = cutQuotedHistory(bodyText(message.uniqueBody)).text;
  const text = (unique || cutQuotedHistory(bodyText(message.body)).text).slice(0, MAX_EMAIL_TEXT);
  return {
    externalMessageId: String(message.id ?? ""),
    threadId: outlookThreadId(message),
    from: {email: from?.address ?? null, name: from?.name?.trim() || null},
    to: (message.toRecipients ?? []).map(addressOf).find(Boolean) ?? null,
    subject: (message.subject ?? "").replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 300) || null,
    internetMessageId: internetMessageIdOf(message.internetMessageId),
    text,
    timestamp: Number.isFinite(received) ? new Date(Math.min(received, now + 5 * 60_000)).toISOString() : null,
  };
}

/** The stored formatted version: only an HTML body has one. */
export const outlookHtmlForStorage = (body: OutlookBody | undefined) => (body?.contentType ?? "").toLowerCase() === "html" ? htmlForStorage(body?.content ?? null) : null;

/** Graph's file attachments (not attached emails or links), bounded. */
export function outlookFileAttachments(items: OutlookAttachment[] | undefined) {
  return (items ?? []).filter(item => item["@odata.type"] === "#microsoft.graph.fileAttachment" && item.id).slice(0, 10)
    .map(item => ({id: String(item.id), fileName: (item.name ?? "").replace(/[\u0000-\u001f\u007f]+/g, " ").trim().slice(0, 200), mimeType: (item.contentType ?? "").toLowerCase().slice(0, 100), sizeBytes: Math.max(0, Number(item.size) || 0), inline: Boolean(item.isInline)}));
}

// --- Sync cursor ----------------------------------------------------------------------------
export const OUTLOOK_BACKFILL_MS = 3 * 86_400_000;

/**
 * Where a sync starts reading the Inbox (received at or after this time). The first
 * sync goes back three days; afterwards it resumes at the newest message already
 * read, never further back than three days, so a long pause cannot flood the inbox.
 */
export function outlookSince(cursor: string | null | undefined, backfilled: boolean, now = Date.now()) {
  const floor = now - OUTLOOK_BACKFILL_MS;
  const at = Date.parse(cursor ?? "");
  return new Date(backfilled && Number.isFinite(at) ? Math.max(at, floor) : floor).toISOString().replace(/\.\d{3}Z$/, "Z");
}

/** The cursor after a page: the newest received time seen (unchanged when nothing new). */
export function outlookCursorAfter(since: string, messages: Array<{receivedDateTime?: string}>) {
  let newest = Date.parse(since);
  for (const message of messages) { const at = Date.parse(message.receivedDateTime ?? ""); if (Number.isFinite(at) && at > newest) newest = at; }
  return new Date(newest).toISOString().replace(/\.\d{3}Z$/, "Z");
}

// --- Replies --------------------------------------------------------------------------------
const escapeHtml = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** The reply body: the approved text (escaped, as plain lines) above the quoted original that Outlook prepared, inside its body. */
export function outlookReplyHtml(text: string, quotedHtml: string | null | undefined) {
  const own = `<div style="font-family:Calibri,Arial,sans-serif;font-size:11pt">${escapeHtml(text).replace(/\r?\n/g, "<br>")}</div><br>`;
  if (!quotedHtml) return own;
  const body = /<body\b[^>]*>/i.exec(quotedHtml);
  return body ? quotedHtml.slice(0, body.index + body[0].length) + own + quotedHtml.slice(body.index + body[0].length) : own + quotedHtml;
}
