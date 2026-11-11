import { normalizeEmailIdentity } from "./identity";

/*
 * Email rules shared by the mailbox connectors (docs/EMAIL_INTEGRATION_PLAN.md).
 * Incoming mail is untrusted: it is reduced to bounded plain text on the server
 * (HTML converted, quoted history cut) and is always rendered as text, never as
 * HTML; remote content is never loaded. Automated mail (newsletters, notices,
 * bounces) is not imported. Outgoing mail is plain text, built here with every
 * header value stripped of line breaks so nothing can inject a header.
 */

export const MAX_EMAIL_TEXT = 8000;
export const MAX_EMAIL_REPLY = 4000;

// --- Gmail message shapes (users.messages.get, format=full or metadata) ----------------------
export interface GmailHeader { name?: string; value?: string }
export interface GmailPart {
  partId?: string; mimeType?: string; filename?: string; headers?: GmailHeader[];
  body?: {size?: number; data?: string; attachmentId?: string}; parts?: GmailPart[];
}
export interface GmailMessage {
  id?: string; threadId?: string; labelIds?: string[]; internalDate?: string; historyId?: string;
  payload?: GmailPart;
}

export function header(headers: GmailHeader[] | undefined, name: string): string | null {
  const wanted = name.toLowerCase();
  const found = (headers ?? []).find(item => item.name?.toLowerCase() === wanted);
  return typeof found?.value === "string" ? found.value : null;
}

// --- Decoding ---------------------------------------------------------------------------------
export function decodeBase64Url(data: string | null | undefined): Uint8Array {
  if (!data) return new Uint8Array();
  return new Uint8Array(Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64"));
}

/** Bytes in a declared charset, falling back to UTF-8 (never throws). */
export function decodeCharset(bytes: Uint8Array, charset: string | null | undefined): string {
  const label = (charset ?? "utf-8").trim().replace(/^"|"$/g, "").toLowerCase() || "utf-8";
  try { return new TextDecoder(label, {fatal: false}).decode(bytes); } catch { return new TextDecoder("utf-8").decode(bytes); }
}

const charsetOf = (contentType: string | null) => /charset\s*=\s*"?([A-Za-z0-9_.:-]{1,40})"?/i.exec(contentType ?? "")?.[1] ?? null;

/** RFC 2047 encoded words (=?UTF-8?B?…?= and =?ISO-8859-1?Q?…?=) in a header value. */
export function decodeEncodedWords(value: string): string {
  return value.replace(/=\?([^?\s]{1,40})\?([BbQq])\?([^?\s]*)\?=(\s+(?==\?))?/g, (_whole, charset: string, encoding: string, text: string) => {
    if (encoding.toUpperCase() === "B") return decodeCharset(new Uint8Array(Buffer.from(text, "base64")), charset);
    const bytes: number[] = [];
    const source = text.replace(/_/g, " ");
    for (let index = 0; index < source.length; index++) {
      if (source[index] === "=" && /^[0-9A-Fa-f]{2}$/.test(source.slice(index + 1, index + 3))) { bytes.push(parseInt(source.slice(index + 1, index + 3), 16)); index += 2; }
      else bytes.push(source.charCodeAt(index) & 0xff);
    }
    return decodeCharset(new Uint8Array(bytes), charset);
  });
}

const controls = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u200b-\u200f\u202a-\u202e\u2066-\u2069]/g;
const clean = (value: string) => value.replace(controls, "");

// --- Addresses --------------------------------------------------------------------------------
export interface Mailbox { address: string; name: string | null }

/** Splits an address list on commas outside quotes and angle brackets. */
function splitAddresses(value: string): string[] {
  const items: string[] = [];
  let current = "", quoted = false, angle = 0;
  for (const char of value) {
    if (char === "\"") quoted = !quoted;
    else if (!quoted && char === "<") angle += 1;
    else if (!quoted && char === ">") angle = Math.max(0, angle - 1);
    if (char === "," && !quoted && angle === 0) { items.push(current); current = ""; } else current += char;
  }
  items.push(current);
  return items.map(item => item.trim()).filter(Boolean);
}

