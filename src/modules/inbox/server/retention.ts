import "server-only";

import { getFirebaseAdminStorageBucket } from "@/lib/firebase/admin";
import { sdk, serverDataConnect } from "@/modules/communications/server/data";
import { canonicalUuid } from "@/modules/organizations/server/identifiers";
import { DEFAULT_RETENTION_DAYS, ownedAttachmentPath, retentionCutoff } from "../policy";

/*
 * Inbox retention (docs/INBOX_SECURITY.md#retention). Each company keeps
 * message content for its Inbox settings period (30–3650 days, default 730).
 * The worker removes older message text and attachment files, keeping a record
 * that each message existed ("Removed under the company's retention period"),
 * and clears old previews, the text of finished replies and old Claude analyses.
 * Bounded per tick and safe to repeat: every update only touches rows not yet removed.
 */

async function purge(organizationId: string | null, excluded: string[] | null, before: string, limit: number) {
  const dc = serverDataConnect();
  // Unused filters are left out: an explicit null would filter on null and match nothing.
  const {messages} = (await sdk.inboxRetentionCandidates(dc, {...(organizationId ? {organizationId} : {}), ...(excluded ? {excluded} : {}), before, limit})).data;
  const byCompany = new Map<string, typeof messages>();
  for (const message of messages) {
    const key = canonicalUuid(message.organizationId);
    byCompany.set(key, [...(byCompany.get(key) ?? []), message]);
  }
  let redacted = 0, files = 0;
  for (const [company, rows] of byCompany) {
    const bucket = getFirebaseAdminStorageBucket();
    for (const attachment of rows.flatMap(row => row.attachments)) {
      const path = ownedAttachmentPath(company, attachment.storagePath);
      if (!path) continue;
      // A file already gone is fine; any other failure stops this company until the next tick, so no reference is lost.
      await bucket.file(path).delete({ignoreNotFound: true});
      files += 1;
    }
    const result = (await sdk.applyInboxRetention(dc, {organizationId: company, ids: rows.map(row => canonicalUuid(row.id)), before})).data;
    redacted += result.messages;
  }
  return {redacted, files};
}

/** One bounded retention pass for every company (called by the worker tick). */
export async function applyInboxRetention(now = Date.now(), limit = 100) {
  const {rules} = (await sdk.inboxRetentionRules(serverDataConnect())).data;
  const totals = {companies: 0, redacted: 0, files: 0};
  const add = (result: {redacted: number; files: number}) => { totals.redacted += result.redacted; totals.files += result.files; if (result.redacted) totals.companies += 1; };
  for (const rule of rules) add(await purge(canonicalUuid(rule.organizationId), null, retentionCutoff(rule.retentionDays, now), limit));
  add(await purge(null, rules.map(rule => canonicalUuid(rule.organizationId)), retentionCutoff(DEFAULT_RETENTION_DAYS, now), limit));
  if (totals.redacted) console.info(JSON.stringify({event: "inbox.retention_applied", ...totals}));
  return totals;
}
