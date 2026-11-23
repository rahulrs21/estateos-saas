import "server-only";

import { sqlConnectHandle } from "@/lib/firebase/sql-connect-handle";
import { preview } from "@/modules/inbox/policy";
import { randomBytes, createHash } from "node:crypto";
import { type LeadCaptureFormStatus as SqlFormStatus } from "@dataconnect/admin-generated";
import * as sdk from "@dataconnect/admin-generated";
import { executeWorkspaceOperation } from "@/lib/firebase/dataconnect";
import { assertSafeDataConnectEnvironment } from "@/modules/organizations/server/dataconnect-policy";
import { WorkspaceError, mapWorkspaceDataError } from "@/modules/organizations/server/errors";
import { requireActiveOrganizationRequest } from "@/modules/organizations/server/context";
import { assertOrganizationAdministrator } from "@/modules/organizations/server/permission-policy";
import { validateInput } from "@/modules/organizations/server/validation";
import { canonicalUuid } from "@/modules/organizations/server/identifiers";
import { assertExpectedOrganization } from "@/modules/leads/server/request-policy";
import { normalizePhone } from "@/modules/leads/normalization";
import { matchSingleContact, planAutoAssignment } from "./intake";
import { captureFormSchema, type CaptureFormInput } from "../validation";

function adminDataConnect() {
  assertSafeDataConnectEnvironment({ nodeEnv: process.env.NODE_ENV, emulatorHost: process.env.DATA_CONNECT_EMULATOR_HOST });
  return sqlConnectHandle();
}

/** Never pass user impersonation to the fixed NO_ACCESS public-capture operations. */
async function noAccessOperation<T>(operation: () => Promise<{ data: T }>): Promise<T> {
  try { return (await operation()).data; }
  catch (error) { throw mapWorkspaceDataError(error); }
}

async function administratorContext(expectedOrganizationId?: string | null) {
  const context = await requireActiveOrganizationRequest();
  assertOrganizationAdministrator(context.membership);
  if (expectedOrganizationId !== undefined) assertExpectedOrganization(expectedOrganizationId, context.organizationId);
  return context;
}

function formStatus(value: CaptureFormInput["status"]): SqlFormStatus {
  return sdk.LeadCaptureFormStatus[value];
}

function sourceDisplayName(name: string, publicId: string) {
  return `Website - ${name.slice(0, 76)} - ${publicId.slice(0, 8)}`;
}

function validateStoredFieldConfig(fields: unknown) {
  const parsed = captureFormSchema.shape.fields.safeParse(fields);
  if (!parsed.success) throw new WorkspaceError("FORM_CONFIGURATION_INVALID", 503, "This form is temporarily unavailable.");
  return parsed.data;
}

function safePublicForm(form: NonNullable<Awaited<ReturnType<typeof resolvePublicFormRaw>>>) {
  const fields = validateStoredFieldConfig(form.fields);
  return {
    publicId: form.publicId,
    name: form.name,
    fields,
    consentText: form.consentText,
    privacyPolicyUrl: form.privacyPolicyUrl,
    successMessage: form.successMessage,
  };
}

async function consumeCaptureRateWindow(dc: ReturnType<typeof adminDataConnect>, organizationId: string, formId: string, windowStart: string) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const current = await noAccessOperation(() => sdk.getWebsiteLeadCaptureRateWindow(dc, { organizationId, formId, windowStart }));
    const observedCount = current.window?.requestCount ?? 0;
    if (observedCount >= 30) throw new WorkspaceError("RATE_LIMITED", 429, "Please wait a moment before trying again.");
    try {
      await noAccessOperation(() => sdk.consumeWebsiteLeadCaptureRateWindow(dc, {
        organizationId, formId, windowStart, requestLimit: 30,
        windowExists: Boolean(current.window), observedCount,
      }));
      return;
    } catch {
      if (attempt === 3) throw new WorkspaceError("DATA_UNAVAILABLE", 503, "Lead capture is temporarily unavailable. Please try again.");
      // Retry against a fresh row/count after a create race or compare-and-set.
    }
  }
}

async function resolvePublicFormRaw(publicId: string) {
  if (!/^[A-Za-z0-9_-]{32,64}$/.test(publicId)) return null;
  const dc = adminDataConnect();
  const result = await noAccessOperation(() => sdk.resolveWebsiteLeadCaptureForm(dc, { publicId }));
  return result.form ?? null;
}

export async function resolvePublicForm(publicId: string) {
  const form = await resolvePublicFormRaw(publicId);
  return form ? safePublicForm(form) : null;
}

