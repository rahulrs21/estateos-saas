export const leadStatuses = ["NEW", "CONTACTED", "QUALIFIED", "LOST", "CONVERTED"] as const;
export type LeadStatus = (typeof leadStatuses)[number];
export type LeadRole = "OWNER" | "ADMIN" | "MANAGER" | "AGENT";
export interface LeadBranch { id: string; name: string }
export interface LeadAssignee {
  id: string;
  email: string;
  role: LeadRole;
  userProfile?: { uid: string; displayName: string } | null;
}
export interface LeadRecord {
  id: string;
  organizationId: string;
  fullName: string;
  email?: string | null;
  phone?: string | null;
  source?: string | null;
  status: LeadStatus;
  branchId?: string | null;
  assignedMembershipId?: string | null;
  followUpAt?: string | null;
  followUpNote?: string | null;
  branch?: LeadBranch | null;
  assignedMembership?: LeadAssignee | null;
  createdAt: string;
  updatedAt: string;
}
export interface LeadActivity {
  id: string;
  organizationId: string;
  actorUid: string;
  kind: string;
  note?: string | null;
  metadata?: unknown;
  createdAt: string;
  actor?: { uid: string; displayName: string } | null;
}
export interface LeadWorkspace {
  organization: { id: string; name: string };
  membership: { id: string; role: LeadRole };
  canManageAssignments: boolean;
  branches: LeadBranch[];
  assignees: LeadAssignee[];
}
export interface LeadFilters {
  search: string;
  status: LeadStatus | "";
  branchId: string;
  assignedMembershipId: string;
  followUp: "ALL" | "OVERDUE" | "UPCOMING";
  page: number;
  pageSize: number;
}
export interface LeadListData extends LeadWorkspace {
  leads: LeadRecord[];
  filters: LeadFilters;
  hasNext: boolean;
  total: number;
}
export interface LeadDetailData extends LeadWorkspace {
  lead: LeadRecord;
  activities: LeadActivity[];
  hasMoreActivities: boolean;
  activityPage: number;
}
export interface LeadFormData extends LeadWorkspace { lead?: LeadRecord | null }