/** The first valid mailbox in a header ("Name <a@b.example>" or a bare address); the name is untrusted text. */
export function parseMailbox(value: string | null | undefined): Mailbox | null {
  for (const item of splitAddresses(decodeEncodedWords(value ?? "")).slice(0, 50)) {
    const address = normalizeEmailIdentity(item);
    if (!address) continue;
    const name = clean(item.replace(/<[^<>]*>\s*$/, "").trim().replace(/^"(.*)"$/, "$1").replace(/\\(.)/g, "$1")).replace(/\s+/g, " ").trim().slice(0, 160);
    return {address, name: name && name.toLowerCase() !== address ? name : null};
  }
  return null;
}
export function parseMailboxes(value: string | null | undefined): string[] {
  return splitAddresses(decodeEncodedWords(value ?? "")).slice(0, 100).map(item => normalizeEmailIdentity(item)).filter((item): item is string => Boolean(item));
}

// --- HTML to text -----------------------------------------------------------------------------
const ENTITIES: Record<string, string> = {amp: "&", lt: "<", gt: ">", quot: "\"", apos: "'", nbsp: " ", ndash: "–", mdash: "—", hellip: "…", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", copy: "©", reg: "®", trade: "™", euro: "€", pound: "£", bull: "•", middot: "·", zwnj: "", zwj: ""};

export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]{1,6}|#\d{1,7}|[a-z]{2,8});/gi, (whole, entity: string) => {
    if (entity[0] === "#") {
      const code = entity[1] === "x" || entity[1] === "X" ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff) ? String.fromCodePoint(code) : "";
    }
    return ENTITIES[entity.toLowerCase()] ?? whole;
  });
}

/**
 * Readable plain text from email HTML. The result is only ever shown as text,
 * so this aims at legibility: scripts, styles, comments and head are removed,
 * blocks become line breaks, a link keeps its address in brackets, and every
 * other tag is dropped. Images and remote content are never fetched.
 */
export function htmlToText(html: string): string {
  let text = html.slice(0, 400_000)
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|head|title|noscript|template|svg|object|iframe)\b[\s\S]*?<\/\1\s*>/gi, " ")
    .replace(/<a\b[^>]*?\bhref\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))[^>]*>([\s\S]*?)<\/a\s*>/gi, (_whole, _quoted, double: string, single: string, bare: string, inner: string) => {
      const href = decodeEntities((double ?? single ?? bare ?? "").trim());
      const label = inner.replace(/<[^>]*>/g, "").trim();
      const shown = /^https?:\/\//i.test(href) ? href.slice(0, 300) : /^mailto:/i.test(href) ? href.slice(7, 260) : "";
      return shown && decodeEntities(label) !== shown ? `${label} [${shown}]` : label || shown;
    })
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<li\b[^>]*>/gi, "\n• ")
    .replace(/<\/(p|div|tr|ul|ol|table|blockquote|h[1-6]|section|article|header|footer)\s*>/gi, "\n")
    .replace(/<(p|div|tr|table|blockquote|h[1-6]|section|article|header|footer|hr)\b[^>]*>/gi, "\n")
    .replace(/<\/(td|th)\s*>/gi, " ")
    .replace(/<[^>]*>/g, "");
  text = decodeEntities(text);
  return tidy(text);
}

