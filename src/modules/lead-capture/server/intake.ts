import "server-only";

import * as sdk from "@dataconnect/admin-generated";
import type { sqlConnectHandle } from "@/lib/firebase/sql-connect-handle";
import { canonicalUuid } from "@/modules/organizations/server/identifiers";
import { mapWorkspaceDataError } from "@/modules/organizations/server/errors";
import { buildDistributionPlan, type DistributionAgent, type DistributionRulePolicy } from "@/modules/leads/distribution/policy";

/*
 * The steps every captured lead shares before its transaction (website forms, landing pages, Meta Lead Ads):
 * matching an existing contact and planning the round-robin assignment. Both read with fixed server-only
 * (NO_ACCESS) operations for the company the server already resolved; the transaction re-checks both.
 */

type Handle = ReturnType<typeof sqlConnectHandle>;

async function read<T>(operation: () => Promise<{data: T}>): Promise<T> {
  try { return (await operation()).data; }
  catch (error) { throw mapWorkspaceDataError(error); }
}

/** The one contact with exactly this email or phone, or null (ambiguous candidates are never merged). */
export async function matchSingleContact(dc: Handle, organizationId: string, normalizedEmail: string | null, normalizedPhone: string | null) {
  const contacts = await read(() => sdk.findWebsiteLeadCaptureContact(dc, {organizationId, normalizedEmail, normalizedPhone}));
  return contacts.contacts.length === 1 ? canonicalUuid(contacts.contacts[0].id) : null;
}

export interface AssignmentPlan {
  assignedMembershipId: string | null;
  hasDistributionAttempt: boolean;
  distributionRuleId: string | null;
  expectedCursorVersion: number | null;
}

/** The company's round-robin choice for a new lead in this branch and project (or no assignment). */
export async function planAutoAssignment(dc: Handle, organizationId: string, scope: {branchId: string | null; projectId: string | null}): Promise<AssignmentPlan> {
  const ruleData = await read(() => sdk.getWebsiteLeadDistributionPlan(dc, {organizationId}));
  const none: AssignmentPlan = {assignedMembershipId: null, hasDistributionAttempt: false, distributionRuleId: null, expectedCursorVersion: null};
  const rule = ruleData.rule;
  if (!rule) return none;
  const agents: DistributionAgent[] = ruleData.eligibleAgents.map((agent) => ({
    id: canonicalUuid(agent.id), role: agent.role, status: agent.status, userProfileUid: agent.userProfileUid ?? null,
    availability: agent.agentAvailability_on_membership ? {
      status: agent.agentAvailability_on_membership.status,
      unavailableUntil: agent.agentAvailability_on_membership.unavailableUntil ?? null,
    } : null,
  }));
  const policy: DistributionRulePolicy = {
    enabled: rule.enabled, mode: rule.mode, branchId: rule.branchId ?? null, projectId: rule.projectId ?? null,
    skipUnavailable: rule.skipUnavailable, businessHoursEnabled: rule.businessHoursEnabled,
    timeZone: rule.timeZone, businessDaysMask: rule.businessDaysMask, businessStart: rule.businessStart, businessEnd: rule.businessEnd,
  };
  const plan = buildDistributionPlan({
    rule: policy, lead: scope, agents,
    lastMembershipId: rule.cursor?.lastMembershipId ? canonicalUuid(rule.cursor.lastMembershipId) : null,
  });
  if (!plan.attempted) return none;
  return {
    assignedMembershipId: plan.membershipId ? canonicalUuid(plan.membershipId) : null,
    hasDistributionAttempt: true,
    distributionRuleId: canonicalUuid(rule.id),
    expectedCursorVersion: rule.cursor?.version ?? null,
  };
}
