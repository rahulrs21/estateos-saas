export interface DistributionSettingsData {
  organizationId: string;
  role: "OWNER" | "ADMIN" | "MANAGER" | "AGENT";
  rule: null | {
    id: string;
    enabled: boolean;
    mode: "MANUAL" | "ROUND_ROBIN";
    branchId: string | null;
    projectId: string | null;
    skipUnavailable: boolean;
    businessHoursEnabled: boolean;
    timeZone: string;
    businessDaysMask: number;
    businessStart: string;
    businessEnd: string;
    reassignmentTimeoutMinutes: number;
    updatedAt: string;
    cursorVersion: number | null;
    lastAssignedAt: string | null;
  };
  eligibleAgentIds: string[];
  agents: {
    id: string;
    email: string;
    role: string;
    status: string;
    displayName: string;
    distributionEligible: boolean;
    availability: { status: string; unavailableUntil: string | null } | null;
  }[];
  branches: { id: string; name: string }[];
  history: {
    id: string;
    leadId: string;
    leadName: string;
    previousAgent: string | null;
    newAgent: string | null;
    assignmentType: string;
    reason: string | null;
    assignedAt: string;
  }[];
  ownAvailability?: { status: string; unavailableUntil?: string | null; reason?: string | null } | null;
}

export interface InAppNotification {
  id: string;
  type: "LEAD_ASSIGNED" | "LEAD_UNASSIGNED";
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
  lead: { id: string; fullName: string; leadNumber: string | null } | null;
}
