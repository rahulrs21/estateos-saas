import { ConnectorConfig, DataConnect, OperationOptions, ExecuteOperationResponse } from 'firebase-admin/data-connect';

export const connectorConfig: ConnectorConfig;

export type TimestampString = string;
export type UUIDString = string;
export type Int64String = string;
export type DateString = string;

export enum ActivityKind {
  ORGANIZATION_CREATED = "ORGANIZATION_CREATED",
  ORGANIZATION_SWITCHED = "ORGANIZATION_SWITCHED",
  ORGANIZATION_UPDATED = "ORGANIZATION_UPDATED",
  BRANCH_CREATED = "BRANCH_CREATED",
  MEMBERSHIP_INVITED = "MEMBERSHIP_INVITED",
  INVITATION_ACCEPTED = "INVITATION_ACCEPTED",
  MEMBERSHIP_APPROVED = "MEMBERSHIP_APPROVED",
  MEMBERSHIP_SUSPENDED = "MEMBERSHIP_SUSPENDED",
  MEMBERSHIP_REVOKED = "MEMBERSHIP_REVOKED",
  MEMBERSHIP_REMOVED = "MEMBERSHIP_REMOVED",
  MEMBERSHIP_ROLE_CHANGED = "MEMBERSHIP_ROLE_CHANGED",
  INVITATION_REVOKED = "INVITATION_REVOKED",
  INVITATION_REISSUED = "INVITATION_REISSUED",
  INVITATION_DELIVERY_PREVIEW = "INVITATION_DELIVERY_PREVIEW",
  INVITATION_DELIVERY_ACCEPTED = "INVITATION_DELIVERY_ACCEPTED",
  INVITATION_DELIVERY_FAILED = "INVITATION_DELIVERY_FAILED",
  LEAD_CREATED = "LEAD_CREATED",
  LEAD_UPDATED = "LEAD_UPDATED",
  LEAD_DISTRIBUTION_RULE_UPDATED = "LEAD_DISTRIBUTION_RULE_UPDATED",
  AGENT_AVAILABILITY_UPDATED = "AGENT_AVAILABILITY_UPDATED",
  LEAD_NOTE_ADDED = "LEAD_NOTE_ADDED",
  LEAD_STATUS_CHANGED = "LEAD_STATUS_CHANGED",
  LEAD_ASSIGNED = "LEAD_ASSIGNED",
  FOLLOW_UP_SCHEDULED = "FOLLOW_UP_SCHEDULED",
  FOLLOW_UP_COMPLETED = "FOLLOW_UP_COMPLETED",
  CONTACT_CREATED = "CONTACT_CREATED",
  CONTACT_UPDATED = "CONTACT_UPDATED",
  PIPELINE_INITIALIZED = "PIPELINE_INITIALIZED",
  LEAD_ARCHIVED = "LEAD_ARCHIVED",
  LEAD_FORM_CREATED = "LEAD_FORM_CREATED",
  LEAD_FORM_UPDATED = "LEAD_FORM_UPDATED",
  WEBSITE_LEAD_CAPTURED = "WEBSITE_LEAD_CAPTURED",
}
export enum AgentAvailabilityStatus {
  AVAILABLE = "AVAILABLE",
  UNAVAILABLE = "UNAVAILABLE",
}
export enum AuditTargetType {
  ORGANIZATION = "ORGANIZATION",
  MEMBERSHIP = "MEMBERSHIP",
  BRANCH = "BRANCH",
  LEAD = "LEAD",
  INVITATION = "INVITATION",
  CONTACT = "CONTACT",
  PIPELINE = "PIPELINE",
  LEAD_DISTRIBUTION_RULE = "LEAD_DISTRIBUTION_RULE",
  AGENT_AVAILABILITY = "AGENT_AVAILABILITY",
  LEAD_CAPTURE_FORM = "LEAD_CAPTURE_FORM",
  WEBSITE_SUBMISSION = "WEBSITE_SUBMISSION",
}
export enum CompanySize {
  SOLO = "SOLO",
  TWO_TO_TEN = "TWO_TO_TEN",
  ELEVEN_TO_FIFTY = "ELEVEN_TO_FIFTY",
  FIFTY_ONE_TO_TWO_HUNDRED = "FIFTY_ONE_TO_TWO_HUNDRED",
  TWO_HUNDRED_PLUS = "TWO_HUNDRED_PLUS",
}
export enum Emirate {
  ABU_DHABI = "ABU_DHABI",
  DUBAI = "DUBAI",
  SHARJAH = "SHARJAH",
  AJMAN = "AJMAN",
  UMM_AL_QUWAIN = "UMM_AL_QUWAIN",
  RAS_AL_KHAIMAH = "RAS_AL_KHAIMAH",
  FUJAIRAH = "FUJAIRAH",
}
export enum InAppNotificationType {
  LEAD_ASSIGNED = "LEAD_ASSIGNED",
  LEAD_UNASSIGNED = "LEAD_UNASSIGNED",
}
export enum InvitationDeliveryStatus {
  NOT_SENT = "NOT_SENT",
  PREVIEW = "PREVIEW",
  ACCEPTED = "ACCEPTED",
  FAILED = "FAILED",
}
export enum InvitationStatus {
  PENDING = "PENDING",
  ACCEPTED = "ACCEPTED",
  REVOKED = "REVOKED",
}
export enum LeadAssignmentType {
  INITIAL = "INITIAL",
  MANUAL = "MANUAL",
  ROUND_ROBIN = "ROUND_ROBIN",
  REASSIGNMENT = "REASSIGNMENT",
}
export enum LeadCaptureFormStatus {
  DRAFT = "DRAFT",
  ACTIVE = "ACTIVE",
  DISABLED = "DISABLED",
}
export enum LeadDistributionMode {
  MANUAL = "MANUAL",
  ROUND_ROBIN = "ROUND_ROBIN",
}
export enum LeadFollowUpStatus {
  PENDING = "PENDING",
  COMPLETED = "COMPLETED",
  CANCELLED = "CANCELLED",
}
export enum LeadPriority {
  LOW = "LOW",
  NORMAL = "NORMAL",
  HIGH = "HIGH",
  URGENT = "URGENT",
}
export enum LeadSourceType {
  MANUAL = "MANUAL",
  REFERRAL = "REFERRAL",
  WEBSITE = "WEBSITE",
  PORTAL = "PORTAL",
  OTHER = "OTHER",
}
export enum LeadStatus {
  NEW = "NEW",
  CONTACTED = "CONTACTED",
  QUALIFIED = "QUALIFIED",
  LOST = "LOST",
  CONVERTED = "CONVERTED",
  VIEWING_SCHEDULED = "VIEWING_SCHEDULED",
  VIEWING_COMPLETED = "VIEWING_COMPLETED",
  NEGOTIATION = "NEGOTIATION",
  WON = "WON",
}
export enum MembershipRole {
  OWNER = "OWNER",
  ADMIN = "ADMIN",
  MANAGER = "MANAGER",
  AGENT = "AGENT",
}
export enum MembershipStatus {
  INVITED = "INVITED",
  PENDING = "PENDING",
  ACTIVE = "ACTIVE",
  SUSPENDED = "SUSPENDED",
  REVOKED = "REVOKED",
  REMOVED = "REMOVED",
}
export enum NotificationAudience {
  MEMBER = "MEMBER",
  ADMIN = "ADMIN",
}
export enum TransactionType {
  BUY = "BUY",
  RENT = "RENT",
  INVEST = "INVEST",
}

export interface AcceptInvitationData {
  membership?: Membership_Key | null;
  activity_insert: Activity_Key;
  auditLog_insert: AuditLog_Key;
}

export interface AcceptInvitationVariables {
  organizationId: UUIDString;
  membershipId: UUIDString;
  tokenHash: string;
  displayName?: string;
}

export interface Activity_Key {
  organizationId: UUIDString;
  id: UUIDString;
  __typename?: 'Activity_Key';
}

export interface AddLeadNoteData {
  lead?: Lead_Key | null;
  activity: Activity_Key;
  auditLog_insert: AuditLog_Key;
}

export interface AddLeadNoteVariables {
  organizationId: UUIDString;
  leadId: UUIDString;
  note: string;
}

export interface AgentAvailability_Key {
  organizationId: UUIDString;
  membershipId: UUIDString;
  __typename?: 'AgentAvailability_Key';
}

export interface ApproveMembershipData {
  membership?: Membership_Key | null;
  activity_insert: Activity_Key;
  auditLog_insert: AuditLog_Key;
}

export interface ApproveMembershipVariables {
  organizationId: UUIDString;
  membershipId: UUIDString;
}

export interface ArchiveLeadData {
  lead?: Lead_Key | null;
  leadFollowUp_updateMany: number;
  activity: Activity_Key;
  auditLog_insert: AuditLog_Key;
}

export interface ArchiveLeadVariables {
  organizationId: UUIDString;
  leadId: UUIDString;
}

export interface AssignLeadData {
  lead?: Lead_Key | null;
  assignment: LeadAssignmentHistory_Key;
  leadFollowUp_updateMany: number;
  activity: Activity_Key;
  auditLog_insert: AuditLog_Key;
  assignedNotification: InAppNotification_Key;
}

export interface AssignLeadVariables {
  organizationId: UUIDString;
  leadId: UUIDString;
  assignedMembershipId: UUIDString;
  expectedAssignedMembershipId?: UUIDString | null;
  expectedWasUnassigned: boolean;
  reason?: string;
  overrideClosed?: boolean;
}

export interface AuditLog_Key {
  organizationId: UUIDString;
  id: UUIDString;
  __typename?: 'AuditLog_Key';
}

export interface Branch_Key {
  organizationId: UUIDString;
  id: UUIDString;
  __typename?: 'Branch_Key';
}

export interface ChangeLeadStatusData {
  lead?: Lead_Key | null;
  activity: Activity_Key;
  auditLog_insert: AuditLog_Key;
}

export interface ChangeLeadStatusVariables {
  organizationId: UUIDString;
  leadId: UUIDString;
  status: LeadStatus;
}

export interface CompleteLeadFollowUpData {
  lead?: Lead_Key | null;
  followUp?: LeadFollowUp_Key | null;
  activity: Activity_Key;
  auditLog_insert: AuditLog_Key;
}

export interface CompleteLeadFollowUpVariables {
  organizationId: UUIDString;
  leadId: UUIDString;
  followUpId?: UUIDString | null;
}

export interface ConsumeWebsiteLeadCaptureRateWindowData {
  updated?: LeadCaptureRateWindow_Key | null;
  created: LeadCaptureRateWindow_Key;
}

export interface ConsumeWebsiteLeadCaptureRateWindowVariables {
  organizationId: UUIDString;
  formId: UUIDString;
  windowStart: TimestampString;
  requestLimit: number;
  windowExists: boolean;
  observedCount: number;
}

export interface Contact_Key {
  organizationId: UUIDString;
  id: UUIDString;
  __typename?: 'Contact_Key';
}

export interface CreateBranchData {
  branch: Branch_Key;
  activity_insert: Activity_Key;
  auditLog_insert: AuditLog_Key;
}

export interface CreateBranchVariables {
  organizationId: UUIDString;
  name: string;
}

export interface CreateContactData {
  contact: Contact_Key;
  auditLog_insert: AuditLog_Key;
}

export interface CreateContactVariables {
  organizationId: UUIDString;
  fullName: string;
  email?: string | null;
  phone?: string | null;
  normalizedPhone?: string | null;
  alternatePhone?: string | null;
  normalizedAlternatePhone?: string | null;
  nationality?: string | null;
  preferredLanguage?: string | null;
  notes?: string | null;
}

export interface CreateLeadCaptureFormData {
  source: LeadSource_Key;
  form: LeadCaptureForm_Key;
  activity: Activity_Key;
  audit: AuditLog_Key;
}

export interface CreateLeadCaptureFormVariables {
  organizationId: UUIDString;
  publicId: string;
  name: string;
  status: LeadCaptureFormStatus;
  sourceName: string;
  branchId?: UUIDString | null;
  projectId?: UUIDString | null;
  fields: unknown;
  consentText: string;
  privacyPolicyUrl: string;
  successMessage: string;
}

export interface CreateLeadData {
  advanceCursor?: DistributionCursor_Key | null;
  contact: Contact_Key;
  lead: Lead_Key;
  assignment: LeadAssignmentHistory_Key;
  activity_insert: Activity_Key;
  auditLog_insert: AuditLog_Key;
  assignedNotification: InAppNotification_Key;
  unassignedNotification: InAppNotification_Key;
  initialNoteActivity: Activity_Key;
  initialNoteAudit: AuditLog_Key;
  initialFollowUp: LeadFollowUp_Key;
  initialFollowUpActivity: Activity_Key;
  initialFollowUpAudit: AuditLog_Key;
}

