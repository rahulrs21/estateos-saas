import "server-only";

import { z } from "zod";
import {
  getLead, listBranches, listLeadAssignees, listLeadActivities,
  getLeadMetrics, listLeadFollowUps,
  type GetLeadData,
} from "@dataconnect/admin-generated";
import { executeWorkspaceOperation } from "@/lib/firebase/dataconnect";
import { requireActiveOrganizationRequest } from "@/modules/organizations/server/context";
import { WorkspaceError } from "@/modules/organizations/server/errors";
import { canonicalUuid } from "@/modules/organizations/server/identifiers";
import { validateInput } from "@/modules/organizations/server/validation";
import { leadIdInputSchema, leadPageFiltersSchema } from "../validation";
import type { LeadRecord, LeadWorkspace, LeadListData, LeadDetailData, LeadFormData } from "../types";
import { leadListOperation, leadQueryVariables } from "./service";
import { ensureLeadConfiguration } from "./crm-service";

type Context = Awaited<ReturnType<typeof requireActiveOrganizationRequest>>;
export type LeadSearchParams = Record<string, string | string[] | undefined>;

function leadRecord(row: NonNullable<GetLeadData["lead"]>): LeadRecord {
  return {
    id: canonicalUuid(row.id), organizationId: canonicalUuid(row.organizationId),
    fullName: row.contact?.fullName ?? row.fullName,
    email: row.contact ? row.contact.email : row.email,
    phone: row.contact ? row.contact.phone : row.phone, source: row.source, status: row.status,
    branchId: row.branchId ? canonicalUuid(row.branchId) : null,
    assignedMembershipId: row.assignedMembershipId ? canonicalUuid(row.assignedMembershipId) : null,
    branch: row.branch ? { ...row.branch, id: canonicalUuid(row.branch.id) } : null,
    assignedMembership: row.assignedMembership ? { ...row.assignedMembership, id: canonicalUuid(row.assignedMembership.id) } : null,
    followUpAt: row.followUpAt, followUpNote: row.followUpNote,
    createdAt: row.createdAt, updatedAt: row.updatedAt,
    contactId: row.contactId ? canonicalUuid(row.contactId) : null,
    contact: row.contact ? {...row.contact, id: canonicalUuid(row.contact.id)} : null,
    leadNumber: row.leadNumber ? canonicalUuid(row.leadNumber) : null,
    sourceId: row.sourceId ? canonicalUuid(row.sourceId) : null,
    pipelineId: row.pipelineId ? canonicalUuid(row.pipelineId) : null,
    pipelineStageId: row.pipelineStageId ? canonicalUuid(row.pipelineStageId) : null,
    pipelineStage: row.pipelineStage ? {...row.pipelineStage,id:canonicalUuid(row.pipelineStage.id)} : null,
    propertyInterest: row.propertyInterest, preferredLocation: row.preferredLocation, propertyType: row.propertyType,
    transactionType: row.transactionType, budgetMin: row.budgetMin, budgetMax: row.budgetMax,
    currency: row.currency, bedroomPreference: row.bedroomPreference, priority: row.priority,
    archivedAt: row.archivedAt, nextFollowUpAt: row.followUpAt,
  };
}

async function workspace(context: Context): Promise<LeadWorkspace> {
  const { request, organizationId, organization, membership } = context;
  const [branches, assignees, configuration] = await Promise.all([
    executeWorkspaceOperation(() => listBranches(request.dc, { organizationId }, request.options), "ListBranches"),
    executeWorkspaceOperation(() => listLeadAssignees(request.dc, { organizationId, limit: 100 }, request.options), "ListLeadAssignees"),
    ensureLeadConfiguration(context),
  ]);
  return {
    organization: { id: canonicalUuid(organizationId), name: organization.name },
    membership: { id: canonicalUuid(membership.id), role: membership.role },
    canManageAssignments: ["OWNER", "ADMIN", "MANAGER"].includes(membership.role),
    branches: branches.branches.map(row => ({ id: canonicalUuid(row.id), name: row.name })),
    assignees: assignees.memberships.map(row => ({ ...row, id: canonicalUuid(row.id) })),
    pipelines: configuration.pipelines.map(row => ({id: canonicalUuid(row.id), name: row.name, isDefault: row.isDefault, stages: row.pipelineStages_on_pipeline.map(stage => ({...stage, id: canonicalUuid(stage.id)}))})),
    sources: configuration.leadSources.map(row => ({...row, id: canonicalUuid(row.id)})),
  };
}

function filterInput(params: LeadSearchParams) {
  const value: Record<string, unknown> = {};
  for (const key of ["search", "status", "branchId", "assignedMembershipId", "sourceId", "priority", "createdFrom", "createdTo", "sort", "view", "followUp", "page", "pageSize"]) {
    if (params[key] !== undefined) {
      if (Array.isArray(params[key])) throw new WorkspaceError("VALIDATION_ERROR", 400, "Each lead filter must have a single value.");
      value[key] = params[key];
    }
  }
  return validateInput(leadPageFiltersSchema, value);
}