export async function listLeadCaptureForms() {
  const context = await administratorContext();
  const result = await executeWorkspaceOperation(() => sdk.listLeadCaptureForms(context.request.dc, {
    organizationId: context.organizationId, limit: 100, offset: 0,
  }, context.request.options));
  return {
    organizationId: canonicalUuid(context.organizationId),
    forms: result.forms.map((form) => ({
      id: canonicalUuid(form.id), publicId: form.publicId, name: form.name, status: form.status,
      source: form.source.name, branch: form.branch?.name ?? null, createdAt: form.createdAt, updatedAt: form.updatedAt,
      publicUrl: `/forms/${encodeURIComponent(form.publicId)}`,
    })),
    total: result.total[0]?.count ?? 0,
    leadSources: result.leadSources.map(({ id, name, sourceType }) => ({ id: canonicalUuid(id), name, sourceType })),
    branches: result.branches.map(({ id, name }) => ({ id: canonicalUuid(id), name })),
  };
}

export async function getLeadCaptureForm(input: { formId: string }) {
  const context = await administratorContext();
  const formId = canonicalUuid(input.formId);
  if (!/^[0-9a-f-]{36}$/.test(formId)) throw new WorkspaceError("INVALID_INPUT", 400, "Choose a valid form.");
  const result = await executeWorkspaceOperation(() => sdk.getLeadCaptureForm(context.request.dc, { organizationId: context.organizationId, formId }, context.request.options));
  if (!result.form) throw new WorkspaceError("NOT_FOUND", 404, "The requested form is unavailable.");
  return { ...result.form, fields: validateStoredFieldConfig(result.form.fields) };
}

function validatedForm(input: unknown) {
  return validateInput(captureFormSchema, input);
}

export async function createLeadCaptureForm(input: unknown, expectedOrganizationId: string | null) {
  const context = await administratorContext(expectedOrganizationId);
  const parsed = validatedForm(input);
  const publicId = randomBytes(32).toString("base64url");
  return executeWorkspaceOperation(() => sdk.createLeadCaptureForm(context.request.dc, {
    organizationId: context.organizationId, publicId, name: parsed.name, status: formStatus(parsed.status),
    sourceName: sourceDisplayName(parsed.name, publicId), branchId: parsed.branchId ?? null,
    projectId: parsed.projectId ?? null, fields: parsed.fields, consentText: parsed.consentText,
    privacyPolicyUrl: parsed.privacyPolicyUrl, successMessage: parsed.successMessage,
  }, context.request.options));
}

export async function updateLeadCaptureForm(input: unknown, expectedOrganizationId: string | null) {
  const context = await administratorContext(expectedOrganizationId);
  if (typeof input !== "object" || input === null || Array.isArray(input)) throw new WorkspaceError("INVALID_INPUT", 400, "Check the supplied details and try again.");
  const record = input as Record<string, unknown>;
  const formId = typeof record.formId === "string" ? canonicalUuid(record.formId) : "";
  if (!/^[0-9a-f-]{36}$/.test(formId)) throw new WorkspaceError("INVALID_INPUT", 400, "Choose a valid form.");
  const payload = { ...record };
  delete payload.formId;
  const parsed = validatedForm(payload);
  const current = await executeWorkspaceOperation(() => sdk.getLeadCaptureForm(context.request.dc, { organizationId: context.organizationId, formId }, context.request.options));
  if (!current.form) throw new WorkspaceError("NOT_FOUND", 404, "The requested form is unavailable.");
  return executeWorkspaceOperation(() => sdk.updateLeadCaptureForm(context.request.dc, {
    organizationId: context.organizationId, formId, name: parsed.name, status: formStatus(parsed.status),
    branchId: parsed.branchId ?? null, projectId: parsed.projectId ?? null, fields: parsed.fields,
    consentText: parsed.consentText, privacyPolicyUrl: parsed.privacyPolicyUrl, successMessage: parsed.successMessage,
  }, context.request.options));
}

/** The stored form fields the ingestion path needs (from either public form lookup). */
interface ResolvedForm { id: string; organizationId: string; publicId: string; fields: unknown; consentText: string; privacyPolicyUrl: string; successMessage: string; branchId?: string | null; projectId?: string | null }
type ParsedSubmission = NonNullable<ReturnType<typeof import("../validation").parsePublicSubmission>>;

/** Where a submission came from when it was sent through a published landing page (Phase 6D). */
export interface CapturePageContext { pageId: string; publicationId: string; landingPageUrl: string; propertyReference: string | null }

export type CaptureResult =
  | {accepted: true; duplicate: boolean; pending: false; message: string; leadId?: string}
  | {accepted: true; duplicate: false; pending: true; message: string};

const idempotencyHash = (key: string) => createHash("sha256").update(key).digest("hex");

/**
 * The one website lead ingestion path (Phase 4D), shared by hosted forms and
 * landing pages: contact matching, the distribution plan and the single
 * SubmitWebsiteLeadCapture transaction (lead, activity, audit, assignment
 * history, notifications and consent evidence).
 */
