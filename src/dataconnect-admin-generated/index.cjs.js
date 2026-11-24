const { validateAdminArgs } = require('firebase-admin/data-connect');

const ActivityKind = {
  ORGANIZATION_CREATED: "ORGANIZATION_CREATED",
  ORGANIZATION_SWITCHED: "ORGANIZATION_SWITCHED",
  ORGANIZATION_UPDATED: "ORGANIZATION_UPDATED",
  BRANCH_CREATED: "BRANCH_CREATED",
  MEMBERSHIP_INVITED: "MEMBERSHIP_INVITED",
  INVITATION_ACCEPTED: "INVITATION_ACCEPTED",
  MEMBERSHIP_APPROVED: "MEMBERSHIP_APPROVED",
  MEMBERSHIP_SUSPENDED: "MEMBERSHIP_SUSPENDED",
  MEMBERSHIP_REVOKED: "MEMBERSHIP_REVOKED",
  MEMBERSHIP_REMOVED: "MEMBERSHIP_REMOVED",
  MEMBERSHIP_ROLE_CHANGED: "MEMBERSHIP_ROLE_CHANGED",
  INVITATION_REVOKED: "INVITATION_REVOKED",
  INVITATION_REISSUED: "INVITATION_REISSUED",
  INVITATION_DELIVERY_PREVIEW: "INVITATION_DELIVERY_PREVIEW",
  INVITATION_DELIVERY_ACCEPTED: "INVITATION_DELIVERY_ACCEPTED",
  INVITATION_DELIVERY_FAILED: "INVITATION_DELIVERY_FAILED",
  LEAD_CREATED: "LEAD_CREATED",
  LEAD_UPDATED: "LEAD_UPDATED",
  LEAD_DISTRIBUTION_RULE_UPDATED: "LEAD_DISTRIBUTION_RULE_UPDATED",
  AGENT_AVAILABILITY_UPDATED: "AGENT_AVAILABILITY_UPDATED",
  LEAD_NOTE_ADDED: "LEAD_NOTE_ADDED",
  LEAD_STATUS_CHANGED: "LEAD_STATUS_CHANGED",
  LEAD_ASSIGNED: "LEAD_ASSIGNED",
  FOLLOW_UP_SCHEDULED: "FOLLOW_UP_SCHEDULED",
  FOLLOW_UP_COMPLETED: "FOLLOW_UP_COMPLETED",
  CONTACT_CREATED: "CONTACT_CREATED",
  CONTACT_UPDATED: "CONTACT_UPDATED",
  PIPELINE_INITIALIZED: "PIPELINE_INITIALIZED",
  LEAD_ARCHIVED: "LEAD_ARCHIVED",
  LEAD_FORM_CREATED: "LEAD_FORM_CREATED",
  LEAD_FORM_UPDATED: "LEAD_FORM_UPDATED",
  WEBSITE_LEAD_CAPTURED: "WEBSITE_LEAD_CAPTURED",
  DEVELOPER_CREATED: "DEVELOPER_CREATED",
  DEVELOPER_UPDATED: "DEVELOPER_UPDATED",
  DEVELOPER_ARCHIVED: "DEVELOPER_ARCHIVED",
  PROJECT_CREATED: "PROJECT_CREATED",
  PROJECT_UPDATED: "PROJECT_UPDATED",
  PROJECT_ARCHIVED: "PROJECT_ARCHIVED",
  BUILDING_CREATED: "BUILDING_CREATED",
  BUILDING_UPDATED: "BUILDING_UPDATED",
  BUILDING_ARCHIVED: "BUILDING_ARCHIVED",
  PROPERTY_CREATED: "PROPERTY_CREATED",
  PROPERTY_UPDATED: "PROPERTY_UPDATED",
  PROPERTY_ARCHIVED: "PROPERTY_ARCHIVED",
  PROPERTY_LISTING_CREATED: "PROPERTY_LISTING_CREATED",
  PROPERTY_LISTING_UPDATED: "PROPERTY_LISTING_UPDATED",
  PROPERTY_LISTING_ARCHIVED: "PROPERTY_LISTING_ARCHIVED",
  FLOOR_PLAN_CREATED: "FLOOR_PLAN_CREATED",
  FLOOR_PLAN_UPDATED: "FLOOR_PLAN_UPDATED",
  FLOOR_PLAN_ARCHIVED: "FLOOR_PLAN_ARCHIVED",
  PAYMENT_PLAN_CREATED: "PAYMENT_PLAN_CREATED",
  PAYMENT_PLAN_UPDATED: "PAYMENT_PLAN_UPDATED",
  PAYMENT_PLAN_ARCHIVED: "PAYMENT_PLAN_ARCHIVED",
  PROPERTY_AMENITY_CHANGED: "PROPERTY_AMENITY_CHANGED",
  PROPERTY_FEATURE_CREATED: "PROPERTY_FEATURE_CREATED",
  PROPERTY_FEATURE_UPDATED: "PROPERTY_FEATURE_UPDATED",
  PROPERTY_FEATURE_ARCHIVED: "PROPERTY_FEATURE_ARCHIVED",
  LEAD_PROPERTY_INTEREST_CHANGED: "LEAD_PROPERTY_INTEREST_CHANGED",
  LEAD_PRIMARY_INTEREST_CHANGED: "LEAD_PRIMARY_INTEREST_CHANGED",
  LEAD_PROPERTY_VIEWING_SCHEDULED: "LEAD_PROPERTY_VIEWING_SCHEDULED",
  LEAD_PROPERTY_VIEWING_UPDATED: "LEAD_PROPERTY_VIEWING_UPDATED",
  PORTAL_CONNECTION_UPDATED: "PORTAL_CONNECTION_UPDATED",
  PORTAL_FIELD_MAPPING_CHANGED: "PORTAL_FIELD_MAPPING_CHANGED",
  LISTING_PUBLICATION_VALIDATED: "LISTING_PUBLICATION_VALIDATED",
  FEED_GENERATION_RECORDED: "FEED_GENERATION_RECORDED",
  AI_CONVERSATION_DELETED: "AI_CONVERSATION_DELETED",
  AI_CONTENT_DRAFT_CREATED: "AI_CONTENT_DRAFT_CREATED",
  AI_CONTENT_DRAFT_STATUS_CHANGED: "AI_CONTENT_DRAFT_STATUS_CHANGED",
  AI_CONTENT_DRAFT_DELETED: "AI_CONTENT_DRAFT_DELETED",
  AI_CONTENT_TEMPLATE_CHANGED: "AI_CONTENT_TEMPLATE_CHANGED",
  AI_BRAND_PROFILE_UPDATED: "AI_BRAND_PROFILE_UPDATED",
  LEAD_QUALIFICATION_UPDATED: "LEAD_QUALIFICATION_UPDATED",
  AI_LEAD_PRIORITY_REVIEWED: "AI_LEAD_PRIORITY_REVIEWED",
  WEBSITE_UPDATED: "WEBSITE_UPDATED",
  WEBSITE_PAGE_CREATED: "WEBSITE_PAGE_CREATED",
  WEBSITE_PAGE_STATUS_CHANGED: "WEBSITE_PAGE_STATUS_CHANGED",
  WEBSITE_PAGE_PUBLISHED: "WEBSITE_PAGE_PUBLISHED",
  WEBSITE_PAGE_UNPUBLISHED: "WEBSITE_PAGE_UNPUBLISHED",
  WEBSITE_PAGE_FORM_CHANGED: "WEBSITE_PAGE_FORM_CHANGED",
  WEBSITE_PAGE_ARCHIVED: "WEBSITE_PAGE_ARCHIVED",
  WEBSITE_ENQUIRY_RECOVERED: "WEBSITE_ENQUIRY_RECOVERED",
  WEBSITE_ENQUIRY_DISMISSED: "WEBSITE_ENQUIRY_DISMISSED",
  WEBSITE_AGENT_CARD_UPDATED: "WEBSITE_AGENT_CARD_UPDATED",
  WEBSITE_MEDIA_UPLOADED: "WEBSITE_MEDIA_UPLOADED",
  WEBSITE_MEDIA_UPDATED: "WEBSITE_MEDIA_UPDATED",
  WEBSITE_MEDIA_ARCHIVED: "WEBSITE_MEDIA_ARCHIVED",
  WEBSITE_SECTION_TEMPLATE_SAVED: "WEBSITE_SECTION_TEMPLATE_SAVED",
  WEBSITE_SECTION_TEMPLATE_DELETED: "WEBSITE_SECTION_TEMPLATE_DELETED",
  AUTOMATION_WORKFLOW_CHANGED: "AUTOMATION_WORKFLOW_CHANGED",
  AUTOMATION_EXECUTION_CHANGED: "AUTOMATION_EXECUTION_CHANGED",
  AUTOMATION_APPROVAL_CHANGED: "AUTOMATION_APPROVAL_CHANGED",
  WORK_TASK_CHANGED: "WORK_TASK_CHANGED",
  CALL_LOGGED: "CALL_LOGGED",
  CALL_UPDATED: "CALL_UPDATED",
  COMMUNICATION_SETTINGS_UPDATED: "COMMUNICATION_SETTINGS_UPDATED",
  COMMUNICATION_SUPPRESSION_CHANGED: "COMMUNICATION_SUPPRESSION_CHANGED",
  COMMUNICATION_PROVIDER_CHANGED: "COMMUNICATION_PROVIDER_CHANGED",
  PHONE_LINE_CHANGED: "PHONE_LINE_CHANGED",
  LIVE_CALLING_ATTESTATION_CHANGED: "LIVE_CALLING_ATTESTATION_CHANGED",
  CALL_STARTED: "CALL_STARTED",
  CALL_CONSENT_CHANGED: "CALL_CONSENT_CHANGED",
  CALL_RECORDING_CHANGED: "CALL_RECORDING_CHANGED",
  CALL_TRANSCRIPT_CHANGED: "CALL_TRANSCRIPT_CHANGED",
  CALL_MEDIA_ACCESSED: "CALL_MEDIA_ACCESSED",
  CALL_AI_SUMMARY_CHANGED: "CALL_AI_SUMMARY_CHANGED",
  VOICE_ASSISTANT_UPDATED: "VOICE_ASSISTANT_UPDATED",
  VOICE_ASSISTANT_TEST_STARTED: "VOICE_ASSISTANT_TEST_STARTED",
  MEETING_SCHEDULED: "MEETING_SCHEDULED",
  MEETING_UPDATED: "MEETING_UPDATED",
  MEETING_COMPLETED: "MEETING_COMPLETED",
  MEETING_SUMMARY_CHANGED: "MEETING_SUMMARY_CHANGED",
  COMMUNICATION_SIMULATION_CHANGED: "COMMUNICATION_SIMULATION_CHANGED",
  INBOX_CONVERSATION_CHANGED: "INBOX_CONVERSATION_CHANGED",
  INBOX_ASSIGNED: "INBOX_ASSIGNED",
  INBOX_NOTE_ADDED: "INBOX_NOTE_ADDED",
  INBOX_LINKED: "INBOX_LINKED",
  CHANNEL_CONNECTION_CHANGED: "CHANNEL_CONNECTION_CHANGED",
  INBOX_OUTBOUND_CHANGED: "INBOX_OUTBOUND_CHANGED",
  INBOX_SETTINGS_UPDATED: "INBOX_SETTINGS_UPDATED",
  INBOX_ATTACHMENT_ACCESSED: "INBOX_ATTACHMENT_ACCESSED",
  INBOX_AI_GENERATED: "INBOX_AI_GENERATED",
  AD_LEAD_CAPTURED: "AD_LEAD_CAPTURED",
  META_LEAD_PAGE_CONNECTED: "META_LEAD_PAGE_CONNECTED",
  META_LEAD_PAGE_DISCONNECTED: "META_LEAD_PAGE_DISCONNECTED",
  META_LEAD_FORM_UPDATED: "META_LEAD_FORM_UPDATED",
}
exports.ActivityKind = ActivityKind;

