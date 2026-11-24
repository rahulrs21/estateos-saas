import { ConnectorConfig, DataConnect, OperationOptions, ExecuteOperationResponse } from 'firebase-admin/data-connect';

export const connectorConfig: ConnectorConfig;

export type TimestampString = string;
export type UUIDString = string;
export type Int64String = string;
export type DateString = string;

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
  DEVELOPER = "DEVELOPER",
  PROJECT = "PROJECT",
  BUILDING = "BUILDING",
  PROPERTY = "PROPERTY",
  PROPERTY_LISTING = "PROPERTY_LISTING",
  FLOOR_PLAN = "FLOOR_PLAN",
  PAYMENT_PLAN = "PAYMENT_PLAN",
  PROPERTY_AMENITY = "PROPERTY_AMENITY",
  PROPERTY_FEATURE = "PROPERTY_FEATURE",
  INVENTORY_MEDIA = "INVENTORY_MEDIA",
  PORTAL_CONNECTION = "PORTAL_CONNECTION",
  PORTAL_FIELD_MAPPING = "PORTAL_FIELD_MAPPING",
  LISTING_PUBLICATION = "LISTING_PUBLICATION",
  FEED_GENERATION_JOB = "FEED_GENERATION_JOB",
  AI_CONVERSATION = "AI_CONVERSATION",
  AI_CONTENT_DRAFT = "AI_CONTENT_DRAFT",
  AI_CONTENT_TEMPLATE = "AI_CONTENT_TEMPLATE",
  AI_BRAND_PROFILE = "AI_BRAND_PROFILE",
  LEAD_QUALIFICATION = "LEAD_QUALIFICATION",
  AI_LEAD_PRIORITY_REVIEW = "AI_LEAD_PRIORITY_REVIEW",
  WEBSITE = "WEBSITE",
  WEBSITE_PAGE = "WEBSITE_PAGE",
  PAGE_PUBLICATION = "PAGE_PUBLICATION",
  WEBSITE_ENQUIRY = "WEBSITE_ENQUIRY",
  WEBSITE_MEDIA = "WEBSITE_MEDIA",
  WEBSITE_SECTION_TEMPLATE = "WEBSITE_SECTION_TEMPLATE",
  AUTOMATION_WORKFLOW = "AUTOMATION_WORKFLOW",
  AUTOMATION_EXECUTION = "AUTOMATION_EXECUTION",
  AUTOMATION_APPROVAL = "AUTOMATION_APPROVAL",
  WORK_TASK = "WORK_TASK",
  CALL = "CALL",
  COMMUNICATION_SETTINGS = "COMMUNICATION_SETTINGS",
  COMMUNICATION_SUPPRESSION = "COMMUNICATION_SUPPRESSION",
  COMMUNICATION_PROVIDER = "COMMUNICATION_PROVIDER",
  PHONE_LINE = "PHONE_LINE",
  CALL_CONSENT = "CALL_CONSENT",
  CALL_RECORDING = "CALL_RECORDING",
  CALL_TRANSCRIPT = "CALL_TRANSCRIPT",
  CALL_AI_SUMMARY = "CALL_AI_SUMMARY",
  VOICE_ASSISTANT = "VOICE_ASSISTANT",
  VOICE_TEST_SESSION = "VOICE_TEST_SESSION",
  MEETING = "MEETING",
  COMMUNICATION_SIMULATION = "COMMUNICATION_SIMULATION",
  CONVERSATION = "CONVERSATION",
  CHANNEL_CONNECTION = "CHANNEL_CONNECTION",
  OUTBOUND_MESSAGE = "OUTBOUND_MESSAGE",
  META_LEAD_CONNECTION = "META_LEAD_CONNECTION",
  META_LEAD_FORM = "META_LEAD_FORM",
}
export enum CallConsentStatus {
  NOTICE_GIVEN = "NOTICE_GIVEN",
  GIVEN = "GIVEN",
  DECLINED = "DECLINED",
  WITHDRAWN = "WITHDRAWN",
}
export enum CallDirection {
  OUTBOUND = "OUTBOUND",
  INBOUND = "INBOUND",
}
export enum CallMediaStatus {
  STORED = "STORED",
  DELETED = "DELETED",
}
export enum CallOutcome {
  INTERESTED = "INTERESTED",
  NOT_INTERESTED = "NOT_INTERESTED",
  CALLBACK_REQUESTED = "CALLBACK_REQUESTED",
  VIEWING_REQUESTED = "VIEWING_REQUESTED",
  NO_DECISION = "NO_DECISION",
  WRONG_NUMBER = "WRONG_NUMBER",
  DO_NOT_CALL_REQUESTED = "DO_NOT_CALL_REQUESTED",
  OFFER_REJECTED = "OFFER_REJECTED",
}
export enum CallSource {
  MANUAL = "MANUAL",
  PROVIDER = "PROVIDER",
  SIMULATED = "SIMULATED",
}
export enum CallStatus {
  INITIATED = "INITIATED",
  RINGING = "RINGING",
  IN_PROGRESS = "IN_PROGRESS",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
  BUSY = "BUSY",
  NO_ANSWER = "NO_ANSWER",
  CANCELLED = "CANCELLED",
}
export enum CallSuggestionStatus {
  PENDING = "PENDING",
  ACCEPTED = "ACCEPTED",
  DISMISSED = "DISMISSED",
}
export enum CallSummaryStatus {
  DRAFT = "DRAFT",
  REVIEWED = "REVIEWED",
  DISMISSED = "DISMISSED",
}
export enum CallType {
  SERVICE = "SERVICE",
  FOLLOW_UP = "FOLLOW_UP",
  MARKETING = "MARKETING",
  INBOUND_ENQUIRY = "INBOUND_ENQUIRY",
}
export enum ChannelConnectionStatus {
  NOT_CONFIGURED = "NOT_CONFIGURED",
  CONFIGURED = "CONFIGURED",
  VERIFIED = "VERIFIED",
  DISABLED = "DISABLED",
  ERROR = "ERROR",
}
export enum ChannelProvider {
  WHATSAPP_CLOUD = "WHATSAPP_CLOUD",
  GMAIL = "GMAIL",
  MICROSOFT_365 = "MICROSOFT_365",
  WEBSITE_FORM = "WEBSITE_FORM",
  INTERNAL = "INTERNAL",
  DEVELOPMENT_SIMULATOR = "DEVELOPMENT_SIMULATOR",
}
export enum CommunicationConnectionStatus {
  NOT_CONFIGURED = "NOT_CONFIGURED",
  CONFIGURED = "CONFIGURED",
  VERIFIED = "VERIFIED",
  DISABLED = "DISABLED",
  ERROR = "ERROR",
}
export enum CommunicationProviderType {
  TWILIO = "TWILIO",
  RETELL = "RETELL",
  PBX = "PBX",
  OTHER_APPROVED_PROVIDER = "OTHER_APPROVED_PROVIDER",
}
export enum CommunicationSuppressionReason {
  OPT_OUT = "OPT_OUT",
  DNCR_LISTED = "DNCR_LISTED",
  OFFER_REJECTED = "OFFER_REJECTED",
  WRONG_NUMBER = "WRONG_NUMBER",
  OTHER = "OTHER",
}
export enum CommunicationSuppressionScope {
  ALL = "ALL",
  MARKETING = "MARKETING",
}
export enum InboxAttachmentScan {
  PENDING = "PENDING",
  CLEAN = "CLEAN",
  BLOCKED = "BLOCKED",
  NOT_SCANNED = "NOT_SCANNED",
}
export enum InboxChannel {
  WHATSAPP = "WHATSAPP",
  EMAIL = "EMAIL",
  WEBSITE = "WEBSITE",
  INTERNAL = "INTERNAL",
}
export enum InboxConversationStatus {
  OPEN = "OPEN",
  PENDING = "PENDING",
  RESOLVED = "RESOLVED",
  CLOSED = "CLOSED",
}
export enum InboxDeliveryStatus {
  DRAFT = "DRAFT",
  QUEUED = "QUEUED",
  SENT = "SENT",
  DELIVERED = "DELIVERED",
  READ = "READ",
  FAILED = "FAILED",
  RECEIVED = "RECEIVED",
  UNKNOWN = "UNKNOWN",
}
export enum InboxDirection {
  INBOUND = "INBOUND",
  OUTBOUND = "OUTBOUND",
}
export enum InboxEventStatus {
  RECEIVED = "RECEIVED",
  PROCESSED = "PROCESSED",
  DUPLICATE = "DUPLICATE",
  FAILED = "FAILED",
  DEAD = "DEAD",
}
export enum InboxMailboxSyncState {
  ACTIVE = "ACTIVE",
  RESYNC = "RESYNC",
  NEEDS_RECONNECT = "NEEDS_RECONNECT",
  DISCONNECTED = "DISCONNECTED",
}
export enum InboxMessageType {
  TEXT = "TEXT",
  IMAGE = "IMAGE",
  DOCUMENT = "DOCUMENT",
  AUDIO = "AUDIO",
  VIDEO = "VIDEO",
  TEMPLATE = "TEMPLATE",
  SYSTEM = "SYSTEM",
  UNKNOWN = "UNKNOWN",
}
export enum InboxPriority {
  LOW = "LOW",
  NORMAL = "NORMAL",
  HIGH = "HIGH",
  URGENT = "URGENT",
}
export enum LeadPriority {
  LOW = "LOW",
  NORMAL = "NORMAL",
  HIGH = "HIGH",
  URGENT = "URGENT",
}
export enum LeadPropertyViewingStatus {
  SCHEDULED = "SCHEDULED",
  COMPLETED = "COMPLETED",
  CANCELLED = "CANCELLED",
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
export enum MeetingProvider {
  GOOGLE_MEET = "GOOGLE_MEET",
  MICROSOFT_TEAMS = "MICROSOFT_TEAMS",
  ZOOM = "ZOOM",
  WEBEX = "WEBEX",
  IN_PERSON = "IN_PERSON",
  PHONE = "PHONE",
  OTHER = "OTHER",
}
export enum MeetingStatus {
  SCHEDULED = "SCHEDULED",
  COMPLETED = "COMPLETED",
  CANCELLED = "CANCELLED",
  NO_SHOW = "NO_SHOW",
}
export enum MembershipRole {
  OWNER = "OWNER",
  ADMIN = "ADMIN",
  MANAGER = "MANAGER",
  AGENT = "AGENT",
}
export enum OutboundStage {
  DRAFT = "DRAFT",
  VALIDATED = "VALIDATED",
  PENDING_APPROVAL = "PENDING_APPROVAL",
  APPROVED = "APPROVED",
  QUEUED = "QUEUED",
  SENT = "SENT",
  FAILED = "FAILED",
  CANCELLED = "CANCELLED",
}
export enum PhoneLinePurpose {
  SALES = "SALES",
  SUPPORT = "SUPPORT",
  MARKETING = "MARKETING",
  VOICE_ASSISTANT = "VOICE_ASSISTANT",
}
export enum PhoneLineStatus {
  PENDING = "PENDING",
  ACTIVE = "ACTIVE",
  DISABLED = "DISABLED",
}
export enum TransactionType {
  BUY = "BUY",
  RENT = "RENT",
  INVEST = "INVEST",
}
export enum TranscriptSource {
  UPLOAD = "UPLOAD",
  PROVIDER = "PROVIDER",
}
export enum VoiceAssistantStatus {
  DRAFT = "DRAFT",
  TEST_ONLY = "TEST_ONLY",
}
export enum VoiceTestSessionStatus {
  ACTIVE = "ACTIVE",
  HANDED_OFF = "HANDED_OFF",
  ENDED = "ENDED",
  LIMIT_REACHED = "LIMIT_REACHED",
}

export interface AcknowledgeInboxReplyData {
  job?: OutboundMessageJob_Key | null;
  message?: InboxMessage_Key | null;
  auditLog_insert: AuditLog_Key;
}

export interface AcknowledgeInboxReplyVariables {
  organizationId: UUIDString;
  id: UUIDString;
  conversationId: UUIDString;
  messageId: UUIDString;
  providerMessageId: string;
  actorUid: string;
}

export interface Activity_Key {
  organizationId: UUIDString;
  id: UUIDString;
  __typename?: 'Activity_Key';
}

export interface AddCommunicationSuppressionData {
  suppression: CommunicationSuppression_Key;
  auditLog_insert: AuditLog_Key;
}

export interface AddCommunicationSuppressionVariables {
  organizationId: UUIDString;
  id: UUIDString;
  normalizedNumber: string;
  scope: CommunicationSuppressionScope;
  reason: CommunicationSuppressionReason;
  note?: string | null;
}

export interface AddInboxNoteData {
  inboxNote_insert: InboxNote_Key;
  auditLog_insert: AuditLog_Key;
}

export interface AddInboxNoteVariables {
  organizationId: UUIDString;
  id: UUIDString;
  conversationId: UUIDString;
  body: string;
}

export interface AddMeetingAttendeeData {
  communicationMeetingAttendee_insert: CommunicationMeetingAttendee_Key;
}

export interface AddMeetingAttendeeVariables {
  organizationId: UUIDString;
  id: UUIDString;
  meetingId: UUIDString;
  membershipId: UUIDString;
}

export interface AgentAvailability_Key {
  organizationId: UUIDString;
  membershipId: UUIDString;
  __typename?: 'AgentAvailability_Key';
}

export interface AiBrandProfile_Key {
  organizationId: UUIDString;
  __typename?: 'AiBrandProfile_Key';
}

export interface AiContentDraft_Key {
  organizationId: UUIDString;
  id: UUIDString;
  __typename?: 'AiContentDraft_Key';
}

export interface AiContentTemplate_Key {
  organizationId: UUIDString;
  id: UUIDString;
  __typename?: 'AiContentTemplate_Key';
}

export interface AiContentVersion_Key {
  organizationId: UUIDString;
  id: UUIDString;
  __typename?: 'AiContentVersion_Key';
}

export interface AiConversation_Key {
  organizationId: UUIDString;
  id: UUIDString;
  __typename?: 'AiConversation_Key';
}

export interface AiMessage_Key {
  organizationId: UUIDString;
  id: UUIDString;
  __typename?: 'AiMessage_Key';
}

export interface AiSalesInsight_Key {
  organizationId: UUIDString;
  id: UUIDString;
  __typename?: 'AiSalesInsight_Key';
}

export interface AiToolExecution_Key {
  organizationId: UUIDString;
  id: UUIDString;
  __typename?: 'AiToolExecution_Key';
}

export interface AiUsageCounter_Key {
  organizationId: UUIDString;
  periodKey: string;
  subjectKey: string;
  __typename?: 'AiUsageCounter_Key';
}

export interface AiUsageRecord_Key {
  organizationId: UUIDString;
  id: UUIDString;
  __typename?: 'AiUsageRecord_Key';
}

export interface AppendInboxMessageData {
  message: InboxMessage_Key;
  conversation?: InboxConversation_Key | null;
  received: AutomationEvent_Key;
  suppression: CommunicationSuppression_Key;
  emailOptOut: InboxEmailOptOut_Key;
}

export interface AppendInboxMessageVariables {
  organizationId: UUIDString;
  conversationId: UUIDString;
  channelConnectionId?: UUIDString | null;
  messageId: UUIDString;
  externalMessageId: string;
  messageType: InboxMessageType;
  content?: string | null;
  senderIdentity?: string | null;
  recipientIdentity?: string | null;
  providerTimestamp?: TimestampString | null;
  internetMessageId?: string | null;
  preview?: string | null;
  simulated: boolean;
  optedOut: boolean;
  suppressNumber?: boolean;
  suppressEmail?: boolean;
  optOutId?: UUIDString | null;
  optOutIdentity?: string;
}

export interface ApplyInboxDeliveryStatusData {
  message?: InboxMessage_Key | null;
  failed: AutomationEvent_Key;
}

export interface ApplyInboxDeliveryStatusVariables {
  organizationId: UUIDString;
  id: UUIDString;
  conversationId: UUIDString;
  expectedStatus: InboxDeliveryStatus;
  deliveryStatus: InboxDeliveryStatus;
  raw?: string | null;
  providerTimestamp?: TimestampString | null;
  emitFailed: boolean;
  simulated: boolean;
}

export interface ApplyInboxRetentionData {
  messages: number;
  attachments: number;
  previews: number;
  replies: number;
  insights: number;
}

export interface ApplyInboxRetentionVariables {
  organizationId: UUIDString;
  ids: UUIDString[];
  before: TimestampString;
}

export interface ApplyProviderCallStatusData {
  call?: CallRecord_Key | null;
  automationEvent_insert: AutomationEvent_Key;
}

export interface ApplyProviderCallStatusVariables {
  organizationId: UUIDString;
  id: UUIDString;
  expectedStatus: CallStatus;
  callStatus: CallStatus;
  answeredAt?: TimestampString | null;
  endedAt?: TimestampString | null;
  durationSeconds?: number | null;
  emitFinal?: boolean;
  finalTrigger?: string;
}

export interface ApplySimulatedCallStatusData {
  call?: CallRecord_Key | null;
  automationEvent_insert: AutomationEvent_Key;
}

export interface ApplySimulatedCallStatusVariables {
  organizationId: UUIDString;
  id: UUIDString;
  actorUid: string;
  expectedStatus: CallStatus;
  callStatus: CallStatus;
  answeredAt?: TimestampString | null;
  endedAt?: TimestampString | null;
  durationSeconds?: number | null;
  outcome?: CallOutcome | null;
  emitFinal: boolean;
  finalTrigger: string;
}

export interface AssignInboxConversationData {
  conversation?: InboxConversation_Key | null;
  inboxAssignmentHistory_insert: InboxAssignmentHistory_Key;
  auditLog_insert: AuditLog_Key;
  notification: InAppNotification_Key;
  automationEvent_insert: AutomationEvent_Key;
}

export interface AssignInboxConversationVariables {
  organizationId: UUIDString;
  id: UUIDString;
  expectedRevision: number;
  hasTarget: boolean;
  toMembershipId?: UUIDString | null;
  reason?: string | null;
  historyId: UUIDString;
  notify: boolean;
  notificationId: UUIDString;
}

export interface AttestLiveCallingData {
  settings?: CommunicationSettings_Key | null;
  auditLog_insert: AuditLog_Key;
}

export interface AttestLiveCallingVariables {
  organizationId: UUIDString;
  version: string;
}

export interface AuditLog_Key {
  organizationId: UUIDString;
  id: UUIDString;
  __typename?: 'AuditLog_Key';
}

export interface AutomationApproval_Key {
  organizationId: UUIDString;
  id: UUIDString;
  __typename?: 'AutomationApproval_Key';
}

export interface AutomationConversationStateData {
  conversation?: {
    id: UUIDString;
    assignedMembershipId?: UUIDString | null;
    status: InboxConversationStatus;
  };
}

export interface AutomationConversationStateVariables {
  organizationId: UUIDString;
  id: UUIDString;
}

export interface AutomationEvent_Key {
  organizationId: UUIDString;
  id: UUIDString;
  __typename?: 'AutomationEvent_Key';
}

export interface AutomationExecutionStep_Key {
  organizationId: UUIDString;
  id: UUIDString;
  __typename?: 'AutomationExecutionStep_Key';
}

export interface AutomationExecution_Key {
  organizationId: UUIDString;
  id: UUIDString;
  __typename?: 'AutomationExecution_Key';
}

export interface AutomationOrgState_Key {
  organizationId: UUIDString;
  __typename?: 'AutomationOrgState_Key';
}

export interface AutomationWorkflowVersion_Key {
  organizationId: UUIDString;
  id: UUIDString;
  __typename?: 'AutomationWorkflowVersion_Key';
}

export interface AutomationWorkflow_Key {
  organizationId: UUIDString;
  id: UUIDString;
  __typename?: 'AutomationWorkflow_Key';
}

export interface Branch_Key {
  organizationId: UUIDString;
  id: UUIDString;
  __typename?: 'Branch_Key';
}

export interface Building_Key {
  organizationId: UUIDString;
  id: UUIDString;
  __typename?: 'Building_Key';
}

export interface CallAiSuggestion_Key {
  organizationId: UUIDString;
  id: UUIDString;
  __typename?: 'CallAiSuggestion_Key';
}

export interface CallAiSummary_Key {
  organizationId: UUIDString;
  id: UUIDString;
  __typename?: 'CallAiSummary_Key';
}

export interface CallComplianceFactsData {
  settings?: {
    revision: number;
    timeZone: string;
    callingWindowStart: string;
    callingWindowEnd: string;
    maxCallsPerContactPerDay: number;
    telemarketingEnabled: boolean;
    telemarketingApprovalReference?: string | null;
    marketingWindowStart: string;
    marketingWindowEnd: string;
    marketingMaxCallsPerDay: number;
    marketingMaxUnansweredPerWeek: number;
    allowedCallingCodes: string;
    liveCallingAttestedAt?: TimestampString | null;
    liveCallingAttestationVersion?: string | null;
    maxConcurrentLiveCalls: number;
    maxLiveCallsPerAgentPerDay: number;
    recordingEnabled: boolean;
    retentionDays: number;
    aiAnalysisEnabled: boolean;
  };
  suppressions: ({
    id: UUIDString;
    scope: CommunicationSuppressionScope;
    reason: CommunicationSuppressionReason;
    createdAt: TimestampString;
  })[];
  calls: ({
    id: UUIDString;
    startedAt: TimestampString;
    direction: CallDirection;
    callType: CallType;
    callStatus: CallStatus;
    answeredAt?: TimestampString | null;
  })[];
}

export interface CallComplianceFactsVariables {
  organizationId: UUIDString;
  number: string;
  since: TimestampString;
}

export interface CallConsentEvidence_Key {
  organizationId: UUIDString;
  id: UUIDString;
  __typename?: 'CallConsentEvidence_Key';
}

export interface CallMediaToRemoveData {
  expiredRecordings: ({
    organizationId: UUIDString;
    id: UUIDString;
    storagePath: string;
  } & CallRecording_Key)[];
  expiredTranscripts: ({
    organizationId: UUIDString;
    id: UUIDString;
    transcriptReference: string;
  } & CallTranscript_Key)[];
  deletedRecordings: ({
    organizationId: UUIDString;
    id: UUIDString;
    storagePath: string;
  } & CallRecording_Key)[];
  deletedTranscripts: ({
    organizationId: UUIDString;
    id: UUIDString;
    transcriptReference: string;
  } & CallTranscript_Key)[];
}

export interface CallMediaToRemoveVariables {
  now: TimestampString;
  limit: number;
}

export interface CallProviderEvent_Key {
  organizationId: UUIDString;
  id: UUIDString;
  __typename?: 'CallProviderEvent_Key';
}

export interface CallRecord_Key {
  organizationId: UUIDString;
  id: UUIDString;
  __typename?: 'CallRecord_Key';
}

export interface CallRecording_Key {
  organizationId: UUIDString;
  id: UUIDString;
  __typename?: 'CallRecording_Key';
}

export interface CallTranscript_Key {
  organizationId: UUIDString;
  id: UUIDString;
  __typename?: 'CallTranscript_Key';
}

export interface CancelInboxReplyData {
  outboundMessageJob_update?: OutboundMessageJob_Key | null;
  auditLog_insert: AuditLog_Key;
}

export interface CancelInboxReplyVariables {
  organizationId: UUIDString;
  id: UUIDString;
  expectedRevision: number;
}

export interface ChannelAccessTokenData {
  credential?: {
    tokenCiphertext: string;
    tokenKeyId: string;
  };
}

export interface ChannelAccessTokenVariables {
  organizationId: UUIDString;
  id: UUIDString;
}

export interface ChannelAccountInUseData {
  connections: ({
    organizationId: UUIDString;
    id: UUIDString;
  } & ChannelConnection_Key)[];
}

export interface ChannelAccountInUseVariables {
  provider: ChannelProvider;
  externalAccountReference: string;
}

export interface ChannelConnectionForCheckData {
  admin?: {
    id: UUIDString;
  };
  connection?: {
    id: UUIDString;
    provider: ChannelProvider;
    connectionStatus: ChannelConnectionStatus;
    externalAccountReference?: string | null;
    businessAccountReference?: string | null;
    credentialReference?: string | null;
    accessTokenReference?: string | null;
    accessTokenStoredAt?: TimestampString | null;
    sendingEnabled: boolean;
    liveSending: boolean;
    verifiedAt?: TimestampString | null;
    revision: number;
  };
}

export interface ChannelConnectionForCheckVariables {
  organizationId: UUIDString;
  id: UUIDString;
  actorUid: string;
}

export interface ChannelConnection_Key {
  organizationId: UUIDString;
  id: UUIDString;
  __typename?: 'ChannelConnection_Key';
}

export interface ChannelCredential_Key {
  organizationId: UUIDString;
  channelConnectionId: UUIDString;
  __typename?: 'ChannelCredential_Key';
}

export interface ClaimInboxMediaFetchData {
  inboxAttachment_update?: InboxAttachment_Key | null;
}

export interface ClaimInboxMediaFetchVariables {
  organizationId: UUIDString;
  id: UUIDString;
  expectedAttempts: number;
  nextAttemptAt: TimestampString;
}

export interface ClaimMailboxSyncData {
  inboxMailboxAccount_update?: InboxMailboxAccount_Key | null;
}

export interface ClaimMailboxSyncVariables {
  organizationId: UUIDString;
  id: UUIDString;
  leaseId: UUIDString;
  now: TimestampString;
  leaseUntil: TimestampString;
}

export interface CommunicationDashboardData {
  me?: {
    id: UUIDString;
    role: MembershipRole;
  };
  calls: ({
    id: UUIDString;
    leadId?: UUIDString | null;
    direction: CallDirection;
    source: CallSource;
    callType: CallType;
    callStatus: CallStatus;
    outcome?: CallOutcome | null;
    counterpartyNumber?: string | null;
    startedAt: TimestampString;
    answeredAt?: TimestampString | null;
    durationSeconds: number;
    followUpRequired: boolean;
    followUpId?: UUIDString | null;
    agentMembershipId: UUIDString;
    agentMembership: {
      id: UUIDString;
      email: string;
      userProfile?: {
        displayName: string;
      };
    };
    lead?: {
      id: UUIDString;
      fullName: string;
    };
    contact?: {
      id: UUIDString;
      fullName: string;
    };
  })[];
  viewings: ({
    id: UUIDString;
    scheduledAt: TimestampString;
    leadId: UUIDString;
    lead: {
      fullName: string;
    };
  })[];
  followUps: ({
    id: UUIDString;
    title: string;
    dueAt: TimestampString;
    leadId: UUIDString;
    lead: {
      fullName: string;
    };
    assignedUser: {
      email: string;
      userProfile?: {
        displayName: string;
      };
    };
  })[];
}

export interface CommunicationDashboardVariables {
  organizationId: UUIDString;
  since: TimestampString;
  now: TimestampString;
  until: TimestampString;
}

export interface CommunicationMeetingAttendee_Key {
  organizationId: UUIDString;
  id: UUIDString;
  __typename?: 'CommunicationMeetingAttendee_Key';
}

export interface CommunicationMeeting_Key {
  organizationId: UUIDString;
  id: UUIDString;
  __typename?: 'CommunicationMeeting_Key';
}

export interface CommunicationPhoneLine_Key {
  organizationId: UUIDString;
  id: UUIDString;
  __typename?: 'CommunicationPhoneLine_Key';
}

export interface CommunicationProviderConnection_Key {
  organizationId: UUIDString;
  id: UUIDString;
  __typename?: 'CommunicationProviderConnection_Key';
}

export interface CommunicationReportData {
  me?: {
    id: UUIDString;
    role: MembershipRole;
  };
  calls: ({
    direction: CallDirection;
    source: CallSource;
    callStatus: CallStatus;
    answeredAt?: TimestampString | null;
    outcome?: CallOutcome | null;
    durationSeconds: number;
    agentMembershipId: UUIDString;
    agentMembership: {
      email: string;
      userProfile?: {
        displayName: string;
      };
    };
  })[];
  meetings: ({
    status: MeetingStatus;
    organizerMembershipId: UUIDString;
    organizerMembership: {
      email: string;
      userProfile?: {
        displayName: string;
      };
    };
    lead?: {
      communicationSimulationRecord_on_lead?: {
        id: UUIDString;
      };
    };
  })[];
  agents: ({
    id: UUIDString;
    email: string;
    userProfile?: {
      displayName: string;
    };
  })[];
}

export interface CommunicationReportVariables {
  organizationId: UUIDString;
  from: TimestampString;
  to: TimestampString;
  agentMembershipId?: UUIDString | null;
}

export interface CommunicationSettings_Key {
  organizationId: UUIDString;
  __typename?: 'CommunicationSettings_Key';
}

export interface CommunicationSimulationRecord_Key {
  organizationId: UUIDString;
  id: UUIDString;
  __typename?: 'CommunicationSimulationRecord_Key';
}

export interface CommunicationSimulationStateData {
  admin?: {
    id: UUIDString;
  };
  records: ({
    id: UUIDString;
    leadId: UUIDString;
    label: string;
    createdAt: TimestampString;
    lead: {
      id: UUIDString;
      fullName: string;
      contactId?: UUIDString | null;
      phone?: string | null;
      email?: string | null;
    };
  })[];
  calls: ({
    id: UUIDString;
    leadId?: UUIDString | null;
    direction: CallDirection;
    callType: CallType;
    callStatus: CallStatus;
    outcome?: CallOutcome | null;
    startedAt: TimestampString;
    answeredAt?: TimestampString | null;
    durationSeconds: number;
    revision: number;
    createdAt: TimestampString;
    lead?: {
      fullName: string;
    };
  })[];
  archived: ({
    id: UUIDString;
  })[];
}

export interface CommunicationSimulationStateVariables {
  organizationId: UUIDString;
  actorUid: string;
}

export interface CommunicationSuppression_Key {
  organizationId: UUIDString;
  id: UUIDString;
  __typename?: 'CommunicationSuppression_Key';
}

export interface CompleteInboxEventData {
  inboxEvent_update?: InboxEvent_Key | null;
}

export interface CompleteInboxEventVariables {
  organizationId: UUIDString;
  id: UUIDString;
  status: InboxEventStatus;
  errorCode?: string | null;
  conversationId?: UUIDString | null;
  messageId?: UUIDString | null;
}

export interface CompleteMeetingData {
  meeting?: CommunicationMeeting_Key | null;
  activity: Activity_Key;
  auditLog_insert: AuditLog_Key;
  automationEvent_insert: AutomationEvent_Key;
}

export interface CompleteMeetingVariables {
  organizationId: UUIDString;
  id: UUIDString;
  expectedRevision: number;
  leadId?: UUIDString | null;
  hasLead: boolean;
  notes?: string | null;
}

export interface ConfirmPhoneLineRegistrationData {
  line?: CommunicationPhoneLine_Key | null;
  auditLog_insert: AuditLog_Key;
}

export interface ConfirmPhoneLineRegistrationVariables {
  organizationId: UUIDString;
  id: UUIDString;
  expectedRevision: number;
}

export interface Contact_Key {
  organizationId: UUIDString;
  id: UUIDString;
  __typename?: 'Contact_Key';
}

export interface CreateCallAiSuggestionData {
  callAiSuggestion_insert: CallAiSuggestion_Key;
}

export interface CreateCallAiSuggestionVariables {
  organizationId: UUIDString;
  id: UUIDString;
  summaryId: UUIDString;
  callId: UUIDString;
  kind: string;
  title: string;
  detail: string;
  basis: string;
  confidence: string;
  verified: boolean;
}

export interface CreateCallAiSummaryData {
  summary: CallAiSummary_Key;
  auditLog_insert: AuditLog_Key;
  automationEvent_insert: AutomationEvent_Key;
}

export interface CreateCallAiSummaryVariables {
  organizationId: UUIDString;
  id: UUIDString;
  callId: UUIDString;
  actorUid: string;
  sourceKind: string;
  hasTranscript: boolean;
  transcriptId?: UUIDString | null;
  summaryJson: string;
  overallConfidence: string;
  unverifiedCount: number;
  model: string;
  promptVersion: string;
  originalEventId?: UUIDString | null;
  parentExecutionId?: UUIDString | null;
  originWorkflowId?: UUIDString | null;
  chainDepth?: number;
}

export interface CreateCallRecordingData {
  recording: CallRecording_Key;
  auditLog_insert: AuditLog_Key;
}

export interface CreateCallRecordingVariables {
  organizationId: UUIDString;
  id: UUIDString;
  callId: UUIDString;
  consentEvidenceId: UUIDString;
  actorUid: string;
  source: string;
  storagePath: string;
  contentType: string;
  byteSize: number;
  durationSeconds: number;
  recordedAt: TimestampString;
}

export interface CreateCallTranscriptData {
  transcript: CallTranscript_Key;
  auditLog_insert: AuditLog_Key;
}

export interface CreateCallTranscriptVariables {
  organizationId: UUIDString;
  id: UUIDString;
  callId: UUIDString;
  consentEvidenceId: UUIDString;
  actorUid: string;
  source: TranscriptSource;
  sourceName?: string | null;
  language: string;
  transcriptReference: string;
  segmentCount: number;
  hasTimestamps: boolean;
  generatedAt: TimestampString;
}

export interface CreateChannelConnectionData {
  connection: ChannelConnection_Key;
  auditLog_insert: AuditLog_Key;
}

export interface CreateChannelConnectionVariables {
  organizationId: UUIDString;
  id: UUIDString;
  provider: ChannelProvider;
  displayName: string;
  externalAccountReference?: string | null;
  credentialReference?: string | null;
  accessTokenReference?: string | null;
  businessAccountReference?: string | null;
}

export interface CreateClaudeReplyFromInsightData {
  outboundMessageJob_insert: OutboundMessageJob_Key;
  inboxAiInsight_update?: InboxAiInsight_Key | null;
  auditLog_insert: AuditLog_Key;
}

export interface CreateClaudeReplyFromInsightVariables {
  organizationId: UUIDString;
  insightId: UUIDString;
  conversationId: UUIDString;
  jobId: UUIDString;
  actorUid: string;
  content: string;
  edited: boolean;
}

export interface CreateCommunicationPhoneLineData {
  line: CommunicationPhoneLine_Key;
  auditLog_insert: AuditLog_Key;
}

export interface CreateCommunicationPhoneLineVariables {
  organizationId: UUIDString;
  id: UUIDString;
  providerConnectionId: UUIDString;
  phoneNumber: string;
  displayName?: string | null;
  hasAssignee: boolean;
  assignedMembershipId?: UUIDString | null;
  forwardToNumber?: string | null;
  linePurpose: PhoneLinePurpose;
}

export interface CreateCommunicationProviderData {
  connection: CommunicationProviderConnection_Key;
  auditLog_insert: AuditLog_Key;
}

export interface CreateCommunicationProviderVariables {
  organizationId: UUIDString;
  id: UUIDString;
  providerType: CommunicationProviderType;
  displayName: string;
  secretRef?: string | null;
  externalAccountId?: string | null;
}

export interface CreateCommunicationSettingsData {
  settings: CommunicationSettings_Key;
  auditLog_insert: AuditLog_Key;
}

export interface CreateCommunicationSettingsVariables {
  organizationId: UUIDString;
  timeZone: string;
  callingWindowStart: string;
  callingWindowEnd: string;
  maxCallsPerContactPerDay: number;
  telemarketingEnabled: boolean;
  telemarketingApprovalReference?: string | null;
  marketingWindowStart: string;
  marketingWindowEnd: string;
  marketingMaxCallsPerDay: number;
  marketingMaxUnansweredPerWeek: number;
  allowedCallingCodes: string;
  maxConcurrentLiveCalls: number;
  maxLiveCallsPerAgentPerDay: number;
  recordingEnabled: boolean;
  recordingNoticeText?: string | null;
  recordingLegalBasis?: string | null;
  retentionDays: number;
  aiAnalysisEnabled: boolean;
}

export interface CreateInboxAttachmentData {
  inboxAttachment_insert: InboxAttachment_Key;
}

export interface CreateInboxAttachmentVariables {
  organizationId: UUIDString;
  id: UUIDString;
  messageId: UUIDString;
  conversationId: UUIDString;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  storagePath?: string | null;
  providerMediaId?: string | null;
  scanStatus: InboxAttachmentScan;
}

export interface CreateInboxConversationWithMessageData {
  conversation: InboxConversation_Key;
  message: InboxMessage_Key;
  created: AutomationEvent_Key;
  received: AutomationEvent_Key;
  suppression: CommunicationSuppression_Key;
  emailOptOut: InboxEmailOptOut_Key;
}

export interface CreateInboxConversationWithMessageVariables {
  organizationId: UUIDString;
  conversationId: UUIDString;
  channelConnectionId?: UUIDString | null;
  channel: InboxChannel;
  externalThreadId: string;
  customerIdentity: string;
  customerName?: string | null;
  subject?: string | null;
  contactId?: UUIDString | null;
  leadId?: UUIDString | null;
  assignedMembershipId?: UUIDString | null;
  messageId: UUIDString;
  externalMessageId: string;
  messageType: InboxMessageType;
  content?: string | null;
  senderIdentity?: string | null;
  recipientIdentity?: string | null;
  providerTimestamp?: TimestampString | null;
  internetMessageId?: string | null;
  preview?: string | null;
  simulated: boolean;
  optedOut: boolean;
  suppressNumber?: boolean;
  suppressEmail?: boolean;
  optOutId?: UUIDString | null;
  optOutIdentity?: string;
}

export interface CreateInboxReplyDraftData {
  outboundMessageJob_insert: OutboundMessageJob_Key;
  auditLog_insert: AuditLog_Key;
}

export interface CreateInboxReplyDraftVariables {
  organizationId: UUIDString;
  id: UUIDString;
  conversationId: UUIDString;
  content: string;
  templateName?: string | null;
  templateParamsJson?: string | null;
}

export interface CreateInboxSimulatorChannelData {
  channelConnection_insert: ChannelConnection_Key;
  auditLog_insert: AuditLog_Key;
}

export interface CreateInboxSimulatorChannelVariables {
  organizationId: UUIDString;
  id: UUIDString;
  actorUid: string;
}

export interface CreateIncomingProviderCallData {
  call: CallRecord_Key;
  auditLog_insert: AuditLog_Key;
  automationEvent_insert: AutomationEvent_Key;
}

export interface CreateIncomingProviderCallVariables {
  organizationId: UUIDString;
  id: UUIDString;
  providerConnectionId: UUIDString;
  providerCallId: string;
  phoneLineId: UUIDString;
  agentMembershipId: UUIDString;
  actorUid: string;
  callStatus: CallStatus;
  callerNumber?: string | null;
  recipientNumber: string;
  counterpartyNumber?: string | null;
  contactId?: UUIDString | null;
  leadId?: UUIDString | null;
  startedAt: TimestampString;
}

export interface CreateMeetingData {
  meeting: CommunicationMeeting_Key;
  activity: Activity_Key;
  auditLog_insert: AuditLog_Key;
  automationEvent_insert: AutomationEvent_Key;
}

export interface CreateMeetingVariables {
  organizationId: UUIDString;
  id: UUIDString;
  hasLead: boolean;
  leadId?: UUIDString | null;
  hasContact: boolean;
  contactId?: UUIDString | null;
  title: string;
  provider: MeetingProvider;
  meetingUrl?: string | null;
  location?: string | null;
  startsAt: TimestampString;
  endsAt: TimestampString;
  agenda?: string | null;
}

export interface CreateSimulatedCallData {
  call: CallRecord_Key;
  auditLog_insert: AuditLog_Key;
  automationEvent_insert: AutomationEvent_Key;
}

export interface CreateSimulatedCallVariables {
  organizationId: UUIDString;
  id: UUIDString;
  actorUid: string;
  leadId: UUIDString;
  direction: CallDirection;
  callType: CallType;
  counterpartyNumber?: string | null;
  startedAt: TimestampString;
}

export interface CreateVoiceAssistantConfigData {
  config: VoiceAssistantConfig_Key;
  auditLog_insert: AuditLog_Key;
}

export interface CreateVoiceAssistantConfigVariables {
  organizationId: UUIDString;
  status: VoiceAssistantStatus;
  assistantName: string;
  disclosureText: string;
  greeting: string;
  questionsJson: string;
  handoffMessage: string;
  projectIdsJson: string;
  listingIdsJson: string;
  maxTurns: number;
  maxSessionMinutes: number;
  maxReplyTokens: number;
}

export interface DecideCallAiSuggestionData {
  suggestion?: CallAiSuggestion_Key | null;
  auditLog_insert: AuditLog_Key;
}

export interface DecideCallAiSuggestionVariables {
  organizationId: UUIDString;
  id: UUIDString;
  status: CallSuggestionStatus;
  resultType?: string | null;
  resultId?: UUIDString | null;
}

export interface DecideInboxReplyData {
  approved?: OutboundMessageJob_Key | null;
  rejected?: OutboundMessageJob_Key | null;
  auditLog_insert: AuditLog_Key;
}

export interface DecideInboxReplyVariables {
  organizationId: UUIDString;
  id: UUIDString;
  expectedRevision: number;
  approve: boolean;
  note?: string | null;
}

export interface DecideMeetingSuggestionData {
  meeting?: CommunicationMeeting_Key | null;
  auditLog_insert: AuditLog_Key;
}

export interface DecideMeetingSuggestionVariables {
  organizationId: UUIDString;
  id: UUIDString;
  expectedRevision: number;
  suggestionDecisionsJson: string;
}

export interface DeleteCallRecordingData {
  recording?: CallRecording_Key | null;
  auditLog_insert: AuditLog_Key;
}

export interface DeleteCallRecordingVariables {
  organizationId: UUIDString;
  id: UUIDString;
}

export interface DeleteCallTranscriptData {
  transcript?: CallTranscript_Key | null;
  summaries: number;
  auditLog_insert: AuditLog_Key;
}

export interface DeleteCallTranscriptVariables {
  organizationId: UUIDString;
  id: UUIDString;
}

export interface DeleteInboxReplyData {
  outboundMessageJob_deleteMany: number;
  auditLog_insert: AuditLog_Key;
}

export interface DeleteInboxReplyVariables {
  organizationId: UUIDString;
  id: UUIDString;
  expectedRevision: number;
}

export interface DeletedCallMediaFileData {
  recording?: {
    storagePath: string;
    status: CallMediaStatus;
  };
  transcript?: {
    transcriptReference: string;
    status: CallMediaStatus;
  };
}

export interface DeletedCallMediaFileVariables {
  organizationId: UUIDString;
  id: UUIDString;
}

export interface DemoFixtureRecord_Key {
  organizationId: UUIDString;
  fixtureKey: string;
  __typename?: 'DemoFixtureRecord_Key';
}

export interface Developer_Key {
  organizationId: UUIDString;
  id: UUIDString;
  __typename?: 'Developer_Key';
}

export interface DialFactsData {
  lines: ({
    id: UUIDString;
    phoneNumber: string;
    status: PhoneLineStatus;
    registrationConfirmedAt?: TimestampString | null;
    forwardToNumber?: string | null;
    linePurpose: PhoneLinePurpose;
    providerConnection: {
      id: UUIDString;
      providerType: CommunicationProviderType;
      connectionStatus: CommunicationConnectionStatus;
      secretRef?: string | null;
      externalAccountId?: string | null;
    };
  })[];
  activeCompany: ({
    count: number;
  })[];
  activeAgent: ({
    count: number;
  })[];
  agentToday: ({
    count: number;
  })[];
}

export interface DialFactsVariables {
  organizationId: UUIDString;
  agentMembershipId: UUIDString;
  activeSince: TimestampString;
  daySince: TimestampString;
}

export interface DisconnectMailboxData {
  channelConnection_update?: ChannelConnection_Key | null;
  inboxMailboxAccount_updateMany: number;
  auditLog_insert: AuditLog_Key;
}

export interface DisconnectMailboxVariables {
  organizationId: UUIDString;
  id: UUIDString;
  actorUid: string;
  expectedRevision: number;
}

export interface DistributionCursor_Key {
  organizationId: UUIDString;
  ruleId: UUIDString;
  __typename?: 'DistributionCursor_Key';
}

export interface DueMailboxesData {
  accounts: ({
    organizationId: UUIDString;
    id: UUIDString;
    channelConnectionId: UUIDString;
    historyId?: string | null;
    syncState: InboxMailboxSyncState;
    backfilled: boolean;
    failures: number;
    tokenCiphertext?: string | null;
    tokenKeyId?: string | null;
    channelConnection: {
      provider: ChannelProvider;
      connectionStatus: ChannelConnectionStatus;
      externalAccountReference?: string | null;
      ownerMembershipId?: UUIDString | null;
      ownerMembership?: {
        status: MembershipStatus;
      };
    };
  } & InboxMailboxAccount_Key)[];
}

export interface DueMailboxesVariables {
  now: TimestampString;
  limit: number;
}

export interface EmailReplyThreadData {
  messages: ({
    internetMessageId?: string | null;
    externalMessageId: string;
    direction: InboxDirection;
  })[];
}

export interface EmailReplyThreadVariables {
  organizationId: UUIDString;
  conversationId: UUIDString;
}

export interface ExpireCallRecordingData {
  recording?: CallRecording_Key | null;
}

export interface ExpireCallRecordingVariables {
  organizationId: UUIDString;
  id: UUIDString;
}

export interface ExpireCallTranscriptData {
  transcript?: CallTranscript_Key | null;
  summaries: number;
}

export interface ExpireCallTranscriptVariables {
  organizationId: UUIDString;
  id: UUIDString;
}

export interface FailInboxEventData {
  inboxEvent_update?: InboxEvent_Key | null;
}

export interface FailInboxEventVariables {
  organizationId: UUIDString;
  id: UUIDString;
  expectedAttempts: number;
  errorCode: string;
  nextAttemptAt: TimestampString;
}

export interface FailInboxMediaData {
  retry?: InboxAttachment_Key | null;
  final?: InboxAttachment_Key | null;
}

export interface FailInboxMediaVariables {
  organizationId: UUIDString;
  id: UUIDString;
  error: string;
  final: boolean;
}

export interface FailInboxReplyData {
  job?: OutboundMessageJob_Key | null;
  message?: InboxMessage_Key | null;
  failed: AutomationEvent_Key;
  auditLog_insert: AuditLog_Key;
}

export interface FailInboxReplyVariables {
  organizationId: UUIDString;
  id: UUIDString;
  conversationId: UUIDString;
  messageId: UUIDString;
  reason: string;
  actorUid: string;
  simulated?: boolean;
}

export interface FailMailboxSyncData {
  account?: InboxMailboxAccount_Key | null;
  connection?: ChannelConnection_Key | null;
}

export interface FailMailboxSyncVariables {
  organizationId: UUIDString;
  id: UUIDString;
  leaseId: UUIDString;
  errorCode: string;
  nextSyncAt: TimestampString;
  needsReconnect: boolean;
}

export interface FeedGenerationJob_Key {
  organizationId: UUIDString;
  id: UUIDString;
  __typename?: 'FeedGenerationJob_Key';
}

export interface FindInboxConversationData {
  connected: ({
    id: UUIDString;
    status: InboxConversationStatus;
    revision: number;
    leadId?: UUIDString | null;
    contactId?: UUIDString | null;
    assignedMembershipId?: UUIDString | null;
    optedOut: boolean;
  })[];
  internal: ({
    id: UUIDString;
    status: InboxConversationStatus;
    revision: number;
    leadId?: UUIDString | null;
    contactId?: UUIDString | null;
    assignedMembershipId?: UUIDString | null;
    optedOut: boolean;
  })[];
}

export interface FindInboxConversationVariables {
  organizationId: UUIDString;
  hasConnection: boolean;
  channelConnectionId?: UUIDString | null;
  externalThreadId: string;
}

export interface FinishMailboxSyncData {
  account?: InboxMailboxAccount_Key | null;
  connection?: ChannelConnection_Key | null;
}

export interface FinishMailboxSyncVariables {
  organizationId: UUIDString;
  id: UUIDString;
  leaseId: UUIDString;
  historyId: string;
  backfilled: boolean;
  nextSyncAt: TimestampString;
  imported: boolean;
}

export interface FloorPlan_Key {
  organizationId: UUIDString;
  id: UUIDString;
  __typename?: 'FloorPlan_Key';
}

export interface GetCallAiSuggestionData {
  me?: {
    id: UUIDString;
  };
  suggestion?: {
    id: UUIDString;
    kind: string;
    title: string;
    detail: string;
    status: CallSuggestionStatus;
    callId: UUIDString;
    call: {
      leadId?: UUIDString | null;
    };
  };
}

export interface GetCallAiSuggestionVariables {
  organizationId: UUIDString;
  id: UUIDString;
}

export interface GetCallMediaData {
  me?: {
    id: UUIDString;
    role: MembershipRole;
  };
  call?: {
    id: UUIDString;
    callStatus: CallStatus;
    answeredAt?: TimestampString | null;
    durationSeconds: number;
    agentMembershipId: UUIDString;
  };
  consents: ({
    id: UUIDString;
    status: CallConsentStatus;
    method: string;
    purpose: string;
    legalBasis: string;
    noticeText: string;
    note?: string | null;
    capturedAt: TimestampString;
    capturedBy: {
      displayName: string;
    };
    withdrawnAt?: TimestampString | null;
    withdrawnBy?: {
      displayName: string;
    };
    withdrawalNote?: string | null;
  })[];
  recordings: ({
    id: UUIDString;
    source: string;
    contentType: string;
    byteSize: number;
    durationSeconds: number;
    recordedAt: TimestampString;
    retentionUntil: TimestampString;
    createdAt: TimestampString;
    createdBy: {
      displayName: string;
    };
    consentEvidenceId: UUIDString;
  })[];
  transcripts: ({
    id: UUIDString;
    source: TranscriptSource;
    sourceName?: string | null;
    language: string;
    segmentCount: number;
    hasTimestamps: boolean;
    generatedAt: TimestampString;
    retentionUntil: TimestampString;
    createdAt: TimestampString;
    createdBy: {
      displayName: string;
    };
    consentEvidenceId: UUIDString;
  })[];
  settings?: {
    recordingEnabled: boolean;
    recordingNoticeText?: string | null;
    recordingLegalBasis?: string | null;
    retentionDays: number;
    aiAnalysisEnabled: boolean;
  };
}

export interface GetCallMediaVariables {
  organizationId: UUIDString;
  callId: UUIDString;
}

export interface GetCallRecordData {
  me?: {
    id: UUIDString;
    role: MembershipRole;
  };
  call?: {
    id: UUIDString;
    leadId?: UUIDString | null;
    contactId?: UUIDString | null;
    agentMembershipId: UUIDString;
    direction: CallDirection;
    source: CallSource;
    callType: CallType;
    callStatus: CallStatus;
    outcome?: CallOutcome | null;
    callerNumber?: string | null;
    recipientNumber?: string | null;
    counterpartyNumber?: string | null;
    startedAt: TimestampString;
    answeredAt?: TimestampString | null;
    endedAt?: TimestampString | null;
    durationSeconds: number;
    notes?: string | null;
    followUpRequired: boolean;
    followUpId?: UUIDString | null;
    viewingId?: UUIDString | null;
    revision: number;
    createdAt: TimestampString;
    updatedAt: TimestampString;
    lead?: {
      id: UUIDString;
      fullName: string;
      status: LeadStatus;
      assignedMembershipId?: UUIDString | null;
    };
    contact?: {
      id: UUIDString;
      fullName: string;
    };
    agentMembership: {
      id: UUIDString;
      email: string;
      userProfile?: {
        displayName: string;
      };
    };
    followUp?: {
      id: UUIDString;
      title: string;
      dueAt: TimestampString;
      status: LeadFollowUpStatus;
    };
    viewing?: {
      id: UUIDString;
      scheduledAt: TimestampString;
      status: LeadPropertyViewingStatus;
    };
    providerConnectionId?: UUIDString | null;
    phoneLineId?: UUIDString | null;
    phoneLine?: {
      phoneNumber: string;
      displayName?: string | null;
    };
    providerConnection?: {
      providerType: CommunicationProviderType;
      displayName: string;
    };
  };
  events: ({
    id: UUIDString;
    eventType: string;
    callStatus?: CallStatus | null;
    result: string;
    occurredAt?: TimestampString | null;
    receivedAt: TimestampString;
  })[];
}

export interface GetCallRecordVariables {
  organizationId: UUIDString;
  id: UUIDString;
}

export interface GetCallRecordingFileData {
  me?: {
    id: UUIDString;
  };
  recording?: {
    id: UUIDString;
    callId: UUIDString;
    storagePath: string;
    contentType: string;
    byteSize: number;
  };
}

export interface GetCallRecordingFileVariables {
  organizationId: UUIDString;
  id: UUIDString;
}

export interface GetCallTranscriptFileData {
  me?: {
    id: UUIDString;
  };
  transcript?: {
    id: UUIDString;
    callId: UUIDString;
    transcriptReference: string;
    language: string;
    source: TranscriptSource;
    sourceName?: string | null;
    segmentCount: number;
    hasTimestamps: boolean;
    generatedAt: TimestampString;
  };
}

export interface GetCallTranscriptFileVariables {
  organizationId: UUIDString;
  id: UUIDString;
}

export interface GetCommunicationSettingsData {
  me?: {
    id: UUIDString;
    role: MembershipRole;
  };
  settings?: {
    revision: number;
    timeZone: string;
    callingWindowStart: string;
    callingWindowEnd: string;
    maxCallsPerContactPerDay: number;
    telemarketingEnabled: boolean;
    telemarketingApprovalReference?: string | null;
    marketingWindowStart: string;
    marketingWindowEnd: string;
    marketingMaxCallsPerDay: number;
    marketingMaxUnansweredPerWeek: number;
    allowedCallingCodes: string;
    liveCallingAttestedAt?: TimestampString | null;
    liveCallingAttestationVersion?: string | null;
    liveCallingAttestedBy?: {
      displayName: string;
    };
    maxConcurrentLiveCalls: number;
    maxLiveCallsPerAgentPerDay: number;
    recordingEnabled: boolean;
    recordingNoticeText?: string | null;
    recordingLegalBasis?: string | null;
    retentionDays: number;
    aiAnalysisEnabled: boolean;
    updatedAt: TimestampString;
    updatedBy?: {
      displayName: string;
    };
  };
}

export interface GetCommunicationSettingsVariables {
  organizationId: UUIDString;
}

export interface GetInboxConversationData {
  me?: {
    id: UUIDString;
    role: MembershipRole;
  };
  conversation?: {
    id: UUIDString;
    channel: InboxChannel;
    externalThreadId: string;
    customerIdentity: string;
    customerName?: string | null;
    subject?: string | null;
    status: InboxConversationStatus;
    priority: InboxPriority;
    lastMessageAt: TimestampString;
    lastInboundAt?: TimestampString | null;
    lastOutboundAt?: TimestampString | null;
    lastMessagePreview?: string | null;
    unreadCount: number;
    optedOut: boolean;
    simulated: boolean;
    revision: number;
    createdAt: TimestampString;
    contactId?: UUIDString | null;
    leadId?: UUIDString | null;
    assignedMembershipId?: UUIDString | null;
    channelConnectionId?: UUIDString | null;
    contact?: {
      id: UUIDString;
      fullName: string;
      email?: string | null;
      phone?: string | null;
      normalizedEmail?: string | null;
      normalizedPhone?: string | null;
      normalizedAlternatePhone?: string | null;
    };
    lead?: {
      id: UUIDString;
      fullName: string;
      status: LeadStatus;
      assignedMembershipId?: UUIDString | null;
      archivedAt?: TimestampString | null;
      assignedMembership?: {
        userProfile?: {
          displayName: string;
        };
      };
    };
    assignedMembership?: {
      id: UUIDString;
      userProfile?: {
        displayName: string;
      };
    };
    channelConnection?: {
      id: UUIDString;
      provider: ChannelProvider;
      displayName: string;
      connectionStatus: ChannelConnectionStatus;
      sendingEnabled: boolean;
      liveSending: boolean;
      externalAccountReference?: string | null;
      ownerMembershipId?: UUIDString | null;
      ownerMembership?: {
        userProfileUid?: string | null;
        userProfile?: {
          displayName: string;
        };
      };
    };
    notes: ({
      id: UUIDString;
      body: string;
      createdAt: TimestampString;
      author: {
        displayName: string;
      };
    })[];
    assignments: ({
      id: UUIDString;
      fromMembershipId?: UUIDString | null;
      toMembershipId?: UUIDString | null;
      reason?: string | null;
      createdAt: TimestampString;
      changedBy?: {
        displayName: string;
      };
    })[];
  };
}

export interface GetInboxConversationVariables {
  organizationId: UUIDString;
  id: UUIDString;
}

export interface GetInboxMessageHtmlData {
  conversation?: {
    id: UUIDString;
    channel: InboxChannel;
    channelConnectionId?: UUIDString | null;
    channelConnection?: {
      provider: ChannelProvider;
    };
  };
  message?: {
    id: UUIDString;
    direction: InboxDirection;
    externalMessageId: string;
    contentHtml?: string | null;
    contentHtmlBytes?: number | null;
    contentRedactedAt?: TimestampString | null;
  };
}

export interface GetInboxMessageHtmlVariables {
  organizationId: UUIDString;
  conversationId: UUIDString;
  id: UUIDString;
}

export interface GetInboxSettingsData {
  me?: {
    id: UUIDString;
    role: MembershipRole;
  };
  settings?: {
    revision: number;
    approvalRequired: boolean;
    retentionDays: number;
    unansweredMinutes: number;
    aiEnabled: boolean;
    updatedAt: TimestampString;
  };
}

export interface GetInboxSettingsVariables {
  organizationId: UUIDString;
}

export interface GetMeetingData {
  me?: {
    id: UUIDString;
    role: MembershipRole;
  };
  meeting?: {
    id: UUIDString;
    title: string;
    provider: MeetingProvider;
    meetingUrl?: string | null;
    location?: string | null;
    startsAt: TimestampString;
    endsAt: TimestampString;
    agenda?: string | null;
    notes?: string | null;
    status: MeetingStatus;
    revision: number;
    leadId?: UUIDString | null;
    contactId?: UUIDString | null;
    organizerMembershipId: UUIDString;
    summaryJson?: string | null;
    summaryModel?: string | null;
    summarizedAt?: TimestampString | null;
    summarizedBy?: {
      displayName: string;
    };
    suggestionDecisionsJson?: string | null;
    createdAt: TimestampString;
    updatedAt: TimestampString;
    completedAt?: TimestampString | null;
    createdBy: {
      displayName: string;
    };
    lead?: {
      id: UUIDString;
      fullName: string;
      assignedMembershipId?: UUIDString | null;
    };
    contact?: {
      id: UUIDString;
      fullName: string;
    };
    organizerMembership: {
      id: UUIDString;
      userProfile?: {
        displayName: string;
      };
    };
    attendees: ({
      id: UUIDString;
      membershipId: UUIDString;
      membership: {
        userProfile?: {
          displayName: string;
        };
      };
    })[];
  };
  settings?: {
    aiAnalysisEnabled: boolean;
  };
}

export interface GetMeetingVariables {
  organizationId: UUIDString;
  id: UUIDString;
}

export interface GetVoiceAssistantData {
  admin?: {
    id: UUIDString;
  };
  config?: {
    revision: number;
    status: VoiceAssistantStatus;
    assistantName: string;
    disclosureText: string;
    greeting: string;
    questionsJson: string;
    handoffMessage: string;
    projectIdsJson: string;
    listingIdsJson: string;
    maxTurns: number;
    maxSessionMinutes: number;
    maxReplyTokens: number;
    updatedAt: TimestampString;
    updatedBy: {
      displayName: string;
    };
  };
  sessions: ({
    id: UUIDString;
    status: VoiceTestSessionStatus;
    callerTurns: number;
    handoffReason?: string | null;
    configRevision: number;
    createdAt: TimestampString;
    endedAt?: TimestampString | null;
    createdBy: {
      displayName: string;
    };
  })[];
}

export interface GetVoiceAssistantVariables {
  organizationId: UUIDString;
}

export interface GetVoiceTestSessionData {
  admin?: {
    id: UUIDString;
  };
  session?: {
    id: UUIDString;
    configRevision: number;
    status: VoiceTestSessionStatus;
    revision: number;
    factsJson: string;
    turnsJson: string;
    callerTurns: number;
    pendingTurnId?: UUIDString | null;
    pendingSince?: TimestampString | null;
    handoffReason?: string | null;
    viewingRequestJson?: string | null;
    inputTokens: number;
    outputTokens: number;
    createdByUid: string;
    createdAt: TimestampString;
    endedAt?: TimestampString | null;
    createdBy: {
      displayName: string;
    };
  };
  config?: {
    revision: number;
    status: VoiceAssistantStatus;
    assistantName: string;
    handoffMessage: string;
    questionsJson: string;
    maxTurns: number;
    maxSessionMinutes: number;
    maxReplyTokens: number;
  };
}

export interface GetVoiceTestSessionVariables {
  organizationId: UUIDString;
  id: UUIDString;
}

export interface InAppNotification_Key {
  organizationId: UUIDString;
  id: UUIDString;
  __typename?: 'InAppNotification_Key';
}

export interface InboxAiInsight_Key {
  organizationId: UUIDString;
  id: UUIDString;
  __typename?: 'InboxAiInsight_Key';
}

export interface InboxAssigneesData {
  me?: {
    id: UUIDString;
    role: MembershipRole;
  };
  members: ({
    id: UUIDString;
    role: MembershipRole;
    userProfile?: {
      displayName: string;
    };
  })[];
}

export interface InboxAssigneesVariables {
  organizationId: UUIDString;
}

export interface InboxAssignmentHistory_Key {
  organizationId: UUIDString;
  id: UUIDString;
  __typename?: 'InboxAssignmentHistory_Key';
}

export interface InboxAttachment_Key {
  organizationId: UUIDString;
  id: UUIDString;
  __typename?: 'InboxAttachment_Key';
}

export interface InboxContactRestrictionsData {
  numbers: ({
    id: UUIDString;
    scope: CommunicationSuppressionScope;
  })[];
  emails: ({
    id: UUIDString;
  })[];
}

export interface InboxContactRestrictionsVariables {
  organizationId: UUIDString;
  identity: string;
}

export interface InboxConversation_Key {
  organizationId: UUIDString;
  id: UUIDString;
  __typename?: 'InboxConversation_Key';
}

export interface InboxCountsData {
  me?: {
    id: UUIDString;
    role: MembershipRole;
  };
  unread: ({
    count: number;
  })[];
  mine: ({
    count: number;
  })[];
  unassigned: ({
    count: number;
  })[];
  needsMatching: ({
    count: number;
  })[];
  open: ({
    count: number;
  })[];
  pending: ({
    count: number;
  })[];
  resolved: ({
    count: number;
  })[];
}

export interface InboxCountsVariables {
  organizationId: UUIDString;
  simulated?: boolean | null;
}

export interface InboxCustomerContextData {
  conversation?: {
    id: UUIDString;
  };
  lead?: {
    id: UUIDString;
    fullName: string;
    status: LeadStatus;
    priority: LeadPriority;
    propertyInterest?: string | null;
    preferredLocation?: string | null;
    propertyType?: string | null;
    transactionType: TransactionType;
    bedroomPreference?: string | null;
    budgetMin?: number | null;
    budgetMax?: number | null;
    currency: string;
    archivedAt?: TimestampString | null;
    assignedMembership?: {
      id: UUIDString;
      userProfile?: {
        displayName: string;
      };
    };
    followUps: ({
      id: UUIDString;
      title: string;
      dueAt: TimestampString;
    })[];
    viewings: ({
      id: UUIDString;
      scheduledAt: TimestampString;
      status: LeadPropertyViewingStatus;
      property: {
        propertyReference: string;
        community?: string | null;
      };
    })[];
    interests: ({
      id: UUIDString;
      status: LeadPropertyInterestStatus;
      property: {
        propertyReference: string;
      };
    })[];
    calls: ({
      id: UUIDString;
      direction: CallDirection;
      callStatus: CallStatus;
      outcome?: CallOutcome | null;
      startedAt: TimestampString;
      durationSeconds: number;
      source: CallSource;
    })[];
    activities: ({
      id: UUIDString;
      kind: ActivityKind;
      note?: string | null;
      createdAt: TimestampString;
    })[];
  };
  contact?: {
    id: UUIDString;
    fullName: string;
    email?: string | null;
    phone?: string | null;
    preferredLanguage: string;
  };
  others: ({
    id: UUIDString;
    channel: InboxChannel;
    status: InboxConversationStatus;
    lastMessageAt: TimestampString;
    lastMessagePreview?: string | null;
  })[];
}

export interface InboxCustomerContextVariables {
  organizationId: UUIDString;
  conversationId: UUIDString;
  hasLead: boolean;
  leadId?: UUIDString | null;
  hasContact: boolean;
  contactId?: UUIDString | null;
}

export interface InboxEmailOptOut_Key {
  organizationId: UUIDString;
  id: UUIDString;
  __typename?: 'InboxEmailOptOut_Key';
}

export interface InboxEvent_Key {
  organizationId: UUIDString;
  id: UUIDString;
  __typename?: 'InboxEvent_Key';
}

export interface InboxInsightDraftData {
  insight?: {
    id: UUIDString;
    insightJson: string;
    draftJobId?: UUIDString | null;
  };
}

export interface InboxInsightDraftVariables {
  organizationId: UUIDString;
  conversationId: UUIDString;
  id: UUIDString;
}

export interface InboxLinkTargetData {
  lead?: {
    id: UUIDString;
    fullName: string;
    contact?: {
      id: UUIDString;
      fullName: string;
      normalizedEmail?: string | null;
      normalizedPhone?: string | null;
      normalizedAlternatePhone?: string | null;
    };
  };
  contact?: {
    id: UUIDString;
    fullName: string;
    normalizedEmail?: string | null;
    normalizedPhone?: string | null;
    normalizedAlternatePhone?: string | null;
  };
}

export interface InboxLinkTargetVariables {
  organizationId: UUIDString;
  hasLead: boolean;
  leadId?: UUIDString | null;
  hasContact: boolean;
  contactId?: UUIDString | null;
}

export interface InboxMailboxAccount_Key {
  organizationId: UUIDString;
  id: UUIDString;
  __typename?: 'InboxMailboxAccount_Key';
}

export interface InboxMessageByExternalIdData {
  messages: ({
    id: UUIDString;
    conversationId: UUIDString;
    direction: InboxDirection;
    deliveryStatus: InboxDeliveryStatus;
    simulated: boolean;
  })[];
}

export interface InboxMessageByExternalIdVariables {
  organizationId: UUIDString;
  channelConnectionId: UUIDString;
  externalMessageId: string;
}

export interface InboxMessage_Key {
  organizationId: UUIDString;
  id: UUIDString;
  __typename?: 'InboxMessage_Key';
}

export interface InboxNote_Key {
  organizationId: UUIDString;
  id: UUIDString;
  __typename?: 'InboxNote_Key';
}

export interface InboxReplyFactsData {
  job?: {
    id: UUIDString;
    stage: OutboundStage;
    revision: number;
    content: string;
    source: string;
    edited: boolean;
    templateName?: string | null;
    templateParamsJson?: string | null;
    createdByUid: string;
    lastEditedByUid?: string | null;
    conversationId: UUIDString;
    versionsJson: string;
    messageId?: UUIDString | null;
    conversation: {
      id: UUIDString;
      channel: InboxChannel;
      simulated: boolean;
      optedOut: boolean;
      lastInboundAt?: TimestampString | null;
      customerIdentity: string;
      externalThreadId: string;
      subject?: string | null;
      channelConnectionId?: UUIDString | null;
      channelConnection?: {
        id: UUIDString;
        provider: ChannelProvider;
        connectionStatus: ChannelConnectionStatus;
        sendingEnabled: boolean;
        liveSending: boolean;
        externalAccountReference?: string | null;
        businessAccountReference?: string | null;
        accessTokenReference?: string | null;
        accessTokenStoredAt?: TimestampString | null;
        ownerMembershipId?: UUIDString | null;
        ownerMembership?: {
          userProfileUid?: string | null;
        };
      };
    };
  };
  insight: ({
    id: UUIDString;
    insightJson: string;
  })[];
  settings?: {
    approvalRequired: boolean;
    aiEnabled: boolean;
  };
}

export interface InboxReplyFactsVariables {
  organizationId: UUIDString;
  id: UUIDString;
}

export interface InboxRetentionCandidatesData {
  messages: ({
    organizationId: UUIDString;
    id: UUIDString;
    attachments: ({
      id: UUIDString;
      storagePath?: string | null;
    })[];
  } & InboxMessage_Key)[];
}

export interface InboxRetentionCandidatesVariables {
  organizationId?: UUIDString | null;
  excluded?: UUIDString[] | null;
  before: TimestampString;
  limit?: number;
}

export interface InboxRetentionRulesData {
  rules: ({
    organizationId: UUIDString;
    retentionDays: number;
  } & InboxSettings_Key)[];
}

export interface InboxSettings_Key {
  organizationId: UUIDString;
  __typename?: 'InboxSettings_Key';
}

export interface InboxSimulatedOutboundData {
  admin?: {
    id: UUIDString;
  };
  message?: {
    id: UUIDString;
    conversationId: UUIDString;
    externalMessageId: string;
    deliveryStatus: InboxDeliveryStatus;
  };
}

export interface InboxSimulatedOutboundVariables {
  organizationId: UUIDString;
  actorUid: string;
  messageId: UUIDString;
}

export interface InboxSimulatorChannelData {
  admin?: {
    id: UUIDString;
  };
  connections: ({
    id: UUIDString;
  })[];
  conversations: ({
    id: UUIDString;
    channel: InboxChannel;
    customerIdentity: string;
    customerName?: string | null;
    status: InboxConversationStatus;
    unreadCount: number;
    lastMessageAt: TimestampString;
    lastMessagePreview?: string | null;
    contactId?: UUIDString | null;
    leadId?: UUIDString | null;
  })[];
}

export interface InboxSimulatorChannelVariables {
  organizationId: UUIDString;
  actorUid: string;
}

export interface InboxUnansweredMinutesData {
  settings?: {
    unansweredMinutes: number;
  };
}

export interface InboxUnansweredMinutesVariables {
  organizationId: UUIDString;
}

export interface InboxWebhookConnectionData {
  connections: ({
    organizationId: UUIDString;
    id: UUIDString;
    provider: ChannelProvider;
    connectionStatus: ChannelConnectionStatus;
    credentialReference?: string | null;
    externalAccountReference?: string | null;
  } & ChannelConnection_Key)[];
}

export interface InboxWebhookConnectionVariables {
  id: UUIDString;
}

export interface InventoryAmenity_Key {
  organizationId: UUIDString;
  id: UUIDString;
  __typename?: 'InventoryAmenity_Key';
}

export interface InventoryMedia_Key {
  organizationId: UUIDString;
  id: UUIDString;
  __typename?: 'InventoryMedia_Key';
}

export interface Invitation_Key {
  organizationId: UUIDString;
  id: UUIDString;
  __typename?: 'Invitation_Key';
}

export interface KnownMailboxMessagesData {
  messages: ({
    externalMessageId: string;
  })[];
}

export interface KnownMailboxMessagesVariables {
  organizationId: UUIDString;
  channelConnectionId: UUIDString;
  externalMessageIds: string[];
}

export interface LeadAssignmentHistory_Key {
  organizationId: UUIDString;
  id: UUIDString;
  __typename?: 'LeadAssignmentHistory_Key';
}

export interface LeadAttribution_Key {
  organizationId: UUIDString;
  id: UUIDString;
  __typename?: 'LeadAttribution_Key';
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

export interface LeadPriorityReview_Key {
  organizationId: UUIDString;
  id: UUIDString;
  __typename?: 'LeadPriorityReview_Key';
}

export interface LeadPropertyInterest_Key {
  organizationId: UUIDString;
  id: UUIDString;
  __typename?: 'LeadPropertyInterest_Key';
}

export interface LeadPropertyViewing_Key {
  organizationId: UUIDString;
  id: UUIDString;
  __typename?: 'LeadPropertyViewing_Key';
}

export interface LeadQualificationAssessment_Key {
  organizationId: UUIDString;
  id: UUIDString;
  __typename?: 'LeadQualificationAssessment_Key';
}

export interface LeadQualificationDetails_Key {
  organizationId: UUIDString;
  id: UUIDString;
  __typename?: 'LeadQualificationDetails_Key';
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

export interface LinkCallFollowUpData {
  call?: CallRecord_Key | null;
}

export interface LinkCallFollowUpVariables {
  organizationId: UUIDString;
  id: UUIDString;
  followUpId: UUIDString;
}

export interface LinkInboxConversationData {
  conversation?: InboxConversation_Key | null;
  auditLog_insert: AuditLog_Key;
  activity: Activity_Key;
}

export interface LinkInboxConversationVariables {
  organizationId: UUIDString;
  id: UUIDString;
  expectedRevision: number;
  hasLead: boolean;
  leadId?: UUIDString | null;
  hasContact: boolean;
  contactId?: UUIDString | null;
  identityMatches: boolean;
}

export interface ListCallSummariesData {
  me?: {
    id: UUIDString;
    role: MembershipRole;
  };
  call?: {
    id: UUIDString;
    leadId?: UUIDString | null;
    callStatus: CallStatus;
    notes?: string | null;
    agentMembershipId: UUIDString;
  };
  summaries: ({
    id: UUIDString;
    sourceKind: string;
    transcriptId?: UUIDString | null;
    summaryJson: string;
    overallConfidence: string;
    unverifiedCount: number;
    model: string;
    status: CallSummaryStatus;
    createdAt: TimestampString;
    createdBy: {
      displayName: string;
    };
    reviewedAt?: TimestampString | null;
    reviewedBy?: {
      displayName: string;
    };
    suggestions: ({
      id: UUIDString;
      kind: string;
      title: string;
      detail: string;
      basis: string;
      confidence: string;
      verified: boolean;
      status: CallSuggestionStatus;
      resultType?: string | null;
      resultId?: UUIDString | null;
      decidedAt?: TimestampString | null;
      decidedBy?: {
        displayName: string;
      };
    })[];
  })[];
  transcripts: ({
    id: UUIDString;
    language: string;
    segmentCount: number;
    createdAt: TimestampString;
  })[];
  settings?: {
    aiAnalysisEnabled: boolean;
  };
}

export interface ListCallSummariesVariables {
  organizationId: UUIDString;
  callId: UUIDString;
}

export interface ListCallsData {
  me?: {
    id: UUIDString;
    role: MembershipRole;
  };
  calls: ({
    id: UUIDString;
    leadId?: UUIDString | null;
    contactId?: UUIDString | null;
    direction: CallDirection;
    source: CallSource;
    callType: CallType;
    callStatus: CallStatus;
    outcome?: CallOutcome | null;
    counterpartyNumber?: string | null;
    startedAt: TimestampString;
    answeredAt?: TimestampString | null;
    durationSeconds: number;
    notes?: string | null;
    followUpRequired: boolean;
    followUpId?: UUIDString | null;
    viewingId?: UUIDString | null;
    revision: number;
    agentMembershipId: UUIDString;
    agentMembership: {
      id: UUIDString;
      email: string;
      userProfile?: {
        displayName: string;
      };
    };
    lead?: {
      id: UUIDString;
      fullName: string;
    };
    contact?: {
      id: UUIDString;
      fullName: string;
    };
    followUp?: {
      id: UUIDString;
      title: string;
      dueAt: TimestampString;
      status: LeadFollowUpStatus;
    };
    viewing?: {
      id: UUIDString;
      scheduledAt: TimestampString;
      status: LeadPropertyViewingStatus;
    };
  })[];
  total: ({
    count: number;
  })[];
  agents: ({
    id: UUIDString;
    email: string;
    userProfile?: {
      displayName: string;
    };
  })[];
}

export interface ListCallsVariables {
  organizationId: UUIDString;
  limit?: number;
  offset?: number;
  direction?: CallDirection | null;
  callStatus?: CallStatus | null;
  outcome?: CallOutcome | null;
  source?: CallSource | null;
  excludeSource?: CallSource | null;
  agentMembershipId?: UUIDString | null;
  startedFrom?: TimestampString | null;
  startedBefore?: TimestampString | null;
}

export interface ListChannelConnectionsData {
  admin?: {
    id: UUIDString;
  };
  connections: ({
    id: UUIDString;
    provider: ChannelProvider;
    displayName: string;
    externalAccountReference?: string | null;
    businessAccountReference?: string | null;
    connectionStatus: ChannelConnectionStatus;
    credentialReference?: string | null;
    accessTokenReference?: string | null;
    accessTokenStoredAt?: TimestampString | null;
    verifiedAt?: TimestampString | null;
    verifiedName?: string | null;
    verifiedDisplayNumber?: string | null;
    sendingEnabled: boolean;
    liveSending: boolean;
    liveSendingAt?: TimestampString | null;
    liveSendingBy?: {
      displayName: string;
    };
    lastEventAt?: TimestampString | null;
    revision: number;
    createdAt: TimestampString;
    updatedAt: TimestampString;
    createdBy: {
      displayName: string;
    };
  })[];
}

export interface ListChannelConnectionsVariables {
  organizationId: UUIDString;
}

export interface ListCommunicationProvidersData {
  admin?: {
    id: UUIDString;
  };
  connections: ({
    id: UUIDString;
    providerType: CommunicationProviderType;
    displayName: string;
    connectionStatus: CommunicationConnectionStatus;
    secretRef?: string | null;
    externalAccountId?: string | null;
    verificationNote?: string | null;
    verifiedAt?: TimestampString | null;
    verifiedBy?: {
      displayName: string;
    };
    lastWebhookAt?: TimestampString | null;
    revision: number;
    createdAt: TimestampString;
    updatedAt: TimestampString;
  })[];
  lines: ({
    id: UUIDString;
    providerConnectionId: UUIDString;
    phoneNumber: string;
    displayName?: string | null;
    assignedMembershipId?: UUIDString | null;
    assignedMembership?: {
      id: UUIDString;
      email: string;
      status: MembershipStatus;
      userProfile?: {
        displayName: string;
      };
    };
    forwardToNumber?: string | null;
    linePurpose: PhoneLinePurpose;
    status: PhoneLineStatus;
    registrationConfirmedAt?: TimestampString | null;
    registrationConfirmedBy?: {
      displayName: string;
    };
    revision: number;
  })[];
  members: ({
    id: UUIDString;
    email: string;
    role: MembershipRole;
    userProfile?: {
      displayName: string;
    };
  })[];
}

export interface ListCommunicationProvidersVariables {
  organizationId: UUIDString;
}

export interface ListCommunicationSuppressionsData {
  admin?: {
    id: UUIDString;
  };
  active: ({
    id: UUIDString;
    normalizedNumber: string;
    scope: CommunicationSuppressionScope;
    reason: CommunicationSuppressionReason;
    source: string;
    note?: string | null;
    callId?: UUIDString | null;
    createdAt: TimestampString;
    createdBy?: {
      displayName: string;
    };
  })[];
  withdrawn: ({
    id: UUIDString;
    normalizedNumber: string;
    scope: CommunicationSuppressionScope;
    reason: CommunicationSuppressionReason;
    source: string;
    createdAt: TimestampString;
    withdrawnAt?: TimestampString | null;
    withdrawalReason?: string | null;
    withdrawnBy?: {
      displayName: string;
    };
  })[];
}

export interface ListCommunicationSuppressionsVariables {
  organizationId: UUIDString;
  limit?: number;
  offset?: number;
}

export interface ListContactCallsData {
  me?: {
    id: UUIDString;
    role: MembershipRole;
  };
  contact?: {
    id: UUIDString;
    fullName: string;
    phone?: string | null;
    normalizedPhone?: string | null;
    alternatePhone?: string | null;
    normalizedAlternatePhone?: string | null;
  };
  calls: ({
    id: UUIDString;
    leadId?: UUIDString | null;
    direction: CallDirection;
    source: CallSource;
    callType: CallType;
    callStatus: CallStatus;
    outcome?: CallOutcome | null;
    counterpartyNumber?: string | null;
    startedAt: TimestampString;
    answeredAt?: TimestampString | null;
    durationSeconds: number;
    notes?: string | null;
    followUpRequired: boolean;
    followUpId?: UUIDString | null;
    viewingId?: UUIDString | null;
    revision: number;
    agentMembershipId: UUIDString;
    agentMembership: {
      id: UUIDString;
      email: string;
      userProfile?: {
        displayName: string;
      };
    };
    lead?: {
      id: UUIDString;
      fullName: string;
    };
    followUp?: {
      id: UUIDString;
      title: string;
      dueAt: TimestampString;
      status: LeadFollowUpStatus;
    };
    viewing?: {
      id: UUIDString;
      scheduledAt: TimestampString;
      status: LeadPropertyViewingStatus;
    };
  })[];
  total: ({
    count: number;
  })[];
}

export interface ListContactCallsVariables {
  organizationId: UUIDString;
  contactId: UUIDString;
  limit?: number;
  offset?: number;
}

export interface ListInboxConversationsData {
  me?: {
    id: UUIDString;
    role: MembershipRole;
  };
  conversations: ({
    id: UUIDString;
    channel: InboxChannel;
    customerIdentity: string;
    customerName?: string | null;
    subject?: string | null;
    status: InboxConversationStatus;
    priority: InboxPriority;
    lastMessageAt: TimestampString;
    lastMessagePreview?: string | null;
    unreadCount: number;
    optedOut: boolean;
    simulated: boolean;
    contactId?: UUIDString | null;
    leadId?: UUIDString | null;
    assignedMembershipId?: UUIDString | null;
    contact?: {
      id: UUIDString;
      fullName: string;
    };
    lead?: {
      id: UUIDString;
      fullName: string;
    };
    assignedMembership?: {
      id: UUIDString;
      userProfile?: {
        displayName: string;
      };
    };
    channelConnection?: {
      provider: ChannelProvider;
      displayName: string;
    };
  })[];
}

export interface ListInboxConversationsVariables {
  organizationId: UUIDString;
  limit?: number;
  cursorAt?: TimestampString | null;
  seenIds?: UUIDString[] | null;
  status?: InboxConversationStatus | null;
  channel?: InboxChannel | null;
  assignedMembershipId?: UUIDString | null;
  unassigned?: boolean | null;
  needsMatching?: boolean | null;
  minUnread?: number | null;
  simulated?: boolean | null;
  search?: string | null;
  leadId?: UUIDString | null;
  contactId?: UUIDString | null;
}

export interface ListInboxMessagesData {
  conversation?: {
    id: UUIDString;
  };
  messages: ({
    id: UUIDString;
    direction: InboxDirection;
    senderIdentity?: string | null;
    recipientIdentity?: string | null;
    messageType: InboxMessageType;
    content?: string | null;
    contentRedactedAt?: TimestampString | null;
    contentHtmlBytes?: number | null;
    deliveryStatus: InboxDeliveryStatus;
    providerStatusRaw?: string | null;
    providerTimestamp?: TimestampString | null;
    simulated: boolean;
    createdAt: TimestampString;
    author?: {
      displayName: string;
    };
    attachments: ({
      id: UUIDString;
      fileName: string;
      mimeType: string;
      sizeBytes: number;
      scanStatus: InboxAttachmentScan;
      storagePath?: string | null;
      providerMediaId?: string | null;
      mediaFetchAttempts: number;
      mediaError?: string | null;
    })[];
  })[];
}

export interface ListInboxMessagesVariables {
  organizationId: UUIDString;
  conversationId: UUIDString;
  limit?: number;
  cursorAt?: TimestampString | null;
  seenIds?: UUIDString[] | null;
}

export interface ListInboxRepliesData {
  me?: {
    id: UUIDString;
    role: MembershipRole;
  };
  settings?: {
    approvalRequired: boolean;
    aiEnabled: boolean;
  };
  conversation?: {
    id: UUIDString;
    jobs: ({
      id: UUIDString;
      stage: OutboundStage;
      source: string;
      content: string;
      templateName?: string | null;
      templateParamsJson?: string | null;
      versionsJson: string;
      validationJson?: string | null;
      edited: boolean;
      createdByUid: string;
      createdBy: {
        displayName: string;
      };
      lastEditedByUid?: string | null;
      lastEditedBy?: {
        displayName: string;
      };
      approvalRequestedAt?: TimestampString | null;
      approvedByUid?: string | null;
      approvedBy?: {
        displayName: string;
      };
      approvedAt?: TimestampString | null;
      approvalNote?: string | null;
      selfApproved: boolean;
      messageId?: UUIDString | null;
      providerMessageId?: string | null;
      failureReason?: string | null;
      revision: number;
      createdAt: TimestampString;
      updatedAt: TimestampString;
    })[];
    insights: ({
      id: UUIDString;
      insightJson: string;
      unverifiedCount: number;
      coveredUntil?: TimestampString | null;
      draftJobId?: UUIDString | null;
      model: string;
      source: string;
      createdAt: TimestampString;
      createdBy: {
        displayName: string;
      };
    })[];
  };
}

export interface ListInboxRepliesVariables {
  organizationId: UUIDString;
  conversationId: UUIDString;
}

export interface ListLeadCallsData {
  me?: {
    id: UUIDString;
    role: MembershipRole;
  };
  lead?: {
    id: UUIDString;
    fullName: string;
    phone?: string | null;
    archivedAt?: TimestampString | null;
    assignedMembershipId?: UUIDString | null;
    contactId?: UUIDString | null;
    contact?: {
      id: UUIDString;
      fullName: string;
      phone?: string | null;
      normalizedPhone?: string | null;
      alternatePhone?: string | null;
      normalizedAlternatePhone?: string | null;
    };
  };
  calls: ({
    id: UUIDString;
    direction: CallDirection;
    source: CallSource;
    callType: CallType;
    callStatus: CallStatus;
    outcome?: CallOutcome | null;
    counterpartyNumber?: string | null;
    startedAt: TimestampString;
    answeredAt?: TimestampString | null;
    durationSeconds: number;
    notes?: string | null;
    followUpRequired: boolean;
    followUpId?: UUIDString | null;
    viewingId?: UUIDString | null;
    revision: number;
    agentMembershipId: UUIDString;
    agentMembership: {
      id: UUIDString;
      email: string;
      userProfile?: {
        displayName: string;
      };
    };
    followUp?: {
      id: UUIDString;
      title: string;
      dueAt: TimestampString;
      status: LeadFollowUpStatus;
    };
    viewing?: {
      id: UUIDString;
      scheduledAt: TimestampString;
      status: LeadPropertyViewingStatus;
    };
  })[];
  total: ({
    count: number;
  })[];
  lastAnswered: ({
    startedAt: TimestampString;
  })[];
  viewings: ({
    id: UUIDString;
    scheduledAt: TimestampString;
    status: LeadPropertyViewingStatus;
  })[];
}

export interface ListLeadCallsVariables {
  organizationId: UUIDString;
  leadId: UUIDString;
  limit?: number;
  offset?: number;
}

export interface ListMeetingAttendeeOptionsData {
  me?: {
    id: UUIDString;
  };
  members: ({
    id: UUIDString;
    role: MembershipRole;
    userProfile?: {
      displayName: string;
    };
  })[];
}

export interface ListMeetingAttendeeOptionsVariables {
  organizationId: UUIDString;
}

export interface ListMeetingsData {
  me?: {
    id: UUIDString;
    role: MembershipRole;
  };
  meetings: ({
    id: UUIDString;
    title: string;
    provider: MeetingProvider;
    status: MeetingStatus;
    startsAt: TimestampString;
    endsAt: TimestampString;
    leadId?: UUIDString | null;
    contactId?: UUIDString | null;
    summarizedAt?: TimestampString | null;
    lead?: {
      id: UUIDString;
      fullName: string;
    };
    contact?: {
      id: UUIDString;
      fullName: string;
    };
    organizerMembership: {
      id: UUIDString;
      userProfile?: {
        displayName: string;
      };
    };
    attendees: ({
      membershipId: UUIDString;
    })[];
  })[];
}

export interface ListMeetingsVariables {
  organizationId: UUIDString;
  from?: TimestampString | null;
  to?: TimestampString | null;
  status?: MeetingStatus | null;
  leadId?: UUIDString | null;
  contactId?: UUIDString | null;
  limit?: number;
  offset?: number;
}

export interface ListingPublication_Key {
  organizationId: UUIDString;
  id: UUIDString;
  __typename?: 'ListingPublication_Key';
}

export interface LogContactCallData {
  call: CallRecord_Key;
  auditLog_insert: AuditLog_Key;
  suppression: CommunicationSuppression_Key;
  suppressionAudit: AuditLog_Key;
  callEvent: AutomationEvent_Key;
}

export interface LogContactCallVariables {
  organizationId: UUIDString;
  id: UUIDString;
  contactId: UUIDString;
  direction: CallDirection;
  callType: CallType;
  callStatus: CallStatus;
  outcome?: CallOutcome | null;
  startedAt: TimestampString;
  durationSeconds: number;
  notes?: string | null;
  counterpartyNumber?: string | null;
  followUpRequired: boolean;
  suppress: boolean;
  suppressionId: UUIDString;
  emitEvent: boolean;
}

export interface LogLeadCallData {
  call: CallRecord_Key;
  activity_insert: Activity_Key;
  auditLog_insert: AuditLog_Key;
  suppression: CommunicationSuppression_Key;
  suppressionAudit: AuditLog_Key;
  callEvent: AutomationEvent_Key;
}

export interface LogLeadCallVariables {
  organizationId: UUIDString;
  id: UUIDString;
  leadId: UUIDString;
  direction: CallDirection;
  callType: CallType;
  callStatus: CallStatus;
  outcome?: CallOutcome | null;
  startedAt: TimestampString;
  durationSeconds: number;
  notes?: string | null;
  counterpartyNumber?: string | null;
  followUpRequired: boolean;
  hasViewing: boolean;
  viewingId?: UUIDString | null;
  suppress: boolean;
  suppressionId: UUIDString;
  emitEvent: boolean;
}

export interface MailboxActorData {
  actor?: {
    id: UUIDString;
    role: MembershipRole;
  };
}

export interface MailboxActorVariables {
  organizationId: UUIDString;
  actorUid: string;
}

export interface MailboxConflictsData {
  sameAddress: ({
    id: UUIDString;
    organizationId: UUIDString;
    ownerMembershipId?: UUIDString | null;
    ownerMembership?: {
      userProfileUid?: string | null;
    };
    connectionStatus: ChannelConnectionStatus;
    revision: number;
  } & ChannelConnection_Key)[];
  mine: ({
    id: UUIDString;
    externalAccountReference?: string | null;
    connectionStatus: ChannelConnectionStatus;
  })[];
  company: ({
    id: UUIDString;
  })[];
}

export interface MailboxConflictsVariables {
  provider: ChannelProvider;
  mailbox: string;
  organizationId: UUIDString;
  actorUid: string;
}

export interface MailboxForActionData {
  actor?: {
    id: UUIDString;
    role: MembershipRole;
  };
  mailbox?: {
    id: UUIDString;
    provider: ChannelProvider;
    displayName: string;
    externalAccountReference?: string | null;
    connectionStatus: ChannelConnectionStatus;
    sendingEnabled: boolean;
    revision: number;
    ownerMembershipId?: UUIDString | null;
    ownerMembership?: {
      userProfileUid?: string | null;
      status: MembershipStatus;
    };
    account?: {
      tokenCiphertext?: string | null;
      tokenKeyId?: string | null;
      historyId?: string | null;
      syncState: InboxMailboxSyncState;
    };
  };
}

export interface MailboxForActionVariables {
  organizationId: UUIDString;
  id: UUIDString;
  actorUid: string;
}

export interface MailboxSyncRowData {
  account?: {
    organizationId: UUIDString;
    id: UUIDString;
    channelConnectionId: UUIDString;
    historyId?: string | null;
    syncState: InboxMailboxSyncState;
    backfilled: boolean;
    failures: number;
    tokenCiphertext?: string | null;
    tokenKeyId?: string | null;
    leaseUntil?: TimestampString | null;
    nextSyncAt?: TimestampString | null;
    channelConnection: {
      provider: ChannelProvider;
      connectionStatus: ChannelConnectionStatus;
      externalAccountReference?: string | null;
      ownerMembershipId?: UUIDString | null;
      ownerMembership?: {
        status: MembershipStatus;
      };
    };
  } & InboxMailboxAccount_Key;
}

export interface MailboxSyncRowVariables {
  organizationId: UUIDString;
  id: UUIDString;
}

export interface MailboxesOverviewData {
  actor?: {
    id: UUIDString;
    role: MembershipRole;
  };
  mailboxes: ({
    id: UUIDString;
    provider: ChannelProvider;
    displayName: string;
    externalAccountReference?: string | null;
    connectionStatus: ChannelConnectionStatus;
    sendingEnabled: boolean;
    verifiedAt?: TimestampString | null;
    revision: number;
    createdAt: TimestampString;
    ownerMembershipId?: UUIDString | null;
    ownerMembership?: {
      id: UUIDString;
      userProfileUid?: string | null;
      status: MembershipStatus;
      userProfile?: {
        displayName: string;
      };
    };
    account?: {
      syncState: InboxMailboxSyncState;
      backfilled: boolean;
      lastSyncedAt?: TimestampString | null;
      failures: number;
      lastErrorCode?: string | null;
      connectedAt: TimestampString;
    };
  })[];
}

export interface MailboxesOverviewVariables {
  organizationId: UUIDString;
  actorUid: string;
}

export interface MarkCallMediaFileDeletedData {
  callRecording_update?: CallRecording_Key | null;
  callTranscript_update?: CallTranscript_Key | null;
}

export interface MarkCallMediaFileDeletedVariables {
  organizationId: UUIDString;
  recordingId?: UUIDString | null;
  transcriptId?: UUIDString | null;
  isRecording: boolean;
}

export interface MarkCallProviderEventData {
  callProviderEvent_update?: CallProviderEvent_Key | null;
}

export interface MarkCallProviderEventVariables {
  organizationId: UUIDString;
  id: UUIDString;
  result: string;
  callId?: UUIDString | null;
}

export interface MarkChannelConnectionCheckedData {
  verified?: ChannelConnection_Key | null;
  failed?: ChannelConnection_Key | null;
  auditLog_insert: AuditLog_Key;
}

export interface MarkChannelConnectionCheckedVariables {
  organizationId: UUIDString;
  id: UUIDString;
  expectedRevision: number;
  actorUid: string;
  verified: boolean;
  verifiedName?: string | null;
  verifiedDisplayNumber?: string | null;
  errorCode?: string | null;
}

export interface MarkInboxConversationReadData {
  conversation?: InboxConversation_Key | null;
}

export interface MarkInboxConversationReadVariables {
  organizationId: UUIDString;
  id: UUIDString;
}

export interface MarkInboxLeadConversationsSimulatedData {
  inboxConversation_updateMany: number;
  inboxMessage_updateMany: number;
}

export interface MarkInboxLeadConversationsSimulatedVariables {
  organizationId: UUIDString;
  actorUid: string;
  leadId: UUIDString;
}

export interface MatchInboxIdentityData {
  byPhone: ({
    id: UUIDString;
    fullName: string;
    leads: ({
      id: UUIDString;
      assignedMembershipId?: UUIDString | null;
    })[];
  })[];
  byEmail: ({
    id: UUIDString;
    fullName: string;
    leads: ({
      id: UUIDString;
      assignedMembershipId?: UUIDString | null;
    })[];
  })[];
}

export interface MatchInboxIdentityVariables {
  organizationId: UUIDString;
  hasPhone: boolean;
  phone?: string | null;
  hasEmail: boolean;
  email?: string | null;
}

export interface Membership_Key {
  organizationId: UUIDString;
  id: UUIDString;
  __typename?: 'Membership_Key';
}

export interface MetaLeadConnection_Key {
  organizationId: UUIDString;
  id: UUIDString;
  __typename?: 'MetaLeadConnection_Key';
}

export interface MetaLeadEvent_Key {
  organizationId: UUIDString;
  id: UUIDString;
  __typename?: 'MetaLeadEvent_Key';
}

export interface MetaLeadForm_Key {
  organizationId: UUIDString;
  id: UUIDString;
  __typename?: 'MetaLeadForm_Key';
}

export interface OpenInboxAttachmentData {
  file?: {
    conversation?: {
      id: UUIDString;
    };
    attachment?: {
      fileName: string;
      mimeType: string;
      sizeBytes: number;
      storagePath?: string | null;
      scanStatus: InboxAttachmentScan;
    };
  };
  auditLog_insert: AuditLog_Key;
}

export interface OpenInboxAttachmentVariables {
  organizationId: UUIDString;
  conversationId: UUIDString;
  id: UUIDString;
}

export interface OrganizationPortalConnection_Key {
  organizationId: UUIDString;
  id: UUIDString;
  __typename?: 'OrganizationPortalConnection_Key';
}

export interface Organization_Key {
  id: UUIDString;
  __typename?: 'Organization_Key';
}

export interface OutboundMessageJob_Key {
  organizationId: UUIDString;
  id: UUIDString;
  __typename?: 'OutboundMessageJob_Key';
}

export interface PageLeadFormBinding_Key {
  organizationId: UUIDString;
  pageId: UUIDString;
  __typename?: 'PageLeadFormBinding_Key';
}

export interface PagePublication_Key {
  organizationId: UUIDString;
  id: UUIDString;
  __typename?: 'PagePublication_Key';
}

export interface PageVersion_Key {
  organizationId: UUIDString;
  id: UUIDString;
  __typename?: 'PageVersion_Key';
}

export interface PaymentPlanInstallment_Key {
  organizationId: UUIDString;
  id: UUIDString;
  __typename?: 'PaymentPlanInstallment_Key';
}

export interface PaymentPlan_Key {
  organizationId: UUIDString;
  id: UUIDString;
  __typename?: 'PaymentPlan_Key';
}

export interface PendingInboxEventsData {
  events: ({
    organizationId: UUIDString;
    id: UUIDString;
    channelConnectionId?: UUIDString | null;
    kind: string;
    normalizedJson?: string | null;
    attempts: number;
    simulated: boolean;
  } & InboxEvent_Key)[];
}

export interface PendingInboxEventsVariables {
  now: TimestampString;
  staleBefore: TimestampString;
  limit: number;
}

export interface PendingInboxMediaData {
  attachments: ({
    organizationId: UUIDString;
    id: UUIDString;
    messageId: UUIDString;
    conversationId: UUIDString;
    fileName: string;
    mimeType: string;
    providerMediaId?: string | null;
    mediaFetchAttempts: number;
    createdAt: TimestampString;
    message: {
      conversation: {
        channelConnection?: {
          id: UUIDString;
          connectionStatus: ChannelConnectionStatus;
          accessTokenReference?: string | null;
          accessTokenStoredAt?: TimestampString | null;
        };
      };
    };
  } & InboxAttachment_Key)[];
}

export interface PendingInboxMediaVariables {
  now: TimestampString;
  since: TimestampString;
  limit: number;
}

export interface PendingWebsiteEnquiry_Key {
  organizationId: UUIDString;
  id: UUIDString;
  __typename?: 'PendingWebsiteEnquiry_Key';
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

export interface PortalFieldMapping_Key {
  organizationId: UUIDString;
  id: UUIDString;
  __typename?: 'PortalFieldMapping_Key';
}

export interface ProjectAmenity_Key {
  organizationId: UUIDString;
  id: UUIDString;
  __typename?: 'ProjectAmenity_Key';
}

export interface ProjectPhase_Key {
  organizationId: UUIDString;
  projectId: UUIDString;
  id: UUIDString;
  __typename?: 'ProjectPhase_Key';
}

export interface Project_Key {
  organizationId: UUIDString;
  id: UUIDString;
  __typename?: 'Project_Key';
}

export interface PropertyAmenity_Key {
  organizationId: UUIDString;
  id: UUIDString;
  __typename?: 'PropertyAmenity_Key';
}

export interface PropertyFeature_Key {
  organizationId: UUIDString;
  id: UUIDString;
  __typename?: 'PropertyFeature_Key';
}

export interface PropertyListing_Key {
  organizationId: UUIDString;
  id: UUIDString;
  __typename?: 'PropertyListing_Key';
}

export interface Property_Key {
  organizationId: UUIDString;
  id: UUIDString;
  __typename?: 'Property_Key';
}

export interface ProviderCallForControlData {
  call?: {
    providerCallId?: string | null;
    callStatus: CallStatus;
    providerConnection?: {
      providerType: CommunicationProviderType;
      secretRef?: string | null;
      externalAccountId?: string | null;
      connectionStatus: CommunicationConnectionStatus;
    };
  };
}

export interface ProviderCallForControlVariables {
  organizationId: UUIDString;
  id: UUIDString;
}

export interface ProviderConnectionForWebhookData {
  connections: ({
    organizationId: UUIDString;
    id: UUIDString;
    providerType: CommunicationProviderType;
    connectionStatus: CommunicationConnectionStatus;
    secretRef?: string | null;
    externalAccountId?: string | null;
  } & CommunicationProviderConnection_Key)[];
}

export interface ProviderConnectionForWebhookVariables {
  id: UUIDString;
}

export interface PublicationAttempt_Key {
  organizationId: UUIDString;
  id: UUIDString;
  __typename?: 'PublicationAttempt_Key';
}

export interface QueueInboxReplyData {
  message: InboxMessage_Key;
  job?: OutboundMessageJob_Key | null;
  conversation?: InboxConversation_Key | null;
  auditLog_insert: AuditLog_Key;
}

export interface QueueInboxReplyVariables {
  organizationId: UUIDString;
  id: UUIDString;
  expectedRevision: number;
  conversationId: UUIDString;
  channelConnectionId: UUIDString;
  content: string;
  actorUid: string;
  messageId: UUIDString;
  pendingExternalId: string;
  recipientIdentity: string;
  preview: string;
  simulated?: boolean;
  template?: boolean;
}

export interface RateLimitCounter_Key {
  bucketKey: string;
  __typename?: 'RateLimitCounter_Key';
}

export interface RecordCallConsentData {
  consent: CallConsentEvidence_Key;
  auditLog_insert: AuditLog_Key;
}

export interface RecordCallConsentVariables {
  organizationId: UUIDString;
  id: UUIDString;
  callId: UUIDString;
  status: CallConsentStatus;
  method: string;
  note?: string | null;
}

export interface RecordCallMediaAccessData {
  auditLog_insert: AuditLog_Key;
}

export interface RecordCallMediaAccessVariables {
  organizationId: UUIDString;
  actorUid: string;
  targetType: AuditTargetType;
  targetId: UUIDString;
}

export interface RecordCallProviderEventData {
  event: CallProviderEvent_Key;
  connection?: CommunicationProviderConnection_Key | null;
}

export interface RecordCallProviderEventVariables {
  organizationId: UUIDString;
  id: UUIDString;
  providerConnectionId: UUIDString;
  eventKey: string;
  eventType: string;
  providerCallId?: string | null;
  callStatus?: CallStatus | null;
  occurredAt?: TimestampString | null;
}

export interface RecordCommunicationProviderVerificationData {
  connection?: CommunicationProviderConnection_Key | null;
  auditLog_insert: AuditLog_Key;
}

export interface RecordCommunicationProviderVerificationVariables {
  organizationId: UUIDString;
  id: UUIDString;
  expectedRevision: number;
  actorUid: string;
  verified: boolean;
  note: string;
}

export interface RecordInboxEventData {
  inboxEvent_insert: InboxEvent_Key;
  channelConnection_update?: ChannelConnection_Key | null;
}

export interface RecordInboxEventVariables {
  organizationId: UUIDString;
  id: UUIDString;
  hasConnection: boolean;
  channelConnectionId?: UUIDString | null;
  kind: string;
  dedupKey: string;
  payloadDigest?: string | null;
  normalizedJson: string;
  simulated: boolean;
}

export interface RecordInboxReplyCheckData {
  passed?: OutboundMessageJob_Key | null;
  failed?: OutboundMessageJob_Key | null;
}

export interface RecordInboxReplyCheckVariables {
  organizationId: UUIDString;
  id: UUIDString;
  expectedRevision: number;
  valid: boolean;
  validationJson: string;
}

export interface RegisterSimulationLeadData {
  communicationSimulationRecord_insert: CommunicationSimulationRecord_Key;
  auditLog_insert: AuditLog_Key;
}

export interface RegisterSimulationLeadVariables {
  organizationId: UUIDString;
  id: UUIDString;
  actorUid: string;
  leadId: UUIDString;
  label: string;
}

export interface RemoveMeetingAttendeeData {
  communicationMeetingAttendee_deleteMany: number;
}

export interface RemoveMeetingAttendeeVariables {
  organizationId: UUIDString;
  meetingId: UUIDString;
  membershipId: UUIDString;
}

export interface RequestMailboxSyncData {
  inboxMailboxAccount_updateMany: number;
}

export interface RequestMailboxSyncVariables {
  organizationId: UUIDString;
  id: UUIDString;
  actorUid: string;
}

export interface ResetCommunicationSimulationData {
  suggestions: number;
  summaries: number;
  transcripts: number;
  recordings: number;
  consents: number;
  calls: number;
  attendees: number;
  meetings: number;
  leads: number;
  records: number;
  auditLog_insert: AuditLog_Key;
}

export interface ResetCommunicationSimulationVariables {
  organizationId: UUIDString;
  actorUid: string;
}

export interface ResetInboxSimulationData {
  attachments: number;
  messages: number;
  notes: number;
  history: number;
  insights: number;
  jobs: number;
  events: number;
  conversations: number;
}

export interface ResetInboxSimulationVariables {
  organizationId: UUIDString;
  actorUid: string;
}

export interface ResolveProviderCallData {
  calls: ({
    id: UUIDString;
    callStatus: CallStatus;
    startedAt: TimestampString;
    answeredAt?: TimestampString | null;
    revision: number;
    direction: CallDirection;
    leadId?: UUIDString | null;
    agentMembershipId: UUIDString;
  })[];
  lines: ({
    id: UUIDString;
    phoneNumber: string;
    assignedMembershipId?: UUIDString | null;
    assignedMembership?: {
      status: MembershipStatus;
      userProfileUid?: string | null;
    };
  })[];
  contacts: ({
    id: UUIDString;
    leads_on_contact: ({
      id: UUIDString;
    })[];
  })[];
}

export interface ResolveProviderCallVariables {
  organizationId: UUIDString;
  providerConnectionId: UUIDString;
  providerCallId: string;
  lineNumber: string;
  customerNumber: string;
}

export interface RetireMailboxData {
  channelConnection_update?: ChannelConnection_Key | null;
  inboxMailboxAccount_updateMany: number;
}

export interface RetireMailboxVariables {
  organizationId: UUIDString;
  id: UUIDString;
}

export interface ReviewCallAiSummaryData {
  summary?: CallAiSummary_Key | null;
  auditLog_insert: AuditLog_Key;
}

export interface ReviewCallAiSummaryVariables {
  organizationId: UUIDString;
  id: UUIDString;
  status: CallSummaryStatus;
}

export interface RevokeLiveCallingAttestationData {
  settings?: CommunicationSettings_Key | null;
  auditLog_insert: AuditLog_Key;
}

export interface RevokeLiveCallingAttestationVariables {
  organizationId: UUIDString;
}

export interface SaveChannelAccessTokenData {
  credential: ChannelCredential_Key;
  connection?: ChannelConnection_Key | null;
  auditLog_insert: AuditLog_Key;
}

export interface SaveChannelAccessTokenVariables {
  organizationId: UUIDString;
  id: UUIDString;
  expectedRevision: number;
  tokenCiphertext: string;
  tokenKeyId: string;
}

export interface SaveInboxAiInsightData {
  insight: InboxAiInsight_Key;
  draft: OutboundMessageJob_Key;
  auditLog_insert: AuditLog_Key;
}

export interface SaveInboxAiInsightVariables {
  organizationId: UUIDString;
  id: UUIDString;
  conversationId: UUIDString;
  actorUid: string;
  insightJson: string;
  unverifiedCount: number;
  coveredUntil?: TimestampString | null;
  model: string;
  promptVersion: string;
  source: string;
  hasDraft: boolean;
  draftJobId?: UUIDString | null;
  draftContent: string;
}

export interface SaveInboxSettingsData {
  settings: InboxSettings_Key;
  auditLog_insert: AuditLog_Key;
}

export interface SaveInboxSettingsVariables {
  organizationId: UUIDString;
  expectedRevision: number;
  approvalRequired: boolean;
  retentionDays: number;
  unansweredMinutes: number;
  aiEnabled: boolean;
}

export interface SaveMailboxConnectionData {
  inserted: ChannelConnection_Key;
  updated?: ChannelConnection_Key | null;
  account: InboxMailboxAccount_Key;
  auditLog_insert: AuditLog_Key;
}

export interface SaveMailboxConnectionVariables {
  organizationId: UUIDString;
  id: UUIDString;
  actorUid: string;
  provider: ChannelProvider;
  personal: boolean;
  ownerMembershipId?: UUIDString | null;
  existing: boolean;
  displayName: string;
  mailbox: string;
  tokenCiphertext: string;
  tokenKeyId: string;
  scopes: string;
  historyId: string;
}

export interface SaveMeetingSummaryData {
  communicationMeeting_update?: CommunicationMeeting_Key | null;
  auditLog_insert: AuditLog_Key;
}

export interface SaveMeetingSummaryVariables {
  organizationId: UUIDString;
  id: UUIDString;
  actorUid: string;
  expectedRevision: number;
  summaryJson: string;
  model: string;
}

export interface SaveVoiceTestSessionData {
  session?: VoiceAssistantTestSession_Key | null;
}

export interface SaveVoiceTestSessionVariables {
  organizationId: UUIDString;
  id: UUIDString;
  actorUid: string;
  expectedRevision: number;
  status: VoiceTestSessionStatus;
  turnsJson: string;
  callerTurns: number;
  pendingTurnId?: UUIDString | null;
  pendingSince?: TimestampString | null;
  handoffReason?: string | null;
  viewingRequestJson?: string | null;
  endedAt?: TimestampString | null;
  inputTokens: number;
  outputTokens: number;
}

export interface ScheduledAutomationJob_Key {
  organizationId: UUIDString;
  id: UUIDString;
  __typename?: 'ScheduledAutomationJob_Key';
}

export interface SetChannelConnectionEnabledData {
  connection?: ChannelConnection_Key | null;
  auditLog_insert: AuditLog_Key;
}

export interface SetChannelConnectionEnabledVariables {
  organizationId: UUIDString;
  id: UUIDString;
  expectedRevision: number;
  enabled: boolean;
}

export interface SetChannelConnectionLiveSendingData {
  channelConnection_update?: ChannelConnection_Key | null;
  auditLog_insert: AuditLog_Key;
}

export interface SetChannelConnectionLiveSendingVariables {
  organizationId: UUIDString;
  id: UUIDString;
  expectedRevision: number;
  actorUid: string;
  enabled: boolean;
}

export interface SetChannelConnectionSendingData {
  channelConnection_update?: ChannelConnection_Key | null;
  auditLog_insert: AuditLog_Key;
}

export interface SetChannelConnectionSendingVariables {
  organizationId: UUIDString;
  id: UUIDString;
  expectedRevision: number;
  actorUid: string;
  enabled: boolean;
}

export interface SetCommunicationProviderEnabledData {
  connection?: CommunicationProviderConnection_Key | null;
  auditLog_insert: AuditLog_Key;
}

export interface SetCommunicationProviderEnabledVariables {
  organizationId: UUIDString;
  id: UUIDString;
  expectedRevision: number;
  enabled: boolean;
}

export interface SetInboxConversationStateData {
  conversation?: InboxConversation_Key | null;
  auditLog_insert: AuditLog_Key;
  automationEvent_insert: AutomationEvent_Key;
}

export interface SetInboxConversationStateVariables {
  organizationId: UUIDString;
  id: UUIDString;
  expectedRevision: number;
  status: InboxConversationStatus;
  priority: InboxPriority;
  emitResolved: boolean;
}

export interface SetInboxMessageHtmlData {
  inboxMessage_updateMany: number;
}

export interface SetInboxMessageHtmlVariables {
  organizationId: UUIDString;
  id: UUIDString;
  html?: string | null;
  bytes: number;
}

export interface SetMailboxSendingData {
  channelConnection_update?: ChannelConnection_Key | null;
  auditLog_insert: AuditLog_Key;
}

export interface SetMailboxSendingVariables {
  organizationId: UUIDString;
  id: UUIDString;
  actorUid: string;
  expectedRevision: number;
  enabled: boolean;
}

export interface SetMeetingStatusData {
  meeting?: CommunicationMeeting_Key | null;
  auditLog_insert: AuditLog_Key;
}

export interface SetMeetingStatusVariables {
  organizationId: UUIDString;
  id: UUIDString;
  expectedRevision: number;
  status: MeetingStatus;
}

export interface SetPhoneLineActiveData {
  line?: CommunicationPhoneLine_Key | null;
  auditLog_insert: AuditLog_Key;
}

export interface SetPhoneLineActiveVariables {
  organizationId: UUIDString;
  id: UUIDString;
  expectedRevision: number;
  active: boolean;
}

export interface SetProviderCallIdData {
  callRecord_update?: CallRecord_Key | null;
}

export interface SetProviderCallIdVariables {
  organizationId: UUIDString;
  id: UUIDString;
  providerCallId: string;
}

export interface SimulatedCallFilesData {
  admin?: {
    id: UUIDString;
  };
  recordings: ({
    storagePath: string;
  })[];
  transcripts: ({
    transcriptReference: string;
  })[];
}

export interface SimulatedCallFilesVariables {
  organizationId: UUIDString;
  actorUid: string;
}

export interface StartLeadCallData {
  call: CallRecord_Key;
  activity_insert: Activity_Key;
  automationEvent_insert: AutomationEvent_Key;
  auditLog_insert: AuditLog_Key;
}

export interface StartLeadCallVariables {
  organizationId: UUIDString;
  id: UUIDString;
  leadId: UUIDString;
  phoneLineId: UUIDString;
  callType: CallType;
  counterpartyNumber: string;
  attestationVersion: string;
}

export interface StartVoiceTestSessionData {
  session: VoiceAssistantTestSession_Key;
  auditLog_insert: AuditLog_Key;
}

export interface StartVoiceTestSessionVariables {
  organizationId: UUIDString;
  id: UUIDString;
  actorUid: string;
  configRevision: number;
  factsJson: string;
  turnsJson: string;
}

export interface StartWhatsAppConversationData {
  conversation: InboxConversation_Key;
  auditLog_insert: AuditLog_Key;
}

export interface StartWhatsAppConversationVariables {
  organizationId: UUIDString;
  id: UUIDString;
  channelConnectionId: UUIDString;
  actorUid: string;
  customerIdentity: string;
  externalThreadId: string;
  contactId?: UUIDString | null;
  leadId?: UUIDString | null;
}

export interface StoreInboxMediaData {
  inboxAttachment_update?: InboxAttachment_Key | null;
}

export interface StoreInboxMediaVariables {
  organizationId: UUIDString;
  id: UUIDString;
  storagePath: string;
  mimeType: string;
  sizeBytes: number;
  fileName: string;
}

export interface SubmitInboxReplyData {
  pending?: OutboundMessageJob_Key | null;
  approved?: OutboundMessageJob_Key | null;
  inAppNotification_insert: InAppNotification_Key;
  auditLog_insert: AuditLog_Key;
}

export interface SubmitInboxReplyVariables {
  organizationId: UUIDString;
  id: UUIDString;
  expectedRevision: number;
  approvalRequired: boolean;
  notificationId: UUIDString;
}

export interface UnansweredInboxCandidatesData {
  conversations: ({
    id: UUIDString;
    leadId?: UUIDString | null;
    lastInboundAt?: TimestampString | null;
    lastOutboundAt?: TimestampString | null;
    simulated: boolean;
  })[];
}

export interface UnansweredInboxCandidatesVariables {
  organizationId: UUIDString;
  from: TimestampString;
  to: TimestampString;
  limit?: number;
}

export interface UpdateCallRecordData {
  call?: CallRecord_Key | null;
  activity_insert: Activity_Key;
  auditLog_insert: AuditLog_Key;
  suppression: CommunicationSuppression_Key;
  suppressionAudit: AuditLog_Key;
}

export interface UpdateCallRecordVariables {
  organizationId: UUIDString;
  id: UUIDString;
  expectedRevision: number;
  outcome?: CallOutcome | null;
  notes?: string | null;
  followUpRequired: boolean;
  suppress: boolean;
  suppressionId: UUIDString;
}

export interface UpdateChannelConnectionData {
  connection?: ChannelConnection_Key | null;
  auditLog_insert: AuditLog_Key;
}

export interface UpdateChannelConnectionVariables {
  organizationId: UUIDString;
  id: UUIDString;
  expectedRevision: number;
  displayName: string;
  externalAccountReference?: string | null;
  credentialReference?: string | null;
  accessTokenReference?: string | null;
  businessAccountReference?: string | null;
}

export interface UpdateCommunicationPhoneLineData {
  line?: CommunicationPhoneLine_Key | null;
  auditLog_insert: AuditLog_Key;
}

export interface UpdateCommunicationPhoneLineVariables {
  organizationId: UUIDString;
  id: UUIDString;
  expectedRevision: number;
  displayName?: string | null;
  hasAssignee: boolean;
  assignedMembershipId?: UUIDString | null;
  forwardToNumber?: string | null;
  linePurpose: PhoneLinePurpose;
}

export interface UpdateCommunicationProviderData {
  connection?: CommunicationProviderConnection_Key | null;
  auditLog_insert: AuditLog_Key;
}

export interface UpdateCommunicationProviderVariables {
  organizationId: UUIDString;
  id: UUIDString;
  expectedRevision: number;
  displayName: string;
  secretRef?: string | null;
  externalAccountId?: string | null;
}

export interface UpdateCommunicationSettingsData {
  settings?: CommunicationSettings_Key | null;
  auditLog_insert: AuditLog_Key;
}

export interface UpdateCommunicationSettingsVariables {
  organizationId: UUIDString;
  expectedRevision: number;
  timeZone: string;
  callingWindowStart: string;
  callingWindowEnd: string;
  maxCallsPerContactPerDay: number;
  telemarketingEnabled: boolean;
  telemarketingApprovalReference?: string | null;
  marketingWindowStart: string;
  marketingWindowEnd: string;
  marketingMaxCallsPerDay: number;
  marketingMaxUnansweredPerWeek: number;
  allowedCallingCodes: string;
  maxConcurrentLiveCalls: number;
  maxLiveCallsPerAgentPerDay: number;
  recordingEnabled: boolean;
  recordingNoticeText?: string | null;
  recordingLegalBasis?: string | null;
  retentionDays: number;
  aiAnalysisEnabled: boolean;
}

export interface UpdateInboxReplyDraftData {
  job?: OutboundMessageJob_Key | null;
  auditLog_insert: AuditLog_Key;
}

export interface UpdateInboxReplyDraftVariables {
  organizationId: UUIDString;
  id: UUIDString;
  expectedRevision: number;
  content: string;
  versionsJson: string;
}

export interface UpdateMailboxTokenData {
  inboxMailboxAccount_updateMany: number;
}

export interface UpdateMailboxTokenVariables {
  organizationId: UUIDString;
  id: UUIDString;
  previousCiphertext: string;
  tokenCiphertext: string;
  tokenKeyId: string;
}

export interface UpdateMeetingData {
  meeting?: CommunicationMeeting_Key | null;
  auditLog_insert: AuditLog_Key;
}

export interface UpdateMeetingVariables {
  organizationId: UUIDString;
  id: UUIDString;
  expectedRevision: number;
  title: string;
  provider: MeetingProvider;
  meetingUrl?: string | null;
  location?: string | null;
  startsAt: TimestampString;
  endsAt: TimestampString;
  agenda?: string | null;
  notes?: string | null;
}

export interface UpdateVoiceAssistantConfigData {
  config?: VoiceAssistantConfig_Key | null;
  auditLog_insert: AuditLog_Key;
}

export interface UpdateVoiceAssistantConfigVariables {
  organizationId: UUIDString;
  expectedRevision: number;
  status: VoiceAssistantStatus;
  assistantName: string;
  disclosureText: string;
  greeting: string;
  questionsJson: string;
  handoffMessage: string;
  projectIdsJson: string;
  listingIdsJson: string;
  maxTurns: number;
  maxSessionMinutes: number;
  maxReplyTokens: number;
}

export interface UserProfile_Key {
  uid: string;
  __typename?: 'UserProfile_Key';
}

export interface VoiceAssistantConfig_Key {
  organizationId: UUIDString;
  __typename?: 'VoiceAssistantConfig_Key';
}

export interface VoiceAssistantTestSession_Key {
  organizationId: UUIDString;
  id: UUIDString;
  __typename?: 'VoiceAssistantTestSession_Key';
}

export interface WebsiteMedia_Key {
  organizationId: UUIDString;
  id: UUIDString;
  __typename?: 'WebsiteMedia_Key';
}

export interface WebsitePageEnquiry_Key {
  organizationId: UUIDString;
  id: UUIDString;
  __typename?: 'WebsitePageEnquiry_Key';
}

export interface WebsitePage_Key {
  organizationId: UUIDString;
  id: UUIDString;
  __typename?: 'WebsitePage_Key';
}

export interface WebsiteSectionTemplate_Key {
  organizationId: UUIDString;
  id: UUIDString;
  __typename?: 'WebsiteSectionTemplate_Key';
}

export interface Website_Key {
  organizationId: UUIDString;
  id: UUIDString;
  __typename?: 'Website_Key';
}

export interface WhatsAppTemplateConnectionData {
  connection?: {
    id: UUIDString;
    connectionStatus: ChannelConnectionStatus;
    externalAccountReference?: string | null;
    businessAccountReference?: string | null;
    accessTokenReference?: string | null;
    accessTokenStoredAt?: TimestampString | null;
    sendingEnabled: boolean;
    liveSending: boolean;
  };
}

export interface WhatsAppTemplateConnectionVariables {
  organizationId: UUIDString;
  id: UUIDString;
}

export interface WithdrawCallConsentData {
  consent?: CallConsentEvidence_Key | null;
  recordings: number;
  transcripts: number;
  summaries: number;
  auditLog_insert: AuditLog_Key;
}

export interface WithdrawCallConsentVariables {
  organizationId: UUIDString;
  id: UUIDString;
  note: string;
}

export interface WithdrawCommunicationSuppressionData {
  suppression?: CommunicationSuppression_Key | null;
  auditLog_insert: AuditLog_Key;
}

export interface WithdrawCommunicationSuppressionVariables {
  organizationId: UUIDString;
  id: UUIDString;
  reason: string;
}

export interface WorkTask_Key {
  organizationId: UUIDString;
  id: UUIDString;
  __typename?: 'WorkTask_Key';
}

/** Generated Node Admin SDK operation action function for the 'ListCallSummaries' Query. Allow users to execute without passing in DataConnect. */
export function listCallSummaries(dc: DataConnect, vars: ListCallSummariesVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListCallSummariesData>>;
/** Generated Node Admin SDK operation action function for the 'ListCallSummaries' Query. Allow users to pass in custom DataConnect instances. */
export function listCallSummaries(vars: ListCallSummariesVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListCallSummariesData>>;

/** Generated Node Admin SDK operation action function for the 'CreateCallAiSummary' Mutation. Allow users to execute without passing in DataConnect. */
export function createCallAiSummary(dc: DataConnect, vars: CreateCallAiSummaryVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateCallAiSummaryData>>;
/** Generated Node Admin SDK operation action function for the 'CreateCallAiSummary' Mutation. Allow users to pass in custom DataConnect instances. */
export function createCallAiSummary(vars: CreateCallAiSummaryVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateCallAiSummaryData>>;

/** Generated Node Admin SDK operation action function for the 'CreateCallAiSuggestion' Mutation. Allow users to execute without passing in DataConnect. */
export function createCallAiSuggestion(dc: DataConnect, vars: CreateCallAiSuggestionVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateCallAiSuggestionData>>;
/** Generated Node Admin SDK operation action function for the 'CreateCallAiSuggestion' Mutation. Allow users to pass in custom DataConnect instances. */
export function createCallAiSuggestion(vars: CreateCallAiSuggestionVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateCallAiSuggestionData>>;

/** Generated Node Admin SDK operation action function for the 'ReviewCallAiSummary' Mutation. Allow users to execute without passing in DataConnect. */
export function reviewCallAiSummary(dc: DataConnect, vars: ReviewCallAiSummaryVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ReviewCallAiSummaryData>>;
/** Generated Node Admin SDK operation action function for the 'ReviewCallAiSummary' Mutation. Allow users to pass in custom DataConnect instances. */
export function reviewCallAiSummary(vars: ReviewCallAiSummaryVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ReviewCallAiSummaryData>>;

/** Generated Node Admin SDK operation action function for the 'DecideCallAiSuggestion' Mutation. Allow users to execute without passing in DataConnect. */
export function decideCallAiSuggestion(dc: DataConnect, vars: DecideCallAiSuggestionVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<DecideCallAiSuggestionData>>;
/** Generated Node Admin SDK operation action function for the 'DecideCallAiSuggestion' Mutation. Allow users to pass in custom DataConnect instances. */
export function decideCallAiSuggestion(vars: DecideCallAiSuggestionVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<DecideCallAiSuggestionData>>;

/** Generated Node Admin SDK operation action function for the 'GetCallAiSuggestion' Query. Allow users to execute without passing in DataConnect. */
export function getCallAiSuggestion(dc: DataConnect, vars: GetCallAiSuggestionVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetCallAiSuggestionData>>;
/** Generated Node Admin SDK operation action function for the 'GetCallAiSuggestion' Query. Allow users to pass in custom DataConnect instances. */
export function getCallAiSuggestion(vars: GetCallAiSuggestionVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetCallAiSuggestionData>>;

/** Generated Node Admin SDK operation action function for the 'GetCallMedia' Query. Allow users to execute without passing in DataConnect. */
export function getCallMedia(dc: DataConnect, vars: GetCallMediaVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetCallMediaData>>;
/** Generated Node Admin SDK operation action function for the 'GetCallMedia' Query. Allow users to pass in custom DataConnect instances. */
export function getCallMedia(vars: GetCallMediaVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetCallMediaData>>;

/** Generated Node Admin SDK operation action function for the 'RecordCallConsent' Mutation. Allow users to execute without passing in DataConnect. */
export function recordCallConsent(dc: DataConnect, vars: RecordCallConsentVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<RecordCallConsentData>>;
/** Generated Node Admin SDK operation action function for the 'RecordCallConsent' Mutation. Allow users to pass in custom DataConnect instances. */
export function recordCallConsent(vars: RecordCallConsentVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<RecordCallConsentData>>;

/** Generated Node Admin SDK operation action function for the 'WithdrawCallConsent' Mutation. Allow users to execute without passing in DataConnect. */
export function withdrawCallConsent(dc: DataConnect, vars: WithdrawCallConsentVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<WithdrawCallConsentData>>;
/** Generated Node Admin SDK operation action function for the 'WithdrawCallConsent' Mutation. Allow users to pass in custom DataConnect instances. */
export function withdrawCallConsent(vars: WithdrawCallConsentVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<WithdrawCallConsentData>>;

/** Generated Node Admin SDK operation action function for the 'CreateCallRecording' Mutation. Allow users to execute without passing in DataConnect. */
export function createCallRecording(dc: DataConnect, vars: CreateCallRecordingVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateCallRecordingData>>;
/** Generated Node Admin SDK operation action function for the 'CreateCallRecording' Mutation. Allow users to pass in custom DataConnect instances. */
export function createCallRecording(vars: CreateCallRecordingVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateCallRecordingData>>;

/** Generated Node Admin SDK operation action function for the 'CreateCallTranscript' Mutation. Allow users to execute without passing in DataConnect. */
export function createCallTranscript(dc: DataConnect, vars: CreateCallTranscriptVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateCallTranscriptData>>;
/** Generated Node Admin SDK operation action function for the 'CreateCallTranscript' Mutation. Allow users to pass in custom DataConnect instances. */
export function createCallTranscript(vars: CreateCallTranscriptVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateCallTranscriptData>>;

/** Generated Node Admin SDK operation action function for the 'DeleteCallRecording' Mutation. Allow users to execute without passing in DataConnect. */
export function deleteCallRecording(dc: DataConnect, vars: DeleteCallRecordingVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<DeleteCallRecordingData>>;
/** Generated Node Admin SDK operation action function for the 'DeleteCallRecording' Mutation. Allow users to pass in custom DataConnect instances. */
export function deleteCallRecording(vars: DeleteCallRecordingVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<DeleteCallRecordingData>>;

/** Generated Node Admin SDK operation action function for the 'DeleteCallTranscript' Mutation. Allow users to execute without passing in DataConnect. */
export function deleteCallTranscript(dc: DataConnect, vars: DeleteCallTranscriptVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<DeleteCallTranscriptData>>;
/** Generated Node Admin SDK operation action function for the 'DeleteCallTranscript' Mutation. Allow users to pass in custom DataConnect instances. */
export function deleteCallTranscript(vars: DeleteCallTranscriptVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<DeleteCallTranscriptData>>;

/** Generated Node Admin SDK operation action function for the 'GetCallRecordingFile' Query. Allow users to execute without passing in DataConnect. */
export function getCallRecordingFile(dc: DataConnect, vars: GetCallRecordingFileVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetCallRecordingFileData>>;
/** Generated Node Admin SDK operation action function for the 'GetCallRecordingFile' Query. Allow users to pass in custom DataConnect instances. */
export function getCallRecordingFile(vars: GetCallRecordingFileVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetCallRecordingFileData>>;

/** Generated Node Admin SDK operation action function for the 'GetCallTranscriptFile' Query. Allow users to execute without passing in DataConnect. */
export function getCallTranscriptFile(dc: DataConnect, vars: GetCallTranscriptFileVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetCallTranscriptFileData>>;
/** Generated Node Admin SDK operation action function for the 'GetCallTranscriptFile' Query. Allow users to pass in custom DataConnect instances. */
export function getCallTranscriptFile(vars: GetCallTranscriptFileVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetCallTranscriptFileData>>;

/** Generated Node Admin SDK operation action function for the 'RecordCallMediaAccess' Mutation. Allow users to execute without passing in DataConnect. */
export function recordCallMediaAccess(dc: DataConnect, vars: RecordCallMediaAccessVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<RecordCallMediaAccessData>>;
/** Generated Node Admin SDK operation action function for the 'RecordCallMediaAccess' Mutation. Allow users to pass in custom DataConnect instances. */
export function recordCallMediaAccess(vars: RecordCallMediaAccessVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<RecordCallMediaAccessData>>;

/** Generated Node Admin SDK operation action function for the 'CallMediaToRemove' Query. Allow users to execute without passing in DataConnect. */
export function callMediaToRemove(dc: DataConnect, vars: CallMediaToRemoveVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CallMediaToRemoveData>>;
/** Generated Node Admin SDK operation action function for the 'CallMediaToRemove' Query. Allow users to pass in custom DataConnect instances. */
export function callMediaToRemove(vars: CallMediaToRemoveVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CallMediaToRemoveData>>;

/** Generated Node Admin SDK operation action function for the 'ExpireCallRecording' Mutation. Allow users to execute without passing in DataConnect. */
export function expireCallRecording(dc: DataConnect, vars: ExpireCallRecordingVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ExpireCallRecordingData>>;
/** Generated Node Admin SDK operation action function for the 'ExpireCallRecording' Mutation. Allow users to pass in custom DataConnect instances. */
export function expireCallRecording(vars: ExpireCallRecordingVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ExpireCallRecordingData>>;

/** Generated Node Admin SDK operation action function for the 'ExpireCallTranscript' Mutation. Allow users to execute without passing in DataConnect. */
export function expireCallTranscript(dc: DataConnect, vars: ExpireCallTranscriptVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ExpireCallTranscriptData>>;
/** Generated Node Admin SDK operation action function for the 'ExpireCallTranscript' Mutation. Allow users to pass in custom DataConnect instances. */
export function expireCallTranscript(vars: ExpireCallTranscriptVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ExpireCallTranscriptData>>;

/** Generated Node Admin SDK operation action function for the 'MarkCallMediaFileDeleted' Mutation. Allow users to execute without passing in DataConnect. */
export function markCallMediaFileDeleted(dc: DataConnect, vars: MarkCallMediaFileDeletedVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<MarkCallMediaFileDeletedData>>;
/** Generated Node Admin SDK operation action function for the 'MarkCallMediaFileDeleted' Mutation. Allow users to pass in custom DataConnect instances. */
export function markCallMediaFileDeleted(vars: MarkCallMediaFileDeletedVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<MarkCallMediaFileDeletedData>>;

/** Generated Node Admin SDK operation action function for the 'DeletedCallMediaFile' Query. Allow users to execute without passing in DataConnect. */
export function deletedCallMediaFile(dc: DataConnect, vars: DeletedCallMediaFileVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<DeletedCallMediaFileData>>;
/** Generated Node Admin SDK operation action function for the 'DeletedCallMediaFile' Query. Allow users to pass in custom DataConnect instances. */
export function deletedCallMediaFile(vars: DeletedCallMediaFileVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<DeletedCallMediaFileData>>;

/** Generated Node Admin SDK operation action function for the 'ListMeetings' Query. Allow users to execute without passing in DataConnect. */
export function listMeetings(dc: DataConnect, vars: ListMeetingsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListMeetingsData>>;
/** Generated Node Admin SDK operation action function for the 'ListMeetings' Query. Allow users to pass in custom DataConnect instances. */
export function listMeetings(vars: ListMeetingsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListMeetingsData>>;

/** Generated Node Admin SDK operation action function for the 'GetMeeting' Query. Allow users to execute without passing in DataConnect. */
export function getMeeting(dc: DataConnect, vars: GetMeetingVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetMeetingData>>;
/** Generated Node Admin SDK operation action function for the 'GetMeeting' Query. Allow users to pass in custom DataConnect instances. */
export function getMeeting(vars: GetMeetingVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetMeetingData>>;

/** Generated Node Admin SDK operation action function for the 'CreateMeeting' Mutation. Allow users to execute without passing in DataConnect. */
export function createMeeting(dc: DataConnect, vars: CreateMeetingVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateMeetingData>>;
/** Generated Node Admin SDK operation action function for the 'CreateMeeting' Mutation. Allow users to pass in custom DataConnect instances. */
export function createMeeting(vars: CreateMeetingVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateMeetingData>>;

/** Generated Node Admin SDK operation action function for the 'AddMeetingAttendee' Mutation. Allow users to execute without passing in DataConnect. */
export function addMeetingAttendee(dc: DataConnect, vars: AddMeetingAttendeeVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<AddMeetingAttendeeData>>;
/** Generated Node Admin SDK operation action function for the 'AddMeetingAttendee' Mutation. Allow users to pass in custom DataConnect instances. */
export function addMeetingAttendee(vars: AddMeetingAttendeeVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<AddMeetingAttendeeData>>;

/** Generated Node Admin SDK operation action function for the 'RemoveMeetingAttendee' Mutation. Allow users to execute without passing in DataConnect. */
export function removeMeetingAttendee(dc: DataConnect, vars: RemoveMeetingAttendeeVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<RemoveMeetingAttendeeData>>;
/** Generated Node Admin SDK operation action function for the 'RemoveMeetingAttendee' Mutation. Allow users to pass in custom DataConnect instances. */
export function removeMeetingAttendee(vars: RemoveMeetingAttendeeVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<RemoveMeetingAttendeeData>>;

/** Generated Node Admin SDK operation action function for the 'UpdateMeeting' Mutation. Allow users to execute without passing in DataConnect. */
export function updateMeeting(dc: DataConnect, vars: UpdateMeetingVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateMeetingData>>;
/** Generated Node Admin SDK operation action function for the 'UpdateMeeting' Mutation. Allow users to pass in custom DataConnect instances. */
export function updateMeeting(vars: UpdateMeetingVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateMeetingData>>;

/** Generated Node Admin SDK operation action function for the 'CompleteMeeting' Mutation. Allow users to execute without passing in DataConnect. */
export function completeMeeting(dc: DataConnect, vars: CompleteMeetingVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CompleteMeetingData>>;
/** Generated Node Admin SDK operation action function for the 'CompleteMeeting' Mutation. Allow users to pass in custom DataConnect instances. */
export function completeMeeting(vars: CompleteMeetingVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CompleteMeetingData>>;

/** Generated Node Admin SDK operation action function for the 'SetMeetingStatus' Mutation. Allow users to execute without passing in DataConnect. */
export function setMeetingStatus(dc: DataConnect, vars: SetMeetingStatusVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<SetMeetingStatusData>>;
/** Generated Node Admin SDK operation action function for the 'SetMeetingStatus' Mutation. Allow users to pass in custom DataConnect instances. */
export function setMeetingStatus(vars: SetMeetingStatusVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<SetMeetingStatusData>>;

/** Generated Node Admin SDK operation action function for the 'SaveMeetingSummary' Mutation. Allow users to execute without passing in DataConnect. */
export function saveMeetingSummary(dc: DataConnect, vars: SaveMeetingSummaryVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<SaveMeetingSummaryData>>;
/** Generated Node Admin SDK operation action function for the 'SaveMeetingSummary' Mutation. Allow users to pass in custom DataConnect instances. */
export function saveMeetingSummary(vars: SaveMeetingSummaryVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<SaveMeetingSummaryData>>;

/** Generated Node Admin SDK operation action function for the 'DecideMeetingSuggestion' Mutation. Allow users to execute without passing in DataConnect. */
export function decideMeetingSuggestion(dc: DataConnect, vars: DecideMeetingSuggestionVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<DecideMeetingSuggestionData>>;
/** Generated Node Admin SDK operation action function for the 'DecideMeetingSuggestion' Mutation. Allow users to pass in custom DataConnect instances. */
export function decideMeetingSuggestion(vars: DecideMeetingSuggestionVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<DecideMeetingSuggestionData>>;

/** Generated Node Admin SDK operation action function for the 'ListMeetingAttendeeOptions' Query. Allow users to execute without passing in DataConnect. */
export function listMeetingAttendeeOptions(dc: DataConnect, vars: ListMeetingAttendeeOptionsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListMeetingAttendeeOptionsData>>;
/** Generated Node Admin SDK operation action function for the 'ListMeetingAttendeeOptions' Query. Allow users to pass in custom DataConnect instances. */
export function listMeetingAttendeeOptions(vars: ListMeetingAttendeeOptionsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListMeetingAttendeeOptionsData>>;

/** Generated Node Admin SDK operation action function for the 'ListCommunicationProviders' Query. Allow users to execute without passing in DataConnect. */
export function listCommunicationProviders(dc: DataConnect, vars: ListCommunicationProvidersVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListCommunicationProvidersData>>;
/** Generated Node Admin SDK operation action function for the 'ListCommunicationProviders' Query. Allow users to pass in custom DataConnect instances. */
export function listCommunicationProviders(vars: ListCommunicationProvidersVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListCommunicationProvidersData>>;

/** Generated Node Admin SDK operation action function for the 'CreateCommunicationProvider' Mutation. Allow users to execute without passing in DataConnect. */
export function createCommunicationProvider(dc: DataConnect, vars: CreateCommunicationProviderVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateCommunicationProviderData>>;
/** Generated Node Admin SDK operation action function for the 'CreateCommunicationProvider' Mutation. Allow users to pass in custom DataConnect instances. */
export function createCommunicationProvider(vars: CreateCommunicationProviderVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateCommunicationProviderData>>;

/** Generated Node Admin SDK operation action function for the 'UpdateCommunicationProvider' Mutation. Allow users to execute without passing in DataConnect. */
export function updateCommunicationProvider(dc: DataConnect, vars: UpdateCommunicationProviderVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateCommunicationProviderData>>;
/** Generated Node Admin SDK operation action function for the 'UpdateCommunicationProvider' Mutation. Allow users to pass in custom DataConnect instances. */
export function updateCommunicationProvider(vars: UpdateCommunicationProviderVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateCommunicationProviderData>>;

/** Generated Node Admin SDK operation action function for the 'SetCommunicationProviderEnabled' Mutation. Allow users to execute without passing in DataConnect. */
export function setCommunicationProviderEnabled(dc: DataConnect, vars: SetCommunicationProviderEnabledVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<SetCommunicationProviderEnabledData>>;
/** Generated Node Admin SDK operation action function for the 'SetCommunicationProviderEnabled' Mutation. Allow users to pass in custom DataConnect instances. */
export function setCommunicationProviderEnabled(vars: SetCommunicationProviderEnabledVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<SetCommunicationProviderEnabledData>>;

/** Generated Node Admin SDK operation action function for the 'RecordCommunicationProviderVerification' Mutation. Allow users to execute without passing in DataConnect. */
export function recordCommunicationProviderVerification(dc: DataConnect, vars: RecordCommunicationProviderVerificationVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<RecordCommunicationProviderVerificationData>>;
/** Generated Node Admin SDK operation action function for the 'RecordCommunicationProviderVerification' Mutation. Allow users to pass in custom DataConnect instances. */
export function recordCommunicationProviderVerification(vars: RecordCommunicationProviderVerificationVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<RecordCommunicationProviderVerificationData>>;

/** Generated Node Admin SDK operation action function for the 'AttestLiveCalling' Mutation. Allow users to execute without passing in DataConnect. */
export function attestLiveCalling(dc: DataConnect, vars: AttestLiveCallingVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<AttestLiveCallingData>>;
/** Generated Node Admin SDK operation action function for the 'AttestLiveCalling' Mutation. Allow users to pass in custom DataConnect instances. */
export function attestLiveCalling(vars: AttestLiveCallingVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<AttestLiveCallingData>>;

/** Generated Node Admin SDK operation action function for the 'RevokeLiveCallingAttestation' Mutation. Allow users to execute without passing in DataConnect. */
export function revokeLiveCallingAttestation(dc: DataConnect, vars: RevokeLiveCallingAttestationVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<RevokeLiveCallingAttestationData>>;
/** Generated Node Admin SDK operation action function for the 'RevokeLiveCallingAttestation' Mutation. Allow users to pass in custom DataConnect instances. */
export function revokeLiveCallingAttestation(vars: RevokeLiveCallingAttestationVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<RevokeLiveCallingAttestationData>>;

/** Generated Node Admin SDK operation action function for the 'CreateCommunicationPhoneLine' Mutation. Allow users to execute without passing in DataConnect. */
export function createCommunicationPhoneLine(dc: DataConnect, vars: CreateCommunicationPhoneLineVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateCommunicationPhoneLineData>>;
/** Generated Node Admin SDK operation action function for the 'CreateCommunicationPhoneLine' Mutation. Allow users to pass in custom DataConnect instances. */
export function createCommunicationPhoneLine(vars: CreateCommunicationPhoneLineVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateCommunicationPhoneLineData>>;

/** Generated Node Admin SDK operation action function for the 'UpdateCommunicationPhoneLine' Mutation. Allow users to execute without passing in DataConnect. */
export function updateCommunicationPhoneLine(dc: DataConnect, vars: UpdateCommunicationPhoneLineVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateCommunicationPhoneLineData>>;
/** Generated Node Admin SDK operation action function for the 'UpdateCommunicationPhoneLine' Mutation. Allow users to pass in custom DataConnect instances. */
export function updateCommunicationPhoneLine(vars: UpdateCommunicationPhoneLineVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateCommunicationPhoneLineData>>;

/** Generated Node Admin SDK operation action function for the 'ConfirmPhoneLineRegistration' Mutation. Allow users to execute without passing in DataConnect. */
export function confirmPhoneLineRegistration(dc: DataConnect, vars: ConfirmPhoneLineRegistrationVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ConfirmPhoneLineRegistrationData>>;
/** Generated Node Admin SDK operation action function for the 'ConfirmPhoneLineRegistration' Mutation. Allow users to pass in custom DataConnect instances. */
export function confirmPhoneLineRegistration(vars: ConfirmPhoneLineRegistrationVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ConfirmPhoneLineRegistrationData>>;

/** Generated Node Admin SDK operation action function for the 'SetPhoneLineActive' Mutation. Allow users to execute without passing in DataConnect. */
export function setPhoneLineActive(dc: DataConnect, vars: SetPhoneLineActiveVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<SetPhoneLineActiveData>>;
/** Generated Node Admin SDK operation action function for the 'SetPhoneLineActive' Mutation. Allow users to pass in custom DataConnect instances. */
export function setPhoneLineActive(vars: SetPhoneLineActiveVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<SetPhoneLineActiveData>>;

/** Generated Node Admin SDK operation action function for the 'ProviderConnectionForWebhook' Query. Allow users to execute without passing in DataConnect. */
export function providerConnectionForWebhook(dc: DataConnect, vars: ProviderConnectionForWebhookVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ProviderConnectionForWebhookData>>;
/** Generated Node Admin SDK operation action function for the 'ProviderConnectionForWebhook' Query. Allow users to pass in custom DataConnect instances. */
export function providerConnectionForWebhook(vars: ProviderConnectionForWebhookVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ProviderConnectionForWebhookData>>;

/** Generated Node Admin SDK operation action function for the 'RecordCallProviderEvent' Mutation. Allow users to execute without passing in DataConnect. */
export function recordCallProviderEvent(dc: DataConnect, vars: RecordCallProviderEventVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<RecordCallProviderEventData>>;
/** Generated Node Admin SDK operation action function for the 'RecordCallProviderEvent' Mutation. Allow users to pass in custom DataConnect instances. */
export function recordCallProviderEvent(vars: RecordCallProviderEventVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<RecordCallProviderEventData>>;

/** Generated Node Admin SDK operation action function for the 'MarkCallProviderEvent' Mutation. Allow users to execute without passing in DataConnect. */
export function markCallProviderEvent(dc: DataConnect, vars: MarkCallProviderEventVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<MarkCallProviderEventData>>;
/** Generated Node Admin SDK operation action function for the 'MarkCallProviderEvent' Mutation. Allow users to pass in custom DataConnect instances. */
export function markCallProviderEvent(vars: MarkCallProviderEventVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<MarkCallProviderEventData>>;

/** Generated Node Admin SDK operation action function for the 'ResolveProviderCall' Query. Allow users to execute without passing in DataConnect. */
export function resolveProviderCall(dc: DataConnect, vars: ResolveProviderCallVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ResolveProviderCallData>>;
/** Generated Node Admin SDK operation action function for the 'ResolveProviderCall' Query. Allow users to pass in custom DataConnect instances. */
export function resolveProviderCall(vars: ResolveProviderCallVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ResolveProviderCallData>>;

/** Generated Node Admin SDK operation action function for the 'CreateIncomingProviderCall' Mutation. Allow users to execute without passing in DataConnect. */
export function createIncomingProviderCall(dc: DataConnect, vars: CreateIncomingProviderCallVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateIncomingProviderCallData>>;
/** Generated Node Admin SDK operation action function for the 'CreateIncomingProviderCall' Mutation. Allow users to pass in custom DataConnect instances. */
export function createIncomingProviderCall(vars: CreateIncomingProviderCallVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateIncomingProviderCallData>>;

/** Generated Node Admin SDK operation action function for the 'ApplyProviderCallStatus' Mutation. Allow users to execute without passing in DataConnect. */
export function applyProviderCallStatus(dc: DataConnect, vars: ApplyProviderCallStatusVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ApplyProviderCallStatusData>>;
/** Generated Node Admin SDK operation action function for the 'ApplyProviderCallStatus' Mutation. Allow users to pass in custom DataConnect instances. */
export function applyProviderCallStatus(vars: ApplyProviderCallStatusVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ApplyProviderCallStatusData>>;

/** Generated Node Admin SDK operation action function for the 'SetProviderCallId' Mutation. Allow users to execute without passing in DataConnect. */
export function setProviderCallId(dc: DataConnect, vars: SetProviderCallIdVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<SetProviderCallIdData>>;
/** Generated Node Admin SDK operation action function for the 'SetProviderCallId' Mutation. Allow users to pass in custom DataConnect instances. */
export function setProviderCallId(vars: SetProviderCallIdVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<SetProviderCallIdData>>;

/** Generated Node Admin SDK operation action function for the 'ProviderCallForControl' Query. Allow users to execute without passing in DataConnect. */
export function providerCallForControl(dc: DataConnect, vars: ProviderCallForControlVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ProviderCallForControlData>>;
/** Generated Node Admin SDK operation action function for the 'ProviderCallForControl' Query. Allow users to pass in custom DataConnect instances. */
export function providerCallForControl(vars: ProviderCallForControlVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ProviderCallForControlData>>;

/** Generated Node Admin SDK operation action function for the 'DialFacts' Query. Allow users to execute without passing in DataConnect. */
export function dialFacts(dc: DataConnect, vars: DialFactsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<DialFactsData>>;
/** Generated Node Admin SDK operation action function for the 'DialFacts' Query. Allow users to pass in custom DataConnect instances. */
export function dialFacts(vars: DialFactsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<DialFactsData>>;

/** Generated Node Admin SDK operation action function for the 'StartLeadCall' Mutation. Allow users to execute without passing in DataConnect. */
export function startLeadCall(dc: DataConnect, vars: StartLeadCallVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<StartLeadCallData>>;
/** Generated Node Admin SDK operation action function for the 'StartLeadCall' Mutation. Allow users to pass in custom DataConnect instances. */
export function startLeadCall(vars: StartLeadCallVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<StartLeadCallData>>;

/** Generated Node Admin SDK operation action function for the 'ListCalls' Query. Allow users to execute without passing in DataConnect. */
export function listCalls(dc: DataConnect, vars: ListCallsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListCallsData>>;
/** Generated Node Admin SDK operation action function for the 'ListCalls' Query. Allow users to pass in custom DataConnect instances. */
export function listCalls(vars: ListCallsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListCallsData>>;

/** Generated Node Admin SDK operation action function for the 'CommunicationDashboard' Query. Allow users to execute without passing in DataConnect. */
export function communicationDashboard(dc: DataConnect, vars: CommunicationDashboardVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CommunicationDashboardData>>;
/** Generated Node Admin SDK operation action function for the 'CommunicationDashboard' Query. Allow users to pass in custom DataConnect instances. */
export function communicationDashboard(vars: CommunicationDashboardVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CommunicationDashboardData>>;

/** Generated Node Admin SDK operation action function for the 'CommunicationReport' Query. Allow users to execute without passing in DataConnect. */
export function communicationReport(dc: DataConnect, vars: CommunicationReportVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CommunicationReportData>>;
/** Generated Node Admin SDK operation action function for the 'CommunicationReport' Query. Allow users to pass in custom DataConnect instances. */
export function communicationReport(vars: CommunicationReportVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CommunicationReportData>>;

/** Generated Node Admin SDK operation action function for the 'CommunicationSimulationState' Query. Allow users to execute without passing in DataConnect. */
export function communicationSimulationState(dc: DataConnect, vars: CommunicationSimulationStateVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CommunicationSimulationStateData>>;
/** Generated Node Admin SDK operation action function for the 'CommunicationSimulationState' Query. Allow users to pass in custom DataConnect instances. */
export function communicationSimulationState(vars: CommunicationSimulationStateVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CommunicationSimulationStateData>>;

/** Generated Node Admin SDK operation action function for the 'RegisterSimulationLead' Mutation. Allow users to execute without passing in DataConnect. */
export function registerSimulationLead(dc: DataConnect, vars: RegisterSimulationLeadVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<RegisterSimulationLeadData>>;
/** Generated Node Admin SDK operation action function for the 'RegisterSimulationLead' Mutation. Allow users to pass in custom DataConnect instances. */
export function registerSimulationLead(vars: RegisterSimulationLeadVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<RegisterSimulationLeadData>>;

/** Generated Node Admin SDK operation action function for the 'CreateSimulatedCall' Mutation. Allow users to execute without passing in DataConnect. */
export function createSimulatedCall(dc: DataConnect, vars: CreateSimulatedCallVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateSimulatedCallData>>;
/** Generated Node Admin SDK operation action function for the 'CreateSimulatedCall' Mutation. Allow users to pass in custom DataConnect instances. */
export function createSimulatedCall(vars: CreateSimulatedCallVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateSimulatedCallData>>;

/** Generated Node Admin SDK operation action function for the 'ApplySimulatedCallStatus' Mutation. Allow users to execute without passing in DataConnect. */
export function applySimulatedCallStatus(dc: DataConnect, vars: ApplySimulatedCallStatusVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ApplySimulatedCallStatusData>>;
/** Generated Node Admin SDK operation action function for the 'ApplySimulatedCallStatus' Mutation. Allow users to pass in custom DataConnect instances. */
export function applySimulatedCallStatus(vars: ApplySimulatedCallStatusVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ApplySimulatedCallStatusData>>;

/** Generated Node Admin SDK operation action function for the 'SimulatedCallFiles' Query. Allow users to execute without passing in DataConnect. */
export function simulatedCallFiles(dc: DataConnect, vars: SimulatedCallFilesVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<SimulatedCallFilesData>>;
/** Generated Node Admin SDK operation action function for the 'SimulatedCallFiles' Query. Allow users to pass in custom DataConnect instances. */
export function simulatedCallFiles(vars: SimulatedCallFilesVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<SimulatedCallFilesData>>;

/** Generated Node Admin SDK operation action function for the 'ResetCommunicationSimulation' Mutation. Allow users to execute without passing in DataConnect. */
export function resetCommunicationSimulation(dc: DataConnect, vars: ResetCommunicationSimulationVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ResetCommunicationSimulationData>>;
/** Generated Node Admin SDK operation action function for the 'ResetCommunicationSimulation' Mutation. Allow users to pass in custom DataConnect instances. */
export function resetCommunicationSimulation(vars: ResetCommunicationSimulationVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ResetCommunicationSimulationData>>;

/** Generated Node Admin SDK operation action function for the 'GetVoiceAssistant' Query. Allow users to execute without passing in DataConnect. */
export function getVoiceAssistant(dc: DataConnect, vars: GetVoiceAssistantVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetVoiceAssistantData>>;
/** Generated Node Admin SDK operation action function for the 'GetVoiceAssistant' Query. Allow users to pass in custom DataConnect instances. */
export function getVoiceAssistant(vars: GetVoiceAssistantVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetVoiceAssistantData>>;

/** Generated Node Admin SDK operation action function for the 'CreateVoiceAssistantConfig' Mutation. Allow users to execute without passing in DataConnect. */
export function createVoiceAssistantConfig(dc: DataConnect, vars: CreateVoiceAssistantConfigVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateVoiceAssistantConfigData>>;
/** Generated Node Admin SDK operation action function for the 'CreateVoiceAssistantConfig' Mutation. Allow users to pass in custom DataConnect instances. */
export function createVoiceAssistantConfig(vars: CreateVoiceAssistantConfigVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateVoiceAssistantConfigData>>;

/** Generated Node Admin SDK operation action function for the 'UpdateVoiceAssistantConfig' Mutation. Allow users to execute without passing in DataConnect. */
export function updateVoiceAssistantConfig(dc: DataConnect, vars: UpdateVoiceAssistantConfigVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateVoiceAssistantConfigData>>;
/** Generated Node Admin SDK operation action function for the 'UpdateVoiceAssistantConfig' Mutation. Allow users to pass in custom DataConnect instances. */
export function updateVoiceAssistantConfig(vars: UpdateVoiceAssistantConfigVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateVoiceAssistantConfigData>>;

/** Generated Node Admin SDK operation action function for the 'GetVoiceTestSession' Query. Allow users to execute without passing in DataConnect. */
export function getVoiceTestSession(dc: DataConnect, vars: GetVoiceTestSessionVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetVoiceTestSessionData>>;
/** Generated Node Admin SDK operation action function for the 'GetVoiceTestSession' Query. Allow users to pass in custom DataConnect instances. */
export function getVoiceTestSession(vars: GetVoiceTestSessionVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetVoiceTestSessionData>>;

/** Generated Node Admin SDK operation action function for the 'StartVoiceTestSession' Mutation. Allow users to execute without passing in DataConnect. */
export function startVoiceTestSession(dc: DataConnect, vars: StartVoiceTestSessionVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<StartVoiceTestSessionData>>;
/** Generated Node Admin SDK operation action function for the 'StartVoiceTestSession' Mutation. Allow users to pass in custom DataConnect instances. */
export function startVoiceTestSession(vars: StartVoiceTestSessionVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<StartVoiceTestSessionData>>;

/** Generated Node Admin SDK operation action function for the 'SaveVoiceTestSession' Mutation. Allow users to execute without passing in DataConnect. */
export function saveVoiceTestSession(dc: DataConnect, vars: SaveVoiceTestSessionVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<SaveVoiceTestSessionData>>;
/** Generated Node Admin SDK operation action function for the 'SaveVoiceTestSession' Mutation. Allow users to pass in custom DataConnect instances. */
export function saveVoiceTestSession(vars: SaveVoiceTestSessionVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<SaveVoiceTestSessionData>>;

/** Generated Node Admin SDK operation action function for the 'LogLeadCall' Mutation. Allow users to execute without passing in DataConnect. */
export function logLeadCall(dc: DataConnect, vars: LogLeadCallVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<LogLeadCallData>>;
/** Generated Node Admin SDK operation action function for the 'LogLeadCall' Mutation. Allow users to pass in custom DataConnect instances. */
export function logLeadCall(vars: LogLeadCallVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<LogLeadCallData>>;

/** Generated Node Admin SDK operation action function for the 'LogContactCall' Mutation. Allow users to execute without passing in DataConnect. */
export function logContactCall(dc: DataConnect, vars: LogContactCallVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<LogContactCallData>>;
/** Generated Node Admin SDK operation action function for the 'LogContactCall' Mutation. Allow users to pass in custom DataConnect instances. */
export function logContactCall(vars: LogContactCallVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<LogContactCallData>>;

/** Generated Node Admin SDK operation action function for the 'UpdateCallRecord' Mutation. Allow users to execute without passing in DataConnect. */
export function updateCallRecord(dc: DataConnect, vars: UpdateCallRecordVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateCallRecordData>>;
/** Generated Node Admin SDK operation action function for the 'UpdateCallRecord' Mutation. Allow users to pass in custom DataConnect instances. */
export function updateCallRecord(vars: UpdateCallRecordVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateCallRecordData>>;

/** Generated Node Admin SDK operation action function for the 'LinkCallFollowUp' Mutation. Allow users to execute without passing in DataConnect. */
export function linkCallFollowUp(dc: DataConnect, vars: LinkCallFollowUpVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<LinkCallFollowUpData>>;
/** Generated Node Admin SDK operation action function for the 'LinkCallFollowUp' Mutation. Allow users to pass in custom DataConnect instances. */
export function linkCallFollowUp(vars: LinkCallFollowUpVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<LinkCallFollowUpData>>;

/** Generated Node Admin SDK operation action function for the 'GetCallRecord' Query. Allow users to execute without passing in DataConnect. */
export function getCallRecord(dc: DataConnect, vars: GetCallRecordVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetCallRecordData>>;
/** Generated Node Admin SDK operation action function for the 'GetCallRecord' Query. Allow users to pass in custom DataConnect instances. */
export function getCallRecord(vars: GetCallRecordVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetCallRecordData>>;

/** Generated Node Admin SDK operation action function for the 'ListLeadCalls' Query. Allow users to execute without passing in DataConnect. */
export function listLeadCalls(dc: DataConnect, vars: ListLeadCallsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListLeadCallsData>>;
/** Generated Node Admin SDK operation action function for the 'ListLeadCalls' Query. Allow users to pass in custom DataConnect instances. */
export function listLeadCalls(vars: ListLeadCallsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListLeadCallsData>>;

/** Generated Node Admin SDK operation action function for the 'ListContactCalls' Query. Allow users to execute without passing in DataConnect. */
export function listContactCalls(dc: DataConnect, vars: ListContactCallsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListContactCallsData>>;
/** Generated Node Admin SDK operation action function for the 'ListContactCalls' Query. Allow users to pass in custom DataConnect instances. */
export function listContactCalls(vars: ListContactCallsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListContactCallsData>>;

/** Generated Node Admin SDK operation action function for the 'CallComplianceFacts' Query. Allow users to execute without passing in DataConnect. */
export function callComplianceFacts(dc: DataConnect, vars: CallComplianceFactsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CallComplianceFactsData>>;
/** Generated Node Admin SDK operation action function for the 'CallComplianceFacts' Query. Allow users to pass in custom DataConnect instances. */
export function callComplianceFacts(vars: CallComplianceFactsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CallComplianceFactsData>>;

/** Generated Node Admin SDK operation action function for the 'GetCommunicationSettings' Query. Allow users to execute without passing in DataConnect. */
export function getCommunicationSettings(dc: DataConnect, vars: GetCommunicationSettingsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetCommunicationSettingsData>>;
/** Generated Node Admin SDK operation action function for the 'GetCommunicationSettings' Query. Allow users to pass in custom DataConnect instances. */
export function getCommunicationSettings(vars: GetCommunicationSettingsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetCommunicationSettingsData>>;

/** Generated Node Admin SDK operation action function for the 'CreateCommunicationSettings' Mutation. Allow users to execute without passing in DataConnect. */
export function createCommunicationSettings(dc: DataConnect, vars: CreateCommunicationSettingsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateCommunicationSettingsData>>;
/** Generated Node Admin SDK operation action function for the 'CreateCommunicationSettings' Mutation. Allow users to pass in custom DataConnect instances. */
export function createCommunicationSettings(vars: CreateCommunicationSettingsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateCommunicationSettingsData>>;

/** Generated Node Admin SDK operation action function for the 'UpdateCommunicationSettings' Mutation. Allow users to execute without passing in DataConnect. */
export function updateCommunicationSettings(dc: DataConnect, vars: UpdateCommunicationSettingsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateCommunicationSettingsData>>;
/** Generated Node Admin SDK operation action function for the 'UpdateCommunicationSettings' Mutation. Allow users to pass in custom DataConnect instances. */
export function updateCommunicationSettings(vars: UpdateCommunicationSettingsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateCommunicationSettingsData>>;

/** Generated Node Admin SDK operation action function for the 'ListCommunicationSuppressions' Query. Allow users to execute without passing in DataConnect. */
export function listCommunicationSuppressions(dc: DataConnect, vars: ListCommunicationSuppressionsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListCommunicationSuppressionsData>>;
/** Generated Node Admin SDK operation action function for the 'ListCommunicationSuppressions' Query. Allow users to pass in custom DataConnect instances. */
export function listCommunicationSuppressions(vars: ListCommunicationSuppressionsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListCommunicationSuppressionsData>>;

/** Generated Node Admin SDK operation action function for the 'AddCommunicationSuppression' Mutation. Allow users to execute without passing in DataConnect. */
export function addCommunicationSuppression(dc: DataConnect, vars: AddCommunicationSuppressionVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<AddCommunicationSuppressionData>>;
/** Generated Node Admin SDK operation action function for the 'AddCommunicationSuppression' Mutation. Allow users to pass in custom DataConnect instances. */
export function addCommunicationSuppression(vars: AddCommunicationSuppressionVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<AddCommunicationSuppressionData>>;

/** Generated Node Admin SDK operation action function for the 'WithdrawCommunicationSuppression' Mutation. Allow users to execute without passing in DataConnect. */
export function withdrawCommunicationSuppression(dc: DataConnect, vars: WithdrawCommunicationSuppressionVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<WithdrawCommunicationSuppressionData>>;
/** Generated Node Admin SDK operation action function for the 'WithdrawCommunicationSuppression' Mutation. Allow users to pass in custom DataConnect instances. */
export function withdrawCommunicationSuppression(vars: WithdrawCommunicationSuppressionVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<WithdrawCommunicationSuppressionData>>;

/** Generated Node Admin SDK operation action function for the 'InboxReplyFacts' Query. Allow users to execute without passing in DataConnect. */
export function inboxReplyFacts(dc: DataConnect, vars: InboxReplyFactsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<InboxReplyFactsData>>;
/** Generated Node Admin SDK operation action function for the 'InboxReplyFacts' Query. Allow users to pass in custom DataConnect instances. */
export function inboxReplyFacts(vars: InboxReplyFactsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<InboxReplyFactsData>>;

/** Generated Node Admin SDK operation action function for the 'InboxContactRestrictions' Query. Allow users to execute without passing in DataConnect. */
export function inboxContactRestrictions(dc: DataConnect, vars: InboxContactRestrictionsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<InboxContactRestrictionsData>>;
/** Generated Node Admin SDK operation action function for the 'InboxContactRestrictions' Query. Allow users to pass in custom DataConnect instances. */
export function inboxContactRestrictions(vars: InboxContactRestrictionsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<InboxContactRestrictionsData>>;

/** Generated Node Admin SDK operation action function for the 'QueueInboxReply' Mutation. Allow users to execute without passing in DataConnect. */
export function queueInboxReply(dc: DataConnect, vars: QueueInboxReplyVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<QueueInboxReplyData>>;
/** Generated Node Admin SDK operation action function for the 'QueueInboxReply' Mutation. Allow users to pass in custom DataConnect instances. */
export function queueInboxReply(vars: QueueInboxReplyVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<QueueInboxReplyData>>;

/** Generated Node Admin SDK operation action function for the 'AcknowledgeInboxReply' Mutation. Allow users to execute without passing in DataConnect. */
export function acknowledgeInboxReply(dc: DataConnect, vars: AcknowledgeInboxReplyVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<AcknowledgeInboxReplyData>>;
/** Generated Node Admin SDK operation action function for the 'AcknowledgeInboxReply' Mutation. Allow users to pass in custom DataConnect instances. */
export function acknowledgeInboxReply(vars: AcknowledgeInboxReplyVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<AcknowledgeInboxReplyData>>;

/** Generated Node Admin SDK operation action function for the 'FailInboxReply' Mutation. Allow users to execute without passing in DataConnect. */
export function failInboxReply(dc: DataConnect, vars: FailInboxReplyVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<FailInboxReplyData>>;
/** Generated Node Admin SDK operation action function for the 'FailInboxReply' Mutation. Allow users to pass in custom DataConnect instances. */
export function failInboxReply(vars: FailInboxReplyVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<FailInboxReplyData>>;

/** Generated Node Admin SDK operation action function for the 'SaveInboxAiInsight' Mutation. Allow users to execute without passing in DataConnect. */
export function saveInboxAiInsight(dc: DataConnect, vars: SaveInboxAiInsightVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<SaveInboxAiInsightData>>;
/** Generated Node Admin SDK operation action function for the 'SaveInboxAiInsight' Mutation. Allow users to pass in custom DataConnect instances. */
export function saveInboxAiInsight(vars: SaveInboxAiInsightVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<SaveInboxAiInsightData>>;

/** Generated Node Admin SDK operation action function for the 'InboxUnansweredMinutes' Query. Allow users to execute without passing in DataConnect. */
export function inboxUnansweredMinutes(dc: DataConnect, vars: InboxUnansweredMinutesVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<InboxUnansweredMinutesData>>;
/** Generated Node Admin SDK operation action function for the 'InboxUnansweredMinutes' Query. Allow users to pass in custom DataConnect instances. */
export function inboxUnansweredMinutes(vars: InboxUnansweredMinutesVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<InboxUnansweredMinutesData>>;

/** Generated Node Admin SDK operation action function for the 'UnansweredInboxCandidates' Query. Allow users to execute without passing in DataConnect. */
export function unansweredInboxCandidates(dc: DataConnect, vars: UnansweredInboxCandidatesVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UnansweredInboxCandidatesData>>;
/** Generated Node Admin SDK operation action function for the 'UnansweredInboxCandidates' Query. Allow users to pass in custom DataConnect instances. */
export function unansweredInboxCandidates(vars: UnansweredInboxCandidatesVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UnansweredInboxCandidatesData>>;

/** Generated Node Admin SDK operation action function for the 'AutomationConversationState' Query. Allow users to execute without passing in DataConnect. */
export function automationConversationState(dc: DataConnect, vars: AutomationConversationStateVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<AutomationConversationStateData>>;
/** Generated Node Admin SDK operation action function for the 'AutomationConversationState' Query. Allow users to pass in custom DataConnect instances. */
export function automationConversationState(vars: AutomationConversationStateVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<AutomationConversationStateData>>;

/** Generated Node Admin SDK operation action function for the 'InboxRetentionRules' Query. Allow users to execute without passing in DataConnect. */
export function inboxRetentionRules(dc: DataConnect, options?: OperationOptions): Promise<ExecuteOperationResponse<InboxRetentionRulesData>>;
/** Generated Node Admin SDK operation action function for the 'InboxRetentionRules' Query. Allow users to pass in custom DataConnect instances. */
export function inboxRetentionRules(options?: OperationOptions): Promise<ExecuteOperationResponse<InboxRetentionRulesData>>;

/** Generated Node Admin SDK operation action function for the 'InboxRetentionCandidates' Query. Allow users to execute without passing in DataConnect. */
export function inboxRetentionCandidates(dc: DataConnect, vars: InboxRetentionCandidatesVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<InboxRetentionCandidatesData>>;
/** Generated Node Admin SDK operation action function for the 'InboxRetentionCandidates' Query. Allow users to pass in custom DataConnect instances. */
export function inboxRetentionCandidates(vars: InboxRetentionCandidatesVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<InboxRetentionCandidatesData>>;

/** Generated Node Admin SDK operation action function for the 'ApplyInboxRetention' Mutation. Allow users to execute without passing in DataConnect. */
export function applyInboxRetention(dc: DataConnect, vars: ApplyInboxRetentionVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ApplyInboxRetentionData>>;
/** Generated Node Admin SDK operation action function for the 'ApplyInboxRetention' Mutation. Allow users to pass in custom DataConnect instances. */
export function applyInboxRetention(vars: ApplyInboxRetentionVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ApplyInboxRetentionData>>;

/** Generated Node Admin SDK operation action function for the 'EmailReplyThread' Query. Allow users to execute without passing in DataConnect. */
export function emailReplyThread(dc: DataConnect, vars: EmailReplyThreadVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<EmailReplyThreadData>>;
/** Generated Node Admin SDK operation action function for the 'EmailReplyThread' Query. Allow users to pass in custom DataConnect instances. */
export function emailReplyThread(vars: EmailReplyThreadVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<EmailReplyThreadData>>;

/** Generated Node Admin SDK operation action function for the 'InboxInsightDraft' Query. Allow users to execute without passing in DataConnect. */
export function inboxInsightDraft(dc: DataConnect, vars: InboxInsightDraftVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<InboxInsightDraftData>>;
/** Generated Node Admin SDK operation action function for the 'InboxInsightDraft' Query. Allow users to pass in custom DataConnect instances. */
export function inboxInsightDraft(vars: InboxInsightDraftVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<InboxInsightDraftData>>;

/** Generated Node Admin SDK operation action function for the 'CreateClaudeReplyFromInsight' Mutation. Allow users to execute without passing in DataConnect. */
export function createClaudeReplyFromInsight(dc: DataConnect, vars: CreateClaudeReplyFromInsightVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateClaudeReplyFromInsightData>>;
/** Generated Node Admin SDK operation action function for the 'CreateClaudeReplyFromInsight' Mutation. Allow users to pass in custom DataConnect instances. */
export function createClaudeReplyFromInsight(vars: CreateClaudeReplyFromInsightVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateClaudeReplyFromInsightData>>;

/** Generated Node Admin SDK operation action function for the 'MatchInboxIdentity' Query. Allow users to execute without passing in DataConnect. */
export function matchInboxIdentity(dc: DataConnect, vars: MatchInboxIdentityVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<MatchInboxIdentityData>>;
/** Generated Node Admin SDK operation action function for the 'MatchInboxIdentity' Query. Allow users to pass in custom DataConnect instances. */
export function matchInboxIdentity(vars: MatchInboxIdentityVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<MatchInboxIdentityData>>;

/** Generated Node Admin SDK operation action function for the 'FindInboxConversation' Query. Allow users to execute without passing in DataConnect. */
export function findInboxConversation(dc: DataConnect, vars: FindInboxConversationVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<FindInboxConversationData>>;
/** Generated Node Admin SDK operation action function for the 'FindInboxConversation' Query. Allow users to pass in custom DataConnect instances. */
export function findInboxConversation(vars: FindInboxConversationVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<FindInboxConversationData>>;

/** Generated Node Admin SDK operation action function for the 'CreateInboxConversationWithMessage' Mutation. Allow users to execute without passing in DataConnect. */
export function createInboxConversationWithMessage(dc: DataConnect, vars: CreateInboxConversationWithMessageVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateInboxConversationWithMessageData>>;
/** Generated Node Admin SDK operation action function for the 'CreateInboxConversationWithMessage' Mutation. Allow users to pass in custom DataConnect instances. */
export function createInboxConversationWithMessage(vars: CreateInboxConversationWithMessageVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateInboxConversationWithMessageData>>;

/** Generated Node Admin SDK operation action function for the 'AppendInboxMessage' Mutation. Allow users to execute without passing in DataConnect. */
export function appendInboxMessage(dc: DataConnect, vars: AppendInboxMessageVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<AppendInboxMessageData>>;
/** Generated Node Admin SDK operation action function for the 'AppendInboxMessage' Mutation. Allow users to pass in custom DataConnect instances. */
export function appendInboxMessage(vars: AppendInboxMessageVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<AppendInboxMessageData>>;

/** Generated Node Admin SDK operation action function for the 'MailboxActor' Query. Allow users to execute without passing in DataConnect. */
export function mailboxActor(dc: DataConnect, vars: MailboxActorVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<MailboxActorData>>;
/** Generated Node Admin SDK operation action function for the 'MailboxActor' Query. Allow users to pass in custom DataConnect instances. */
export function mailboxActor(vars: MailboxActorVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<MailboxActorData>>;

/** Generated Node Admin SDK operation action function for the 'MailboxConflicts' Query. Allow users to execute without passing in DataConnect. */
export function mailboxConflicts(dc: DataConnect, vars: MailboxConflictsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<MailboxConflictsData>>;
/** Generated Node Admin SDK operation action function for the 'MailboxConflicts' Query. Allow users to pass in custom DataConnect instances. */
export function mailboxConflicts(vars: MailboxConflictsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<MailboxConflictsData>>;

/** Generated Node Admin SDK operation action function for the 'SaveMailboxConnection' Mutation. Allow users to execute without passing in DataConnect. */
export function saveMailboxConnection(dc: DataConnect, vars: SaveMailboxConnectionVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<SaveMailboxConnectionData>>;
/** Generated Node Admin SDK operation action function for the 'SaveMailboxConnection' Mutation. Allow users to pass in custom DataConnect instances. */
export function saveMailboxConnection(vars: SaveMailboxConnectionVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<SaveMailboxConnectionData>>;

/** Generated Node Admin SDK operation action function for the 'MailboxesOverview' Query. Allow users to execute without passing in DataConnect. */
export function mailboxesOverview(dc: DataConnect, vars: MailboxesOverviewVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<MailboxesOverviewData>>;
/** Generated Node Admin SDK operation action function for the 'MailboxesOverview' Query. Allow users to pass in custom DataConnect instances. */
export function mailboxesOverview(vars: MailboxesOverviewVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<MailboxesOverviewData>>;

/** Generated Node Admin SDK operation action function for the 'MailboxForAction' Query. Allow users to execute without passing in DataConnect. */
export function mailboxForAction(dc: DataConnect, vars: MailboxForActionVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<MailboxForActionData>>;
/** Generated Node Admin SDK operation action function for the 'MailboxForAction' Query. Allow users to pass in custom DataConnect instances. */
export function mailboxForAction(vars: MailboxForActionVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<MailboxForActionData>>;

/** Generated Node Admin SDK operation action function for the 'DisconnectMailbox' Mutation. Allow users to execute without passing in DataConnect. */
export function disconnectMailbox(dc: DataConnect, vars: DisconnectMailboxVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<DisconnectMailboxData>>;
/** Generated Node Admin SDK operation action function for the 'DisconnectMailbox' Mutation. Allow users to pass in custom DataConnect instances. */
export function disconnectMailbox(vars: DisconnectMailboxVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<DisconnectMailboxData>>;

/** Generated Node Admin SDK operation action function for the 'SetMailboxSending' Mutation. Allow users to execute without passing in DataConnect. */
export function setMailboxSending(dc: DataConnect, vars: SetMailboxSendingVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<SetMailboxSendingData>>;
/** Generated Node Admin SDK operation action function for the 'SetMailboxSending' Mutation. Allow users to pass in custom DataConnect instances. */
export function setMailboxSending(vars: SetMailboxSendingVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<SetMailboxSendingData>>;

/** Generated Node Admin SDK operation action function for the 'DueMailboxes' Query. Allow users to execute without passing in DataConnect. */
export function dueMailboxes(dc: DataConnect, vars: DueMailboxesVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<DueMailboxesData>>;
/** Generated Node Admin SDK operation action function for the 'DueMailboxes' Query. Allow users to pass in custom DataConnect instances. */
export function dueMailboxes(vars: DueMailboxesVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<DueMailboxesData>>;

/** Generated Node Admin SDK operation action function for the 'ClaimMailboxSync' Mutation. Allow users to execute without passing in DataConnect. */
export function claimMailboxSync(dc: DataConnect, vars: ClaimMailboxSyncVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ClaimMailboxSyncData>>;
/** Generated Node Admin SDK operation action function for the 'ClaimMailboxSync' Mutation. Allow users to pass in custom DataConnect instances. */
export function claimMailboxSync(vars: ClaimMailboxSyncVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ClaimMailboxSyncData>>;

/** Generated Node Admin SDK operation action function for the 'FinishMailboxSync' Mutation. Allow users to execute without passing in DataConnect. */
export function finishMailboxSync(dc: DataConnect, vars: FinishMailboxSyncVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<FinishMailboxSyncData>>;
/** Generated Node Admin SDK operation action function for the 'FinishMailboxSync' Mutation. Allow users to pass in custom DataConnect instances. */
export function finishMailboxSync(vars: FinishMailboxSyncVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<FinishMailboxSyncData>>;

/** Generated Node Admin SDK operation action function for the 'FailMailboxSync' Mutation. Allow users to execute without passing in DataConnect. */
export function failMailboxSync(dc: DataConnect, vars: FailMailboxSyncVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<FailMailboxSyncData>>;
/** Generated Node Admin SDK operation action function for the 'FailMailboxSync' Mutation. Allow users to pass in custom DataConnect instances. */
export function failMailboxSync(vars: FailMailboxSyncVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<FailMailboxSyncData>>;

/** Generated Node Admin SDK operation action function for the 'RetireMailbox' Mutation. Allow users to execute without passing in DataConnect. */
export function retireMailbox(dc: DataConnect, vars: RetireMailboxVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<RetireMailboxData>>;
/** Generated Node Admin SDK operation action function for the 'RetireMailbox' Mutation. Allow users to pass in custom DataConnect instances. */
export function retireMailbox(vars: RetireMailboxVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<RetireMailboxData>>;

/** Generated Node Admin SDK operation action function for the 'RequestMailboxSync' Mutation. Allow users to execute without passing in DataConnect. */
export function requestMailboxSync(dc: DataConnect, vars: RequestMailboxSyncVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<RequestMailboxSyncData>>;
/** Generated Node Admin SDK operation action function for the 'RequestMailboxSync' Mutation. Allow users to pass in custom DataConnect instances. */
export function requestMailboxSync(vars: RequestMailboxSyncVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<RequestMailboxSyncData>>;

/** Generated Node Admin SDK operation action function for the 'MailboxSyncRow' Query. Allow users to execute without passing in DataConnect. */
export function mailboxSyncRow(dc: DataConnect, vars: MailboxSyncRowVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<MailboxSyncRowData>>;
/** Generated Node Admin SDK operation action function for the 'MailboxSyncRow' Query. Allow users to pass in custom DataConnect instances. */
export function mailboxSyncRow(vars: MailboxSyncRowVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<MailboxSyncRowData>>;

/** Generated Node Admin SDK operation action function for the 'SetInboxMessageHtml' Mutation. Allow users to execute without passing in DataConnect. */
export function setInboxMessageHtml(dc: DataConnect, vars: SetInboxMessageHtmlVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<SetInboxMessageHtmlData>>;
/** Generated Node Admin SDK operation action function for the 'SetInboxMessageHtml' Mutation. Allow users to pass in custom DataConnect instances. */
export function setInboxMessageHtml(vars: SetInboxMessageHtmlVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<SetInboxMessageHtmlData>>;

/** Generated Node Admin SDK operation action function for the 'UpdateMailboxToken' Mutation. Allow users to execute without passing in DataConnect. */
export function updateMailboxToken(dc: DataConnect, vars: UpdateMailboxTokenVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateMailboxTokenData>>;
/** Generated Node Admin SDK operation action function for the 'UpdateMailboxToken' Mutation. Allow users to pass in custom DataConnect instances. */
export function updateMailboxToken(vars: UpdateMailboxTokenVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateMailboxTokenData>>;

/** Generated Node Admin SDK operation action function for the 'KnownMailboxMessages' Query. Allow users to execute without passing in DataConnect. */
export function knownMailboxMessages(dc: DataConnect, vars: KnownMailboxMessagesVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<KnownMailboxMessagesData>>;
/** Generated Node Admin SDK operation action function for the 'KnownMailboxMessages' Query. Allow users to pass in custom DataConnect instances. */
export function knownMailboxMessages(vars: KnownMailboxMessagesVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<KnownMailboxMessagesData>>;

/** Generated Node Admin SDK operation action function for the 'ListInboxReplies' Query. Allow users to execute without passing in DataConnect. */
export function listInboxReplies(dc: DataConnect, vars: ListInboxRepliesVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListInboxRepliesData>>;
/** Generated Node Admin SDK operation action function for the 'ListInboxReplies' Query. Allow users to pass in custom DataConnect instances. */
export function listInboxReplies(vars: ListInboxRepliesVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListInboxRepliesData>>;

/** Generated Node Admin SDK operation action function for the 'CreateInboxReplyDraft' Mutation. Allow users to execute without passing in DataConnect. */
export function createInboxReplyDraft(dc: DataConnect, vars: CreateInboxReplyDraftVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateInboxReplyDraftData>>;
/** Generated Node Admin SDK operation action function for the 'CreateInboxReplyDraft' Mutation. Allow users to pass in custom DataConnect instances. */
export function createInboxReplyDraft(vars: CreateInboxReplyDraftVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateInboxReplyDraftData>>;

/** Generated Node Admin SDK operation action function for the 'UpdateInboxReplyDraft' Mutation. Allow users to execute without passing in DataConnect. */
export function updateInboxReplyDraft(dc: DataConnect, vars: UpdateInboxReplyDraftVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateInboxReplyDraftData>>;
/** Generated Node Admin SDK operation action function for the 'UpdateInboxReplyDraft' Mutation. Allow users to pass in custom DataConnect instances. */
export function updateInboxReplyDraft(vars: UpdateInboxReplyDraftVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateInboxReplyDraftData>>;

/** Generated Node Admin SDK operation action function for the 'RecordInboxReplyCheck' Mutation. Allow users to execute without passing in DataConnect. */
export function recordInboxReplyCheck(dc: DataConnect, vars: RecordInboxReplyCheckVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<RecordInboxReplyCheckData>>;
/** Generated Node Admin SDK operation action function for the 'RecordInboxReplyCheck' Mutation. Allow users to pass in custom DataConnect instances. */
export function recordInboxReplyCheck(vars: RecordInboxReplyCheckVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<RecordInboxReplyCheckData>>;

/** Generated Node Admin SDK operation action function for the 'SubmitInboxReply' Mutation. Allow users to execute without passing in DataConnect. */
export function submitInboxReply(dc: DataConnect, vars: SubmitInboxReplyVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<SubmitInboxReplyData>>;
/** Generated Node Admin SDK operation action function for the 'SubmitInboxReply' Mutation. Allow users to pass in custom DataConnect instances. */
export function submitInboxReply(vars: SubmitInboxReplyVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<SubmitInboxReplyData>>;

/** Generated Node Admin SDK operation action function for the 'DecideInboxReply' Mutation. Allow users to execute without passing in DataConnect. */
export function decideInboxReply(dc: DataConnect, vars: DecideInboxReplyVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<DecideInboxReplyData>>;
/** Generated Node Admin SDK operation action function for the 'DecideInboxReply' Mutation. Allow users to pass in custom DataConnect instances. */
export function decideInboxReply(vars: DecideInboxReplyVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<DecideInboxReplyData>>;

/** Generated Node Admin SDK operation action function for the 'CancelInboxReply' Mutation. Allow users to execute without passing in DataConnect. */
export function cancelInboxReply(dc: DataConnect, vars: CancelInboxReplyVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CancelInboxReplyData>>;
/** Generated Node Admin SDK operation action function for the 'CancelInboxReply' Mutation. Allow users to pass in custom DataConnect instances. */
export function cancelInboxReply(vars: CancelInboxReplyVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CancelInboxReplyData>>;

/** Generated Node Admin SDK operation action function for the 'DeleteInboxReply' Mutation. Allow users to execute without passing in DataConnect. */
export function deleteInboxReply(dc: DataConnect, vars: DeleteInboxReplyVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<DeleteInboxReplyData>>;
/** Generated Node Admin SDK operation action function for the 'DeleteInboxReply' Mutation. Allow users to pass in custom DataConnect instances. */
export function deleteInboxReply(vars: DeleteInboxReplyVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<DeleteInboxReplyData>>;

/** Generated Node Admin SDK operation action function for the 'ListChannelConnections' Query. Allow users to execute without passing in DataConnect. */
export function listChannelConnections(dc: DataConnect, vars: ListChannelConnectionsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListChannelConnectionsData>>;
/** Generated Node Admin SDK operation action function for the 'ListChannelConnections' Query. Allow users to pass in custom DataConnect instances. */
export function listChannelConnections(vars: ListChannelConnectionsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListChannelConnectionsData>>;

/** Generated Node Admin SDK operation action function for the 'CreateChannelConnection' Mutation. Allow users to execute without passing in DataConnect. */
export function createChannelConnection(dc: DataConnect, vars: CreateChannelConnectionVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateChannelConnectionData>>;
/** Generated Node Admin SDK operation action function for the 'CreateChannelConnection' Mutation. Allow users to pass in custom DataConnect instances. */
export function createChannelConnection(vars: CreateChannelConnectionVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateChannelConnectionData>>;

/** Generated Node Admin SDK operation action function for the 'UpdateChannelConnection' Mutation. Allow users to execute without passing in DataConnect. */
export function updateChannelConnection(dc: DataConnect, vars: UpdateChannelConnectionVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateChannelConnectionData>>;
/** Generated Node Admin SDK operation action function for the 'UpdateChannelConnection' Mutation. Allow users to pass in custom DataConnect instances. */
export function updateChannelConnection(vars: UpdateChannelConnectionVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateChannelConnectionData>>;

/** Generated Node Admin SDK operation action function for the 'SaveChannelAccessToken' Mutation. Allow users to execute without passing in DataConnect. */
export function saveChannelAccessToken(dc: DataConnect, vars: SaveChannelAccessTokenVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<SaveChannelAccessTokenData>>;
/** Generated Node Admin SDK operation action function for the 'SaveChannelAccessToken' Mutation. Allow users to pass in custom DataConnect instances. */
export function saveChannelAccessToken(vars: SaveChannelAccessTokenVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<SaveChannelAccessTokenData>>;

/** Generated Node Admin SDK operation action function for the 'ChannelAccessToken' Query. Allow users to execute without passing in DataConnect. */
export function channelAccessToken(dc: DataConnect, vars: ChannelAccessTokenVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ChannelAccessTokenData>>;
/** Generated Node Admin SDK operation action function for the 'ChannelAccessToken' Query. Allow users to pass in custom DataConnect instances. */
export function channelAccessToken(vars: ChannelAccessTokenVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ChannelAccessTokenData>>;

/** Generated Node Admin SDK operation action function for the 'SetChannelConnectionEnabled' Mutation. Allow users to execute without passing in DataConnect. */
export function setChannelConnectionEnabled(dc: DataConnect, vars: SetChannelConnectionEnabledVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<SetChannelConnectionEnabledData>>;
/** Generated Node Admin SDK operation action function for the 'SetChannelConnectionEnabled' Mutation. Allow users to pass in custom DataConnect instances. */
export function setChannelConnectionEnabled(vars: SetChannelConnectionEnabledVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<SetChannelConnectionEnabledData>>;

/** Generated Node Admin SDK operation action function for the 'ChannelConnectionForCheck' Query. Allow users to execute without passing in DataConnect. */
export function channelConnectionForCheck(dc: DataConnect, vars: ChannelConnectionForCheckVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ChannelConnectionForCheckData>>;
/** Generated Node Admin SDK operation action function for the 'ChannelConnectionForCheck' Query. Allow users to pass in custom DataConnect instances. */
export function channelConnectionForCheck(vars: ChannelConnectionForCheckVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ChannelConnectionForCheckData>>;

/** Generated Node Admin SDK operation action function for the 'MarkChannelConnectionChecked' Mutation. Allow users to execute without passing in DataConnect. */
export function markChannelConnectionChecked(dc: DataConnect, vars: MarkChannelConnectionCheckedVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<MarkChannelConnectionCheckedData>>;
/** Generated Node Admin SDK operation action function for the 'MarkChannelConnectionChecked' Mutation. Allow users to pass in custom DataConnect instances. */
export function markChannelConnectionChecked(vars: MarkChannelConnectionCheckedVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<MarkChannelConnectionCheckedData>>;

/** Generated Node Admin SDK operation action function for the 'SetChannelConnectionSending' Mutation. Allow users to execute without passing in DataConnect. */
export function setChannelConnectionSending(dc: DataConnect, vars: SetChannelConnectionSendingVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<SetChannelConnectionSendingData>>;
/** Generated Node Admin SDK operation action function for the 'SetChannelConnectionSending' Mutation. Allow users to pass in custom DataConnect instances. */
export function setChannelConnectionSending(vars: SetChannelConnectionSendingVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<SetChannelConnectionSendingData>>;

/** Generated Node Admin SDK operation action function for the 'SetChannelConnectionLiveSending' Mutation. Allow users to execute without passing in DataConnect. */
export function setChannelConnectionLiveSending(dc: DataConnect, vars: SetChannelConnectionLiveSendingVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<SetChannelConnectionLiveSendingData>>;
/** Generated Node Admin SDK operation action function for the 'SetChannelConnectionLiveSending' Mutation. Allow users to pass in custom DataConnect instances. */
export function setChannelConnectionLiveSending(vars: SetChannelConnectionLiveSendingVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<SetChannelConnectionLiveSendingData>>;

/** Generated Node Admin SDK operation action function for the 'StartWhatsAppConversation' Mutation. Allow users to execute without passing in DataConnect. */
export function startWhatsAppConversation(dc: DataConnect, vars: StartWhatsAppConversationVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<StartWhatsAppConversationData>>;
/** Generated Node Admin SDK operation action function for the 'StartWhatsAppConversation' Mutation. Allow users to pass in custom DataConnect instances. */
export function startWhatsAppConversation(vars: StartWhatsAppConversationVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<StartWhatsAppConversationData>>;

/** Generated Node Admin SDK operation action function for the 'InboxWebhookConnection' Query. Allow users to execute without passing in DataConnect. */
export function inboxWebhookConnection(dc: DataConnect, vars: InboxWebhookConnectionVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<InboxWebhookConnectionData>>;
/** Generated Node Admin SDK operation action function for the 'InboxWebhookConnection' Query. Allow users to pass in custom DataConnect instances. */
export function inboxWebhookConnection(vars: InboxWebhookConnectionVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<InboxWebhookConnectionData>>;

/** Generated Node Admin SDK operation action function for the 'RecordInboxEvent' Mutation. Allow users to execute without passing in DataConnect. */
export function recordInboxEvent(dc: DataConnect, vars: RecordInboxEventVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<RecordInboxEventData>>;
/** Generated Node Admin SDK operation action function for the 'RecordInboxEvent' Mutation. Allow users to pass in custom DataConnect instances. */
export function recordInboxEvent(vars: RecordInboxEventVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<RecordInboxEventData>>;

/** Generated Node Admin SDK operation action function for the 'CompleteInboxEvent' Mutation. Allow users to execute without passing in DataConnect. */
export function completeInboxEvent(dc: DataConnect, vars: CompleteInboxEventVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CompleteInboxEventData>>;
/** Generated Node Admin SDK operation action function for the 'CompleteInboxEvent' Mutation. Allow users to pass in custom DataConnect instances. */
export function completeInboxEvent(vars: CompleteInboxEventVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CompleteInboxEventData>>;

/** Generated Node Admin SDK operation action function for the 'FailInboxEvent' Mutation. Allow users to execute without passing in DataConnect. */
export function failInboxEvent(dc: DataConnect, vars: FailInboxEventVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<FailInboxEventData>>;
/** Generated Node Admin SDK operation action function for the 'FailInboxEvent' Mutation. Allow users to pass in custom DataConnect instances. */
export function failInboxEvent(vars: FailInboxEventVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<FailInboxEventData>>;

/** Generated Node Admin SDK operation action function for the 'PendingInboxEvents' Query. Allow users to execute without passing in DataConnect. */
export function pendingInboxEvents(dc: DataConnect, vars: PendingInboxEventsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<PendingInboxEventsData>>;
/** Generated Node Admin SDK operation action function for the 'PendingInboxEvents' Query. Allow users to pass in custom DataConnect instances. */
export function pendingInboxEvents(vars: PendingInboxEventsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<PendingInboxEventsData>>;

/** Generated Node Admin SDK operation action function for the 'InboxMessageByExternalId' Query. Allow users to execute without passing in DataConnect. */
export function inboxMessageByExternalId(dc: DataConnect, vars: InboxMessageByExternalIdVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<InboxMessageByExternalIdData>>;
/** Generated Node Admin SDK operation action function for the 'InboxMessageByExternalId' Query. Allow users to pass in custom DataConnect instances. */
export function inboxMessageByExternalId(vars: InboxMessageByExternalIdVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<InboxMessageByExternalIdData>>;

/** Generated Node Admin SDK operation action function for the 'ApplyInboxDeliveryStatus' Mutation. Allow users to execute without passing in DataConnect. */
export function applyInboxDeliveryStatus(dc: DataConnect, vars: ApplyInboxDeliveryStatusVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ApplyInboxDeliveryStatusData>>;
/** Generated Node Admin SDK operation action function for the 'ApplyInboxDeliveryStatus' Mutation. Allow users to pass in custom DataConnect instances. */
export function applyInboxDeliveryStatus(vars: ApplyInboxDeliveryStatusVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ApplyInboxDeliveryStatusData>>;

/** Generated Node Admin SDK operation action function for the 'CreateInboxAttachment' Mutation. Allow users to execute without passing in DataConnect. */
export function createInboxAttachment(dc: DataConnect, vars: CreateInboxAttachmentVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateInboxAttachmentData>>;
/** Generated Node Admin SDK operation action function for the 'CreateInboxAttachment' Mutation. Allow users to pass in custom DataConnect instances. */
export function createInboxAttachment(vars: CreateInboxAttachmentVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateInboxAttachmentData>>;

/** Generated Node Admin SDK operation action function for the 'ChannelAccountInUse' Query. Allow users to execute without passing in DataConnect. */
export function channelAccountInUse(dc: DataConnect, vars: ChannelAccountInUseVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ChannelAccountInUseData>>;
/** Generated Node Admin SDK operation action function for the 'ChannelAccountInUse' Query. Allow users to pass in custom DataConnect instances. */
export function channelAccountInUse(vars: ChannelAccountInUseVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ChannelAccountInUseData>>;

/** Generated Node Admin SDK operation action function for the 'WhatsAppTemplateConnection' Query. Allow users to execute without passing in DataConnect. */
export function whatsAppTemplateConnection(dc: DataConnect, vars: WhatsAppTemplateConnectionVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<WhatsAppTemplateConnectionData>>;
/** Generated Node Admin SDK operation action function for the 'WhatsAppTemplateConnection' Query. Allow users to pass in custom DataConnect instances. */
export function whatsAppTemplateConnection(vars: WhatsAppTemplateConnectionVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<WhatsAppTemplateConnectionData>>;

/** Generated Node Admin SDK operation action function for the 'PendingInboxMedia' Query. Allow users to execute without passing in DataConnect. */
export function pendingInboxMedia(dc: DataConnect, vars: PendingInboxMediaVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<PendingInboxMediaData>>;
/** Generated Node Admin SDK operation action function for the 'PendingInboxMedia' Query. Allow users to pass in custom DataConnect instances. */
export function pendingInboxMedia(vars: PendingInboxMediaVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<PendingInboxMediaData>>;

/** Generated Node Admin SDK operation action function for the 'ClaimInboxMediaFetch' Mutation. Allow users to execute without passing in DataConnect. */
export function claimInboxMediaFetch(dc: DataConnect, vars: ClaimInboxMediaFetchVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ClaimInboxMediaFetchData>>;
/** Generated Node Admin SDK operation action function for the 'ClaimInboxMediaFetch' Mutation. Allow users to pass in custom DataConnect instances. */
export function claimInboxMediaFetch(vars: ClaimInboxMediaFetchVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ClaimInboxMediaFetchData>>;

/** Generated Node Admin SDK operation action function for the 'StoreInboxMedia' Mutation. Allow users to execute without passing in DataConnect. */
export function storeInboxMedia(dc: DataConnect, vars: StoreInboxMediaVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<StoreInboxMediaData>>;
/** Generated Node Admin SDK operation action function for the 'StoreInboxMedia' Mutation. Allow users to pass in custom DataConnect instances. */
export function storeInboxMedia(vars: StoreInboxMediaVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<StoreInboxMediaData>>;

/** Generated Node Admin SDK operation action function for the 'FailInboxMedia' Mutation. Allow users to execute without passing in DataConnect. */
export function failInboxMedia(dc: DataConnect, vars: FailInboxMediaVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<FailInboxMediaData>>;
/** Generated Node Admin SDK operation action function for the 'FailInboxMedia' Mutation. Allow users to pass in custom DataConnect instances. */
export function failInboxMedia(vars: FailInboxMediaVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<FailInboxMediaData>>;

/** Generated Node Admin SDK operation action function for the 'InboxSimulatorChannel' Query. Allow users to execute without passing in DataConnect. */
export function inboxSimulatorChannel(dc: DataConnect, vars: InboxSimulatorChannelVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<InboxSimulatorChannelData>>;
/** Generated Node Admin SDK operation action function for the 'InboxSimulatorChannel' Query. Allow users to pass in custom DataConnect instances. */
export function inboxSimulatorChannel(vars: InboxSimulatorChannelVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<InboxSimulatorChannelData>>;

/** Generated Node Admin SDK operation action function for the 'CreateInboxSimulatorChannel' Mutation. Allow users to execute without passing in DataConnect. */
export function createInboxSimulatorChannel(dc: DataConnect, vars: CreateInboxSimulatorChannelVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateInboxSimulatorChannelData>>;
/** Generated Node Admin SDK operation action function for the 'CreateInboxSimulatorChannel' Mutation. Allow users to pass in custom DataConnect instances. */
export function createInboxSimulatorChannel(vars: CreateInboxSimulatorChannelVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateInboxSimulatorChannelData>>;

/** Generated Node Admin SDK operation action function for the 'MarkInboxLeadConversationsSimulated' Mutation. Allow users to execute without passing in DataConnect. */
export function markInboxLeadConversationsSimulated(dc: DataConnect, vars: MarkInboxLeadConversationsSimulatedVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<MarkInboxLeadConversationsSimulatedData>>;
/** Generated Node Admin SDK operation action function for the 'MarkInboxLeadConversationsSimulated' Mutation. Allow users to pass in custom DataConnect instances. */
export function markInboxLeadConversationsSimulated(vars: MarkInboxLeadConversationsSimulatedVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<MarkInboxLeadConversationsSimulatedData>>;

/** Generated Node Admin SDK operation action function for the 'ResetInboxSimulation' Mutation. Allow users to execute without passing in DataConnect. */
export function resetInboxSimulation(dc: DataConnect, vars: ResetInboxSimulationVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ResetInboxSimulationData>>;
/** Generated Node Admin SDK operation action function for the 'ResetInboxSimulation' Mutation. Allow users to pass in custom DataConnect instances. */
export function resetInboxSimulation(vars: ResetInboxSimulationVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ResetInboxSimulationData>>;

/** Generated Node Admin SDK operation action function for the 'InboxSimulatedOutbound' Query. Allow users to execute without passing in DataConnect. */
export function inboxSimulatedOutbound(dc: DataConnect, vars: InboxSimulatedOutboundVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<InboxSimulatedOutboundData>>;
/** Generated Node Admin SDK operation action function for the 'InboxSimulatedOutbound' Query. Allow users to pass in custom DataConnect instances. */
export function inboxSimulatedOutbound(vars: InboxSimulatedOutboundVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<InboxSimulatedOutboundData>>;

/** Generated Node Admin SDK operation action function for the 'ListInboxConversations' Query. Allow users to execute without passing in DataConnect. */
export function listInboxConversations(dc: DataConnect, vars: ListInboxConversationsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListInboxConversationsData>>;
/** Generated Node Admin SDK operation action function for the 'ListInboxConversations' Query. Allow users to pass in custom DataConnect instances. */
export function listInboxConversations(vars: ListInboxConversationsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListInboxConversationsData>>;

/** Generated Node Admin SDK operation action function for the 'InboxCounts' Query. Allow users to execute without passing in DataConnect. */
export function inboxCounts(dc: DataConnect, vars: InboxCountsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<InboxCountsData>>;
/** Generated Node Admin SDK operation action function for the 'InboxCounts' Query. Allow users to pass in custom DataConnect instances. */
export function inboxCounts(vars: InboxCountsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<InboxCountsData>>;

/** Generated Node Admin SDK operation action function for the 'GetInboxConversation' Query. Allow users to execute without passing in DataConnect. */
export function getInboxConversation(dc: DataConnect, vars: GetInboxConversationVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetInboxConversationData>>;
/** Generated Node Admin SDK operation action function for the 'GetInboxConversation' Query. Allow users to pass in custom DataConnect instances. */
export function getInboxConversation(vars: GetInboxConversationVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetInboxConversationData>>;

/** Generated Node Admin SDK operation action function for the 'ListInboxMessages' Query. Allow users to execute without passing in DataConnect. */
export function listInboxMessages(dc: DataConnect, vars: ListInboxMessagesVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListInboxMessagesData>>;
/** Generated Node Admin SDK operation action function for the 'ListInboxMessages' Query. Allow users to pass in custom DataConnect instances. */
export function listInboxMessages(vars: ListInboxMessagesVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListInboxMessagesData>>;

/** Generated Node Admin SDK operation action function for the 'AssignInboxConversation' Mutation. Allow users to execute without passing in DataConnect. */
export function assignInboxConversation(dc: DataConnect, vars: AssignInboxConversationVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<AssignInboxConversationData>>;
/** Generated Node Admin SDK operation action function for the 'AssignInboxConversation' Mutation. Allow users to pass in custom DataConnect instances. */
export function assignInboxConversation(vars: AssignInboxConversationVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<AssignInboxConversationData>>;

/** Generated Node Admin SDK operation action function for the 'SetInboxConversationState' Mutation. Allow users to execute without passing in DataConnect. */
export function setInboxConversationState(dc: DataConnect, vars: SetInboxConversationStateVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<SetInboxConversationStateData>>;
/** Generated Node Admin SDK operation action function for the 'SetInboxConversationState' Mutation. Allow users to pass in custom DataConnect instances. */
export function setInboxConversationState(vars: SetInboxConversationStateVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<SetInboxConversationStateData>>;

/** Generated Node Admin SDK operation action function for the 'LinkInboxConversation' Mutation. Allow users to execute without passing in DataConnect. */
export function linkInboxConversation(dc: DataConnect, vars: LinkInboxConversationVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<LinkInboxConversationData>>;
/** Generated Node Admin SDK operation action function for the 'LinkInboxConversation' Mutation. Allow users to pass in custom DataConnect instances. */
export function linkInboxConversation(vars: LinkInboxConversationVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<LinkInboxConversationData>>;

/** Generated Node Admin SDK operation action function for the 'AddInboxNote' Mutation. Allow users to execute without passing in DataConnect. */
export function addInboxNote(dc: DataConnect, vars: AddInboxNoteVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<AddInboxNoteData>>;
/** Generated Node Admin SDK operation action function for the 'AddInboxNote' Mutation. Allow users to pass in custom DataConnect instances. */
export function addInboxNote(vars: AddInboxNoteVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<AddInboxNoteData>>;

/** Generated Node Admin SDK operation action function for the 'OpenInboxAttachment' Mutation. Allow users to execute without passing in DataConnect. */
export function openInboxAttachment(dc: DataConnect, vars: OpenInboxAttachmentVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<OpenInboxAttachmentData>>;
/** Generated Node Admin SDK operation action function for the 'OpenInboxAttachment' Mutation. Allow users to pass in custom DataConnect instances. */
export function openInboxAttachment(vars: OpenInboxAttachmentVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<OpenInboxAttachmentData>>;

/** Generated Node Admin SDK operation action function for the 'MarkInboxConversationRead' Mutation. Allow users to execute without passing in DataConnect. */
export function markInboxConversationRead(dc: DataConnect, vars: MarkInboxConversationReadVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<MarkInboxConversationReadData>>;
/** Generated Node Admin SDK operation action function for the 'MarkInboxConversationRead' Mutation. Allow users to pass in custom DataConnect instances. */
export function markInboxConversationRead(vars: MarkInboxConversationReadVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<MarkInboxConversationReadData>>;

/** Generated Node Admin SDK operation action function for the 'GetInboxSettings' Query. Allow users to execute without passing in DataConnect. */
export function getInboxSettings(dc: DataConnect, vars: GetInboxSettingsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetInboxSettingsData>>;
/** Generated Node Admin SDK operation action function for the 'GetInboxSettings' Query. Allow users to pass in custom DataConnect instances. */
export function getInboxSettings(vars: GetInboxSettingsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetInboxSettingsData>>;

/** Generated Node Admin SDK operation action function for the 'SaveInboxSettings' Mutation. Allow users to execute without passing in DataConnect. */
export function saveInboxSettings(dc: DataConnect, vars: SaveInboxSettingsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<SaveInboxSettingsData>>;
/** Generated Node Admin SDK operation action function for the 'SaveInboxSettings' Mutation. Allow users to pass in custom DataConnect instances. */
export function saveInboxSettings(vars: SaveInboxSettingsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<SaveInboxSettingsData>>;

/** Generated Node Admin SDK operation action function for the 'InboxLinkTarget' Query. Allow users to execute without passing in DataConnect. */
export function inboxLinkTarget(dc: DataConnect, vars: InboxLinkTargetVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<InboxLinkTargetData>>;
/** Generated Node Admin SDK operation action function for the 'InboxLinkTarget' Query. Allow users to pass in custom DataConnect instances. */
export function inboxLinkTarget(vars: InboxLinkTargetVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<InboxLinkTargetData>>;

/** Generated Node Admin SDK operation action function for the 'InboxAssignees' Query. Allow users to execute without passing in DataConnect. */
export function inboxAssignees(dc: DataConnect, vars: InboxAssigneesVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<InboxAssigneesData>>;
/** Generated Node Admin SDK operation action function for the 'InboxAssignees' Query. Allow users to pass in custom DataConnect instances. */
export function inboxAssignees(vars: InboxAssigneesVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<InboxAssigneesData>>;

/** Generated Node Admin SDK operation action function for the 'InboxCustomerContext' Query. Allow users to execute without passing in DataConnect. */
export function inboxCustomerContext(dc: DataConnect, vars: InboxCustomerContextVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<InboxCustomerContextData>>;
/** Generated Node Admin SDK operation action function for the 'InboxCustomerContext' Query. Allow users to pass in custom DataConnect instances. */
export function inboxCustomerContext(vars: InboxCustomerContextVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<InboxCustomerContextData>>;

/** Generated Node Admin SDK operation action function for the 'GetInboxMessageHtml' Query. Allow users to execute without passing in DataConnect. */
export function getInboxMessageHtml(dc: DataConnect, vars: GetInboxMessageHtmlVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetInboxMessageHtmlData>>;
/** Generated Node Admin SDK operation action function for the 'GetInboxMessageHtml' Query. Allow users to pass in custom DataConnect instances. */
export function getInboxMessageHtml(vars: GetInboxMessageHtmlVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetInboxMessageHtmlData>>;

