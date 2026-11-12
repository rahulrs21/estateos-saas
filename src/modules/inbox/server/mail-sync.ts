import "server-only";

import { randomUUID } from "node:crypto";
import { getFirebaseAdminStorageBucket } from "@/lib/firebase/admin";
import { enforceRateLimit } from "@/lib/rate-limit/server";
import { stableUuid } from "@/modules/automations/ids";
import { asServer, isAdministrator, sdk, serverDataConnect, type Context } from "@/modules/communications/server/data";
import { idSchema, parseInput } from "@/modules/communications/server/validation";
import { WorkspaceError } from "@/modules/organizations/server/errors";
import { canonicalUuid } from "@/modules/organizations/server/identifiers";
import type { NormalizedAttachment, NormalizedEvent } from "../adapters/types";
import { attachmentFileName, attachmentPath, MAX_ATTACHMENT_BYTES, sniffAttachment } from "../attachments";
import { automatedReason, decodeBase64Url, emailHtmlForStorage, header, mailboxImportDecision, normalizeGmailMessage, parseMailbox } from "../email";
import { normalizeOutlookMessage, outlookAutomatedReason, outlookCursorAfter, outlookFileAttachments, outlookHtmlForStorage, outlookSince, outlookThreadId } from "../outlook";
import { storeMessageHtml } from "./email-html";
import { gmailAttachment, gmailHistory, gmailMessage, gmailMessageHeaders, gmailProfile, gmailRecent } from "./google";
import { findConversation, matchIdentity } from "./ingest";
import { forgetMailboxAccess, mailboxAccessToken, mailboxGrant, providerLabel, withdrawGrant, type MailProvider } from "./mailboxes";
import { outlookAttachment, outlookAttachments, outlookInboxPage, outlookMessage, outlookMessageHeaders } from "./microsoft";
import { receiveEvent } from "./webhooks";

/*
 * Mailbox sync (docs/EMAIL_INTEGRATION_PLAN.md#sync), run by the worker tick about
 * once a minute: no push subscription and no public webhook. Each mailbox is synced
 * under a lease, so parallel ticks never share one. Gmail is read from its history
 * (an expired cursor falls back to a bounded resync); Microsoft 365 from the Inbox
 * by received time. The first sync imports the last few days (bounded). Each
 * message is first judged by its headers alone, so automated mail, and in a
 * personal mailbox anyone who is not a CRM customer, is skipped before any content
 * is fetched and leaves no record. Accepted messages go through the same durable,
 * deduplicated event pipeline as webhooks; the cursor advances only once every
 * message has been recorded.
 */

const BATCH = 5;
const LEASE_MS = 4 * 60_000;
const NEXT_SYNC_MS = 60_000;
const MAX_MESSAGES = 40;
const MAX_HISTORY_PAGES = 5;
const BACKFILL = {query: "newer_than:3d", max: 30};
const RESYNC = {query: "newer_than:1d", max: 30};
const SYNC_NOW_LIMIT = {scope: "inbox.mailbox.sync", limit: 6, windowSeconds: 60};

type Row = NonNullable<Awaited<ReturnType<typeof sdk.mailboxSyncRow>>["data"]["account"]>;
type Failure = {ok: false; status: number; code: string; message: string};
class SyncError extends Error { constructor(public readonly code: string, public readonly reconnect = false) { super(code); } }

const log = (event: string, detail: Record<string, unknown>) => console.info(JSON.stringify({event: `inbox.mailbox.${event}`, ...detail}));
const backoff = (failures: number) => Math.min(60 * 60_000, NEXT_SYNC_MS * 2 ** Math.min(failures, 6));
/** A provider refusal; a refused or withdrawn grant means the mailbox must be reconnected. */
const fail = (result: Failure, provider: MailProvider): never => {
  const prefix = provider === "GMAIL" ? "GOOGLE" : "MICROSOFT";
  throw new SyncError(`${prefix}_${result.code}`.slice(0, 64), result.code === "invalid_grant" || result.code === "UNAUTHENTICATED" || result.code === "InvalidAuthenticationToken" || result.status === 401);
};
const okData = <T>(result: {ok: true; data: T} | Failure, provider: MailProvider): T => result.ok ? result.data : fail(result, provider);

/** Which messages to look at, and the cursor to store once they are all recorded. */
type Changes = {ids: string[]; historyId: string; truncated: boolean};

// --- Gmail ----------------------------------------------------------------------------------------

