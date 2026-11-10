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
import { automatedReason, decodeBase64Url, header, mailboxImportDecision, normalizeGmailMessage, parseMailbox } from "../email";
import { accessTokenFor, forgetAccessTokens, gmailAttachment, gmailHistory, gmailMessage, gmailMessageHeaders, gmailProfile, gmailRecent, revokeGrant, type GoogleFailure } from "./google";
import { findConversation, matchIdentity } from "./ingest";
import { mailboxGrant } from "./mailboxes";
import { receiveEvent } from "./webhooks";

/*
 * Mailbox sync (docs/EMAIL_INTEGRATION_PLAN.md#sync), run by the worker tick about
 * once a minute: no Pub/Sub and no public webhook. Each mailbox is synced under a
 * lease, so parallel ticks never share one. New INBOX messages are read from
 * Gmail's history; an expired cursor falls back to a bounded resync, and the first
 * sync imports the last few days (bounded). Each message is first judged by its
 * headers alone, so automated mail, and in a personal mailbox anyone who is not a
 * CRM customer, is skipped before any content is fetched and leaves no record.
 * Accepted messages go through the same durable, deduplicated event pipeline as
 * webhooks; the cursor advances only once every message has been recorded.
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
class SyncError extends Error { constructor(public readonly code: string, public readonly reconnect = false) { super(code); } }

const log = (event: string, detail: Record<string, unknown>) => console.info(JSON.stringify({event: `inbox.mailbox.${event}`, ...detail}));
const backoff = (failures: number) => Math.min(60 * 60_000, NEXT_SYNC_MS * 2 ** Math.min(failures, 6));
const fail = (result: GoogleFailure): never => {
  throw new SyncError(`GOOGLE_${result.code}`.slice(0, 64), result.code === "invalid_grant" || result.code === "UNAUTHENTICATED" || result.status === 401);
};

/** Message IDs to look at, in order, and the cursor to store once they are all recorded. */
async function changes(token: string, row: Row): Promise<{ids: string[]; historyId: string; truncated: boolean}> {
  const collected: Array<{id: string; historyId: string | null}> = [];
  let latest = row.historyId ?? null;
  if (latest) {
    let pageToken: string | null = null, expired = false;
    for (let page = 0; page < MAX_HISTORY_PAGES; page++) {
      const result = await gmailHistory(token, row.historyId!, pageToken);
      if (!result.ok) { if (result.status === 404) { expired = true; break; } fail(result); }
      const data = (result as Extract<typeof result, {ok: true}>).data;
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
  const recent = await gmailRecent(token, window.query, window.max);
  if (!recent.ok) fail(recent);
  const profile = await gmailProfile(token);
  if (!profile.ok) fail(profile);
  const listed = ((recent as Extract<typeof recent, {ok: true}>).data.messages ?? []).map(item => item.id).filter((id): id is string => Boolean(id)).reverse();
  const ids = [...new Set([...listed, ...collected.map(item => item.id)])].slice(0, MAX_MESSAGES + window.max);
  return {ids, historyId: (profile as Extract<typeof profile, {ok: true}>).historyId, truncated: false};
}

async function attachmentsOf(token: string, organizationId: string, messageId: string, parts: ReturnType<typeof normalizeGmailMessage>["attachments"]): Promise<NormalizedAttachment[]> {
  const files: NormalizedAttachment[] = [];
  for (const [index, part] of parts.slice(0, 10).entries()) {
    const reference = {providerMediaId: `gmail:${part.attachmentId ?? part.partId}`.slice(0, 200), mimeType: part.mimeType || "application/octet-stream", fileName: part.fileName || null, sizeBytes: part.sizeBytes || null};
    if (part.sizeBytes > MAX_ATTACHMENT_BYTES) { files.push(reference); continue; }
    let data = part.inlineData;
    if (!data && part.attachmentId) {
      const fetched = await gmailAttachment(token, messageId, part.attachmentId);
      if (!fetched.ok) { if (fetched.status === 404) { files.push(reference); continue; } fail(fetched); }
      data = (fetched as Extract<typeof fetched, {ok: true}>).data.data ?? null;
    }
    const bytes = decodeBase64Url(data);
    const type = bytes.byteLength && bytes.byteLength <= MAX_ATTACHMENT_BYTES ? sniffAttachment(bytes, part.fileName) : null;
    // A file whose content is not an allowed type is listed (so the team knows it existed) but never stored or served.
    if (!type) { files.push(reference); continue; }
    const attachmentId = stableUuid("inbox-attachment", organizationId, `gmail:${messageId}`, String(index));
    const storagePath = attachmentPath(organizationId, attachmentId, type.extension);
    await getFirebaseAdminStorageBucket().file(storagePath).save(Buffer.from(bytes), {resumable: false, metadata: {contentType: type.mimeType, cacheControl: "private, no-store", metadata: {estateosInboxAttachmentId: attachmentId}}});
    files.push({providerMediaId: reference.providerMediaId, mimeType: type.mimeType, fileName: attachmentFileName(part.fileName, type), sizeBytes: bytes.byteLength, stored: {attachmentId, storagePath}});
  }
  return files;
}

/** Judges one message by its headers, and imports it only when it should be. */
async function importMessage(token: string, row: Row, mailbox: string, messageId: string) {
  const organizationId = canonicalUuid(row.organizationId), connectionId = canonicalUuid(row.id);
  const meta = await gmailMessageHeaders(token, messageId);
  if (!meta.ok) { if (meta.status === 404) return "GONE"; fail(meta); }
  const headers = (meta as Extract<typeof meta, {ok: true}>).data;
  const automated = automatedReason(headers, mailbox);
  const ownerMembershipId = row.channelConnection?.ownerMembershipId ? canonicalUuid(row.channelConnection.ownerMembershipId) : null;
  let existingThread = false, match = null as Parameters<typeof mailboxImportDecision>[0]["match"];
  if (!automated && ownerMembershipId) {
    existingThread = Boolean(await findConversation({organizationId, channelConnectionId: connectionId, externalThreadId: `gmail:${String(headers.threadId ?? headers.id ?? "").slice(0, 180)}`}));
    const sender = parseMailbox(header(headers.payload?.headers, "from"));
    if (!existingThread && sender) {
      const decision = await matchIdentity(organizationId, {kind: "EMAIL", value: sender.address});
      match = decision.status === "MATCHED" ? {status: "MATCHED", contactId: decision.contactId, leadId: decision.leadId} : {status: decision.status};
    }
  }
  const decision = mailboxImportDecision({automated, ownerMembershipId, existingThread, match});
  if (!decision.import) return decision.reason;
  const full = await gmailMessage(token, messageId);
  if (!full.ok) { if (full.status === 404) return "GONE"; fail(full); }
  const message = normalizeGmailMessage((full as Extract<typeof full, {ok: true}>).data);
  if (!message.externalMessageId || !message.from.email) return "NO_SENDER";
  const attachments = await attachmentsOf(token, organizationId, message.externalMessageId, message.attachments);
  const event: NormalizedEvent = {
    kind: "MESSAGE", accountId: mailbox, channel: "EMAIL", externalMessageId: message.externalMessageId, threadId: message.threadId, from: message.from, to: message.to ?? mailbox,
    subject: message.subject, messageType: !message.text && attachments.length ? "DOCUMENT" : "TEXT", text: message.text || null, timestamp: message.timestamp, attachments,
    internetMessageId: message.internetMessageId, link: decision.link,
  };
  const outcome = await receiveEvent({organizationId, id: connectionId, provider: "GMAIL"}, event, {payloadDigest: null, simulated: false});
  if (outcome.status === "FAILED") throw new SyncError(`EVENT_${outcome.errorCode}`.slice(0, 64));
  return outcome.status === "PROCESSED" ? "IMPORTED" : outcome.status;
}

/** One mailbox under its lease. Never throws: failures are recorded and retried with growing delays. */
async function syncOne(row: Row) {
  const organizationId = canonicalUuid(row.organizationId), id = canonicalUuid(row.id);
  const connection = row.channelConnection;
  const mailbox = connection?.externalAccountReference ?? "";
  if (!connection || connection.provider !== "GMAIL" || connection.connectionStatus !== "VERIFIED" || !mailbox) return {status: "SKIPPED" as const};
  if (connection.ownerMembershipId && connection.ownerMembership?.status !== "ACTIVE") {
    // The owner left: stop importing their mailbox and withdraw the grant.
    const grant = mailboxGrant(organizationId, id, row);
    if (grant) await revokeGrant(grant).catch(() => false);
    await asServer("RetireMailbox", dc => sdk.retireMailbox(dc, {organizationId, id}));
    forgetAccessTokens(id);
    log("retired", {connectionId: id});
    return {status: "RETIRED" as const};
  }
  const leaseId = randomUUID(), now = Date.now();
  try {
    await sdk.claimMailboxSync(serverDataConnect(), {organizationId, id, leaseId, now: new Date(now).toISOString(), leaseUntil: new Date(now + LEASE_MS).toISOString()});
  } catch { return {status: "BUSY" as const}; }
  const counts: Record<string, number> = {};
  try {
    const grant = mailboxGrant(organizationId, id, row);
    if (!grant) throw new SyncError("GRANT_UNREADABLE", true);
    const access = await accessTokenFor(id, grant);
    if (!access.ok) fail(access);
    const token = (access as {ok: true; token: string}).token;
    const {ids, historyId, truncated} = await changes(token, row);
    for (const messageId of ids) {
      const result = await importMessage(token, row, mailbox, messageId);
      counts[result] = (counts[result] ?? 0) + 1;
    }
    await asServer("FinishMailboxSync", dc => sdk.finishMailboxSync(dc, {organizationId, id, leaseId, historyId, backfilled: true,
      nextSyncAt: new Date(Date.now() + (truncated ? 0 : NEXT_SYNC_MS)).toISOString(), imported: Boolean(counts.IMPORTED)}));
    log("synced", {connectionId: id, ...counts});
    return {status: "SYNCED" as const, imported: counts.IMPORTED ?? 0, skipped: Object.entries(counts).filter(([key]) => key !== "IMPORTED").reduce((sum, [, value]) => sum + value, 0)};
  } catch (error) {
    const code = error instanceof SyncError ? error.code : String((error as {code?: unknown})?.code ?? (error as Error)?.name ?? "ERROR").replace(/[^A-Za-z0-9_./-]/g, "_").slice(0, 64);
    const reconnect = error instanceof SyncError && error.reconnect;
    if (reconnect) forgetAccessTokens(id);
    await asServer("FailMailboxSync", dc => sdk.failMailboxSync(dc, {organizationId, id, leaseId, errorCode: code, needsReconnect: reconnect,
      nextSyncAt: new Date(Date.now() + backoff(row.failures)).toISOString()})).catch(() => undefined);
    console.warn(JSON.stringify({event: "inbox.mailbox.sync_failed", connectionId: id, code, reconnect}));
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
  if (result.status === "BUSY") return {id, status: "BUSY", message: "This mailbox is being checked right now."};
  if (result.status === "NEEDS_RECONNECT") throw new WorkspaceError("INBOX_MAILBOX_RECONNECT", 409, isAdministrator(context) ? "Google no longer accepts this mailbox's sign-in. Its owner must reconnect it." : "Google no longer accepts this mailbox's sign-in. Reconnect it.");
  if (result.status === "FAILED") throw new WorkspaceError("INBOX_MAILBOX_SYNC_FAILED", 503, "The mailbox could not be checked just now. EstateOS will try again shortly.");
  return {id, status: result.status, imported: result.status === "SYNCED" ? result.imported : 0};
}
