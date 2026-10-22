import "server-only";

import { z } from "zod";
import * as sdk from "@dataconnect/admin-generated";
import { executeWorkspaceOperation } from "@/lib/firebase/dataconnect";
import { requireActiveOrganizationRequest } from "@/modules/organizations/server/context";
import { assertOrganizationAdministrator } from "@/modules/organizations/server/permission-policy";
import { canonicalUuid } from "@/modules/organizations/server/identifiers";
import { validateInput } from "@/modules/organizations/server/validation";
import { assertExpectedOrganization } from "./request-policy";
import { escapeLeadSearch } from "../validation";
import {
  createContactSchema, updateContactSchema, contactIdSchema, searchContactsSchema, duplicateContactSchema,
  normalizedContact, moveLeadStageSchema, createFollowUpSchema, completeFollowUpSchema, leadHistorySchema,
} from "../crm-validation";
import { normalizePhone } from "../normalization";

type Context = Awaited<ReturnType<typeof requireActiveOrganizationRequest>>;

export async function crmMutationContext(expectedOrganizationId: string | null) {
  const context = await requireActiveOrganizationRequest();
  assertExpectedOrganization(expectedOrganizationId, context.organizationId);
  return context;
}

async function configuration(context: Context) {
  return executeWorkspaceOperation(() => sdk.getLeadConfiguration(context.request.dc, { organizationId: context.organizationId }, context.request.options), "GetLeadConfiguration");
}

/** Fixed metadata only. Concurrent initialization is settled by tenant uniqueness. */
export async function ensureLeadConfiguration(context: Context) {
  const current = await configuration(context);
  if (current.pipelines.some(pipeline => pipeline.isDefault)) return current;
  try {
    await executeWorkspaceOperation(() => sdk.initializeLeadPipeline(context.request.dc, {organizationId: context.organizationId}, context.request.options), "InitializeLeadPipeline");
  } catch (error) {
    const reloaded = await configuration(context);
    if (reloaded.pipelines.some(pipeline => pipeline.isDefault)) return reloaded;
    throw error;
  }
  return configuration(context);
}

export async function getLeadConfiguration() {
  return configuration(await requireActiveOrganizationRequest());
}

export async function initializeLeadConfiguration(input: unknown, expectedOrganizationId: string | null) {
  validateInput(z.strictObject({}), input);
  return ensureLeadConfiguration(await crmMutationContext(expectedOrganizationId));
}

export async function possibleDuplicates(context: Context, input: { email?: string | null; phone?: string | null; alternatePhone?: string | null }) {
  if (!input.email && !input.phone && !input.alternatePhone) return [];
  const primary = normalizePhone(input.phone);
  const alternate = normalizePhone(input.alternatePhone);
  const result = await executeWorkspaceOperation(() => sdk.findDuplicateContacts(context.request.dc, {
    organizationId: context.organizationId, email: input.email,
    phone: primary.normalizedPhone ?? primary.phone, alternatePhone: alternate.normalizedPhone ?? alternate.phone,
  }, context.request.options), "FindDuplicateContacts");
  return result.contacts;
}

export async function findDuplicateContacts(input: unknown) {
  const context = await requireActiveOrganizationRequest();
  return { possibleDuplicates: await possibleDuplicates(context, validateInput(duplicateContactSchema, input)) };
}

export async function searchContacts(input: unknown = {}) {
  const { request, organizationId } = await requireActiveOrganizationRequest();
  const {search, limit, offset} = validateInput(searchContactsSchema, input);
  const result = await executeWorkspaceOperation(() => sdk.searchContacts(request.dc, {organizationId, limit, offset, search: escapeLeadSearch(search)}, request.options), "SearchContacts");
  const total = result.total[0]?.count ?? 0;
  return {contacts: result.contacts, total, limit, offset, hasNext: offset + limit < total};
}

export async function getContact(input: unknown) {
  const { request, organizationId } = await requireActiveOrganizationRequest();
  const variables = validateInput(contactIdSchema, input);
  return executeWorkspaceOperation(() => sdk.getContact(request.dc, {...variables, organizationId}, request.options), "GetContact");
}

export async function createContact(input: unknown, expectedOrganizationId: string | null) {
  const context = await crmMutationContext(expectedOrganizationId);
  assertOrganizationAdministrator(context.membership);
  const parsed = validateInput(createContactSchema, input);
  const normalized = normalizedContact(parsed);
  const duplicates = await possibleDuplicates(context, parsed);
  const data = await executeWorkspaceOperation(() => sdk.createContact(context.request.dc, {...normalized.variables, organizationId: context.organizationId}, context.request.options), "CreateContact");
  return {...data, possibleDuplicates: duplicates, warnings: normalized.warnings};
}

export async function updateContact(input: unknown, expectedOrganizationId: string | null) {
  const context = await crmMutationContext(expectedOrganizationId);
  assertOrganizationAdministrator(context.membership);
  const {contactId, ...parsed} = validateInput(updateContactSchema, input);
  const normalized = normalizedContact(parsed);
  const duplicates = (await possibleDuplicates(context, parsed)).filter(contact => canonicalUuid(contact.id) !== contactId);
  const data = await executeWorkspaceOperation(() => sdk.updateContact(context.request.dc, {...normalized.variables, contactId, organizationId: context.organizationId}, context.request.options), "UpdateContact");
  return {...data, possibleDuplicates: duplicates, warnings: normalized.warnings};
}

export async function moveLeadStage(input: unknown, expectedOrganizationId: string | null) {
  const {request, organizationId} = await crmMutationContext(expectedOrganizationId);
  const variables = validateInput(moveLeadStageSchema, input);
  return executeWorkspaceOperation(() => sdk.moveLeadStage(request.dc, {...variables, organizationId}, request.options), "MoveLeadStage");
}

export async function archiveLead(input: unknown, expectedOrganizationId: string | null) {
  const {request, organizationId, membership} = await crmMutationContext(expectedOrganizationId);
  assertOrganizationAdministrator(membership);
  const {leadId} = validateInput(leadHistorySchema.pick({leadId: true}), input);
  return executeWorkspaceOperation(() => sdk.archiveLead(request.dc, {leadId, organizationId}, request.options), "ArchiveLead");
}

export async function getLeadCrmHistory(input: unknown) {
  const {request, organizationId} = await requireActiveOrganizationRequest();
  const variables = validateInput(leadHistorySchema, input);
  return executeWorkspaceOperation(() => sdk.getLeadCrmHistory(request.dc, {...variables, organizationId}, request.options), "GetLeadCrmHistory");
}

export async function createLeadFollowUp(input: unknown, expectedOrganizationId: string | null) {
  const {request, organizationId} = await crmMutationContext(expectedOrganizationId);
  const {dueAt, ...variables} = validateInput(createFollowUpSchema, input);
  return executeWorkspaceOperation(() => sdk.scheduleLeadFollowUp(request.dc, {...variables, organizationId, followUpAt: dueAt, followUpNote: variables.title, replaceExisting: false}, request.options), "ScheduleLeadFollowUp");
}

export async function completeFollowUp(input: unknown, expectedOrganizationId: string | null) {
  const {request, organizationId} = await crmMutationContext(expectedOrganizationId);
  const variables = validateInput(completeFollowUpSchema, input);
  return executeWorkspaceOperation(() => sdk.completeLeadFollowUp(request.dc, {...variables, organizationId}, request.options), "CompleteLeadFollowUp");
}
