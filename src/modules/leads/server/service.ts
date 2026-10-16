import "server-only";

import {
  LeadStatus as SqlLeadStatus,
  createLead as createLeadOperation,
  getLead as getLeadOperation,
  listLeads as listLeadsOperation,
  updateLead as updateLeadOperation,
  addLeadNote as addLeadNoteOperation,
  changeLeadStatus as changeLeadStatusOperation,
  assignLead as assignLeadOperation,
  scheduleLeadFollowUp as scheduleLeadFollowUpOperation,
  completeLeadFollowUp as completeLeadFollowUpOperation,
} from "@dataconnect/admin-generated";
import { executeWorkspaceOperation } from "@/lib/firebase/dataconnect";
import { requireActiveOrganizationRequest } from "@/modules/organizations/server/context";
import { assertCanWriteLead } from "@/modules/organizations/server/permission-policy";
import { validateInput } from "@/modules/organizations/server/validation";
import { WorkspaceError } from "@/modules/organizations/server/errors";
import { createLeadInputSchema, leadIdInputSchema, updateLeadInputSchema } from "./validation";
import { assertExpectedOrganization } from "./request-policy";
import { leadListInputSchema, escapeLeadSearch, leadStatusInputSchema, leadAssignmentInputSchema, leadNoteInputSchema, leadFollowUpInputSchema } from "../validation";

export const sqlLeadStatus = {
  NEW: SqlLeadStatus.NEW, CONTACTED: SqlLeadStatus.CONTACTED, QUALIFIED: SqlLeadStatus.QUALIFIED,
  LOST: SqlLeadStatus.LOST, CONVERTED: SqlLeadStatus.CONVERTED,
};

/** Input filters only narrow an already authorized, server-selected company. */
export function leadQueryVariables(organizationId: string, input: unknown) {
  const { search, status, followUp, ...pagination } = validateInput(leadListInputSchema, input);
  const now = new Date().toISOString();
  return {
    ...pagination, organizationId, search: escapeLeadSearch(search),
    status: status ? sqlLeadStatus[status] : undefined,
    followUpBefore: followUp === "OVERDUE" ? now : undefined,
    followUpAfter: followUp === "UPCOMING" ? now : undefined,
  };
}

async function mutationContext(expectedOrganizationId: string | null) {
  const context = await requireActiveOrganizationRequest();
  assertExpectedOrganization(expectedOrganizationId, context.organizationId);
  return context;
}

/** Tenant context comes from the server profile plus a fresh membership check. */
export async function listLeads(input: unknown = {}) {
  const { request, organizationId } = await requireActiveOrganizationRequest();
  const variables = leadQueryVariables(organizationId, input);
  return executeWorkspaceOperation(() => listLeadsOperation(request.dc, variables, request.options));
}

export async function getLead(input: unknown) {
  const { request, organizationId } = await requireActiveOrganizationRequest();
  const variables = validateInput(leadIdInputSchema, input);
  return executeWorkspaceOperation(() => getLeadOperation(request.dc, { ...variables, organizationId }, request.options));
}

export async function createLead(input: unknown, expectedOrganizationId: string | null) {
  const { request, organizationId, membership } = await mutationContext(expectedOrganizationId);
  const variables = validateInput(createLeadInputSchema, input);
  const assignedMembershipId = variables.assignedMembershipId ?? (membership.role === "AGENT" ? membership.id : null);
  assertCanWriteLead(membership, assignedMembershipId);
  return executeWorkspaceOperation(() => createLeadOperation(request.dc, {
    ...variables, organizationId, assignedMembershipId,
  }, request.options));
}

/** Full-record update; omitted optional contact/reference fields are cleared. */
export async function updateLead(input: unknown, expectedOrganizationId: string | null) {
  const { request, organizationId, membership } = await mutationContext(expectedOrganizationId);
  const parsed = validateInput(updateLeadInputSchema, input);
  // Explicit nulls give the full-record HTTP editor deterministic clearing
  // semantics; omitted GraphQL variables otherwise preserve existing columns.
  const variables = {
    ...parsed, email: parsed.email ?? null, phone: parsed.phone ?? null,
    source: parsed.source ?? null, branchId: parsed.branchId ?? null,
    assignedMembershipId: parsed.assignedMembershipId ?? null,
  };
  assertCanWriteLead(membership, variables.assignedMembershipId);
  const status = sqlLeadStatus[variables.status];
  // The connector also checks the existing lead's assignment, so an agent cannot
  // claim another member's lead simply by submitting their own assignment ID.
  return executeWorkspaceOperation(() => updateLeadOperation(request.dc, {
    ...variables, status, organizationId,
  }, request.options));
}

export async function changeLeadStatus(input: unknown, expectedOrganizationId: string | null) {
  const { request, organizationId } = await mutationContext(expectedOrganizationId);
  const variables = validateInput(leadStatusInputSchema, input);
  return executeWorkspaceOperation(() => changeLeadStatusOperation(request.dc, {
    ...variables, status: sqlLeadStatus[variables.status], organizationId,
  }, request.options));
}

export async function assignLead(input: unknown, expectedOrganizationId: string | null) {
  const { request, organizationId, membership } = await mutationContext(expectedOrganizationId);
  if (!["OWNER", "ADMIN", "MANAGER"].includes(membership.role)) {
    throw new WorkspaceError("FORBIDDEN", 403, "An owner, administrator or manager must change assignments.");
  }
  const variables = validateInput(leadAssignmentInputSchema, input);
  return executeWorkspaceOperation(() => assignLeadOperation(request.dc, { ...variables, organizationId }, request.options));
}

export async function addLeadNote(input: unknown, expectedOrganizationId: string | null) {
  const { request, organizationId } = await mutationContext(expectedOrganizationId);
  const variables = validateInput(leadNoteInputSchema, input);
  return executeWorkspaceOperation(() => addLeadNoteOperation(request.dc, { ...variables, organizationId }, request.options));
}

export async function scheduleLeadFollowUp(input: unknown, expectedOrganizationId: string | null) {
  const { request, organizationId } = await mutationContext(expectedOrganizationId);
  const variables = validateInput(leadFollowUpInputSchema, input);
  return executeWorkspaceOperation(() => scheduleLeadFollowUpOperation(request.dc, { ...variables, organizationId }, request.options));
}

export async function completeLeadFollowUp(input: unknown, expectedOrganizationId: string | null) {
  const { request, organizationId } = await mutationContext(expectedOrganizationId);
  const variables = validateInput(leadIdInputSchema, input);
  return executeWorkspaceOperation(() => completeLeadFollowUpOperation(request.dc, { ...variables, organizationId }, request.options));
}
