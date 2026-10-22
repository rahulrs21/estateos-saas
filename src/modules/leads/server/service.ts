import "server-only";

import { randomUUID } from "node:crypto";

import {
  LeadStatus as SqlLeadStatus,
  LeadPriority as SqlLeadPriority,
  TransactionType as SqlTransactionType,
  createLead as createLeadOperation,
  createLeadForContact,
  getLead as getLeadOperation,
  listLeads as listLeadsOperation,
  listLeadsCreatedAsc as listLeadsCreatedAscOperation,
  listLeadsUpdatedDesc as listLeadsUpdatedDescOperation,
  listLeadsNameAsc as listLeadsNameAscOperation,
  listLeadsNameDesc as listLeadsNameDescOperation,
  listLeadsFollowUpAsc as listLeadsFollowUpAscOperation,
  updateLead as updateLeadOperation,
  addLeadNote as addLeadNoteOperation,
  changeLeadStatus as changeLeadStatusOperation,
  assignLead as assignLeadOperation,
  unassignLead as unassignLeadOperation,
  scheduleLeadFollowUp as scheduleLeadFollowUpOperation,
  completeLeadFollowUp as completeLeadFollowUpOperation,
} from "@dataconnect/admin-generated";
import { executeWorkspaceOperation } from "@/lib/firebase/dataconnect";
import { requireActiveOrganizationRequest } from "@/modules/organizations/server/context";
import { assertCanWriteLead } from "@/modules/organizations/server/permission-policy";
import { validateInput } from "@/modules/organizations/server/validation";
import { WorkspaceError } from "@/modules/organizations/server/errors";
import { createLeadInputSchema, leadIdInputSchema, updateLeadInputSchema } from "./validation";
import { leadListInputSchema, leadSorts, escapeLeadSearch, leadStatusInputSchema, leadAssignmentInputSchema, leadNoteInputSchema, leadFollowUpInputSchema } from "../validation";
import { crmMutationContext as mutationContext, ensureLeadConfiguration, possibleDuplicates } from "./crm-service";
import { planNewLeadAssignment, refreshNewLeadAssignment } from "../distribution/service";
import { normalizePhone } from "../normalization";
import { canonicalUuid } from "@/modules/organizations/server/identifiers";

function sqlCrmFields<T extends {priority?: "LOW" | "NORMAL" | "HIGH" | "URGENT"; transactionType?: "BUY" | "RENT" | "INVEST"}>(input: T) {
  const {priority, transactionType, ...rest} = input;
  return {...rest, priority: priority ? SqlLeadPriority[priority] : undefined, transactionType: transactionType ? SqlTransactionType[transactionType] : undefined};
}

export const sqlLeadStatus = {
  NEW: SqlLeadStatus.NEW, CONTACTED: SqlLeadStatus.CONTACTED, QUALIFIED: SqlLeadStatus.QUALIFIED,
  LOST: SqlLeadStatus.LOST, CONVERTED: SqlLeadStatus.CONVERTED,
  VIEWING_SCHEDULED: SqlLeadStatus.VIEWING_SCHEDULED, VIEWING_COMPLETED: SqlLeadStatus.VIEWING_COMPLETED,
  NEGOTIATION: SqlLeadStatus.NEGOTIATION, WON: SqlLeadStatus.WON,
};

/** Input filters only narrow an already authorized, server-selected company. */
export function leadQueryVariables(organizationId: string, input: unknown) {
  const { search, status, followUp, archive, createdFrom, createdTo, sort, ...pagination } = validateInput(leadListInputSchema, input);
  // Sorting selects a distinct stored query in leadListOperation; ListLeads
  // has no `$sort` variable, so never forward it to the generated SDK.
  void sort;
  const now = new Date().toISOString();
  return sqlCrmFields({
    ...pagination, organizationId, search: escapeLeadSearch(search),
    activeOnly: archive === "ALL" ? null : archive === "ACTIVE",
    createdFrom: createdFrom ? `${createdFrom}T00:00:00.000Z` : undefined,
    createdBefore: createdTo ? new Date(Date.parse(`${createdTo}T00:00:00.000Z`) + 86400000).toISOString() : undefined,
    status: status ? sqlLeadStatus[status] : undefined,
    followUpBefore: followUp === "OVERDUE" ? now : undefined,
    followUpAfter: followUp === "UPCOMING" ? now : undefined,
  });
}

export function leadListOperation(sort: (typeof leadSorts)[number]) {
  switch (sort) {
    case "CREATED_ASC": return listLeadsCreatedAscOperation;
    case "UPDATED_DESC": return listLeadsUpdatedDescOperation;
    case "NAME_ASC": return listLeadsNameAscOperation;
    case "NAME_DESC": return listLeadsNameDescOperation;
    case "FOLLOW_UP_ASC": return listLeadsFollowUpAscOperation;
    default: return listLeadsOperation;
  }
}

