import "server-only";

import { createHash } from "node:crypto";
import { getFirebaseAdminStorageBucket } from "@/lib/firebase/admin";
import { sdk, serverDataConnect } from "@/modules/communications/server/data";
import { canonicalUuid } from "@/modules/organizations/server/identifiers";
import { attachmentFileName, attachmentPath, MAX_ATTACHMENT_BYTES, sniffAttachment } from "../attachments";
import { MEDIA_MAX_AGE_MS, mediaBackoffMs } from "../whatsapp-media";
import { channelAccessToken } from "./channel-credentials";
import { downloadWhatsAppMedia, whatsappMediaLookup } from "./whatsapp-cloud";

/*
 * Downloading the photos and documents customers send on WhatsApp (Phase 7B.2,
 * docs/WHATSAPP_INTEGRATION_PLAN.md#media). Run just after a webhook is answered and
 * on every worker tick for anything still pending. Each file is claimed first
 * (compare-and-set), so two runs never fetch it at once; it is fetched only from
 * Meta's media hosts, checked against Meta's sha256 and by its content, and stored
 * privately like any other attachment. A file whose content is not allowed is never
 * stored. Failures are retried with growing waits; final ones are recorded.
 */

const BATCH = 5;
type Row = Awaited<ReturnType<typeof sdk.pendingInboxMedia>>["data"]["attachments"][number];
type Outcome = "STORED" | "BUSY" | "RETRY" | "FAILED";
const log = (event: string, detail: Record<string, unknown>) => console.info(JSON.stringify({event: `inbox.media.${event}`, ...detail}));

async function fail(organizationId: string, id: string, error: string, final: boolean): Promise<Outcome> {
  await sdk.failInboxMedia(serverDataConnect(), {organizationId, id, error: error.slice(0, 64), final}).catch(() => undefined);
  log(final ? "failed" : "retry", {attachmentId: id, error});
  return final ? "FAILED" : "RETRY";
}

async function fetchOne(row: Row): Promise<Outcome> {
  const organizationId = canonicalUuid(row.organizationId), id = canonicalUuid(row.id);
  const dc = serverDataConnect();
  try {
    await sdk.claimInboxMediaFetch(dc, {organizationId, id, expectedAttempts: row.mediaFetchAttempts, nextAttemptAt: new Date(Date.now() + mediaBackoffMs(row.mediaFetchAttempts)).toISOString()});
  } catch { return "BUSY"; }
  const connection = row.message.conversation.channelConnection;
  const token = connection ? await channelAccessToken(organizationId, connection) : null;
  if (!token || !row.providerMediaId) return fail(organizationId, id, "NO_TOKEN", false);
  const lookup = await whatsappMediaLookup(token, row.providerMediaId);
  if (!lookup.ok) {
    // Meta no longer has it (expired or never was): final. Anything else is tried again later.
    const gone = lookup.status === 404 || (lookup.status === 400 && lookup.code === "100");
    return fail(organizationId, id, gone ? "EXPIRED" : `META_${lookup.code}`, gone);
  }
  if (lookup.sizeBytes && lookup.sizeBytes > MAX_ATTACHMENT_BYTES) return fail(organizationId, id, "TOO_LARGE", true);
  const download = await downloadWhatsAppMedia(token, lookup.url, MAX_ATTACHMENT_BYTES);
  if (!download.ok) return fail(organizationId, id, download.code === "TOO_LARGE" || download.code === "URL_NOT_ALLOWED" ? download.code : `DOWNLOAD_${download.code}`,
    download.code === "TOO_LARGE" || download.code === "URL_NOT_ALLOWED");
  if (lookup.sha256 && createHash("sha256").update(download.bytes).digest("hex") !== lookup.sha256) return fail(organizationId, id, "CHECKSUM", false);
  // Checked by its content, never by the name or type the sender gave it.
  const type = sniffAttachment(download.bytes, row.fileName);
  if (!type) return fail(organizationId, id, "TYPE_NOT_ALLOWED", true);
  const storagePath = attachmentPath(organizationId, id, type.extension);
  await getFirebaseAdminStorageBucket().file(storagePath).save(Buffer.from(download.bytes), {resumable: false,
    metadata: {contentType: type.mimeType, cacheControl: "private, no-store", metadata: {estateosInboxAttachmentId: id}}});
  await sdk.storeInboxMedia(dc, {organizationId, id, storagePath, mimeType: type.mimeType, sizeBytes: download.bytes.byteLength, fileName: attachmentFileName(row.fileName, type)});
  log("stored", {attachmentId: id, bytes: download.bytes.byteLength});
  return "STORED";
}

/** Downloads due WhatsApp media (the worker tick, and just after a webhook). Never throws. */
export async function fetchPendingWhatsAppMedia(limit = BATCH) {
  const totals = {stored: 0, retry: 0, failed: 0};
  const now = Date.now();
  const rows = (await sdk.pendingInboxMedia(serverDataConnect(), {now: new Date(now).toISOString(), since: new Date(now - MEDIA_MAX_AGE_MS).toISOString(), limit})).data.attachments;
  for (const row of rows) {
    let outcome: Outcome;
    try { outcome = await fetchOne(row); }
    catch (error) {
      console.warn(JSON.stringify({event: "inbox.media.error", attachmentId: canonicalUuid(row.id), name: error instanceof Error ? error.name : typeof error}));
      outcome = "RETRY";
    }
    if (outcome === "STORED") totals.stored += 1; else if (outcome === "RETRY") totals.retry += 1; else if (outcome === "FAILED") totals.failed += 1;
  }
  return totals;
}