function tidy(text: string) {
  return clean(text.replace(/\r\n?/g, "\n")).split("\n").map(line => line.replace(/[ \t\u00a0]+/g, " ").trim()).join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

// --- Quoted history ---------------------------------------------------------------------------
const QUOTE_HEADERS = [
  /^on\s.{4,300}\swrote:\s*$/i,
  /^le\s.{4,300}\sa écrit\s*:\s*$/i,
  /^am\s.{4,300}\sschrieb\s.{0,200}:\s*$/i,
  /^في\s.{4,300}كتب.{0,200}:?\s*$/,
  /^-{2,}\s*original message\s*-{2,}\s*$/i,
  /^-{2,}\s*forwarded message\s*-{2,}\s*$/i,
  /^_{8,}\s*$/,
];
const SIGNATURE = /^(--\s?|sent from my (iphone|ipad|android|samsung|mobile).*|get outlook for (ios|android).*|أرسلت من .*)$/i;

/** The new part of a reply: quoted history and the standard signature delimiter are cut, unless nothing would remain. */
export function cutQuotedHistory(text: string): {text: string; cut: boolean} {
  const lines = text.split("\n");
  let end = lines.length;
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index].trim();
    const joined = `${line} ${(lines[index + 1] ?? "").trim()}`.trim();
    const outlook = /^from:\s.+/i.test(line) && lines.slice(index + 1, index + 5).some(next => /^(sent|date|to|subject):\s/i.test(next.trim()));
    if (QUOTE_HEADERS.some(pattern => pattern.test(line) || (index + 1 < lines.length && pattern.test(joined))) || outlook || SIGNATURE.test(line)) { end = index; break; }
    if (line.startsWith(">") && lines.slice(index).every(rest => !rest.trim() || rest.trim().startsWith(">"))) { end = index; break; }
  }
  const kept = tidy(lines.slice(0, end).join("\n"));
  return kept ? {text: kept, cut: end < lines.length} : {text: tidy(text), cut: false};
}

// --- Message bodies ---------------------------------------------------------------------------
export interface EmailAttachmentPart { partId: string; fileName: string; mimeType: string; sizeBytes: number; attachmentId: string | null; inlineData: string | null }

/** Walks the MIME tree: the first text/plain and text/html bodies, and real attachments (bounded). */
export function messageParts(payload: GmailPart | undefined) {
  let plain: string | null = null, html: string | null = null;
  const attachments: EmailAttachmentPart[] = [];
  const visit = (part: GmailPart | undefined, depth: number) => {
    if (!part || depth > 12 || attachments.length >= 20) return;
    const type = (part.mimeType ?? "").toLowerCase();
    const disposition = header(part.headers, "content-disposition") ?? "";
    if (part.filename || /^attachment/i.test(disposition)) {
      if (part.body?.attachmentId || part.body?.data) attachments.push({
        partId: String(part.partId ?? attachments.length).slice(0, 20), fileName: clean(decodeEncodedWords(part.filename ?? "")).slice(0, 200), mimeType: type.slice(0, 100),
        sizeBytes: Math.max(0, Number(part.body?.size ?? 0) || 0), attachmentId: part.body?.attachmentId ?? null, inlineData: part.body?.attachmentId ? null : part.body?.data ?? null,
      });
      return;
    }
    if (type === "text/plain" && plain === null && part.body?.data) plain = decodeCharset(decodeBase64Url(part.body.data), charsetOf(header(part.headers, "content-type")));
    else if (type === "text/html" && html === null && part.body?.data) html = decodeCharset(decodeBase64Url(part.body.data), charsetOf(header(part.headers, "content-type")));
    for (const child of (part.parts ?? []).slice(0, 50)) visit(child, depth + 1);
  };
  visit(payload, 0);
  return {plain: plain as string | null, html: html as string | null, attachments};
}

/** The message as bounded plain text, preferring the text part, with quoted history cut. */
export function messageText(payload: GmailPart | undefined): string {
  const {plain, html} = messageParts(payload);
  const raw = plain?.trim() ? tidy(plain) : html ? htmlToText(html) : "";
  return cutQuotedHistory(raw).text.slice(0, MAX_EMAIL_TEXT);
}

// --- Automated mail ---------------------------------------------------------------------------
const SKIPPED_LABELS = ["SPAM", "TRASH", "DRAFT", "CATEGORY_PROMOTIONS", "CATEGORY_SOCIAL", "CATEGORY_UPDATES", "CATEGORY_FORUMS"];
const ROBOT_SENDER = /^(no-?reply|do-?not-?reply|donotreply|mailer-daemon|postmaster|bounces?|notifications?|newsletter|news|marketing|info-noreply)([+._-].*)?@/i;

