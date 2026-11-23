import "server-only";

import * as sdk from "@dataconnect/admin-generated";
import { serverDataConnect } from "@/modules/communications/server/data";
import { canonicalUuid } from "@/modules/organizations/server/identifiers";
import { mapWorkspaceDataError } from "@/modules/organizations/server/errors";
import { listFormLeadIds, listPageForms, MetaGraphError } from "./graph";
import { connectionToken, formFor, processMetaLeadEvent, recordLeadgen } from "./process";

/*
 * The safety net beside webhooks (docs/META_LEAD_ADS_PLAN.md#2-receiving-leads). EstateOS reads each connected
 * Page's forms and their recent leads itself: every 15 minutes from the worker, and on demand ("Import recent leads",
 * and right after a Page is connected). It also works while the Meta app is unpublished, when Meta sends no real
 * webhooks. Each lead is recorded once per company (the leadgen ID is unique), so webhook, poll and import never
 * create a second lead.
 */

const POLL_EVERY_MS = 15 * 60_000;
const OVERLAP_MS = 10 * 60_000;
const FIRST_CHECK_MS = 3 * 86_400_000;
const log = (event: string, detail: Record<string, unknown>) => console.warn(JSON.stringify({event: `lead_ads.${event}`, ...detail}));

async function read<T>(operation: () => Promise<{data: T}>): Promise<T> {
  try { return (await operation()).data; }
  catch (error) { throw mapWorkspaceDataError(error); }
}

export interface PollResult { forms: number; found: number; imported: number; known: number; failed: number; needsReconnect: boolean }

/** Checks one Page's forms for leads created since `since`, recording and importing the new ones. */
export async function pollConnection(organizationId: string, connectionId: string, options: {since: Date; origin: "POLL" | "IMPORT"}): Promise<PollResult> {
  const dc = serverDataConnect();
  const result: PollResult = {forms: 0, found: 0, imported: 0, known: 0, failed: 0, needsReconnect: false};
  const connection = (await read(() => sdk.metaLeadConnectionSecret(dc, {organizationId, id: connectionId}))).connection;
  if (!connection) return result;
  const token = connectionToken(organizationId, connectionId, connection);
  const reconnect = async (code: string) => {
    result.needsReconnect = true;
    await read(() => sdk.setMetaLeadConnectionStatus(dc, {organizationId, id: connectionId, status: sdk.MetaLeadConnectionStatus.NEEDS_RECONNECT, errorCode: code}));
  };
  if (!token) { await reconnect("META_TOKEN_UNAVAILABLE"); return result; }

  let forms;
  try { forms = await listPageForms(connection.pageId, token); }
  catch (error) {
    if (error instanceof MetaGraphError && error.failure === "RECONNECT") await reconnect(error.code);
    else log("poll_forms_failed", {organizationId, connectionId, code: error instanceof MetaGraphError ? error.code : "ERROR"});
    await read(() => sdk.markMetaLeadConnectionPolled(dc, {organizationId, id: connectionId}));
    return result;
  }
  if (connection.status === "NEEDS_RECONNECT") {
    await read(() => sdk.setMetaLeadConnectionStatus(dc, {organizationId, id: connectionId, status: sdk.MetaLeadConnectionStatus.ACTIVE, errorCode: null}));
  }

  for (const metaForm of forms) {
    // Archived or deleted forms take no new leads; their past leads came through when they were active.
    if (metaForm.status !== "ACTIVE") continue;
    result.forms += 1;
    try {
      const form = await formFor(dc, organizationId, connectionId, metaForm.id, token, {name: metaForm.name, questions: metaForm.questions});
      if (!form.enabled || canonicalUuid(form.connectionId) !== connectionId) continue;
      const leads = await listFormLeadIds(metaForm.id, token, options.since);
      result.found += leads.length;
      for (const lead of leads) {
        const event = await recordLeadgen({pageId: connection.pageId, leadgenId: lead.id, formId: metaForm.id, adId: null, adGroupId: null, createdAt: lead.createdAt}, options.origin, dc);
        let eventId = event?.eventId ?? null;
        if (!event) {
          // Already recorded. An import (a person pressing the button) also retries one that failed earlier.
          const known = options.origin === "IMPORT" ? (await read(() => sdk.metaLeadEventByLeadgen(dc, {organizationId, leadgenId: lead.id}))).event : null;
          if (!known || (known.status !== "FAILED" && known.status !== "DEAD")) { result.known += 1; continue; }
          eventId = canonicalUuid(known.id);
          if (known.status === "DEAD") await read(() => sdk.setMetaLeadEventOutcome(dc, {organizationId, id: eventId!, status: sdk.MetaLeadEventStatus.FAILED, errorCode: "RETRIED_BY_IMPORT", nextAttemptAt: null}));
        }
        const outcome = await processMetaLeadEvent(organizationId, eventId!, dc);
        if (outcome.status === "PROCESSED") result.imported += 1; else if (outcome.status === "FAILED" || outcome.status === "DEAD") result.failed += 1;
      }
    } catch (error) {
      result.failed += 1;
      log("poll_form_failed", {organizationId, connectionId, formId: metaForm.id, code: error instanceof MetaGraphError ? error.code : error instanceof Error ? error.name : "ERROR"});
    }
  }
  await read(() => sdk.markMetaLeadConnectionPolled(dc, {organizationId, id: connectionId}));
  log("polled", {organizationId, connectionId, origin: options.origin, forms: result.forms, found: result.found, imported: result.imported});
  return result;
}

/** The worker's share: Pages not checked for 15 minutes, a few per minute. */
export async function pollDueConnections(limit = 5) {
  const dc = serverDataConnect();
  const now = Date.now();
  const due = (await read(() => sdk.metaLeadConnectionsDue(dc, {dueBefore: new Date(now - POLL_EVERY_MS).toISOString(), limit}))).connections;
  const totals = {pages: 0, imported: 0, failed: 0};
  for (const row of due) {
    const since = row.lastPolledAt ? new Date(Date.parse(row.lastPolledAt) - OVERLAP_MS) : new Date(now - FIRST_CHECK_MS);
    try {
      const result = await pollConnection(canonicalUuid(row.organizationId), canonicalUuid(row.id), {since, origin: "POLL"});
      totals.pages += 1; totals.imported += result.imported; totals.failed += result.failed;
    } catch (error) {
      totals.failed += 1;
      log("poll_failed", {connectionId: row.id, name: error instanceof Error ? error.name : typeof error});
    }
  }
  return totals;
}
