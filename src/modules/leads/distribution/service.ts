import "server-only";

import { randomUUID } from "node:crypto";
import * as sdk from "@dataconnect/admin-generated";
import { executeWorkspaceOperation } from "@/lib/firebase/dataconnect";
import { canonicalUuid } from "@/modules/organizations/server/identifiers";
import { assertOrganizationAdministrator } from "@/modules/organizations/server/permission-policy";
import { requireActiveOrganizationRequest } from "@/modules/organizations/server/context";
import { WorkspaceError } from "@/modules/organizations/server/errors";
import { validateInput } from "@/modules/organizations/server/validation";
import {
  availabilityInputSchema,
  distributionPreviewSchema,
  distributionSettingsSchema,
  notificationIdSchema,
  notificationListSchema,
} from "./validation";
import { buildDistributionPlan, type DistributionAgent, type DistributionRulePolicy } from "./policy";

type Context = Awaited<ReturnType<typeof requireActiveOrganizationRequest>>;

async function adminPlan(context: Context) {
  assertOrganizationAdministrator(context.membership);
  return executeWorkspaceOperation(() => sdk.getLeadDistributionPlan(
    context.request.dc,
    { organizationId: context.organizationId },
    context.request.options,
  ));
}

/** Resolve server-side auto assignment; clients never choose a rule or cursor. */
export async function planNewLeadAssignment(
  context: Context,
  lead: { branchId?: string | null; projectId?: string | null },
  requestedMembershipId: string | null,
) {
  const { membership } = context;
  const current = requestedMembershipId ?? (["AGENT", "MANAGER"].includes(membership.role) ? membership.id : null);
  const empty = {
    assignedMembershipId: current,
    hasAssignedMember: current !== null,
    distributionRuleId: null as string | null,
    expectedCursorVersion: null as number | null,
    hasAutoAssignment: false,
    hasDistributionAttempt: false,
  };
  if (requestedMembershipId || !["OWNER", "ADMIN"].includes(membership.role)) return empty;

  const snapshot = await adminPlan(context);
  if (!snapshot.rule) return empty;
  const cursor = snapshot.rule.cursor;
  const candidates: DistributionAgent[] = snapshot.eligibleAgents.map(agent => ({
    id: canonicalUuid(agent.id), role: agent.role, status: agent.status,
    userProfileUid: agent.userProfileUid ?? null,
    availability: agent.agentAvailability_on_membership ? {
      status: agent.agentAvailability_on_membership.status,
      unavailableUntil: agent.agentAvailability_on_membership.unavailableUntil ?? null,
    } : null,
  }));
  const selected = buildDistributionPlan({
    rule: distributionRule(snapshot.rule), lead, agents: candidates,
    lastMembershipId: cursor?.lastMembershipId ?? null,
  });
  if (!selected.attempted) return empty;
  return {
    assignedMembershipId: selected.membershipId,
    hasAssignedMember: selected.membershipId !== null,
    distributionRuleId: canonicalUuid(snapshot.rule.id),
    expectedCursorVersion: cursor?.version ?? null,
    hasAutoAssignment: selected.membershipId !== null,
    hasDistributionAttempt: true,
  };
}

export async function refreshNewLeadAssignment(context: Context, lead: { branchId?: string | null; projectId?: string | null }) {
  return planNewLeadAssignment(context, lead, null);
}

function distributionRule(rule: NonNullable<Awaited<ReturnType<typeof adminPlan>>["rule"]>): DistributionRulePolicy {
  return {
    enabled: rule.enabled,
    mode: rule.mode,
    branchId: rule.branchId ?? null,
    projectId: rule.projectId ?? null,
    skipUnavailable: rule.skipUnavailable,
    businessHoursEnabled: rule.businessHoursEnabled,
    timeZone: rule.timeZone,
    businessDaysMask: rule.businessDaysMask,
    businessStart: rule.businessStart,
    businessEnd: rule.businessEnd,
  };
}

function mapAgent(agent: {
  id: string; email: string; role: string; status?: string; userProfileUid?: string | null;
  distributionEligible?: boolean; userProfile?: { displayName: string };
  agentAvailability_on_membership?: { status: string; unavailableUntil?: string | null };
}) {
  const availability = agent.agentAvailability_on_membership;
  return {
    id: canonicalUuid(agent.id), email: agent.email, role: agent.role,
    status: agent.status ?? "ACTIVE", userProfileUid: agent.userProfileUid ?? agent.id,
    displayName: agent.userProfile?.displayName || agent.email,
    distributionEligible: agent.distributionEligible ?? false,
    availability: availability ? { status: availability.status, unavailableUntil: availability.unavailableUntil ?? null } : null,
  };
}

