export const leadStatuses = ["NEW", "CONTACTED", "QUALIFIED", "VIEWING_SCHEDULED", "VIEWING_COMPLETED", "NEGOTIATION", "WON", "LOST", "CONVERTED"] as const;
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
  contactId?: string | null;
  contact?: {
    id: string; fullName: string; email?: string | null; phone?: string | null;
    alternatePhone?: string | null; nationality?: string | null; preferredLanguage: string; notes?: string | null;
  } | null;
  leadNumber?: string | null;
  sourceId?: string | null;
  pipelineId?: string | null;
  pipelineStageId?: string | null;
  pipelineStage?: {id: string; name: string; position: number; stageType: string; status: string} | null;
  propertyInterest?: string | null;
  preferredLocation?: string | null;
  propertyType?: string | null;
  transactionType?: "BUY" | "RENT" | "INVEST";
  budgetMin?: number | null;
  budgetMax?: number | null;
  currency?: string;
  bedroomPreference?: string | null;
  priority?: "LOW" | "NORMAL" | "HIGH" | "URGENT";
  archivedAt?: string | null;
  nextFollowUpAt?: string | null;
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
  pipelines: LeadPipeline[];
  sources: {id: string; name: string; sourceType: string}[];
}
export interface LeadPipeline {
  id: string;
  name: string;
  isDefault: boolean;
  stages: {id: string; name: string; position: number; stageType: string; status: string}[];
}
export interface LeadFilters {
  search: string;
  status: LeadStatus | "";
  branchId: string;
  assignedMembershipId: string;
  sourceId: string;
  priority: "" | "LOW" | "NORMAL" | "HIGH" | "URGENT";
  createdFrom: string;
  createdTo: string;
  sort: "CREATED_DESC" | "CREATED_ASC" | "UPDATED_DESC" | "NAME_ASC" | "NAME_DESC" | "FOLLOW_UP_ASC";
  view: "LIST" | "KANBAN";
  followUp: "ALL" | "OVERDUE" | "UPCOMING";
  page: number;
  pageSize: number;
}
export interface LeadListData extends LeadWorkspace {
  leads: LeadRecord[];
  filters: LeadFilters;
  hasNext: boolean;
  total: number;
  metrics: {total: number; new: number; qualified: number; won: number};
}
export interface LeadFollowUpRecord {
  id: string;
  title: string;
  dueAt: string;
  status: "PENDING" | "COMPLETED" | "CANCELLED";
  completedAt?: string | null;
  assignedUserId: string;
  assignedUser?: {id: string; email: string; userProfile?: {displayName: string} | null} | null;
  createdAt: string;
}
export interface LeadDetailData extends LeadWorkspace {
  lead: LeadRecord;
  activities: LeadActivity[];
  hasMoreActivities: boolean;
  activityPage: number;
  followUps: LeadFollowUpRecord[];
  followUpPage: number;
  hasMoreFollowUps: boolean;
  followUpTotal: number;
}
export interface LeadFormData extends LeadWorkspace { lead?: LeadRecord | null }