async function ingestSubmission(dc: ReturnType<typeof adminDataConnect>, form: ResolvedForm, parsed: ParsedSubmission, idempotencyKeyHash: string, page?: CapturePageContext) {
  const organizationId = canonicalUuid(form.organizationId);
  const formId = canonicalUuid(form.id);
  const phone = normalizePhone(parsed.phone);
  const normalizedEmail = parsed.email?.toLowerCase() ?? null;
  // Exact single matches may be associated. Ambiguous candidates are never merged.
  const existingContactId = await matchSingleContact(dc, organizationId, normalizedEmail, phone.normalizedPhone);
  const {assignedMembershipId, hasDistributionAttempt, distributionRuleId, expectedCursorVersion} = await planAutoAssignment(dc, organizationId, {branchId: form.branchId ?? null, projectId: form.projectId ?? null});

  // A landing page records its own URL (server-built, never the browser's) and,
  // when the visitor did not describe their interest, the page's property or project.
  const propertyInterest = parsed.propertyInterest ?? (page?.propertyReference ? page.propertyReference.slice(0, 500) : null);
  const variables = {
    organizationId, formId, publicId: form.publicId, idempotencyKeyHash,
    fullName: parsed.fullName, email: parsed.email, phone: phone.phone,
    normalizedEmail, normalizedPhone: phone.normalizedPhone,
    contactId: existingContactId, hasExistingContact: Boolean(existingContactId),
    message: parsed.message, inboxPreview: preview(parsed.message) || "Website enquiry (no message)", propertyInterest, preferredLocation: parsed.preferredLocation,
    propertyType: parsed.propertyType,
    // Omitted (not null) when the form has no transaction field, so the column default applies;
    // an explicit null would violate the NOT NULL column and fail the whole transaction.
    ...(parsed.transactionType ? {transactionType: sdk.TransactionType[parsed.transactionType]} : {}),
    budgetMin: parsed.budgetMin, budgetMax: parsed.budgetMax, currency: "AED",
    bedroomPreference: parsed.bedroomPreference, landingPageUrl: page?.landingPageUrl ?? parsed.attribution.landingPageUrl,
    utmSource: parsed.attribution.utmSource, utmMedium: parsed.attribution.utmMedium,
    utmCampaign: parsed.attribution.utmCampaign, utmContent: parsed.attribution.utmContent,
    utmTerm: parsed.attribution.utmTerm, consentTextSnapshot: form.consentText,
    privacyPolicyUrlSnapshot: form.privacyPolicyUrl, assignedMembershipId, distributionRuleId,
    expectedCursorVersion, hasAutoAssignment: assignedMembershipId !== null, hasDistributionAttempt,
  };
  const result = await noAccessOperation(() => sdk.submitWebsiteLeadCapture(dc, variables));
  return canonicalUuid(result.lead.id);
}

/**
 * Validates, deduplicates, rate-limits and records one website enquiry. If
 * the lead transaction fails after the enquiry was validated (for example the
 * company has no active default pipeline), the validated enquiry is stored as
 * a pending enquiry for owners and administrators to retry, so it is never
 * silently lost. Only if that also fails does the visitor see an error.
 */
export async function captureWebsiteSubmission(input: {form: ResolvedForm; idempotencyKey: string; rawBody: unknown; page?: CapturePageContext}): Promise<CaptureResult> {
  const { parsePublicSubmission } = await import("../validation");
  const {form} = input;
  const parsed = parsePublicSubmission(form.fields, input.rawBody);
  if (!parsed) throw new WorkspaceError("INVALID_SUBMISSION", 400, "Check the required fields and consent before submitting.");
  if (!/^[A-Za-z0-9_-]{16,128}$/.test(input.idempotencyKey)) throw new WorkspaceError("INVALID_SUBMISSION", 400, "Please refresh the form and try again.");

  const dc = adminDataConnect();
  const organizationId = canonicalUuid(form.organizationId);
  const formId = canonicalUuid(form.id);
  const idempotencyKeyHash = idempotencyHash(input.idempotencyKey);
  const prior = await noAccessOperation(() => sdk.findWebsiteLeadCaptureSubmission(dc, { organizationId, formId, idempotencyKeyHash }));
  if (prior.submission) return { accepted: true, duplicate: true, pending: false, message: form.successMessage };
  const priorPending = await noAccessOperation(() => sdk.findPendingWebsiteEnquiry(dc, { organizationId, formId, idempotencyKeyHash }));
  if (priorPending.pending) return { accepted: true, duplicate: true, pending: false, message: form.successMessage };

  const windowStart = new Date(Math.floor(Date.now() / 60_000) * 60_000).toISOString();
  await consumeCaptureRateWindow(dc, organizationId, formId, windowStart);

  let failure: unknown = null;
  // One retry covers a concurrent distribution-cursor change; the same idempotency key protects against duplicates.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const leadId = await ingestSubmission(dc, form, parsed, idempotencyKeyHash, input.page);
      return { accepted: true, duplicate: false, pending: false, message: form.successMessage, leadId };
    } catch (error) {
      failure = error;
      // A retry with the same key may have committed while its response was lost.
      const replay = await noAccessOperation(() => sdk.findWebsiteLeadCaptureSubmission(dc, { organizationId, formId, idempotencyKeyHash })).catch(() => null);
      if (replay?.submission) return { accepted: true, duplicate: true, pending: false, message: form.successMessage };
    }
  }
  const errorCode = (failure instanceof WorkspaceError ? failure.code : "LEAD_TRANSACTION_FAILED").slice(0, 60);
  try {
    await noAccessOperation(() => sdk.recordPendingWebsiteEnquiry(dc, {
      organizationId, formId, idempotencyKeyHash, errorCode, pageId: input.page?.pageId ?? null, publicationId: input.page?.publicationId ?? null,
      payload: JSON.stringify({schemaVersion: 1, ...parsed, fields: undefined, page: input.page ?? null}).slice(0, 12_000),
    }));
  } catch {
    throw failure;
  }
  console.error(JSON.stringify({event: "lead_capture.pending", organizationId, formId, errorCode}));
  return { accepted: true, duplicate: false, pending: true, message: form.successMessage };
}