const AgentAvailabilityStatus = {
  AVAILABLE: "AVAILABLE",
  UNAVAILABLE: "UNAVAILABLE",
}
exports.AgentAvailabilityStatus = AgentAvailabilityStatus;

const AiContentDraftStatus = {
  DRAFT: "DRAFT",
  IN_REVIEW: "IN_REVIEW",
  APPROVED: "APPROVED",
  ARCHIVED: "ARCHIVED",
}
exports.AiContentDraftStatus = AiContentDraftStatus;

const AiContentLanguage = {
  EN: "EN",
  AR: "AR",
  EN_AR: "EN_AR",
}
exports.AiContentLanguage = AiContentLanguage;

const AiContentType = {
  PROPERTY_DESCRIPTION: "PROPERTY_DESCRIPTION",
  PROJECT_MARKETING: "PROJECT_MARKETING",
  WHATSAPP_MESSAGE: "WHATSAPP_MESSAGE",
  EMAIL: "EMAIL",
  SOCIAL_MEDIA: "SOCIAL_MEDIA",
  ADVERTISING: "ADVERTISING",
  CLIENT_PROPOSAL: "CLIENT_PROPOSAL",
}
exports.AiContentType = AiContentType;

const AiContentVersionKind = {
  GENERATED: "GENERATED",
  REGENERATED: "REGENERATED",
  ALTERNATIVE: "ALTERNATIVE",
  EDITED: "EDITED",
  RESTORED: "RESTORED",
}
exports.AiContentVersionKind = AiContentVersionKind;

const AiLeadPriority = {
  HIGH: "HIGH",
  MEDIUM: "MEDIUM",
  LOW: "LOW",
  INSUFFICIENT_DATA: "INSUFFICIENT_DATA",
}
exports.AiLeadPriority = AiLeadPriority;

const AiMessageRole = {
  USER: "USER",
  ASSISTANT: "ASSISTANT",
}
exports.AiMessageRole = AiMessageRole;

const AiRequestStatus = {
  SUCCEEDED: "SUCCEEDED",
  FAILED: "FAILED",
  CANCELLED: "CANCELLED",
}
exports.AiRequestStatus = AiRequestStatus;

const AiSalesInsightKind = {
  LEAD_ANALYSIS: "LEAD_ANALYSIS",
  VIEWING_BRIEF: "VIEWING_BRIEF",
  PIPELINE_SUMMARY: "PIPELINE_SUMMARY",
}
exports.AiSalesInsightKind = AiSalesInsightKind;

const AiToolExecutionStatus = {
  SUCCEEDED: "SUCCEEDED",
  FAILED: "FAILED",
  REJECTED: "REJECTED",
}
exports.AiToolExecutionStatus = AiToolExecutionStatus;

const AreaUnit = {
  SQFT: "SQFT",
  SQM: "SQM",
}
exports.AreaUnit = AreaUnit;

const AuditTargetType = {
  ORGANIZATION: "ORGANIZATION",
  MEMBERSHIP: "MEMBERSHIP",
  BRANCH: "BRANCH",
  LEAD: "LEAD",
  INVITATION: "INVITATION",
  CONTACT: "CONTACT",
  PIPELINE: "PIPELINE",
  LEAD_DISTRIBUTION_RULE: "LEAD_DISTRIBUTION_RULE",
  AGENT_AVAILABILITY: "AGENT_AVAILABILITY",
  LEAD_CAPTURE_FORM: "LEAD_CAPTURE_FORM",
  WEBSITE_SUBMISSION: "WEBSITE_SUBMISSION",
  DEVELOPER: "DEVELOPER",
  PROJECT: "PROJECT",
  BUILDING: "BUILDING",
  PROPERTY: "PROPERTY",
  PROPERTY_LISTING: "PROPERTY_LISTING",
  FLOOR_PLAN: "FLOOR_PLAN",
  PAYMENT_PLAN: "PAYMENT_PLAN",
  PROPERTY_AMENITY: "PROPERTY_AMENITY",
  PROPERTY_FEATURE: "PROPERTY_FEATURE",
  INVENTORY_MEDIA: "INVENTORY_MEDIA",
  PORTAL_CONNECTION: "PORTAL_CONNECTION",
  PORTAL_FIELD_MAPPING: "PORTAL_FIELD_MAPPING",
  LISTING_PUBLICATION: "LISTING_PUBLICATION",
  FEED_GENERATION_JOB: "FEED_GENERATION_JOB",
  AI_CONVERSATION: "AI_CONVERSATION",
  AI_CONTENT_DRAFT: "AI_CONTENT_DRAFT",
  AI_CONTENT_TEMPLATE: "AI_CONTENT_TEMPLATE",
  AI_BRAND_PROFILE: "AI_BRAND_PROFILE",
  LEAD_QUALIFICATION: "LEAD_QUALIFICATION",
  AI_LEAD_PRIORITY_REVIEW: "AI_LEAD_PRIORITY_REVIEW",
  WEBSITE: "WEBSITE",
  WEBSITE_PAGE: "WEBSITE_PAGE",
  PAGE_PUBLICATION: "PAGE_PUBLICATION",
  WEBSITE_ENQUIRY: "WEBSITE_ENQUIRY",
  WEBSITE_MEDIA: "WEBSITE_MEDIA",
  WEBSITE_SECTION_TEMPLATE: "WEBSITE_SECTION_TEMPLATE",
  AUTOMATION_WORKFLOW: "AUTOMATION_WORKFLOW",
  AUTOMATION_EXECUTION: "AUTOMATION_EXECUTION",
  AUTOMATION_APPROVAL: "AUTOMATION_APPROVAL",
  WORK_TASK: "WORK_TASK",
  CALL: "CALL",
  COMMUNICATION_SETTINGS: "COMMUNICATION_SETTINGS",
  COMMUNICATION_SUPPRESSION: "COMMUNICATION_SUPPRESSION",
  COMMUNICATION_PROVIDER: "COMMUNICATION_PROVIDER",
  PHONE_LINE: "PHONE_LINE",
  CALL_CONSENT: "CALL_CONSENT",
  CALL_RECORDING: "CALL_RECORDING",
  CALL_TRANSCRIPT: "CALL_TRANSCRIPT",
  CALL_AI_SUMMARY: "CALL_AI_SUMMARY",
  VOICE_ASSISTANT: "VOICE_ASSISTANT",
  VOICE_TEST_SESSION: "VOICE_TEST_SESSION",
  MEETING: "MEETING",
  COMMUNICATION_SIMULATION: "COMMUNICATION_SIMULATION",
  CONVERSATION: "CONVERSATION",
  CHANNEL_CONNECTION: "CHANNEL_CONNECTION",
  OUTBOUND_MESSAGE: "OUTBOUND_MESSAGE",
  META_LEAD_CONNECTION: "META_LEAD_CONNECTION",
  META_LEAD_FORM: "META_LEAD_FORM",
}
exports.AuditTargetType = AuditTargetType;

const AutomationApprovalStatus = {
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  EXPIRED: "EXPIRED",
  CANCELLED: "CANCELLED",
  EXECUTED: "EXECUTED",
}
exports.AutomationApprovalStatus = AutomationApprovalStatus;

const AutomationEventStatus = {
  PENDING: "PENDING",
  PROCESSED: "PROCESSED",
  SKIPPED: "SKIPPED",
  FAILED: "FAILED",
}
exports.AutomationEventStatus = AutomationEventStatus;

const AutomationExecutionStatus = {
  QUEUED: "QUEUED",
  RUNNING: "RUNNING",
  WAITING: "WAITING",
  APPROVAL_REQUIRED: "APPROVAL_REQUIRED",
  PAUSED: "PAUSED",
  SUCCEEDED: "SUCCEEDED",
  SKIPPED: "SKIPPED",
  FAILED: "FAILED",
  CANCELLED: "CANCELLED",
}
exports.AutomationExecutionStatus = AutomationExecutionStatus;

const AutomationJobStatus = {
  QUEUED: "QUEUED",
  CLAIMED: "CLAIMED",
  SUCCEEDED: "SUCCEEDED",
  FAILED: "FAILED",
  DEAD: "DEAD",
  CANCELLED: "CANCELLED",
}
exports.AutomationJobStatus = AutomationJobStatus;

const AutomationStepStatus = {
  PENDING: "PENDING",
  RUNNING: "RUNNING",
  WAITING: "WAITING",
  APPROVAL_REQUIRED: "APPROVAL_REQUIRED",
  SUCCEEDED: "SUCCEEDED",
  SKIPPED: "SKIPPED",
  FAILED: "FAILED",
  CANCELLED: "CANCELLED",
}
exports.AutomationStepStatus = AutomationStepStatus;

const AutomationWorkflowStatus = {
  DRAFT: "DRAFT",
  IN_REVIEW: "IN_REVIEW",
  APPROVED: "APPROVED",
  ACTIVE: "ACTIVE",
  PAUSED: "PAUSED",
  ARCHIVED: "ARCHIVED",
}
exports.AutomationWorkflowStatus = AutomationWorkflowStatus;

const BuildingType = {
  RESIDENTIAL: "RESIDENTIAL",
  COMMERCIAL: "COMMERCIAL",
  MIXED_USE: "MIXED_USE",
  TOWNHOUSE: "TOWNHOUSE",
  VILLA: "VILLA",
  OTHER: "OTHER",
}
exports.BuildingType = BuildingType;

const CallDirection = {
  OUTBOUND: "OUTBOUND",
  INBOUND: "INBOUND",
}
exports.CallDirection = CallDirection;

const CallOutcome = {
  INTERESTED: "INTERESTED",
  NOT_INTERESTED: "NOT_INTERESTED",
  CALLBACK_REQUESTED: "CALLBACK_REQUESTED",
  VIEWING_REQUESTED: "VIEWING_REQUESTED",
  NO_DECISION: "NO_DECISION",
  WRONG_NUMBER: "WRONG_NUMBER",
  DO_NOT_CALL_REQUESTED: "DO_NOT_CALL_REQUESTED",
  OFFER_REJECTED: "OFFER_REJECTED",
}
exports.CallOutcome = CallOutcome;

const CallSource = {
  MANUAL: "MANUAL",
  PROVIDER: "PROVIDER",
  SIMULATED: "SIMULATED",
}
exports.CallSource = CallSource;

const CallStatus = {
  INITIATED: "INITIATED",
  RINGING: "RINGING",
  IN_PROGRESS: "IN_PROGRESS",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED",
  BUSY: "BUSY",
  NO_ANSWER: "NO_ANSWER",
  CANCELLED: "CANCELLED",
}
exports.CallStatus = CallStatus;

const CallType = {
  SERVICE: "SERVICE",
  FOLLOW_UP: "FOLLOW_UP",
  MARKETING: "MARKETING",
  INBOUND_ENQUIRY: "INBOUND_ENQUIRY",
}
exports.CallType = CallType;

