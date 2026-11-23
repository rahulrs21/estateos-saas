import "server-only";

import * as sdk from "@dataconnect/admin-generated";
import { isDuplicate, serverDataConnect } from "@/modules/communications/server/data";
import { matchSingleContact, planAutoAssignment } from "@/modules/lead-capture/server/intake";
import { openSecret } from "@/modules/inbox/vault";
import { eventRetry } from "@/modules/inbox/policy";
import { canonicalUuid } from "@/modules/organizations/server/identifiers";
import { WorkspaceError, mapWorkspaceDataError } from "@/modules/organizations/server/errors";
import { leadMetadata, mapMetaLead, parseFieldMapping, parseQuestions, type LeadgenChange, type MetaLead } from "../meta";
import { fetchMetaForm, fetchMetaLead, MetaGraphError } from "./graph";
import { pageTokenBinding } from "./secrets";

/*
 * Meta lead events, from record to lead (docs/META_LEAD_ADS_PLAN.md).
 * 1. A verified webhook (or the safety-net poll, or an import) records each leadgen ID once per company.
 * 2. Processing reads the lead from Meta with the Page's token, registers its form on first sight,
 *    maps the answers and creates the lead in one transaction that also marks the event PROCESSED.
 * 3. Failures are retried by the every-minute worker with growing delays, then left DEAD (owners can retry
 *    from Settings in 7D.3). Logs carry IDs and short codes only, never answers or tokens.
 */

type Handle = ReturnType<typeof serverDataConnect>;
export type MetaEventOutcome =
  | {status: "PROCESSED"; leadId: string}
  | {status: "SKIPPED"; reason: string}
  | {status: "IGNORED" | "FAILED" | "DEAD"; errorCode: string};

const log = (event: string, detail: Record<string, unknown>) => console.warn(JSON.stringify({event: `lead_ads.${event}`, ...detail}));

async function read<T>(operation: () => Promise<{data: T}>): Promise<T> {
  try { return (await operation()).data; }
  catch (error) { throw mapWorkspaceDataError(error); }
}

/** The company that connected this Page, or null (unknown Pages are ignored; Meta still gets 200). */
export async function connectionForPage(pageId: string, dc: Handle = serverDataConnect()) {
  const rows = (await read(() => sdk.metaLeadConnectionForPage(dc, {pageId}))).connections;
  if (rows.length !== 1) return null;
  return {organizationId: canonicalUuid(rows[0].organizationId), id: canonicalUuid(rows[0].id), status: rows[0].status};
}

/** Records one leadgen notification for the Page's company. Returns the event ID, or null if already recorded or the Page is not connected. */
export async function recordLeadgen(change: LeadgenChange, origin: "WEBHOOK" | "POLL" | "IMPORT" | "SIMULATED", dc: Handle = serverDataConnect()) {
  const connection = await connectionForPage(change.pageId, dc);
  if (!connection) { log("unknown_page", {pageId: change.pageId}); return null; }
  try {
    const result = await sdk.recordMetaLeadEvent(dc, {
      organizationId: connection.organizationId, connectionId: connection.id, pageId: change.pageId, leadgenId: change.leadgenId,
      metaFormId: change.formId, adId: change.adId, adGroupId: change.adGroupId, metaCreatedAt: change.createdAt, origin,
    });
    return {organizationId: connection.organizationId, eventId: canonicalUuid(result.data.event.id)};
  } catch (error) {
    if (isDuplicate(error)) return null;
    throw mapWorkspaceDataError(error);
  }
}

async function setOutcome(dc: Handle, organizationId: string, eventId: string, attempts: number, outcome: {status: "FAILED" | "DEAD" | "IGNORED"; errorCode: string}): Promise<MetaEventOutcome> {
  let status = outcome.status;
  let nextAttemptAt: string | null = null;
  if (status === "FAILED") {
    const retry = eventRetry(attempts, Date.now());
    if (retry.dead) status = "DEAD"; else nextAttemptAt = retry.nextAttemptAt;
  }
  await read(() => sdk.setMetaLeadEventOutcome(dc, {organizationId, id: eventId, status: sdk.MetaLeadEventStatus[status], errorCode: outcome.errorCode.slice(0, 64), nextAttemptAt}));
  log("event_" + status.toLowerCase(), {organizationId, eventId, errorCode: outcome.errorCode});
  return {status, errorCode: outcome.errorCode};
}

