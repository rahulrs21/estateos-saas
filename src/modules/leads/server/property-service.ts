import "server-only";

import * as sql from "@dataconnect/admin-generated";
import { executeWorkspaceOperation } from "@/lib/firebase/dataconnect";
import { requireActiveOrganizationRequest } from "@/modules/organizations/server/context";
import { WorkspaceError } from "@/modules/organizations/server/errors";
import { canonicalUuid } from "@/modules/organizations/server/identifiers";
import { validateInput } from "@/modules/organizations/server/validation";
import { assertExpectedOrganization } from "./request-policy";
import { matchProperty } from "../property-matching";
import { leadPropertyReadSchema, leadPrimaryInterestSchema, leadPropertyInterestSchema, leadPropertyViewingSchema, updateLeadPropertyViewingSchema } from "../property-validation";

async function propertyContext(expectedOrganizationId?: string | null) {
  const context = await requireActiveOrganizationRequest();
  if (expectedOrganizationId !== undefined) assertExpectedOrganization(expectedOrganizationId, context.organizationId);
  if (!["OWNER", "ADMIN", "AGENT"].includes(context.membership.role)) {
    throw new WorkspaceError("FORBIDDEN", 403, "Property matching requires an authorized inventory scope. Ask your company owner to review your access.");
  }
  return context;
}

function propertyIds<T extends {id: string; projectId?: string | null; project?: {id: string; projectName: string} | null}>(row: T) {
  return {...row, id: canonicalUuid(row.id), projectId: row.projectId ? canonicalUuid(row.projectId) : null,
    project: row.project ? {...row.project, id: canonicalUuid(row.project.id)} : null};
}

export async function getLeadPropertyData(input: unknown) {
  const {leadId, page} = validateInput(leadPropertyReadSchema, input);
  const {request, organizationId} = await propertyContext();
  // Authorize the lead before returning candidate inventory or any relationship.
  const {lead} = await executeWorkspaceOperation(() => sql.getLead(request.dc, {organizationId, leadId}, request.options), "GetLead");
  if (!lead || lead.archivedAt) throw new WorkspaceError("NOT_FOUND", 404, "Property changes are unavailable for this lead.");
  const [context, candidates] = await Promise.all([
    executeWorkspaceOperation(() => sql.getLeadPropertyContext(request.dc, {organizationId, leadId}, request.options), "GetLeadPropertyContext"),
    executeWorkspaceOperation(() => sql.listLeadPropertyCandidates(request.dc, {organizationId, leadId, limit: 100, offset: (page - 1) * 100}, request.options), "ListLeadPropertyCandidates"),
  ]);
  const properties = candidates.properties.map(propertyIds);
  const matches = properties.flatMap(property => {
    const result = matchProperty({...lead, projectId: context.lead?.projectId}, property);
    return result ? [result] : [];
  });
  return {
    organizationId: canonicalUuid(organizationId), page, candidateTotal: candidates.total[0]?._count ?? 0,
    reviewed: properties.length, matches,
    primaryProject: context.primaryProject ? {...context.primaryProject, id: canonicalUuid(context.primaryProject.id)} : null,
    primaryProperty: context.primaryProperty ? propertyIds(context.primaryProperty) : null,
    shortlist: context.shortlist.map(row => ({...row, id: canonicalUuid(row.id), propertyId: canonicalUuid(row.propertyId),
      property: {...propertyIds(row.property), assignedMembershipId: row.property.assignedMembershipId ? canonicalUuid(row.property.assignedMembershipId) : null}})),
    shortlistTotal: context.shortlistTotal[0]?._count ?? 0,
    viewings: context.viewings.map(row => ({...row, id: canonicalUuid(row.id), propertyId: canonicalUuid(row.propertyId), property: propertyIds(row.property),
      assignedMembershipId: row.assignedMembershipId ? canonicalUuid(row.assignedMembershipId) : null,
      followUp: row.followUp ? {...row.followUp, id: canonicalUuid(row.followUp.id)} : null})),
    viewingTotal: context.viewingTotal[0]?._count ?? 0,
    leadAssignedMembershipId: context.lead?.assignedMembershipId ? canonicalUuid(context.lead.assignedMembershipId) : null,
    viewingAssignees: context.viewingAssignees.map(row => ({id: canonicalUuid(row.id), role: row.role, name: row.userProfile?.displayName || row.email || "Team member"})),
  };
}

export type LeadPropertyData = Awaited<ReturnType<typeof getLeadPropertyData>>;

export async function setLeadPrimaryInterest(input: unknown, expectedOrganizationId: string | null) {
  const data = validateInput(leadPrimaryInterestSchema, input);
  const {request, organizationId} = await propertyContext(expectedOrganizationId);
  return executeWorkspaceOperation(() => sql.setLeadPrimaryInterest(request.dc, {...data, organizationId}, request.options), "SetLeadPrimaryInterest");
}
export async function saveLeadPropertyInterest(input: unknown, expectedOrganizationId: string | null) {
  const data = validateInput(leadPropertyInterestSchema, input);
  const {request, organizationId} = await propertyContext(expectedOrganizationId);
  return executeWorkspaceOperation(() => sql.saveLeadPropertyInterest(request.dc, {...data, organizationId, status: sql.LeadPropertyInterestStatus[data.status], notes: data.notes ?? null}, request.options), "SaveLeadPropertyInterest");
}
export async function scheduleLeadPropertyViewing(input: unknown, expectedOrganizationId: string | null) {
  const data = validateInput(leadPropertyViewingSchema, input);
  const {request, organizationId} = await propertyContext(expectedOrganizationId);
  return executeWorkspaceOperation(() => sql.scheduleLeadPropertyViewing(request.dc, {...data, organizationId, notes: data.notes ?? null,
    customerConfirmation: sql.LeadPropertyViewingConfirmation[data.customerConfirmation]}, request.options), "ScheduleLeadPropertyViewing");
}
export async function updateLeadPropertyViewing(input: unknown, expectedOrganizationId: string | null) {
  const {followUp, outcome, ...data} = validateInput(updateLeadPropertyViewingSchema, input);
  const {request, organizationId} = await propertyContext(expectedOrganizationId);
  return executeWorkspaceOperation(() => sql.updateLeadPropertyViewing(request.dc, {...data, organizationId, status: sql.LeadPropertyViewingStatus[data.status], notes: data.notes ?? null,
    customerConfirmation: sql.LeadPropertyViewingConfirmation[data.customerConfirmation], outcome: outcome ? sql.LeadPropertyViewingOutcome[outcome] : null,
    hasFollowUp: !!followUp, followUpAt: followUp?.dueAt ?? null, followUpTitle: followUp?.title ?? null}, request.options), "UpdateLeadPropertyViewing");
}
