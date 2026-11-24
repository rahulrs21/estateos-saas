import type { LeadChannel } from "../lead-capture/attribution";
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
  /** Phase 7E.3: where the lead came from (list rows only); null when no source was recorded. */
  origin?: LeadOrigin | null;
}
/** Phase 7E.3: the channel and campaign a lead came from, for the list, the board and the filters. */
export interface LeadOrigin { channel: LeadChannel; platform: string; campaignKey: string | null; campaign: string | null }
/** Phase 7E.3: everything recorded about where a lead came from (the Source card). */
export interface LeadSourceRecord extends LeadOrigin {
  utmSource: string | null; utmMedium: string | null; utmCampaign: string | null; utmContent: string | null; utmTerm: string | null;
  metaCampaignId: string | null; metaCampaignName: string | null; metaAdsetId: string | null; metaAdsetName: string | null; metaAdId: string | null; metaAdName: string | null; metaFormId: string | null;
  landingHost: string | null; landingPath: string | null; referrerHost: string | null;
  clickIds: Array<{name: "gclid" | "fbclid" | "ttclid" | "ctwa_clid"; value: string}>;
  capturedAt: string;
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
  /** Phase 7E.3: campaigns of the leads this member may see (Campaign filter, suggestions on the lead form). */
  campaigns: {key: string; label: string}[];
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
  /** Phase 7E.3: the lead's recorded channel and campaign (its key or name). */
  channel: LeadChannel | "";
  campaign: string;
  createdFrom: string;
  createdTo: string;
  sort: "CREATED_DESC" | "CREATED_ASC" | "UPDATED_DESC" | "NAME_ASC" | "NAME_DESC" | "FOLLOW_UP_ASC";
  /** A created-date preset; the server turns it into createdFrom/createdTo (Dubai days). */
  range: "TODAY" | "YESTERDAY" | "7D" | "30D" | "LAST_MONTH" | "ALL" | "CUSTOM";
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
/** What the visitor wrote in the website form or landing page that created the lead. */
export interface LeadEnquiry { message: string | null; receivedAt: string }
/** What a Meta lead ad's instant form sent, as stored with the lead's first activity (Phase 7D.4). */
export interface LeadAdEnquiry {
  receivedAt: string;
  platform: "facebook" | "instagram" | null;
  isOrganic: boolean;
  pageName: string | null;
  formName: string | null;
  answers: Array<{key: string; label: string; value: string}>;
  consent: Array<{key: string; checked: boolean}>;
  ids: {leadgenId: string | null; formId: string | null; adId: string | null; adsetId: string | null; campaignId: string | null};
  metaCreatedAt: string | null;
}

export interface LeadDetailData extends LeadWorkspace {
  lead: LeadRecord;
  activities: LeadActivity[];
  /** The website enquiry that created this lead, when it came from a form or landing page. */
  enquiry?: LeadEnquiry | null;
  /** The Meta lead ad form that created this lead, with every answer. */
  adEnquiry?: LeadAdEnquiry | null;
  /** Phase 7E.3: where the lead came from; null for leads created before sources were recorded. */
  source?: LeadSourceRecord | null;
  hasMoreActivities: boolean;
  activityPage: number;
  followUps: LeadFollowUpRecord[];
  followUpPage: number;
  hasMoreFollowUps: boolean;
  followUpTotal: number;
}
/** Phase 7E.2: the inbox conversation a new lead is created from (Create lead in the inbox). */
export interface LeadFormConversation { id: string; channel: string; customerIdentity: string; customerName: string | null; adHeadline: string | null }
export interface LeadFormData extends LeadWorkspace { lead?: LeadRecord | null; fromConversation?: LeadFormConversation | null }