const CompanySize = {
  SOLO: "SOLO",
  TWO_TO_TEN: "TWO_TO_TEN",
  ELEVEN_TO_FIFTY: "ELEVEN_TO_FIFTY",
  FIFTY_ONE_TO_TWO_HUNDRED: "FIFTY_ONE_TO_TWO_HUNDRED",
  TWO_HUNDRED_PLUS: "TWO_HUNDRED_PLUS",
}
exports.CompanySize = CompanySize;

const CompletionStatus = {
  PLANNED: "PLANNED",
  UNDER_CONSTRUCTION: "UNDER_CONSTRUCTION",
  COMPLETED: "COMPLETED",
  ON_HOLD: "ON_HOLD",
}
exports.CompletionStatus = CompletionStatus;

const ConstructionStatus = {
  PLANNING: "PLANNING",
  LAUNCHED: "LAUNCHED",
  UNDER_CONSTRUCTION: "UNDER_CONSTRUCTION",
  COMPLETED: "COMPLETED",
  ON_HOLD: "ON_HOLD",
}
exports.ConstructionStatus = ConstructionStatus;

const DeveloperStatus = {
  ACTIVE: "ACTIVE",
  INACTIVE: "INACTIVE",
}
exports.DeveloperStatus = DeveloperStatus;

const Emirate = {
  ABU_DHABI: "ABU_DHABI",
  DUBAI: "DUBAI",
  SHARJAH: "SHARJAH",
  AJMAN: "AJMAN",
  UMM_AL_QUWAIN: "UMM_AL_QUWAIN",
  RAS_AL_KHAIMAH: "RAS_AL_KHAIMAH",
  FUJAIRAH: "FUJAIRAH",
}
exports.Emirate = Emirate;

const FeatureValueType = {
  TEXT: "TEXT",
  NUMBER: "NUMBER",
  BOOLEAN: "BOOLEAN",
}
exports.FeatureValueType = FeatureValueType;

const FeedFormat = {
  JSON: "JSON",
  XML: "XML",
}
exports.FeedFormat = FeedFormat;

const FeedGenerationStatus = {
  QUEUED: "QUEUED",
  RUNNING: "RUNNING",
  SUCCEEDED: "SUCCEEDED",
  FAILED: "FAILED",
  CANCELLED: "CANCELLED",
}
exports.FeedGenerationStatus = FeedGenerationStatus;

const FurnishedStatus = {
  FURNISHED: "FURNISHED",
  SEMI_FURNISHED: "SEMI_FURNISHED",
  UNFURNISHED: "UNFURNISHED",
}
exports.FurnishedStatus = FurnishedStatus;

const InAppNotificationType = {
  LEAD_ASSIGNED: "LEAD_ASSIGNED",
  LEAD_UNASSIGNED: "LEAD_UNASSIGNED",
  AUTOMATION: "AUTOMATION",
  APPROVAL_REQUESTED: "APPROVAL_REQUESTED",
  INBOX_MESSAGE: "INBOX_MESSAGE",
  INBOX_ASSIGNED: "INBOX_ASSIGNED",
}
exports.InAppNotificationType = InAppNotificationType;

const InboxChannel = {
  WHATSAPP: "WHATSAPP",
  EMAIL: "EMAIL",
  WEBSITE: "WEBSITE",
  INTERNAL: "INTERNAL",
}
exports.InboxChannel = InboxChannel;

const InboxConversationStatus = {
  OPEN: "OPEN",
  PENDING: "PENDING",
  RESOLVED: "RESOLVED",
  CLOSED: "CLOSED",
}
exports.InboxConversationStatus = InboxConversationStatus;

const InboxPriority = {
  LOW: "LOW",
  NORMAL: "NORMAL",
  HIGH: "HIGH",
  URGENT: "URGENT",
}
exports.InboxPriority = InboxPriority;

const InventoryMediaKind = {
  PROPERTY_PHOTO: "PROPERTY_PHOTO",
  FLOOR_PLAN: "FLOOR_PLAN",
  BROCHURE: "BROCHURE",
  DOCUMENT: "DOCUMENT",
}
exports.InventoryMediaKind = InventoryMediaKind;

const InventoryMediaStatus = {
  PENDING: "PENDING",
  ACTIVE: "ACTIVE",
  DELETING: "DELETING",
  DELETED: "DELETED",
}
exports.InventoryMediaStatus = InventoryMediaStatus;

const InventoryStatus = {
  DRAFT: "DRAFT",
  AVAILABLE: "AVAILABLE",
  RESERVED: "RESERVED",
  SOLD: "SOLD",
  RENTED: "RENTED",
  INACTIVE: "INACTIVE",
}
exports.InventoryStatus = InventoryStatus;

const InvitationDeliveryStatus = {
  NOT_SENT: "NOT_SENT",
  PREVIEW: "PREVIEW",
  ACCEPTED: "ACCEPTED",
  FAILED: "FAILED",
}
exports.InvitationDeliveryStatus = InvitationDeliveryStatus;

const InvitationStatus = {
  PENDING: "PENDING",
  ACCEPTED: "ACCEPTED",
  REVOKED: "REVOKED",
}
exports.InvitationStatus = InvitationStatus;

const LeadAssignmentType = {
  INITIAL: "INITIAL",
  MANUAL: "MANUAL",
  ROUND_ROBIN: "ROUND_ROBIN",
  REASSIGNMENT: "REASSIGNMENT",
}
exports.LeadAssignmentType = LeadAssignmentType;

const LeadCaptureFormStatus = {
  DRAFT: "DRAFT",
  ACTIVE: "ACTIVE",
  DISABLED: "DISABLED",
}
exports.LeadCaptureFormStatus = LeadCaptureFormStatus;

const LeadChannel = {
  MANUAL: "MANUAL",
  WEBSITE_FORM: "WEBSITE_FORM",
  LANDING_PAGE: "LANDING_PAGE",
  META_LEAD_AD: "META_LEAD_AD",
  WHATSAPP_AD: "WHATSAPP_AD",
  WHATSAPP: "WHATSAPP",
  EMAIL: "EMAIL",
  PORTAL: "PORTAL",
  OTHER: "OTHER",
}
exports.LeadChannel = LeadChannel;

const LeadDistributionMode = {
  MANUAL: "MANUAL",
  ROUND_ROBIN: "ROUND_ROBIN",
}
exports.LeadDistributionMode = LeadDistributionMode;

const LeadFollowUpStatus = {
  PENDING: "PENDING",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED",
}
exports.LeadFollowUpStatus = LeadFollowUpStatus;

const LeadPriority = {
  LOW: "LOW",
  NORMAL: "NORMAL",
  HIGH: "HIGH",
  URGENT: "URGENT",
}
exports.LeadPriority = LeadPriority;

const LeadPropertyInterestStatus = {
  SAVED: "SAVED",
  INTERESTED: "INTERESTED",
  NOT_INTERESTED: "NOT_INTERESTED",
  REMOVED: "REMOVED",
}
exports.LeadPropertyInterestStatus = LeadPropertyInterestStatus;

const LeadPropertyViewingConfirmation = {
  PENDING: "PENDING",
  CONFIRMED: "CONFIRMED",
  DECLINED: "DECLINED",
}
exports.LeadPropertyViewingConfirmation = LeadPropertyViewingConfirmation;

const LeadPropertyViewingOutcome = {
  POSITIVE: "POSITIVE",
  NEUTRAL: "NEUTRAL",
  NEGATIVE: "NEGATIVE",
  NO_SHOW: "NO_SHOW",
}
exports.LeadPropertyViewingOutcome = LeadPropertyViewingOutcome;

const LeadPropertyViewingStatus = {
  SCHEDULED: "SCHEDULED",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED",
}
exports.LeadPropertyViewingStatus = LeadPropertyViewingStatus;

const LeadReadiness = {
  READY_TO_PROCEED: "READY_TO_PROCEED",
  EXPLORING: "EXPLORING",
  NOT_READY: "NOT_READY",
}
exports.LeadReadiness = LeadReadiness;

const LeadSourceType = {
  MANUAL: "MANUAL",
  REFERRAL: "REFERRAL",
  WEBSITE: "WEBSITE",
  PORTAL: "PORTAL",
  OTHER: "OTHER",
  META_LEAD_ADS: "META_LEAD_ADS",
}
exports.LeadSourceType = LeadSourceType;

const LeadStatus = {
  NEW: "NEW",
  CONTACTED: "CONTACTED",
  QUALIFIED: "QUALIFIED",
  LOST: "LOST",
  CONVERTED: "CONVERTED",
  VIEWING_SCHEDULED: "VIEWING_SCHEDULED",
  VIEWING_COMPLETED: "VIEWING_COMPLETED",
  NEGOTIATION: "NEGOTIATION",
  WON: "WON",
}
exports.LeadStatus = LeadStatus;

const LeadTimeline = {
  IMMEDIATE: "IMMEDIATE",
  WITHIN_3_MONTHS: "WITHIN_3_MONTHS",
  WITHIN_6_MONTHS: "WITHIN_6_MONTHS",
  WITHIN_12_MONTHS: "WITHIN_12_MONTHS",
  LATER: "LATER",
  UNDECIDED: "UNDECIDED",
}
exports.LeadTimeline = LeadTimeline;

const ListingPublicationState = {
  NOT_PUBLISHED: "NOT_PUBLISHED",
  VALIDATION_FAILED: "VALIDATION_FAILED",
  READY: "READY",
  QUEUED: "QUEUED",
  PUBLISHED: "PUBLISHED",
  FAILED: "FAILED",
  REMOVAL_REQUESTED: "REMOVAL_REQUESTED",
  REMOVED: "REMOVED",
}
exports.ListingPublicationState = ListingPublicationState;

const ListingPublicationStatus = {
  NOT_PUBLISHED: "NOT_PUBLISHED",
  READY: "READY",
  PUBLISHED: "PUBLISHED",
  FAILED: "FAILED",
}
exports.ListingPublicationStatus = ListingPublicationStatus;

const ListingPurpose = {
  SALE: "SALE",
  RENT: "RENT",
}
exports.ListingPurpose = ListingPurpose;

const ListingStatus = {
  DRAFT: "DRAFT",
  PENDING_REVIEW: "PENDING_REVIEW",
  APPROVED: "APPROVED",
  ACTIVE: "ACTIVE",
  PAUSED: "PAUSED",
  CLOSED: "CLOSED",
  ARCHIVED: "ARCHIVED",
  UNDER_OFFER: "UNDER_OFFER",
  SOLD: "SOLD",
  RENTED: "RENTED",
  WITHDRAWN: "WITHDRAWN",
  EXPIRED: "EXPIRED",
}
exports.ListingStatus = ListingStatus;

const MapDisplayMode = {
  EXACT: "EXACT",
  APPROXIMATE: "APPROXIMATE",
  HIDDEN: "HIDDEN",
}
exports.MapDisplayMode = MapDisplayMode;

const MarketType = {
  OFF_PLAN: "OFF_PLAN",
  SECONDARY: "SECONDARY",
}
exports.MarketType = MarketType;

const MeetingProvider = {
  GOOGLE_MEET: "GOOGLE_MEET",
  MICROSOFT_TEAMS: "MICROSOFT_TEAMS",
  ZOOM: "ZOOM",
  WEBEX: "WEBEX",
  IN_PERSON: "IN_PERSON",
  PHONE: "PHONE",
  OTHER: "OTHER",
}
exports.MeetingProvider = MeetingProvider;

const MeetingStatus = {
  SCHEDULED: "SCHEDULED",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED",
  NO_SHOW: "NO_SHOW",
}
exports.MeetingStatus = MeetingStatus;