async function gmailChanges(token: string, row: Row): Promise<Changes> {
  const collected: Array<{id: string; historyId: string | null}> = [];
  let latest = row.historyId ?? null;
  if (latest) {
    let pageToken: string | null = null, expired = false;
    for (let page = 0; page < MAX_HISTORY_PAGES; page++) {
      const result = await gmailHistory(token, row.historyId!, pageToken);
      if (!result.ok && result.status === 404) { expired = true; break; }
      const data = okData(result, "GMAIL");
      for (const record of data.history ?? []) for (const added of record.messagesAdded ?? []) {
        if (added.message?.id && (added.message.labelIds ?? ["INBOX"]).includes("INBOX")) collected.push({id: added.message.id, historyId: (record as {id?: string}).id ?? null});
      }
      if (data.historyId) latest = String(data.historyId);
      pageToken = data.nextPageToken ?? null;
      if (!pageToken) break;
    }
    if (!expired && row.backfilled) {
      const unique = [...new Map(collected.map(item => [item.id, item])).values()];
      if (unique.length <= MAX_MESSAGES && !pageToken) return {ids: unique.map(item => item.id), historyId: latest!, truncated: false};
      // More than one sync's worth: take the first part and resume from the last one taken.
      const taken = unique.slice(0, MAX_MESSAGES);
      return {ids: taken.map(item => item.id), historyId: taken.at(-1)?.historyId ?? row.historyId!, truncated: true};
    }
    if (expired) log("history_expired", {connectionId: canonicalUuid(row.id)});
  }
  // First sync (a bounded backfill) or an expired cursor (a bounded resync), then a fresh cursor.
  const window = row.backfilled ? RESYNC : BACKFILL;
  const recent = okData(await gmailRecent(token, window.query, window.max), "GMAIL");
  const profile = await gmailProfile(token);
  if (!profile.ok) fail(profile, "GMAIL");
  const listed = (recent.messages ?? []).map(item => item.id).filter((id): id is string => Boolean(id)).reverse();
  const ids = [...new Set([...listed, ...collected.map(item => item.id)])].slice(0, MAX_MESSAGES + window.max);
  return {ids, historyId: (profile as Extract<typeof profile, {ok: true}>).historyId, truncated: false};
}

// --- Microsoft 365 ----------------------------------------------------------------------------

/** Inbox messages received since the cursor (oldest first), minus those already imported. */
async function outlookChanges(token: string, row: Row): Promise<Changes> {
  const since = outlookSince(row.historyId, row.backfilled);
  const page = okData(await outlookInboxPage(token, since, MAX_MESSAGES), "MICROSOFT_365");
  const listed = (page.value ?? []).filter((item): item is {id: string; receivedDateTime?: string} => typeof item.id === "string" && item.id.length > 0 && item.id.length <= 200);
  const known = listed.length ? new Set((await asServer("KnownMailboxMessages", dc => sdk.knownMailboxMessages(dc, {organizationId: canonicalUuid(row.organizationId),
    channelConnectionId: canonicalUuid(row.id), externalMessageIds: listed.map(item => item.id)}))).messages.map(item => item.externalMessageId)) : new Set<string>();
  let cursor = outlookCursorAfter(since, listed);
  const truncated = (page.value ?? []).length >= MAX_MESSAGES;
  // A full page all received in the same second must still move on.
  if (truncated && cursor === since) cursor = new Date(Date.parse(since) + 1000).toISOString().replace(/\.\d{3}Z$/, "Z");
  return {ids: listed.filter(item => !known.has(item.id)).map(item => item.id), historyId: cursor, truncated};
}

// --- Shared import ----------------------------------------------------------------------------

/** Stores an attachment privately when its content is an allowed type; otherwise only lists it. */
async function storedAttachment(organizationId: string, key: string, index: number, bytes: Uint8Array, reference: NormalizedAttachment): Promise<NormalizedAttachment> {
  const type = bytes.byteLength && bytes.byteLength <= MAX_ATTACHMENT_BYTES ? sniffAttachment(bytes, reference.fileName ?? "") : null;
  // A file whose content is not an allowed type is listed (so the team knows it existed) but never stored or served.
  if (!type) return reference;
  const attachmentId = stableUuid("inbox-attachment", organizationId, key, String(index));
  const storagePath = attachmentPath(organizationId, attachmentId, type.extension);
  await getFirebaseAdminStorageBucket().file(storagePath).save(Buffer.from(bytes), {resumable: false, metadata: {contentType: type.mimeType, cacheControl: "private, no-store", metadata: {estateosInboxAttachmentId: attachmentId}}});
  return {providerMediaId: reference.providerMediaId, mimeType: type.mimeType, fileName: attachmentFileName(reference.fileName ?? null, type), sizeBytes: bytes.byteLength, stored: {attachmentId, storagePath}};
}