export interface CreateLeadForContactData {
  advanceCursor?: DistributionCursor_Key | null;
  lead: Lead_Key;
  assignment: LeadAssignmentHistory_Key;
  activity_insert: Activity_Key;
  auditLog_insert: AuditLog_Key;
  assignedNotification: InAppNotification_Key;
  unassignedNotification: InAppNotification_Key;
  initialNoteActivity: Activity_Key;
  initialNoteAudit: AuditLog_Key;
  initialFollowUp: LeadFollowUp_Key;
  initialFollowUpActivity: Activity_Key;
  initialFollowUpAudit: AuditLog_Key;
}

export interface CreateLeadForContactVariables {
  organizationId: UUIDString;
  leadId?: UUIDString | null;
  contactId: UUIDString;
  source?: string | null;
  sourceId?: UUIDString | null;
  pipelineId?: UUIDString | null;
  branchId?: UUIDString | null;
  projectId?: UUIDString | null;
  assignedMembershipId?: UUIDString | null;
  hasAssignedMember?: boolean;
  distributionRuleId?: UUIDString | null;
  expectedCursorVersion?: number | null;
  hasAutoAssignment?: boolean;
  hasDistributionAttempt?: boolean;
  propertyInterest?: string | null;
  preferredLocation?: string | null;
  propertyType?: string | null;
  transactionType?: TransactionType | null;
  budgetMin?: number | null;
  budgetMax?: number | null;
  currency?: string | null;
  bedroomPreference?: string | null;
  priority?: LeadPriority | null;
  initialNote?: string | null;
  initialFollowUpAt?: TimestampString | null;
  initialFollowUpNote?: string | null;
  hasInitialNote?: boolean;
  hasInitialFollowUp?: boolean;
}

export interface CreateLeadVariables {
  organizationId: UUIDString;
  leadId?: UUIDString | null;
  fullName: string;
  email?: string | null;
  phone?: string | null;
  normalizedPhone?: string | null;
  alternatePhone?: string | null;
  normalizedAlternatePhone?: string | null;
  nationality?: string | null;
  preferredLanguage?: string | null;
  notes?: string | null;
  source?: string | null;
  sourceId?: UUIDString | null;
  pipelineId?: UUIDString | null;
  branchId?: UUIDString | null;
  projectId?: UUIDString | null;
  assignedMembershipId?: UUIDString | null;
  hasAssignedMember?: boolean;
  distributionRuleId?: UUIDString | null;
  expectedCursorVersion?: number | null;
  hasAutoAssignment?: boolean;
  hasDistributionAttempt?: boolean;
  propertyInterest?: string | null;
  preferredLocation?: string | null;
  propertyType?: string | null;
  transactionType?: TransactionType | null;
  budgetMin?: number | null;
  budgetMax?: number | null;
  currency?: string | null;
  bedroomPreference?: string | null;
  priority?: LeadPriority | null;
  initialNote?: string | null;
  initialFollowUpAt?: TimestampString | null;
  initialFollowUpNote?: string | null;
  hasInitialNote?: boolean;
  hasInitialFollowUp?: boolean;
}

export interface CreateOrganizationData {
  organization: Organization_Key;
  defaultPipeline: Pipeline_Key;
  pipelineStage_insertMany: PipelineStage_Key[];
  defaultSource: LeadSource_Key;
  ownerMembership: Membership_Key;
  userProfile_update?: UserProfile_Key | null;
  activity_insert: Activity_Key;
  auditLog_insert: AuditLog_Key;
}

export interface CreateOrganizationVariables {
  name: string;
  slug: string;
  emirate?: Emirate | null;
  contactPhone?: string | null;
  companyEmail?: string | null;
  companySize?: CompanySize | null;
}

export interface DistributionCursor_Key {
  organizationId: UUIDString;
  ruleId: UUIDString;
  __typename?: 'DistributionCursor_Key';
}

export interface FindDuplicateContactsData {
  contacts: ({
    id: UUIDString;
    fullName: string;
    email?: string | null;
    phone?: string | null;
    alternatePhone?: string | null;
  })[];
}

export interface FindDuplicateContactsVariables {
  organizationId: UUIDString;
  email?: string | null;
  phone?: string | null;
  alternatePhone?: string | null;
}

export interface FindWebsiteLeadCaptureContactData {
  contacts: ({
    id: UUIDString;
    normalizedEmail?: string | null;
    normalizedPhone?: string | null;
  })[];
}

export interface FindWebsiteLeadCaptureContactVariables {
  organizationId: UUIDString;
  normalizedEmail?: string | null;
  normalizedPhone?: string | null;
}

export interface FindWebsiteLeadCaptureSubmissionData {
  submission?: {
    id: UUIDString;
    leadId: UUIDString;
    sourceId: UUIDString;
    landingPageUrl?: string | null;
    utmSource?: string | null;
    utmMedium?: string | null;
    utmCampaign?: string | null;
    utmContent?: string | null;
    utmTerm?: string | null;
    consentGiven: boolean;
    consentTextSnapshot: string;
    privacyPolicyUrlSnapshot: string;
    consentAt: TimestampString;
    submittedAt: TimestampString;
  };
}

export interface FindWebsiteLeadCaptureSubmissionVariables {
  organizationId: UUIDString;
  formId: UUIDString;
  idempotencyKeyHash: string;
}

export interface GetContactData {
  contact?: {
    id: UUIDString;
    organizationId: UUIDString;
    fullName: string;
    email?: string | null;
    normalizedEmail?: string | null;
    phone?: string | null;
    normalizedPhone?: string | null;
    alternatePhone?: string | null;
    normalizedAlternatePhone?: string | null;
    nationality?: string | null;
    preferredLanguage: string;
    notes?: string | null;
    createdByUid: string;
    createdAt: TimestampString;
    updatedAt: TimestampString;
  } & Contact_Key;
}

export interface GetContactVariables {
  organizationId: UUIDString;
  contactId: UUIDString;
}

export interface GetLeadAnalyticsData {
  summary?: unknown | null;
  sources?: unknown[] | null;
  stages?: unknown[] | null;
  agents?: unknown[] | null;
  volume?: unknown[] | null;
}

export interface GetLeadAnalyticsVariables {
  organizationId: UUIDString;
  from: TimestampString;
  to: TimestampString;
  timeZone: string;
  bucket: string;
  sourceId?: UUIDString | null;
  pipelineStageId?: UUIDString | null;
  assignedMembershipId?: UUIDString | null;
}

export interface GetLeadCaptureFormData {
  form?: {
    id: UUIDString;
    organizationId: UUIDString;
    publicId: string;
    name: string;
    status: LeadCaptureFormStatus;
    sourceId: UUIDString;
    source: {
      name: string;
      sourceType: LeadSourceType;
    };
    branchId?: UUIDString | null;
    branch?: {
      name: string;
    };
    projectId?: UUIDString | null;
    fields: unknown;
    consentText: string;
    privacyPolicyUrl: string;
    successMessage: string;
    createdByUid: string;
    updatedAt: TimestampString;
  } & LeadCaptureForm_Key;
}

export interface GetLeadCaptureFormVariables {
  organizationId: UUIDString;
  formId: UUIDString;
}

export interface GetLeadConfigurationData {
  pipelines: ({
    id: UUIDString;
    name: string;
    isDefault: boolean;
    isActive: boolean;
    pipelineStages_on_pipeline: ({
      id: UUIDString;
      name: string;
      position: number;
      stageType: PipelineStageType;
      status: LeadStatus;
    })[];
  })[];
  leadSources: ({
    id: UUIDString;
    name: string;
    sourceType: LeadSourceType;
  })[];
}

export interface GetLeadConfigurationVariables {
  organizationId: UUIDString;
}

export interface GetLeadCrmHistoryData {
  activities: ({
    id: UUIDString;
    actorUid: string;
    kind: ActivityKind;
    note?: string | null;
    metadata?: unknown | null;
    createdAt: TimestampString;
    pipelineId?: UUIDString | null;
    previousStageId?: UUIDString | null;
    newStageId?: UUIDString | null;
  })[];
  activityTotal: ({
    count: number;
  })[];
  assignments: ({
    id: UUIDString;
    previousAgentId?: UUIDString | null;
    newAgentId?: UUIDString | null;
    assignedByUid: string;
    assignmentType: LeadAssignmentType;
    reason?: string | null;
    assignedAt: TimestampString;
  })[];
  stages: ({
    id: UUIDString;
    actorUid: string;
    kind: ActivityKind;
    pipelineId?: UUIDString | null;
    previousStageId?: UUIDString | null;
    newStageId?: UUIDString | null;
    createdAt: TimestampString;
  })[];
  followUps: ({
    id: UUIDString;
    assignedUserId: UUIDString;
    title: string;
    dueAt: TimestampString;
    status: LeadFollowUpStatus;
    completedAt?: TimestampString | null;
    createdAt: TimestampString;
  })[];
}

export interface GetLeadCrmHistoryVariables {
  organizationId: UUIDString;
  leadId: UUIDString;
  limit?: number;
  offset?: number;
}

export interface GetLeadData {
  lead?: {
    id: UUIDString;
    organizationId: UUIDString;
    fullName: string;
    email?: string | null;
    phone?: string | null;
    source?: string | null;
    status: LeadStatus;
    branchId?: UUIDString | null;
    assignedMembershipId?: UUIDString | null;
    followUpAt?: TimestampString | null;
    followUpNote?: string | null;
    createdByUid: string;
    updatedByUid: string;
    createdAt: TimestampString;
    updatedAt: TimestampString;
    contactId?: UUIDString | null;
    leadNumber?: UUIDString | null;
    sourceId?: UUIDString | null;
    pipelineId?: UUIDString | null;
    pipelineStageId?: UUIDString | null;
    propertyInterest?: string | null;
    preferredLocation?: string | null;
    propertyType?: string | null;
    transactionType: TransactionType;
    budgetMin?: number | null;
    budgetMax?: number | null;
    currency: string;
    bedroomPreference?: string | null;
    priority: LeadPriority;
    archivedAt?: TimestampString | null;
    contact?: {
      id: UUIDString;
      organizationId: UUIDString;
      fullName: string;
      email?: string | null;
      normalizedEmail?: string | null;
      phone?: string | null;
      normalizedPhone?: string | null;
      alternatePhone?: string | null;
      normalizedAlternatePhone?: string | null;
      nationality?: string | null;
      preferredLanguage: string;
      notes?: string | null;
      createdByUid: string;
      createdAt: TimestampString;
      updatedAt: TimestampString;
    } & Contact_Key;
    pipelineStage?: {
      id: UUIDString;
      name: string;
      position: number;
      stageType: PipelineStageType;
      status: LeadStatus;
    };
    leadSource?: {
      id: UUIDString;
      name: string;
      sourceType: LeadSourceType;
    };
    branch?: {
      id: UUIDString;
      name: string;
    };
    assignedMembership?: {
      id: UUIDString;
      email: string;
      role: MembershipRole;
      userProfile?: {
        uid: string;
        displayName: string;
      } & UserProfile_Key;
    };
  } & Lead_Key;
}

export interface GetLeadDistributionPlanData {
  rule?: {
    id: UUIDString;
    enabled: boolean;
    mode: LeadDistributionMode;
    branchId?: UUIDString | null;
    projectId?: UUIDString | null;
    skipUnavailable: boolean;
    businessHoursEnabled: boolean;
    timeZone: string;
    businessDaysMask: number;
    businessStart: string;
    businessEnd: string;
    reassignmentTimeoutMinutes: number;
    updatedAt: TimestampString;
    cursor?: {
      version: number;
      lastMembershipId?: UUIDString | null;
      lastAssignedAt?: TimestampString | null;
    };
  };
  eligibleAgents: ({
    id: UUIDString;
    email: string;
    role: MembershipRole;
    status: MembershipStatus;
    userProfileUid?: string | null;
    userProfile?: {
      displayName: string;
    };
    agentAvailability_on_membership?: {
      status: AgentAvailabilityStatus;
      unavailableUntil?: TimestampString | null;
    };
  })[];
  agents: ({
    id: UUIDString;
    email: string;
    role: MembershipRole;
    distributionEligible: boolean;
    userProfile?: {
      displayName: string;
    };
    agentAvailability_on_membership?: {
      status: AgentAvailabilityStatus;
      unavailableUntil?: TimestampString | null;
    };
  })[];
  history: ({
    id: UUIDString;
    leadId: UUIDString;
    previousAgentId?: UUIDString | null;
    newAgentId?: UUIDString | null;
    assignedByUid: string;
    assignmentType: LeadAssignmentType;
    reason?: string | null;
    assignedAt: TimestampString;
    lead: {
      fullName: string;
      leadNumber?: UUIDString | null;
      status: LeadStatus;
    };
    previousAgent?: {
      email: string;
      userProfile?: {
        displayName: string;
      };
    };
    newAgent?: {
      email: string;
      userProfile?: {
        displayName: string;
      };
    };
  })[];
}

export interface GetLeadDistributionPlanVariables {
  organizationId: UUIDString;
}