export async function getLeadDistributionSettings() {
  const context = await requireActiveOrganizationRequest();
  const role = context.membership.role;
  if (role === "OWNER" || role === "ADMIN") {
    const [plan, branches] = await Promise.all([
      adminPlan(context),
      executeWorkspaceOperation(() => sdk.listBranches(context.request.dc, { organizationId: context.organizationId }, context.request.options)),
    ]);
    return {
      organizationId: canonicalUuid(context.organizationId),
      role,
      rule: plan.rule ? {
        ...distributionRule(plan.rule), id: canonicalUuid(plan.rule.id),
        enabled: plan.rule.enabled, mode: plan.rule.mode,
        reassignmentTimeoutMinutes: plan.rule.reassignmentTimeoutMinutes,
        updatedAt: plan.rule.updatedAt,
        cursorVersion: plan.rule.cursor?.version ?? null,
        lastAssignedAt: plan.rule.cursor?.lastAssignedAt ?? null,
      } : null,
      eligibleAgentIds: plan.eligibleAgents.map(agent => canonicalUuid(agent.id)),
      agents: plan.agents.map(mapAgent),
      branches: branches.branches.map(branch => ({ id: canonicalUuid(branch.id), name: branch.name })),
      history: plan.history.map(row => ({
        id: canonicalUuid(row.id), leadId: canonicalUuid(row.leadId), leadName: row.lead.fullName,
        previousAgent: row.previousAgent?.userProfile?.displayName || row.previousAgent?.email || null,
        newAgent: row.newAgent?.userProfile?.displayName || row.newAgent?.email || null,
        assignmentType: row.assignmentType, reason: row.reason ?? null, assignedAt: row.assignedAt,
      })),
    };
  }

  if (role === "AGENT") {
    const result = await executeWorkspaceOperation(() => sdk.getMyAgentAvailability(
      context.request.dc, { organizationId: context.organizationId }, context.request.options,
    ));
    return {
      organizationId: canonicalUuid(context.organizationId),
      role,
      ownAvailability: result.actor?.agentAvailability_on_membership ?? null,
      agents: [], branches: [], history: [], eligibleAgentIds: [], rule: null,
    };
  }

  return { organizationId: canonicalUuid(context.organizationId), role, agents: [], branches: [], history: [], eligibleAgentIds: [], rule: null, ownAvailability: null };
}

export async function saveLeadDistributionSettings(input: unknown, expectedOrganizationId: string | null) {
  const context = await requireActiveOrganizationRequest();
  if (expectedOrganizationId && canonicalUuid(expectedOrganizationId) !== canonicalUuid(context.organizationId)) {
    throw new WorkspaceError("ORGANIZATION_MISMATCH", 403, "Switch to the selected company and try again.");
  }
  assertOrganizationAdministrator(context.membership);
  const parsed = validateInput(distributionSettingsSchema, input);
  const current = await adminPlan(context);
  const ruleId = current.rule?.id ?? randomUUID();
  return executeWorkspaceOperation(() => sdk.saveLeadDistributionSettings(context.request.dc, {
    organizationId: context.organizationId,
    ruleId,
    hasExistingRule: Boolean(current.rule),
    hasCursor: Boolean(current.rule?.cursor),
    expectedUpdatedAt: current.rule?.updatedAt ?? new Date().toISOString(),
    enabled: parsed.enabled,
    mode: parsed.mode === "ROUND_ROBIN" ? sdk.LeadDistributionMode.ROUND_ROBIN : sdk.LeadDistributionMode.MANUAL,
    branchId: parsed.branchId,
    projectId: parsed.projectId,
    skipUnavailable: parsed.skipUnavailable,
    businessHoursEnabled: parsed.businessHoursEnabled,
    timeZone: parsed.timeZone,
    businessDaysMask: parsed.businessDaysMask,
    businessStart: parsed.businessStart,
    businessEnd: parsed.businessEnd,
    reassignmentTimeoutMinutes: parsed.reassignmentTimeoutMinutes,
    eligibleAgentIds: parsed.eligibleAgentIds,
  }, context.request.options));
}