const MembershipRole = {
  OWNER: "OWNER",
  ADMIN: "ADMIN",
  MANAGER: "MANAGER",
  AGENT: "AGENT",
}
exports.MembershipRole = MembershipRole;

const MembershipStatus = {
  INVITED: "INVITED",
  PENDING: "PENDING",
  ACTIVE: "ACTIVE",
  SUSPENDED: "SUSPENDED",
  REVOKED: "REVOKED",
  REMOVED: "REMOVED",
}
exports.MembershipStatus = MembershipStatus;

const MetaLeadConnectionStatus = {
  ACTIVE: "ACTIVE",
  NEEDS_RECONNECT: "NEEDS_RECONNECT",
}
exports.MetaLeadConnectionStatus = MetaLeadConnectionStatus;

const MetaLeadEventStatus = {
  RECEIVED: "RECEIVED",
  PROCESSED: "PROCESSED",
  DUPLICATE: "DUPLICATE",
  FAILED: "FAILED",
  DEAD: "DEAD",
  IGNORED: "IGNORED",
}
exports.MetaLeadEventStatus = MetaLeadEventStatus;

const NotificationAudience = {
  MEMBER: "MEMBER",
  ADMIN: "ADMIN",
}
exports.NotificationAudience = NotificationAudience;

const OccupancyStatus = {
  VACANT: "VACANT",
  OCCUPIED: "OCCUPIED",
  TENANTED: "TENANTED",
  UNDER_CONSTRUCTION: "UNDER_CONSTRUCTION",
}
exports.OccupancyStatus = OccupancyStatus;

const OwnershipType = {
  FREEHOLD: "FREEHOLD",
  LEASEHOLD: "LEASEHOLD",
  SHARED_OWNERSHIP: "SHARED_OWNERSHIP",
}
exports.OwnershipType = OwnershipType;

const PagePublicationStatus = {
  ACTIVE: "ACTIVE",
  SUPERSEDED: "SUPERSEDED",
  UNPUBLISHED: "UNPUBLISHED",
}
exports.PagePublicationStatus = PagePublicationStatus;

const PageVersionKind = {
  CREATED: "CREATED",
  GENERATED: "GENERATED",
  EDITED: "EDITED",
  RESTORED: "RESTORED",
  DUPLICATED: "DUPLICATED",
}
exports.PageVersionKind = PageVersionKind;

const PaymentDueTrigger = {
  CONSTRUCTION_MILESTONE: "CONSTRUCTION_MILESTONE",
  HANDOVER: "HANDOVER",
  POST_HANDOVER: "POST_HANDOVER",
}
exports.PaymentDueTrigger = PaymentDueTrigger;

const PendingEnquiryStatus = {
  PENDING: "PENDING",
  RECOVERED: "RECOVERED",
  DISMISSED: "DISMISSED",
}
exports.PendingEnquiryStatus = PendingEnquiryStatus;

const PortalConnectionStatus = {
  NOT_CONFIGURED: "NOT_CONFIGURED",
  PENDING_APPROVAL: "PENDING_APPROVAL",
  CONNECTED: "CONNECTED",
  ERROR: "ERROR",
  DISABLED: "DISABLED",
}
exports.PortalConnectionStatus = PortalConnectionStatus;

const PortalProvider = {
  PROPERTY_FINDER: "PROPERTY_FINDER",
  BAYUT: "BAYUT",
  DUBIZZLE: "DUBIZZLE",
}
exports.PortalProvider = PortalProvider;

const ProjectStatus = {
  DRAFT: "DRAFT",
  ACTIVE: "ACTIVE",
  INACTIVE: "INACTIVE",
  COMPLETED: "COMPLETED",
}
exports.ProjectStatus = ProjectStatus;

const ProjectType = {
  RESIDENTIAL: "RESIDENTIAL",
  COMMERCIAL: "COMMERCIAL",
  MIXED_USE: "MIXED_USE",
  LAND: "LAND",
}
exports.ProjectType = ProjectType;

const PropertyType = {
  APARTMENT: "APARTMENT",
  VILLA: "VILLA",
  TOWNHOUSE: "TOWNHOUSE",
  PENTHOUSE: "PENTHOUSE",
  PLOT: "PLOT",
  COMMERCIAL: "COMMERCIAL",
  OFFICE: "OFFICE",
  RETAIL: "RETAIL",
  WAREHOUSE: "WAREHOUSE",
}
exports.PropertyType = PropertyType;

const RentalPeriod = {
  MONTHLY: "MONTHLY",
  YEARLY: "YEARLY",
}
exports.RentalPeriod = RentalPeriod;

const TransactionType = {
  BUY: "BUY",
  RENT: "RENT",
  INVEST: "INVEST",
}
exports.TransactionType = TransactionType;

const WebsiteMediaStatus = {
  PENDING: "PENDING",
  ACTIVE: "ACTIVE",
  ARCHIVED: "ARCHIVED",
  DELETED: "DELETED",
}
exports.WebsiteMediaStatus = WebsiteMediaStatus;

const WebsitePageStatus = {
  DRAFT: "DRAFT",
  IN_REVIEW: "IN_REVIEW",
  APPROVED: "APPROVED",
  PUBLISHED: "PUBLISHED",
  UNPUBLISHED: "UNPUBLISHED",
  ARCHIVED: "ARCHIVED",
}
exports.WebsitePageStatus = WebsitePageStatus;

const WebsitePageType = {
  LANDING_PAGE: "LANDING_PAGE",
}
exports.WebsitePageType = WebsitePageType;

const WebsiteStatus = {
  ACTIVE: "ACTIVE",
  ARCHIVED: "ARCHIVED",
}
exports.WebsiteStatus = WebsiteStatus;

const WorkTaskStatus = {
  PENDING: "PENDING",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED",
}
exports.WorkTaskStatus = WorkTaskStatus;

const connectorConfig = {
  connector: 'example',
  serviceId: 'estateos',
  location: 'us-east4'
};
exports.connectorConfig = connectorConfig;

function listAiContentDrafts(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ListAiContentDrafts', inputVars, inputOpts);
}
exports.listAiContentDrafts = listAiContentDrafts;

function getAiContentDraft(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('GetAiContentDraft', inputVars, inputOpts);
}
exports.getAiContentDraft = getAiContentDraft;

function getAiContentVersion(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('GetAiContentVersion', inputVars, inputOpts);
}
exports.getAiContentVersion = getAiContentVersion;

function saveAiContentDraft(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('SaveAiContentDraft', inputVars, inputOpts);
}
exports.saveAiContentDraft = saveAiContentDraft;

function setAiContentDraftStatus(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('SetAiContentDraftStatus', inputVars, inputOpts);
}
exports.setAiContentDraftStatus = setAiContentDraftStatus;

function deleteAiContentDraft(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('DeleteAiContentDraft', inputVars, inputOpts);
}
exports.deleteAiContentDraft = deleteAiContentDraft;

function createAiContentDraft(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('CreateAiContentDraft', inputVars, inputOpts);
}
exports.createAiContentDraft = createAiContentDraft;

function regenerateAiContentDraft(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('RegenerateAiContentDraft', inputVars, inputOpts);
}
exports.regenerateAiContentDraft = regenerateAiContentDraft;

function addAiContentAlternative(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('AddAiContentAlternative', inputVars, inputOpts);
}
exports.addAiContentAlternative = addAiContentAlternative;

function listAiContentTemplates(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ListAiContentTemplates', inputVars, inputOpts);
}
exports.listAiContentTemplates = listAiContentTemplates;

function getAiContentTemplate(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('GetAiContentTemplate', inputVars, inputOpts);
}
exports.getAiContentTemplate = getAiContentTemplate;

function createAiContentTemplate(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('CreateAiContentTemplate', inputVars, inputOpts);
}
exports.createAiContentTemplate = createAiContentTemplate;

function updateAiContentTemplate(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('UpdateAiContentTemplate', inputVars, inputOpts);
}
exports.updateAiContentTemplate = updateAiContentTemplate;

function deleteAiContentTemplate(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('DeleteAiContentTemplate', inputVars, inputOpts);
}
exports.deleteAiContentTemplate = deleteAiContentTemplate;

function getAiBrandProfile(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('GetAiBrandProfile', inputVars, inputOpts);
}
exports.getAiBrandProfile = getAiBrandProfile;

function createAiBrandProfile(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('CreateAiBrandProfile', inputVars, inputOpts);
}
exports.createAiBrandProfile = createAiBrandProfile;

function updateAiBrandProfile(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('UpdateAiBrandProfile', inputVars, inputOpts);
}
exports.updateAiBrandProfile = updateAiBrandProfile;

function listMyAiConversations(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ListMyAiConversations', inputVars, inputOpts);
}
exports.listMyAiConversations = listMyAiConversations;

function getMyAiConversation(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('GetMyAiConversation', inputVars, inputOpts);
}
exports.getMyAiConversation = getMyAiConversation;

function deleteMyAiConversation(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('DeleteMyAiConversation', inputVars, inputOpts);
}
exports.deleteMyAiConversation = deleteMyAiConversation;

function purgeMyExpiredAiConversations(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('PurgeMyExpiredAiConversations', inputVars, inputOpts);
}
exports.purgeMyExpiredAiConversations = purgeMyExpiredAiConversations;

function createAiConversationWithExchange(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('CreateAiConversationWithExchange', inputVars, inputOpts);
}
exports.createAiConversationWithExchange = createAiConversationWithExchange;

function appendAiExchange(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('AppendAiExchange', inputVars, inputOpts);
}
exports.appendAiExchange = appendAiExchange;

function recordAiUsage(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('RecordAiUsage', inputVars, inputOpts);
}
exports.recordAiUsage = recordAiUsage;

function recordAiToolExecution(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('RecordAiToolExecution', inputVars, inputOpts);
}
exports.recordAiToolExecution = recordAiToolExecution;

function reserveAiRequest(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('ReserveAiRequest', inputVars, inputOpts);
}
exports.reserveAiRequest = reserveAiRequest;

function releaseAiRequest(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('ReleaseAiRequest', inputVars, inputOpts);
}
exports.releaseAiRequest = releaseAiRequest;

function getAiUsageCounters(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('GetAiUsageCounters', inputVars, inputOpts);
}
exports.getAiUsageCounters = getAiUsageCounters;

function getLeadSalesIntelligence(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('GetLeadSalesIntelligence', inputVars, inputOpts);
}
exports.getLeadSalesIntelligence = getLeadSalesIntelligence;

function getAiSalesInsight(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('GetAiSalesInsight', inputVars, inputOpts);
}
exports.getAiSalesInsight = getAiSalesInsight;

function listMyAiSalesSummaries(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ListMyAiSalesSummaries', inputVars, inputOpts);
}
exports.listMyAiSalesSummaries = listMyAiSalesSummaries;

function listAiSalesAssessments(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ListAiSalesAssessments', inputVars, inputOpts);
}
exports.listAiSalesAssessments = listAiSalesAssessments;

function listAiSalesViewings(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ListAiSalesViewings', inputVars, inputOpts);
}
exports.listAiSalesViewings = listAiSalesViewings;

function listAiSalesActivity(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ListAiSalesActivity', inputVars, inputOpts);
}
exports.listAiSalesActivity = listAiSalesActivity;

function createLeadQualificationDetails(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('CreateLeadQualificationDetails', inputVars, inputOpts);
}
exports.createLeadQualificationDetails = createLeadQualificationDetails;

function updateLeadQualificationDetails(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('UpdateLeadQualificationDetails', inputVars, inputOpts);
}
exports.updateLeadQualificationDetails = updateLeadQualificationDetails;