export interface GetLeadMetricsData {
  total: ({
    count: number;
  })[];
  newLeads: ({
    count: number;
  })[];
  qualified: ({
    count: number;
  })[];
  won: ({
    count: number;
  })[];
}

export interface GetLeadMetricsVariables {
  organizationId: UUIDString;
}

export interface GetLeadVariables {
  organizationId: UUIDString;
  leadId: UUIDString;
}

export interface GetMyAgentAvailabilityData {
  actor?: {
    id: UUIDString;
    role: MembershipRole;
    agentAvailability_on_membership?: {
      membershipId: UUIDString;
      status: AgentAvailabilityStatus;
      unavailableUntil?: TimestampString | null;
      reason?: string | null;
      updatedAt: TimestampString;
    };
  };
}

export interface GetMyAgentAvailabilityVariables {
  organizationId: UUIDString;
}

export interface GetMyPendingInvitationsData {
  invitations: ({
    id: UUIDString;
    role: MembershipRole;
    expiresAt: TimestampString;
    organization: {
      name: string;
    };
  })[];
}

export interface GetMyProfileData {
  userProfile?: {
    uid: string;
    email: string;
    displayName: string;
    activeOrganizationId?: UUIDString | null;
    createdAt: TimestampString;
    updatedAt: TimestampString;
  } & UserProfile_Key;
}

export interface GetOrganizationContextData {
  ownMembership?: {
    id: UUIDString;
    organizationId: UUIDString;
    userProfileUid?: string | null;
    email: string;
    role: MembershipRole;
    status: MembershipStatus;
  } & Membership_Key;
  organization?: {
    id: UUIDString;
    name: string;
    slug: string;
    emirate?: Emirate | null;
    contactPhone?: string | null;
    companyEmail?: string | null;
    companySize?: CompanySize | null;
    createdByUid: string;
    createdAt: TimestampString;
    updatedAt: TimestampString;
  } & Organization_Key;
}

export interface GetOrganizationContextVariables {
  organizationId: UUIDString;
}

export interface GetTeamMembershipByEmailData {
  membership?: {
    status: MembershipStatus;
    invitation_on_membership?: {
      status: InvitationStatus;
    };
  };
}

export interface GetTeamMembershipByEmailVariables {
  organizationId: UUIDString;
  email: string;
}

export interface GetWebsiteLeadCaptureRateWindowData {
  window?: {
    id: UUIDString;
    requestCount: number;
  };
}

export interface GetWebsiteLeadCaptureRateWindowVariables {
  organizationId: UUIDString;
  formId: UUIDString;
  windowStart: TimestampString;
}

export interface GetWebsiteLeadDistributionPlanData {
  rule?: {
    id: UUIDString;
    organizationId: UUIDString;
    enabled: boolean;
    mode: LeadDistributionMode;
    branchId?: UUIDString | null;
    projectId?: UUIDString | null;
    skipUnavailable: boolean;
    businessHoursEnabled: boolean;
    timeZone: string;
    businessDaysMask: number;
    businessStart: string;
    businessEnd: string;
    cursor?: {
      version: number;
      lastMembershipId?: UUIDString | null;
      lastAssignedAt?: TimestampString | null;
    };
  } & LeadDistributionRule_Key;
  eligibleAgents: ({
    id: UUIDString;
    role: MembershipRole;
    status: MembershipStatus;
    userProfileUid?: string | null;
    agentAvailability_on_membership?: {
      status: AgentAvailabilityStatus;
      unavailableUntil?: TimestampString | null;
    };
  })[];
}

export interface GetWebsiteLeadDistributionPlanVariables {
  organizationId: UUIDString;
}

export interface InAppNotification_Key {
  organizationId: UUIDString;
  id: UUIDString;
  __typename?: 'InAppNotification_Key';
}

export interface InitializeLeadPipelineData {
  defaultPipeline: Pipeline_Key;
  pipelineStage_insertMany: PipelineStage_Key[];
  defaultSource: LeadSource_Key;
  auditLog_insert: AuditLog_Key;
}

export interface InitializeLeadPipelineVariables {
  organizationId: UUIDString;
}

export interface Invitation_Key {
  organizationId: UUIDString;
  id: UUIDString;
  __typename?: 'Invitation_Key';
}

export interface InviteMembershipData {
  membership: Membership_Key;
  invitation: Invitation_Key;
  activity_insert: Activity_Key;
  auditLog_insert: AuditLog_Key;
}

export interface InviteMembershipVariables {
  organizationId: UUIDString;
  email: string;
  role: MembershipRole;
  tokenHash: string;
  expiresAt: TimestampString;
}

export interface LeadAssignmentHistory_Key {
  organizationId: UUIDString;
  id: UUIDString;
  __typename?: 'LeadAssignmentHistory_Key';
}

export interface LeadCaptureForm_Key {
  organizationId: UUIDString;
  id: UUIDString;
  __typename?: 'LeadCaptureForm_Key';
}

export interface LeadCaptureRateWindow_Key {
  organizationId: UUIDString;
  id: UUIDString;
  __typename?: 'LeadCaptureRateWindow_Key';
}

export interface LeadCaptureSubmission_Key {
  organizationId: UUIDString;
  id: UUIDString;
  __typename?: 'LeadCaptureSubmission_Key';
}

export interface LeadDistributionRule_Key {
  organizationId: UUIDString;
  id: UUIDString;
  __typename?: 'LeadDistributionRule_Key';
}

export interface LeadFollowUp_Key {
  organizationId: UUIDString;
  id: UUIDString;
  __typename?: 'LeadFollowUp_Key';
}

export interface LeadSource_Key {
  organizationId: UUIDString;
  id: UUIDString;
  __typename?: 'LeadSource_Key';
}

export interface Lead_Key {
  organizationId: UUIDString;
  id: UUIDString;
  __typename?: 'Lead_Key';
}

export interface ListActivitiesData {
  activities: ({
    id: UUIDString;
    organizationId: UUIDString;
    actorUid: string;
    kind: ActivityKind;
    leadId?: UUIDString | null;
    targetId?: UUIDString | null;
    metadata?: unknown | null;
    createdAt: TimestampString;
  } & Activity_Key)[];
}

export interface ListActivitiesVariables {
  organizationId: UUIDString;
  limit?: number;
  offset?: number;
}

export interface ListAuditLogsData {
  auditLogs: ({
    id: UUIDString;
    organizationId: UUIDString;
    actorUid: string;
    action: ActivityKind;
    targetType: AuditTargetType;
    targetId: UUIDString;
    metadata?: unknown | null;
    createdAt: TimestampString;
  } & AuditLog_Key)[];
}

export interface ListAuditLogsVariables {
  organizationId: UUIDString;
  limit?: number;
  offset?: number;
}

export interface ListBranchesData {
  branches: ({
    id: UUIDString;
    organizationId: UUIDString;
    name: string;
    createdByUid: string;
    createdAt: TimestampString;
    updatedAt: TimestampString;
  } & Branch_Key)[];
}

export interface ListBranchesVariables {
  organizationId: UUIDString;
}

export interface ListInAppNotificationsData {
  notifications: ({
    id: UUIDString;
    audience: NotificationAudience;
    recipientMembershipId?: UUIDString | null;
    type: InAppNotificationType;
    title: string;
    body: string;
    readAt?: TimestampString | null;
    createdAt: TimestampString;
    lead?: {
      id: UUIDString;
      fullName: string;
      leadNumber?: UUIDString | null;
    };
  })[];
  total: ({
    count: number;
  })[];
}

export interface ListInAppNotificationsVariables {
  organizationId: UUIDString;
  limit?: number;
  offset?: number;
}

export interface ListInvitationsData {
  invitations: ({
    id: UUIDString;
    organizationId: UUIDString;
    membershipId: UUIDString;
    email: string;
    role: MembershipRole;
    status: InvitationStatus;
    invitedByUid: string;
    expiresAt: TimestampString;
    acceptedAt?: TimestampString | null;
    acceptedByUid?: string | null;
    revokedAt?: TimestampString | null;
    createdAt: TimestampString;
    updatedAt: TimestampString;
    deliveryStatus: InvitationDeliveryStatus;
    deliveryUpdatedAt?: TimestampString | null;
    membership: {
      status: MembershipStatus;
      userProfileUid?: string | null;
      acceptedAt?: TimestampString | null;
      approvedAt?: TimestampString | null;
      role: MembershipRole;
    };
  } & Invitation_Key)[];
  total: ({
    count: number;
  })[];
}

export interface ListInvitationsVariables {
  organizationId: UUIDString;
  limit?: number;
  offset?: number;
  search?: string | null;
  status?: InvitationStatus | null;
}

export interface ListLeadActivitiesData {
  activities: ({
    id: UUIDString;
    actorUid: string;
    actor: {
      uid: string;
      displayName: string;
    } & UserProfile_Key;
    kind: ActivityKind;
    leadId?: UUIDString | null;
    targetId?: UUIDString | null;
    metadata?: unknown | null;
    note?: string | null;
    createdAt: TimestampString;
  })[];
  total: ({
    count: number;
  })[];
}

export interface ListLeadActivitiesVariables {
  organizationId: UUIDString;
  leadId: UUIDString;
  limit?: number;
  offset?: number;
}

export interface ListLeadAssigneesData {
  memberships: ({
    id: UUIDString;
    email: string;
    role: MembershipRole;
    userProfile?: {
      uid: string;
      displayName: string;
    } & UserProfile_Key;
  })[];
}

export interface ListLeadAssigneesVariables {
  organizationId: UUIDString;
  limit?: number;
  offset?: number;
}

export interface ListLeadCaptureFormsData {
  forms: ({
    id: UUIDString;
    organizationId: UUIDString;
    publicId: string;
    name: string;
    status: LeadCaptureFormStatus;
    sourceId: UUIDString;
    source: {
      name: string;
      sourceType: LeadSourceType;
    };
    branchId?: UUIDString | null;
    branch?: {
      name: string;
    };
    projectId?: UUIDString | null;
    fields: unknown;
    consentText: string;
    privacyPolicyUrl: string;
    successMessage: string;
    createdAt: TimestampString;
    updatedAt: TimestampString;
  } & LeadCaptureForm_Key)[];
  total: ({
    count: number;
  })[];
  leadSources: ({
    id: UUIDString;
    name: string;
    sourceType: LeadSourceType;
  })[];
  branches: ({
    id: UUIDString;
    name: string;
  })[];
}

export interface ListLeadCaptureFormsVariables {
  organizationId: UUIDString;
  limit?: number;
  offset?: number;
}

export interface ListLeadFollowUpsData {
  followUps: ({
    id: UUIDString;
    title: string;
    dueAt: TimestampString;
    status: LeadFollowUpStatus;
    completedAt?: TimestampString | null;
    assignedUserId: UUIDString;
    assignedUser: {
      id: UUIDString;
      email: string;
      userProfile?: {
        displayName: string;
      };
    };
    createdAt: TimestampString;
  })[];
  total: ({
    count: number;
  })[];
}

export interface ListLeadFollowUpsVariables {
  organizationId: UUIDString;
  leadId: UUIDString;
  limit?: number;
  offset?: number;
}

export interface ListLeadsCreatedAscData {
  leads: ({
    id: UUIDString;
    organizationId: UUIDString;
    fullName: string;
    email?: string | null;
    phone?: string | null;
    source?: string | null;
    status: LeadStatus;
    branchId?: UUIDString | null;
    assignedMembershipId?: UUIDString | null;
    followUpAt?: TimestampString | null;
    followUpNote?: string | null;
    createdByUid: string;
    updatedByUid: string;
    createdAt: TimestampString;
    updatedAt: TimestampString;
    contactId?: UUIDString | null;
    leadNumber?: UUIDString | null;
    sourceId?: UUIDString | null;
    pipelineId?: UUIDString | null;
    pipelineStageId?: UUIDString | null;
    propertyInterest?: string | null;
    preferredLocation?: string | null;
    propertyType?: string | null;
    transactionType: TransactionType;
    budgetMin?: number | null;
    budgetMax?: number | null;
    currency: string;
    bedroomPreference?: string | null;
    priority: LeadPriority;
    archivedAt?: TimestampString | null;
    contact?: {
      id: UUIDString;
      organizationId: UUIDString;
      fullName: string;
      email?: string | null;
      normalizedEmail?: string | null;
      phone?: string | null;
      normalizedPhone?: string | null;
      alternatePhone?: string | null;
      normalizedAlternatePhone?: string | null;
      nationality?: string | null;
      preferredLanguage: string;
      notes?: string | null;
      createdByUid: string;
      createdAt: TimestampString;
      updatedAt: TimestampString;
    } & Contact_Key;
    pipelineStage?: {
      id: UUIDString;
      name: string;
      position: number;
      stageType: PipelineStageType;
      status: LeadStatus;
    };
    leadSource?: {
      id: UUIDString;
      name: string;
      sourceType: LeadSourceType;
    };
    branch?: {
      id: UUIDString;
      name: string;
    };
    assignedMembership?: {
      id: UUIDString;
      email: string;
      role: MembershipRole;
      userProfile?: {
        uid: string;
        displayName: string;
      } & UserProfile_Key;
    };
  } & Lead_Key)[];
  total: ({
    count: number;
  })[];
}

