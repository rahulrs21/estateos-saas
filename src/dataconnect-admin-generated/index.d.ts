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
  LEAD_NOTE_ADDED = "LEAD_NOTE_ADDED",
  LEAD_STATUS_CHANGED = "LEAD_STATUS_CHANGED",
  LEAD_ASSIGNED = "LEAD_ASSIGNED",
  FOLLOW_UP_SCHEDULED = "FOLLOW_UP_SCHEDULED",
  FOLLOW_UP_COMPLETED = "FOLLOW_UP_COMPLETED",
}
export enum AuditTargetType {
  ORGANIZATION = "ORGANIZATION",
  MEMBERSHIP = "MEMBERSHIP",
  BRANCH = "BRANCH",
  LEAD = "LEAD",
  INVITATION = "INVITATION",
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
export enum LeadStatus {
  NEW = "NEW",
  CONTACTED = "CONTACTED",
  QUALIFIED = "QUALIFIED",
  LOST = "LOST",
  CONVERTED = "CONVERTED",
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

export interface ApproveMembershipData {
  membership?: Membership_Key | null;
  activity_insert: Activity_Key;
  auditLog_insert: AuditLog_Key;
}

export interface ApproveMembershipVariables {
  organizationId: UUIDString;
  membershipId: UUIDString;
}

export interface AssignLeadData {
  lead?: Lead_Key | null;
  activity: Activity_Key;
  auditLog_insert: AuditLog_Key;
}

export interface AssignLeadVariables {
  organizationId: UUIDString;
  leadId: UUIDString;
  assignedMembershipId?: UUIDString | null;
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
  activity: Activity_Key;
  auditLog_insert: AuditLog_Key;
}

export interface CompleteLeadFollowUpVariables {
  organizationId: UUIDString;
  leadId: UUIDString;
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

export interface CreateLeadData {
  lead: Lead_Key;
  activity_insert: Activity_Key;
  auditLog_insert: AuditLog_Key;
}

export interface CreateLeadVariables {
  organizationId: UUIDString;
  fullName: string;
  email?: string | null;
  phone?: string | null;
  source?: string | null;
  branchId?: UUIDString | null;
  assignedMembershipId?: UUIDString | null;
}

export interface CreateOrganizationData {
  organization: Organization_Key;
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

export interface GetLeadVariables {
  organizationId: UUIDString;
  leadId: UUIDString;
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

export interface ListLeadsVariables {
  organizationId: UUIDString;
  limit?: number;
  offset?: number;
  search?: string | null;
  status?: LeadStatus | null;
  assignedMembershipId?: UUIDString | null;
  branchId?: UUIDString | null;
  followUpBefore?: TimestampString | null;
  followUpAfter?: TimestampString | null;
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

export interface Membership_Key {
  organizationId: UUIDString;
  id: UUIDString;
  __typename?: 'Membership_Key';
}

export interface Organization_Key {
  id: UUIDString;
  __typename?: 'Organization_Key';
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

export interface ScheduleLeadFollowUpData {
  lead?: Lead_Key | null;
  activity: Activity_Key;
  auditLog_insert: AuditLog_Key;
}

export interface ScheduleLeadFollowUpVariables {
  organizationId: UUIDString;
  leadId: UUIDString;
  followUpAt: TimestampString;
  followUpNote?: string | null;
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

export interface SwitchOrganizationData {
  userProfile_update?: UserProfile_Key | null;
  activity_insert: Activity_Key;
  auditLog_insert: AuditLog_Key;
}

export interface SwitchOrganizationVariables {
  organizationId: UUIDString;
}

export interface UpdateLeadData {
  lead?: Lead_Key | null;
  activity_insert: Activity_Key;
  auditLog_insert: AuditLog_Key;
}

export interface UpdateLeadVariables {
  leadId: UUIDString;
  status: LeadStatus;
  organizationId: UUIDString;
  fullName: string;
  email?: string | null;
  phone?: string | null;
  source?: string | null;
  branchId?: UUIDString | null;
  assignedMembershipId?: UUIDString | null;
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

/** Generated Node Admin SDK operation action function for the 'CreateLead' Mutation. Allow users to execute without passing in DataConnect. */
export function createLead(dc: DataConnect, vars: CreateLeadVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateLeadData>>;
/** Generated Node Admin SDK operation action function for the 'CreateLead' Mutation. Allow users to pass in custom DataConnect instances. */
export function createLead(vars: CreateLeadVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateLeadData>>;

/** Generated Node Admin SDK operation action function for the 'UpdateLead' Mutation. Allow users to execute without passing in DataConnect. */
export function updateLead(dc: DataConnect, vars: UpdateLeadVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateLeadData>>;
/** Generated Node Admin SDK operation action function for the 'UpdateLead' Mutation. Allow users to pass in custom DataConnect instances. */
export function updateLead(vars: UpdateLeadVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateLeadData>>;

/** Generated Node Admin SDK operation action function for the 'AddLeadNote' Mutation. Allow users to execute without passing in DataConnect. */
export function addLeadNote(dc: DataConnect, vars: AddLeadNoteVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<AddLeadNoteData>>;
/** Generated Node Admin SDK operation action function for the 'AddLeadNote' Mutation. Allow users to pass in custom DataConnect instances. */
export function addLeadNote(vars: AddLeadNoteVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<AddLeadNoteData>>;

/** Generated Node Admin SDK operation action function for the 'ChangeLeadStatus' Mutation. Allow users to execute without passing in DataConnect. */
export function changeLeadStatus(dc: DataConnect, vars: ChangeLeadStatusVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ChangeLeadStatusData>>;
/** Generated Node Admin SDK operation action function for the 'ChangeLeadStatus' Mutation. Allow users to pass in custom DataConnect instances. */
export function changeLeadStatus(vars: ChangeLeadStatusVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ChangeLeadStatusData>>;

/** Generated Node Admin SDK operation action function for the 'AssignLead' Mutation. Allow users to execute without passing in DataConnect. */
export function assignLead(dc: DataConnect, vars: AssignLeadVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<AssignLeadData>>;
/** Generated Node Admin SDK operation action function for the 'AssignLead' Mutation. Allow users to pass in custom DataConnect instances. */
export function assignLead(vars: AssignLeadVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<AssignLeadData>>;

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

/** Generated Node Admin SDK operation action function for the 'GetLead' Query. Allow users to execute without passing in DataConnect. */
export function getLead(dc: DataConnect, vars: GetLeadVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetLeadData>>;
/** Generated Node Admin SDK operation action function for the 'GetLead' Query. Allow users to pass in custom DataConnect instances. */
export function getLead(vars: GetLeadVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetLeadData>>;

/** Generated Node Admin SDK operation action function for the 'ListLeadAssignees' Query. Allow users to execute without passing in DataConnect. */
export function listLeadAssignees(dc: DataConnect, vars: ListLeadAssigneesVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListLeadAssigneesData>>;
/** Generated Node Admin SDK operation action function for the 'ListLeadAssignees' Query. Allow users to pass in custom DataConnect instances. */
export function listLeadAssignees(vars: ListLeadAssigneesVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListLeadAssigneesData>>;

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