/** Whether a message is imported, judged from its headers (and, for a personal mailbox, the CRM). */
async function importDecision(row: Row, automated: string | null, threadKey: string, sender: string | null) {
  const organizationId = canonicalUuid(row.organizationId), connectionId = canonicalUuid(row.id);
  const ownerMembershipId = row.channelConnection?.ownerMembershipId ? canonicalUuid(row.channelConnection.ownerMembershipId) : null;
  let existingThread = false, match = null as Parameters<typeof mailboxImportDecision>[0]["match"];
  if (!automated && ownerMembershipId) {
    existingThread = Boolean(await findConversation({organizationId, channelConnectionId: connectionId, externalThreadId: threadKey}));
    if (!existingThread && sender) {
      const decision = await matchIdentity(organizationId, {kind: "EMAIL", value: sender});
      match = decision.status === "MATCHED" ? {status: "MATCHED", contactId: decision.contactId, leadId: decision.leadId} : {status: decision.status};
    }
  }
  return mailboxImportDecision({automated, ownerMembershipId, existingThread, match});
}

/** Records the message through the event pipeline, then keeps its cleaned formatted version. */
async function record(row: Row, provider: MailProvider, event: NormalizedEvent, html: string | null) {
  const organizationId = canonicalUuid(row.organizationId), connectionId = canonicalUuid(row.id);
  const outcome = await receiveEvent({organizationId, id: connectionId, provider}, event, {payloadDigest: null, simulated: false});
  if (outcome.status === "FAILED") throw new SyncError(`EVENT_${outcome.errorCode}`.slice(0, 64));
  // The formatted version, cleaned, kept beside the text (shown only in a sandboxed frame).
  if (outcome.status === "PROCESSED" && outcome.messageId) await storeMessageHtml(organizationId, outcome.messageId, html);
  return outcome.status === "PROCESSED" ? "IMPORTED" : outcome.status;
}

async function importGmailMessage(token: string, row: Row, mailbox: string, messageId: string) {
  const organizationId = canonicalUuid(row.organizationId);
  const meta = await gmailMessageHeaders(token, messageId);
  if (!meta.ok && meta.status === 404) return "GONE";
  const headers = okData(meta, "GMAIL");
  const decision = await importDecision(row, automatedReason(headers, mailbox), `gmail:${String(headers.threadId ?? headers.id ?? "").slice(0, 180)}`,
    parseMailbox(header(headers.payload?.headers, "from"))?.address ?? null);
  if (!decision.import) return decision.reason;
  const full = await gmailMessage(token, messageId);
  if (!full.ok && full.status === 404) return "GONE";
  const fullMessage = okData(full, "GMAIL");
  const message = normalizeGmailMessage(fullMessage);
  if (!message.externalMessageId || !message.from.email) return "NO_SENDER";
  const attachments: NormalizedAttachment[] = [];
  for (const [index, part] of message.attachments.slice(0, 10).entries()) {
    const reference = {providerMediaId: `gmail:${part.attachmentId ?? part.partId}`.slice(0, 200), mimeType: part.mimeType || "application/octet-stream", fileName: part.fileName || null, sizeBytes: part.sizeBytes || null};
    if (part.sizeBytes > MAX_ATTACHMENT_BYTES) { attachments.push(reference); continue; }
    let data = part.inlineData;
    if (!data && part.attachmentId) {
      const fetched = await gmailAttachment(token, message.externalMessageId, part.attachmentId);
      if (!fetched.ok && fetched.status === 404) { attachments.push(reference); continue; }
      data = okData(fetched, "GMAIL").data ?? null;
    }
    attachments.push(await storedAttachment(organizationId, `gmail:${message.externalMessageId}`, index, decodeBase64Url(data), reference));
  }
  return record(row, "GMAIL", {
    kind: "MESSAGE", accountId: mailbox, channel: "EMAIL", externalMessageId: message.externalMessageId, threadId: message.threadId, from: message.from, to: message.to ?? mailbox,
    subject: message.subject, messageType: !message.text && attachments.length ? "DOCUMENT" : "TEXT", text: message.text || null, timestamp: message.timestamp, attachments,
    internetMessageId: message.internetMessageId, link: decision.link,
  }, emailHtmlForStorage(fullMessage.payload));
}