/** Tenant context comes from the server profile plus a fresh membership check. */
export async function listLeads(input: unknown = {}) {
  const { request, organizationId } = await requireActiveOrganizationRequest();
  const { sort } = validateInput(leadListInputSchema, input);
  const variables = leadQueryVariables(organizationId, input);
  const operation = leadListOperation(sort);
  const data = await executeWorkspaceOperation(() => operation(request.dc, variables, request.options), `ListLeads:${sort}`);
  const total = data.total[0]?.count ?? 0;
  return {...data, leads: data.leads.map(row => ({...row, fullName: row.contact?.fullName ?? row.fullName, email: row.contact ? row.contact.email : row.email, phone: row.contact ? row.contact.phone : row.phone})), total, limit: variables.limit, offset: variables.offset, hasNext: variables.offset + variables.limit < total};
}

export async function getLead(input: unknown) {
  const { request, organizationId } = await requireActiveOrganizationRequest();
  const variables = validateInput(leadIdInputSchema, input);
  return executeWorkspaceOperation(() => getLeadOperation(request.dc, { ...variables, organizationId }, request.options), "GetLead");
}

export async function createLead(input: unknown, expectedOrganizationId: string | null) {
  const context = await mutationContext(expectedOrganizationId);
  const { request, organizationId, membership } = context;
  const variables = validateInput(createLeadInputSchema, input);
  const initial = {hasInitialNote: !!variables.initialNote, hasInitialFollowUp: !!variables.initialFollowUpAt};
  const contactId = variables.contactId;
  delete variables.contactId; delete variables.propertyId;
  const requestedMembershipId = variables.assignedMembershipId ?? null;
  if (membership.role === "AGENT") assertCanWriteLead(membership, requestedMembershipId ?? membership.id);
  await ensureLeadConfiguration(context);
  const normalized = normalizePhone(variables.phone);
  const duplicates = contactId ? [] : await possibleDuplicates(context, variables);
  const leadId = randomUUID();
  const leadScope = { branchId: variables.branchId ?? null, projectId: variables.projectId ?? null };
  let distribution = await planNewLeadAssignment(context, leadScope, requestedMembershipId);

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const assignment = {
      ...distribution,
      organizationId,
      leadId,
      projectId: variables.projectId ?? null,
      branchId: variables.branchId ?? null,
      ...initial,
    };
    try {
      let data;
      if (contactId) {
        const contactVariables = {...variables};
        delete contactVariables.fullName; delete contactVariables.email; delete contactVariables.phone;
        data = await executeWorkspaceOperation(() => createLeadForContact(request.dc, {
          ...sqlCrmFields(contactVariables), ...assignment, contactId,
        }, request.options), "CreateLeadForContact");
      } else {
        data = await executeWorkspaceOperation(() => createLeadOperation(request.dc, {
          ...sqlCrmFields(variables), fullName: variables.fullName!, phone: normalized.phone,
          normalizedPhone: normalized.normalizedPhone, ...assignment,
        }, request.options), "CreateLead");
      }
      return {...data, possibleDuplicates: duplicates, warnings: normalized.warning ? [normalized.warning] : []};
    } catch (error) {
      // A committed transaction whose response was lost is safe to return by its
      // single request ID; cursor and lead writes always commit together.
      const committed = await executeWorkspaceOperation(() => getLeadOperation(request.dc, {organizationId, leadId}, request.options), "GetLead");
      if (committed.lead) return {lead: committed.lead, possibleDuplicates: duplicates, warnings: normalized.warning ? [normalized.warning] : []};
      if (!distribution.hasAutoAssignment || attempt === 4) throw error;

      const refreshed = await refreshNewLeadAssignment(context, leadScope);
      const cursorMoved = refreshed.expectedCursorVersion !== distribution.expectedCursorVersion;
      const assigneeChanged = refreshed.assignedMembershipId !== distribution.assignedMembershipId;
      if (!cursorMoved && !assigneeChanged) throw error;
      distribution = refreshed;
    }
  }
  throw new WorkspaceError("CONFLICT", 409, "Lead distribution is busy. Try again in a moment.");
}