const sourceName = (name: string, metaFormId: string) => `Meta - ${name.slice(0, 90)} - ${metaFormId.slice(-6)}`.slice(0, 120);

/** The form's settings, registering the form (and its lead source) the first time one of its leads arrives. */
async function formFor(dc: Handle, organizationId: string, connectionId: string, metaFormId: string, token: string) {
  const found = await read(() => sdk.findMetaLeadForm(dc, {organizationId, metaFormId}));
  if (found.form) return found.form;
  const details = await fetchMetaForm(metaFormId, token);
  const name = details.name ?? `Form ${metaFormId}`;
  try {
    await sdk.registerMetaLeadForm(dc, {
      organizationId, connectionId, metaFormId, name, sourceName: sourceName(name, metaFormId), questions: details.questions,
      existingSourceId: found.source ? canonicalUuid(found.source.id) : null, hasExistingSource: Boolean(found.source),
    });
  } catch (error) {
    // Two leads of a new form at once: the other one registered it.
    if (!isDuplicate(error)) throw mapWorkspaceDataError(error);
  }
  const registered = await read(() => sdk.findMetaLeadForm(dc, {organizationId, metaFormId}));
  if (!registered.form) throw new WorkspaceError("META_LEAD_FORM_UNAVAILABLE", 503, "The form could not be registered.");
  return registered.form;
}