function recordLeadPriorityReview(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('RecordLeadPriorityReview', inputVars, inputOpts);
}
exports.recordLeadPriorityReview = recordLeadPriorityReview;

function recordLeadQualificationAssessment(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('RecordLeadQualificationAssessment', inputVars, inputOpts);
}
exports.recordLeadQualificationAssessment = recordLeadQualificationAssessment;

function recordAiSalesInsight(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('RecordAiSalesInsight', inputVars, inputOpts);
}
exports.recordAiSalesInsight = recordAiSalesInsight;

function requestAutomationApproval(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('RequestAutomationApproval', inputVars, inputOpts);
}
exports.requestAutomationApproval = requestAutomationApproval;

function getAutomationStepApprovals(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('GetAutomationStepApprovals', inputVars, inputOpts);
}
exports.getAutomationStepApprovals = getAutomationStepApprovals;

function closeAutomationApproval(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('CloseAutomationApproval', inputVars, inputOpts);
}
exports.closeAutomationApproval = closeAutomationApproval;

function listAutomationApprovals(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ListAutomationApprovals', inputVars, inputOpts);
}
exports.listAutomationApprovals = listAutomationApprovals;

function decideAutomationApproval(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('DecideAutomationApproval', inputVars, inputOpts);
}
exports.decideAutomationApproval = decideAutomationApproval;

function automationReassignLead(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('AutomationReassignLead', inputVars, inputOpts);
}
exports.automationReassignLead = automationReassignLead;

function getAutomationApprovalTarget(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('GetAutomationApprovalTarget', inputVars, inputOpts);
}
exports.getAutomationApprovalTarget = getAutomationApprovalTarget;

function automationReassignConversation(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('AutomationReassignConversation', inputVars, inputOpts);
}
exports.automationReassignConversation = automationReassignConversation;

function getLeadAttribution(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('GetLeadAttribution', inputVars, inputOpts);
}
exports.getLeadAttribution = getLeadAttribution;

function listAutomationWorkflows(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ListAutomationWorkflows', inputVars, inputOpts);
}
exports.listAutomationWorkflows = listAutomationWorkflows;

function getAutomationWorkflow(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('GetAutomationWorkflow', inputVars, inputOpts);
}
exports.getAutomationWorkflow = getAutomationWorkflow;

function listAutomationExecutions(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ListAutomationExecutions', inputVars, inputOpts);
}
exports.listAutomationExecutions = listAutomationExecutions;

function getAutomationExecution(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('GetAutomationExecution', inputVars, inputOpts);
}
exports.getAutomationExecution = getAutomationExecution;

function automationMetrics(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('AutomationMetrics', inputVars, inputOpts);
}
exports.automationMetrics = automationMetrics;

function createAutomationWorkflow(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('CreateAutomationWorkflow', inputVars, inputOpts);
}
exports.createAutomationWorkflow = createAutomationWorkflow;

function saveAutomationWorkflow(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('SaveAutomationWorkflow', inputVars, inputOpts);
}
exports.saveAutomationWorkflow = saveAutomationWorkflow;

function submitAutomationWorkflow(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('SubmitAutomationWorkflow', inputVars, inputOpts);
}
exports.submitAutomationWorkflow = submitAutomationWorkflow;

function returnAutomationWorkflowToDraft(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('ReturnAutomationWorkflowToDraft', inputVars, inputOpts);
}
exports.returnAutomationWorkflowToDraft = returnAutomationWorkflowToDraft;

function approveAutomationWorkflow(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('ApproveAutomationWorkflow', inputVars, inputOpts);
}
exports.approveAutomationWorkflow = approveAutomationWorkflow;

function activateAutomationWorkflow(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('ActivateAutomationWorkflow', inputVars, inputOpts);
}
exports.activateAutomationWorkflow = activateAutomationWorkflow;

function pauseAutomationWorkflow(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('PauseAutomationWorkflow', inputVars, inputOpts);
}
exports.pauseAutomationWorkflow = pauseAutomationWorkflow;

function archiveAutomationWorkflow(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('ArchiveAutomationWorkflow', inputVars, inputOpts);
}
exports.archiveAutomationWorkflow = archiveAutomationWorkflow;

function queueManualAutomationRun(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('QueueManualAutomationRun', inputVars, inputOpts);
}
exports.queueManualAutomationRun = queueManualAutomationRun;

function listAutomationWorkOrganizations(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ListAutomationWorkOrganizations', inputVars, inputOpts);
}
exports.listAutomationWorkOrganizations = listAutomationWorkOrganizations;

function reserveAutomationAiCall(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('ReserveAutomationAiCall', inputVars, inputOpts);
}
exports.reserveAutomationAiCall = reserveAutomationAiCall;

function listAutomationDueTasks(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ListAutomationDueTasks', inputVars, inputOpts);
}
exports.listAutomationDueTasks = listAutomationDueTasks;

function markAutomationScan(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('MarkAutomationScan', inputVars, inputOpts);
}
exports.markAutomationScan = markAutomationScan;

function ensureAutomationOrgState(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('EnsureAutomationOrgState', inputVars, inputOpts);
}
exports.ensureAutomationOrgState = ensureAutomationOrgState;

function claimAutomationOrganization(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('ClaimAutomationOrganization', inputVars, inputOpts);
}
exports.claimAutomationOrganization = claimAutomationOrganization;

function releaseAutomationOrganization(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('ReleaseAutomationOrganization', inputVars, inputOpts);
}
exports.releaseAutomationOrganization = releaseAutomationOrganization;

function getAutomationWork(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('GetAutomationWork', inputVars, inputOpts);
}
exports.getAutomationWork = getAutomationWork;

function getAutomationVersions(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('GetAutomationVersions', inputVars, inputOpts);
}
exports.getAutomationVersions = getAutomationVersions;

function startAutomationExecution(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('StartAutomationExecution', inputVars, inputOpts);
}
exports.startAutomationExecution = startAutomationExecution;

function finishAutomationEvent(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('FinishAutomationEvent', inputVars, inputOpts);
}
exports.finishAutomationEvent = finishAutomationEvent;

function insertAutomationEvent(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('InsertAutomationEvent', inputVars, inputOpts);
}
exports.insertAutomationEvent = insertAutomationEvent;

function claimAutomationJob(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('ClaimAutomationJob', inputVars, inputOpts);
}
exports.claimAutomationJob = claimAutomationJob;

function getAutomationExecutionRun(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('GetAutomationExecutionRun', inputVars, inputOpts);
}
exports.getAutomationExecutionRun = getAutomationExecutionRun;

function beginAutomationJob(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('BeginAutomationJob', inputVars, inputOpts);
}
exports.beginAutomationJob = beginAutomationJob;

function recordAutomationStep(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('RecordAutomationStep', inputVars, inputOpts);
}
exports.recordAutomationStep = recordAutomationStep;

function retryAutomationStep(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('RetryAutomationStep', inputVars, inputOpts);
}
exports.retryAutomationStep = retryAutomationStep;

function finishAutomationStep(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('FinishAutomationStep', inputVars, inputOpts);
}
exports.finishAutomationStep = finishAutomationStep;

function settleAutomationExecution(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('SettleAutomationExecution', inputVars, inputOpts);
}
exports.settleAutomationExecution = settleAutomationExecution;

function pauseAutomationWorkflowForSystem(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('PauseAutomationWorkflowForSystem', inputVars, inputOpts);
}
exports.pauseAutomationWorkflowForSystem = pauseAutomationWorkflowForSystem;

function setAutomationWorkflowNextRun(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('SetAutomationWorkflowNextRun', inputVars, inputOpts);
}
exports.setAutomationWorkflowNextRun = setAutomationWorkflowNextRun;

function automationFacts(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('AutomationFacts', inputVars, inputOpts);
}
exports.automationFacts = automationFacts;

function automationRecipients(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('AutomationRecipients', inputVars, inputOpts);
}
exports.automationRecipients = automationRecipients;

function automationNotify(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('AutomationNotify', inputVars, inputOpts);
}
exports.automationNotify = automationNotify;

function automationCreateLeadFollowUp(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('AutomationCreateLeadFollowUp', inputVars, inputOpts);
}
exports.automationCreateLeadFollowUp = automationCreateLeadFollowUp;

function automationCreateWorkTask(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('AutomationCreateWorkTask', inputVars, inputOpts);
}
exports.automationCreateWorkTask = automationCreateWorkTask;

function automationAddLeadNote(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('AutomationAddLeadNote', inputVars, inputOpts);
}
exports.automationAddLeadNote = automationAddLeadNote;

function automationDistributeLead(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('AutomationDistributeLead', inputVars, inputOpts);
}
exports.automationDistributeLead = automationDistributeLead;

function automationExecutorProfile(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('AutomationExecutorProfile', inputVars, inputOpts);
}
exports.automationExecutorProfile = automationExecutorProfile;

function listAutomationEventsForTarget(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ListAutomationEventsForTarget', inputVars, inputOpts);
}
exports.listAutomationEventsForTarget = listAutomationEventsForTarget;

function listPropertyMapPins(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ListPropertyMapPins', inputVars, inputOpts);
}
exports.listPropertyMapPins = listPropertyMapPins;

function listPropertyListingMapPins(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ListPropertyListingMapPins', inputVars, inputOpts);
}
exports.listPropertyListingMapPins = listPropertyListingMapPins;

function listAssignedPropertyListingMapPins(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ListAssignedPropertyListingMapPins', inputVars, inputOpts);
}
exports.listAssignedPropertyListingMapPins = listAssignedPropertyListingMapPins;

function getInventoryDashboardMetrics(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('GetInventoryDashboardMetrics', inputVars, inputOpts);
}
exports.getInventoryDashboardMetrics = getInventoryDashboardMetrics;

function createDeveloper(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('CreateDeveloper', inputVars, inputOpts);
}
exports.createDeveloper = createDeveloper;

function updateDeveloper(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('UpdateDeveloper', inputVars, inputOpts);
}
exports.updateDeveloper = updateDeveloper;

function archiveDeveloper(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('ArchiveDeveloper', inputVars, inputOpts);
}
exports.archiveDeveloper = archiveDeveloper;

function createProject(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('CreateProject', inputVars, inputOpts);
}
exports.createProject = createProject;

function updateProject(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('UpdateProject', inputVars, inputOpts);
}
exports.updateProject = updateProject;

function archiveProject(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('ArchiveProject', inputVars, inputOpts);
}
exports.archiveProject = archiveProject;

function createProjectPhase(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('CreateProjectPhase', inputVars, inputOpts);
}
exports.createProjectPhase = createProjectPhase;

function createBuilding(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('CreateBuilding', inputVars, inputOpts);
}
exports.createBuilding = createBuilding;

function updateBuilding(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('UpdateBuilding', inputVars, inputOpts);
}
exports.updateBuilding = updateBuilding;

function archiveBuilding(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('ArchiveBuilding', inputVars, inputOpts);
}
exports.archiveBuilding = archiveBuilding;

function createProperty(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('CreateProperty', inputVars, inputOpts);
}
exports.createProperty = createProperty;

function updateProperty(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('UpdateProperty', inputVars, inputOpts);
}
exports.updateProperty = updateProperty;

function archiveProperty(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('ArchiveProperty', inputVars, inputOpts);
}
exports.archiveProperty = archiveProperty;

function createPropertyListing(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('CreatePropertyListing', inputVars, inputOpts);
}
exports.createPropertyListing = createPropertyListing;