/** Full-record update; omitted optional contact/reference fields are cleared. */
export async function updateLead(input: unknown, expectedOrganizationId: string | null) {
  const context = await mutationContext(expectedOrganizationId);
  const { request, organizationId, membership } = context;
  const parsed = validateInput(updateLeadInputSchema, input);
  await ensureLeadConfiguration(context);
  const current = await executeWorkspaceOperation(() => getLeadOperation(request.dc, {organizationId, leadId: parsed.leadId}, request.options), "GetLead");
  const normalized = normalizePhone(parsed.phone);
  // Explicit nulls give the full-record HTTP editor deterministic clearing
  // semantics; omitted GraphQL variables otherwise preserve existing columns.
  const variables = {
    ...sqlCrmFields(parsed), email: parsed.email ?? null, phone: normalized.phone, normalizedPhone: normalized.normalizedPhone,
    source: parsed.source ?? null, branchId: parsed.branchId ?? null,
    assignedMembershipId: parsed.assignedMembershipId ?? null,
    recordAssignment: (current.lead?.assignedMembershipId ? canonicalUuid(current.lead.assignedMembershipId) : null) !== (parsed.assignedMembershipId ?? null),
  };
  const notifyAssigned = variables.recordAssignment && variables.assignedMembershipId !== null;
  const notifyUnassigned = variables.recordAssignment && variables.assignedMembershipId === null;
  assertCanWriteLead(membership, variables.assignedMembershipId);
  const status = sqlLeadStatus[variables.status];
  // The connector also checks the existing lead's assignment, so an agent cannot
  // claim another member's lead simply by submitting their own assignment ID.
  return executeWorkspaceOperation(() => updateLeadOperation(request.dc, {
    ...variables, notifyAssigned, notifyUnassigned, status, organizationId,
  }, request.options), "UpdateLead");
}

export async function changeLeadStatus(input: unknown, expectedOrganizationId: string | null) {
  const { request, organizationId } = await mutationContext(expectedOrganizationId);
  const variables = validateInput(leadStatusInputSchema, input);
  return executeWorkspaceOperation(() => changeLeadStatusOperation(request.dc, {
    ...variables, status: sqlLeadStatus[variables.status], organizationId,
  }, request.options), "ChangeLeadStatus");
}

export async function assignLead(input: unknown, expectedOrganizationId: string | null) {
  const { request, organizationId, membership } = await mutationContext(expectedOrganizationId);
  if (!["OWNER", "ADMIN", "MANAGER"].includes(membership.role)) throw new WorkspaceError("FORBIDDEN", 403, "You cannot change lead assignments.");
  const variables = validateInput(leadAssignmentInputSchema, input);
  if (variables.overrideClosed && !["OWNER", "ADMIN"].includes(membership.role)) {
    throw new WorkspaceError("FORBIDDEN", 403, "Only an owner or administrator can override a closed lead.");
  }
  const current = await executeWorkspaceOperation(() => getLeadOperation(request.dc, { organizationId, leadId: variables.leadId }, request.options), "GetLead");
  if (!current.lead) throw new WorkspaceError("NOT_FOUND", 404, "This lead is unavailable.");
  const currentAgent = current.lead.assignedMembershipId ? canonicalUuid(current.lead.assignedMembershipId) : null;
  if (currentAgent === variables.assignedMembershipId) return {lead: current.lead, unchanged: true};
  if (variables.assignedMembershipId === null) {
    return executeWorkspaceOperation(() => unassignLeadOperation(request.dc, {
      organizationId, leadId: variables.leadId, reason: variables.reason,
      expectedAssignedMembershipId: currentAgent,
      expectedWasUnassigned: currentAgent === null,
      overrideClosed: variables.overrideClosed,
    }, request.options), "UnassignLead");
  }
  return executeWorkspaceOperation(() => assignLeadOperation(request.dc, {
    organizationId, leadId: variables.leadId, assignedMembershipId: variables.assignedMembershipId!,
    expectedAssignedMembershipId: currentAgent,
    expectedWasUnassigned: currentAgent === null,
    reason: variables.reason, overrideClosed: variables.overrideClosed,
  }, request.options), "AssignLead");
}

export async function addLeadNote(input: unknown, expectedOrganizationId: string | null) {
  const { request, organizationId } = await mutationContext(expectedOrganizationId);
  const variables = validateInput(leadNoteInputSchema, input);
  return executeWorkspaceOperation(() => addLeadNoteOperation(request.dc, { ...variables, organizationId }, request.options), "AddLeadNote");
}

export async function scheduleLeadFollowUp(input: unknown, expectedOrganizationId: string | null) {
  const { request, organizationId } = await mutationContext(expectedOrganizationId);
  const variables = validateInput(leadFollowUpInputSchema, input);
  return executeWorkspaceOperation(() => scheduleLeadFollowUpOperation(request.dc, { ...variables, organizationId }, request.options), "ScheduleLeadFollowUp");
}

export async function completeLeadFollowUp(input: unknown, expectedOrganizationId: string | null) {
  const { request, organizationId } = await mutationContext(expectedOrganizationId);
  const variables = validateInput(leadIdInputSchema, input);
  return executeWorkspaceOperation(() => completeLeadFollowUpOperation(request.dc, { ...variables, organizationId }, request.options), "CompleteLeadFollowUp");
}