export async function getLeadsPageData(params: LeadSearchParams = {}): Promise<LeadListData> {
  const context = await requireActiveOrganizationRequest();
  const filters = filterInput(params);
  const variables = leadQueryVariables(context.organizationId, {
    search: filters.search, status: filters.status || undefined,
    branchId: filters.branchId || undefined, assignedMembershipId: filters.assignedMembershipId || undefined,
    sourceId: filters.sourceId || undefined, priority: filters.priority || undefined,
    createdFrom: filters.createdFrom || undefined, createdTo: filters.createdTo || undefined, sort: filters.sort,
    followUp: filters.followUp, limit: filters.pageSize, offset: (filters.page - 1) * filters.pageSize,
  });
  const [choices, result, metrics] = await Promise.all([
    workspace(context),
    executeWorkspaceOperation(() => leadListOperation(filters.sort)(context.request.dc, variables, context.request.options), "ListLeads"),
    executeWorkspaceOperation(() => getLeadMetrics(context.request.dc, {organizationId: context.organizationId}, context.request.options), "GetLeadMetrics"),
  ]);
  const total = result.total[0]?.count ?? 0;
  return { ...choices, filters, total, leads: result.leads.map(leadRecord), hasNext: filters.page * filters.pageSize < total,
    metrics: {total: metrics.total[0]?.count ?? 0, new: metrics.newLeads[0]?.count ?? 0, qualified: metrics.qualified[0]?.count ?? 0, won: metrics.won[0]?.count ?? 0},
  };
}

async function accessibleLead(context: Context, id: string) {
  const variables = validateInput(leadIdInputSchema, { leadId: id });
  const result = await executeWorkspaceOperation(() => getLead(context.request.dc, { ...variables, organizationId: context.organizationId }, context.request.options), "GetLead");
  if (!result.lead) throw new WorkspaceError("NOT_FOUND", 404, "This lead is unavailable.");
  return leadRecord(result.lead);
}

function retainCurrentAssignee(data: LeadWorkspace, lead: LeadRecord): LeadWorkspace {
  if (lead.assignedMembership && !data.assignees.some(row => row.id === lead.assignedMembershipId)) {
    return { ...data, assignees: [...data.assignees, lead.assignedMembership] };
  }
  return data;
}

export async function getLeadDetailData(id: string, rawActivityPage: unknown = undefined, rawFollowUpPage: unknown = undefined): Promise<LeadDetailData> {
  const context = await requireActiveOrganizationRequest();
  const activityPage = validateInput(z.coerce.number().int().min(1).max(401).default(1), rawActivityPage);
  const followUpPage = validateInput(z.coerce.number().int().min(1).max(1001).default(1), rawFollowUpPage);
  const lead = await accessibleLead(context, id);
  const [choices, timeline, followUps] = await Promise.all([
    workspace(context),
    executeWorkspaceOperation(() => listLeadActivities(context.request.dc, {
      organizationId: context.organizationId, leadId: lead.id, limit: 25, offset: (activityPage - 1) * 25,
    }, context.request.options), "ListLeadActivities"),
    executeWorkspaceOperation(() => listLeadFollowUps(context.request.dc, {
      organizationId: context.organizationId, leadId: lead.id, limit: 10, offset: (followUpPage - 1) * 10,
    }, context.request.options), "ListLeadFollowUps"),
  ]);
  return {
    ...retainCurrentAssignee(choices, lead), lead, activityPage,
    activities: timeline.activities.map(row => ({ ...row, id: canonicalUuid(row.id), organizationId: canonicalUuid(context.organizationId) })),
    hasMoreActivities: activityPage * 25 < (timeline.total[0]?.count ?? 0),
    followUps: followUps.followUps.map(row => ({...row, id: canonicalUuid(row.id), assignedUserId: canonicalUuid(row.assignedUserId), assignedUser: row.assignedUser ? {...row.assignedUser, id: canonicalUuid(row.assignedUser.id)} : null})),
    followUpPage, followUpTotal: followUps.total[0]?.count ?? 0,
    hasMoreFollowUps: followUpPage * 10 < (followUps.total[0]?.count ?? 0),
  };
}

export async function getLeadFormData(id?: string): Promise<LeadFormData> {
  const context = await requireActiveOrganizationRequest();
  // Authorize the record before fetching editor choices; no global lead lookup.
  const lead = id ? await accessibleLead(context, id) : null;
  const choices = await workspace(context);
  const formChoices = lead && context.membership.role === "MANAGER"
    ? { ...choices, canManageAssignments: false }
    : choices;
  return { ...(lead ? retainCurrentAssignee(formChoices, lead) : formChoices), lead };
}