function updatePropertyListing(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('UpdatePropertyListing', inputVars, inputOpts);
}
exports.updatePropertyListing = updatePropertyListing;

function setPropertyListingStatus(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('SetPropertyListingStatus', inputVars, inputOpts);
}
exports.setPropertyListingStatus = setPropertyListingStatus;

function archivePropertyListing(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('ArchivePropertyListing', inputVars, inputOpts);
}
exports.archivePropertyListing = archivePropertyListing;

function createFloorPlan(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('CreateFloorPlan', inputVars, inputOpts);
}
exports.createFloorPlan = createFloorPlan;

function updateFloorPlan(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('UpdateFloorPlan', inputVars, inputOpts);
}
exports.updateFloorPlan = updateFloorPlan;

function archiveFloorPlan(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('ArchiveFloorPlan', inputVars, inputOpts);
}
exports.archiveFloorPlan = archiveFloorPlan;

function updateProjectPhase(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('UpdateProjectPhase', inputVars, inputOpts);
}
exports.updateProjectPhase = updateProjectPhase;

function archiveProjectPhase(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('ArchiveProjectPhase', inputVars, inputOpts);
}
exports.archiveProjectPhase = archiveProjectPhase;

function createInventoryAmenity(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('CreateInventoryAmenity', inputVars, inputOpts);
}
exports.createInventoryAmenity = createInventoryAmenity;

function setInventoryAmenityActive(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('SetInventoryAmenityActive', inputVars, inputOpts);
}
exports.setInventoryAmenityActive = setInventoryAmenityActive;

function attachPropertyAmenity(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('AttachPropertyAmenity', inputVars, inputOpts);
}
exports.attachPropertyAmenity = attachPropertyAmenity;

function detachPropertyAmenity(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('DetachPropertyAmenity', inputVars, inputOpts);
}
exports.detachPropertyAmenity = detachPropertyAmenity;

function createPropertyFeature(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('CreatePropertyFeature', inputVars, inputOpts);
}
exports.createPropertyFeature = createPropertyFeature;

function updatePropertyFeature(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('UpdatePropertyFeature', inputVars, inputOpts);
}
exports.updatePropertyFeature = updatePropertyFeature;

function archivePropertyFeature(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('ArchivePropertyFeature', inputVars, inputOpts);
}
exports.archivePropertyFeature = archivePropertyFeature;

function attachProjectAmenity(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('AttachProjectAmenity', inputVars, inputOpts);
}
exports.attachProjectAmenity = attachProjectAmenity;

function detachProjectAmenity(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('DetachProjectAmenity', inputVars, inputOpts);
}
exports.detachProjectAmenity = detachProjectAmenity;

function createPaymentPlan(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('CreatePaymentPlan', inputVars, inputOpts);
}
exports.createPaymentPlan = createPaymentPlan;

function updatePaymentPlan(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('UpdatePaymentPlan', inputVars, inputOpts);
}
exports.updatePaymentPlan = updatePaymentPlan;

function addPaymentPlanInstallment(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('AddPaymentPlanInstallment', inputVars, inputOpts);
}
exports.addPaymentPlanInstallment = addPaymentPlanInstallment;

function updatePaymentPlanInstallment(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('UpdatePaymentPlanInstallment', inputVars, inputOpts);
}
exports.updatePaymentPlanInstallment = updatePaymentPlanInstallment;

function removePaymentPlanInstallment(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('RemovePaymentPlanInstallment', inputVars, inputOpts);
}
exports.removePaymentPlanInstallment = removePaymentPlanInstallment;

function setPaymentPlanActive(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('SetPaymentPlanActive', inputVars, inputOpts);
}
exports.setPaymentPlanActive = setPaymentPlanActive;

function archivePaymentPlan(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('ArchivePaymentPlan', inputVars, inputOpts);
}
exports.archivePaymentPlan = archivePaymentPlan;

function createInventoryMedia(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('CreateInventoryMedia', inputVars, inputOpts);
}
exports.createInventoryMedia = createInventoryMedia;

function setInventoryMediaStatus(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('SetInventoryMediaStatus', inputVars, inputOpts);
}
exports.setInventoryMediaStatus = setInventoryMediaStatus;

function updateInventoryMediaOrder(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('UpdateInventoryMediaOrder', inputVars, inputOpts);
}
exports.updateInventoryMediaOrder = updateInventoryMediaOrder;

function setPropertyMediaCover(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('SetPropertyMediaCover', inputVars, inputOpts);
}
exports.setPropertyMediaCover = setPropertyMediaCover;

function listDevelopers(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ListDevelopers', inputVars, inputOpts);
}
exports.listDevelopers = listDevelopers;

function getDeveloper(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('GetDeveloper', inputVars, inputOpts);
}
exports.getDeveloper = getDeveloper;

function listProjects(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ListProjects', inputVars, inputOpts);
}
exports.listProjects = listProjects;

function getProject(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('GetProject', inputVars, inputOpts);
}
exports.getProject = getProject;

function listProjectAuditEvents(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ListProjectAuditEvents', inputVars, inputOpts);
}
exports.listProjectAuditEvents = listProjectAuditEvents;

function getBuilding(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('GetBuilding', inputVars, inputOpts);
}
exports.getBuilding = getBuilding;

function listProjectPhases(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ListProjectPhases', inputVars, inputOpts);
}
exports.listProjectPhases = listProjectPhases;

function getProjectPhase(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('GetProjectPhase', inputVars, inputOpts);
}
exports.getProjectPhase = getProjectPhase;

function listBuildings(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ListBuildings', inputVars, inputOpts);
}
exports.listBuildings = listBuildings;

function listInventoryAmenities(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ListInventoryAmenities', inputVars, inputOpts);
}
exports.listInventoryAmenities = listInventoryAmenities;

function getInventoryAmenity(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('GetInventoryAmenity', inputVars, inputOpts);
}
exports.getInventoryAmenity = getInventoryAmenity;

function listPropertyFeatures(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ListPropertyFeatures', inputVars, inputOpts);
}
exports.listPropertyFeatures = listPropertyFeatures;

function getPropertyFeature(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('GetPropertyFeature', inputVars, inputOpts);
}
exports.getPropertyFeature = getPropertyFeature;

function listProperties(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ListProperties', inputVars, inputOpts);
}
exports.listProperties = listProperties;

function getProperty(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('GetProperty', inputVars, inputOpts);
}
exports.getProperty = getProperty;

function listPropertiesAdvanced(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ListPropertiesAdvanced', inputVars, inputOpts);
}
exports.listPropertiesAdvanced = listPropertiesAdvanced;

function getAssignedProperty(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('GetAssignedProperty', inputVars, inputOpts);
}
exports.getAssignedProperty = getAssignedProperty;

function listActiveInventoryAgents(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ListActiveInventoryAgents', inputVars, inputOpts);
}
exports.listActiveInventoryAgents = listActiveInventoryAgents;

function listInventoryMedia(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ListInventoryMedia', inputVars, inputOpts);
}
exports.listInventoryMedia = listInventoryMedia;

function getInventoryMedia(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('GetInventoryMedia', inputVars, inputOpts);
}
exports.getInventoryMedia = getInventoryMedia;

function getInventoryMediaForDeletion(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('GetInventoryMediaForDeletion', inputVars, inputOpts);
}
exports.getInventoryMediaForDeletion = getInventoryMediaForDeletion;

function getAssignedPropertyInventoryMedia(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('GetAssignedPropertyInventoryMedia', inputVars, inputOpts);
}
exports.getAssignedPropertyInventoryMedia = getAssignedPropertyInventoryMedia;

function listPropertyListings(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ListPropertyListings', inputVars, inputOpts);
}
exports.listPropertyListings = listPropertyListings;

function listAssignedPropertyListings(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ListAssignedPropertyListings', inputVars, inputOpts);
}
exports.listAssignedPropertyListings = listAssignedPropertyListings;

function listingStatusCounts(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ListingStatusCounts', inputVars, inputOpts);
}
exports.listingStatusCounts = listingStatusCounts;

function assignedListingStatusCounts(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('AssignedListingStatusCounts', inputVars, inputOpts);
}
exports.assignedListingStatusCounts = assignedListingStatusCounts;

function listListingActivity(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ListListingActivity', inputVars, inputOpts);
}
exports.listListingActivity = listListingActivity;

function getPropertyListing(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('GetPropertyListing', inputVars, inputOpts);
}
exports.getPropertyListing = getPropertyListing;

function getAssignedPropertyListing(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('GetAssignedPropertyListing', inputVars, inputOpts);
}
exports.getAssignedPropertyListing = getAssignedPropertyListing;

function getFloorPlan(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('GetFloorPlan', inputVars, inputOpts);
}
exports.getFloorPlan = getFloorPlan;

function getPaymentPlan(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('GetPaymentPlan', inputVars, inputOpts);
}
exports.getPaymentPlan = getPaymentPlan;

function listFloorPlans(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ListFloorPlans', inputVars, inputOpts);
}
exports.listFloorPlans = listFloorPlans;

function listPaymentPlans(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ListPaymentPlans', inputVars, inputOpts);
}
exports.listPaymentPlans = listPaymentPlans;

function metaLeadConnectionForPage(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('MetaLeadConnectionForPage', inputVars, inputOpts);
}
exports.metaLeadConnectionForPage = metaLeadConnectionForPage;

function createMetaLeadConnection(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('CreateMetaLeadConnection', inputVars, inputOpts);
}
exports.createMetaLeadConnection = createMetaLeadConnection;

function setMetaLeadConnectionStatus(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('SetMetaLeadConnectionStatus', inputVars, inputOpts);
}
exports.setMetaLeadConnectionStatus = setMetaLeadConnectionStatus;

function recordMetaLeadEvent(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('RecordMetaLeadEvent', inputVars, inputOpts);
}
exports.recordMetaLeadEvent = recordMetaLeadEvent;

function metaLeadEventContext(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('MetaLeadEventContext', inputVars, inputOpts);
}
exports.metaLeadEventContext = metaLeadEventContext;

function metaLeadConnectionSecret(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('MetaLeadConnectionSecret', inputVars, inputOpts);
}
exports.metaLeadConnectionSecret = metaLeadConnectionSecret;

function findMetaLeadForm(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('FindMetaLeadForm', inputVars, inputOpts);
}
exports.findMetaLeadForm = findMetaLeadForm;

function registerMetaLeadForm(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('RegisterMetaLeadForm', inputVars, inputOpts);
}
exports.registerMetaLeadForm = registerMetaLeadForm;

function setMetaLeadEventOutcome(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('SetMetaLeadEventOutcome', inputVars, inputOpts);
}
exports.setMetaLeadEventOutcome = setMetaLeadEventOutcome;

function pendingMetaLeadEvents(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('PendingMetaLeadEvents', inputVars, inputOpts);
}
exports.pendingMetaLeadEvents = pendingMetaLeadEvents;

function captureMetaLeadAd(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('CaptureMetaLeadAd', inputVars, inputOpts);
}
exports.captureMetaLeadAd = captureMetaLeadAd;

function metaLeadOverview(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('MetaLeadOverview', inputVars, inputOpts);
}
exports.metaLeadOverview = metaLeadOverview;

function reconnectMetaLeadConnection(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('ReconnectMetaLeadConnection', inputVars, inputOpts);
}
exports.reconnectMetaLeadConnection = reconnectMetaLeadConnection;

function disconnectMetaLeadConnection(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('DisconnectMetaLeadConnection', inputVars, inputOpts);
}
exports.disconnectMetaLeadConnection = disconnectMetaLeadConnection;