/** Why a message is not imported, or null when it is a person writing. */
export function automatedReason(message: GmailMessage, mailboxAddress: string): string | null {
  const labels = message.labelIds ?? [];
  const skipped = labels.find(label => SKIPPED_LABELS.includes(label));
  if (skipped) return `LABEL_${skipped}`;
  if (!labels.includes("INBOX")) return "NOT_IN_INBOX";
  const headers = message.payload?.headers;
  if (header(headers, "x-estateos-message")) return "OWN_MESSAGE";
  if (header(headers, "list-unsubscribe") || header(headers, "list-id")) return "MAILING_LIST";
  if (/^(bulk|list|junk|auto_reply)$/i.test(header(headers, "precedence")?.trim() ?? "")) return "BULK";
  const auto = header(headers, "auto-submitted")?.trim().toLowerCase();
  if (auto && auto !== "no") return "AUTO_SUBMITTED";
  if (header(headers, "x-autoreply") || header(headers, "x-autorespond")) return "AUTO_REPLY";
  if ((header(headers, "return-path") ?? "").trim() === "<>") return "BOUNCE";
  const from = parseMailbox(header(headers, "from"));
  if (!from) return "NO_SENDER";
  if (from.address === mailboxAddress.toLowerCase()) return "FROM_SELF";
  if (ROBOT_SENDER.test(from.address)) return "ROBOT_SENDER";
  return null;
}

// --- Normalized message -----------------------------------------------------------------------
const MESSAGE_ID = /^<[^<>\s]{3,250}>$/;
export const internetMessageIdOf = (value: string | null | undefined) => {
  const id = (value ?? "").trim().split(/\s+/)[0] ?? "";
  return MESSAGE_ID.test(id) ? id : null;
};

export function normalizeGmailMessage(message: GmailMessage, now = Date.now()) {
  const headers = message.payload?.headers;
  const from = parseMailbox(header(headers, "from"));
  const internal = Number(message.internalDate);
  const timestamp = Number.isFinite(internal) && internal > 0 ? new Date(Math.min(internal, now + 5 * 60_000)).toISOString() : null;
  return {
    externalMessageId: String(message.id ?? "").slice(0, 200),
    threadId: `gmail:${String(message.threadId ?? message.id ?? "").slice(0, 180)}`,
    from: {email: from?.address ?? null, name: from?.name ?? null},
    to: parseMailboxes(header(headers, "to"))[0] ?? null,
    subject: clean(decodeEncodedWords(header(headers, "subject") ?? "")).replace(/\s+/g, " ").trim().slice(0, 300) || null,
    internetMessageId: internetMessageIdOf(header(headers, "message-id")),
    text: messageText(message.payload),
    timestamp,
    attachments: messageParts(message.payload).attachments,
  };
}

// --- Outgoing replies -------------------------------------------------------------------------
/** A header value with every line break and control character removed. */
export const headerValue = (value: string) => value.replace(/[\r\n]+/g, " ").replace(controls, "").trim();

/** An RFC 2047 encoded word when the value is not plain ASCII. */
export function encodeHeaderText(value: string): string {
  const safe = headerValue(value);
  return /^[\x20-\x7e]*$/.test(safe) ? safe : `=?UTF-8?B?${Buffer.from(safe, "utf8").toString("base64")}?=`;
}

export function replySubject(subject: string | null | undefined): string {
  const base = headerValue(subject ?? "").slice(0, 250);
  if (!base) return "Re: Your enquiry";
  return /^(re|aw|sv|rv)\s*:/i.test(base) ? base : `Re: ${base}`;
}

export interface ReplyMessage {
  from: string; fromName?: string | null; to: string; subject: string; text: string;
  inReplyTo?: string | null; references?: string[]; estateosMessageId: string; date?: Date;
}

