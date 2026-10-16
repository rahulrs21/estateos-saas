import "server-only";

import { z } from "zod";
import {
  getLead, listLeads, listBranches, listLeadAssignees, listLeadActivities,
  type GetLeadData,
} from "@dataconnect/admin-generated";
import { executeWorkspaceOperation } from "@/lib/firebase/dataconnect";
import { requireActiveOrganizationRequest } from "@/modules/organizations/server/context";
import { WorkspaceError } from "@/modules/organizations/server/errors";
import { canonicalUuid } from "@/modules/organizations/server/identifiers";
import { validateInput } from "@/modules/organizations/server/validation";
import { leadIdInputSchema, leadPageFiltersSchema } from "../validation";
import type { LeadRecord, LeadWorkspace, LeadListData, LeadDetailData, LeadFormData } from "../types";
import { leadQueryVariables } from "./service";

type Context = Awaited<ReturnType<typeof requireActiveOrganizationRequest>>;
export type LeadSearchParams = Record<string, string | string[] | undefined>;

function leadRecord(row: NonNullable<GetLeadData["lead"]>): LeadRecord {
  return {
    id: canonicalUuid(row.id), organizationId: canonicalUuid(row.organizationId),
    fullName: row.fullName, email: row.email, phone: row.phone, source: row.source, status: row.status,
    branchId: row.branchId ? canonicalUuid(row.branchId) : null,
    assignedMembershipId: row.assignedMembershipId ? canonicalUuid(row.assignedMembershipId) : null,
    branch: row.branch ? { ...row.branch, id: canonicalUuid(row.branch.id) } : null,
    assignedMembership: row.assignedMembership ? { ...row.assignedMembership, id: canonicalUuid(row.assignedMembership.id) } : null,
    followUpAt: row.followUpAt, followUpNote: row.followUpNote,
    createdAt: row.createdAt, updatedAt: row.updatedAt,
  };
}

async function workspace(context: Context): Promise<LeadWorkspace> {
  const { request, organizationId, organization, membership } = context;
  const [branches, assignees] = await Promise.all([
    executeWorkspaceOperation(() => listBranches(request.dc, { organizationId }, request.options)),
    executeWorkspaceOperation(() => listLeadAssignees(request.dc, { organizationId, limit: 100 }, request.options)),
  ]);
  return {
    organization: { id: canonicalUuid(organizationId), name: organization.name },
    membership: { id: canonicalUuid(membership.id), role: membership.role },
    canManageAssignments: ["OWNER", "ADMIN", "MANAGER"].includes(membership.role),
    branches: branches.branches.map(row => ({ id: canonicalUuid(row.id), name: row.name })),
    assignees: assignees.memberships.map(row => ({ ...row, id: canonicalUuid(row.id) })),
  };
}

function filterInput(params: LeadSearchParams) {
  const value: Record<string, unknown> = {};
  for (const key of ["search", "status", "branchId", "assignedMembershipId", "followUp", "page", "pageSize"]) {
    if (params[key] !== undefined) {
      if (Array.isArray(params[key])) throw new WorkspaceError("INVALID_INPUT", 400, "Each lead filter must have a single value.");
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
    followUp: filters.followUp, limit: filters.pageSize, offset: (filters.page - 1) * filters.pageSize,
  });
  const [choices, result] = await Promise.all([
    workspace(context),
    executeWorkspaceOperation(() => listLeads(context.request.dc, variables, context.request.options)),
  ]);
  const total = result.total[0]?.count ?? 0;
  return { ...choices, filters, total, leads: result.leads.map(leadRecord), hasNext: filters.page * filters.pageSize < total };
}

async function accessibleLead(context: Context, id: string) {
  const variables = validateInput(leadIdInputSchema, { leadId: id });
  const result = await executeWorkspaceOperation(() => getLead(context.request.dc, { ...variables, organizationId: context.organizationId }, context.request.options));
  if (!result.lead) throw new WorkspaceError("NOT_FOUND", 404, "This lead is unavailable.");
  return leadRecord(result.lead);
}

function retainCurrentAssignee(data: LeadWorkspace, lead: LeadRecord): LeadWorkspace {
  if (lead.assignedMembership && !data.assignees.some(row => row.id === lead.assignedMembershipId)) {
    return { ...data, assignees: [...data.assignees, lead.assignedMembership] };
  }
  return data;
}

export async function getLeadDetailData(id: string, rawActivityPage: unknown = undefined): Promise<LeadDetailData> {
  const context = await requireActiveOrganizationRequest();
  const activityPage = validateInput(z.coerce.number().int().min(1).max(401).default(1), rawActivityPage);
  const lead = await accessibleLead(context, id);
  const [choices, timeline] = await Promise.all([
    workspace(context),
    executeWorkspaceOperation(() => listLeadActivities(context.request.dc, {
      organizationId: context.organizationId, leadId: lead.id, limit: 25, offset: (activityPage - 1) * 25,
    }, context.request.options)),
  ]);
  return {
    ...retainCurrentAssignee(choices, lead), lead, activityPage,
    activities: timeline.activities.map(row => ({ ...row, id: canonicalUuid(row.id), organizationId: canonicalUuid(context.organizationId) })),
    hasMoreActivities: activityPage * 25 < (timeline.total[0]?.count ?? 0),
  };
}

export async function getLeadFormData(id?: string): Promise<LeadFormData> {
  const context = await requireActiveOrganizationRequest();
  // Authorize the record before fetching editor choices; no global lead lookup.
  const lead = id ? await accessibleLead(context, id) : null;
  const choices = await workspace(context);
  return { ...(lead ? retainCurrentAssignee(choices, lead) : choices), lead };
}