export interface ListLeadsCreatedAscVariables {
  organizationId: UUIDString;
  pipelineId?: UUIDString | null;
  pipelineStageId?: UUIDString | null;
  sourceId?: UUIDString | null;
  contactId?: UUIDString | null;
  priority?: LeadPriority | null;
  transactionType?: TransactionType | null;
  activeOnly?: boolean | null;
  limit?: number;
  offset?: number;
  search?: string | null;
  status?: LeadStatus | null;
  assignedMembershipId?: UUIDString | null;
  branchId?: UUIDString | null;
  followUpBefore?: TimestampString | null;
  followUpAfter?: TimestampString | null;
  createdFrom?: TimestampString | null;
  createdBefore?: TimestampString | null;
}

export interface ListLeadsData {
  leads: ({
    id: UUIDString;
    organizationId: UUIDString;
    fullName: string;
    email?: string | null;
    phone?: string | null;
    source?: string | null;
    status: LeadStatus;
    branchId?: UUIDString | null;
    assignedMembershipId?: UUIDString | null;
    followUpAt?: TimestampString | null;
    followUpNote?: string | null;
    createdByUid: string;
    updatedByUid: string;
    createdAt: TimestampString;
    updatedAt: TimestampString;
    contactId?: UUIDString | null;
    leadNumber?: UUIDString | null;
    sourceId?: UUIDString | null;
    pipelineId?: UUIDString | null;
    pipelineStageId?: UUIDString | null;
    propertyInterest?: string | null;
    preferredLocation?: string | null;
    propertyType?: string | null;
    transactionType: TransactionType;
    budgetMin?: number | null;
    budgetMax?: number | null;
    currency: string;
    bedroomPreference?: string | null;
    priority: LeadPriority;
    archivedAt?: TimestampString | null;
    contact?: {
      id: UUIDString;
      organizationId: UUIDString;
      fullName: string;
      email?: string | null;
      normalizedEmail?: string | null;
      phone?: string | null;
      normalizedPhone?: string | null;
      alternatePhone?: string | null;
      normalizedAlternatePhone?: string | null;
      nationality?: string | null;
      preferredLanguage: string;
      notes?: string | null;
      createdByUid: string;
      createdAt: TimestampString;
      updatedAt: TimestampString;
    } & Contact_Key;
    pipelineStage?: {
      id: UUIDString;
      name: string;
      position: number;
      stageType: PipelineStageType;
      status: LeadStatus;
    };
    leadSource?: {
      id: UUIDString;
      name: string;
      sourceType: LeadSourceType;
    };
    branch?: {
      id: UUIDString;
      name: string;
    };
    assignedMembership?: {
      id: UUIDString;
      email: string;
      role: MembershipRole;
      userProfile?: {
        uid: string;
        displayName: string;
      } & UserProfile_Key;
    };
  } & Lead_Key)[];
  total: ({
    count: number;
  })[];
}

export interface ListLeadsFollowUpAscData {
  leads: ({
    id: UUIDString;
    organizationId: UUIDString;
    fullName: string;
    email?: string | null;
    phone?: string | null;
    source?: string | null;
    status: LeadStatus;
    branchId?: UUIDString | null;
    assignedMembershipId?: UUIDString | null;
    followUpAt?: TimestampString | null;
    followUpNote?: string | null;
    createdByUid: string;
    updatedByUid: string;
    createdAt: TimestampString;
    updatedAt: TimestampString;
    contactId?: UUIDString | null;
    leadNumber?: UUIDString | null;
    sourceId?: UUIDString | null;
    pipelineId?: UUIDString | null;
    pipelineStageId?: UUIDString | null;
    propertyInterest?: string | null;
    preferredLocation?: string | null;
    propertyType?: string | null;
    transactionType: TransactionType;
    budgetMin?: number | null;
    budgetMax?: number | null;
    currency: string;
    bedroomPreference?: string | null;
    priority: LeadPriority;
    archivedAt?: TimestampString | null;
    contact?: {
      id: UUIDString;
      organizationId: UUIDString;
      fullName: string;
      email?: string | null;
      normalizedEmail?: string | null;
      phone?: string | null;
      normalizedPhone?: string | null;
      alternatePhone?: string | null;
      normalizedAlternatePhone?: string | null;
      nationality?: string | null;
      preferredLanguage: string;
      notes?: string | null;
      createdByUid: string;
      createdAt: TimestampString;
      updatedAt: TimestampString;
    } & Contact_Key;
    pipelineStage?: {
      id: UUIDString;
      name: string;
      position: number;
      stageType: PipelineStageType;
      status: LeadStatus;
    };
    leadSource?: {
      id: UUIDString;
      name: string;
      sourceType: LeadSourceType;
    };
    branch?: {
      id: UUIDString;
      name: string;
    };
    assignedMembership?: {
      id: UUIDString;
      email: string;
      role: MembershipRole;
      userProfile?: {
        uid: string;
        displayName: string;
      } & UserProfile_Key;
    };
  } & Lead_Key)[];
  total: ({
    count: number;
  })[];
}

export interface ListLeadsFollowUpAscVariables {
  organizationId: UUIDString;
  pipelineId?: UUIDString | null;
  pipelineStageId?: UUIDString | null;
  sourceId?: UUIDString | null;
  contactId?: UUIDString | null;
  priority?: LeadPriority | null;
  transactionType?: TransactionType | null;
  activeOnly?: boolean | null;
  limit?: number;
  offset?: number;
  search?: string | null;
  status?: LeadStatus | null;
  assignedMembershipId?: UUIDString | null;
  branchId?: UUIDString | null;
  followUpBefore?: TimestampString | null;
  followUpAfter?: TimestampString | null;
  createdFrom?: TimestampString | null;
  createdBefore?: TimestampString | null;
}

export interface ListLeadsNameAscData {
  leads: ({
    id: UUIDString;
    organizationId: UUIDString;
    fullName: string;
    email?: string | null;
    phone?: string | null;
    source?: string | null;
    status: LeadStatus;
    branchId?: UUIDString | null;
    assignedMembershipId?: UUIDString | null;
    followUpAt?: TimestampString | null;
    followUpNote?: string | null;
    createdByUid: string;
    updatedByUid: string;
    createdAt: TimestampString;
    updatedAt: TimestampString;
    contactId?: UUIDString | null;
    leadNumber?: UUIDString | null;
    sourceId?: UUIDString | null;
    pipelineId?: UUIDString | null;
    pipelineStageId?: UUIDString | null;
    propertyInterest?: string | null;
    preferredLocation?: string | null;
    propertyType?: string | null;
    transactionType: TransactionType;
    budgetMin?: number | null;
    budgetMax?: number | null;
    currency: string;
    bedroomPreference?: string | null;
    priority: LeadPriority;
    archivedAt?: TimestampString | null;
    contact?: {
      id: UUIDString;
      organizationId: UUIDString;
      fullName: string;
      email?: string | null;
      normalizedEmail?: string | null;
      phone?: string | null;
      normalizedPhone?: string | null;
      alternatePhone?: string | null;
      normalizedAlternatePhone?: string | null;
      nationality?: string | null;
      preferredLanguage: string;
      notes?: string | null;
      createdByUid: string;
      createdAt: TimestampString;
      updatedAt: TimestampString;
    } & Contact_Key;
    pipelineStage?: {
      id: UUIDString;
      name: string;
      position: number;
      stageType: PipelineStageType;
      status: LeadStatus;
    };
    leadSource?: {
      id: UUIDString;
      name: string;
      sourceType: LeadSourceType;
    };
    branch?: {
      id: UUIDString;
      name: string;
    };
    assignedMembership?: {
      id: UUIDString;
      email: string;
      role: MembershipRole;
      userProfile?: {
        uid: string;
        displayName: string;
      } & UserProfile_Key;
    };
  } & Lead_Key)[];
  total: ({
    count: number;
  })[];
}

export interface ListLeadsNameAscVariables {
  organizationId: UUIDString;
  pipelineId?: UUIDString | null;
  pipelineStageId?: UUIDString | null;
  sourceId?: UUIDString | null;
  contactId?: UUIDString | null;
  priority?: LeadPriority | null;
  transactionType?: TransactionType | null;
  activeOnly?: boolean | null;
  limit?: number;
  offset?: number;
  search?: string | null;
  status?: LeadStatus | null;
  assignedMembershipId?: UUIDString | null;
  branchId?: UUIDString | null;
  followUpBefore?: TimestampString | null;
  followUpAfter?: TimestampString | null;
  createdFrom?: TimestampString | null;
  createdBefore?: TimestampString | null;
}

export interface ListLeadsNameDescData {
  leads: ({
    id: UUIDString;
    organizationId: UUIDString;
    fullName: string;
    email?: string | null;
    phone?: string | null;
    source?: string | null;
    status: LeadStatus;
    branchId?: UUIDString | null;
    assignedMembershipId?: UUIDString | null;
    followUpAt?: TimestampString | null;
    followUpNote?: string | null;
    createdByUid: string;
    updatedByUid: string;
    createdAt: TimestampString;
    updatedAt: TimestampString;
    contactId?: UUIDString | null;
    leadNumber?: UUIDString | null;
    sourceId?: UUIDString | null;
    pipelineId?: UUIDString | null;
    pipelineStageId?: UUIDString | null;
    propertyInterest?: string | null;
    preferredLocation?: string | null;
    propertyType?: string | null;
    transactionType: TransactionType;
    budgetMin?: number | null;
    budgetMax?: number | null;
    currency: string;
    bedroomPreference?: string | null;
    priority: LeadPriority;
    archivedAt?: TimestampString | null;
    contact?: {
      id: UUIDString;
      organizationId: UUIDString;
      fullName: string;
      email?: string | null;
      normalizedEmail?: string | null;
      phone?: string | null;
      normalizedPhone?: string | null;
      alternatePhone?: string | null;
      normalizedAlternatePhone?: string | null;
      nationality?: string | null;
      preferredLanguage: string;
      notes?: string | null;
      createdByUid: string;
      createdAt: TimestampString;
      updatedAt: TimestampString;
    } & Contact_Key;
    pipelineStage?: {
      id: UUIDString;
      name: string;
      position: number;
      stageType: PipelineStageType;
      status: LeadStatus;
    };
    leadSource?: {
      id: UUIDString;
      name: string;
      sourceType: LeadSourceType;
    };
    branch?: {
      id: UUIDString;
      name: string;
    };
    assignedMembership?: {
      id: UUIDString;
      email: string;
      role: MembershipRole;
      userProfile?: {
        uid: string;
        displayName: string;
      } & UserProfile_Key;
    };
  } & Lead_Key)[];
  total: ({
    count: number;
  })[];
}

export interface ListLeadsNameDescVariables {
  organizationId: UUIDString;
  pipelineId?: UUIDString | null;
  pipelineStageId?: UUIDString | null;
  sourceId?: UUIDString | null;
  contactId?: UUIDString | null;
  priority?: LeadPriority | null;
  transactionType?: TransactionType | null;
  activeOnly?: boolean | null;
  limit?: number;
  offset?: number;
  search?: string | null;
  status?: LeadStatus | null;
  assignedMembershipId?: UUIDString | null;
  branchId?: UUIDString | null;
  followUpBefore?: TimestampString | null;
  followUpAfter?: TimestampString | null;
  createdFrom?: TimestampString | null;
  createdBefore?: TimestampString | null;
}

export interface ListLeadsUpdatedDescData {
  leads: ({
    id: UUIDString;
    organizationId: UUIDString;
    fullName: string;
    email?: string | null;
    phone?: string | null;
    source?: string | null;
    status: LeadStatus;
    branchId?: UUIDString | null;
    assignedMembershipId?: UUIDString | null;
    followUpAt?: TimestampString | null;
    followUpNote?: string | null;
    createdByUid: string;
    updatedByUid: string;
    createdAt: TimestampString;
    updatedAt: TimestampString;
    contactId?: UUIDString | null;
    leadNumber?: UUIDString | null;
    sourceId?: UUIDString | null;
    pipelineId?: UUIDString | null;
    pipelineStageId?: UUIDString | null;
    propertyInterest?: string | null;
    preferredLocation?: string | null;
    propertyType?: string | null;
    transactionType: TransactionType;
    budgetMin?: number | null;
    budgetMax?: number | null;
    currency: string;
    bedroomPreference?: string | null;
    priority: LeadPriority;
    archivedAt?: TimestampString | null;
    contact?: {
      id: UUIDString;
      organizationId: UUIDString;
      fullName: string;
      email?: string | null;
      normalizedEmail?: string | null;
      phone?: string | null;
      normalizedPhone?: string | null;
      alternatePhone?: string | null;
      normalizedAlternatePhone?: string | null;
      nationality?: string | null;
      preferredLanguage: string;
      notes?: string | null;
      createdByUid: string;
      createdAt: TimestampString;
      updatedAt: TimestampString;
    } & Contact_Key;
    pipelineStage?: {
      id: UUIDString;
      name: string;
      position: number;
      stageType: PipelineStageType;
      status: LeadStatus;
    };
    leadSource?: {
      id: UUIDString;
      name: string;
      sourceType: LeadSourceType;
    };
    branch?: {
      id: UUIDString;
      name: string;
    };
    assignedMembership?: {
      id: UUIDString;
      email: string;
      role: MembershipRole;
      userProfile?: {
        uid: string;
        displayName: string;
      } & UserProfile_Key;
    };
  } & Lead_Key)[];
  total: ({
    count: number;
  })[];
}