/** Processes one recorded event. Safe to call more than once: a processed event is left alone. */
export async function processMetaLeadEvent(organizationId: string, eventId: string, dc: Handle = serverDataConnect()): Promise<MetaEventOutcome> {
  const event = (await read(() => sdk.metaLeadEventContext(dc, {organizationId, eventId}))).event;
  if (!event) return {status: "SKIPPED", reason: "EVENT_NOT_FOUND"};
  if (event.status !== "RECEIVED" && event.status !== "FAILED") return {status: "SKIPPED", reason: event.status};
  const connectionId = canonicalUuid(event.connectionId);
  const connection = (await read(() => sdk.metaLeadConnectionSecret(dc, {organizationId, id: connectionId}))).connection;
  if (!connection) return setOutcome(dc, organizationId, eventId, event.attempts, {status: "DEAD", errorCode: "META_CONNECTION_REMOVED"});

  let token: string;
  try { token = openSecret(connection.tokenCiphertext, connection.tokenKeyId, pageTokenBinding(organizationId, connectionId)); }
  catch {
    await read(() => sdk.setMetaLeadConnectionStatus(dc, {organizationId, id: connectionId, status: sdk.MetaLeadConnectionStatus.NEEDS_RECONNECT, errorCode: "META_TOKEN_UNAVAILABLE"}));
    return setOutcome(dc, organizationId, eventId, event.attempts, {status: "FAILED", errorCode: "META_TOKEN_UNAVAILABLE"});
  }

  let lead: MetaLead;
  try { lead = await fetchMetaLead(event.leadgenId, token); }
  catch (error) {
    if (!(error instanceof MetaGraphError)) throw error;
    if (error.failure === "RECONNECT") {
      await read(() => sdk.setMetaLeadConnectionStatus(dc, {organizationId, id: connectionId, status: sdk.MetaLeadConnectionStatus.NEEDS_RECONNECT, errorCode: error.code}));
      return setOutcome(dc, organizationId, eventId, event.attempts, {status: "FAILED", errorCode: error.code});
    }
    return setOutcome(dc, organizationId, eventId, event.attempts, {status: error.failure === "RETRY" ? "FAILED" : "DEAD", errorCode: error.code});
  }
  if (connection.status === "NEEDS_RECONNECT") {
    await read(() => sdk.setMetaLeadConnectionStatus(dc, {organizationId, id: connectionId, status: sdk.MetaLeadConnectionStatus.ACTIVE, errorCode: null}));
  }

  const metaFormId = lead.form_id ?? event.metaFormId;
  if (!metaFormId || (event.metaFormId && lead.form_id && event.metaFormId !== lead.form_id)) {
    return setOutcome(dc, organizationId, eventId, event.attempts, {status: "DEAD", errorCode: "META_FORM_UNKNOWN"});
  }
  const form = await formFor(dc, organizationId, connectionId, metaFormId, token);
  if (canonicalUuid(form.connectionId) !== connectionId) return setOutcome(dc, organizationId, eventId, event.attempts, {status: "DEAD", errorCode: "META_FORM_OTHER_PAGE"});
  if (!form.enabled) return setOutcome(dc, organizationId, eventId, event.attempts, {status: "IGNORED", errorCode: "META_FORM_TURNED_OFF"});

  const mapped = mapMetaLead(lead, {questions: parseQuestions(form.questions), mapping: parseFieldMapping(form.fieldMapping)});
  if (!mapped) return setOutcome(dc, organizationId, eventId, event.attempts, {status: "IGNORED", errorCode: "META_LEAD_NO_CONTACT_DETAILS"});

  const formId = canonicalUuid(form.id);
  const branchId = form.branchId ? canonicalUuid(form.branchId) : null;
  let failure: unknown = null;
  // One retry covers a concurrent round-robin change; the event's unprocessed check prevents a second lead.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const contactId = await matchSingleContact(dc, organizationId, mapped.normalizedEmail, mapped.normalizedPhone);
      const plan = await planAutoAssignment(dc, organizationId, {branchId, projectId: null});
      const result = await sdk.captureMetaLeadAd(dc, {
        organizationId, eventId, connectionId, formId,
        fullName: mapped.fullName, email: mapped.email, phone: mapped.phone, normalizedEmail: mapped.normalizedEmail, normalizedPhone: mapped.normalizedPhone,
        contactId, hasExistingContact: Boolean(contactId),
        propertyInterest: mapped.propertyInterest, preferredLocation: mapped.preferredLocation, propertyType: mapped.propertyType,
        // Omitted (not null) when unknown, so the column default applies (an explicit null fails the NOT NULL column).
        ...(mapped.transactionType ? {transactionType: sdk.TransactionType[mapped.transactionType]} : {}),
        budgetMin: mapped.budgetMin, budgetMax: mapped.budgetMax, currency: "AED", bedroomPreference: mapped.bedroomPreference,
        metadata: leadMetadata({lead, mapped, pageId: connection.pageId, pageName: connection.pageName, formName: form.name, origin: event.origin}),
        ...plan, hasAutoAssignment: plan.assignedMembershipId !== null,
      });
      const leadId = canonicalUuid(result.data.lead.id);
      log("lead_created", {organizationId, eventId, leadId});
      return {status: "PROCESSED", leadId};
    } catch (error) {
      failure = error;
      // A lost response may hide a committed transaction.
      const now = (await read(() => sdk.metaLeadEventContext(dc, {organizationId, eventId})).catch(() => null))?.event;
      if (now?.status === "PROCESSED" && now.leadId) return {status: "PROCESSED", leadId: canonicalUuid(now.leadId)};
    }
  }
  const mappedError = failure instanceof WorkspaceError ? failure : mapWorkspaceDataError(failure);
  return setOutcome(dc, organizationId, eventId, event.attempts, {status: "FAILED", errorCode: mappedError instanceof WorkspaceError ? mappedError.code : "META_LEAD_TRANSACTION_FAILED"});
}

const STALE_RECEIVED_MS = 2 * 60_000;

/** The worker's share: failed events whose retry time has come, and received ones a stopped server never finished. */
export async function retryMetaLeadEvents(limit = 25) {
  const dc = serverDataConnect();
  const now = Date.now();
  const pending = (await read(() => sdk.pendingMetaLeadEvents(dc, {now: new Date(now).toISOString(), staleBefore: new Date(now - STALE_RECEIVED_MS).toISOString(), limit}))).events;
  const counts = {checked: pending.length, processed: 0, failed: 0, other: 0};
  for (const row of pending) {
    try {
      const outcome = await processMetaLeadEvent(canonicalUuid(row.organizationId), canonicalUuid(row.id), dc);
      if (outcome.status === "PROCESSED") counts.processed += 1; else if (outcome.status === "FAILED" || outcome.status === "DEAD") counts.failed += 1; else counts.other += 1;
    } catch (error) {
      counts.failed += 1;
      log("retry_error", {eventId: row.id, name: error instanceof Error ? error.name : typeof error});
    }
  }
  return counts;
}
