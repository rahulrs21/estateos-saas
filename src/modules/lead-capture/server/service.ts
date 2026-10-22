import "server-only";

import { randomBytes, createHash } from "node:crypto";
import { connectorConfig, type LeadCaptureFormStatus as SqlFormStatus } from "@dataconnect/admin-generated";
import { getDataConnect } from "firebase-admin/data-connect";
import * as sdk from "@dataconnect/admin-generated";
import { getFirebaseAdminApp } from "@/lib/firebase/admin";
import { executeWorkspaceOperation } from "@/lib/firebase/dataconnect";
import { assertSafeDataConnectEnvironment } from "@/modules/organizations/server/dataconnect-policy";
import { WorkspaceError, mapWorkspaceDataError } from "@/modules/organizations/server/errors";
import { requireActiveOrganizationRequest } from "@/modules/organizations/server/context";
import { assertOrganizationAdministrator } from "@/modules/organizations/server/permission-policy";
import { validateInput } from "@/modules/organizations/server/validation";
import { canonicalUuid } from "@/modules/organizations/server/identifiers";
import { assertExpectedOrganization } from "@/modules/leads/server/request-policy";
import { normalizePhone } from "@/modules/leads/normalization";
import { buildDistributionPlan, type DistributionAgent, type DistributionRulePolicy } from "@/modules/leads/distribution/policy";
import { captureFormSchema, type CaptureFormInput } from "../validation";

function adminDataConnect() {
  assertSafeDataConnectEnvironment({ nodeEnv: process.env.NODE_ENV, emulatorHost: process.env.DATA_CONNECT_EMULATOR_HOST });
  return getDataConnect(connectorConfig, getFirebaseAdminApp());
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

export async function submitPublicLead(input: {
  publicId: string;
  idempotencyKey: string;
  rawBody: unknown;
}) {
  const { parsePublicSubmission } = await import("../validation");
  const form = await resolvePublicFormRaw(input.publicId);
  if (!form) throw new WorkspaceError("FORM_UNAVAILABLE", 404, "This form is unavailable.");
  const parsed = parsePublicSubmission(form.fields, input.rawBody);
  if (!parsed) throw new WorkspaceError("INVALID_SUBMISSION", 400, "Check the required fields and consent before submitting.");
  if (!/^[A-Za-z0-9_-]{16,128}$/.test(input.idempotencyKey)) throw new WorkspaceError("INVALID_SUBMISSION", 400, "Please refresh the form and try again.");

  const dc = adminDataConnect();
  const organizationId = canonicalUuid(form.organizationId);
  const formId = canonicalUuid(form.id);
  const idempotencyKeyHash = createHash("sha256").update(input.idempotencyKey).digest("hex");
  const prior = await noAccessOperation(() => sdk.findWebsiteLeadCaptureSubmission(dc, { organizationId, formId, idempotencyKeyHash }));
  if (prior.submission) return { accepted: true as const, duplicate: true as const, message: form.successMessage };

  const windowStart = new Date(Math.floor(Date.now() / 60_000) * 60_000).toISOString();
  await consumeCaptureRateWindow(dc, organizationId, formId, windowStart);

  const phone = normalizePhone(parsed.phone);
  const normalizedEmail = parsed.email?.toLowerCase() ?? null;
  const contacts = await noAccessOperation(() => sdk.findWebsiteLeadCaptureContact(dc, {
    organizationId, normalizedEmail, normalizedPhone: phone.normalizedPhone,
  }));
  // Exact single matches may be associated. Ambiguous candidates are never merged.
  const existingContactId = contacts.contacts.length === 1 ? canonicalUuid(contacts.contacts[0].id) : null;
  const ruleData = await noAccessOperation(() => sdk.getWebsiteLeadDistributionPlan(dc, { organizationId }));
  const agents: DistributionAgent[] = ruleData.eligibleAgents.map((agent) => ({
    id: canonicalUuid(agent.id), role: agent.role, status: agent.status, userProfileUid: agent.userProfileUid ?? null,
    availability: agent.agentAvailability_on_membership ? {
      status: agent.agentAvailability_on_membership.status,
      unavailableUntil: agent.agentAvailability_on_membership.unavailableUntil ?? null,
    } : null,
  }));
  const rule = ruleData.rule;
  let assignedMembershipId: string | null = null;
  let hasDistributionAttempt = false;
  let distributionRuleId: string | null = null;
  let expectedCursorVersion: number | null = null;
  if (rule) {
    const policy: DistributionRulePolicy = {
      enabled: rule.enabled, mode: rule.mode, branchId: rule.branchId ?? null, projectId: rule.projectId ?? null,
      skipUnavailable: rule.skipUnavailable, businessHoursEnabled: rule.businessHoursEnabled,
      timeZone: rule.timeZone, businessDaysMask: rule.businessDaysMask, businessStart: rule.businessStart, businessEnd: rule.businessEnd,
    };
    const plan = buildDistributionPlan({
      rule: policy, lead: { branchId: form.branchId ?? null, projectId: form.projectId ?? null }, agents,
      lastMembershipId: rule.cursor?.lastMembershipId ? canonicalUuid(rule.cursor.lastMembershipId) : null,
    });
    if (plan.attempted) {
      hasDistributionAttempt = true;
      distributionRuleId = canonicalUuid(rule.id);
      assignedMembershipId = plan.membershipId ? canonicalUuid(plan.membershipId) : null;
      expectedCursorVersion = rule.cursor?.version ?? null;
    }
  }

  const variables = {
    organizationId, formId, publicId: input.publicId, idempotencyKeyHash,
    fullName: parsed.fullName, email: parsed.email, phone: phone.phone,
    normalizedEmail, normalizedPhone: phone.normalizedPhone,
    contactId: existingContactId, hasExistingContact: Boolean(existingContactId),
    message: parsed.message, propertyInterest: parsed.propertyInterest, preferredLocation: parsed.preferredLocation,
    propertyType: parsed.propertyType,
    transactionType: parsed.transactionType ? sdk.TransactionType[parsed.transactionType] : null,
    budgetMin: parsed.budgetMin, budgetMax: parsed.budgetMax, currency: "AED",
    bedroomPreference: parsed.bedroomPreference, landingPageUrl: parsed.attribution.landingPageUrl,
    utmSource: parsed.attribution.utmSource, utmMedium: parsed.attribution.utmMedium,
    utmCampaign: parsed.attribution.utmCampaign, utmContent: parsed.attribution.utmContent,
    utmTerm: parsed.attribution.utmTerm, consentTextSnapshot: form.consentText,
    privacyPolicyUrlSnapshot: form.privacyPolicyUrl, assignedMembershipId, distributionRuleId,
    expectedCursorVersion, hasAutoAssignment: assignedMembershipId !== null, hasDistributionAttempt,
  };

  try {
    const result = await noAccessOperation(() => sdk.submitWebsiteLeadCapture(dc, variables));
    return { accepted: true as const, duplicate: false as const, message: form.successMessage, leadId: canonicalUuid(result.lead.id) };
  } catch (error) {
    // A retry with the same key may have committed while its response was lost.
    const replay = await noAccessOperation(() => sdk.findWebsiteLeadCaptureSubmission(dc, { organizationId, formId, idempotencyKeyHash }));
    if (replay.submission) return { accepted: true as const, duplicate: true as const, message: form.successMessage };
    throw error;
  }
}