export interface ListLeadsUpdatedDescVariables {
  organizationId: UUIDString;
  pipelineId?: UUIDString | null;
  pipelineStageId?: UUIDString | null;
  sourceId?: UUIDString | null;
  contactId?: UUIDString | null;
  priority?: LeadPriority | null;
  transactionType?: TransactionType | null;
  activeOnly?: boolean | null;
  limit?: number;
  offset?: number;
  search?: string | null;
  status?: LeadStatus | null;
  assignedMembershipId?: UUIDString | null;
  branchId?: UUIDString | null;
  followUpBefore?: TimestampString | null;
  followUpAfter?: TimestampString | null;
  createdFrom?: TimestampString | null;
  createdBefore?: TimestampString | null;
}

export interface ListLeadsVariables {
  organizationId: UUIDString;
  pipelineId?: UUIDString | null;
  pipelineStageId?: UUIDString | null;
  sourceId?: UUIDString | null;
  contactId?: UUIDString | null;
  priority?: LeadPriority | null;
  transactionType?: TransactionType | null;
  activeOnly?: boolean | null;
  limit?: number;
  offset?: number;
  search?: string | null;
  status?: LeadStatus | null;
  assignedMembershipId?: UUIDString | null;
  branchId?: UUIDString | null;
  followUpBefore?: TimestampString | null;
  followUpAfter?: TimestampString | null;
  createdFrom?: TimestampString | null;
  createdBefore?: TimestampString | null;
}

export interface ListMembershipsData {
  memberships: ({
    id: UUIDString;
    organizationId: UUIDString;
    userProfileUid?: string | null;
    email: string;
    role: MembershipRole;
    status: MembershipStatus;
    invitedByUid?: string | null;
    acceptedAt?: TimestampString | null;
    approvedAt?: TimestampString | null;
    approvedByUid?: string | null;
    invitationExpiresAt?: TimestampString | null;
    createdAt: TimestampString;
    updatedAt: TimestampString;
  } & Membership_Key)[];
}

export interface ListMembershipsVariables {
  organizationId: UUIDString;
}

export interface ListMyOrganizationsData {
  memberships: ({
    id: UUIDString;
    organizationId: UUIDString;
    userProfileUid?: string | null;
    email: string;
    role: MembershipRole;
    status: MembershipStatus;
    organization: {
      id: UUIDString;
      name: string;
      slug: string;
      createdAt: TimestampString;
    } & Organization_Key;
  } & Membership_Key)[];
}

export interface ListMyOrganizationsVariables {
  limit?: number;
  offset?: number;
}

export interface ListTeamMembersData {
  memberships: ({
    id: UUIDString;
    organizationId: UUIDString;
    userProfileUid?: string | null;
    email: string;
    role: MembershipRole;
    status: MembershipStatus;
    createdAt: TimestampString;
    userProfile?: {
      displayName: string;
    };
  } & Membership_Key)[];
  total: ({
    count: number;
  })[];
}

export interface ListTeamMembersVariables {
  organizationId: UUIDString;
  limit?: number;
  offset?: number;
  search?: string | null;
  status?: MembershipStatus | null;
}

export interface MarkInAppNotificationReadData {
  updated?: InAppNotification_Key | null;
}

export interface MarkInAppNotificationReadVariables {
  organizationId: UUIDString;
  notificationId: UUIDString;
}

export interface Membership_Key {
  organizationId: UUIDString;
  id: UUIDString;
  __typename?: 'Membership_Key';
}

export interface MoveLeadStageData {
  lead?: Lead_Key | null;
  activity: Activity_Key;
  auditLog_insert: AuditLog_Key;
}

export interface MoveLeadStageVariables {
  organizationId: UUIDString;
  leadId: UUIDString;
  pipelineStageId: UUIDString;
}

export interface Organization_Key {
  id: UUIDString;
  __typename?: 'Organization_Key';
}

export interface PipelineStage_Key {
  organizationId: UUIDString;
  pipelineId: UUIDString;
  id: UUIDString;
  __typename?: 'PipelineStage_Key';
}

export interface Pipeline_Key {
  organizationId: UUIDString;
  id: UUIDString;
  __typename?: 'Pipeline_Key';
}

export interface RecordInvitationDeliveryData {
  invitation?: Invitation_Key | null;
  auditLog_insert: AuditLog_Key;
}

export interface RecordInvitationDeliveryVariables {
  organizationId: UUIDString;
  membershipId: UUIDString;
  actorUid: string;
  tokenHash: string;
  outcome: InvitationDeliveryStatus;
}

export interface ReinviteRevokedInvitationData {
  invitation?: Invitation_Key | null;
  membership?: Membership_Key | null;
  activity_insert: Activity_Key;
  auditLog_insert: AuditLog_Key;
}

export interface ReinviteRevokedInvitationVariables {
  organizationId: UUIDString;
  membershipId: UUIDString;
  tokenHash: string;
  expiresAt: TimestampString;
}

export interface ReissueInvitationData {
  invitation?: Invitation_Key | null;
  membership_update?: Membership_Key | null;
  activity_insert: Activity_Key;
  auditLog_insert: AuditLog_Key;
}

export interface ReissueInvitationVariables {
  organizationId: UUIDString;
  membershipId: UUIDString;
  tokenHash: string;
  expiresAt: TimestampString;
}

export interface ResolveWebsiteLeadCaptureFormData {
  form?: {
    id: UUIDString;
    organizationId: UUIDString;
    publicId: string;
    name: string;
    status: LeadCaptureFormStatus;
    sourceId: UUIDString;
    source: {
      name: string;
      sourceType: LeadSourceType;
    };
    branchId?: UUIDString | null;
    projectId?: UUIDString | null;
    fields: unknown;
    consentText: string;
    privacyPolicyUrl: string;
    successMessage: string;
    createdByUid: string;
    organization: {
      id: UUIDString;
    } & Organization_Key;
  } & LeadCaptureForm_Key;
}

export interface ResolveWebsiteLeadCaptureFormVariables {
  publicId: string;
}

export interface RevokeInvitationData {
  invitation?: Invitation_Key | null;
  membership_update?: Membership_Key | null;
  activity_insert: Activity_Key;
  auditLog_insert: AuditLog_Key;
}

export interface RevokeInvitationVariables {
  organizationId: UUIDString;
  membershipId: UUIDString;
}

export interface SaveLeadDistributionSettingsData {
  updatedRule?: LeadDistributionRule_Key | null;
  createdRule: LeadDistributionRule_Key;
  newCursor: DistributionCursor_Key;
  clearEligibleAgents: number;
  selectEligibleAgents: number;
  audit: AuditLog_Key;
}

export interface SaveLeadDistributionSettingsVariables {
  organizationId: UUIDString;
  ruleId: UUIDString;
  hasExistingRule: boolean;
  hasCursor: boolean;
  expectedUpdatedAt: TimestampString;
  enabled: boolean;
  mode: LeadDistributionMode;
  branchId?: UUIDString | null;
  projectId?: UUIDString | null;
  skipUnavailable: boolean;
  businessHoursEnabled: boolean;
  timeZone: string;
  businessDaysMask: number;
  businessStart: string;
  businessEnd: string;
  reassignmentTimeoutMinutes: number;
  eligibleAgentIds: UUIDString[];
}

export interface ScheduleLeadFollowUpData {
  lead?: Lead_Key | null;
  leadFollowUp_updateMany: number;
  followUp: LeadFollowUp_Key;
  activity: Activity_Key;
  auditLog_insert: AuditLog_Key;
}

export interface ScheduleLeadFollowUpVariables {
  organizationId: UUIDString;
  leadId: UUIDString;
  followUpAt: TimestampString;
  followUpNote?: string | null;
  title?: string;
  assignedUserId?: UUIDString | null;
  replaceExisting?: boolean;
}

export interface SearchContactsData {
  contacts: ({
    id: UUIDString;
    organizationId: UUIDString;
    fullName: string;
    email?: string | null;
    normalizedEmail?: string | null;
    phone?: string | null;
    normalizedPhone?: string | null;
    alternatePhone?: string | null;
    normalizedAlternatePhone?: string | null;
    nationality?: string | null;
    preferredLanguage: string;
    notes?: string | null;
    createdByUid: string;
    createdAt: TimestampString;
    updatedAt: TimestampString;
  } & Contact_Key)[];
  total: ({
    count: number;
  })[];
}

export interface SearchContactsVariables {
  organizationId: UUIDString;
  search?: string | null;
  limit?: number;
  offset?: number;
}

export interface SetAgentAvailabilityData {
  availability: AgentAvailability_Key;
  audit: AuditLog_Key;
}

export interface SetAgentAvailabilityVariables {
  organizationId: UUIDString;
  membershipId?: UUIDString | null;
  status: AgentAvailabilityStatus;
  unavailableUntil?: TimestampString | null;
  reason?: string | null;
}

export interface SetMembershipRoleData {
  membership?: Membership_Key | null;
  activity_insert: Activity_Key;
  auditLog_insert: AuditLog_Key;
}

export interface SetMembershipRoleVariables {
  organizationId: UUIDString;
  membershipId: UUIDString;
  role: MembershipRole;
}

export interface SetMembershipStatusData {
  membership?: Membership_Key | null;
  activity_insert: Activity_Key;
  auditLog_insert: AuditLog_Key;
}

export interface SetMembershipStatusVariables {
  organizationId: UUIDString;
  membershipId: UUIDString;
  status: MembershipStatus;
}

export interface SubmitWebsiteLeadCaptureData {
  advanceCursor?: DistributionCursor_Key | null;
  contact: Contact_Key;
  lead: Lead_Key;
  assignment: LeadAssignmentHistory_Key;
  activity: Activity_Key;
  audit: AuditLog_Key;
  assignedNotification: InAppNotification_Key;
  unassignedNotification: InAppNotification_Key;
  submission: LeadCaptureSubmission_Key;
}

export interface SubmitWebsiteLeadCaptureVariables {
  organizationId: UUIDString;
  formId: UUIDString;
  publicId: string;
  idempotencyKeyHash: string;
  fullName: string;
  email?: string | null;
  phone?: string | null;
  normalizedEmail?: string | null;
  normalizedPhone?: string | null;
  contactId?: UUIDString | null;
  hasExistingContact: boolean;
  message?: string | null;
  propertyInterest?: string | null;
  preferredLocation?: string | null;
  propertyType?: string | null;
  transactionType?: TransactionType | null;
  budgetMin?: number | null;
  budgetMax?: number | null;
  currency: string;
  bedroomPreference?: string | null;
  landingPageUrl?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  utmContent?: string | null;
  utmTerm: string;
  consentTextSnapshot: string;
  privacyPolicyUrlSnapshot: string;
  assignedMembershipId?: UUIDString | null;
  distributionRuleId?: UUIDString | null;
  expectedCursorVersion?: number | null;
  hasAutoAssignment: boolean;
  hasDistributionAttempt: boolean;
}

export interface SwitchOrganizationData {
  userProfile_update?: UserProfile_Key | null;
  activity_insert: Activity_Key;
  auditLog_insert: AuditLog_Key;
}

export interface SwitchOrganizationVariables {
  organizationId: UUIDString;
}

export interface UnassignLeadData {
  lead?: Lead_Key | null;
  assignment: LeadAssignmentHistory_Key;
  leadFollowUp_updateMany: number;
  activity: Activity_Key;
  audit: AuditLog_Key;
  notification: InAppNotification_Key;
}

export interface UnassignLeadVariables {
  organizationId: UUIDString;
  leadId: UUIDString;
  expectedAssignedMembershipId?: UUIDString | null;
  expectedWasUnassigned: boolean;
  reason?: string;
  overrideClosed?: boolean;
}

export interface UpdateContactData {
  contact?: Contact_Key | null;
  lead_updateMany: number;
  auditLog_insert: AuditLog_Key;
}

export interface UpdateContactVariables {
  organizationId: UUIDString;
  contactId: UUIDString;
  fullName: string;
  email?: string | null;
  phone?: string | null;
  normalizedPhone?: string | null;
  alternatePhone?: string | null;
  normalizedAlternatePhone?: string | null;
  nationality?: string | null;
  preferredLanguage?: string | null;
  notes?: string | null;
}