function metaLeadConnectionsDue(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('MetaLeadConnectionsDue', inputVars, inputOpts);
}
exports.metaLeadConnectionsDue = metaLeadConnectionsDue;

function markMetaLeadConnectionPolled(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('MarkMetaLeadConnectionPolled', inputVars, inputOpts);
}
exports.markMetaLeadConnectionPolled = markMetaLeadConnectionPolled;

function metaLeadEventByLeadgen(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('MetaLeadEventByLeadgen', inputVars, inputOpts);
}
exports.metaLeadEventByLeadgen = metaLeadEventByLeadgen;

function updateMetaLeadForm(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('UpdateMetaLeadForm', inputVars, inputOpts);
}
exports.updateMetaLeadForm = updateMetaLeadForm;

function metaLeadFailure(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('MetaLeadFailure', inputVars, inputOpts);
}
exports.metaLeadFailure = metaLeadFailure;

function getLeadPropertyContext(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('GetLeadPropertyContext', inputVars, inputOpts);
}
exports.getLeadPropertyContext = getLeadPropertyContext;

function listLeadPropertyCandidates(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ListLeadPropertyCandidates', inputVars, inputOpts);
}
exports.listLeadPropertyCandidates = listLeadPropertyCandidates;

function saveLeadPropertyInterest(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('SaveLeadPropertyInterest', inputVars, inputOpts);
}
exports.saveLeadPropertyInterest = saveLeadPropertyInterest;

function setLeadPrimaryInterest(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('SetLeadPrimaryInterest', inputVars, inputOpts);
}
exports.setLeadPrimaryInterest = setLeadPrimaryInterest;

function scheduleLeadPropertyViewing(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('ScheduleLeadPropertyViewing', inputVars, inputOpts);
}
exports.scheduleLeadPropertyViewing = scheduleLeadPropertyViewing;

function updateLeadPropertyViewing(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('UpdateLeadPropertyViewing', inputVars, inputOpts);
}
exports.updateLeadPropertyViewing = updateLeadPropertyViewing;

function initializeLeadPipeline(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('InitializeLeadPipeline', inputVars, inputOpts);
}
exports.initializeLeadPipeline = initializeLeadPipeline;

function createContact(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('CreateContact', inputVars, inputOpts);
}
exports.createContact = createContact;

function updateContact(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('UpdateContact', inputVars, inputOpts);
}
exports.updateContact = updateContact;

function createLead(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('CreateLead', inputVars, inputOpts);
}
exports.createLead = createLead;

function createLeadForContact(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('CreateLeadForContact', inputVars, inputOpts);
}
exports.createLeadForContact = createLeadForContact;

function updateLead(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('UpdateLead', inputVars, inputOpts);
}
exports.updateLead = updateLead;

function changeLeadStatus(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('ChangeLeadStatus', inputVars, inputOpts);
}
exports.changeLeadStatus = changeLeadStatus;

function moveLeadStage(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('MoveLeadStage', inputVars, inputOpts);
}
exports.moveLeadStage = moveLeadStage;

function assignLead(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('AssignLead', inputVars, inputOpts);
}
exports.assignLead = assignLead;

function unassignLead(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('UnassignLead', inputVars, inputOpts);
}
exports.unassignLead = unassignLead;

function saveLeadDistributionSettings(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('SaveLeadDistributionSettings', inputVars, inputOpts);
}
exports.saveLeadDistributionSettings = saveLeadDistributionSettings;

function setAgentAvailability(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('SetAgentAvailability', inputVars, inputOpts);
}
exports.setAgentAvailability = setAgentAvailability;

function markInAppNotificationRead(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('MarkInAppNotificationRead', inputVars, inputOpts);
}
exports.markInAppNotificationRead = markInAppNotificationRead;

function addLeadNote(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('AddLeadNote', inputVars, inputOpts);
}
exports.addLeadNote = addLeadNote;

function archiveLead(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('ArchiveLead', inputVars, inputOpts);
}
exports.archiveLead = archiveLead;

function scheduleLeadFollowUp(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('ScheduleLeadFollowUp', inputVars, inputOpts);
}
exports.scheduleLeadFollowUp = scheduleLeadFollowUp;

function completeLeadFollowUp(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('CompleteLeadFollowUp', inputVars, inputOpts);
}
exports.completeLeadFollowUp = completeLeadFollowUp;

function upsertMyProfile(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('UpsertMyProfile', inputVars, inputOpts);
}
exports.upsertMyProfile = upsertMyProfile;

function createOrganization(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('CreateOrganization', inputVars, inputOpts);
}
exports.createOrganization = createOrganization;

function updateOrganization(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('UpdateOrganization', inputVars, inputOpts);
}
exports.updateOrganization = updateOrganization;

function switchOrganization(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('SwitchOrganization', inputVars, inputOpts);
}
exports.switchOrganization = switchOrganization;

function createBranch(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('CreateBranch', inputVars, inputOpts);
}
exports.createBranch = createBranch;

function inviteMembership(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('InviteMembership', inputVars, inputOpts);
}
exports.inviteMembership = inviteMembership;

function acceptInvitation(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('AcceptInvitation', inputVars, inputOpts);
}
exports.acceptInvitation = acceptInvitation;

function approveMembership(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('ApproveMembership', inputVars, inputOpts);
}
exports.approveMembership = approveMembership;

function setMembershipStatus(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('SetMembershipStatus', inputVars, inputOpts);
}
exports.setMembershipStatus = setMembershipStatus;

function revokeInvitation(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('RevokeInvitation', inputVars, inputOpts);
}
exports.revokeInvitation = revokeInvitation;

function reissueInvitation(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('ReissueInvitation', inputVars, inputOpts);
}
exports.reissueInvitation = reissueInvitation;

function reinviteRevokedInvitation(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('ReinviteRevokedInvitation', inputVars, inputOpts);
}
exports.reinviteRevokedInvitation = reinviteRevokedInvitation;

function recordInvitationDelivery(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('RecordInvitationDelivery', inputVars, inputOpts);
}
exports.recordInvitationDelivery = recordInvitationDelivery;

function setMembershipRole(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('SetMembershipRole', inputVars, inputOpts);
}
exports.setMembershipRole = setMembershipRole;

function createLeadCaptureForm(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('CreateLeadCaptureForm', inputVars, inputOpts);
}
exports.createLeadCaptureForm = createLeadCaptureForm;

function updateLeadCaptureForm(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('UpdateLeadCaptureForm', inputVars, inputOpts);
}
exports.updateLeadCaptureForm = updateLeadCaptureForm;

function consumeWebsiteLeadCaptureRateWindow(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('ConsumeWebsiteLeadCaptureRateWindow', inputVars, inputOpts);
}
exports.consumeWebsiteLeadCaptureRateWindow = consumeWebsiteLeadCaptureRateWindow;

function submitWebsiteLeadCapture(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('SubmitWebsiteLeadCapture', inputVars, inputOpts);
}
exports.submitWebsiteLeadCapture = submitWebsiteLeadCapture;

function getPortalSettings(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('GetPortalSettings', inputVars, inputOpts);
}
exports.getPortalSettings = getPortalSettings;

function getPortalExportListing(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('GetPortalExportListing', inputVars, inputOpts);
}
exports.getPortalExportListing = getPortalExportListing;

function listPortalExportListings(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ListPortalExportListings', inputVars, inputOpts);
}
exports.listPortalExportListings = listPortalExportListings;

function savePortalConnection(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('SavePortalConnection', inputVars, inputOpts);
}
exports.savePortalConnection = savePortalConnection;

function setPortalFieldMapping(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('SetPortalFieldMapping', inputVars, inputOpts);
}
exports.setPortalFieldMapping = setPortalFieldMapping;

function removePortalFieldMapping(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('RemovePortalFieldMapping', inputVars, inputOpts);
}
exports.removePortalFieldMapping = removePortalFieldMapping;

function recordListingValidation(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('RecordListingValidation', inputVars, inputOpts);
}
exports.recordListingValidation = recordListingValidation;

function recordFeedGenerationJob(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('RecordFeedGenerationJob', inputVars, inputOpts);
}
exports.recordFeedGenerationJob = recordFeedGenerationJob;

function getMyProfile(dcOrOptions, options) {
  const { dc: dcInstance, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrOptions, options, undefined);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('GetMyProfile', undefined, inputOpts);
}
exports.getMyProfile = getMyProfile;

function listMyOrganizations(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, false);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ListMyOrganizations', inputVars, inputOpts);
}
exports.listMyOrganizations = listMyOrganizations;

function getMyPendingInvitations(dcOrOptions, options) {
  const { dc: dcInstance, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrOptions, options, undefined);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('GetMyPendingInvitations', undefined, inputOpts);
}
exports.getMyPendingInvitations = getMyPendingInvitations;

function getOrganizationContext(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('GetOrganizationContext', inputVars, inputOpts);
}
exports.getOrganizationContext = getOrganizationContext;

function listBranches(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ListBranches', inputVars, inputOpts);
}
exports.listBranches = listBranches;

function listMemberships(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ListMemberships', inputVars, inputOpts);
}
exports.listMemberships = listMemberships;

function listLeads(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ListLeads', inputVars, inputOpts);
}
exports.listLeads = listLeads;

function listLeadsCreatedAsc(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ListLeadsCreatedAsc', inputVars, inputOpts);
}
exports.listLeadsCreatedAsc = listLeadsCreatedAsc;

function listLeadsUpdatedDesc(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ListLeadsUpdatedDesc', inputVars, inputOpts);
}
exports.listLeadsUpdatedDesc = listLeadsUpdatedDesc;

function listLeadsNameAsc(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ListLeadsNameAsc', inputVars, inputOpts);
}
exports.listLeadsNameAsc = listLeadsNameAsc;

function listLeadsNameDesc(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ListLeadsNameDesc', inputVars, inputOpts);
}
exports.listLeadsNameDesc = listLeadsNameDesc;

function listLeadsFollowUpAsc(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ListLeadsFollowUpAsc', inputVars, inputOpts);
}
exports.listLeadsFollowUpAsc = listLeadsFollowUpAsc;

function getLead(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('GetLead', inputVars, inputOpts);
}
exports.getLead = getLead;

function listLeadAssignees(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ListLeadAssignees', inputVars, inputOpts);
}
exports.listLeadAssignees = listLeadAssignees;

function getLeadDistributionPlan(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('GetLeadDistributionPlan', inputVars, inputOpts);
}
exports.getLeadDistributionPlan = getLeadDistributionPlan;

function getMyAgentAvailability(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('GetMyAgentAvailability', inputVars, inputOpts);
}
exports.getMyAgentAvailability = getMyAgentAvailability;

function listInAppNotifications(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ListInAppNotifications', inputVars, inputOpts);
}
exports.listInAppNotifications = listInAppNotifications;

function listLeadActivities(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ListLeadActivities', inputVars, inputOpts);
}
exports.listLeadActivities = listLeadActivities;

function listActivities(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ListActivities', inputVars, inputOpts);
}
exports.listActivities = listActivities;

function getTeamMembershipByEmail(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('GetTeamMembershipByEmail', inputVars, inputOpts);
}
exports.getTeamMembershipByEmail = getTeamMembershipByEmail;

function listInvitations(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ListInvitations', inputVars, inputOpts);
}
exports.listInvitations = listInvitations;

function listTeamMembers(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ListTeamMembers', inputVars, inputOpts);
}
exports.listTeamMembers = listTeamMembers;