async function importOutlookMessage(token: string, row: Row, mailbox: string, messageId: string) {
  const organizationId = canonicalUuid(row.organizationId);
  const meta = await outlookMessageHeaders(token, messageId);
  if (!meta.ok && meta.status === 404) return "GONE";
  const headers = okData(meta, "MICROSOFT_365");
  const sender = normalizeOutlookMessage(headers).from.email;
  const decision = await importDecision(row, outlookAutomatedReason(headers, mailbox), outlookThreadId(headers), sender);
  if (!decision.import) return decision.reason;
  const full = await outlookMessage(token, messageId);
  if (!full.ok && full.status === 404) return "GONE";
  const fullMessage = okData(full, "MICROSOFT_365");
  const message = normalizeOutlookMessage(fullMessage);
  if (!message.externalMessageId || message.externalMessageId.length > 200) return "BAD_ID";
  if (!message.from.email) return "NO_SENDER";
  const attachments: NormalizedAttachment[] = [];
  if (fullMessage.hasAttachments) {
    const listed = await outlookAttachments(token, message.externalMessageId);
    const files = listed.ok ? outlookFileAttachments(listed.data.value) : listed.status === 404 ? [] : fail(listed, "MICROSOFT_365");
    for (const [index, file] of files.entries()) {
      const reference = {providerMediaId: `m365:${index}:${file.id.slice(-40)}`.slice(0, 200), mimeType: file.mimeType || "application/octet-stream", fileName: file.fileName || null, sizeBytes: file.sizeBytes || null};
      if (file.sizeBytes > MAX_ATTACHMENT_BYTES) { attachments.push(reference); continue; }
      const fetched = await outlookAttachment(token, message.externalMessageId, file.id);
      if (!fetched.ok && fetched.status === 404) { attachments.push(reference); continue; }
      const bytes = Buffer.from(okData(fetched, "MICROSOFT_365").contentBytes ?? "", "base64");
      attachments.push(await storedAttachment(organizationId, `m365:${message.externalMessageId}`, index, new Uint8Array(bytes), reference));
    }
  }
  return record(row, "MICROSOFT_365", {
    kind: "MESSAGE", accountId: mailbox, channel: "EMAIL", externalMessageId: message.externalMessageId, threadId: message.threadId, from: message.from, to: message.to ?? mailbox,
    subject: message.subject, messageType: !message.text && attachments.length ? "DOCUMENT" : "TEXT", text: message.text || null, timestamp: message.timestamp, attachments,
    internetMessageId: message.internetMessageId, link: decision.link,
  }, outlookHtmlForStorage(fullMessage.body));
}

const SYNCERS: Record<MailProvider, {changes: (token: string, row: Row) => Promise<Changes>; importMessage: (token: string, row: Row, mailbox: string, id: string) => Promise<string>}> = {
  GMAIL: {changes: gmailChanges, importMessage: importGmailMessage},
  MICROSOFT_365: {changes: outlookChanges, importMessage: importOutlookMessage},
};