export interface UpdateLeadCaptureFormData {
  form?: LeadCaptureForm_Key | null;
  activity: Activity_Key;
  audit: AuditLog_Key;
}

export interface UpdateLeadCaptureFormVariables {
  organizationId: UUIDString;
  formId: UUIDString;
  name: string;
  status: LeadCaptureFormStatus;
  branchId?: UUIDString | null;
  projectId?: UUIDString | null;
  fields: unknown;
  consentText: string;
  privacyPolicyUrl: string;
  successMessage: string;
}

export interface UpdateLeadData {
  lead?: Lead_Key | null;
  assignment: LeadAssignmentHistory_Key;
  leadFollowUp_updateMany: number;
  assignmentActivity: Activity_Key;
  assignmentAudit: AuditLog_Key;
  assignedNotification: InAppNotification_Key;
  unassignedNotification: InAppNotification_Key;
  activity: Activity_Key;
  auditLog_insert: AuditLog_Key;
}

export interface UpdateLeadVariables {
  organizationId: UUIDString;
  leadId?: UUIDString | null;
  fullName: string;
  email?: string | null;
  phone?: string | null;
  normalizedPhone?: string | null;
  source?: string | null;
  sourceId?: UUIDString | null;
  status: LeadStatus;
  branchId?: UUIDString | null;
  assignedMembershipId?: UUIDString | null;
  recordAssignment?: boolean;
  notifyAssigned?: boolean;
  notifyUnassigned?: boolean;
  propertyInterest?: string | null;
  preferredLocation?: string | null;
  propertyType?: string | null;
  transactionType?: TransactionType | null;
  budgetMin?: number | null;
  budgetMax?: number | null;
  currency?: string | null;
  bedroomPreference?: string | null;
  priority?: LeadPriority | null;
}

export interface UpdateOrganizationData {
  organization?: Organization_Key | null;
  activity_insert: Activity_Key;
  auditLog_insert: AuditLog_Key;
}

export interface UpdateOrganizationVariables {
  organizationId: UUIDString;
  name: string;
  slug: string;
  emirate: Emirate;
  contactPhone: string;
  companyEmail: string;
  companySize: CompanySize;
}

export interface UpsertMyProfileData {
  userProfile_upsert: UserProfile_Key;
}

export interface UpsertMyProfileVariables {
  displayName: string;
}

export interface UserProfile_Key {
  uid: string;
  __typename?: 'UserProfile_Key';
}