/** The raw RFC 5322 message (base64url), plain text in UTF-8. Refuses invalid addresses or IDs. */
export function buildReplyMessage(input: ReplyMessage): string {
  const from = normalizeEmailIdentity(input.from), to = normalizeEmailIdentity(input.to);
  if (!from || !to) throw new Error("A valid sender and recipient address are required.");
  if (!/^[A-Za-z0-9-]{8,64}$/.test(input.estateosMessageId)) throw new Error("Invalid EstateOS message ID.");
  const inReplyTo = internetMessageIdOf(input.inReplyTo);
  const references = [...new Set((input.references ?? []).map(internetMessageIdOf).filter((id): id is string => Boolean(id)))].slice(-10);
  if (inReplyTo && !references.includes(inReplyTo)) references.push(inReplyTo);
  const domain = from.split("@")[1];
  const name = input.fromName ? headerValue(input.fromName).replace(/["\\]/g, "").slice(0, 80) : "";
  const body = Buffer.from(input.text.replace(/\r\n?/g, "\n").replace(/\n/g, "\r\n"), "utf8").toString("base64").replace(/.{1,76}/g, "$&\r\n");
  const lines = [
    `From: ${name ? `${/^[\x20-\x7e]*$/.test(name) ? `"${name}"` : encodeHeaderText(name)} <${from}>` : from}`,
    `To: ${to}`,
    `Subject: ${encodeHeaderText(input.subject)}`,
    `Date: ${(input.date ?? new Date()).toUTCString().replace("GMT", "+0000")}`,
    `Message-ID: <estateos.${input.estateosMessageId}@${domain}>`,
    ...(inReplyTo ? [`In-Reply-To: ${inReplyTo}`] : []),
    ...(references.length ? [`References: ${references.join(" ")}`] : []),
    `X-EstateOS-Message: ${input.estateosMessageId}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
  ];
  return Buffer.from(`${lines.join("\r\n")}\r\n\r\n${body}`, "utf8").toString("base64url");
}

// --- Import decision --------------------------------------------------------------------------
export type MailboxMatch = {status: "MATCHED"; contactId: string; leadId: string | null} | {status: "AMBIGUOUS" | "UNKNOWN"};
export type ImportDecision =
  | {import: true; link: {contactId: string | null; leadId: string | null; assignedMembershipId: string | null} | null}
  | {import: false; reason: string};

/**
 * Whether a mailbox message enters EstateOS. Automated mail never does. A company
 * mailbox imports every person writing (unknown senders wait for matching). A
 * personal mailbox imports only CRM customers: a thread already in EstateOS, or a
 * sender matching exactly one contact. The conversation is then assigned to the
 * mailbox owner; the lead's own assignment is never changed.
 */
export function mailboxImportDecision(input: {automated: string | null; ownerMembershipId: string | null; existingThread: boolean; match: MailboxMatch | null}): ImportDecision {
  if (input.automated) return {import: false, reason: input.automated};
  if (!input.ownerMembershipId || input.existingThread) return {import: true, link: null};
  if (input.match?.status !== "MATCHED") return {import: false, reason: "NOT_A_CRM_CONTACT"};
  return {import: true, link: {contactId: input.match.contactId, leadId: input.match.leadId, assignedMembershipId: input.ownerMembershipId}};
}

// --- Email HTML (shown only inside a sandboxed frame) ----------------------------------------
export const MAX_EMAIL_HTML = 400_000;
const BLOCKED_ELEMENTS = /<(script|iframe|frame|frameset|object|embed|applet|noembed|template|xml|title|audio|video|canvas|math|portal)\b[\s\S]*?<\/\1\s*>/gi;
const BLOCKED_TAGS = /<\/?(script|iframe|frame|frameset|object|embed|applet|meta|link|base|form|input|button|select|option|optgroup|textarea|keygen|isindex|noscript|html|head|body|title|audio|video|source|track|canvas|portal|param)\b[^>]*>/gi;
const URL_ATTRIBUTES = /\s(href|src|background|poster|action|formaction|xlink:href|lowsrc|dynsrc|longdesc|cite|data)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi;
const SAFE_LINK = /^(https?:|mailto:|tel:|#)/i;
const SAFE_IMAGE = /^(https?:|cid:|data:image\/(png|gif|jpe?g|webp);base64,)/i;
const UNSAFE_CSS = /(expression\s*\(|javascript\s*:|vbscript\s*:|behavior\s*:|-moz-binding|@import|<\/?\s*style)/gi;
/** The same check without the global flag (a global pattern's test() keeps state between calls). */
const UNSAFE_CSS_TEST = new RegExp(UNSAFE_CSS.source, "i");

const unquote = (value: string) => value.replace(/^["']|["']$/g, "");

/** CSS from the email, without imports, bindings or script URLs, unable to close its style element. */
export function sanitizeEmailCss(css: string): string {
  // Whole @import rules go (they would load another stylesheet); other unsafe constructs are neutralised.
  return css.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/@import\b[^;]*;?/gi, " ").replace(UNSAFE_CSS, "/*removed*/").replace(/</g, "\\3C ").slice(0, 100_000);
}

/**
 * Email HTML cleaned for display (docs/INBOX_SECURITY.md#safe-rendering). The real
 * boundary is the sandboxed frame it is shown in (no scripts, its own content
 * policy, remote images only on request); this removes everything active as
 * well: scripts, frames, plugins, forms, meta refreshes, base URLs, event
 * handlers, srcdoc and every link or image URL that is not http(s), mail or a
 * plain inline image. Returns the body and the email's own styles, or null when
 * there is nothing usable or it is too large.
 */
export function sanitizeEmailHtml(html: string | null | undefined): {body: string; css: string} | null {
  if (!html || !html.trim() || html.length > MAX_EMAIL_HTML * 2) return null;
  let source = html.replace(/<!--[\s\S]*?-->/g, "").replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, "").replace(/<!doctype[^>]*>/gi, "").replace(/<\?[\s\S]*?\?>/g, "");
  const css: string[] = [];
  source = source.replace(/<style\b[^>]*>([\s\S]*?)<\/style\s*>/gi, (_whole, content: string) => { css.push(sanitizeEmailCss(content)); return ""; });
  const body = /<body\b[^>]*>([\s\S]*?)(<\/body\s*>|$)/i.exec(source);
  source = (body ? body[1] : source.replace(/<head\b[\s\S]*?<\/head\s*>/gi, ""));
  for (let pass = 0; pass < 3; pass++) source = source.replace(BLOCKED_ELEMENTS, "");
  source = source
    .replace(BLOCKED_TAGS, "")
    .replace(/\s(on[a-z]+|srcdoc|srcset|http-equiv|formaction|ping|nonce|integrity)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/\s(on[a-z]+)(?=[\s>/])/gi, "")
    .replace(URL_ATTRIBUTES, (whole, name: string, raw: string) => {
      const value = decodeEntities(unquote(raw)).replace(/[\u0000- ]+/g, "");
      const attribute = name.toLowerCase();
      const allowed = attribute === "href" ? SAFE_LINK.test(value) : attribute === "src" || attribute === "background" ? SAFE_IMAGE.test(value) : false;
      return allowed ? ` ${attribute}="${value.replace(/"/g, "&quot;")}"` : "";
    })
    .replace(/\sstyle\s*=\s*("[^"]*"|'[^']*')/gi, (whole, raw: string) => UNSAFE_CSS_TEST.test(decodeEntities(unquote(raw))) ? "" : whole)
    .replace(/<a\b/gi, "<a rel=\"noopener noreferrer\" target=\"_blank\"");
  source = source.trim();
  if (!source || source.length > MAX_EMAIL_HTML) return null;
  return {body: source, css: css.join("\n").slice(0, 100_000)};
}

/** Whether cleaned HTML would load anything from the internet (shown as "Show images"). */
export const hasRemoteContent = (html: string) => /\s(src|background)\s*=\s*"https?:|url\(\s*['"]?https?:/i.test(html);

/** The stored form: the email's own (cleaned) styles followed by its cleaned body; null when none is usable. */
export function emailHtmlForStorage(payload: GmailPart | undefined): string | null {
  const cleaned = sanitizeEmailHtml(messageParts(payload).html);
  if (!cleaned) return null;
  const stored = `${cleaned.css ? `<style>${cleaned.css}</style>` : ""}${cleaned.body}`;
  return stored.length <= MAX_EMAIL_HTML ? stored : null;
}