export async function submitPublicLead(input: {
  publicId: string;
  idempotencyKey: string;
  rawBody: unknown;
}) {
  const form = await resolvePublicFormRaw(input.publicId);
  if (!form) throw new WorkspaceError("FORM_UNAVAILABLE", 404, "This form is unavailable.");
  return captureWebsiteSubmission({form, idempotencyKey: input.idempotencyKey, rawBody: input.rawBody});
}

/**
 * Retries a pending enquiry with its stored, validated payload (owners and
 * administrators). The idempotency key hash is the original one, so a retry
 * can never create a second lead.
 */
export async function retryPendingEnquiry(input: {organizationId: string; actorUid: string; pending: {id: string; formId: string; idempotencyKeyHash: string; payload: string}}) {
  const dc = adminDataConnect();
  const organizationId = canonicalUuid(input.organizationId);
  const formId = canonicalUuid(input.pending.formId);
  const formData = await noAccessOperation(() => sdk.getWebsiteLeadCaptureFormById(dc, { organizationId, formId }));
  const form = formData.form;
  if (!form || form.status !== "ACTIVE") throw new WorkspaceError("FORM_UNAVAILABLE", 409, "The lead form for this enquiry is not active. Activate it in Settings → Website lead forms and retry.");
  let stored: ParsedSubmission & {page?: CapturePageContext | null};
  try { stored = JSON.parse(input.pending.payload); } catch { throw new WorkspaceError("INVALID_SUBMISSION", 409, "This pending enquiry cannot be read."); }
  const prior = await noAccessOperation(() => sdk.findWebsiteLeadCaptureSubmission(dc, { organizationId, formId, idempotencyKeyHash: input.pending.idempotencyKeyHash }));
  let leadId: string | null = null;
  if (!prior.submission) {
    try {
      leadId = await ingestSubmission(dc, form, {...stored, fields: {} as ParsedSubmission["fields"]}, input.pending.idempotencyKeyHash, stored.page ?? undefined);
    } catch (error) {
      const code = (error instanceof WorkspaceError ? error.code : "LEAD_TRANSACTION_FAILED").slice(0, 60);
      await noAccessOperation(() => sdk.recordPendingWebsiteEnquiryAttempt(dc, { organizationId, id: input.pending.id, errorCode: code })).catch(() => undefined);
      throw new WorkspaceError("RETRY_FAILED", 409, "The enquiry still could not be saved as a lead. Check that the company has an active default pipeline, then retry.");
    }
  } else {
    leadId = canonicalUuid(prior.submission.leadId);
  }
  await noAccessOperation(() => sdk.markPendingWebsiteEnquiryRecovered(dc, { organizationId, id: input.pending.id, actorUid: input.actorUid, leadId: leadId! }));
  if (stored.page?.pageId) {
    await noAccessOperation(() => sdk.recordWebsitePageEnquiry(dc, {
      organizationId, pageId: stored.page!.pageId, publicationId: stored.page!.publicationId, formId, leadId: leadId!,
      utmSource: stored.attribution?.utmSource ?? null, utmMedium: stored.attribution?.utmMedium ?? null, utmCampaign: stored.attribution?.utmCampaign ?? null,
    })).catch(() => undefined);
  }
  return {leadId};
}