function listAuditLogs(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ListAuditLogs', inputVars, inputOpts);
}
exports.listAuditLogs = listAuditLogs;

function getLeadConfiguration(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('GetLeadConfiguration', inputVars, inputOpts);
}
exports.getLeadConfiguration = getLeadConfiguration;

function searchContacts(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('SearchContacts', inputVars, inputOpts);
}
exports.searchContacts = searchContacts;

function getContact(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('GetContact', inputVars, inputOpts);
}
exports.getContact = getContact;

function findDuplicateContacts(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('FindDuplicateContacts', inputVars, inputOpts);
}
exports.findDuplicateContacts = findDuplicateContacts;

function getLeadCrmHistory(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('GetLeadCrmHistory', inputVars, inputOpts);
}
exports.getLeadCrmHistory = getLeadCrmHistory;

function getLeadMetrics(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('GetLeadMetrics', inputVars, inputOpts);
}
exports.getLeadMetrics = getLeadMetrics;

function listLeadFollowUps(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ListLeadFollowUps', inputVars, inputOpts);
}
exports.listLeadFollowUps = listLeadFollowUps;

function listLeadCaptureForms(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ListLeadCaptureForms', inputVars, inputOpts);
}
exports.listLeadCaptureForms = listLeadCaptureForms;

function getLeadCaptureForm(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('GetLeadCaptureForm', inputVars, inputOpts);
}
exports.getLeadCaptureForm = getLeadCaptureForm;

function resolveWebsiteLeadCaptureForm(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ResolveWebsiteLeadCaptureForm', inputVars, inputOpts);
}
exports.resolveWebsiteLeadCaptureForm = resolveWebsiteLeadCaptureForm;

function findWebsiteLeadCaptureContact(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('FindWebsiteLeadCaptureContact', inputVars, inputOpts);
}
exports.findWebsiteLeadCaptureContact = findWebsiteLeadCaptureContact;

function getWebsiteLeadCaptureRateWindow(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('GetWebsiteLeadCaptureRateWindow', inputVars, inputOpts);
}
exports.getWebsiteLeadCaptureRateWindow = getWebsiteLeadCaptureRateWindow;

function findWebsiteLeadCaptureSubmission(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('FindWebsiteLeadCaptureSubmission', inputVars, inputOpts);
}
exports.findWebsiteLeadCaptureSubmission = findWebsiteLeadCaptureSubmission;

function getWebsiteLeadDistributionPlan(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('GetWebsiteLeadDistributionPlan', inputVars, inputOpts);
}
exports.getWebsiteLeadDistributionPlan = getWebsiteLeadDistributionPlan;

function getLeadAnalytics(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('GetLeadAnalytics', inputVars, inputOpts);
}
exports.getLeadAnalytics = getLeadAnalytics;

function hitRateLimitCounter(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('HitRateLimitCounter', inputVars, inputOpts);
}
exports.hitRateLimitCounter = hitRateLimitCounter;

function purgeExpiredRateLimitCounters(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('PurgeExpiredRateLimitCounters', inputVars, inputOpts);
}
exports.purgeExpiredRateLimitCounters = purgeExpiredRateLimitCounters;

function listMyTasks(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ListMyTasks', inputVars, inputOpts);
}
exports.listMyTasks = listMyTasks;

function completeWorkTask(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('CompleteWorkTask', inputVars, inputOpts);
}
exports.completeWorkTask = completeWorkTask;

function listWebsitePages(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ListWebsitePages', inputVars, inputOpts);
}
exports.listWebsitePages = listWebsitePages;

function getWebsitePage(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('GetWebsitePage', inputVars, inputOpts);
}
exports.getWebsitePage = getWebsitePage;

function getPageVersion(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('GetPageVersion', inputVars, inputOpts);
}
exports.getPageVersion = getPageVersion;

function listProjectWebsiteMedia(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ListProjectWebsiteMedia', inputVars, inputOpts);
}
exports.listProjectWebsiteMedia = listProjectWebsiteMedia;

function findWebsitePageBySlug(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('FindWebsitePageBySlug', inputVars, inputOpts);
}
exports.findWebsitePageBySlug = findWebsitePageBySlug;

function createWebsitePage(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('CreateWebsitePage', inputVars, inputOpts);
}
exports.createWebsitePage = createWebsitePage;

function saveWebsitePageVersion(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('SaveWebsitePageVersion', inputVars, inputOpts);
}
exports.saveWebsitePageVersion = saveWebsitePageVersion;

function submitWebsitePageForReview(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('SubmitWebsitePageForReview', inputVars, inputOpts);
}
exports.submitWebsitePageForReview = submitWebsitePageForReview;

function approveWebsitePage(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('ApproveWebsitePage', inputVars, inputOpts);
}
exports.approveWebsitePage = approveWebsitePage;

function rejectWebsitePage(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('RejectWebsitePage', inputVars, inputOpts);
}
exports.rejectWebsitePage = rejectWebsitePage;

function unpublishWebsitePage(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('UnpublishWebsitePage', inputVars, inputOpts);
}
exports.unpublishWebsitePage = unpublishWebsitePage;

function archiveWebsitePage(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('ArchiveWebsitePage', inputVars, inputOpts);
}
exports.archiveWebsitePage = archiveWebsitePage;

function setPageLeadFormBinding(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('SetPageLeadFormBinding', inputVars, inputOpts);
}
exports.setPageLeadFormBinding = setPageLeadFormBinding;

function removePageLeadFormBinding(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('RemovePageLeadFormBinding', inputVars, inputOpts);
}
exports.removePageLeadFormBinding = removePageLeadFormBinding;

function updateWebsiteSettings(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('UpdateWebsiteSettings', inputVars, inputOpts);
}
exports.updateWebsiteSettings = updateWebsiteSettings;

function listWebsitePageEnquiries(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ListWebsitePageEnquiries', inputVars, inputOpts);
}
exports.listWebsitePageEnquiries = listWebsitePageEnquiries;

function listPendingWebsiteEnquiries(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ListPendingWebsiteEnquiries', inputVars, inputOpts);
}
exports.listPendingWebsiteEnquiries = listPendingWebsiteEnquiries;

function dismissPendingWebsiteEnquiry(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('DismissPendingWebsiteEnquiry', inputVars, inputOpts);
}
exports.dismissPendingWebsiteEnquiry = dismissPendingWebsiteEnquiry;

function createDefaultWebsite(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('CreateDefaultWebsite', inputVars, inputOpts);
}
exports.createDefaultWebsite = createDefaultWebsite;

function createGeneratedWebsitePage(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('CreateGeneratedWebsitePage', inputVars, inputOpts);
}
exports.createGeneratedWebsitePage = createGeneratedWebsitePage;

function addGeneratedPageVersion(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('AddGeneratedPageVersion', inputVars, inputOpts);
}
exports.addGeneratedPageVersion = addGeneratedPageVersion;

function publishWebsitePage(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('PublishWebsitePage', inputVars, inputOpts);
}
exports.publishWebsitePage = publishWebsitePage;

function markPendingWebsiteEnquiryRecovered(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('MarkPendingWebsiteEnquiryRecovered', inputVars, inputOpts);
}
exports.markPendingWebsiteEnquiryRecovered = markPendingWebsiteEnquiryRecovered;

function recordPendingWebsiteEnquiryAttempt(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('RecordPendingWebsiteEnquiryAttempt', inputVars, inputOpts);
}
exports.recordPendingWebsiteEnquiryAttempt = recordPendingWebsiteEnquiryAttempt;

function resolvePublishedPage(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ResolvePublishedPage', inputVars, inputOpts);
}
exports.resolvePublishedPage = resolvePublishedPage;

function getPublishedPageAsset(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('GetPublishedPageAsset', inputVars, inputOpts);
}
exports.getPublishedPageAsset = getPublishedPageAsset;

function listPublishedPagesForSitemap(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ListPublishedPagesForSitemap', inputVars, inputOpts);
}
exports.listPublishedPagesForSitemap = listPublishedPagesForSitemap;

function checkPublishedSourcesEligibility(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('CheckPublishedSourcesEligibility', inputVars, inputOpts);
}
exports.checkPublishedSourcesEligibility = checkPublishedSourcesEligibility;

function getPublishedPageForm(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('GetPublishedPageForm', inputVars, inputOpts);
}
exports.getPublishedPageForm = getPublishedPageForm;

function getWebsiteLeadCaptureFormById(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('GetWebsiteLeadCaptureFormById', inputVars, inputOpts);
}
exports.getWebsiteLeadCaptureFormById = getWebsiteLeadCaptureFormById;

function recordWebsitePageEnquiry(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('RecordWebsitePageEnquiry', inputVars, inputOpts);
}
exports.recordWebsitePageEnquiry = recordWebsitePageEnquiry;

function findPendingWebsiteEnquiry(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('FindPendingWebsiteEnquiry', inputVars, inputOpts);
}
exports.findPendingWebsiteEnquiry = findPendingWebsiteEnquiry;

function recordPendingWebsiteEnquiry(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('RecordPendingWebsiteEnquiry', inputVars, inputOpts);
}
exports.recordPendingWebsiteEnquiry = recordPendingWebsiteEnquiry;

function listWebsiteAgents(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ListWebsiteAgents', inputVars, inputOpts);
}
exports.listWebsiteAgents = listWebsiteAgents;

function getWebsiteAgent(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('GetWebsiteAgent', inputVars, inputOpts);
}
exports.getWebsiteAgent = getWebsiteAgent;

function updateWebsiteAgentCard(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('UpdateWebsiteAgentCard', inputVars, inputOpts);
}
exports.updateWebsiteAgentCard = updateWebsiteAgentCard;

function getWebsiteMediaAccess(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('GetWebsiteMediaAccess', inputVars, inputOpts);
}
exports.getWebsiteMediaAccess = getWebsiteMediaAccess;

function createWebsiteMedia(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('CreateWebsiteMedia', inputVars, inputOpts);
}
exports.createWebsiteMedia = createWebsiteMedia;

function setWebsiteMediaUploadStatus(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('SetWebsiteMediaUploadStatus', inputVars, inputOpts);
}
exports.setWebsiteMediaUploadStatus = setWebsiteMediaUploadStatus;

function listWebsiteMedia(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ListWebsiteMedia', inputVars, inputOpts);
}
exports.listWebsiteMedia = listWebsiteMedia;

function getWebsiteMediaByIds(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('GetWebsiteMediaByIds', inputVars, inputOpts);
}
exports.getWebsiteMediaByIds = getWebsiteMediaByIds;

function updateWebsiteMediaAlt(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('UpdateWebsiteMediaAlt', inputVars, inputOpts);
}
exports.updateWebsiteMediaAlt = updateWebsiteMediaAlt;

function archiveWebsiteMedia(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('ArchiveWebsiteMedia', inputVars, inputOpts);
}
exports.archiveWebsiteMedia = archiveWebsiteMedia;

function createWebsiteSectionTemplate(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('CreateWebsiteSectionTemplate', inputVars, inputOpts);
}
exports.createWebsiteSectionTemplate = createWebsiteSectionTemplate;

function listWebsiteSectionTemplates(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ListWebsiteSectionTemplates', inputVars, inputOpts);
}
exports.listWebsiteSectionTemplates = listWebsiteSectionTemplates;

function deleteWebsiteSectionTemplate(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('DeleteWebsiteSectionTemplate', inputVars, inputOpts);
}
exports.deleteWebsiteSectionTemplate = deleteWebsiteSectionTemplate;