export async function previewLeadDistribution(input: unknown, expectedOrganizationId: string | null) {
  const context = await requireActiveOrganizationRequest();
  if (expectedOrganizationId && canonicalUuid(expectedOrganizationId) !== canonicalUuid(context.organizationId)) {
    throw new WorkspaceError("ORGANIZATION_MISMATCH", 403, "Switch to the selected company and try again.");
  }
  const parsed = validateInput(distributionPreviewSchema, input);
  const planData = await adminPlan(context);
  const rule = planData.rule ? distributionRule(planData.rule) : null;
  const agents: DistributionAgent[] = planData.eligibleAgents.map(agent => ({
    id: canonicalUuid(agent.id), role: agent.role, status: agent.status,
    userProfileUid: agent.userProfileUid ?? null,
    availability: agent.agentAvailability_on_membership ? {
      status: agent.agentAvailability_on_membership.status,
      unavailableUntil: agent.agentAvailability_on_membership.unavailableUntil ?? null,
    } : null,
  }));
  const cursor = planData.rule?.cursor;
  const result = buildDistributionPlan({
    rule, lead: parsed, agents, lastMembershipId: cursor?.lastMembershipId ?? null,
  });
  const assigned = result.attempted && result.membershipId
    ? agents.find(agent => canonicalUuid(agent.id) === canonicalUuid(result.membershipId!))
    : null;
  return { ...result, assignedAgent: assigned ? { id: assigned.id } : null, cursorVersion: cursor?.version ?? null };
}

export async function setAgentAvailability(input: unknown, expectedOrganizationId: string | null) {
  const context = await requireActiveOrganizationRequest();
  if (expectedOrganizationId && canonicalUuid(expectedOrganizationId) !== canonicalUuid(context.organizationId)) {
    throw new WorkspaceError("ORGANIZATION_MISMATCH", 403, "Switch to the selected company and try again.");
  }
  const parsed = validateInput(availabilityInputSchema, input);
  const targetId = parsed.membershipId ?? (context.membership.role === "AGENT" ? context.membership.id : null);
  if (!targetId) throw new WorkspaceError("INVALID_INPUT", 400, "Choose an active company agent.");
  const isSelf = canonicalUuid(targetId) === canonicalUuid(context.membership.id);
  if (!isSelf && context.membership.role !== "OWNER" && context.membership.role !== "ADMIN") {
    throw new WorkspaceError("FORBIDDEN", 403, "Only an owner or administrator can update another agent's availability.");
  }
  return executeWorkspaceOperation(() => sdk.setAgentAvailability(context.request.dc, {
    organizationId: context.organizationId,
    membershipId: isSelf ? undefined : targetId,
    status: parsed.status === "UNAVAILABLE" ? sdk.AgentAvailabilityStatus.UNAVAILABLE : sdk.AgentAvailabilityStatus.AVAILABLE,
    unavailableUntil: parsed.status === "UNAVAILABLE" ? parsed.unavailableUntil ?? null : null,
    reason: parsed.reason ?? null,
  }, context.request.options));
}

export async function listNotifications(input: unknown = {}) {
  const context = await requireActiveOrganizationRequest();
  const parsed = validateInput(notificationListSchema, input);
  const result = await executeWorkspaceOperation(() => sdk.listInAppNotifications(context.request.dc, {
    organizationId: context.organizationId, ...parsed,
  }, context.request.options));
  return {
    notifications: result.notifications.map(row => ({
      id: canonicalUuid(row.id), type: row.type, title: row.title, body: row.body,
      readAt: row.readAt ?? null, createdAt: row.createdAt,
      lead: row.lead ? { id: canonicalUuid(row.lead.id), fullName: row.lead.fullName, leadNumber: row.lead.leadNumber ?? null } : null,
    })),
    total: result.total[0]?.count ?? 0,
  };
}

export async function markNotificationRead(input: unknown, expectedOrganizationId: string | null) {
  const context = await requireActiveOrganizationRequest();
  if (expectedOrganizationId && canonicalUuid(expectedOrganizationId) !== canonicalUuid(context.organizationId)) {
    throw new WorkspaceError("ORGANIZATION_MISMATCH", 403, "Switch to the selected company and try again.");
  }
  const parsed = validateInput(notificationIdSchema, input);
  return executeWorkspaceOperation(() => sdk.markInAppNotificationRead(context.request.dc, {
    organizationId: context.organizationId, ...parsed,
  }, context.request.options));
}