/** One mailbox under its lease. Never throws: failures are recorded and retried with growing delays. */
async function syncOne(row: Row) {
  const organizationId = canonicalUuid(row.organizationId), id = canonicalUuid(row.id);
  const connection = row.channelConnection;
  const mailbox = connection?.externalAccountReference ?? "";
  const provider = connection?.provider === "GMAIL" || connection?.provider === "MICROSOFT_365" ? connection.provider as MailProvider : null;
  if (!connection || !provider || connection.connectionStatus !== "VERIFIED" || !mailbox) return {status: "SKIPPED" as const};
  if (connection.ownerMembershipId && connection.ownerMembership?.status !== "ACTIVE") {
    // The owner left: stop importing their mailbox and withdraw the grant where the provider allows it.
    const grant = mailboxGrant(organizationId, id, row);
    if (grant) await withdrawGrant(provider, grant);
    await asServer("RetireMailbox", dc => sdk.retireMailbox(dc, {organizationId, id}));
    forgetMailboxAccess(id);
    log("retired", {connectionId: id});
    return {status: "RETIRED" as const};
  }
  const leaseId = randomUUID(), now = Date.now();
  try {
    await sdk.claimMailboxSync(serverDataConnect(), {organizationId, id, leaseId, now: new Date(now).toISOString(), leaseUntil: new Date(now + LEASE_MS).toISOString()});
  } catch { return {status: "BUSY" as const}; }
  const counts: Record<string, number> = {};
  try {
    const access = await mailboxAccessToken(organizationId, id, provider, row);
    if (!access.ok) {
      if (access.code === "GRANT_UNREADABLE") throw new SyncError("GRANT_UNREADABLE", true);
      fail(access, provider);
    }
    const token = (access as {ok: true; token: string}).token;
    const syncer = SYNCERS[provider];
    const {ids, historyId, truncated} = await syncer.changes(token, row);
    for (const messageId of ids) {
      const result = await syncer.importMessage(token, row, mailbox, messageId);
      counts[result] = (counts[result] ?? 0) + 1;
    }
    await asServer("FinishMailboxSync", dc => sdk.finishMailboxSync(dc, {organizationId, id, leaseId, historyId, backfilled: true,
      nextSyncAt: new Date(Date.now() + (truncated ? 0 : NEXT_SYNC_MS)).toISOString(), imported: Boolean(counts.IMPORTED)}));
    log("synced", {connectionId: id, provider, ...counts});
    return {status: "SYNCED" as const, imported: counts.IMPORTED ?? 0, skipped: Object.entries(counts).filter(([key]) => key !== "IMPORTED").reduce((sum, [, value]) => sum + value, 0)};
  } catch (error) {
    const code = error instanceof SyncError ? error.code : String((error as {code?: unknown})?.code ?? (error as Error)?.name ?? "ERROR").replace(/[^A-Za-z0-9_./-]/g, "_").slice(0, 64);
    const reconnect = error instanceof SyncError && error.reconnect;
    if (reconnect) forgetMailboxAccess(id);
    await asServer("FailMailboxSync", dc => sdk.failMailboxSync(dc, {organizationId, id, leaseId, errorCode: code, needsReconnect: reconnect,
      nextSyncAt: new Date(Date.now() + backoff(row.failures)).toISOString()})).catch(() => undefined);
    console.warn(JSON.stringify({event: "inbox.mailbox.sync_failed", connectionId: id, provider, code, reconnect}));
    return {status: reconnect ? "NEEDS_RECONNECT" as const : "FAILED" as const};
  }
}

/** The worker tick: a few due mailboxes per tick (docs/AUTOMATION_OPERATIONS.md#worker). */
export async function syncMailboxes(limit = BATCH) {
  const due = (await sdk.dueMailboxes(serverDataConnect(), {now: new Date().toISOString(), limit})).data.accounts;
  const totals = {mailboxes: 0, imported: 0, skipped: 0, failed: 0, reconnect: 0, retired: 0};
  for (const row of due) {
    const result = await syncOne(row as Row);
    if (result.status === "SKIPPED" || result.status === "BUSY") continue;
    totals.mailboxes += 1;
    if (result.status === "SYNCED") { totals.imported += result.imported; totals.skipped += result.skipped; }
    else if (result.status === "FAILED") totals.failed += 1;
    else if (result.status === "NEEDS_RECONNECT") totals.reconnect += 1;
    else totals.retired += 1;
  }
  return totals;
}

/** "Check now" for the mailbox's manager or an administrator (rate-limited). */
export async function syncMailboxNow(context: Context, rawId: string) {
  const id = parseInput(idSchema, rawId);
  await enforceRateLimit([{rule: SYNC_NOW_LIMIT, subject: id}], "This mailbox was checked a moment ago. Wait a minute and try again.");
  await asServer("RequestMailboxSync", dc => sdk.requestMailboxSync(dc, {organizationId: context.organizationId, id, actorUid: context.request.user.uid}));
  const row = (await asServer("MailboxSyncRow", dc => sdk.mailboxSyncRow(dc, {organizationId: context.organizationId, id}))).account;
  if (!row) throw new WorkspaceError("NOT_FOUND", 404, "This mailbox was not found.");
  const result = await syncOne(row);
  const label = providerLabel(row.channelConnection?.provider);
  if (result.status === "BUSY") return {id, status: "BUSY", message: "This mailbox is being checked right now."};
  if (result.status === "NEEDS_RECONNECT") throw new WorkspaceError("INBOX_MAILBOX_RECONNECT", 409, isAdministrator(context) ? `${label} no longer accepts this mailbox's sign-in. Its owner must reconnect it.` : `${label} no longer accepts this mailbox's sign-in. Reconnect it.`);
  if (result.status === "FAILED") throw new WorkspaceError("INBOX_MAILBOX_SYNC_FAILED", 503, "The mailbox could not be checked just now. EstateOS will try again shortly.");
  return {id, status: result.status, imported: result.status === "SYNCED" ? result.imported : 0};
}