/** Generated Node Admin SDK operation action function for the 'InitializeLeadPipeline' Mutation. Allow users to execute without passing in DataConnect. */
export function initializeLeadPipeline(dc: DataConnect, vars: InitializeLeadPipelineVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<InitializeLeadPipelineData>>;
/** Generated Node Admin SDK operation action function for the 'InitializeLeadPipeline' Mutation. Allow users to pass in custom DataConnect instances. */
export function initializeLeadPipeline(vars: InitializeLeadPipelineVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<InitializeLeadPipelineData>>;

/** Generated Node Admin SDK operation action function for the 'CreateContact' Mutation. Allow users to execute without passing in DataConnect. */
export function createContact(dc: DataConnect, vars: CreateContactVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateContactData>>;
/** Generated Node Admin SDK operation action function for the 'CreateContact' Mutation. Allow users to pass in custom DataConnect instances. */
export function createContact(vars: CreateContactVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateContactData>>;

/** Generated Node Admin SDK operation action function for the 'UpdateContact' Mutation. Allow users to execute without passing in DataConnect. */
export function updateContact(dc: DataConnect, vars: UpdateContactVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateContactData>>;
/** Generated Node Admin SDK operation action function for the 'UpdateContact' Mutation. Allow users to pass in custom DataConnect instances. */
export function updateContact(vars: UpdateContactVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateContactData>>;

/** Generated Node Admin SDK operation action function for the 'CreateLead' Mutation. Allow users to execute without passing in DataConnect. */
export function createLead(dc: DataConnect, vars: CreateLeadVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateLeadData>>;
/** Generated Node Admin SDK operation action function for the 'CreateLead' Mutation. Allow users to pass in custom DataConnect instances. */
export function createLead(vars: CreateLeadVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateLeadData>>;

/** Generated Node Admin SDK operation action function for the 'CreateLeadForContact' Mutation. Allow users to execute without passing in DataConnect. */
export function createLeadForContact(dc: DataConnect, vars: CreateLeadForContactVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateLeadForContactData>>;
/** Generated Node Admin SDK operation action function for the 'CreateLeadForContact' Mutation. Allow users to pass in custom DataConnect instances. */
export function createLeadForContact(vars: CreateLeadForContactVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateLeadForContactData>>;

/** Generated Node Admin SDK operation action function for the 'UpdateLead' Mutation. Allow users to execute without passing in DataConnect. */
export function updateLead(dc: DataConnect, vars: UpdateLeadVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateLeadData>>;
/** Generated Node Admin SDK operation action function for the 'UpdateLead' Mutation. Allow users to pass in custom DataConnect instances. */
export function updateLead(vars: UpdateLeadVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateLeadData>>;

/** Generated Node Admin SDK operation action function for the 'ChangeLeadStatus' Mutation. Allow users to execute without passing in DataConnect. */
export function changeLeadStatus(dc: DataConnect, vars: ChangeLeadStatusVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ChangeLeadStatusData>>;
/** Generated Node Admin SDK operation action function for the 'ChangeLeadStatus' Mutation. Allow users to pass in custom DataConnect instances. */
export function changeLeadStatus(vars: ChangeLeadStatusVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ChangeLeadStatusData>>;

/** Generated Node Admin SDK operation action function for the 'MoveLeadStage' Mutation. Allow users to execute without passing in DataConnect. */
export function moveLeadStage(dc: DataConnect, vars: MoveLeadStageVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<MoveLeadStageData>>;
/** Generated Node Admin SDK operation action function for the 'MoveLeadStage' Mutation. Allow users to pass in custom DataConnect instances. */
export function moveLeadStage(vars: MoveLeadStageVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<MoveLeadStageData>>;

/** Generated Node Admin SDK operation action function for the 'AssignLead' Mutation. Allow users to execute without passing in DataConnect. */
export function assignLead(dc: DataConnect, vars: AssignLeadVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<AssignLeadData>>;
/** Generated Node Admin SDK operation action function for the 'AssignLead' Mutation. Allow users to pass in custom DataConnect instances. */
export function assignLead(vars: AssignLeadVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<AssignLeadData>>;

/** Generated Node Admin SDK operation action function for the 'UnassignLead' Mutation. Allow users to execute without passing in DataConnect. */
export function unassignLead(dc: DataConnect, vars: UnassignLeadVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UnassignLeadData>>;
/** Generated Node Admin SDK operation action function for the 'UnassignLead' Mutation. Allow users to pass in custom DataConnect instances. */
export function unassignLead(vars: UnassignLeadVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UnassignLeadData>>;

/** Generated Node Admin SDK operation action function for the 'SaveLeadDistributionSettings' Mutation. Allow users to execute without passing in DataConnect. */
export function saveLeadDistributionSettings(dc: DataConnect, vars: SaveLeadDistributionSettingsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<SaveLeadDistributionSettingsData>>;
/** Generated Node Admin SDK operation action function for the 'SaveLeadDistributionSettings' Mutation. Allow users to pass in custom DataConnect instances. */
export function saveLeadDistributionSettings(vars: SaveLeadDistributionSettingsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<SaveLeadDistributionSettingsData>>;

/** Generated Node Admin SDK operation action function for the 'SetAgentAvailability' Mutation. Allow users to execute without passing in DataConnect. */
export function setAgentAvailability(dc: DataConnect, vars: SetAgentAvailabilityVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<SetAgentAvailabilityData>>;
/** Generated Node Admin SDK operation action function for the 'SetAgentAvailability' Mutation. Allow users to pass in custom DataConnect instances. */
export function setAgentAvailability(vars: SetAgentAvailabilityVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<SetAgentAvailabilityData>>;

/** Generated Node Admin SDK operation action function for the 'MarkInAppNotificationRead' Mutation. Allow users to execute without passing in DataConnect. */
export function markInAppNotificationRead(dc: DataConnect, vars: MarkInAppNotificationReadVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<MarkInAppNotificationReadData>>;
/** Generated Node Admin SDK operation action function for the 'MarkInAppNotificationRead' Mutation. Allow users to pass in custom DataConnect instances. */
export function markInAppNotificationRead(vars: MarkInAppNotificationReadVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<MarkInAppNotificationReadData>>;

/** Generated Node Admin SDK operation action function for the 'AddLeadNote' Mutation. Allow users to execute without passing in DataConnect. */
export function addLeadNote(dc: DataConnect, vars: AddLeadNoteVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<AddLeadNoteData>>;
/** Generated Node Admin SDK operation action function for the 'AddLeadNote' Mutation. Allow users to pass in custom DataConnect instances. */
export function addLeadNote(vars: AddLeadNoteVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<AddLeadNoteData>>;

/** Generated Node Admin SDK operation action function for the 'ArchiveLead' Mutation. Allow users to execute without passing in DataConnect. */
export function archiveLead(dc: DataConnect, vars: ArchiveLeadVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ArchiveLeadData>>;
/** Generated Node Admin SDK operation action function for the 'ArchiveLead' Mutation. Allow users to pass in custom DataConnect instances. */
export function archiveLead(vars: ArchiveLeadVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ArchiveLeadData>>;

/** Generated Node Admin SDK operation action function for the 'ScheduleLeadFollowUp' Mutation. Allow users to execute without passing in DataConnect. */
export function scheduleLeadFollowUp(dc: DataConnect, vars: ScheduleLeadFollowUpVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ScheduleLeadFollowUpData>>;
/** Generated Node Admin SDK operation action function for the 'ScheduleLeadFollowUp' Mutation. Allow users to pass in custom DataConnect instances. */
export function scheduleLeadFollowUp(vars: ScheduleLeadFollowUpVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ScheduleLeadFollowUpData>>;

/** Generated Node Admin SDK operation action function for the 'CompleteLeadFollowUp' Mutation. Allow users to execute without passing in DataConnect. */
export function completeLeadFollowUp(dc: DataConnect, vars: CompleteLeadFollowUpVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CompleteLeadFollowUpData>>;
/** Generated Node Admin SDK operation action function for the 'CompleteLeadFollowUp' Mutation. Allow users to pass in custom DataConnect instances. */
export function completeLeadFollowUp(vars: CompleteLeadFollowUpVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CompleteLeadFollowUpData>>;

/** Generated Node Admin SDK operation action function for the 'UpsertMyProfile' Mutation. Allow users to execute without passing in DataConnect. */
export function upsertMyProfile(dc: DataConnect, vars: UpsertMyProfileVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpsertMyProfileData>>;
/** Generated Node Admin SDK operation action function for the 'UpsertMyProfile' Mutation. Allow users to pass in custom DataConnect instances. */
export function upsertMyProfile(vars: UpsertMyProfileVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpsertMyProfileData>>;

/** Generated Node Admin SDK operation action function for the 'CreateOrganization' Mutation. Allow users to execute without passing in DataConnect. */
export function createOrganization(dc: DataConnect, vars: CreateOrganizationVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateOrganizationData>>;
/** Generated Node Admin SDK operation action function for the 'CreateOrganization' Mutation. Allow users to pass in custom DataConnect instances. */
export function createOrganization(vars: CreateOrganizationVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateOrganizationData>>;

/** Generated Node Admin SDK operation action function for the 'UpdateOrganization' Mutation. Allow users to execute without passing in DataConnect. */
export function updateOrganization(dc: DataConnect, vars: UpdateOrganizationVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateOrganizationData>>;
/** Generated Node Admin SDK operation action function for the 'UpdateOrganization' Mutation. Allow users to pass in custom DataConnect instances. */
export function updateOrganization(vars: UpdateOrganizationVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateOrganizationData>>;

/** Generated Node Admin SDK operation action function for the 'SwitchOrganization' Mutation. Allow users to execute without passing in DataConnect. */
export function switchOrganization(dc: DataConnect, vars: SwitchOrganizationVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<SwitchOrganizationData>>;
/** Generated Node Admin SDK operation action function for the 'SwitchOrganization' Mutation. Allow users to pass in custom DataConnect instances. */
export function switchOrganization(vars: SwitchOrganizationVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<SwitchOrganizationData>>;

/** Generated Node Admin SDK operation action function for the 'CreateBranch' Mutation. Allow users to execute without passing in DataConnect. */
export function createBranch(dc: DataConnect, vars: CreateBranchVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateBranchData>>;
/** Generated Node Admin SDK operation action function for the 'CreateBranch' Mutation. Allow users to pass in custom DataConnect instances. */
export function createBranch(vars: CreateBranchVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateBranchData>>;

/** Generated Node Admin SDK operation action function for the 'InviteMembership' Mutation. Allow users to execute without passing in DataConnect. */
export function inviteMembership(dc: DataConnect, vars: InviteMembershipVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<InviteMembershipData>>;
/** Generated Node Admin SDK operation action function for the 'InviteMembership' Mutation. Allow users to pass in custom DataConnect instances. */
export function inviteMembership(vars: InviteMembershipVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<InviteMembershipData>>;

/** Generated Node Admin SDK operation action function for the 'AcceptInvitation' Mutation. Allow users to execute without passing in DataConnect. */
export function acceptInvitation(dc: DataConnect, vars: AcceptInvitationVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<AcceptInvitationData>>;
/** Generated Node Admin SDK operation action function for the 'AcceptInvitation' Mutation. Allow users to pass in custom DataConnect instances. */
export function acceptInvitation(vars: AcceptInvitationVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<AcceptInvitationData>>;

/** Generated Node Admin SDK operation action function for the 'ApproveMembership' Mutation. Allow users to execute without passing in DataConnect. */
export function approveMembership(dc: DataConnect, vars: ApproveMembershipVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ApproveMembershipData>>;
/** Generated Node Admin SDK operation action function for the 'ApproveMembership' Mutation. Allow users to pass in custom DataConnect instances. */
export function approveMembership(vars: ApproveMembershipVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ApproveMembershipData>>;

/** Generated Node Admin SDK operation action function for the 'SetMembershipStatus' Mutation. Allow users to execute without passing in DataConnect. */
export function setMembershipStatus(dc: DataConnect, vars: SetMembershipStatusVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<SetMembershipStatusData>>;
/** Generated Node Admin SDK operation action function for the 'SetMembershipStatus' Mutation. Allow users to pass in custom DataConnect instances. */
export function setMembershipStatus(vars: SetMembershipStatusVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<SetMembershipStatusData>>;

/** Generated Node Admin SDK operation action function for the 'RevokeInvitation' Mutation. Allow users to execute without passing in DataConnect. */
export function revokeInvitation(dc: DataConnect, vars: RevokeInvitationVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<RevokeInvitationData>>;
/** Generated Node Admin SDK operation action function for the 'RevokeInvitation' Mutation. Allow users to pass in custom DataConnect instances. */
export function revokeInvitation(vars: RevokeInvitationVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<RevokeInvitationData>>;

/** Generated Node Admin SDK operation action function for the 'ReissueInvitation' Mutation. Allow users to execute without passing in DataConnect. */
export function reissueInvitation(dc: DataConnect, vars: ReissueInvitationVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ReissueInvitationData>>;
/** Generated Node Admin SDK operation action function for the 'ReissueInvitation' Mutation. Allow users to pass in custom DataConnect instances. */
export function reissueInvitation(vars: ReissueInvitationVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ReissueInvitationData>>;

/** Generated Node Admin SDK operation action function for the 'ReinviteRevokedInvitation' Mutation. Allow users to execute without passing in DataConnect. */
export function reinviteRevokedInvitation(dc: DataConnect, vars: ReinviteRevokedInvitationVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ReinviteRevokedInvitationData>>;
/** Generated Node Admin SDK operation action function for the 'ReinviteRevokedInvitation' Mutation. Allow users to pass in custom DataConnect instances. */
export function reinviteRevokedInvitation(vars: ReinviteRevokedInvitationVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ReinviteRevokedInvitationData>>;

/** Generated Node Admin SDK operation action function for the 'RecordInvitationDelivery' Mutation. Allow users to execute without passing in DataConnect. */
export function recordInvitationDelivery(dc: DataConnect, vars: RecordInvitationDeliveryVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<RecordInvitationDeliveryData>>;
/** Generated Node Admin SDK operation action function for the 'RecordInvitationDelivery' Mutation. Allow users to pass in custom DataConnect instances. */
export function recordInvitationDelivery(vars: RecordInvitationDeliveryVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<RecordInvitationDeliveryData>>;

/** Generated Node Admin SDK operation action function for the 'SetMembershipRole' Mutation. Allow users to execute without passing in DataConnect. */
export function setMembershipRole(dc: DataConnect, vars: SetMembershipRoleVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<SetMembershipRoleData>>;
/** Generated Node Admin SDK operation action function for the 'SetMembershipRole' Mutation. Allow users to pass in custom DataConnect instances. */
export function setMembershipRole(vars: SetMembershipRoleVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<SetMembershipRoleData>>;

/** Generated Node Admin SDK operation action function for the 'CreateLeadCaptureForm' Mutation. Allow users to execute without passing in DataConnect. */
export function createLeadCaptureForm(dc: DataConnect, vars: CreateLeadCaptureFormVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateLeadCaptureFormData>>;
/** Generated Node Admin SDK operation action function for the 'CreateLeadCaptureForm' Mutation. Allow users to pass in custom DataConnect instances. */
export function createLeadCaptureForm(vars: CreateLeadCaptureFormVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateLeadCaptureFormData>>;

/** Generated Node Admin SDK operation action function for the 'UpdateLeadCaptureForm' Mutation. Allow users to execute without passing in DataConnect. */
export function updateLeadCaptureForm(dc: DataConnect, vars: UpdateLeadCaptureFormVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateLeadCaptureFormData>>;
/** Generated Node Admin SDK operation action function for the 'UpdateLeadCaptureForm' Mutation. Allow users to pass in custom DataConnect instances. */
export function updateLeadCaptureForm(vars: UpdateLeadCaptureFormVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateLeadCaptureFormData>>;

/** Generated Node Admin SDK operation action function for the 'ConsumeWebsiteLeadCaptureRateWindow' Mutation. Allow users to execute without passing in DataConnect. */
export function consumeWebsiteLeadCaptureRateWindow(dc: DataConnect, vars: ConsumeWebsiteLeadCaptureRateWindowVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ConsumeWebsiteLeadCaptureRateWindowData>>;
/** Generated Node Admin SDK operation action function for the 'ConsumeWebsiteLeadCaptureRateWindow' Mutation. Allow users to pass in custom DataConnect instances. */
export function consumeWebsiteLeadCaptureRateWindow(vars: ConsumeWebsiteLeadCaptureRateWindowVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ConsumeWebsiteLeadCaptureRateWindowData>>;

/** Generated Node Admin SDK operation action function for the 'SubmitWebsiteLeadCapture' Mutation. Allow users to execute without passing in DataConnect. */
export function submitWebsiteLeadCapture(dc: DataConnect, vars: SubmitWebsiteLeadCaptureVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<SubmitWebsiteLeadCaptureData>>;
/** Generated Node Admin SDK operation action function for the 'SubmitWebsiteLeadCapture' Mutation. Allow users to pass in custom DataConnect instances. */
export function submitWebsiteLeadCapture(vars: SubmitWebsiteLeadCaptureVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<SubmitWebsiteLeadCaptureData>>;

/** Generated Node Admin SDK operation action function for the 'GetMyProfile' Query. Allow users to execute without passing in DataConnect. */
export function getMyProfile(dc: DataConnect, options?: OperationOptions): Promise<ExecuteOperationResponse<GetMyProfileData>>;
/** Generated Node Admin SDK operation action function for the 'GetMyProfile' Query. Allow users to pass in custom DataConnect instances. */
export function getMyProfile(options?: OperationOptions): Promise<ExecuteOperationResponse<GetMyProfileData>>;

/** Generated Node Admin SDK operation action function for the 'ListMyOrganizations' Query. Allow users to execute without passing in DataConnect. */
export function listMyOrganizations(dc: DataConnect, vars?: ListMyOrganizationsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListMyOrganizationsData>>;
/** Generated Node Admin SDK operation action function for the 'ListMyOrganizations' Query. Allow users to pass in custom DataConnect instances. */
export function listMyOrganizations(vars?: ListMyOrganizationsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListMyOrganizationsData>>;

/** Generated Node Admin SDK operation action function for the 'GetMyPendingInvitations' Query. Allow users to execute without passing in DataConnect. */
export function getMyPendingInvitations(dc: DataConnect, options?: OperationOptions): Promise<ExecuteOperationResponse<GetMyPendingInvitationsData>>;
/** Generated Node Admin SDK operation action function for the 'GetMyPendingInvitations' Query. Allow users to pass in custom DataConnect instances. */
export function getMyPendingInvitations(options?: OperationOptions): Promise<ExecuteOperationResponse<GetMyPendingInvitationsData>>;

/** Generated Node Admin SDK operation action function for the 'GetOrganizationContext' Query. Allow users to execute without passing in DataConnect. */
export function getOrganizationContext(dc: DataConnect, vars: GetOrganizationContextVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetOrganizationContextData>>;
/** Generated Node Admin SDK operation action function for the 'GetOrganizationContext' Query. Allow users to pass in custom DataConnect instances. */
export function getOrganizationContext(vars: GetOrganizationContextVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetOrganizationContextData>>;

/** Generated Node Admin SDK operation action function for the 'ListBranches' Query. Allow users to execute without passing in DataConnect. */
export function listBranches(dc: DataConnect, vars: ListBranchesVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListBranchesData>>;
/** Generated Node Admin SDK operation action function for the 'ListBranches' Query. Allow users to pass in custom DataConnect instances. */
export function listBranches(vars: ListBranchesVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListBranchesData>>;

/** Generated Node Admin SDK operation action function for the 'ListMemberships' Query. Allow users to execute without passing in DataConnect. */
export function listMemberships(dc: DataConnect, vars: ListMembershipsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListMembershipsData>>;
/** Generated Node Admin SDK operation action function for the 'ListMemberships' Query. Allow users to pass in custom DataConnect instances. */
export function listMemberships(vars: ListMembershipsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListMembershipsData>>;

/** Generated Node Admin SDK operation action function for the 'ListLeads' Query. Allow users to execute without passing in DataConnect. */
export function listLeads(dc: DataConnect, vars: ListLeadsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListLeadsData>>;
/** Generated Node Admin SDK operation action function for the 'ListLeads' Query. Allow users to pass in custom DataConnect instances. */
export function listLeads(vars: ListLeadsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListLeadsData>>;

/** Generated Node Admin SDK operation action function for the 'ListLeadsCreatedAsc' Query. Allow users to execute without passing in DataConnect. */
export function listLeadsCreatedAsc(dc: DataConnect, vars: ListLeadsCreatedAscVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListLeadsCreatedAscData>>;
/** Generated Node Admin SDK operation action function for the 'ListLeadsCreatedAsc' Query. Allow users to pass in custom DataConnect instances. */
export function listLeadsCreatedAsc(vars: ListLeadsCreatedAscVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListLeadsCreatedAscData>>;

/** Generated Node Admin SDK operation action function for the 'ListLeadsUpdatedDesc' Query. Allow users to execute without passing in DataConnect. */
export function listLeadsUpdatedDesc(dc: DataConnect, vars: ListLeadsUpdatedDescVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListLeadsUpdatedDescData>>;
/** Generated Node Admin SDK operation action function for the 'ListLeadsUpdatedDesc' Query. Allow users to pass in custom DataConnect instances. */
export function listLeadsUpdatedDesc(vars: ListLeadsUpdatedDescVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListLeadsUpdatedDescData>>;

/** Generated Node Admin SDK operation action function for the 'ListLeadsNameAsc' Query. Allow users to execute without passing in DataConnect. */
export function listLeadsNameAsc(dc: DataConnect, vars: ListLeadsNameAscVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListLeadsNameAscData>>;
/** Generated Node Admin SDK operation action function for the 'ListLeadsNameAsc' Query. Allow users to pass in custom DataConnect instances. */
export function listLeadsNameAsc(vars: ListLeadsNameAscVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListLeadsNameAscData>>;

/** Generated Node Admin SDK operation action function for the 'ListLeadsNameDesc' Query. Allow users to execute without passing in DataConnect. */
export function listLeadsNameDesc(dc: DataConnect, vars: ListLeadsNameDescVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListLeadsNameDescData>>;
/** Generated Node Admin SDK operation action function for the 'ListLeadsNameDesc' Query. Allow users to pass in custom DataConnect instances. */
export function listLeadsNameDesc(vars: ListLeadsNameDescVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListLeadsNameDescData>>;

/** Generated Node Admin SDK operation action function for the 'ListLeadsFollowUpAsc' Query. Allow users to execute without passing in DataConnect. */
export function listLeadsFollowUpAsc(dc: DataConnect, vars: ListLeadsFollowUpAscVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListLeadsFollowUpAscData>>;
/** Generated Node Admin SDK operation action function for the 'ListLeadsFollowUpAsc' Query. Allow users to pass in custom DataConnect instances. */
export function listLeadsFollowUpAsc(vars: ListLeadsFollowUpAscVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListLeadsFollowUpAscData>>;

/** Generated Node Admin SDK operation action function for the 'GetLead' Query. Allow users to execute without passing in DataConnect. */
export function getLead(dc: DataConnect, vars: GetLeadVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetLeadData>>;
/** Generated Node Admin SDK operation action function for the 'GetLead' Query. Allow users to pass in custom DataConnect instances. */
export function getLead(vars: GetLeadVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetLeadData>>;

/** Generated Node Admin SDK operation action function for the 'ListLeadAssignees' Query. Allow users to execute without passing in DataConnect. */
export function listLeadAssignees(dc: DataConnect, vars: ListLeadAssigneesVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListLeadAssigneesData>>;
/** Generated Node Admin SDK operation action function for the 'ListLeadAssignees' Query. Allow users to pass in custom DataConnect instances. */
export function listLeadAssignees(vars: ListLeadAssigneesVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListLeadAssigneesData>>;

/** Generated Node Admin SDK operation action function for the 'GetLeadDistributionPlan' Query. Allow users to execute without passing in DataConnect. */
export function getLeadDistributionPlan(dc: DataConnect, vars: GetLeadDistributionPlanVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetLeadDistributionPlanData>>;
/** Generated Node Admin SDK operation action function for the 'GetLeadDistributionPlan' Query. Allow users to pass in custom DataConnect instances. */
export function getLeadDistributionPlan(vars: GetLeadDistributionPlanVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetLeadDistributionPlanData>>;

/** Generated Node Admin SDK operation action function for the 'GetMyAgentAvailability' Query. Allow users to execute without passing in DataConnect. */
export function getMyAgentAvailability(dc: DataConnect, vars: GetMyAgentAvailabilityVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetMyAgentAvailabilityData>>;
/** Generated Node Admin SDK operation action function for the 'GetMyAgentAvailability' Query. Allow users to pass in custom DataConnect instances. */
export function getMyAgentAvailability(vars: GetMyAgentAvailabilityVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetMyAgentAvailabilityData>>;

/** Generated Node Admin SDK operation action function for the 'ListInAppNotifications' Query. Allow users to execute without passing in DataConnect. */
export function listInAppNotifications(dc: DataConnect, vars: ListInAppNotificationsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListInAppNotificationsData>>;
/** Generated Node Admin SDK operation action function for the 'ListInAppNotifications' Query. Allow users to pass in custom DataConnect instances. */
export function listInAppNotifications(vars: ListInAppNotificationsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListInAppNotificationsData>>;

/** Generated Node Admin SDK operation action function for the 'ListLeadActivities' Query. Allow users to execute without passing in DataConnect. */
export function listLeadActivities(dc: DataConnect, vars: ListLeadActivitiesVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListLeadActivitiesData>>;
/** Generated Node Admin SDK operation action function for the 'ListLeadActivities' Query. Allow users to pass in custom DataConnect instances. */
export function listLeadActivities(vars: ListLeadActivitiesVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListLeadActivitiesData>>;

/** Generated Node Admin SDK operation action function for the 'ListActivities' Query. Allow users to execute without passing in DataConnect. */
export function listActivities(dc: DataConnect, vars: ListActivitiesVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListActivitiesData>>;
/** Generated Node Admin SDK operation action function for the 'ListActivities' Query. Allow users to pass in custom DataConnect instances. */
export function listActivities(vars: ListActivitiesVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListActivitiesData>>;

/** Generated Node Admin SDK operation action function for the 'GetTeamMembershipByEmail' Query. Allow users to execute without passing in DataConnect. */
export function getTeamMembershipByEmail(dc: DataConnect, vars: GetTeamMembershipByEmailVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetTeamMembershipByEmailData>>;
/** Generated Node Admin SDK operation action function for the 'GetTeamMembershipByEmail' Query. Allow users to pass in custom DataConnect instances. */
export function getTeamMembershipByEmail(vars: GetTeamMembershipByEmailVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetTeamMembershipByEmailData>>;

/** Generated Node Admin SDK operation action function for the 'ListInvitations' Query. Allow users to execute without passing in DataConnect. */
export function listInvitations(dc: DataConnect, vars: ListInvitationsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListInvitationsData>>;
/** Generated Node Admin SDK operation action function for the 'ListInvitations' Query. Allow users to pass in custom DataConnect instances. */
export function listInvitations(vars: ListInvitationsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListInvitationsData>>;

/** Generated Node Admin SDK operation action function for the 'ListTeamMembers' Query. Allow users to execute without passing in DataConnect. */
export function listTeamMembers(dc: DataConnect, vars: ListTeamMembersVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListTeamMembersData>>;
/** Generated Node Admin SDK operation action function for the 'ListTeamMembers' Query. Allow users to pass in custom DataConnect instances. */
export function listTeamMembers(vars: ListTeamMembersVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListTeamMembersData>>;

/** Generated Node Admin SDK operation action function for the 'ListAuditLogs' Query. Allow users to execute without passing in DataConnect. */
export function listAuditLogs(dc: DataConnect, vars: ListAuditLogsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListAuditLogsData>>;
/** Generated Node Admin SDK operation action function for the 'ListAuditLogs' Query. Allow users to pass in custom DataConnect instances. */
export function listAuditLogs(vars: ListAuditLogsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListAuditLogsData>>;

/** Generated Node Admin SDK operation action function for the 'GetLeadConfiguration' Query. Allow users to execute without passing in DataConnect. */
export function getLeadConfiguration(dc: DataConnect, vars: GetLeadConfigurationVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetLeadConfigurationData>>;
/** Generated Node Admin SDK operation action function for the 'GetLeadConfiguration' Query. Allow users to pass in custom DataConnect instances. */
export function getLeadConfiguration(vars: GetLeadConfigurationVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetLeadConfigurationData>>;

/** Generated Node Admin SDK operation action function for the 'SearchContacts' Query. Allow users to execute without passing in DataConnect. */
export function searchContacts(dc: DataConnect, vars: SearchContactsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<SearchContactsData>>;
/** Generated Node Admin SDK operation action function for the 'SearchContacts' Query. Allow users to pass in custom DataConnect instances. */
export function searchContacts(vars: SearchContactsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<SearchContactsData>>;

/** Generated Node Admin SDK operation action function for the 'GetContact' Query. Allow users to execute without passing in DataConnect. */
export function getContact(dc: DataConnect, vars: GetContactVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetContactData>>;
/** Generated Node Admin SDK operation action function for the 'GetContact' Query. Allow users to pass in custom DataConnect instances. */
export function getContact(vars: GetContactVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetContactData>>;

/** Generated Node Admin SDK operation action function for the 'FindDuplicateContacts' Query. Allow users to execute without passing in DataConnect. */
export function findDuplicateContacts(dc: DataConnect, vars: FindDuplicateContactsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<FindDuplicateContactsData>>;
/** Generated Node Admin SDK operation action function for the 'FindDuplicateContacts' Query. Allow users to pass in custom DataConnect instances. */
export function findDuplicateContacts(vars: FindDuplicateContactsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<FindDuplicateContactsData>>;

/** Generated Node Admin SDK operation action function for the 'GetLeadCrmHistory' Query. Allow users to execute without passing in DataConnect. */
export function getLeadCrmHistory(dc: DataConnect, vars: GetLeadCrmHistoryVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetLeadCrmHistoryData>>;
/** Generated Node Admin SDK operation action function for the 'GetLeadCrmHistory' Query. Allow users to pass in custom DataConnect instances. */
export function getLeadCrmHistory(vars: GetLeadCrmHistoryVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetLeadCrmHistoryData>>;

/** Generated Node Admin SDK operation action function for the 'GetLeadMetrics' Query. Allow users to execute without passing in DataConnect. */
export function getLeadMetrics(dc: DataConnect, vars: GetLeadMetricsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetLeadMetricsData>>;
/** Generated Node Admin SDK operation action function for the 'GetLeadMetrics' Query. Allow users to pass in custom DataConnect instances. */
export function getLeadMetrics(vars: GetLeadMetricsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetLeadMetricsData>>;

/** Generated Node Admin SDK operation action function for the 'ListLeadFollowUps' Query. Allow users to execute without passing in DataConnect. */
export function listLeadFollowUps(dc: DataConnect, vars: ListLeadFollowUpsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListLeadFollowUpsData>>;
/** Generated Node Admin SDK operation action function for the 'ListLeadFollowUps' Query. Allow users to pass in custom DataConnect instances. */
export function listLeadFollowUps(vars: ListLeadFollowUpsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListLeadFollowUpsData>>;

/** Generated Node Admin SDK operation action function for the 'ListLeadCaptureForms' Query. Allow users to execute without passing in DataConnect. */
export function listLeadCaptureForms(dc: DataConnect, vars: ListLeadCaptureFormsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListLeadCaptureFormsData>>;
/** Generated Node Admin SDK operation action function for the 'ListLeadCaptureForms' Query. Allow users to pass in custom DataConnect instances. */
export function listLeadCaptureForms(vars: ListLeadCaptureFormsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListLeadCaptureFormsData>>;

/** Generated Node Admin SDK operation action function for the 'GetLeadCaptureForm' Query. Allow users to execute without passing in DataConnect. */
export function getLeadCaptureForm(dc: DataConnect, vars: GetLeadCaptureFormVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetLeadCaptureFormData>>;
/** Generated Node Admin SDK operation action function for the 'GetLeadCaptureForm' Query. Allow users to pass in custom DataConnect instances. */
export function getLeadCaptureForm(vars: GetLeadCaptureFormVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetLeadCaptureFormData>>;

/** Generated Node Admin SDK operation action function for the 'ResolveWebsiteLeadCaptureForm' Query. Allow users to execute without passing in DataConnect. */
export function resolveWebsiteLeadCaptureForm(dc: DataConnect, vars: ResolveWebsiteLeadCaptureFormVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ResolveWebsiteLeadCaptureFormData>>;
/** Generated Node Admin SDK operation action function for the 'ResolveWebsiteLeadCaptureForm' Query. Allow users to pass in custom DataConnect instances. */
export function resolveWebsiteLeadCaptureForm(vars: ResolveWebsiteLeadCaptureFormVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ResolveWebsiteLeadCaptureFormData>>;

/** Generated Node Admin SDK operation action function for the 'FindWebsiteLeadCaptureContact' Query. Allow users to execute without passing in DataConnect. */
export function findWebsiteLeadCaptureContact(dc: DataConnect, vars: FindWebsiteLeadCaptureContactVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<FindWebsiteLeadCaptureContactData>>;
/** Generated Node Admin SDK operation action function for the 'FindWebsiteLeadCaptureContact' Query. Allow users to pass in custom DataConnect instances. */
export function findWebsiteLeadCaptureContact(vars: FindWebsiteLeadCaptureContactVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<FindWebsiteLeadCaptureContactData>>;

/** Generated Node Admin SDK operation action function for the 'GetWebsiteLeadCaptureRateWindow' Query. Allow users to execute without passing in DataConnect. */
export function getWebsiteLeadCaptureRateWindow(dc: DataConnect, vars: GetWebsiteLeadCaptureRateWindowVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetWebsiteLeadCaptureRateWindowData>>;
/** Generated Node Admin SDK operation action function for the 'GetWebsiteLeadCaptureRateWindow' Query. Allow users to pass in custom DataConnect instances. */
export function getWebsiteLeadCaptureRateWindow(vars: GetWebsiteLeadCaptureRateWindowVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetWebsiteLeadCaptureRateWindowData>>;

/** Generated Node Admin SDK operation action function for the 'FindWebsiteLeadCaptureSubmission' Query. Allow users to execute without passing in DataConnect. */
export function findWebsiteLeadCaptureSubmission(dc: DataConnect, vars: FindWebsiteLeadCaptureSubmissionVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<FindWebsiteLeadCaptureSubmissionData>>;
/** Generated Node Admin SDK operation action function for the 'FindWebsiteLeadCaptureSubmission' Query. Allow users to pass in custom DataConnect instances. */
export function findWebsiteLeadCaptureSubmission(vars: FindWebsiteLeadCaptureSubmissionVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<FindWebsiteLeadCaptureSubmissionData>>;

/** Generated Node Admin SDK operation action function for the 'GetWebsiteLeadDistributionPlan' Query. Allow users to execute without passing in DataConnect. */
export function getWebsiteLeadDistributionPlan(dc: DataConnect, vars: GetWebsiteLeadDistributionPlanVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetWebsiteLeadDistributionPlanData>>;
/** Generated Node Admin SDK operation action function for the 'GetWebsiteLeadDistributionPlan' Query. Allow users to pass in custom DataConnect instances. */
export function getWebsiteLeadDistributionPlan(vars: GetWebsiteLeadDistributionPlanVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetWebsiteLeadDistributionPlanData>>;

/** Generated Node Admin SDK operation action function for the 'GetLeadAnalytics' Query. Allow users to execute without passing in DataConnect. */
export function getLeadAnalytics(dc: DataConnect, vars: GetLeadAnalyticsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetLeadAnalyticsData>>;
/** Generated Node Admin SDK operation action function for the 'GetLeadAnalytics' Query. Allow users to pass in custom DataConnect instances. */
export function getLeadAnalytics(vars: GetLeadAnalyticsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetLeadAnalyticsData>>;

