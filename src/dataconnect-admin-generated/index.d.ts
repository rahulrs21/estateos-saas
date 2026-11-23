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
  DEVELOPER_CREATED = "DEVELOPER_CREATED",
  DEVELOPER_UPDATED = "DEVELOPER_UPDATED",
  DEVELOPER_ARCHIVED = "DEVELOPER_ARCHIVED",
  PROJECT_CREATED = "PROJECT_CREATED",
  PROJECT_UPDATED = "PROJECT_UPDATED",
  PROJECT_ARCHIVED = "PROJECT_ARCHIVED",
  BUILDING_CREATED = "BUILDING_CREATED",
  BUILDING_UPDATED = "BUILDING_UPDATED",
  BUILDING_ARCHIVED = "BUILDING_ARCHIVED",
  PROPERTY_CREATED = "PROPERTY_CREATED",
  PROPERTY_UPDATED = "PROPERTY_UPDATED",
  PROPERTY_ARCHIVED = "PROPERTY_ARCHIVED",
  PROPERTY_LISTING_CREATED = "PROPERTY_LISTING_CREATED",
  PROPERTY_LISTING_UPDATED = "PROPERTY_LISTING_UPDATED",
  PROPERTY_LISTING_ARCHIVED = "PROPERTY_LISTING_ARCHIVED",
  FLOOR_PLAN_CREATED = "FLOOR_PLAN_CREATED",
  FLOOR_PLAN_UPDATED = "FLOOR_PLAN_UPDATED",
  FLOOR_PLAN_ARCHIVED = "FLOOR_PLAN_ARCHIVED",
  PAYMENT_PLAN_CREATED = "PAYMENT_PLAN_CREATED",
  PAYMENT_PLAN_UPDATED = "PAYMENT_PLAN_UPDATED",
  PAYMENT_PLAN_ARCHIVED = "PAYMENT_PLAN_ARCHIVED",
  PROPERTY_AMENITY_CHANGED = "PROPERTY_AMENITY_CHANGED",
  PROPERTY_FEATURE_CREATED = "PROPERTY_FEATURE_CREATED",
  PROPERTY_FEATURE_UPDATED = "PROPERTY_FEATURE_UPDATED",
  PROPERTY_FEATURE_ARCHIVED = "PROPERTY_FEATURE_ARCHIVED",
  LEAD_PROPERTY_INTEREST_CHANGED = "LEAD_PROPERTY_INTEREST_CHANGED",
  LEAD_PRIMARY_INTEREST_CHANGED = "LEAD_PRIMARY_INTEREST_CHANGED",
  LEAD_PROPERTY_VIEWING_SCHEDULED = "LEAD_PROPERTY_VIEWING_SCHEDULED",
  LEAD_PROPERTY_VIEWING_UPDATED = "LEAD_PROPERTY_VIEWING_UPDATED",
  PORTAL_CONNECTION_UPDATED = "PORTAL_CONNECTION_UPDATED",
  PORTAL_FIELD_MAPPING_CHANGED = "PORTAL_FIELD_MAPPING_CHANGED",
  LISTING_PUBLICATION_VALIDATED = "LISTING_PUBLICATION_VALIDATED",
  FEED_GENERATION_RECORDED = "FEED_GENERATION_RECORDED",
  AI_CONVERSATION_DELETED = "AI_CONVERSATION_DELETED",
  AI_CONTENT_DRAFT_CREATED = "AI_CONTENT_DRAFT_CREATED",
  AI_CONTENT_DRAFT_STATUS_CHANGED = "AI_CONTENT_DRAFT_STATUS_CHANGED",
  AI_CONTENT_DRAFT_DELETED = "AI_CONTENT_DRAFT_DELETED",
  AI_CONTENT_TEMPLATE_CHANGED = "AI_CONTENT_TEMPLATE_CHANGED",
  AI_BRAND_PROFILE_UPDATED = "AI_BRAND_PROFILE_UPDATED",
  LEAD_QUALIFICATION_UPDATED = "LEAD_QUALIFICATION_UPDATED",
  AI_LEAD_PRIORITY_REVIEWED = "AI_LEAD_PRIORITY_REVIEWED",
  WEBSITE_UPDATED = "WEBSITE_UPDATED",
  WEBSITE_PAGE_CREATED = "WEBSITE_PAGE_CREATED",
  WEBSITE_PAGE_STATUS_CHANGED = "WEBSITE_PAGE_STATUS_CHANGED",
  WEBSITE_PAGE_PUBLISHED = "WEBSITE_PAGE_PUBLISHED",
  WEBSITE_PAGE_UNPUBLISHED = "WEBSITE_PAGE_UNPUBLISHED",
  WEBSITE_PAGE_FORM_CHANGED = "WEBSITE_PAGE_FORM_CHANGED",
  WEBSITE_PAGE_ARCHIVED = "WEBSITE_PAGE_ARCHIVED",
  WEBSITE_ENQUIRY_RECOVERED = "WEBSITE_ENQUIRY_RECOVERED",
  WEBSITE_ENQUIRY_DISMISSED = "WEBSITE_ENQUIRY_DISMISSED",
  WEBSITE_AGENT_CARD_UPDATED = "WEBSITE_AGENT_CARD_UPDATED",
  WEBSITE_MEDIA_UPLOADED = "WEBSITE_MEDIA_UPLOADED",
  WEBSITE_MEDIA_UPDATED = "WEBSITE_MEDIA_UPDATED",
  WEBSITE_MEDIA_ARCHIVED = "WEBSITE_MEDIA_ARCHIVED",
  WEBSITE_SECTION_TEMPLATE_SAVED = "WEBSITE_SECTION_TEMPLATE_SAVED",
  WEBSITE_SECTION_TEMPLATE_DELETED = "WEBSITE_SECTION_TEMPLATE_DELETED",
  AUTOMATION_WORKFLOW_CHANGED = "AUTOMATION_WORKFLOW_CHANGED",
  AUTOMATION_EXECUTION_CHANGED = "AUTOMATION_EXECUTION_CHANGED",
  AUTOMATION_APPROVAL_CHANGED = "AUTOMATION_APPROVAL_CHANGED",
  WORK_TASK_CHANGED = "WORK_TASK_CHANGED",
  CALL_LOGGED = "CALL_LOGGED",
  CALL_UPDATED = "CALL_UPDATED",
  COMMUNICATION_SETTINGS_UPDATED = "COMMUNICATION_SETTINGS_UPDATED",
  COMMUNICATION_SUPPRESSION_CHANGED = "COMMUNICATION_SUPPRESSION_CHANGED",
  COMMUNICATION_PROVIDER_CHANGED = "COMMUNICATION_PROVIDER_CHANGED",
  PHONE_LINE_CHANGED = "PHONE_LINE_CHANGED",
  LIVE_CALLING_ATTESTATION_CHANGED = "LIVE_CALLING_ATTESTATION_CHANGED",
  CALL_STARTED = "CALL_STARTED",
  CALL_CONSENT_CHANGED = "CALL_CONSENT_CHANGED",
  CALL_RECORDING_CHANGED = "CALL_RECORDING_CHANGED",
  CALL_TRANSCRIPT_CHANGED = "CALL_TRANSCRIPT_CHANGED",
  CALL_MEDIA_ACCESSED = "CALL_MEDIA_ACCESSED",
  CALL_AI_SUMMARY_CHANGED = "CALL_AI_SUMMARY_CHANGED",
  VOICE_ASSISTANT_UPDATED = "VOICE_ASSISTANT_UPDATED",
  VOICE_ASSISTANT_TEST_STARTED = "VOICE_ASSISTANT_TEST_STARTED",
  MEETING_SCHEDULED = "MEETING_SCHEDULED",
  MEETING_UPDATED = "MEETING_UPDATED",
  MEETING_COMPLETED = "MEETING_COMPLETED",
  MEETING_SUMMARY_CHANGED = "MEETING_SUMMARY_CHANGED",
  COMMUNICATION_SIMULATION_CHANGED = "COMMUNICATION_SIMULATION_CHANGED",
  INBOX_CONVERSATION_CHANGED = "INBOX_CONVERSATION_CHANGED",
  INBOX_ASSIGNED = "INBOX_ASSIGNED",
  INBOX_NOTE_ADDED = "INBOX_NOTE_ADDED",
  INBOX_LINKED = "INBOX_LINKED",
  CHANNEL_CONNECTION_CHANGED = "CHANNEL_CONNECTION_CHANGED",
  INBOX_OUTBOUND_CHANGED = "INBOX_OUTBOUND_CHANGED",
  INBOX_SETTINGS_UPDATED = "INBOX_SETTINGS_UPDATED",
  INBOX_ATTACHMENT_ACCESSED = "INBOX_ATTACHMENT_ACCESSED",
  INBOX_AI_GENERATED = "INBOX_AI_GENERATED",
  AD_LEAD_CAPTURED = "AD_LEAD_CAPTURED",
  META_LEAD_PAGE_CONNECTED = "META_LEAD_PAGE_CONNECTED",
  META_LEAD_PAGE_DISCONNECTED = "META_LEAD_PAGE_DISCONNECTED",
  META_LEAD_FORM_UPDATED = "META_LEAD_FORM_UPDATED",
}
export enum AgentAvailabilityStatus {
  AVAILABLE = "AVAILABLE",
  UNAVAILABLE = "UNAVAILABLE",
}
export enum AiContentDraftStatus {
  DRAFT = "DRAFT",
  IN_REVIEW = "IN_REVIEW",
  APPROVED = "APPROVED",
  ARCHIVED = "ARCHIVED",
}
export enum AiContentLanguage {
  EN = "EN",
  AR = "AR",
  EN_AR = "EN_AR",
}
export enum AiContentType {
  PROPERTY_DESCRIPTION = "PROPERTY_DESCRIPTION",
  PROJECT_MARKETING = "PROJECT_MARKETING",
  WHATSAPP_MESSAGE = "WHATSAPP_MESSAGE",
  EMAIL = "EMAIL",
  SOCIAL_MEDIA = "SOCIAL_MEDIA",
  ADVERTISING = "ADVERTISING",
  CLIENT_PROPOSAL = "CLIENT_PROPOSAL",
}
export enum AiContentVersionKind {
  GENERATED = "GENERATED",
  REGENERATED = "REGENERATED",
  ALTERNATIVE = "ALTERNATIVE",
  EDITED = "EDITED",
  RESTORED = "RESTORED",
}
export enum AiLeadPriority {
  HIGH = "HIGH",
  MEDIUM = "MEDIUM",
  LOW = "LOW",
  INSUFFICIENT_DATA = "INSUFFICIENT_DATA",
}
export enum AiMessageRole {
  USER = "USER",
  ASSISTANT = "ASSISTANT",
}
export enum AiRequestStatus {
  SUCCEEDED = "SUCCEEDED",
  FAILED = "FAILED",
  CANCELLED = "CANCELLED",
}
export enum AiSalesInsightKind {
  LEAD_ANALYSIS = "LEAD_ANALYSIS",
  VIEWING_BRIEF = "VIEWING_BRIEF",
  PIPELINE_SUMMARY = "PIPELINE_SUMMARY",
}
export enum AiToolExecutionStatus {
  SUCCEEDED = "SUCCEEDED",
  FAILED = "FAILED",
  REJECTED = "REJECTED",
}
export enum AreaUnit {
  SQFT = "SQFT",
  SQM = "SQM",
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
export enum AutomationApprovalStatus {
  PENDING = "PENDING",
  APPROVED = "APPROVED",
  REJECTED = "REJECTED",
  EXPIRED = "EXPIRED",
  CANCELLED = "CANCELLED",
  EXECUTED = "EXECUTED",
}
export enum AutomationEventStatus {
  PENDING = "PENDING",
  PROCESSED = "PROCESSED",
  SKIPPED = "SKIPPED",
  FAILED = "FAILED",
}
export enum AutomationExecutionStatus {
  QUEUED = "QUEUED",
  RUNNING = "RUNNING",
  WAITING = "WAITING",
  APPROVAL_REQUIRED = "APPROVAL_REQUIRED",
  PAUSED = "PAUSED",
  SUCCEEDED = "SUCCEEDED",
  SKIPPED = "SKIPPED",
  FAILED = "FAILED",
  CANCELLED = "CANCELLED",
}
export enum AutomationJobStatus {
  QUEUED = "QUEUED",
  CLAIMED = "CLAIMED",
  SUCCEEDED = "SUCCEEDED",
  FAILED = "FAILED",
  DEAD = "DEAD",
  CANCELLED = "CANCELLED",
}
export enum AutomationStepStatus {
  PENDING = "PENDING",
  RUNNING = "RUNNING",
  WAITING = "WAITING",
  APPROVAL_REQUIRED = "APPROVAL_REQUIRED",
  SUCCEEDED = "SUCCEEDED",
  SKIPPED = "SKIPPED",
  FAILED = "FAILED",
  CANCELLED = "CANCELLED",
}
export enum AutomationWorkflowStatus {
  DRAFT = "DRAFT",
  IN_REVIEW = "IN_REVIEW",
  APPROVED = "APPROVED",
  ACTIVE = "ACTIVE",
  PAUSED = "PAUSED",
  ARCHIVED = "ARCHIVED",
}
export enum BuildingType {
  RESIDENTIAL = "RESIDENTIAL",
  COMMERCIAL = "COMMERCIAL",
  MIXED_USE = "MIXED_USE",
  TOWNHOUSE = "TOWNHOUSE",
  VILLA = "VILLA",
  OTHER = "OTHER",
}
export enum CallDirection {
  OUTBOUND = "OUTBOUND",
  INBOUND = "INBOUND",
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
export enum CallType {
  SERVICE = "SERVICE",
  FOLLOW_UP = "FOLLOW_UP",
  MARKETING = "MARKETING",
  INBOUND_ENQUIRY = "INBOUND_ENQUIRY",
}
export enum CompanySize {
  SOLO = "SOLO",
  TWO_TO_TEN = "TWO_TO_TEN",
  ELEVEN_TO_FIFTY = "ELEVEN_TO_FIFTY",
  FIFTY_ONE_TO_TWO_HUNDRED = "FIFTY_ONE_TO_TWO_HUNDRED",
  TWO_HUNDRED_PLUS = "TWO_HUNDRED_PLUS",
}
export enum CompletionStatus {
  PLANNED = "PLANNED",
  UNDER_CONSTRUCTION = "UNDER_CONSTRUCTION",
  COMPLETED = "COMPLETED",
  ON_HOLD = "ON_HOLD",
}
export enum ConstructionStatus {
  PLANNING = "PLANNING",
  LAUNCHED = "LAUNCHED",
  UNDER_CONSTRUCTION = "UNDER_CONSTRUCTION",
  COMPLETED = "COMPLETED",
  ON_HOLD = "ON_HOLD",
}
export enum DeveloperStatus {
  ACTIVE = "ACTIVE",
  INACTIVE = "INACTIVE",
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
export enum FeatureValueType {
  TEXT = "TEXT",
  NUMBER = "NUMBER",
  BOOLEAN = "BOOLEAN",
}
export enum FeedFormat {
  JSON = "JSON",
  XML = "XML",
}
export enum FeedGenerationStatus {
  QUEUED = "QUEUED",
  RUNNING = "RUNNING",
  SUCCEEDED = "SUCCEEDED",
  FAILED = "FAILED",
  CANCELLED = "CANCELLED",
}
export enum FurnishedStatus {
  FURNISHED = "FURNISHED",
  SEMI_FURNISHED = "SEMI_FURNISHED",
  UNFURNISHED = "UNFURNISHED",
}
export enum InAppNotificationType {
  LEAD_ASSIGNED = "LEAD_ASSIGNED",
  LEAD_UNASSIGNED = "LEAD_UNASSIGNED",
  AUTOMATION = "AUTOMATION",
  APPROVAL_REQUESTED = "APPROVAL_REQUESTED",
  INBOX_MESSAGE = "INBOX_MESSAGE",
  INBOX_ASSIGNED = "INBOX_ASSIGNED",
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
export enum InboxPriority {
  LOW = "LOW",
  NORMAL = "NORMAL",
  HIGH = "HIGH",
  URGENT = "URGENT",
}
export enum InventoryMediaKind {
  PROPERTY_PHOTO = "PROPERTY_PHOTO",
  FLOOR_PLAN = "FLOOR_PLAN",
  BROCHURE = "BROCHURE",
  DOCUMENT = "DOCUMENT",
}
export enum InventoryMediaStatus {
  PENDING = "PENDING",
  ACTIVE = "ACTIVE",
  DELETING = "DELETING",
  DELETED = "DELETED",
}
export enum InventoryStatus {
  DRAFT = "DRAFT",
  AVAILABLE = "AVAILABLE",
  RESERVED = "RESERVED",
  SOLD = "SOLD",
  RENTED = "RENTED",
  INACTIVE = "INACTIVE",
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
export enum LeadPropertyInterestStatus {
  SAVED = "SAVED",
  INTERESTED = "INTERESTED",
  NOT_INTERESTED = "NOT_INTERESTED",
  REMOVED = "REMOVED",
}
export enum LeadPropertyViewingConfirmation {
  PENDING = "PENDING",
  CONFIRMED = "CONFIRMED",
  DECLINED = "DECLINED",
}
export enum LeadPropertyViewingOutcome {
  POSITIVE = "POSITIVE",
  NEUTRAL = "NEUTRAL",
  NEGATIVE = "NEGATIVE",
  NO_SHOW = "NO_SHOW",
}
export enum LeadPropertyViewingStatus {
  SCHEDULED = "SCHEDULED",
  COMPLETED = "COMPLETED",
  CANCELLED = "CANCELLED",
}
export enum LeadReadiness {
  READY_TO_PROCEED = "READY_TO_PROCEED",
  EXPLORING = "EXPLORING",
  NOT_READY = "NOT_READY",
}
export enum LeadSourceType {
  MANUAL = "MANUAL",
  REFERRAL = "REFERRAL",
  WEBSITE = "WEBSITE",
  PORTAL = "PORTAL",
  OTHER = "OTHER",
  META_LEAD_ADS = "META_LEAD_ADS",
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
export enum LeadTimeline {
  IMMEDIATE = "IMMEDIATE",
  WITHIN_3_MONTHS = "WITHIN_3_MONTHS",
  WITHIN_6_MONTHS = "WITHIN_6_MONTHS",
  WITHIN_12_MONTHS = "WITHIN_12_MONTHS",
  LATER = "LATER",
  UNDECIDED = "UNDECIDED",
}
export enum ListingPublicationState {
  NOT_PUBLISHED = "NOT_PUBLISHED",
  VALIDATION_FAILED = "VALIDATION_FAILED",
  READY = "READY",
  QUEUED = "QUEUED",
  PUBLISHED = "PUBLISHED",
  FAILED = "FAILED",
  REMOVAL_REQUESTED = "REMOVAL_REQUESTED",
  REMOVED = "REMOVED",
}
export enum ListingPublicationStatus {
  NOT_PUBLISHED = "NOT_PUBLISHED",
  READY = "READY",
  PUBLISHED = "PUBLISHED",
  FAILED = "FAILED",
}
export enum ListingPurpose {
  SALE = "SALE",
  RENT = "RENT",
}
export enum ListingStatus {
  DRAFT = "DRAFT",
  PENDING_REVIEW = "PENDING_REVIEW",
  APPROVED = "APPROVED",
  ACTIVE = "ACTIVE",
  PAUSED = "PAUSED",
  CLOSED = "CLOSED",
  ARCHIVED = "ARCHIVED",
  UNDER_OFFER = "UNDER_OFFER",
  SOLD = "SOLD",
  RENTED = "RENTED",
  WITHDRAWN = "WITHDRAWN",
  EXPIRED = "EXPIRED",
}
export enum MapDisplayMode {
  EXACT = "EXACT",
  APPROXIMATE = "APPROXIMATE",
  HIDDEN = "HIDDEN",
}
export enum MarketType {
  OFF_PLAN = "OFF_PLAN",
  SECONDARY = "SECONDARY",
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
export enum MembershipStatus {
  INVITED = "INVITED",
  PENDING = "PENDING",
  ACTIVE = "ACTIVE",
  SUSPENDED = "SUSPENDED",
  REVOKED = "REVOKED",
  REMOVED = "REMOVED",
}
export enum MetaLeadConnectionStatus {
  ACTIVE = "ACTIVE",
  NEEDS_RECONNECT = "NEEDS_RECONNECT",
}
export enum MetaLeadEventStatus {
  RECEIVED = "RECEIVED",
  PROCESSED = "PROCESSED",
  DUPLICATE = "DUPLICATE",
  FAILED = "FAILED",
  DEAD = "DEAD",
  IGNORED = "IGNORED",
}
export enum NotificationAudience {
  MEMBER = "MEMBER",
  ADMIN = "ADMIN",
}
export enum OccupancyStatus {
  VACANT = "VACANT",
  OCCUPIED = "OCCUPIED",
  TENANTED = "TENANTED",
  UNDER_CONSTRUCTION = "UNDER_CONSTRUCTION",
}
export enum OwnershipType {
  FREEHOLD = "FREEHOLD",
  LEASEHOLD = "LEASEHOLD",
  SHARED_OWNERSHIP = "SHARED_OWNERSHIP",
}
export enum PagePublicationStatus {
  ACTIVE = "ACTIVE",
  SUPERSEDED = "SUPERSEDED",
  UNPUBLISHED = "UNPUBLISHED",
}
export enum PageVersionKind {
  CREATED = "CREATED",
  GENERATED = "GENERATED",
  EDITED = "EDITED",
  RESTORED = "RESTORED",
  DUPLICATED = "DUPLICATED",
}
export enum PaymentDueTrigger {
  CONSTRUCTION_MILESTONE = "CONSTRUCTION_MILESTONE",
  HANDOVER = "HANDOVER",
  POST_HANDOVER = "POST_HANDOVER",
}
export enum PendingEnquiryStatus {
  PENDING = "PENDING",
  RECOVERED = "RECOVERED",
  DISMISSED = "DISMISSED",
}
export enum PortalConnectionStatus {
  NOT_CONFIGURED = "NOT_CONFIGURED",
  PENDING_APPROVAL = "PENDING_APPROVAL",
  CONNECTED = "CONNECTED",
  ERROR = "ERROR",
  DISABLED = "DISABLED",
}
export enum PortalProvider {
  PROPERTY_FINDER = "PROPERTY_FINDER",
  BAYUT = "BAYUT",
  DUBIZZLE = "DUBIZZLE",
}
export enum ProjectStatus {
  DRAFT = "DRAFT",
  ACTIVE = "ACTIVE",
  INACTIVE = "INACTIVE",
  COMPLETED = "COMPLETED",
}
export enum ProjectType {
  RESIDENTIAL = "RESIDENTIAL",
  COMMERCIAL = "COMMERCIAL",
  MIXED_USE = "MIXED_USE",
  LAND = "LAND",
}
export enum PropertyType {
  APARTMENT = "APARTMENT",
  VILLA = "VILLA",
  TOWNHOUSE = "TOWNHOUSE",
  PENTHOUSE = "PENTHOUSE",
  PLOT = "PLOT",
  COMMERCIAL = "COMMERCIAL",
  OFFICE = "OFFICE",
  RETAIL = "RETAIL",
  WAREHOUSE = "WAREHOUSE",
}
export enum RentalPeriod {
  MONTHLY = "MONTHLY",
  YEARLY = "YEARLY",
}
export enum TransactionType {
  BUY = "BUY",
  RENT = "RENT",
  INVEST = "INVEST",
}
export enum WebsiteMediaStatus {
  PENDING = "PENDING",
  ACTIVE = "ACTIVE",
  ARCHIVED = "ARCHIVED",
  DELETED = "DELETED",
}
export enum WebsitePageStatus {
  DRAFT = "DRAFT",
  IN_REVIEW = "IN_REVIEW",
  APPROVED = "APPROVED",
  PUBLISHED = "PUBLISHED",
  UNPUBLISHED = "UNPUBLISHED",
  ARCHIVED = "ARCHIVED",
}
export enum WebsitePageType {
  LANDING_PAGE = "LANDING_PAGE",
}
export enum WebsiteStatus {
  ACTIVE = "ACTIVE",
  ARCHIVED = "ARCHIVED",
}
export enum WorkTaskStatus {
  PENDING = "PENDING",
  COMPLETED = "COMPLETED",
  CANCELLED = "CANCELLED",
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

export interface ActivateAutomationWorkflowData {
  workflow?: AutomationWorkflow_Key | null;
  auditLog_insert: AuditLog_Key;
}

export interface ActivateAutomationWorkflowVariables {
  organizationId: UUIDString;
  id: UUIDString;
  expectedRevision: number;
  nextRunAt?: TimestampString | null;
}

export interface Activity_Key {
  organizationId: UUIDString;
  id: UUIDString;
  __typename?: 'Activity_Key';
}

export interface AddAiContentAlternativeData {
  draft?: AiContentDraft_Key | null;
  version: AiContentVersion_Key;
}

export interface AddAiContentAlternativeVariables {
  organizationId: UUIDString;
  id: UUIDString;
  actorUid: string;
  createdByUid?: string | null;
  expectedRevision: number;
  nextRevision: number;
  versionNumber: number;
  title: string;
  contentData: string;
  validation: string;
  model: string;
  generatedAt: TimestampString;
}

export interface AddGeneratedPageVersionData {
  page?: WebsitePage_Key | null;
  version: PageVersion_Key;
}

export interface AddGeneratedPageVersionVariables {
  organizationId: UUIDString;
  id: UUIDString;
  actorUid: string;
  createdByUid?: string | null;
  expectedRevision: number;
  nextRevision: number;
  versionNumber: number;
  title: string;
  seoTitle?: string | null;
  seoDescription?: string | null;
  designStyle: string;
  structuredPageData: string;
  validation?: string | null;
  model: string;
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

export interface AddPaymentPlanInstallmentData {
  paymentPlan_update?: PaymentPlan_Key | null;
  paymentPlanInstallment_insert: PaymentPlanInstallment_Key;
  activity_insert: Activity_Key;
  auditLog_insert: AuditLog_Key;
}

export interface AddPaymentPlanInstallmentVariables {
  organizationId: UUIDString;
  paymentPlanId: UUIDString;
  expectedTotalBps: number;
  newTotalBps: number;
  position: number;
  percentageBps: number;
  dueTrigger: PaymentDueTrigger;
  constructionMilestonePercent?: number | null;
  postHandoverMonths?: number | null;
  description?: string | null;
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

export interface AppendAiExchangeData {
  conversation?: AiConversation_Key | null;
  messages: AiMessage_Key[];
}

export interface AppendAiExchangeVariables {
  organizationId: UUIDString;
  conversationId: UUIDString;
  ownerUid: string;
  expectedMessageCount: number;
  nextMessageCount: number;
  userSequence: number;
  assistantSequence: number;
  userContent: string;
  assistantContent: string;
}

export interface ApproveAutomationWorkflowData {
  workflow?: AutomationWorkflow_Key | null;
  auditLog_insert: AuditLog_Key;
}

export interface ApproveAutomationWorkflowVariables {
  organizationId: UUIDString;
  id: UUIDString;
  expectedRevision: number;
  versionNumber: number;
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

export interface ApproveWebsitePageData {
  page?: WebsitePage_Key | null;
  version?: PageVersion_Key | null;
  audit: AuditLog_Key;
}

export interface ApproveWebsitePageVariables {
  organizationId: UUIDString;
  id: UUIDString;
  versionNumber: number;
  expectedRevision: number;
  nextRevision: number;
}

export interface ArchiveAutomationWorkflowData {
  workflow?: AutomationWorkflow_Key | null;
  auditLog_insert: AuditLog_Key;
}

export interface ArchiveAutomationWorkflowVariables {
  organizationId: UUIDString;
  id: UUIDString;
  expectedRevision: number;
}

export interface ArchiveBuildingData {
  building_update?: Building_Key | null;
  activity_insert: Activity_Key;
  auditLog_insert: AuditLog_Key;
}

export interface ArchiveBuildingVariables {
  organizationId: UUIDString;
  id: UUIDString;
}

export interface ArchiveDeveloperData {
  developer_update?: Developer_Key | null;
  activity_insert: Activity_Key;
  auditLog_insert: AuditLog_Key;
}

export interface ArchiveDeveloperVariables {
  organizationId: UUIDString;
  id: UUIDString;
}

export interface ArchiveFloorPlanData {
  floorPlan_update?: FloorPlan_Key | null;
  activity_insert: Activity_Key;
  auditLog_insert: AuditLog_Key;
}

export interface ArchiveFloorPlanVariables {
  organizationId: UUIDString;
  id: UUIDString;
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

export interface ArchivePaymentPlanData {
  paymentPlan_update?: PaymentPlan_Key | null;
  activity_insert: Activity_Key;
  auditLog_insert: AuditLog_Key;
}

export interface ArchivePaymentPlanVariables {
  organizationId: UUIDString;
  id: UUIDString;
}

export interface ArchiveProjectData {
  project_update?: Project_Key | null;
  activity_insert: Activity_Key;
  auditLog_insert: AuditLog_Key;
}

export interface ArchiveProjectPhaseData {
  projectPhase_update?: ProjectPhase_Key | null;
  activity_insert: Activity_Key;
  auditLog_insert: AuditLog_Key;
}

export interface ArchiveProjectPhaseVariables {
  organizationId: UUIDString;
  projectId: UUIDString;
  id: UUIDString;
}

export interface ArchiveProjectVariables {
  organizationId: UUIDString;
  id: UUIDString;
}

export interface ArchivePropertyData {
  property_update?: Property_Key | null;
  activity_insert: Activity_Key;
  auditLog_insert: AuditLog_Key;
}

export interface ArchivePropertyFeatureData {
  propertyFeature_update?: PropertyFeature_Key | null;
  activity_insert: Activity_Key;
  auditLog_insert: AuditLog_Key;
}

export interface ArchivePropertyFeatureVariables {
  organizationId: UUIDString;
  id: UUIDString;
}

export interface ArchivePropertyListingData {
  propertyListing_update?: PropertyListing_Key | null;
  activity_insert: Activity_Key;
  auditLog_insert: AuditLog_Key;
}

export interface ArchivePropertyListingVariables {
  organizationId: UUIDString;
  id: UUIDString;
}

export interface ArchivePropertyVariables {
  organizationId: UUIDString;
  id: UUIDString;
}

export interface ArchiveWebsiteMediaData {
  websiteMedia_update?: WebsiteMedia_Key | null;
  auditLog_insert: AuditLog_Key;
}

export interface ArchiveWebsiteMediaVariables {
  organizationId: UUIDString;
  id: UUIDString;
}

export interface ArchiveWebsitePageData {
  page?: WebsitePage_Key | null;
  audit: AuditLog_Key;
}

export interface ArchiveWebsitePageVariables {
  organizationId: UUIDString;
  id: UUIDString;
  createdByUid?: string | null;
  expectedRevision: number;
  nextRevision: number;
}

export interface AssignLeadData {
  lead?: Lead_Key | null;
  assignment: LeadAssignmentHistory_Key;
  leadFollowUp_updateMany: number;
  activity: Activity_Key;
  auditLog_insert: AuditLog_Key;
  assignedNotification: InAppNotification_Key;
  leadAssignedEvent: AutomationEvent_Key;
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

export interface AssignedListingStatusCountsData {
  statuses: ({
    listingStatus: ListingStatus;
    _count: number;
  })[];
}

export interface AssignedListingStatusCountsVariables {
  organizationId: UUIDString;
  assignedMembershipId: UUIDString;
}

export interface AttachProjectAmenityData {
  projectAmenity_insert: ProjectAmenity_Key;
  activity_insert: Activity_Key;
  auditLog_insert: AuditLog_Key;
}

export interface AttachProjectAmenityVariables {
  organizationId: UUIDString;
  projectId: UUIDString;
  amenityId: UUIDString;
}

export interface AttachPropertyAmenityData {
  relation: PropertyAmenity_Key;
  activity_insert: Activity_Key;
  auditLog_insert: AuditLog_Key;
}

export interface AttachPropertyAmenityVariables {
  organizationId: UUIDString;
  propertyId: UUIDString;
  amenityId: UUIDString;
}

export interface AuditLog_Key {
  organizationId: UUIDString;
  id: UUIDString;
  __typename?: 'AuditLog_Key';
}

export interface AutomationAddLeadNoteData {
  activity_insert: Activity_Key;
}

export interface AutomationAddLeadNoteVariables {
  organizationId: UUIDString;
  id: UUIDString;
  leadId: UUIDString;
  note: string;
  executionId: UUIDString;
}

export interface AutomationApproval_Key {
  organizationId: UUIDString;
  id: UUIDString;
  __typename?: 'AutomationApproval_Key';
}

export interface AutomationCreateLeadFollowUpData {
  followUp: LeadFollowUp_Key;
  activity_insert: Activity_Key;
  auditLog_insert: AuditLog_Key;
  automationEvent_insert: AutomationEvent_Key;
}

export interface AutomationCreateLeadFollowUpVariables {
  organizationId: UUIDString;
  id: UUIDString;
  leadId: UUIDString;
  title: string;
  dueAt: TimestampString;
  eventId: UUIDString;
  originalEventId: UUIDString;
  parentExecutionId: UUIDString;
  originWorkflowId: UUIDString;
  chainDepth: number;
}

export interface AutomationCreateWorkTaskData {
  task: WorkTask_Key;
  auditLog_insert: AuditLog_Key;
  automationEvent_insert: AutomationEvent_Key;
}

export interface AutomationCreateWorkTaskVariables {
  organizationId: UUIDString;
  id: UUIDString;
  title: string;
  dueAt: TimestampString;
  assignedMembershipId?: UUIDString | null;
  listingId?: UUIDString | null;
  leadId?: UUIDString | null;
  eventId: UUIDString;
  originalEventId: UUIDString;
  parentExecutionId: UUIDString;
  originWorkflowId: UUIDString;
  chainDepth: number;
}

export interface AutomationDistributeLeadData {
  cursor?: DistributionCursor_Key | null;
  lead?: Lead_Key | null;
  leadAssignmentHistory_insert: LeadAssignmentHistory_Key;
  leadFollowUp_updateMany: number;
  activity_insert: Activity_Key;
  auditLog_insert: AuditLog_Key;
  inAppNotification_insert: InAppNotification_Key;
  automationEvent_insert: AutomationEvent_Key;
}

export interface AutomationDistributeLeadVariables {
  organizationId: UUIDString;
  leadId: UUIDString;
  assignedMembershipId: UUIDString;
  distributionRuleId: UUIDString;
  expectedCursorVersion: number;
  executionId: UUIDString;
  eventId: UUIDString;
  originalEventId: UUIDString;
  originWorkflowId: UUIDString;
  chainDepth: number;
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

export interface AutomationExecutorProfileData {
  userProfile?: {
    uid: string;
    email: string;
    displayName: string;
  } & UserProfile_Key;
}

export interface AutomationExecutorProfileVariables {
  uid: string;
}

export interface AutomationFactsData {
  executor?: {
    id: UUIDString;
    role: MembershipRole;
  };
  lead?: {
    id: UUIDString;
    fullName: string;
    status: LeadStatus;
    source?: string | null;
    priority: LeadPriority;
    assignedMembershipId?: UUIDString | null;
    projectId?: UUIDString | null;
    propertyId?: UUIDString | null;
    branchId?: UUIDString | null;
    budgetMax?: number | null;
    archivedAt?: TimestampString | null;
    createdAt: TimestampString;
    updatedAt: TimestampString;
  };
  contactActivity: ({
    id: UUIDString;
  })[];
  completedFollowUps: ({
    id: UUIDString;
  })[];
  answeredCalls: ({
    id: UUIDString;
  })[];
  call?: {
    id: UUIDString;
    leadId?: UUIDString | null;
    contactId?: UUIDString | null;
    agentMembershipId: UUIDString;
    direction: CallDirection;
    callType: CallType;
    callStatus: CallStatus;
    outcome?: CallOutcome | null;
    durationSeconds: number;
    source: CallSource;
  };
  meeting?: {
    id: UUIDString;
    leadId?: UUIDString | null;
    contactId?: UUIDString | null;
    organizerMembershipId: UUIDString;
    title: string;
    status: MeetingStatus;
    provider: MeetingProvider;
    startsAt: TimestampString;
  };
  listing?: {
    id: UUIDString;
    title: string;
    listingStatus: ListingStatus;
    listingPurpose: ListingPurpose;
    assignedMembershipId?: UUIDString | null;
    askingPriceMinor: Int64String;
    archivedAt?: TimestampString | null;
  };
  viewing?: {
    id: UUIDString;
    leadId: UUIDString;
    status: LeadPropertyViewingStatus;
    outcome?: LeadPropertyViewingOutcome | null;
    scheduledAt: TimestampString;
  };
  followUp?: {
    id: UUIDString;
    leadId: UUIDString;
    title: string;
    status: LeadFollowUpStatus;
    dueAt: TimestampString;
    assignedUserId: UUIDString;
  };
  workTask?: {
    id: UUIDString;
    title: string;
    status: WorkTaskStatus;
    dueAt: TimestampString;
    assignedMembershipId?: UUIDString | null;
    leadId?: UUIDString | null;
    listingId?: UUIDString | null;
  };
  contact?: {
    id: UUIDString;
    preferredLanguage: string;
    email?: string | null;
    phone?: string | null;
  };
  conversation?: {
    id: UUIDString;
    channel: InboxChannel;
    status: InboxConversationStatus;
    priority: InboxPriority;
    assignedMembershipId?: UUIDString | null;
    leadId?: UUIDString | null;
    contactId?: UUIDString | null;
    customerName?: string | null;
    optedOut: boolean;
    unreadCount: number;
    lastInboundAt?: TimestampString | null;
    lastOutboundAt?: TimestampString | null;
    simulated: boolean;
  };
}

export interface AutomationFactsVariables {
  organizationId: UUIDString;
  leadId?: UUIDString | null;
  hasLead: boolean;
  listingId?: UUIDString | null;
  hasListing: boolean;
  viewingId?: UUIDString | null;
  hasViewing: boolean;
  followUpId?: UUIDString | null;
  hasFollowUp: boolean;
  workTaskId?: UUIDString | null;
  hasWorkTask: boolean;
  contactId?: UUIDString | null;
  hasContact: boolean;
  since: TimestampString;
  callId?: UUIDString | null;
  hasCall?: boolean;
  meetingId?: UUIDString | null;
  hasMeeting?: boolean;
  conversationId?: UUIDString | null;
  hasConversation?: boolean;
}

export interface AutomationMetricsData {
  workflows: ({
    status: AutomationWorkflowStatus;
    count: number;
  })[];
  executions: ({
    status: AutomationExecutionStatus;
    count: number;
    averageDurationMs?: number | null;
  })[];
  byWorkflow: ({
    workflowId: UUIDString;
    count: number;
  })[];
  pendingApprovals: ({
    count: number;
  })[];
}

export interface AutomationMetricsVariables {
  organizationId: UUIDString;
  since: TimestampString;
}

export interface AutomationNotifyData {
  inAppNotification_insert: InAppNotification_Key;
}

export interface AutomationNotifyVariables {
  organizationId: UUIDString;
  id: UUIDString;
  audience: NotificationAudience;
  recipientMembershipId?: UUIDString | null;
  leadId?: UUIDString | null;
  title: string;
  body: string;
}

export interface AutomationOrgState_Key {
  organizationId: UUIDString;
  __typename?: 'AutomationOrgState_Key';
}

export interface AutomationReassignConversationData {
  conversation?: InboxConversation_Key | null;
  executed?: AutomationApproval_Key | null;
  inboxAssignmentHistory_insert: InboxAssignmentHistory_Key;
  auditLog_insert: AuditLog_Key;
  inAppNotification_insert: InAppNotification_Key;
  automationEvent_insert: AutomationEvent_Key;
}

export interface AutomationReassignConversationVariables {
  organizationId: UUIDString;
  conversationId: UUIDString;
  expectedMembershipId?: UUIDString | null;
  toMembershipId: UUIDString;
  approvalId: UUIDString;
  executionId: UUIDString;
  historyId: UUIDString;
  eventId: UUIDString;
  originalEventId: UUIDString;
  originWorkflowId: UUIDString;
  chainDepth: number;
}

export interface AutomationReassignLeadData {
  lead?: Lead_Key | null;
  executed?: AutomationApproval_Key | null;
  leadAssignmentHistory_insert: LeadAssignmentHistory_Key;
  leadFollowUp_updateMany: number;
  activity_insert: Activity_Key;
  auditLog_insert: AuditLog_Key;
  inAppNotification_insert: InAppNotification_Key;
  automationEvent_insert: AutomationEvent_Key;
}

export interface AutomationReassignLeadVariables {
  organizationId: UUIDString;
  leadId: UUIDString;
  expectedMembershipId?: UUIDString | null;
  toMembershipId: UUIDString;
  approvalId: UUIDString;
  executionId: UUIDString;
  eventId: UUIDString;
  originalEventId: UUIDString;
  originWorkflowId: UUIDString;
  chainDepth: number;
}

export interface AutomationRecipientsData {
  executor?: {
    id: UUIDString;
    role: MembershipRole;
  };
  managers: ({
    id: UUIDString;
    role: MembershipRole;
  })[];
}

export interface AutomationRecipientsVariables {
  organizationId: UUIDString;
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

export interface BeginAutomationJobData {
  started?: AutomationExecution_Key | null;
  execution?: AutomationExecution_Key | null;
}

export interface BeginAutomationJobVariables {
  organizationId: UUIDString;
  jobId: UUIDString;
  jobToken: UUIDString;
  executionId: UUIDString;
  now: TimestampString;
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

export interface CallConsentEvidence_Key {
  organizationId: UUIDString;
  id: UUIDString;
  __typename?: 'CallConsentEvidence_Key';
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

export interface CaptureMetaLeadAdData {
  advanceCursor?: DistributionCursor_Key | null;
  contact: Contact_Key;
  lead: Lead_Key;
  assignment: LeadAssignmentHistory_Key;
  activity: Activity_Key;
  audit: AuditLog_Key;
  assignedNotification: InAppNotification_Key;
  unassignedNotification: InAppNotification_Key;
  leadCreatedEvent: AutomationEvent_Key;
  leadAssignedEvent: AutomationEvent_Key;
  processed?: MetaLeadEvent_Key | null;
  formSeen?: MetaLeadForm_Key | null;
  connectionSeen?: MetaLeadConnection_Key | null;
}

export interface CaptureMetaLeadAdVariables {
  organizationId: UUIDString;
  eventId: UUIDString;
  connectionId: UUIDString;
  formId: UUIDString;
  fullName: string;
  email?: string | null;
  phone?: string | null;
  normalizedEmail?: string | null;
  normalizedPhone?: string | null;
  contactId?: UUIDString | null;
  hasExistingContact: boolean;
  propertyInterest?: string | null;
  preferredLocation?: string | null;
  propertyType?: string | null;
  transactionType?: TransactionType | null;
  budgetMin?: number | null;
  budgetMax?: number | null;
  currency: string;
  bedroomPreference?: string | null;
  metadata: unknown;
  assignedMembershipId?: UUIDString | null;
  distributionRuleId?: UUIDString | null;
  expectedCursorVersion?: number | null;
  hasAutoAssignment: boolean;
  hasDistributionAttempt: boolean;
}

export interface ChangeLeadStatusData {
  lead?: Lead_Key | null;
  activity: Activity_Key;
  auditLog_insert: AuditLog_Key;
  statusEvent: AutomationEvent_Key;
}

export interface ChangeLeadStatusVariables {
  organizationId: UUIDString;
  leadId: UUIDString;
  status: LeadStatus;
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

export interface CheckPublishedSourcesEligibilityData {
  listings: ({
    id: UUIDString;
    listingStatus: ListingStatus;
    publicationStatus: ListingPublicationStatus;
    advertisingPermitNumber?: string | null;
    permitExpiryDate?: DateString | null;
    archivedAt?: TimestampString | null;
    property: {
      archivedAt?: TimestampString | null;
    };
  })[];
  projects: ({
    id: UUIDString;
    projectStatus: ProjectStatus;
    archivedAt?: TimestampString | null;
    permitExpiryDate?: DateString | null;
  })[];
  properties: ({
    id: UUIDString;
    inventoryStatus: InventoryStatus;
    archivedAt?: TimestampString | null;
  })[];
}

export interface CheckPublishedSourcesEligibilityVariables {
  organizationId: UUIDString;
  listingIds: UUIDString[];
  projectIds: UUIDString[];
  propertyIds: UUIDString[];
}

export interface ClaimAutomationJobData {
  job?: ScheduledAutomationJob_Key | null;
}

export interface ClaimAutomationJobVariables {
  organizationId: UUIDString;
  id: UUIDString;
  jobToken: UUIDString;
  now: TimestampString;
  leaseUntil: TimestampString;
}

export interface ClaimAutomationOrganizationData {
  automationOrgState_update?: AutomationOrgState_Key | null;
}

export interface ClaimAutomationOrganizationVariables {
  organizationId: UUIDString;
  claimToken: UUIDString;
  now: TimestampString;
  leaseUntil: TimestampString;
}

export interface CloseAutomationApprovalData {
  approval?: AutomationApproval_Key | null;
  auditLog_insert: AuditLog_Key;
  wake: number;
}

export interface CloseAutomationApprovalVariables {
  organizationId: UUIDString;
  id: UUIDString;
  expectedStatus: AutomationApprovalStatus;
  status: AutomationApprovalStatus;
  resultStatus: string;
  resultErrorCode?: string | null;
  actorUid: string;
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

export interface CommunicationSettings_Key {
  organizationId: UUIDString;
  __typename?: 'CommunicationSettings_Key';
}

export interface CommunicationSimulationRecord_Key {
  organizationId: UUIDString;
  id: UUIDString;
  __typename?: 'CommunicationSimulationRecord_Key';
}

export interface CommunicationSuppression_Key {
  organizationId: UUIDString;
  id: UUIDString;
  __typename?: 'CommunicationSuppression_Key';
}

export interface CompleteLeadFollowUpData {
  lead?: Lead_Key | null;
  followUp?: LeadFollowUp_Key | null;
  activity: Activity_Key;
  auditLog_insert: AuditLog_Key;
  taskEvent: AutomationEvent_Key;
}

export interface CompleteLeadFollowUpVariables {
  organizationId: UUIDString;
  leadId: UUIDString;
  followUpId?: UUIDString | null;
}

export interface CompleteWorkTaskData {
  task?: WorkTask_Key | null;
  auditLog_insert: AuditLog_Key;
  automationEvent_insert: AutomationEvent_Key;
}

export interface CompleteWorkTaskVariables {
  organizationId: UUIDString;
  id: UUIDString;
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

export interface CreateAiBrandProfileData {
  profile: AiBrandProfile_Key;
  auditLog_insert: AuditLog_Key;
}

export interface CreateAiBrandProfileVariables {
  organizationId: UUIDString;
  displayName?: string | null;
  logoReference?: string | null;
  brandTone?: string | null;
  preferredLanguage: AiContentLanguage;
  useCompanyPhone: boolean;
  useCompanyEmail: boolean;
  website?: string | null;
  whatsappNumber?: string | null;
  defaultCallToAction?: string | null;
  tagline?: string | null;
  marketingDisclaimer?: string | null;
  officeAddress?: string | null;
  officeHours?: string | null;
}

export interface CreateAiContentDraftData {
  draft: AiContentDraft_Key;
  version: AiContentVersion_Key;
  auditLog_insert: AuditLog_Key;
}

export interface CreateAiContentDraftVariables {
  organizationId: UUIDString;
  id: UUIDString;
  actorUid: string;
  contentType: AiContentType;
  purpose: string;
  title: string;
  language: AiContentLanguage;
  tone: string;
  audience: string;
  sourceProjectId?: UUIDString | null;
  sourcePropertyId?: UUIDString | null;
  sourceListingId?: UUIDString | null;
  sourceLeadId?: UUIDString | null;
  sourceRefs: string;
  templateId?: UUIDString | null;
  contentData: string;
  validation: string;
  model: string;
  generatedAt: TimestampString;
}

export interface CreateAiContentTemplateData {
  template: AiContentTemplate_Key;
  auditLog_insert: AuditLog_Key;
}

export interface CreateAiContentTemplateVariables {
  organizationId: UUIDString;
  name: string;
  contentType: AiContentType;
  purpose?: string | null;
  instructions: string;
  tone?: string | null;
  language?: AiContentLanguage | null;
  isActive: boolean;
}

export interface CreateAiConversationWithExchangeData {
  conversation: AiConversation_Key;
  messages: AiMessage_Key[];
}

export interface CreateAiConversationWithExchangeVariables {
  organizationId: UUIDString;
  conversationId: UUIDString;
  ownerUid: string;
  title: string;
  userContent: string;
  assistantContent: string;
}

export interface CreateAutomationWorkflowData {
  workflow: AutomationWorkflow_Key;
  version: AutomationWorkflowVersion_Key;
  auditLog_insert: AuditLog_Key;
}

export interface CreateAutomationWorkflowVariables {
  organizationId: UUIDString;
  id: UUIDString;
  versionId: UUIDString;
  name: string;
  description: string;
  triggerType: string;
  definitionJson: string;
  definitionHash: string;
  hasApprovalSteps: boolean;
  timeZone: string;
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

export interface CreateBuildingData {
  building: Building_Key;
  activity_insert: Activity_Key;
  auditLog_insert: AuditLog_Key;
}

export interface CreateBuildingVariables {
  organizationId: UUIDString;
  projectId: UUIDString;
  phaseId?: UUIDString | null;
  name: string;
  reference?: string | null;
  floors?: number | null;
  buildingType: BuildingType;
  status: CompletionStatus;
  handoverDate?: DateString | null;
  latitude?: number | null;
  longitude?: number | null;
}

export interface CreateContactData {
  contact: Contact_Key;
  auditLog_insert: AuditLog_Key;
  contactEvent: AutomationEvent_Key;
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

export interface CreateDefaultWebsiteData {
  website: Website_Key;
}

export interface CreateDefaultWebsiteVariables {
  organizationId: UUIDString;
  id: UUIDString;
  actorUid: string;
  name: string;
  slug: string;
  designSettings: string;
}

export interface CreateDeveloperData {
  developer: Developer_Key;
  activity_insert: Activity_Key;
  auditLog_insert: AuditLog_Key;
}

export interface CreateDeveloperVariables {
  organizationId: UUIDString;
  name: string;
  slug: string;
  logoReference?: string | null;
  description?: string | null;
  website?: string | null;
  email?: string | null;
  phone?: string | null;
  country: string;
  headOfficeAddress?: string | null;
  headOfficeLatitude?: number | null;
  headOfficeLongitude?: number | null;
  headOfficeGooglePlaceId?: string | null;
  status: DeveloperStatus;
}

export interface CreateFloorPlanData {
  floorPlan: FloorPlan_Key;
  activity_insert: Activity_Key;
  auditLog_insert: AuditLog_Key;
}

export interface CreateFloorPlanVariables {
  organizationId: UUIDString;
  projectId: UUIDString;
  propertyId?: UUIDString | null;
  buildingId?: UUIDString | null;
  name: string;
  propertyType: PropertyType;
  bedrooms?: number | null;
  builtUpArea?: number | null;
  plotArea?: number | null;
  areaUnit: AreaUnit;
  mediaReference?: string | null;
}

export interface CreateGeneratedWebsitePageData {
  page: WebsitePage_Key;
  version: PageVersion_Key;
  audit: AuditLog_Key;
}

export interface CreateGeneratedWebsitePageVariables {
  organizationId: UUIDString;
  id: UUIDString;
  actorUid: string;
  websiteId: UUIDString;
  title: string;
  slug: string;
  description?: string | null;
  sourceProjectId?: UUIDString | null;
  sourcePropertyId?: UUIDString | null;
  sourceListingId?: UUIDString | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  designStyle: string;
  structuredPageData: string;
  validation?: string | null;
  model: string;
}

export interface CreateInventoryAmenityData {
  amenity: InventoryAmenity_Key;
  activity_insert: Activity_Key;
  auditLog_insert: AuditLog_Key;
}

export interface CreateInventoryAmenityVariables {
  organizationId: UUIDString;
  name: string;
  category?: string | null;
}

export interface CreateInventoryMediaData {
  inventoryMedia: InventoryMedia_Key;
}

export interface CreateInventoryMediaVariables {
  organizationId: UUIDString;
  propertyId?: UUIDString | null;
  projectId?: UUIDString | null;
  floorPlanId?: UUIDString | null;
  storagePath: string;
  fileName: string;
  contentType: string;
  byteSize: Int64String;
  mediaKind: InventoryMediaKind;
  sortOrder: number;
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
  leadCreatedEvent: AutomationEvent_Key;
  leadAssignedEvent: AutomationEvent_Key;
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
  leadCreatedEvent: AutomationEvent_Key;
  leadAssignedEvent: AutomationEvent_Key;
}

export interface CreateLeadForContactVariables {
  organizationId: UUIDString;
  leadId?: UUIDString | null;
  contactId: UUIDString;
  alternatePhone?: string | null;
  normalizedAlternatePhone?: string | null;
  nationality?: string | null;
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

export interface CreateLeadQualificationDetailsData {
  details: LeadQualificationDetails_Key;
  activity_insert: Activity_Key;
  auditLog_insert: AuditLog_Key;
}

export interface CreateLeadQualificationDetailsVariables {
  organizationId: UUIDString;
  leadId: UUIDString;
  timeline?: LeadTimeline | null;
  readiness?: LeadReadiness | null;
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

export interface CreateMetaLeadConnectionData {
  connection: MetaLeadConnection_Key;
  auditLog_insert: AuditLog_Key;
}

export interface CreateMetaLeadConnectionVariables {
  organizationId: UUIDString;
  id: UUIDString;
  actorUid: string;
  pageId: string;
  pageName: string;
  tokenCiphertext: string;
  tokenKeyId: string;
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

export interface CreatePaymentPlanData {
  paymentPlan: PaymentPlan_Key;
  activity_insert: Activity_Key;
  auditLog_insert: AuditLog_Key;
}

export interface CreatePaymentPlanVariables {
  organizationId: UUIDString;
  projectId: UUIDString;
  propertyId?: UUIDString | null;
  name: string;
  bookingPercentageBps: number;
  handoverPercentageBps: number;
}

export interface CreateProjectData {
  project: Project_Key;
  activity_insert: Activity_Key;
  auditLog_insert: AuditLog_Key;
}

export interface CreateProjectPhaseData {
  phase: ProjectPhase_Key;
  activity_insert: Activity_Key;
  auditLog_insert: AuditLog_Key;
}

export interface CreateProjectPhaseVariables {
  organizationId: UUIDString;
  projectId: UUIDString;
  name: string;
  reference?: string | null;
  description?: string | null;
  status: CompletionStatus;
  expectedHandoverDate?: DateString | null;
  actualHandoverDate?: DateString | null;
}

export interface CreateProjectVariables {
  organizationId: UUIDString;
  developerId: UUIDString;
  projectName: string;
  projectCode: string;
  description?: string | null;
  projectType: ProjectType;
  ownershipType?: OwnershipType | null;
  community?: string | null;
  area?: string | null;
  emirate?: Emirate | null;
  country: string;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  city?: string | null;
  googlePlaceId?: string | null;
  mapDisplayMode?: MapDisplayMode | null;
  launchDate?: DateString | null;
  expectedHandoverDate?: DateString | null;
  actualHandoverDate?: DateString | null;
  constructionStatus: ConstructionStatus;
  projectStatus: ProjectStatus;
  startingPriceMinor?: Int64String | null;
  currency: string;
  totalUnits?: number | null;
  marketingDescription?: string | null;
  brochureReference?: string | null;
  permitNumber?: string | null;
  permitExpiryDate?: DateString | null;
  permitReferenceUrl?: string | null;
}

export interface CreatePropertyData {
  property: Property_Key;
  activity_insert: Activity_Key;
  auditLog_insert: AuditLog_Key;
}

export interface CreatePropertyFeatureData {
  feature: PropertyFeature_Key;
  activity_insert: Activity_Key;
  auditLog_insert: AuditLog_Key;
}

export interface CreatePropertyFeatureVariables {
  organizationId: UUIDString;
  propertyId: UUIDString;
  key: string;
  valueType: FeatureValueType;
  textValue?: string | null;
  numberValue?: number | null;
  booleanValue?: boolean | null;
  unit?: string | null;
}

export interface CreatePropertyListingData {
  propertyListing: PropertyListing_Key;
  activity_insert: Activity_Key;
  auditLog_insert: AuditLog_Key;
  listingEvent: AutomationEvent_Key;
}

export interface CreatePropertyListingVariables {
  organizationId: UUIDString;
  propertyId: UUIDString;
  listingReference: string;
  listingPurpose: ListingPurpose;
  marketType: MarketType;
  title: string;
  description?: string | null;
  askingPriceMinor: Int64String;
  currency: string;
  rentalPeriod?: RentalPeriod | null;
  assignedMembershipId?: UUIDString | null;
  listingStatus: ListingStatus;
  publicationStatus: ListingPublicationStatus;
  advertisingPermitNumber?: string | null;
  permitExpiryDate?: DateString | null;
  permitVerificationUrl?: string | null;
}

export interface CreatePropertyVariables {
  organizationId: UUIDString;
  propertyReference: string;
  projectId?: UUIDString | null;
  buildingId?: UUIDString | null;
  unitNumber?: string | null;
  propertyType: PropertyType;
  marketType: MarketType;
  bedrooms?: number | null;
  bathrooms?: number | null;
  floorNumber?: number | null;
  builtUpArea?: number | null;
  plotArea?: number | null;
  areaUnit: AreaUnit;
  furnishedStatus?: FurnishedStatus | null;
  parkingSpaces?: number | null;
  view?: string | null;
  emirate?: Emirate | null;
  community?: string | null;
  area?: string | null;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  city?: string | null;
  googlePlaceId?: string | null;
  mapDisplayMode?: MapDisplayMode | null;
  referencePriceMinor?: Int64String | null;
  internalNotes?: string | null;
  ownershipReference?: string | null;
  mandateReference?: string | null;
  assignedMembershipId?: UUIDString | null;
  occupancyStatus: OccupancyStatus;
  inventoryStatus: InventoryStatus;
}

export interface CreateWebsiteMediaData {
  media: WebsiteMedia_Key;
}

export interface CreateWebsiteMediaVariables {
  organizationId: UUIDString;
  id: UUIDString;
  websiteId: UUIDString;
  fileName: string;
  contentType: string;
  byteSize: number;
  width?: number | null;
  height?: number | null;
  alt: string;
  storagePath: string;
  actorUid: string;
}

export interface CreateWebsitePageData {
  page: WebsitePage_Key;
  version: PageVersion_Key;
  audit: AuditLog_Key;
}

export interface CreateWebsitePageVariables {
  organizationId: UUIDString;
  id: UUIDString;
  websiteId: UUIDString;
  title: string;
  slug: string;
  description?: string | null;
  sourceProjectId?: UUIDString | null;
  sourcePropertyId?: UUIDString | null;
  sourceListingId?: UUIDString | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  designStyle: string;
  kind: PageVersionKind;
  structuredPageData: string;
  validation?: string | null;
}

export interface CreateWebsiteSectionTemplateData {
  template: WebsiteSectionTemplate_Key;
  auditLog_insert: AuditLog_Key;
}

export interface CreateWebsiteSectionTemplateVariables {
  organizationId: UUIDString;
  id: UUIDString;
  name: string;
  category: string;
  sectionType: string;
  sectionData: string;
}

export interface DecideAutomationApprovalData {
  decision?: AutomationApproval_Key | null;
  wake: number;
  auditLog_insert: AuditLog_Key;
}

export interface DecideAutomationApprovalVariables {
  organizationId: UUIDString;
  id: UUIDString;
  decision: AutomationApprovalStatus;
  reason?: string | null;
  expectedSnapshotHash: string;
  currentTargetStateHash: string;
}

export interface DeleteAiContentDraftData {
  versions: number;
  draft: number;
  auditLog_insert: AuditLog_Key;
}

export interface DeleteAiContentDraftVariables {
  organizationId: UUIDString;
  id: UUIDString;
  createdByUid?: string | null;
}

export interface DeleteAiContentTemplateData {
  template: number;
  auditLog_insert: AuditLog_Key;
}

export interface DeleteAiContentTemplateVariables {
  organizationId: UUIDString;
  id: UUIDString;
}

export interface DeleteMyAiConversationData {
  messages: number;
  conversation: number;
  auditLog_insert: AuditLog_Key;
}

export interface DeleteMyAiConversationVariables {
  organizationId: UUIDString;
  conversationId: UUIDString;
}

export interface DeleteWebsiteSectionTemplateData {
  websiteSectionTemplate_update?: WebsiteSectionTemplate_Key | null;
  auditLog_insert: AuditLog_Key;
}

export interface DeleteWebsiteSectionTemplateVariables {
  organizationId: UUIDString;
  id: UUIDString;
}

export interface DemoFixtureRecord_Key {
  organizationId: UUIDString;
  fixtureKey: string;
  __typename?: 'DemoFixtureRecord_Key';
}

export interface DetachProjectAmenityData {
  projectAmenity_deleteMany: number;
  activity_insert: Activity_Key;
  auditLog_insert: AuditLog_Key;
}

export interface DetachProjectAmenityVariables {
  organizationId: UUIDString;
  projectId: UUIDString;
  amenityId: UUIDString;
}

export interface DetachPropertyAmenityData {
  propertyAmenity_deleteMany: number;
  activity_insert: Activity_Key;
  auditLog_insert: AuditLog_Key;
}

export interface DetachPropertyAmenityVariables {
  organizationId: UUIDString;
  propertyId: UUIDString;
  amenityId: UUIDString;
}

export interface Developer_Key {
  organizationId: UUIDString;
  id: UUIDString;
  __typename?: 'Developer_Key';
}

export interface DisconnectMetaLeadConnectionData {
  metaLeadConnection_delete?: MetaLeadConnection_Key | null;
  auditLog_insert: AuditLog_Key;
}

export interface DisconnectMetaLeadConnectionVariables {
  organizationId: UUIDString;
  id: UUIDString;
  actorUid: string;
}

export interface DismissPendingWebsiteEnquiryData {
  pending?: PendingWebsiteEnquiry_Key | null;
  audit: AuditLog_Key;
}

export interface DismissPendingWebsiteEnquiryVariables {
  organizationId: UUIDString;
  id: UUIDString;
}

export interface DistributionCursor_Key {
  organizationId: UUIDString;
  ruleId: UUIDString;
  __typename?: 'DistributionCursor_Key';
}

export interface EnsureAutomationOrgStateData {
  automationOrgState_insert: AutomationOrgState_Key;
}

export interface EnsureAutomationOrgStateVariables {
  organizationId: UUIDString;
}

export interface FeedGenerationJob_Key {
  organizationId: UUIDString;
  id: UUIDString;
  __typename?: 'FeedGenerationJob_Key';
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

export interface FindMetaLeadFormData {
  form?: {
    id: UUIDString;
    connectionId: UUIDString;
    name: string;
    enabled: boolean;
    sourceId: UUIDString;
    branchId?: UUIDString | null;
    questions?: unknown | null;
    fieldMapping?: unknown | null;
  };
  source?: {
    id: UUIDString;
  };
}

export interface FindMetaLeadFormVariables {
  organizationId: UUIDString;
  metaFormId: string;
}

export interface FindPendingWebsiteEnquiryData {
  pending?: {
    id: UUIDString;
    status: PendingEnquiryStatus;
    leadId?: UUIDString | null;
  };
}

export interface FindPendingWebsiteEnquiryVariables {
  organizationId: UUIDString;
  formId: UUIDString;
  idempotencyKeyHash: string;
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

export interface FindWebsitePageBySlugData {
  page?: {
    id: UUIDString;
  };
}

export interface FindWebsitePageBySlugVariables {
  organizationId: UUIDString;
  slug: string;
}

export interface FinishAutomationEventData {
  automationEvent_update?: AutomationEvent_Key | null;
}

export interface FinishAutomationEventVariables {
  organizationId: UUIDString;
  claimToken: UUIDString;
  id: UUIDString;
  status: AutomationEventStatus;
  matchedCount: number;
  errorCode?: string | null;
}

export interface FinishAutomationStepData {
  step?: AutomationExecutionStep_Key | null;
  execution?: AutomationExecution_Key | null;
  job?: ScheduledAutomationJob_Key | null;
}

export interface FinishAutomationStepVariables {
  organizationId: UUIDString;
  jobId: UUIDString;
  jobToken: UUIDString;
  executionId: UUIDString;
  stepId: UUIDString;
  stepStatus: AutomationStepStatus;
  resultType?: string | null;
  resultId?: UUIDString | null;
  resultSummary?: string | null;
  errorCode?: string | null;
  nextStep: number;
  executionStatus: AutomationExecutionStatus;
  executionErrorCode?: string | null;
  jobStatus: AutomationJobStatus;
  runAt: TimestampString;
  actionIncrement: number;
  aiIncrement: number;
  completedAt?: TimestampString | null;
  durationMs?: number | null;
  releaseJob: boolean;
}

export interface FloorPlan_Key {
  organizationId: UUIDString;
  id: UUIDString;
  __typename?: 'FloorPlan_Key';
}

export interface GetAiBrandProfileData {
  organization?: {
    name: string;
    contactPhone?: string | null;
    companyEmail?: string | null;
  };
  profile?: {
    displayName?: string | null;
    logoReference?: string | null;
    brandTone?: string | null;
    preferredLanguage: AiContentLanguage;
    useCompanyPhone: boolean;
    useCompanyEmail: boolean;
    website?: string | null;
    whatsappNumber?: string | null;
    defaultCallToAction?: string | null;
    tagline?: string | null;
    marketingDisclaimer?: string | null;
    officeAddress?: string | null;
    officeHours?: string | null;
    revision: number;
    updatedAt: TimestampString;
    updatedBy: {
      displayName: string;
    };
  };
}

export interface GetAiBrandProfileVariables {
  organizationId: UUIDString;
}

export interface GetAiContentDraftData {
  draft?: {
    id: UUIDString;
    title: string;
    contentType: AiContentType;
    purpose: string;
    language: AiContentLanguage;
    tone: string;
    audience: string;
    status: AiContentDraftStatus;
    sourceProjectId?: UUIDString | null;
    sourcePropertyId?: UUIDString | null;
    sourceListingId?: UUIDString | null;
    sourceLeadId?: UUIDString | null;
    sourceRefs: string;
    templateId?: UUIDString | null;
    contentData: string;
    validation: string;
    model?: string | null;
    generatedAt: TimestampString;
    revision: number;
    versionCount: number;
    createdAt: TimestampString;
    updatedAt: TimestampString;
    createdByUid: string;
    createdBy: {
      displayName: string;
    };
    updatedBy: {
      displayName: string;
    };
  };
  versions: ({
    id: UUIDString;
    versionNumber: number;
    kind: AiContentVersionKind;
    title: string;
    model?: string | null;
    generatedAt?: TimestampString | null;
    createdAt: TimestampString;
    createdBy: {
      displayName: string;
    };
  })[];
}

export interface GetAiContentDraftVariables {
  organizationId: UUIDString;
  id: UUIDString;
  createdByUid?: string | null;
}

export interface GetAiContentTemplateData {
  template?: {
    id: UUIDString;
    name: string;
    contentType: AiContentType;
    purpose?: string | null;
    instructions: string;
    tone?: string | null;
    language?: AiContentLanguage | null;
    isActive: boolean;
    revision: number;
  };
}

export interface GetAiContentTemplateVariables {
  organizationId: UUIDString;
  id: UUIDString;
}

export interface GetAiContentVersionData {
  version?: {
    id: UUIDString;
    versionNumber: number;
    kind: AiContentVersionKind;
    title: string;
    contentData: string;
    validation: string;
    model?: string | null;
    generatedAt?: TimestampString | null;
    createdAt: TimestampString;
  };
}

export interface GetAiContentVersionVariables {
  organizationId: UUIDString;
  draftId: UUIDString;
  versionNumber: number;
  createdByUid?: string | null;
}

export interface GetAiSalesInsightData {
  insight?: {
    id: UUIDString;
    kind: AiSalesInsightKind;
    leadId?: UUIDString | null;
    propertyId?: UUIDString | null;
    viewingId?: UUIDString | null;
    assessmentId?: UUIDString | null;
    content: string;
    model: string;
    promptVersion: string;
    createdAt: TimestampString;
    createdBy: {
      displayName: string;
    };
  };
}

export interface GetAiSalesInsightVariables {
  organizationId: UUIDString;
  id: UUIDString;
}

export interface GetAiUsageCountersData {
  organization?: {
    requestCount: number;
  };
  user?: {
    requestCount: number;
  };
}

export interface GetAiUsageCountersVariables {
  organizationId: UUIDString;
  periodKey: string;
  userKey: string;
}

export interface GetAssignedPropertyData {
  property?: {
    id: UUIDString;
    organizationId: UUIDString;
    propertyReference: string;
    projectId?: UUIDString | null;
    project?: {
      id: UUIDString;
      projectName: string;
      projectCode: string;
      developer: {
        id: UUIDString;
        name: string;
      };
    };
    buildingId?: UUIDString | null;
    building?: {
      id: UUIDString;
      name: string;
      reference?: string | null;
    };
    unitNumber?: string | null;
    propertyType: PropertyType;
    marketType: MarketType;
    bedrooms?: number | null;
    bathrooms?: number | null;
    floorNumber?: number | null;
    builtUpArea?: number | null;
    plotArea?: number | null;
    areaUnit: AreaUnit;
    furnishedStatus?: FurnishedStatus | null;
    parkingSpaces?: number | null;
    view?: string | null;
    emirate?: Emirate | null;
    city?: string | null;
    community?: string | null;
    area?: string | null;
    address?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    googlePlaceId?: string | null;
    mapDisplayMode: MapDisplayMode;
    referencePriceMinor?: Int64String | null;
    internalNotes?: string | null;
    ownershipReference?: string | null;
    mandateReference?: string | null;
    assignedMembershipId?: UUIDString | null;
    assignedMembership?: {
      email: string;
      userProfile?: {
        displayName: string;
      };
    };
    occupancyStatus: OccupancyStatus;
    inventoryStatus: InventoryStatus;
    createdAt: TimestampString;
    updatedAt: TimestampString;
    propertyAmenities_on_property: ({
      id: UUIDString;
      amenityId: UUIDString;
      amenity: {
        name: string;
        category?: string | null;
      };
    })[];
    propertyFeatures_on_property: ({
      id: UUIDString;
      key: string;
      valueType: FeatureValueType;
      textValue?: string | null;
      numberValue?: number | null;
      booleanValue?: boolean | null;
      unit?: string | null;
    })[];
    inventoryMedias_on_property: ({
      id: UUIDString;
      fileName: string;
      contentType: string;
      byteSize: Int64String;
      mediaKind: InventoryMediaKind;
      sortOrder: number;
      isCover: boolean;
      createdAt: TimestampString;
    })[];
  } & Property_Key;
}

export interface GetAssignedPropertyInventoryMediaData {
  inventoryMedias: ({
    id: UUIDString;
    organizationId: UUIDString;
    propertyId?: UUIDString | null;
    projectId?: UUIDString | null;
    floorPlanId?: UUIDString | null;
    storagePath: string;
    fileName: string;
    contentType: string;
    byteSize: Int64String;
    mediaKind: InventoryMediaKind;
    sortOrder: number;
    isCover: boolean;
    status: InventoryMediaStatus;
  } & InventoryMedia_Key)[];
}

export interface GetAssignedPropertyInventoryMediaVariables {
  organizationId: UUIDString;
  id: UUIDString;
  assignedMembershipId: UUIDString;
}

export interface GetAssignedPropertyListingData {
  propertyListing?: {
    id: UUIDString;
    organizationId: UUIDString;
    propertyId: UUIDString;
    property: {
      id: UUIDString;
      propertyReference: string;
      propertyType: PropertyType;
      bedrooms?: number | null;
      bathrooms?: number | null;
      builtUpArea?: number | null;
      plotArea?: number | null;
      areaUnit: AreaUnit;
      emirate?: Emirate | null;
      city?: string | null;
      community?: string | null;
      area?: string | null;
      latitude?: number | null;
      longitude?: number | null;
      googlePlaceId?: string | null;
      mapDisplayMode: MapDisplayMode;
      inventoryStatus: InventoryStatus;
      assignedMembershipId?: UUIDString | null;
      project?: {
        id: UUIDString;
        projectName: string;
      };
      building?: {
        id: UUIDString;
        name: string;
      };
      inventoryMedias_on_property: ({
        id: UUIDString;
        fileName: string;
        contentType: string;
        mediaKind: InventoryMediaKind;
        sortOrder: number;
        isCover: boolean;
      })[];
    };
    listingReference: string;
    listingPurpose: ListingPurpose;
    marketType: MarketType;
    title: string;
    description?: string | null;
    askingPriceMinor: Int64String;
    currency: string;
    rentalPeriod?: RentalPeriod | null;
    assignedMembershipId?: UUIDString | null;
    assignedMembership?: {
      email: string;
      userProfile?: {
        displayName: string;
      };
    };
    listingStatus: ListingStatus;
    publicationStatus: ListingPublicationStatus;
    advertisingPermitNumber?: string | null;
    permitExpiryDate?: DateString | null;
    permitVerificationUrl?: string | null;
    createdAt: TimestampString;
    updatedAt: TimestampString;
  } & PropertyListing_Key;
}

export interface GetAssignedPropertyListingVariables {
  organizationId: UUIDString;
  id: UUIDString;
  assignedMembershipId: UUIDString;
}

export interface GetAssignedPropertyVariables {
  organizationId: UUIDString;
  id: UUIDString;
  assignedMembershipId: UUIDString;
}

export interface GetAutomationApprovalTargetData {
  approval?: {
    id: UUIDString;
    status: AutomationApprovalStatus;
    actionType: string;
    targetId?: UUIDString | null;
    leadId?: UUIDString | null;
    requestedByUid: string;
    targetStateHash: string;
    lead?: {
      assignedMembershipId?: UUIDString | null;
      status: LeadStatus;
      archivedAt?: TimestampString | null;
    };
  };
}

export interface GetAutomationApprovalTargetVariables {
  organizationId: UUIDString;
  id: UUIDString;
}

export interface GetAutomationExecutionData {
  execution?: {
    id: UUIDString;
    workflowId: UUIDString;
    workflow: {
      name: string;
      status: AutomationWorkflowStatus;
    };
    workflowVersion: {
      versionNumber: number;
    };
    triggerType: string;
    targetType: string;
    targetId?: UUIDString | null;
    leadId?: UUIDString | null;
    lead?: {
      fullName: string;
    };
    status: AutomationExecutionStatus;
    nextStep: number;
    attemptCount: number;
    actionCount: number;
    aiCalls: number;
    durationMs?: number | null;
    errorCode?: string | null;
    chainDepth: number;
    executorUid: string;
    executor: {
      displayName: string;
    };
    startedAt?: TimestampString | null;
    completedAt?: TimestampString | null;
    createdAt: TimestampString;
    triggeringEvent: {
      id: UUIDString;
      triggerType: string;
      origin: string;
      chainDepth: number;
      originalEventId?: UUIDString | null;
      parentExecutionId?: UUIDString | null;
      createdAt: TimestampString;
    };
  };
  steps: ({
    id: UUIDString;
    position: number;
    actionId: string;
    actionType: string;
    status: AutomationStepStatus;
    attemptCount: number;
    resultType?: string | null;
    resultId?: UUIDString | null;
    resultSummary?: string | null;
    errorCode?: string | null;
    startedAt?: TimestampString | null;
    completedAt?: TimestampString | null;
  })[];
  job: ({
    status: AutomationJobStatus;
    runAt: TimestampString;
    attemptCount: number;
    errorCode?: string | null;
  })[];
}

export interface GetAutomationExecutionRunData {
  execution?: {
    id: UUIDString;
    workflowId: UUIDString;
    triggerType: string;
    targetType: string;
    targetId?: UUIDString | null;
    leadId?: UUIDString | null;
    chainDepth: number;
    executorUid: string;
    status: AutomationExecutionStatus;
    nextStep: number;
    actionCount: number;
    aiCalls: number;
    startedAt?: TimestampString | null;
    createdAt: TimestampString;
    workflow: {
      status: AutomationWorkflowStatus;
      name: string;
      executorUid?: string | null;
      approvedVersionId?: UUIDString | null;
    };
    workflowVersion: {
      id: UUIDString;
      versionNumber: number;
      definitionJson: string;
    };
    triggeringEvent: {
      id: UUIDString;
      triggerType: string;
      targetType: string;
      targetId?: UUIDString | null;
      origin: string;
      originalEventId?: UUIDString | null;
      parentExecutionId?: UUIDString | null;
      originWorkflowId?: UUIDString | null;
      chainDepth: number;
      payload?: unknown | null;
      createdAt: TimestampString;
      actorUid?: string | null;
    };
  };
  steps: ({
    id: UUIDString;
    position: number;
    actionType: string;
    status: AutomationStepStatus;
    attemptCount: number;
    resultType?: string | null;
    resultId?: UUIDString | null;
  })[];
}

export interface GetAutomationExecutionRunVariables {
  organizationId: UUIDString;
  id: UUIDString;
}

export interface GetAutomationExecutionVariables {
  organizationId: UUIDString;
  id: UUIDString;
}

export interface GetAutomationStepApprovalsData {
  approvals: ({
    id: UUIDString;
    status: AutomationApprovalStatus;
    expiresAt: TimestampString;
    approverUid?: string | null;
    approver?: {
      displayName: string;
    };
    decidedAt?: TimestampString | null;
    decisionReason?: string | null;
    snapshotHash: string;
    targetStateHash: string;
    leadId?: UUIDString | null;
    fromMembershipId?: UUIDString | null;
    toMembershipId?: UUIDString | null;
    requestedByUid: string;
    resultStatus?: string | null;
    resultErrorCode?: string | null;
  })[];
}

export interface GetAutomationStepApprovalsVariables {
  organizationId: UUIDString;
  stepId: UUIDString;
}

export interface GetAutomationVersionsData {
  versions: ({
    id: UUIDString;
    workflowId: UUIDString;
    versionNumber: number;
    definitionJson: string;
    definitionHash: string;
  })[];
}

export interface GetAutomationVersionsVariables {
  organizationId: UUIDString;
  ids: UUIDString[];
}

export interface GetAutomationWorkData {
  state?: {
    claimToken?: UUIDString | null;
    periodKey: string;
    executionCount: number;
    aiCallCount: number;
    lastScanAt?: TimestampString | null;
  };
  events: ({
    id: UUIDString;
    triggerType: string;
    targetType: string;
    targetId?: UUIDString | null;
    actorUid?: string | null;
    origin: string;
    originalEventId?: UUIDString | null;
    parentExecutionId?: UUIDString | null;
    originWorkflowId?: UUIDString | null;
    forWorkflowId?: UUIDString | null;
    chainDepth: number;
    payload?: unknown | null;
    createdAt: TimestampString;
  })[];
  workflows: ({
    id: UUIDString;
    name: string;
    triggerType: string;
    approvedVersionId?: UUIDString | null;
    approvedVersionNumber?: number | null;
    executorUid?: string | null;
    timeZone: string;
    nextRunAt?: TimestampString | null;
    activatedAt?: TimestampString | null;
  })[];
  jobs: ({
    id: UUIDString;
    executionId: UUIDString;
    status: AutomationJobStatus;
    attemptCount: number;
    runAt: TimestampString;
  })[];
}

export interface GetAutomationWorkVariables {
  organizationId: UUIDString;
  now: TimestampString;
}

export interface GetAutomationWorkflowData {
  workflow?: {
    id: UUIDString;
    name: string;
    description: string;
    triggerType: string;
    definitionJson: string;
    definitionVersion: number;
    status: AutomationWorkflowStatus;
    revision: number;
    currentVersionNumber: number;
    approvedVersionNumber?: number | null;
    approvedVersionId?: UUIDString | null;
    hasApprovalSteps: boolean;
    timeZone: string;
    nextRunAt?: TimestampString | null;
    createdByUid: string;
    createdBy: {
      displayName: string;
    };
    updatedByUid: string;
    approvedByUid?: string | null;
    approvedBy?: {
      displayName: string;
    };
    approvedAt?: TimestampString | null;
    executorUid?: string | null;
    executor?: {
      displayName: string;
    };
    activatedAt?: TimestampString | null;
    createdAt: TimestampString;
    updatedAt: TimestampString;
  };
  versions: ({
    id: UUIDString;
    versionNumber: number;
    definitionHash: string;
    authorUid: string;
    author: {
      displayName: string;
    };
    createdAt: TimestampString;
  })[];
}

export interface GetAutomationWorkflowVariables {
  organizationId: UUIDString;
  id: UUIDString;
  createdByUid?: string | null;
}

export interface GetBuildingData {
  building?: {
    id: UUIDString;
    organizationId: UUIDString;
    projectId: UUIDString;
    project: {
      id: UUIDString;
      projectName: string;
      projectCode: string;
      mapDisplayMode: MapDisplayMode;
    };
    phaseId?: UUIDString | null;
    phase?: {
      id: UUIDString;
      name: string;
    };
    name: string;
    reference?: string | null;
    floors?: number | null;
    buildingType: BuildingType;
    status: CompletionStatus;
    handoverDate?: DateString | null;
    latitude?: number | null;
    longitude?: number | null;
    createdAt: TimestampString;
    updatedAt: TimestampString;
  } & Building_Key;
}

export interface GetBuildingVariables {
  organizationId: UUIDString;
  id: UUIDString;
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

export interface GetDeveloperData {
  developer?: {
    id: UUIDString;
    organizationId: UUIDString;
    name: string;
    slug: string;
    logoReference?: string | null;
    description?: string | null;
    website?: string | null;
    email?: string | null;
    phone?: string | null;
    country: string;
    headOfficeAddress?: string | null;
    headOfficeLatitude?: number | null;
    headOfficeLongitude?: number | null;
    headOfficeGooglePlaceId?: string | null;
    status: DeveloperStatus;
    createdAt: TimestampString;
    updatedAt: TimestampString;
  } & Developer_Key;
}

export interface GetDeveloperVariables {
  organizationId: UUIDString;
  id: UUIDString;
}

export interface GetFloorPlanData {
  floorPlan?: {
    id: UUIDString;
    organizationId: UUIDString;
    projectId: UUIDString;
    project: {
      projectName: string;
    };
    propertyId?: UUIDString | null;
    property?: {
      id: UUIDString;
      propertyReference: string;
    };
    buildingId?: UUIDString | null;
    building?: {
      name: string;
    };
    name: string;
    propertyType: PropertyType;
    bedrooms?: number | null;
    builtUpArea?: number | null;
    plotArea?: number | null;
    areaUnit: AreaUnit;
    mediaReference?: string | null;
    createdAt: TimestampString;
    updatedAt: TimestampString;
    inventoryMedias_on_floorPlan: ({
      id: UUIDString;
      fileName: string;
      contentType: string;
      byteSize: Int64String;
      mediaKind: InventoryMediaKind;
      sortOrder: number;
      isCover: boolean;
    })[];
  } & FloorPlan_Key;
}

export interface GetFloorPlanVariables {
  organizationId: UUIDString;
  id: UUIDString;
}

export interface GetInventoryAmenityData {
  inventoryAmenity?: {
    id: UUIDString;
    organizationId: UUIDString;
    name: string;
    category?: string | null;
    isActive: boolean;
    createdAt: TimestampString;
    updatedAt: TimestampString;
  } & InventoryAmenity_Key;
}

export interface GetInventoryAmenityVariables {
  organizationId: UUIDString;
  id: UUIDString;
}

export interface GetInventoryDashboardMetricsData {
  totalProperties: ({
    count: number;
  })[];
  availableProperties: ({
    count: number;
  })[];
  reservedProperties: ({
    count: number;
  })[];
  activeListings: ({
    count: number;
  })[];
  totalListings: ({
    count: number;
  })[];
  propertiesByProject: ({
    projectId?: UUIDString | null;
    project?: {
      projectName: string;
    };
    count: number;
  })[];
  listingsByAgent: ({
    assignedMembershipId?: UUIDString | null;
    assignedMembership?: {
      email: string;
      userProfile?: {
        displayName: string;
      };
    };
    count: number;
  })[];
}

export interface GetInventoryDashboardMetricsVariables {
  organizationId: UUIDString;
}

export interface GetInventoryMediaData {
  inventoryMedias: ({
    id: UUIDString;
    organizationId: UUIDString;
    propertyId?: UUIDString | null;
    projectId?: UUIDString | null;
    floorPlanId?: UUIDString | null;
    storagePath: string;
    fileName: string;
    contentType: string;
    byteSize: Int64String;
    mediaKind: InventoryMediaKind;
    sortOrder: number;
    isCover: boolean;
    status: InventoryMediaStatus;
  } & InventoryMedia_Key)[];
}

export interface GetInventoryMediaForDeletionData {
  inventoryMedias: ({
    id: UUIDString;
    organizationId: UUIDString;
    propertyId?: UUIDString | null;
    projectId?: UUIDString | null;
    floorPlanId?: UUIDString | null;
    storagePath: string;
    fileName: string;
    contentType: string;
    byteSize: Int64String;
    mediaKind: InventoryMediaKind;
    sortOrder: number;
    isCover: boolean;
    status: InventoryMediaStatus;
  } & InventoryMedia_Key)[];
}

export interface GetInventoryMediaForDeletionVariables {
  organizationId: UUIDString;
  id: UUIDString;
}

export interface GetInventoryMediaVariables {
  organizationId: UUIDString;
  id: UUIDString;
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

export interface GetLeadPropertyContextData {
  lead?: {
    id: UUIDString;
    projectId?: UUIDString | null;
    propertyId?: UUIDString | null;
    assignedMembershipId?: UUIDString | null;
    updatedAt: TimestampString;
  };
  primaryProject?: {
    id: UUIDString;
    projectName: string;
  };
  primaryProperty?: {
    id: UUIDString;
    propertyReference: string;
    projectId?: UUIDString | null;
    project?: {
      id: UUIDString;
      projectName: string;
    };
    propertyType: PropertyType;
    bedrooms?: number | null;
    emirate?: Emirate | null;
    community?: string | null;
    area?: string | null;
    inventoryStatus: InventoryStatus;
    archivedAt?: TimestampString | null;
  };
  shortlist: ({
    id: UUIDString;
    propertyId: UUIDString;
    status: LeadPropertyInterestStatus;
    notes?: string | null;
    createdAt: TimestampString;
    updatedAt: TimestampString;
    property: {
      id: UUIDString;
      propertyReference: string;
      projectId?: UUIDString | null;
      project?: {
        id: UUIDString;
        projectName: string;
      };
      propertyType: PropertyType;
      bedrooms?: number | null;
      emirate?: Emirate | null;
      community?: string | null;
      area?: string | null;
      inventoryStatus: InventoryStatus;
      archivedAt?: TimestampString | null;
      assignedMembershipId?: UUIDString | null;
    };
  })[];
  shortlistTotal: ({
    _count: number;
  })[];
  viewings: ({
    id: UUIDString;
    propertyId: UUIDString;
    scheduledAt: TimestampString;
    status: LeadPropertyViewingStatus;
    viewingNotes?: string | null;
    customerConfirmation: LeadPropertyViewingConfirmation;
    outcome?: LeadPropertyViewingOutcome | null;
    createdAt: TimestampString;
    updatedAt: TimestampString;
    property: {
      id: UUIDString;
      propertyReference: string;
      projectId?: UUIDString | null;
      project?: {
        id: UUIDString;
        projectName: string;
      };
      propertyType: PropertyType;
      bedrooms?: number | null;
      emirate?: Emirate | null;
      community?: string | null;
      area?: string | null;
      inventoryStatus: InventoryStatus;
      archivedAt?: TimestampString | null;
    };
    assignedMembershipId?: UUIDString | null;
    assignedMembership?: {
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
  })[];
  viewingTotal: ({
    _count: number;
  })[];
  viewingAssignees: ({
    id: UUIDString;
    role: MembershipRole;
    email: string;
    userProfile?: {
      displayName: string;
    };
  })[];
}

export interface GetLeadPropertyContextVariables {
  organizationId: UUIDString;
  leadId: UUIDString;
}

export interface GetLeadSalesIntelligenceData {
  details?: {
    id: UUIDString;
    timeline?: LeadTimeline | null;
    readiness?: LeadReadiness | null;
    revision: number;
    createdAt: TimestampString;
    updatedAt: TimestampString;
    updatedBy: {
      displayName: string;
    };
  };
  assessments: ({
    id: UUIDString;
    ruleVersion: string;
    configHash: string;
    score?: number | null;
    priority: AiLeadPriority;
    sufficientData: boolean;
    result: string;
    evaluatedAt: TimestampString;
    evaluatedBy: {
      displayName: string;
    };
  })[];
  reviews: ({
    id: UUIDString;
    assessmentId: UUIDString;
    suggestedPriority: AiLeadPriority;
    reviewedPriority: AiLeadPriority;
    reason: string;
    createdAt: TimestampString;
    createdBy: {
      displayName: string;
    };
  })[];
  insights: ({
    id: UUIDString;
    kind: AiSalesInsightKind;
    propertyId?: UUIDString | null;
    viewingId?: UUIDString | null;
    assessmentId?: UUIDString | null;
    model: string;
    promptVersion: string;
    createdAt: TimestampString;
    createdBy: {
      displayName: string;
    };
  })[];
}

export interface GetLeadSalesIntelligenceVariables {
  organizationId: UUIDString;
  leadId: UUIDString;
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

export interface GetMyAiConversationData {
  conversation?: {
    id: UUIDString;
    title: string;
    messageCount: number;
    createdAt: TimestampString;
    updatedAt: TimestampString;
    lastMessageAt: TimestampString;
  };
  messages: ({
    id: UUIDString;
    sequence: number;
    role: AiMessageRole;
    content: string;
    createdAt: TimestampString;
  })[];
}

export interface GetMyAiConversationVariables {
  organizationId: UUIDString;
  conversationId: UUIDString;
  limit?: number;
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

export interface GetPageVersionData {
  version?: {
    id: UUIDString;
    versionNumber: number;
    schemaVersion: number;
    kind: PageVersionKind;
    structuredPageData: string;
    validation?: string | null;
    model?: string | null;
    approvedAt?: TimestampString | null;
    createdAt: TimestampString;
  };
}

export interface GetPageVersionVariables {
  organizationId: UUIDString;
  pageId: UUIDString;
  versionNumber: number;
  createdByUid?: string | null;
}

export interface GetPaymentPlanData {
  paymentPlan?: {
    id: UUIDString;
    organizationId: UUIDString;
    projectId: UUIDString;
    project: {
      projectName: string;
    };
    propertyId?: UUIDString | null;
    property?: {
      id: UUIDString;
      propertyReference: string;
      propertyType: PropertyType;
    };
    name: string;
    bookingPercentageBps: number;
    handoverPercentageBps: number;
    installmentTotalBps: number;
    isActive: boolean;
    paymentPlanInstallments_on_paymentPlan: ({
      id: UUIDString;
      position: number;
      percentageBps: number;
      dueTrigger: PaymentDueTrigger;
      constructionMilestonePercent?: number | null;
      postHandoverMonths?: number | null;
      description?: string | null;
    })[];
    createdAt: TimestampString;
    updatedAt: TimestampString;
  } & PaymentPlan_Key;
}

export interface GetPaymentPlanVariables {
  organizationId: UUIDString;
  id: UUIDString;
}

export interface GetPortalExportListingData {
  listing?: {
    id: UUIDString;
    listingReference: string;
    listingPurpose: ListingPurpose;
    marketType: MarketType;
    title: string;
    description?: string | null;
    askingPriceMinor: Int64String;
    currency: string;
    rentalPeriod?: RentalPeriod | null;
    listingStatus: ListingStatus;
    publicationStatus: ListingPublicationStatus;
    advertisingPermitNumber?: string | null;
    permitExpiryDate?: DateString | null;
    permitVerificationUrl?: string | null;
    updatedAt: TimestampString;
    assignedMembershipId?: UUIDString | null;
    assignedMembership?: {
      id: UUIDString;
      role: MembershipRole;
      status: MembershipStatus;
      userProfile?: {
        displayName: string;
      };
    };
    property: {
      id: UUIDString;
      propertyReference: string;
      propertyType: PropertyType;
      marketType: MarketType;
      bedrooms?: number | null;
      bathrooms?: number | null;
      builtUpArea?: number | null;
      plotArea?: number | null;
      areaUnit: AreaUnit;
      furnishedStatus?: FurnishedStatus | null;
      parkingSpaces?: number | null;
      view?: string | null;
      emirate?: Emirate | null;
      community?: string | null;
      area?: string | null;
      floorNumber?: number | null;
      occupancyStatus: OccupancyStatus;
      inventoryStatus: InventoryStatus;
      archivedAt?: TimestampString | null;
      project?: {
        projectName: string;
      };
      building?: {
        name: string;
      };
      inventoryMedias_on_property: ({
        id: UUIDString;
        mediaKind: InventoryMediaKind;
        fileName: string;
        contentType: string;
        isCover: boolean;
        sortOrder: number;
      })[];
    };
    listingPublications_on_listing: ({
      id: UUIDString;
      provider: PortalProvider;
      status: ListingPublicationState;
      errorCount: number;
      warningCount: number;
      payloadHash?: string | null;
      lastValidatedAt?: TimestampString | null;
      updatedAt: TimestampString;
      publicationAttempts_on_publication: ({
        id: UUIDString;
        action: PublicationAction;
        outcome: PublicationOutcome;
        errorCount: number;
        warningCount: number;
        errorSummary?: string | null;
        createdAt: TimestampString;
      })[];
    })[];
  };
  mappings: ({
    provider: PortalProvider;
    fieldKey: string;
    sourceValue: string;
    targetValue: string;
  })[];
}

export interface GetPortalExportListingVariables {
  organizationId: UUIDString;
  listingId: UUIDString;
}

export interface GetPortalSettingsData {
  connections: ({
    id: UUIDString;
    provider: PortalProvider;
    status: PortalConnectionStatus;
    accountReference?: string | null;
    notes?: string | null;
    lastVerifiedAt?: TimestampString | null;
    lastErrorCode?: string | null;
    updatedAt: TimestampString;
  })[];
  mappings: ({
    id: UUIDString;
    provider: PortalProvider;
    fieldKey: string;
    sourceValue: string;
    targetValue: string;
    updatedAt: TimestampString;
  })[];
  publicationCounts: ({
    provider: PortalProvider;
    status: ListingPublicationState;
    count: number;
  })[];
  recentJobs: ({
    id: UUIDString;
    provider: PortalProvider;
    format: FeedFormat;
    status: FeedGenerationStatus;
    dryRun: boolean;
    listingCount: number;
    validCount: number;
    invalidCount: number;
    byteSize: number;
    errorSummary?: string | null;
    startedAt: TimestampString;
    finishedAt?: TimestampString | null;
  })[];
}

export interface GetPortalSettingsVariables {
  organizationId: UUIDString;
}

export interface GetProjectData {
  project?: {
    id: UUIDString;
    organizationId: UUIDString;
    developerId: UUIDString;
    developer: {
      id: UUIDString;
      name: string;
      slug: string;
    };
    projectName: string;
    projectCode: string;
    description?: string | null;
    projectType: ProjectType;
    ownershipType?: OwnershipType | null;
    community?: string | null;
    area?: string | null;
    emirate?: Emirate | null;
    country: string;
    address?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    city?: string | null;
    googlePlaceId?: string | null;
    mapDisplayMode: MapDisplayMode;
    launchDate?: DateString | null;
    expectedHandoverDate?: DateString | null;
    actualHandoverDate?: DateString | null;
    constructionStatus: ConstructionStatus;
    projectStatus: ProjectStatus;
    startingPriceMinor?: Int64String | null;
    currency: string;
    totalUnits?: number | null;
    marketingDescription?: string | null;
    brochureReference?: string | null;
    permitNumber?: string | null;
    permitExpiryDate?: DateString | null;
    permitReferenceUrl?: string | null;
    createdAt: TimestampString;
    updatedAt: TimestampString;
    projectPhases_on_project: ({
      id: UUIDString;
      name: string;
      reference?: string | null;
      status: CompletionStatus;
      expectedHandoverDate?: DateString | null;
      actualHandoverDate?: DateString | null;
    })[];
    buildings_on_project: ({
      id: UUIDString;
      phaseId?: UUIDString | null;
      name: string;
      reference?: string | null;
      floors?: number | null;
      buildingType: BuildingType;
      status: CompletionStatus;
      handoverDate?: DateString | null;
      latitude?: number | null;
      longitude?: number | null;
    })[];
    projectAmenities_on_project: ({
      id: UUIDString;
      amenityId: UUIDString;
      amenity: {
        name: string;
        category?: string | null;
      };
    })[];
  } & Project_Key;
}

export interface GetProjectPhaseData {
  projectPhase?: {
    id: UUIDString;
    organizationId: UUIDString;
    projectId: UUIDString;
    name: string;
    reference?: string | null;
    description?: string | null;
    status: CompletionStatus;
    expectedHandoverDate?: DateString | null;
    actualHandoverDate?: DateString | null;
    createdAt: TimestampString;
    updatedAt: TimestampString;
  } & ProjectPhase_Key;
}

export interface GetProjectPhaseVariables {
  organizationId: UUIDString;
  projectId: UUIDString;
  id: UUIDString;
}

export interface GetProjectVariables {
  organizationId: UUIDString;
  id: UUIDString;
}

export interface GetPropertyData {
  property?: {
    id: UUIDString;
    organizationId: UUIDString;
    propertyReference: string;
    projectId?: UUIDString | null;
    project?: {
      id: UUIDString;
      projectName: string;
      projectCode: string;
      developer: {
        id: UUIDString;
        name: string;
      };
    };
    buildingId?: UUIDString | null;
    building?: {
      id: UUIDString;
      name: string;
      reference?: string | null;
    };
    unitNumber?: string | null;
    propertyType: PropertyType;
    marketType: MarketType;
    bedrooms?: number | null;
    bathrooms?: number | null;
    floorNumber?: number | null;
    builtUpArea?: number | null;
    plotArea?: number | null;
    areaUnit: AreaUnit;
    furnishedStatus?: FurnishedStatus | null;
    parkingSpaces?: number | null;
    view?: string | null;
    emirate?: Emirate | null;
    city?: string | null;
    community?: string | null;
    area?: string | null;
    address?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    googlePlaceId?: string | null;
    mapDisplayMode: MapDisplayMode;
    referencePriceMinor?: Int64String | null;
    internalNotes?: string | null;
    ownershipReference?: string | null;
    mandateReference?: string | null;
    assignedMembershipId?: UUIDString | null;
    assignedMembership?: {
      email: string;
      userProfile?: {
        displayName: string;
      };
    };
    occupancyStatus: OccupancyStatus;
    inventoryStatus: InventoryStatus;
    createdAt: TimestampString;
    updatedAt: TimestampString;
    propertyAmenities_on_property: ({
      id: UUIDString;
      amenityId: UUIDString;
      amenity: {
        name: string;
        category?: string | null;
      };
    })[];
    propertyFeatures_on_property: ({
      id: UUIDString;
      key: string;
      valueType: FeatureValueType;
      textValue?: string | null;
      numberValue?: number | null;
      booleanValue?: boolean | null;
      unit?: string | null;
    })[];
    inventoryMedias_on_property: ({
      id: UUIDString;
      fileName: string;
      contentType: string;
      byteSize: Int64String;
      mediaKind: InventoryMediaKind;
      sortOrder: number;
      isCover: boolean;
      createdAt: TimestampString;
    })[];
  } & Property_Key;
}

export interface GetPropertyFeatureData {
  propertyFeature?: {
    id: UUIDString;
    organizationId: UUIDString;
    propertyId: UUIDString;
    key: string;
    valueType: FeatureValueType;
    textValue?: string | null;
    numberValue?: number | null;
    booleanValue?: boolean | null;
    unit?: string | null;
    createdAt: TimestampString;
    updatedAt: TimestampString;
  } & PropertyFeature_Key;
}

export interface GetPropertyFeatureVariables {
  organizationId: UUIDString;
  id: UUIDString;
}

export interface GetPropertyListingData {
  propertyListing?: {
    id: UUIDString;
    organizationId: UUIDString;
    propertyId: UUIDString;
    property: {
      id: UUIDString;
      propertyReference: string;
      propertyType: PropertyType;
      bedrooms?: number | null;
      bathrooms?: number | null;
      builtUpArea?: number | null;
      plotArea?: number | null;
      areaUnit: AreaUnit;
      emirate?: Emirate | null;
      city?: string | null;
      community?: string | null;
      area?: string | null;
      latitude?: number | null;
      longitude?: number | null;
      googlePlaceId?: string | null;
      mapDisplayMode: MapDisplayMode;
      inventoryStatus: InventoryStatus;
      assignedMembershipId?: UUIDString | null;
      project?: {
        id: UUIDString;
        projectName: string;
      };
      building?: {
        id: UUIDString;
        name: string;
      };
      inventoryMedias_on_property: ({
        id: UUIDString;
        fileName: string;
        contentType: string;
        mediaKind: InventoryMediaKind;
        sortOrder: number;
        isCover: boolean;
      })[];
    };
    listingReference: string;
    listingPurpose: ListingPurpose;
    marketType: MarketType;
    title: string;
    description?: string | null;
    askingPriceMinor: Int64String;
    currency: string;
    rentalPeriod?: RentalPeriod | null;
    assignedMembershipId?: UUIDString | null;
    assignedMembership?: {
      email: string;
      userProfile?: {
        displayName: string;
      };
    };
    listingStatus: ListingStatus;
    publicationStatus: ListingPublicationStatus;
    advertisingPermitNumber?: string | null;
    permitExpiryDate?: DateString | null;
    permitVerificationUrl?: string | null;
    createdAt: TimestampString;
    updatedAt: TimestampString;
  } & PropertyListing_Key;
}

export interface GetPropertyListingVariables {
  organizationId: UUIDString;
  id: UUIDString;
}

export interface GetPropertyVariables {
  organizationId: UUIDString;
  id: UUIDString;
}

export interface GetPublishedPageAssetData {
  publication?: {
    id: UUIDString;
    organizationId: UUIDString;
    snapshot: string;
  } & PagePublication_Key;
}

export interface GetPublishedPageAssetVariables {
  publicationId: UUIDString;
}

export interface GetPublishedPageFormData {
  binding?: {
    formId: UUIDString;
    form: {
      id: UUIDString;
      organizationId: UUIDString;
      publicId: string;
      name: string;
      status: LeadCaptureFormStatus;
      sourceId: UUIDString;
      branchId?: UUIDString | null;
      projectId?: UUIDString | null;
      fields: unknown;
      consentText: string;
      privacyPolicyUrl: string;
      successMessage: string;
      createdByUid: string;
    } & LeadCaptureForm_Key;
  };
}

export interface GetPublishedPageFormVariables {
  organizationId: UUIDString;
  pageId: UUIDString;
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

export interface GetWebsiteAgentData {
  agent?: {
    id: UUIDString;
    role: MembershipRole;
    email: string;
    websiteTitle?: string | null;
    websitePhone?: string | null;
    websiteWhatsapp?: string | null;
    userProfile?: {
      displayName: string;
    };
  };
}

export interface GetWebsiteAgentVariables {
  organizationId: UUIDString;
  membershipId: UUIDString;
}

export interface GetWebsiteLeadCaptureFormByIdData {
  form?: {
    id: UUIDString;
    organizationId: UUIDString;
    publicId: string;
    name: string;
    status: LeadCaptureFormStatus;
    branchId?: UUIDString | null;
    projectId?: UUIDString | null;
    fields: unknown;
    consentText: string;
    privacyPolicyUrl: string;
    successMessage: string;
  } & LeadCaptureForm_Key;
}

export interface GetWebsiteLeadCaptureFormByIdVariables {
  organizationId: UUIDString;
  formId: UUIDString;
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

export interface GetWebsiteMediaAccessData {
  member?: {
    id: UUIDString;
    role: MembershipRole;
  };
  website?: {
    id: UUIDString;
    allowAgentDrafts: boolean;
  };
}

export interface GetWebsiteMediaAccessVariables {
  organizationId: UUIDString;
}

export interface GetWebsiteMediaByIdsData {
  media: ({
    id: UUIDString;
    status: WebsiteMediaStatus;
    contentType: string;
    storagePath: string;
    alt: string;
    width?: number | null;
    height?: number | null;
  })[];
}

export interface GetWebsiteMediaByIdsVariables {
  organizationId: UUIDString;
  ids: UUIDString[];
}

export interface GetWebsitePageData {
  organization?: {
    name: string;
    slug: string;
  };
  page?: {
    id: UUIDString;
    websiteId: UUIDString;
    website: {
      id: UUIDString;
      name: string;
      slug: string;
      designSettings: string;
      allowAgentDrafts: boolean;
      status: WebsiteStatus;
    };
    title: string;
    slug: string;
    description?: string | null;
    pageType: WebsitePageType;
    status: WebsitePageStatus;
    seoTitle?: string | null;
    seoDescription?: string | null;
    designStyle: string;
    sourceProjectId?: UUIDString | null;
    sourcePropertyId?: UUIDString | null;
    sourceListingId?: UUIDString | null;
    revision: number;
    versionCount: number;
    currentVersionNumber: number;
    approvedVersionNumber?: number | null;
    livePublicationId?: UUIDString | null;
    reviewNote?: string | null;
    createdAt: TimestampString;
    updatedAt: TimestampString;
    archivedAt?: TimestampString | null;
    createdByUid: string;
    createdBy: {
      displayName: string;
    };
    updatedBy: {
      displayName: string;
    };
  };
  versions: ({
    id: UUIDString;
    versionNumber: number;
    kind: PageVersionKind;
    model?: string | null;
    approvedAt?: TimestampString | null;
    approvedBy?: {
      displayName: string;
    };
    createdAt: TimestampString;
    createdBy: {
      displayName: string;
    };
  })[];
  publications: ({
    id: UUIDString;
    versionNumber: number;
    pageSlug: string;
    status: PagePublicationStatus;
    sourceFingerprint: string;
    publishedAt: TimestampString;
    publishedBy: {
      displayName: string;
    };
    unpublishedAt?: TimestampString | null;
    unpublishedBy?: {
      displayName: string;
    };
  })[];
  binding?: {
    formId: UUIDString;
    updatedAt: TimestampString;
    form: {
      id: UUIDString;
      name: string;
      status: LeadCaptureFormStatus;
      consentText: string;
      privacyPolicyUrl: string;
      successMessage: string;
      fields: unknown;
    };
  };
  enquiries: ({
    count: number;
  })[];
}

export interface GetWebsitePageVariables {
  organizationId: UUIDString;
  id: UUIDString;
  createdByUid?: string | null;
}

export interface HitRateLimitCounterData {
  counter?: unknown | null;
}

export interface HitRateLimitCounterVariables {
  bucketKey: string;
  scope: string;
  windowEndsAt: TimestampString;
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

export interface InboxConversation_Key {
  organizationId: UUIDString;
  id: UUIDString;
  __typename?: 'InboxConversation_Key';
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

export interface InboxMailboxAccount_Key {
  organizationId: UUIDString;
  id: UUIDString;
  __typename?: 'InboxMailboxAccount_Key';
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

export interface InboxSettings_Key {
  organizationId: UUIDString;
  __typename?: 'InboxSettings_Key';
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

export interface InsertAutomationEventData {
  automationEvent_insert: AutomationEvent_Key;
}

export interface InsertAutomationEventVariables {
  organizationId: UUIDString;
  id: UUIDString;
  deduplicationKey: string;
  triggerType: string;
  targetType: string;
  targetId?: UUIDString | null;
  actorUid?: string | null;
  origin: string;
  originalEventId?: UUIDString | null;
  parentExecutionId?: UUIDString | null;
  originWorkflowId?: UUIDString | null;
  chainDepth: number;
  payload?: unknown | null;
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

export interface ListActiveInventoryAgentsData {
  memberships: ({
    id: UUIDString;
    email: string;
    userProfile?: {
      displayName: string;
    };
  })[];
}

export interface ListActiveInventoryAgentsVariables {
  organizationId: UUIDString;
  limit?: number;
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

export interface ListAiContentDraftsData {
  drafts: ({
    id: UUIDString;
    title: string;
    contentType: AiContentType;
    purpose: string;
    language: AiContentLanguage;
    tone: string;
    audience: string;
    status: AiContentDraftStatus;
    sourceProjectId?: UUIDString | null;
    sourcePropertyId?: UUIDString | null;
    sourceListingId?: UUIDString | null;
    sourceLeadId?: UUIDString | null;
    revision: number;
    versionCount: number;
    model?: string | null;
    generatedAt: TimestampString;
    createdAt: TimestampString;
    updatedAt: TimestampString;
    createdByUid: string;
    createdBy: {
      displayName: string;
    };
  })[];
  total: ({
    count: number;
  })[];
}

export interface ListAiContentDraftsVariables {
  organizationId: UUIDString;
  createdByUid?: string | null;
  statuses: AiContentDraftStatus[];
  contentType?: AiContentType | null;
  search?: string | null;
  limit?: number;
  offset?: number;
}

export interface ListAiContentTemplatesData {
  templates: ({
    id: UUIDString;
    name: string;
    contentType: AiContentType;
    purpose?: string | null;
    instructions: string;
    tone?: string | null;
    language?: AiContentLanguage | null;
    isActive: boolean;
    revision: number;
    createdAt: TimestampString;
    updatedAt: TimestampString;
    updatedBy: {
      displayName: string;
    };
  })[];
}

export interface ListAiContentTemplatesVariables {
  organizationId: UUIDString;
  contentType?: AiContentType | null;
  isActive?: boolean | null;
  limit?: number;
}

export interface ListAiSalesActivityData {
  activities: ({
    kind: ActivityKind;
    createdAt: TimestampString;
    leadId?: UUIDString | null;
    lead?: {
      assignedMembershipId?: UUIDString | null;
      branchId?: UUIDString | null;
    };
  })[];
}

export interface ListAiSalesActivityVariables {
  organizationId: UUIDString;
  since: TimestampString;
  limit?: number;
}

export interface ListAiSalesAssessmentsData {
  assessments: ({
    id: UUIDString;
    leadId: UUIDString;
    score?: number | null;
    priority: AiLeadPriority;
    sufficientData: boolean;
    ruleVersion: string;
    evaluatedAt: TimestampString;
  })[];
  reviews: ({
    id: UUIDString;
    leadId: UUIDString;
    assessmentId: UUIDString;
    reviewedPriority: AiLeadPriority;
    createdAt: TimestampString;
  })[];
}

export interface ListAiSalesAssessmentsVariables {
  organizationId: UUIDString;
  since: TimestampString;
  limit?: number;
  offset?: number;
}

export interface ListAiSalesViewingsData {
  viewings: ({
    id: UUIDString;
    leadId: UUIDString;
    propertyId: UUIDString;
    scheduledAt: TimestampString;
    status: LeadPropertyViewingStatus;
    customerConfirmation: LeadPropertyViewingConfirmation;
    outcome?: LeadPropertyViewingOutcome | null;
    assignedMembershipId?: UUIDString | null;
    lead: {
      fullName: string;
      assignedMembershipId?: UUIDString | null;
      branchId?: UUIDString | null;
    };
  })[];
}

export interface ListAiSalesViewingsVariables {
  organizationId: UUIDString;
  from: TimestampString;
  to: TimestampString;
  propertyId?: UUIDString | null;
  limit?: number;
}

export interface ListAssignedPropertyListingMapPinsData {
  propertyListings: ({
    id: UUIDString;
    listingReference: string;
    listingPurpose: ListingPurpose;
    marketType: MarketType;
    title: string;
    askingPriceMinor: Int64String;
    currency: string;
    rentalPeriod?: RentalPeriod | null;
    listingStatus: ListingStatus;
    property: {
      id: UUIDString;
      propertyReference: string;
      propertyType: PropertyType;
      bedrooms?: number | null;
      emirate?: Emirate | null;
      city?: string | null;
      community?: string | null;
      latitude?: number | null;
      longitude?: number | null;
      mapDisplayMode: MapDisplayMode;
      project?: {
        projectName: string;
      };
    };
  })[];
  mapped: ({
    _count: number;
  })[];
  mappedAll: ({
    _count: number;
  })[];
  total: ({
    _count: number;
  })[];
}

export interface ListAssignedPropertyListingMapPinsVariables {
  organizationId: UUIDString;
  assignedMembershipId: UUIDString;
  listingStatus?: ListingStatus | null;
  purpose?: ListingPurpose | null;
  marketType?: MarketType | null;
  emirate?: Emirate | null;
  community?: string | null;
  propertyType?: PropertyType | null;
  minimumPriceMinor?: Int64String | null;
  maximumPriceMinor?: Int64String | null;
  limit?: number;
  offset?: number;
  south?: number | null;
  north?: number | null;
  west?: number | null;
  east?: number | null;
  search?: string | null;
}

export interface ListAssignedPropertyListingsData {
  propertyListings: ({
    id: UUIDString;
    propertyId: UUIDString;
    property: {
      id: UUIDString;
      propertyReference: string;
      propertyType: PropertyType;
      bedrooms?: number | null;
      bathrooms?: number | null;
      builtUpArea?: number | null;
      areaUnit: AreaUnit;
      emirate?: Emirate | null;
      city?: string | null;
      community?: string | null;
      assignedMembershipId?: UUIDString | null;
      project?: {
        id: UUIDString;
        projectName: string;
      };
      building?: {
        id: UUIDString;
        name: string;
      };
      inventoryMedias_on_property: ({
        id: UUIDString;
      })[];
    };
    listingReference: string;
    listingPurpose: ListingPurpose;
    marketType: MarketType;
    title: string;
    description?: string | null;
    askingPriceMinor: Int64String;
    currency: string;
    rentalPeriod?: RentalPeriod | null;
    assignedMembershipId?: UUIDString | null;
    assignedMembership?: {
      email: string;
      userProfile?: {
        displayName: string;
      };
    };
    listingStatus: ListingStatus;
    publicationStatus: ListingPublicationStatus;
    advertisingPermitNumber?: string | null;
    permitExpiryDate?: DateString | null;
    permitVerificationUrl?: string | null;
    createdAt: TimestampString;
    updatedAt: TimestampString;
  })[];
  byPriceAsc: ({
    id: UUIDString;
    propertyId: UUIDString;
    property: {
      id: UUIDString;
      propertyReference: string;
      propertyType: PropertyType;
      bedrooms?: number | null;
      bathrooms?: number | null;
      builtUpArea?: number | null;
      areaUnit: AreaUnit;
      emirate?: Emirate | null;
      city?: string | null;
      community?: string | null;
      assignedMembershipId?: UUIDString | null;
      project?: {
        id: UUIDString;
        projectName: string;
      };
      building?: {
        id: UUIDString;
        name: string;
      };
      inventoryMedias_on_property: ({
        id: UUIDString;
      })[];
    };
    listingReference: string;
    listingPurpose: ListingPurpose;
    marketType: MarketType;
    title: string;
    description?: string | null;
    askingPriceMinor: Int64String;
    currency: string;
    rentalPeriod?: RentalPeriod | null;
    assignedMembershipId?: UUIDString | null;
    assignedMembership?: {
      email: string;
      userProfile?: {
        displayName: string;
      };
    };
    listingStatus: ListingStatus;
    publicationStatus: ListingPublicationStatus;
    advertisingPermitNumber?: string | null;
    permitExpiryDate?: DateString | null;
    permitVerificationUrl?: string | null;
    createdAt: TimestampString;
    updatedAt: TimestampString;
  })[];
  byPriceDesc: ({
    id: UUIDString;
    propertyId: UUIDString;
    property: {
      id: UUIDString;
      propertyReference: string;
      propertyType: PropertyType;
      bedrooms?: number | null;
      bathrooms?: number | null;
      builtUpArea?: number | null;
      areaUnit: AreaUnit;
      emirate?: Emirate | null;
      city?: string | null;
      community?: string | null;
      assignedMembershipId?: UUIDString | null;
      project?: {
        id: UUIDString;
        projectName: string;
      };
      building?: {
        id: UUIDString;
        name: string;
      };
      inventoryMedias_on_property: ({
        id: UUIDString;
      })[];
    };
    listingReference: string;
    listingPurpose: ListingPurpose;
    marketType: MarketType;
    title: string;
    description?: string | null;
    askingPriceMinor: Int64String;
    currency: string;
    rentalPeriod?: RentalPeriod | null;
    assignedMembershipId?: UUIDString | null;
    assignedMembership?: {
      email: string;
      userProfile?: {
        displayName: string;
      };
    };
    listingStatus: ListingStatus;
    publicationStatus: ListingPublicationStatus;
    advertisingPermitNumber?: string | null;
    permitExpiryDate?: DateString | null;
    permitVerificationUrl?: string | null;
    createdAt: TimestampString;
    updatedAt: TimestampString;
  })[];
  byCreated: ({
    id: UUIDString;
    propertyId: UUIDString;
    property: {
      id: UUIDString;
      propertyReference: string;
      propertyType: PropertyType;
      bedrooms?: number | null;
      bathrooms?: number | null;
      builtUpArea?: number | null;
      areaUnit: AreaUnit;
      emirate?: Emirate | null;
      city?: string | null;
      community?: string | null;
      assignedMembershipId?: UUIDString | null;
      project?: {
        id: UUIDString;
        projectName: string;
      };
      building?: {
        id: UUIDString;
        name: string;
      };
      inventoryMedias_on_property: ({
        id: UUIDString;
      })[];
    };
    listingReference: string;
    listingPurpose: ListingPurpose;
    marketType: MarketType;
    title: string;
    description?: string | null;
    askingPriceMinor: Int64String;
    currency: string;
    rentalPeriod?: RentalPeriod | null;
    assignedMembershipId?: UUIDString | null;
    assignedMembership?: {
      email: string;
      userProfile?: {
        displayName: string;
      };
    };
    listingStatus: ListingStatus;
    publicationStatus: ListingPublicationStatus;
    advertisingPermitNumber?: string | null;
    permitExpiryDate?: DateString | null;
    permitVerificationUrl?: string | null;
    createdAt: TimestampString;
    updatedAt: TimestampString;
  })[];
  total: ({
    _count: number;
  })[];
}

export interface ListAssignedPropertyListingsVariables {
  organizationId: UUIDString;
  assignedMembershipId: UUIDString;
  propertyId?: UUIDString | null;
  listingStatus?: ListingStatus | null;
  purpose?: ListingPurpose | null;
  marketType?: MarketType | null;
  emirate?: Emirate | null;
  community?: string | null;
  propertyType?: PropertyType | null;
  minimumPriceMinor?: Int64String | null;
  maximumPriceMinor?: Int64String | null;
  limit?: number;
  offset?: number;
  search?: string | null;
  sortUpdated?: boolean;
  sortPriceAsc?: boolean;
  sortPriceDesc?: boolean;
  sortCreated?: boolean;
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

export interface ListAutomationApprovalsData {
  member?: {
    id: UUIDString;
    role: MembershipRole;
  };
  approvals: ({
    id: UUIDString;
    status: AutomationApprovalStatus;
    actionId: string;
    actionType: string;
    risk: string;
    targetType: string;
    targetId?: UUIDString | null;
    requestedAt: TimestampString;
    expiresAt: TimestampString;
    decidedAt?: TimestampString | null;
    decisionReason?: string | null;
    resultStatus?: string | null;
    resultErrorCode?: string | null;
    snapshotHash: string;
    approvedActionSnapshot: string;
    requestedByUid: string;
    requestedBy: {
      displayName: string;
    };
    approverUid?: string | null;
    approver?: {
      displayName: string;
    };
    lead?: {
      id: UUIDString;
      fullName: string;
      status: LeadStatus;
    };
    fromMembership?: {
      id: UUIDString;
      email: string;
      userProfile?: {
        displayName: string;
      };
    };
    toMembership?: {
      id: UUIDString;
      email: string;
      userProfile?: {
        displayName: string;
      };
    };
    workflow: {
      id: UUIDString;
      name: string;
    };
    execution: {
      id: UUIDString;
      triggerType: string;
      workflowVersion: {
        versionNumber: number;
      };
      triggeringEvent: {
        triggerType: string;
        origin: string;
        createdAt: TimestampString;
      };
    };
  })[];
}

export interface ListAutomationApprovalsVariables {
  organizationId: UUIDString;
  statuses: AutomationApprovalStatus[];
  limit?: number;
  offset?: number;
}

export interface ListAutomationDueTasksData {
  followUps: ({
    id: UUIDString;
    leadId: UUIDString;
    dueAt: TimestampString;
  })[];
  workTasks: ({
    id: UUIDString;
    leadId?: UUIDString | null;
    dueAt: TimestampString;
  })[];
}

export interface ListAutomationDueTasksVariables {
  organizationId: UUIDString;
  since: TimestampString;
  now: TimestampString;
}

export interface ListAutomationEventsForTargetData {
  events: ({
    id: UUIDString;
    triggerType: string;
    targetType: string;
    origin: string;
    status: AutomationEventStatus;
    chainDepth: number;
    originalEventId?: UUIDString | null;
    parentExecutionId?: UUIDString | null;
    originWorkflowId?: UUIDString | null;
    deduplicationKey?: string | null;
    actorUid?: string | null;
    payload?: unknown | null;
    createdAt: TimestampString;
  })[];
}

export interface ListAutomationEventsForTargetVariables {
  organizationId: UUIDString;
  targetId: UUIDString;
}

export interface ListAutomationExecutionsData {
  executions: ({
    id: UUIDString;
    workflowId: UUIDString;
    workflow: {
      name: string;
    };
    triggerType: string;
    targetType: string;
    targetId?: UUIDString | null;
    leadId?: UUIDString | null;
    lead?: {
      fullName: string;
      assignedMembershipId?: UUIDString | null;
    };
    status: AutomationExecutionStatus;
    nextStep: number;
    attemptCount: number;
    actionCount: number;
    aiCalls: number;
    durationMs?: number | null;
    errorCode?: string | null;
    chainDepth: number;
    startedAt?: TimestampString | null;
    completedAt?: TimestampString | null;
    createdAt: TimestampString;
  })[];
}

export interface ListAutomationExecutionsVariables {
  organizationId: UUIDString;
  workflowId?: UUIDString | null;
  status?: AutomationExecutionStatus | null;
  triggerType?: string | null;
  agentMembershipId?: UUIDString | null;
  from?: TimestampString | null;
  to?: TimestampString | null;
  limit?: number;
  offset?: number;
}

export interface ListAutomationWorkOrganizationsData {
  events: ({
    organizationId: UUIDString;
  })[];
  jobs: ({
    organizationId: UUIDString;
  })[];
  schedules: ({
    organizationId: UUIDString;
  })[];
  scans: ({
    organizationId: UUIDString;
  })[];
}

export interface ListAutomationWorkOrganizationsVariables {
  now: TimestampString;
}

export interface ListAutomationWorkflowsData {
  workflows: ({
    id: UUIDString;
    name: string;
    description: string;
    triggerType: string;
    status: AutomationWorkflowStatus;
    revision: number;
    currentVersionNumber: number;
    approvedVersionNumber?: number | null;
    hasApprovalSteps: boolean;
    timeZone: string;
    nextRunAt?: TimestampString | null;
    createdByUid: string;
    createdBy: {
      displayName: string;
    };
    approvedByUid?: string | null;
    approvedAt?: TimestampString | null;
    executorUid?: string | null;
    executor?: {
      displayName: string;
    };
    activatedAt?: TimestampString | null;
    createdAt: TimestampString;
    updatedAt: TimestampString;
  })[];
}

export interface ListAutomationWorkflowsVariables {
  organizationId: UUIDString;
  createdByUid?: string | null;
  status?: AutomationWorkflowStatus | null;
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

export interface ListBuildingsData {
  buildings: ({
    id: UUIDString;
    projectId: UUIDString;
    project: {
      mapDisplayMode: MapDisplayMode;
    };
    phaseId?: UUIDString | null;
    name: string;
    reference?: string | null;
    floors?: number | null;
    buildingType: BuildingType;
    status: CompletionStatus;
    handoverDate?: DateString | null;
    latitude?: number | null;
    longitude?: number | null;
    createdAt: TimestampString;
    updatedAt: TimestampString;
  })[];
  total: ({
    _count: number;
  })[];
}

export interface ListBuildingsVariables {
  organizationId: UUIDString;
  projectId?: UUIDString | null;
  phaseId?: UUIDString | null;
  status?: CompletionStatus | null;
  limit?: number;
  offset?: number;
  search?: string | null;
}

export interface ListDevelopersData {
  developers: ({
    id: UUIDString;
    organizationId: UUIDString;
    name: string;
    slug: string;
    logoReference?: string | null;
    description?: string | null;
    website?: string | null;
    email?: string | null;
    phone?: string | null;
    country: string;
    headOfficeAddress?: string | null;
    headOfficeLatitude?: number | null;
    headOfficeLongitude?: number | null;
    headOfficeGooglePlaceId?: string | null;
    status: DeveloperStatus;
    createdAt: TimestampString;
    updatedAt: TimestampString;
    projects_on_developer: ({
      _count: number;
    })[];
  } & Developer_Key)[];
  total: ({
    _count: number;
  })[];
}

export interface ListDevelopersVariables {
  organizationId: UUIDString;
  limit?: number;
  offset?: number;
  search?: string | null;
}

export interface ListFloorPlansData {
  floorPlans: ({
    id: UUIDString;
    projectId: UUIDString;
    propertyId?: UUIDString | null;
    property?: {
      id: UUIDString;
      propertyReference: string;
    };
    buildingId?: UUIDString | null;
    name: string;
    propertyType: PropertyType;
    bedrooms?: number | null;
    builtUpArea?: number | null;
    plotArea?: number | null;
    areaUnit: AreaUnit;
    mediaReference?: string | null;
    createdAt: TimestampString;
    updatedAt: TimestampString;
    inventoryMedias_on_floorPlan: ({
      id: UUIDString;
      fileName: string;
      contentType: string;
      mediaKind: InventoryMediaKind;
      sortOrder: number;
      isCover: boolean;
    })[];
  })[];
  total: ({
    _count: number;
  })[];
}

export interface ListFloorPlansVariables {
  organizationId: UUIDString;
  projectId: UUIDString;
  buildingId?: UUIDString | null;
  limit?: number;
  offset?: number;
  search?: string | null;
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

export interface ListInventoryAmenitiesData {
  inventoryAmenities: ({
    id: UUIDString;
    name: string;
    category?: string | null;
    isActive: boolean;
    createdAt: TimestampString;
    updatedAt: TimestampString;
  })[];
  total: ({
    _count: number;
  })[];
}

export interface ListInventoryAmenitiesVariables {
  organizationId: UUIDString;
  limit?: number;
  offset?: number;
  search?: string | null;
}

export interface ListInventoryMediaData {
  inventoryMedias: ({
    id: UUIDString;
    organizationId: UUIDString;
    propertyId?: UUIDString | null;
    projectId?: UUIDString | null;
    floorPlanId?: UUIDString | null;
    storagePath: string;
    fileName: string;
    contentType: string;
    byteSize: Int64String;
    mediaKind: InventoryMediaKind;
    sortOrder: number;
    isCover: boolean;
    status: InventoryMediaStatus;
    createdAt: TimestampString;
  } & InventoryMedia_Key)[];
}

export interface ListInventoryMediaVariables {
  organizationId: UUIDString;
  propertyId?: UUIDString | null;
  projectId?: UUIDString | null;
  floorPlanId?: UUIDString | null;
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

export interface ListLeadPropertyCandidatesData {
  properties: ({
    id: UUIDString;
    propertyReference: string;
    projectId?: UUIDString | null;
    project?: {
      id: UUIDString;
      projectName: string;
    };
    propertyType: PropertyType;
    bedrooms?: number | null;
    bathrooms?: number | null;
    builtUpArea?: number | null;
    areaUnit: AreaUnit;
    emirate?: Emirate | null;
    community?: string | null;
    area?: string | null;
    inventoryStatus: InventoryStatus;
    archivedAt?: TimestampString | null;
    propertyListings_on_property: ({
      id: UUIDString;
      listingPurpose: ListingPurpose;
      title: string;
      askingPriceMinor: Int64String;
      currency: string;
      rentalPeriod?: RentalPeriod | null;
      listingStatus: ListingStatus;
    })[];
  })[];
  total: ({
    _count: number;
  })[];
}

export interface ListLeadPropertyCandidatesVariables {
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
    projectId?: UUIDString | null;
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

export interface ListListingActivityData {
  activities: ({
    id: UUIDString;
    kind: ActivityKind;
    metadata?: unknown | null;
    createdAt: TimestampString;
    actor: {
      displayName: string;
    };
  })[];
}

export interface ListListingActivityVariables {
  organizationId: UUIDString;
  id: UUIDString;
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

export interface ListMyAiConversationsData {
  conversations: ({
    id: UUIDString;
    title: string;
    messageCount: number;
    createdAt: TimestampString;
    updatedAt: TimestampString;
    lastMessageAt: TimestampString;
  })[];
  total: ({
    count: number;
  })[];
}

export interface ListMyAiConversationsVariables {
  organizationId: UUIDString;
  search?: string | null;
  limit?: number;
  offset?: number;
}

export interface ListMyAiSalesSummariesData {
  insights: ({
    id: UUIDString;
    kind: AiSalesInsightKind;
    model: string;
    promptVersion: string;
    createdAt: TimestampString;
  })[];
}

export interface ListMyAiSalesSummariesVariables {
  organizationId: UUIDString;
  limit?: number;
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

export interface ListMyTasksData {
  me?: {
    id: UUIDString;
    role: MembershipRole;
  };
  followUps: ({
    id: UUIDString;
    title: string;
    dueAt: TimestampString;
    leadId: UUIDString;
    lead: {
      fullName: string;
      status: LeadStatus;
    };
  })[];
  workTasks: ({
    id: UUIDString;
    title: string;
    dueAt: TimestampString;
    assignedMembershipId?: UUIDString | null;
    listingId?: UUIDString | null;
    listing?: {
      title: string;
      listingReference: string;
    };
    leadId?: UUIDString | null;
    sourceExecutionId?: UUIDString | null;
  })[];
}

export interface ListMyTasksVariables {
  organizationId: UUIDString;
  limit?: number;
}

export interface ListPaymentPlansData {
  paymentPlans: ({
    id: UUIDString;
    projectId: UUIDString;
    propertyId?: UUIDString | null;
    property?: {
      id: UUIDString;
      propertyReference: string;
      propertyType: PropertyType;
    };
    name: string;
    bookingPercentageBps: number;
    handoverPercentageBps: number;
    installmentTotalBps: number;
    isActive: boolean;
    createdAt: TimestampString;
    updatedAt: TimestampString;
    paymentPlanInstallments_on_paymentPlan: ({
      id: UUIDString;
      position: number;
      percentageBps: number;
      dueTrigger: PaymentDueTrigger;
      constructionMilestonePercent?: number | null;
      postHandoverMonths?: number | null;
      description?: string | null;
    })[];
  })[];
  total: ({
    _count: number;
  })[];
}

export interface ListPaymentPlansVariables {
  organizationId: UUIDString;
  projectId: UUIDString;
  limit?: number;
  offset?: number;
}

export interface ListPendingWebsiteEnquiriesData {
  pending: ({
    id: UUIDString;
    pageId?: UUIDString | null;
    publicationId?: UUIDString | null;
    formId: UUIDString;
    idempotencyKeyHash: string;
    payload: string;
    errorCode: string;
    attempts: number;
    createdAt: TimestampString;
    updatedAt: TimestampString;
  })[];
  total: ({
    count: number;
  })[];
}

export interface ListPendingWebsiteEnquiriesVariables {
  organizationId: UUIDString;
  pageId?: UUIDString | null;
  limit?: number;
}

export interface ListPortalExportListingsData {
  listings: ({
    id: UUIDString;
    listingReference: string;
    listingPurpose: ListingPurpose;
    marketType: MarketType;
    title: string;
    description?: string | null;
    askingPriceMinor: Int64String;
    currency: string;
    rentalPeriod?: RentalPeriod | null;
    listingStatus: ListingStatus;
    publicationStatus: ListingPublicationStatus;
    advertisingPermitNumber?: string | null;
    permitExpiryDate?: DateString | null;
    permitVerificationUrl?: string | null;
    updatedAt: TimestampString;
    assignedMembershipId?: UUIDString | null;
    assignedMembership?: {
      id: UUIDString;
      role: MembershipRole;
      status: MembershipStatus;
      userProfile?: {
        displayName: string;
      };
    };
    property: {
      id: UUIDString;
      propertyReference: string;
      propertyType: PropertyType;
      marketType: MarketType;
      bedrooms?: number | null;
      bathrooms?: number | null;
      builtUpArea?: number | null;
      plotArea?: number | null;
      areaUnit: AreaUnit;
      furnishedStatus?: FurnishedStatus | null;
      parkingSpaces?: number | null;
      view?: string | null;
      emirate?: Emirate | null;
      community?: string | null;
      area?: string | null;
      floorNumber?: number | null;
      occupancyStatus: OccupancyStatus;
      inventoryStatus: InventoryStatus;
      archivedAt?: TimestampString | null;
      project?: {
        projectName: string;
      };
      building?: {
        name: string;
      };
      inventoryMedias_on_property: ({
        id: UUIDString;
        mediaKind: InventoryMediaKind;
        fileName: string;
        contentType: string;
        isCover: boolean;
        sortOrder: number;
      })[];
    };
  })[];
  total: ({
    _count: number;
  })[];
  mappings: ({
    provider: PortalProvider;
    fieldKey: string;
    sourceValue: string;
    targetValue: string;
  })[];
}

export interface ListPortalExportListingsVariables {
  organizationId: UUIDString;
  limit?: number;
  offset?: number;
}

export interface ListProjectAuditEventsData {
  auditLogs: ({
    id: UUIDString;
    action: ActivityKind;
    targetType: AuditTargetType;
    targetId: UUIDString;
    createdAt: TimestampString;
  })[];
  total: ({
    _count: number;
  })[];
}

export interface ListProjectAuditEventsVariables {
  organizationId: UUIDString;
  projectId: UUIDString;
  limit?: number;
  offset?: number;
}

export interface ListProjectPhasesData {
  projectPhases: ({
    id: UUIDString;
    projectId: UUIDString;
    name: string;
    reference?: string | null;
    description?: string | null;
    status: CompletionStatus;
    expectedHandoverDate?: DateString | null;
    actualHandoverDate?: DateString | null;
    createdAt: TimestampString;
    updatedAt: TimestampString;
  })[];
  total: ({
    _count: number;
  })[];
}

export interface ListProjectPhasesVariables {
  organizationId: UUIDString;
  projectId: UUIDString;
  limit?: number;
  offset?: number;
}

export interface ListProjectWebsiteMediaData {
  projectMedia: ({
    id: UUIDString;
    contentType: string;
    mediaKind: InventoryMediaKind;
    isCover: boolean;
  })[];
  unitMedia: ({
    id: UUIDString;
    contentType: string;
    mediaKind: InventoryMediaKind;
    isCover: boolean;
  })[];
}

export interface ListProjectWebsiteMediaVariables {
  organizationId: UUIDString;
  projectId: UUIDString;
  assignedMembershipId?: UUIDString | null;
  includeProjectFiles: boolean;
  limit?: number;
}

export interface ListProjectsData {
  projects: ({
    id: UUIDString;
    developerId: UUIDString;
    developer: {
      name: string;
      slug: string;
    };
    projectName: string;
    projectCode: string;
    description?: string | null;
    projectType: ProjectType;
    ownershipType?: OwnershipType | null;
    community?: string | null;
    area?: string | null;
    emirate?: Emirate | null;
    country: string;
    address?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    city?: string | null;
    googlePlaceId?: string | null;
    mapDisplayMode: MapDisplayMode;
    launchDate?: DateString | null;
    expectedHandoverDate?: DateString | null;
    actualHandoverDate?: DateString | null;
    constructionStatus: ConstructionStatus;
    projectStatus: ProjectStatus;
    startingPriceMinor?: Int64String | null;
    currency: string;
    totalUnits?: number | null;
    marketingDescription?: string | null;
    brochureReference?: string | null;
    permitNumber?: string | null;
    permitExpiryDate?: DateString | null;
    permitReferenceUrl?: string | null;
    createdAt: TimestampString;
    updatedAt: TimestampString;
    properties_on_project: ({
      _count: number;
    })[];
  })[];
  total: ({
    _count: number;
  })[];
}

export interface ListProjectsVariables {
  organizationId: UUIDString;
  developerId?: UUIDString | null;
  projectStatus?: ProjectStatus | null;
  emirate?: Emirate | null;
  limit?: number;
  offset?: number;
  search?: string | null;
}

export interface ListPropertiesAdvancedData {
  properties: ({
    id: UUIDString;
    propertyReference: string;
    projectId?: UUIDString | null;
    project?: {
      projectName: string;
      developer: {
        id: UUIDString;
        name: string;
      };
    };
    buildingId?: UUIDString | null;
    building?: {
      name: string;
    };
    unitNumber?: string | null;
    propertyType: PropertyType;
    marketType: MarketType;
    bedrooms?: number | null;
    bathrooms?: number | null;
    floorNumber?: number | null;
    builtUpArea?: number | null;
    plotArea?: number | null;
    areaUnit: AreaUnit;
    furnishedStatus?: FurnishedStatus | null;
    parkingSpaces?: number | null;
    view?: string | null;
    emirate?: Emirate | null;
    city?: string | null;
    community?: string | null;
    area?: string | null;
    address?: string | null;
    mapDisplayMode: MapDisplayMode;
    referencePriceMinor?: Int64String | null;
    assignedMembershipId?: UUIDString | null;
    assignedMembership?: {
      email: string;
      userProfile?: {
        displayName: string;
      };
    };
    occupancyStatus: OccupancyStatus;
    inventoryStatus: InventoryStatus;
    createdAt: TimestampString;
    updatedAt: TimestampString;
    inventoryMedias_on_property: ({
      id: UUIDString;
      fileName: string;
      contentType: string;
      mediaKind: InventoryMediaKind;
      isCover: boolean;
      sortOrder: number;
    })[];
  })[];
  total: ({
    _count: number;
  })[];
}

export interface ListPropertiesAdvancedVariables {
  organizationId: UUIDString;
  projectId?: UUIDString | null;
  developerId?: UUIDString | null;
  buildingId?: UUIDString | null;
  inventoryStatus?: InventoryStatus | null;
  propertyType?: PropertyType | null;
  marketType?: MarketType | null;
  emirate?: Emirate | null;
  community?: string | null;
  bedrooms?: number | null;
  minimumPriceMinor?: Int64String | null;
  maximumPriceMinor?: Int64String | null;
  assignedMembershipId?: UUIDString | null;
  limit?: number;
  offset?: number;
  search?: string | null;
}

export interface ListPropertiesData {
  properties: ({
    id: UUIDString;
    propertyReference: string;
    projectId?: UUIDString | null;
    project?: {
      projectName: string;
    };
    buildingId?: UUIDString | null;
    building?: {
      name: string;
    };
    unitNumber?: string | null;
    propertyType: PropertyType;
    bedrooms?: number | null;
    bathrooms?: number | null;
    floorNumber?: number | null;
    builtUpArea?: number | null;
    plotArea?: number | null;
    areaUnit: AreaUnit;
    furnishedStatus?: FurnishedStatus | null;
    parkingSpaces?: number | null;
    view?: string | null;
    occupancyStatus: OccupancyStatus;
    inventoryStatus: InventoryStatus;
    createdAt: TimestampString;
    updatedAt: TimestampString;
  })[];
  total: ({
    _count: number;
  })[];
}

export interface ListPropertiesVariables {
  organizationId: UUIDString;
  projectId?: UUIDString | null;
  buildingId?: UUIDString | null;
  inventoryStatus?: InventoryStatus | null;
  propertyType?: PropertyType | null;
  limit?: number;
  offset?: number;
  search?: string | null;
}

export interface ListPropertyFeaturesData {
  propertyFeatures: ({
    id: UUIDString;
    propertyId: UUIDString;
    key: string;
    valueType: FeatureValueType;
    textValue?: string | null;
    numberValue?: number | null;
    booleanValue?: boolean | null;
    unit?: string | null;
    createdAt: TimestampString;
    updatedAt: TimestampString;
  })[];
  total: ({
    _count: number;
  })[];
}

export interface ListPropertyFeaturesVariables {
  organizationId: UUIDString;
  propertyId: UUIDString;
  limit?: number;
  offset?: number;
  search?: string | null;
}

export interface ListPropertyListingMapPinsData {
  propertyListings: ({
    id: UUIDString;
    listingReference: string;
    listingPurpose: ListingPurpose;
    marketType: MarketType;
    title: string;
    askingPriceMinor: Int64String;
    currency: string;
    rentalPeriod?: RentalPeriod | null;
    listingStatus: ListingStatus;
    property: {
      id: UUIDString;
      propertyReference: string;
      propertyType: PropertyType;
      bedrooms?: number | null;
      emirate?: Emirate | null;
      city?: string | null;
      community?: string | null;
      latitude?: number | null;
      longitude?: number | null;
      mapDisplayMode: MapDisplayMode;
      project?: {
        projectName: string;
      };
    };
  })[];
  mapped: ({
    _count: number;
  })[];
  mappedAll: ({
    _count: number;
  })[];
  total: ({
    _count: number;
  })[];
}

export interface ListPropertyListingMapPinsVariables {
  organizationId: UUIDString;
  listingStatus?: ListingStatus | null;
  purpose?: ListingPurpose | null;
  marketType?: MarketType | null;
  emirate?: Emirate | null;
  community?: string | null;
  propertyType?: PropertyType | null;
  minimumPriceMinor?: Int64String | null;
  maximumPriceMinor?: Int64String | null;
  limit?: number;
  offset?: number;
  south?: number | null;
  north?: number | null;
  west?: number | null;
  east?: number | null;
  search?: string | null;
}

export interface ListPropertyListingsData {
  propertyListings: ({
    id: UUIDString;
    propertyId: UUIDString;
    property: {
      id: UUIDString;
      propertyReference: string;
      propertyType: PropertyType;
      bedrooms?: number | null;
      bathrooms?: number | null;
      builtUpArea?: number | null;
      areaUnit: AreaUnit;
      emirate?: Emirate | null;
      city?: string | null;
      community?: string | null;
      assignedMembershipId?: UUIDString | null;
      project?: {
        id: UUIDString;
        projectName: string;
      };
      building?: {
        id: UUIDString;
        name: string;
      };
      inventoryMedias_on_property: ({
        id: UUIDString;
      })[];
    };
    listingReference: string;
    listingPurpose: ListingPurpose;
    marketType: MarketType;
    title: string;
    description?: string | null;
    askingPriceMinor: Int64String;
    currency: string;
    rentalPeriod?: RentalPeriod | null;
    assignedMembershipId?: UUIDString | null;
    assignedMembership?: {
      email: string;
      userProfile?: {
        displayName: string;
      };
    };
    listingStatus: ListingStatus;
    publicationStatus: ListingPublicationStatus;
    advertisingPermitNumber?: string | null;
    permitExpiryDate?: DateString | null;
    permitVerificationUrl?: string | null;
    createdAt: TimestampString;
    updatedAt: TimestampString;
  })[];
  byPriceAsc: ({
    id: UUIDString;
    propertyId: UUIDString;
    property: {
      id: UUIDString;
      propertyReference: string;
      propertyType: PropertyType;
      bedrooms?: number | null;
      bathrooms?: number | null;
      builtUpArea?: number | null;
      areaUnit: AreaUnit;
      emirate?: Emirate | null;
      city?: string | null;
      community?: string | null;
      assignedMembershipId?: UUIDString | null;
      project?: {
        id: UUIDString;
        projectName: string;
      };
      building?: {
        id: UUIDString;
        name: string;
      };
      inventoryMedias_on_property: ({
        id: UUIDString;
      })[];
    };
    listingReference: string;
    listingPurpose: ListingPurpose;
    marketType: MarketType;
    title: string;
    description?: string | null;
    askingPriceMinor: Int64String;
    currency: string;
    rentalPeriod?: RentalPeriod | null;
    assignedMembershipId?: UUIDString | null;
    assignedMembership?: {
      email: string;
      userProfile?: {
        displayName: string;
      };
    };
    listingStatus: ListingStatus;
    publicationStatus: ListingPublicationStatus;
    advertisingPermitNumber?: string | null;
    permitExpiryDate?: DateString | null;
    permitVerificationUrl?: string | null;
    createdAt: TimestampString;
    updatedAt: TimestampString;
  })[];
  byPriceDesc: ({
    id: UUIDString;
    propertyId: UUIDString;
    property: {
      id: UUIDString;
      propertyReference: string;
      propertyType: PropertyType;
      bedrooms?: number | null;
      bathrooms?: number | null;
      builtUpArea?: number | null;
      areaUnit: AreaUnit;
      emirate?: Emirate | null;
      city?: string | null;
      community?: string | null;
      assignedMembershipId?: UUIDString | null;
      project?: {
        id: UUIDString;
        projectName: string;
      };
      building?: {
        id: UUIDString;
        name: string;
      };
      inventoryMedias_on_property: ({
        id: UUIDString;
      })[];
    };
    listingReference: string;
    listingPurpose: ListingPurpose;
    marketType: MarketType;
    title: string;
    description?: string | null;
    askingPriceMinor: Int64String;
    currency: string;
    rentalPeriod?: RentalPeriod | null;
    assignedMembershipId?: UUIDString | null;
    assignedMembership?: {
      email: string;
      userProfile?: {
        displayName: string;
      };
    };
    listingStatus: ListingStatus;
    publicationStatus: ListingPublicationStatus;
    advertisingPermitNumber?: string | null;
    permitExpiryDate?: DateString | null;
    permitVerificationUrl?: string | null;
    createdAt: TimestampString;
    updatedAt: TimestampString;
  })[];
  byCreated: ({
    id: UUIDString;
    propertyId: UUIDString;
    property: {
      id: UUIDString;
      propertyReference: string;
      propertyType: PropertyType;
      bedrooms?: number | null;
      bathrooms?: number | null;
      builtUpArea?: number | null;
      areaUnit: AreaUnit;
      emirate?: Emirate | null;
      city?: string | null;
      community?: string | null;
      assignedMembershipId?: UUIDString | null;
      project?: {
        id: UUIDString;
        projectName: string;
      };
      building?: {
        id: UUIDString;
        name: string;
      };
      inventoryMedias_on_property: ({
        id: UUIDString;
      })[];
    };
    listingReference: string;
    listingPurpose: ListingPurpose;
    marketType: MarketType;
    title: string;
    description?: string | null;
    askingPriceMinor: Int64String;
    currency: string;
    rentalPeriod?: RentalPeriod | null;
    assignedMembershipId?: UUIDString | null;
    assignedMembership?: {
      email: string;
      userProfile?: {
        displayName: string;
      };
    };
    listingStatus: ListingStatus;
    publicationStatus: ListingPublicationStatus;
    advertisingPermitNumber?: string | null;
    permitExpiryDate?: DateString | null;
    permitVerificationUrl?: string | null;
    createdAt: TimestampString;
    updatedAt: TimestampString;
  })[];
  total: ({
    _count: number;
  })[];
}

export interface ListPropertyListingsVariables {
  organizationId: UUIDString;
  propertyId?: UUIDString | null;
  listingStatus?: ListingStatus | null;
  purpose?: ListingPurpose | null;
  marketType?: MarketType | null;
  emirate?: Emirate | null;
  community?: string | null;
  propertyType?: PropertyType | null;
  minimumPriceMinor?: Int64String | null;
  maximumPriceMinor?: Int64String | null;
  limit?: number;
  offset?: number;
  search?: string | null;
  sortUpdated?: boolean;
  sortPriceAsc?: boolean;
  sortPriceDesc?: boolean;
  sortCreated?: boolean;
}

export interface ListPropertyMapPinsData {
  properties: ({
    id: UUIDString;
    propertyReference: string;
    project?: {
      projectName: string;
    };
    building?: {
      name: string;
    };
    unitNumber?: string | null;
    propertyType: PropertyType;
    marketType: MarketType;
    bedrooms?: number | null;
    bathrooms?: number | null;
    builtUpArea?: number | null;
    areaUnit: AreaUnit;
    emirate?: Emirate | null;
    city?: string | null;
    community?: string | null;
    area?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    mapDisplayMode: MapDisplayMode;
    referencePriceMinor?: Int64String | null;
    inventoryStatus: InventoryStatus;
    inventoryMedias_on_property: ({
      id: UUIDString;
    })[];
  })[];
  mapped: ({
    _count: number;
  })[];
  mappedAll: ({
    _count: number;
  })[];
  total: ({
    _count: number;
  })[];
}

export interface ListPropertyMapPinsVariables {
  organizationId: UUIDString;
  projectId?: UUIDString | null;
  developerId?: UUIDString | null;
  buildingId?: UUIDString | null;
  inventoryStatus?: InventoryStatus | null;
  propertyType?: PropertyType | null;
  marketType?: MarketType | null;
  emirate?: Emirate | null;
  community?: string | null;
  bedrooms?: number | null;
  minimumPriceMinor?: Int64String | null;
  maximumPriceMinor?: Int64String | null;
  assignedMembershipId?: UUIDString | null;
  limit?: number;
  offset?: number;
  south?: number | null;
  north?: number | null;
  west?: number | null;
  east?: number | null;
  search?: string | null;
}

export interface ListPublishedPagesForSitemapData {
  publications: ({
    pageSlug: string;
    publishedAt: TimestampString;
    organization: {
      slug: string;
    };
  })[];
}

export interface ListPublishedPagesForSitemapVariables {
  limit: number;
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

export interface ListWebsiteAgentsData {
  agents: ({
    id: UUIDString;
    role: MembershipRole;
    email: string;
    websiteTitle?: string | null;
    websitePhone?: string | null;
    websiteWhatsapp?: string | null;
    userProfile?: {
      displayName: string;
    };
  })[];
}

export interface ListWebsiteAgentsVariables {
  organizationId: UUIDString;
}

export interface ListWebsiteMediaData {
  media: ({
    id: UUIDString;
    fileName: string;
    contentType: string;
    byteSize: number;
    width?: number | null;
    height?: number | null;
    alt: string;
    createdAt: TimestampString;
    createdByUid: string;
    createdBy: {
      displayName: string;
    };
  })[];
  total: ({
    id: UUIDString;
  })[];
}

export interface ListWebsiteMediaVariables {
  organizationId: UUIDString;
  limit?: number;
  offset?: number;
}

export interface ListWebsitePageEnquiriesData {
  enquiries: ({
    id: UUIDString;
    leadId: UUIDString;
    publicationId?: UUIDString | null;
    utmSource?: string | null;
    utmMedium?: string | null;
    utmCampaign?: string | null;
    createdAt: TimestampString;
    lead: {
      id: UUIDString;
      fullName: string;
      status: LeadStatus;
      archivedAt?: TimestampString | null;
    };
  })[];
  total: ({
    count: number;
  })[];
}

export interface ListWebsitePageEnquiriesVariables {
  organizationId: UUIDString;
  pageId: UUIDString;
  limit?: number;
}

export interface ListWebsitePagesData {
  organization?: {
    name: string;
    slug: string;
  };
  websites: ({
    id: UUIDString;
    name: string;
    slug: string;
    designSettings: string;
    allowAgentDrafts: boolean;
    status: WebsiteStatus;
    revision: number;
    updatedAt: TimestampString;
  })[];
  pages: ({
    id: UUIDString;
    websiteId: UUIDString;
    title: string;
    slug: string;
    pageType: WebsitePageType;
    status: WebsitePageStatus;
    designStyle: string;
    sourceProjectId?: UUIDString | null;
    sourcePropertyId?: UUIDString | null;
    sourceListingId?: UUIDString | null;
    revision: number;
    currentVersionNumber: number;
    approvedVersionNumber?: number | null;
    livePublicationId?: UUIDString | null;
    createdAt: TimestampString;
    updatedAt: TimestampString;
    createdByUid: string;
    createdBy: {
      displayName: string;
    };
    updatedBy: {
      displayName: string;
    };
  })[];
  total: ({
    count: number;
  })[];
}

export interface ListWebsitePagesVariables {
  organizationId: UUIDString;
  createdByUid?: string | null;
  statuses: WebsitePageStatus[];
  limit?: number;
  offset?: number;
}

export interface ListWebsiteSectionTemplatesData {
  templates: ({
    id: UUIDString;
    name: string;
    category: string;
    sectionType: string;
    sectionData: string;
    createdByUid: string;
    updatedAt: TimestampString;
    createdBy: {
      displayName: string;
    };
  })[];
}

export interface ListWebsiteSectionTemplatesVariables {
  organizationId: UUIDString;
}

export interface ListingPublication_Key {
  organizationId: UUIDString;
  id: UUIDString;
  __typename?: 'ListingPublication_Key';
}

export interface ListingStatusCountsData {
  statuses: ({
    listingStatus: ListingStatus;
    _count: number;
  })[];
}

export interface ListingStatusCountsVariables {
  organizationId: UUIDString;
}

export interface MarkAutomationScanData {
  automationOrgState_update?: AutomationOrgState_Key | null;
}

export interface MarkAutomationScanVariables {
  organizationId: UUIDString;
  claimToken: UUIDString;
  scannedAt: TimestampString;
}

export interface MarkInAppNotificationReadData {
  updated?: InAppNotification_Key | null;
}

export interface MarkInAppNotificationReadVariables {
  organizationId: UUIDString;
  notificationId: UUIDString;
}

export interface MarkMetaLeadConnectionPolledData {
  metaLeadConnection_update?: MetaLeadConnection_Key | null;
}

export interface MarkMetaLeadConnectionPolledVariables {
  organizationId: UUIDString;
  id: UUIDString;
}

export interface MarkPendingWebsiteEnquiryRecoveredData {
  pending?: PendingWebsiteEnquiry_Key | null;
  audit: AuditLog_Key;
}

export interface MarkPendingWebsiteEnquiryRecoveredVariables {
  organizationId: UUIDString;
  id: UUIDString;
  actorUid: string;
  leadId: UUIDString;
}

export interface Membership_Key {
  organizationId: UUIDString;
  id: UUIDString;
  __typename?: 'Membership_Key';
}

export interface MetaLeadConnectionForPageData {
  connections: ({
    organizationId: UUIDString;
    id: UUIDString;
    pageId: string;
    status: MetaLeadConnectionStatus;
  } & MetaLeadConnection_Key)[];
}

export interface MetaLeadConnectionForPageVariables {
  pageId: string;
}

export interface MetaLeadConnectionSecretData {
  connection?: {
    id: UUIDString;
    pageId: string;
    pageName: string;
    status: MetaLeadConnectionStatus;
    tokenCiphertext?: string | null;
    tokenKeyId?: string | null;
    connectedByUid: string;
  };
}

export interface MetaLeadConnectionSecretVariables {
  organizationId: UUIDString;
  id: UUIDString;
}

export interface MetaLeadConnection_Key {
  organizationId: UUIDString;
  id: UUIDString;
  __typename?: 'MetaLeadConnection_Key';
}

export interface MetaLeadConnectionsDueData {
  connections: ({
    organizationId: UUIDString;
    id: UUIDString;
    lastPolledAt?: TimestampString | null;
  } & MetaLeadConnection_Key)[];
}

export interface MetaLeadConnectionsDueVariables {
  dueBefore: TimestampString;
  limit: number;
}

export interface MetaLeadEventContextData {
  event?: {
    id: UUIDString;
    organizationId: UUIDString;
    connectionId: UUIDString;
    leadgenId: string;
    pageId: string;
    metaFormId?: string | null;
    adId?: string | null;
    adGroupId?: string | null;
    metaCreatedAt?: TimestampString | null;
    origin: string;
    status: MetaLeadEventStatus;
    attempts: number;
    leadId?: UUIDString | null;
  } & MetaLeadEvent_Key;
}

export interface MetaLeadEventContextVariables {
  organizationId: UUIDString;
  eventId: UUIDString;
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

export interface MetaLeadOverviewData {
  actor?: {
    role: MembershipRole;
  };
  connections: ({
    id: UUIDString;
    pageId: string;
    pageName: string;
    status: MetaLeadConnectionStatus;
    lastErrorCode?: string | null;
    lastLeadAt?: TimestampString | null;
    lastPolledAt?: TimestampString | null;
    subscribedAt?: TimestampString | null;
    createdAt: TimestampString;
    connectedBy: {
      displayName: string;
    };
    forms: ({
      id: UUIDString;
      metaFormId: string;
      name: string;
      enabled: boolean;
      lastLeadAt?: TimestampString | null;
    })[];
  })[];
  recentFailures: ({
    id: UUIDString;
    connectionId: UUIDString;
    leadgenId: string;
    status: MetaLeadEventStatus;
    errorCode?: string | null;
    attempts: number;
    receivedAt: TimestampString;
  })[];
}

export interface MetaLeadOverviewVariables {
  organizationId: UUIDString;
  actorUid: string;
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

export interface PauseAutomationWorkflowData {
  workflow?: AutomationWorkflow_Key | null;
  auditLog_insert: AuditLog_Key;
}

export interface PauseAutomationWorkflowForSystemData {
  workflow?: AutomationWorkflow_Key | null;
  auditLog_insert: AuditLog_Key;
}

export interface PauseAutomationWorkflowForSystemVariables {
  organizationId: UUIDString;
  id: UUIDString;
  reason: string;
}

export interface PauseAutomationWorkflowVariables {
  organizationId: UUIDString;
  id: UUIDString;
  expectedRevision: number;
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

export interface PendingMetaLeadEventsData {
  events: ({
    organizationId: UUIDString;
    id: UUIDString;
    attempts: number;
  } & MetaLeadEvent_Key)[];
}

export interface PendingMetaLeadEventsVariables {
  now: TimestampString;
  staleBefore: TimestampString;
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

export interface PublicationAttempt_Key {
  organizationId: UUIDString;
  id: UUIDString;
  __typename?: 'PublicationAttempt_Key';
}

export interface PublishWebsitePageData {
  superseded: number;
  publication: PagePublication_Key;
  page?: WebsitePage_Key | null;
  audit: AuditLog_Key;
}

export interface PublishWebsitePageVariables {
  organizationId: UUIDString;
  pageId: UUIDString;
  actorUid: string;
  publicationId: UUIDString;
  versionId: UUIDString;
  versionNumber: number;
  pageSlug: string;
  expectedRevision: number;
  nextRevision: number;
  currentVersionNumber: number;
  status: WebsitePageStatus;
  snapshot: string;
  sourceFingerprint: string;
  checklist: string;
}

export interface PurgeExpiredRateLimitCountersData {
  rateLimitCounter_deleteMany: number;
}

export interface PurgeExpiredRateLimitCountersVariables {
  before: TimestampString;
}

export interface PurgeMyExpiredAiConversationsData {
  messages: number;
  conversations: number;
}

export interface PurgeMyExpiredAiConversationsVariables {
  organizationId: UUIDString;
  before: TimestampString;
}

export interface QueueManualAutomationRunData {
  event: AutomationEvent_Key;
  auditLog_insert: AuditLog_Key;
}

export interface QueueManualAutomationRunVariables {
  organizationId: UUIDString;
  workflowId: UUIDString;
  eventId: UUIDString;
  leadId?: UUIDString | null;
  hasLead: boolean;
}

export interface RateLimitCounter_Key {
  bucketKey: string;
  __typename?: 'RateLimitCounter_Key';
}

export interface ReconnectMetaLeadConnectionData {
  metaLeadConnection_update?: MetaLeadConnection_Key | null;
  auditLog_insert: AuditLog_Key;
}

export interface ReconnectMetaLeadConnectionVariables {
  organizationId: UUIDString;
  id: UUIDString;
  actorUid: string;
  pageId: string;
  pageName: string;
  tokenCiphertext: string;
  tokenKeyId: string;
}

export interface RecordAiSalesInsightData {
  insight: AiSalesInsight_Key;
}

export interface RecordAiSalesInsightVariables {
  organizationId: UUIDString;
  id: UUIDString;
  kind: AiSalesInsightKind;
  leadId?: UUIDString | null;
  propertyId?: UUIDString | null;
  viewingId?: UUIDString | null;
  assessmentId?: UUIDString | null;
  content: string;
  model: string;
  promptVersion: string;
  createdByUid: string;
}

export interface RecordAiToolExecutionData {
  tool: AiToolExecution_Key;
}

export interface RecordAiToolExecutionVariables {
  organizationId: UUIDString;
  usageRecordId: UUIDString;
  toolName: string;
  status: AiToolExecutionStatus;
  errorCode?: string | null;
  resultCount?: number | null;
  durationMs: number;
}

export interface RecordAiUsageData {
  usage: AiUsageRecord_Key;
}

export interface RecordAiUsageVariables {
  organizationId: UUIDString;
  id: UUIDString;
  userUid: string;
  conversationId?: UUIDString | null;
  model: string;
  promptVersion: string;
  status: AiRequestStatus;
  errorCode?: string | null;
  inputTokens: number;
  outputTokens: number;
  cacheReadInputTokens: number;
  cacheCreationInputTokens: number;
  estimatedCostUsd?: number | null;
  modelRequests: number;
  toolCalls: number;
  durationMs: number;
  feature?: string | null;
  contentType?: string | null;
}

export interface RecordAutomationStepData {
  step: AutomationExecutionStep_Key;
}

export interface RecordAutomationStepVariables {
  organizationId: UUIDString;
  jobId: UUIDString;
  jobToken: UUIDString;
  id: UUIDString;
  executionId: UUIDString;
  position: number;
  actionId: string;
  actionType: string;
  actionSnapshot: string;
  idempotencyKey: string;
}

export interface RecordFeedGenerationJobData {
  job: FeedGenerationJob_Key;
  auditLog_insert: AuditLog_Key;
}

export interface RecordFeedGenerationJobVariables {
  organizationId: UUIDString;
  provider: PortalProvider;
  format: FeedFormat;
  status: FeedGenerationStatus;
  listingCount: number;
  validCount: number;
  invalidCount: number;
  byteSize: number;
  errorSummary?: string | null;
  startedAt: TimestampString;
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

export interface RecordLeadPriorityReviewData {
  review: LeadPriorityReview_Key;
  auditLog_insert: AuditLog_Key;
}

export interface RecordLeadPriorityReviewVariables {
  organizationId: UUIDString;
  leadId: UUIDString;
  assessmentId: UUIDString;
  suggestedPriority: AiLeadPriority;
  reviewedPriority: AiLeadPriority;
  reason: string;
}

export interface RecordLeadQualificationAssessmentData {
  assessment: LeadQualificationAssessment_Key;
}

export interface RecordLeadQualificationAssessmentVariables {
  organizationId: UUIDString;
  id: UUIDString;
  leadId: UUIDString;
  evaluatedByUid: string;
  ruleVersion: string;
  configHash: string;
  score?: number | null;
  priority: AiLeadPriority;
  sufficientData: boolean;
  result: string;
}

export interface RecordListingValidationData {
  publication: ListingPublication_Key;
  attempt: PublicationAttempt_Key;
  auditLog_insert: AuditLog_Key;
}

export interface RecordListingValidationVariables {
  organizationId: UUIDString;
  listingId: UUIDString;
  provider: PortalProvider;
  status: ListingPublicationState;
  errorCount: number;
  warningCount: number;
  payloadHash: string;
  errorSummary?: string | null;
}

export interface RecordMetaLeadEventData {
  event: MetaLeadEvent_Key;
}

export interface RecordMetaLeadEventVariables {
  organizationId: UUIDString;
  connectionId: UUIDString;
  pageId: string;
  leadgenId: string;
  metaFormId?: string | null;
  adId?: string | null;
  adGroupId?: string | null;
  metaCreatedAt?: TimestampString | null;
  origin: string;
}

export interface RecordPendingWebsiteEnquiryAttemptData {
  pending?: PendingWebsiteEnquiry_Key | null;
}

export interface RecordPendingWebsiteEnquiryAttemptVariables {
  organizationId: UUIDString;
  id: UUIDString;
  errorCode: string;
}

export interface RecordPendingWebsiteEnquiryData {
  pending: PendingWebsiteEnquiry_Key;
}

export interface RecordPendingWebsiteEnquiryVariables {
  organizationId: UUIDString;
  pageId?: UUIDString | null;
  publicationId?: UUIDString | null;
  formId: UUIDString;
  idempotencyKeyHash: string;
  payload: string;
  errorCode: string;
}

export interface RecordWebsitePageEnquiryData {
  enquiry: WebsitePageEnquiry_Key;
}

export interface RecordWebsitePageEnquiryVariables {
  organizationId: UUIDString;
  pageId: UUIDString;
  publicationId?: UUIDString | null;
  formId: UUIDString;
  leadId: UUIDString;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
}

export interface RegenerateAiContentDraftData {
  draft?: AiContentDraft_Key | null;
  version: AiContentVersion_Key;
}

export interface RegenerateAiContentDraftVariables {
  organizationId: UUIDString;
  id: UUIDString;
  actorUid: string;
  createdByUid?: string | null;
  expectedRevision: number;
  nextRevision: number;
  versionNumber: number;
  title: string;
  sourceRefs: string;
  contentData: string;
  validation: string;
  model: string;
  generatedAt: TimestampString;
}

export interface RegisterMetaLeadFormData {
  source: LeadSource_Key;
  form: MetaLeadForm_Key;
}

export interface RegisterMetaLeadFormVariables {
  organizationId: UUIDString;
  connectionId: UUIDString;
  metaFormId: string;
  name: string;
  sourceName: string;
  questions?: unknown | null;
  existingSourceId?: UUIDString | null;
  hasExistingSource: boolean;
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

export interface RejectWebsitePageData {
  page?: WebsitePage_Key | null;
  audit: AuditLog_Key;
}

export interface RejectWebsitePageVariables {
  organizationId: UUIDString;
  id: UUIDString;
  note: string;
  expectedRevision: number;
  nextRevision: number;
}

export interface ReleaseAiRequestData {
  counter?: unknown | null;
}

export interface ReleaseAiRequestVariables {
  organizationId: UUIDString;
  periodKey: string;
  subjectKey: string;
}

export interface ReleaseAutomationOrganizationData {
  automationOrgState_update?: AutomationOrgState_Key | null;
}

export interface ReleaseAutomationOrganizationVariables {
  organizationId: UUIDString;
  claimToken: UUIDString;
}

export interface RemovePageLeadFormBindingData {
  binding?: PageLeadFormBinding_Key | null;
  audit: AuditLog_Key;
}

export interface RemovePageLeadFormBindingVariables {
  organizationId: UUIDString;
  pageId: UUIDString;
}

export interface RemovePaymentPlanInstallmentData {
  paymentPlan_update?: PaymentPlan_Key | null;
  paymentPlanInstallment_deleteMany: number;
  activity_insert: Activity_Key;
  auditLog_insert: AuditLog_Key;
}

export interface RemovePaymentPlanInstallmentVariables {
  organizationId: UUIDString;
  paymentPlanId: UUIDString;
  id: UUIDString;
  expectedTotalBps: number;
  newTotalBps: number;
}

export interface RemovePortalFieldMappingData {
  portalFieldMapping_deleteMany: number;
  auditLog_insert: AuditLog_Key;
}

export interface RemovePortalFieldMappingVariables {
  organizationId: UUIDString;
  id: UUIDString;
}

export interface RequestAutomationApprovalData {
  approval: AutomationApproval_Key;
  step?: AutomationExecutionStep_Key | null;
  execution?: AutomationExecution_Key | null;
  job?: ScheduledAutomationJob_Key | null;
  inAppNotification_insert: InAppNotification_Key;
  auditLog_insert: AuditLog_Key;
}

export interface RequestAutomationApprovalVariables {
  organizationId: UUIDString;
  jobId: UUIDString;
  jobToken: UUIDString;
  executionId: UUIDString;
  stepId: UUIDString;
  approvalId: UUIDString;
  notificationId: UUIDString;
  workflowId: UUIDString;
  actionId: string;
  actionType: string;
  risk: string;
  targetType: string;
  targetId?: UUIDString | null;
  leadId?: UUIDString | null;
  fromMembershipId?: UUIDString | null;
  toMembershipId?: UUIDString | null;
  requestedByUid: string;
  snapshot: string;
  snapshotHash: string;
  targetStateHash: string;
  expiresAt: TimestampString;
  title: string;
  body: string;
}

export interface ReserveAiRequestData {
  counter?: unknown | null;
}

export interface ReserveAiRequestVariables {
  organizationId: UUIDString;
  periodKey: string;
  subjectKey: string;
  limit: number;
}

export interface ReserveAutomationAiCallData {
  automationOrgState_update?: AutomationOrgState_Key | null;
}

export interface ReserveAutomationAiCallVariables {
  organizationId: UUIDString;
  jobId: UUIDString;
  jobToken: UUIDString;
  periodKey: string;
  dailyLimit: number;
}

export interface ResolvePublishedPageData {
  publications: ({
    id: UUIDString;
    organizationId: UUIDString;
    pageId: UUIDString;
    versionNumber: number;
    pageSlug: string;
    snapshot: string;
    publishedAt: TimestampString;
    organization: {
      id: UUIDString;
      name: string;
      slug: string;
    } & Organization_Key;
  } & PagePublication_Key)[];
}

export interface ResolvePublishedPageVariables {
  companySlug: string;
  pageSlug: string;
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

export interface RetryAutomationStepData {
  automationExecutionStep_update?: AutomationExecutionStep_Key | null;
}

export interface RetryAutomationStepVariables {
  organizationId: UUIDString;
  jobId: UUIDString;
  jobToken: UUIDString;
  id: UUIDString;
}

export interface ReturnAutomationWorkflowToDraftData {
  workflow?: AutomationWorkflow_Key | null;
  auditLog_insert: AuditLog_Key;
}

export interface ReturnAutomationWorkflowToDraftVariables {
  organizationId: UUIDString;
  id: UUIDString;
  expectedRevision: number;
  note: string;
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

export interface SaveAiContentDraftData {
  draft?: AiContentDraft_Key | null;
  version: AiContentVersion_Key;
}

export interface SaveAiContentDraftVariables {
  organizationId: UUIDString;
  id: UUIDString;
  createdByUid?: string | null;
  expectedRevision: number;
  nextRevision: number;
  versionNumber: number;
  kind: AiContentVersionKind;
  status: AiContentDraftStatus;
  title: string;
  contentData: string;
  validation: string;
}

export interface SaveAutomationWorkflowData {
  workflow?: AutomationWorkflow_Key | null;
  version: AutomationWorkflowVersion_Key;
  auditLog_insert: AuditLog_Key;
}

export interface SaveAutomationWorkflowVariables {
  organizationId: UUIDString;
  id: UUIDString;
  versionId: UUIDString;
  expectedRevision: number;
  versionNumber: number;
  name: string;
  description: string;
  triggerType: string;
  definitionJson: string;
  definitionHash: string;
  hasApprovalSteps: boolean;
  timeZone: string;
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

export interface SaveLeadPropertyInterestData {
  lead?: Lead_Key | null;
  interest: LeadPropertyInterest_Key;
  activity_insert: Activity_Key;
  auditLog_insert: AuditLog_Key;
}

export interface SaveLeadPropertyInterestVariables {
  organizationId: UUIDString;
  leadId: UUIDString;
  propertyId: UUIDString;
  status: LeadPropertyInterestStatus;
  notes?: string | null;
  expectedUpdatedAt?: TimestampString | null;
}

export interface SavePortalConnectionData {
  connection: OrganizationPortalConnection_Key;
  auditLog_insert: AuditLog_Key;
}

export interface SavePortalConnectionVariables {
  organizationId: UUIDString;
  provider: PortalProvider;
  status: PortalConnectionStatus;
  accountReference?: string | null;
  notes?: string | null;
  expectedUpdatedAt?: TimestampString | null;
}

export interface SaveWebsitePageVersionData {
  page?: WebsitePage_Key | null;
  version: PageVersion_Key;
}

export interface SaveWebsitePageVersionVariables {
  organizationId: UUIDString;
  id: UUIDString;
  createdByUid?: string | null;
  expectedRevision: number;
  nextRevision: number;
  versionNumber: number;
  kind: PageVersionKind;
  title: string;
  slug: string;
  description?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  designStyle: string;
  structuredPageData: string;
  validation?: string | null;
}

export interface ScheduleLeadFollowUpData {
  lead?: Lead_Key | null;
  leadFollowUp_updateMany: number;
  followUp: LeadFollowUp_Key;
  activity: Activity_Key;
  auditLog_insert: AuditLog_Key;
  taskEvent: AutomationEvent_Key;
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

export interface ScheduleLeadPropertyViewingData {
  lead?: Lead_Key | null;
  viewing: LeadPropertyViewing_Key;
  activity_insert: Activity_Key;
  auditLog_insert: AuditLog_Key;
  viewingEvent: AutomationEvent_Key;
}

export interface ScheduleLeadPropertyViewingVariables {
  organizationId: UUIDString;
  leadId: UUIDString;
  propertyId: UUIDString;
  scheduledAt: TimestampString;
  notes?: string | null;
  assignedMembershipId: UUIDString;
  customerConfirmation?: LeadPropertyViewingConfirmation;
}

export interface ScheduledAutomationJob_Key {
  organizationId: UUIDString;
  id: UUIDString;
  __typename?: 'ScheduledAutomationJob_Key';
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

export interface SetAiContentDraftStatusData {
  draft?: AiContentDraft_Key | null;
  auditLog_insert: AuditLog_Key;
}

export interface SetAiContentDraftStatusVariables {
  organizationId: UUIDString;
  id: UUIDString;
  createdByUid?: string | null;
  expectedRevision: number;
  nextRevision: number;
  status: AiContentDraftStatus;
}

export interface SetAutomationWorkflowNextRunData {
  automationWorkflow_update?: AutomationWorkflow_Key | null;
}

export interface SetAutomationWorkflowNextRunVariables {
  organizationId: UUIDString;
  claimToken: UUIDString;
  id: UUIDString;
  expectedNextRunAt: TimestampString;
  nextRunAt?: TimestampString | null;
}

export interface SetInventoryAmenityActiveData {
  inventoryAmenity_update?: InventoryAmenity_Key | null;
  activity_insert: Activity_Key;
  auditLog_insert: AuditLog_Key;
}

export interface SetInventoryAmenityActiveVariables {
  organizationId: UUIDString;
  id: UUIDString;
  isActive: boolean;
}

export interface SetInventoryMediaStatusData {
  inventoryMedia_update?: InventoryMedia_Key | null;
  auditLog_insert: AuditLog_Key;
}

export interface SetInventoryMediaStatusVariables {
  organizationId: UUIDString;
  id: UUIDString;
  expectedStatus: InventoryMediaStatus;
  status: InventoryMediaStatus;
}

export interface SetLeadPrimaryInterestData {
  lead?: Lead_Key | null;
  activity_insert: Activity_Key;
  auditLog_insert: AuditLog_Key;
}

export interface SetLeadPrimaryInterestVariables {
  organizationId: UUIDString;
  leadId: UUIDString;
  projectId?: UUIDString | null;
  propertyId?: UUIDString | null;
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

export interface SetMetaLeadConnectionStatusData {
  metaLeadConnection_update?: MetaLeadConnection_Key | null;
}

export interface SetMetaLeadConnectionStatusVariables {
  organizationId: UUIDString;
  id: UUIDString;
  status: MetaLeadConnectionStatus;
  errorCode?: string | null;
}

export interface SetMetaLeadEventOutcomeData {
  metaLeadEvent_updateMany: number;
}

export interface SetMetaLeadEventOutcomeVariables {
  organizationId: UUIDString;
  id: UUIDString;
  status: MetaLeadEventStatus;
  errorCode?: string | null;
  nextAttemptAt?: TimestampString | null;
}

export interface SetPageLeadFormBindingData {
  binding: PageLeadFormBinding_Key;
  audit: AuditLog_Key;
}

export interface SetPageLeadFormBindingVariables {
  organizationId: UUIDString;
  pageId: UUIDString;
  formId: UUIDString;
}

export interface SetPaymentPlanActiveData {
  paymentPlan_update?: PaymentPlan_Key | null;
  activity_insert: Activity_Key;
  auditLog_insert: AuditLog_Key;
}

export interface SetPaymentPlanActiveVariables {
  organizationId: UUIDString;
  id: UUIDString;
  expectedInstallmentTotalBps: number;
  isActive: boolean;
}

export interface SetPortalFieldMappingData {
  mapping: PortalFieldMapping_Key;
  auditLog_insert: AuditLog_Key;
}

export interface SetPortalFieldMappingVariables {
  organizationId: UUIDString;
  provider: PortalProvider;
  fieldKey: string;
  sourceValue: string;
  targetValue: string;
}

export interface SetPropertyListingStatusData {
  propertyListing_update?: PropertyListing_Key | null;
  activity_insert: Activity_Key;
  auditLog_insert: AuditLog_Key;
  listingEvent: AutomationEvent_Key;
}

export interface SetPropertyListingStatusVariables {
  organizationId: UUIDString;
  id: UUIDString;
  expectedStatus: ListingStatus;
  status: ListingStatus;
}

export interface SetPropertyMediaCoverData {
  clearCovers: number;
  inventoryMedia_update?: InventoryMedia_Key | null;
  auditLog_insert: AuditLog_Key;
}

export interface SetPropertyMediaCoverVariables {
  organizationId: UUIDString;
  propertyId: UUIDString;
  id: UUIDString;
  sortOrder: number;
}

export interface SetWebsiteMediaUploadStatusData {
  media?: WebsiteMedia_Key | null;
  auditLog_insert: AuditLog_Key;
}

export interface SetWebsiteMediaUploadStatusVariables {
  organizationId: UUIDString;
  id: UUIDString;
  status: WebsiteMediaStatus;
  actorUid: string;
}

export interface SettleAutomationExecutionData {
  execution?: AutomationExecution_Key | null;
  job?: ScheduledAutomationJob_Key | null;
}

export interface SettleAutomationExecutionVariables {
  organizationId: UUIDString;
  jobId: UUIDString;
  jobToken: UUIDString;
  executionId: UUIDString;
  nextStep: number;
  executionStatus: AutomationExecutionStatus;
  executionErrorCode?: string | null;
  jobStatus: AutomationJobStatus;
  runAt: TimestampString;
  completedAt?: TimestampString | null;
  durationMs?: number | null;
}

export interface StartAutomationExecutionData {
  automationOrgState_update?: AutomationOrgState_Key | null;
  execution: AutomationExecution_Key;
  job: ScheduledAutomationJob_Key;
}

export interface StartAutomationExecutionVariables {
  organizationId: UUIDString;
  claimToken: UUIDString;
  executionId: UUIDString;
  jobId: UUIDString;
  workflowId: UUIDString;
  workflowVersionId: UUIDString;
  eventId: UUIDString;
  triggerType: string;
  targetType: string;
  targetId?: UUIDString | null;
  leadId?: UUIDString | null;
  chainDepth: number;
  executorUid: string;
  periodKey: string;
  dailyLimit: number;
}

export interface SubmitAutomationWorkflowData {
  workflow?: AutomationWorkflow_Key | null;
  auditLog_insert: AuditLog_Key;
}

export interface SubmitAutomationWorkflowVariables {
  organizationId: UUIDString;
  id: UUIDString;
  expectedRevision: number;
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
  leadCreatedEvent: AutomationEvent_Key;
  formEvent: AutomationEvent_Key;
  leadAssignedEvent: AutomationEvent_Key;
  inboxConversation: InboxConversation_Key;
  inboxMessage: InboxMessage_Key;
  inboxCreatedEvent: AutomationEvent_Key;
  inboxReceivedEvent: AutomationEvent_Key;
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
  inboxPreview?: string;
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

export interface SubmitWebsitePageForReviewData {
  page?: WebsitePage_Key | null;
  audit: AuditLog_Key;
}

export interface SubmitWebsitePageForReviewVariables {
  organizationId: UUIDString;
  id: UUIDString;
  createdByUid?: string | null;
  expectedRevision: number;
  nextRevision: number;
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
  leadUnassignedEvent: AutomationEvent_Key;
}

export interface UnassignLeadVariables {
  organizationId: UUIDString;
  leadId: UUIDString;
  expectedAssignedMembershipId?: UUIDString | null;
  expectedWasUnassigned: boolean;
  reason?: string;
  overrideClosed?: boolean;
}

export interface UnpublishWebsitePageData {
  page?: WebsitePage_Key | null;
  publication?: PagePublication_Key | null;
  audit: AuditLog_Key;
}

export interface UnpublishWebsitePageVariables {
  organizationId: UUIDString;
  id: UUIDString;
  publicationId: UUIDString;
  expectedRevision: number;
  nextRevision: number;
}

export interface UpdateAiBrandProfileData {
  profile?: AiBrandProfile_Key | null;
  auditLog_insert: AuditLog_Key;
}

export interface UpdateAiBrandProfileVariables {
  organizationId: UUIDString;
  expectedRevision: number;
  nextRevision: number;
  displayName?: string | null;
  logoReference?: string | null;
  brandTone?: string | null;
  preferredLanguage: AiContentLanguage;
  useCompanyPhone: boolean;
  useCompanyEmail: boolean;
  website?: string | null;
  whatsappNumber?: string | null;
  defaultCallToAction?: string | null;
  tagline?: string | null;
  marketingDisclaimer?: string | null;
  officeAddress?: string | null;
  officeHours?: string | null;
}

export interface UpdateAiContentTemplateData {
  template?: AiContentTemplate_Key | null;
  auditLog_insert: AuditLog_Key;
}

export interface UpdateAiContentTemplateVariables {
  organizationId: UUIDString;
  id: UUIDString;
  expectedRevision: number;
  nextRevision: number;
  name: string;
  contentType: AiContentType;
  purpose?: string | null;
  instructions: string;
  tone?: string | null;
  language?: AiContentLanguage | null;
  isActive: boolean;
}

export interface UpdateBuildingData {
  building_update?: Building_Key | null;
  activity_insert: Activity_Key;
  auditLog_insert: AuditLog_Key;
}

export interface UpdateBuildingVariables {
  organizationId: UUIDString;
  id: UUIDString;
  projectId: UUIDString;
  phaseId?: UUIDString | null;
  name: string;
  reference?: string | null;
  floors?: number | null;
  buildingType: BuildingType;
  status: CompletionStatus;
  handoverDate?: DateString | null;
  latitude?: number | null;
  longitude?: number | null;
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

export interface UpdateDeveloperData {
  developer_update?: Developer_Key | null;
  activity_insert: Activity_Key;
  auditLog_insert: AuditLog_Key;
}

export interface UpdateDeveloperVariables {
  organizationId: UUIDString;
  id: UUIDString;
  name: string;
  slug: string;
  logoReference?: string | null;
  description?: string | null;
  website?: string | null;
  email?: string | null;
  phone?: string | null;
  country: string;
  headOfficeAddress?: string | null;
  headOfficeLatitude?: number | null;
  headOfficeLongitude?: number | null;
  headOfficeGooglePlaceId?: string | null;
  status: DeveloperStatus;
}

export interface UpdateFloorPlanData {
  floorPlan_update?: FloorPlan_Key | null;
  activity_insert: Activity_Key;
  auditLog_insert: AuditLog_Key;
}

export interface UpdateFloorPlanVariables {
  organizationId: UUIDString;
  id: UUIDString;
  projectId: UUIDString;
  propertyId?: UUIDString | null;
  buildingId?: UUIDString | null;
  name: string;
  propertyType: PropertyType;
  bedrooms?: number | null;
  builtUpArea?: number | null;
  plotArea?: number | null;
  areaUnit: AreaUnit;
  mediaReference?: string | null;
}

export interface UpdateInventoryMediaOrderData {
  inventoryMedia_update?: InventoryMedia_Key | null;
  auditLog_insert: AuditLog_Key;
}

export interface UpdateInventoryMediaOrderVariables {
  organizationId: UUIDString;
  id: UUIDString;
  sortOrder: number;
  isCover: boolean;
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

export interface UpdateLeadPropertyViewingData {
  lead?: Lead_Key | null;
  leadWithFollowUp?: Lead_Key | null;
  followUp: LeadFollowUp_Key;
  viewing?: LeadPropertyViewing_Key | null;
  viewingFollowUp?: LeadPropertyViewing_Key | null;
  activity_insert: Activity_Key;
  auditLog_insert: AuditLog_Key;
  followUpActivity: Activity_Key;
  followUpAudit: AuditLog_Key;
  viewingEvent: AutomationEvent_Key;
}

export interface UpdateLeadPropertyViewingVariables {
  organizationId: UUIDString;
  leadId: UUIDString;
  viewingId: UUIDString;
  status: LeadPropertyViewingStatus;
  notes?: string | null;
  expectedUpdatedAt: TimestampString;
  assignedMembershipId: UUIDString;
  customerConfirmation: LeadPropertyViewingConfirmation;
  outcome?: LeadPropertyViewingOutcome | null;
  followUpAt?: TimestampString | null;
  followUpTitle?: string | null;
  hasFollowUp?: boolean;
  completed?: boolean;
}

export interface UpdateLeadQualificationDetailsData {
  details?: LeadQualificationDetails_Key | null;
  activity_insert: Activity_Key;
  auditLog_insert: AuditLog_Key;
}

export interface UpdateLeadQualificationDetailsVariables {
  organizationId: UUIDString;
  leadId: UUIDString;
  expectedRevision: number;
  nextRevision: number;
  timeline?: LeadTimeline | null;
  readiness?: LeadReadiness | null;
}

export interface UpdateLeadVariables {
  organizationId: UUIDString;
  leadId?: UUIDString | null;
  fullName: string;
  email?: string | null;
  phone?: string | null;
  normalizedPhone?: string | null;
  alternatePhone?: string | null;
  normalizedAlternatePhone?: string | null;
  nationality?: string | null;
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

export interface UpdatePaymentPlanData {
  paymentPlan_update?: PaymentPlan_Key | null;
  activity_insert: Activity_Key;
  auditLog_insert: AuditLog_Key;
}

export interface UpdatePaymentPlanInstallmentData {
  paymentPlan_update?: PaymentPlan_Key | null;
  paymentPlanInstallment_update?: PaymentPlanInstallment_Key | null;
  activity_insert: Activity_Key;
  auditLog_insert: AuditLog_Key;
}

export interface UpdatePaymentPlanInstallmentVariables {
  organizationId: UUIDString;
  paymentPlanId: UUIDString;
  id: UUIDString;
  expectedTotalBps: number;
  newTotalBps: number;
  position: number;
  percentageBps: number;
  dueTrigger: PaymentDueTrigger;
  constructionMilestonePercent?: number | null;
  postHandoverMonths?: number | null;
  description?: string | null;
}

export interface UpdatePaymentPlanVariables {
  organizationId: UUIDString;
  id: UUIDString;
  projectId: UUIDString;
  propertyId?: UUIDString | null;
  name: string;
  bookingPercentageBps: number;
  handoverPercentageBps: number;
  expectedBookingPercentageBps: number;
  expectedHandoverPercentageBps: number;
  expectedInstallmentTotalBps: number;
}

export interface UpdateProjectData {
  project_update?: Project_Key | null;
  activity_insert: Activity_Key;
  auditLog_insert: AuditLog_Key;
}

export interface UpdateProjectPhaseData {
  projectPhase_update?: ProjectPhase_Key | null;
  activity_insert: Activity_Key;
  auditLog_insert: AuditLog_Key;
}

export interface UpdateProjectPhaseVariables {
  organizationId: UUIDString;
  projectId: UUIDString;
  id: UUIDString;
  name: string;
  reference?: string | null;
  description?: string | null;
  status: CompletionStatus;
  expectedHandoverDate?: DateString | null;
  actualHandoverDate?: DateString | null;
}

export interface UpdateProjectVariables {
  organizationId: UUIDString;
  id: UUIDString;
  developerId: UUIDString;
  projectName: string;
  projectCode: string;
  description?: string | null;
  projectType: ProjectType;
  ownershipType?: OwnershipType | null;
  community?: string | null;
  area?: string | null;
  emirate?: Emirate | null;
  country: string;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  city?: string | null;
  googlePlaceId?: string | null;
  mapDisplayMode?: MapDisplayMode | null;
  launchDate?: DateString | null;
  expectedHandoverDate?: DateString | null;
  actualHandoverDate?: DateString | null;
  constructionStatus: ConstructionStatus;
  projectStatus: ProjectStatus;
  startingPriceMinor?: Int64String | null;
  currency: string;
  totalUnits?: number | null;
  marketingDescription?: string | null;
  brochureReference?: string | null;
  permitNumber?: string | null;
  permitExpiryDate?: DateString | null;
  permitReferenceUrl?: string | null;
}

export interface UpdatePropertyData {
  property_update?: Property_Key | null;
  activity_insert: Activity_Key;
  auditLog_insert: AuditLog_Key;
}

export interface UpdatePropertyFeatureData {
  propertyFeature_update?: PropertyFeature_Key | null;
  activity_insert: Activity_Key;
  auditLog_insert: AuditLog_Key;
}

export interface UpdatePropertyFeatureVariables {
  organizationId: UUIDString;
  id: UUIDString;
  valueType: FeatureValueType;
  textValue?: string | null;
  numberValue?: number | null;
  booleanValue?: boolean | null;
  unit?: string | null;
}

export interface UpdatePropertyListingData {
  propertyListing_update?: PropertyListing_Key | null;
  activity_insert: Activity_Key;
  auditLog_insert: AuditLog_Key;
}

export interface UpdatePropertyListingVariables {
  organizationId: UUIDString;
  id: UUIDString;
  expectedListingStatus: ListingStatus;
  propertyId: UUIDString;
  listingReference: string;
  listingPurpose: ListingPurpose;
  marketType: MarketType;
  title: string;
  description?: string | null;
  askingPriceMinor: Int64String;
  currency: string;
  rentalPeriod?: RentalPeriod | null;
  assignedMembershipId?: UUIDString | null;
  listingStatus: ListingStatus;
  publicationStatus: ListingPublicationStatus;
  advertisingPermitNumber?: string | null;
  permitExpiryDate?: DateString | null;
  permitVerificationUrl?: string | null;
}

export interface UpdatePropertyVariables {
  organizationId: UUIDString;
  id: UUIDString;
  expectedInventoryStatus: InventoryStatus;
  propertyReference: string;
  projectId?: UUIDString | null;
  buildingId?: UUIDString | null;
  unitNumber?: string | null;
  propertyType: PropertyType;
  marketType: MarketType;
  bedrooms?: number | null;
  bathrooms?: number | null;
  floorNumber?: number | null;
  builtUpArea?: number | null;
  plotArea?: number | null;
  areaUnit: AreaUnit;
  furnishedStatus?: FurnishedStatus | null;
  parkingSpaces?: number | null;
  view?: string | null;
  emirate?: Emirate | null;
  community?: string | null;
  area?: string | null;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  city?: string | null;
  googlePlaceId?: string | null;
  mapDisplayMode?: MapDisplayMode | null;
  referencePriceMinor?: Int64String | null;
  internalNotes?: string | null;
  ownershipReference?: string | null;
  mandateReference?: string | null;
  assignedMembershipId?: UUIDString | null;
  occupancyStatus: OccupancyStatus;
  inventoryStatus: InventoryStatus;
}

export interface UpdateWebsiteAgentCardData {
  membership_update?: Membership_Key | null;
  auditLog_insert: AuditLog_Key;
}

export interface UpdateWebsiteAgentCardVariables {
  organizationId: UUIDString;
  membershipId: UUIDString;
  websiteTitle?: string | null;
  websitePhone?: string | null;
  websiteWhatsapp?: string | null;
}

export interface UpdateWebsiteMediaAltData {
  websiteMedia_update?: WebsiteMedia_Key | null;
  auditLog_insert: AuditLog_Key;
}

export interface UpdateWebsiteMediaAltVariables {
  organizationId: UUIDString;
  id: UUIDString;
  alt: string;
}

export interface UpdateWebsiteSettingsData {
  website?: Website_Key | null;
  audit: AuditLog_Key;
}

export interface UpdateWebsiteSettingsVariables {
  organizationId: UUIDString;
  id: UUIDString;
  name: string;
  designSettings: string;
  allowAgentDrafts: boolean;
  expectedRevision: number;
  nextRevision: number;
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

export interface WorkTask_Key {
  organizationId: UUIDString;
  id: UUIDString;
  __typename?: 'WorkTask_Key';
}

/** Generated Node Admin SDK operation action function for the 'ListAiContentDrafts' Query. Allow users to execute without passing in DataConnect. */
export function listAiContentDrafts(dc: DataConnect, vars: ListAiContentDraftsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListAiContentDraftsData>>;
/** Generated Node Admin SDK operation action function for the 'ListAiContentDrafts' Query. Allow users to pass in custom DataConnect instances. */
export function listAiContentDrafts(vars: ListAiContentDraftsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListAiContentDraftsData>>;

/** Generated Node Admin SDK operation action function for the 'GetAiContentDraft' Query. Allow users to execute without passing in DataConnect. */
export function getAiContentDraft(dc: DataConnect, vars: GetAiContentDraftVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetAiContentDraftData>>;
/** Generated Node Admin SDK operation action function for the 'GetAiContentDraft' Query. Allow users to pass in custom DataConnect instances. */
export function getAiContentDraft(vars: GetAiContentDraftVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetAiContentDraftData>>;

/** Generated Node Admin SDK operation action function for the 'GetAiContentVersion' Query. Allow users to execute without passing in DataConnect. */
export function getAiContentVersion(dc: DataConnect, vars: GetAiContentVersionVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetAiContentVersionData>>;
/** Generated Node Admin SDK operation action function for the 'GetAiContentVersion' Query. Allow users to pass in custom DataConnect instances. */
export function getAiContentVersion(vars: GetAiContentVersionVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetAiContentVersionData>>;

/** Generated Node Admin SDK operation action function for the 'SaveAiContentDraft' Mutation. Allow users to execute without passing in DataConnect. */
export function saveAiContentDraft(dc: DataConnect, vars: SaveAiContentDraftVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<SaveAiContentDraftData>>;
/** Generated Node Admin SDK operation action function for the 'SaveAiContentDraft' Mutation. Allow users to pass in custom DataConnect instances. */
export function saveAiContentDraft(vars: SaveAiContentDraftVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<SaveAiContentDraftData>>;

/** Generated Node Admin SDK operation action function for the 'SetAiContentDraftStatus' Mutation. Allow users to execute without passing in DataConnect. */
export function setAiContentDraftStatus(dc: DataConnect, vars: SetAiContentDraftStatusVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<SetAiContentDraftStatusData>>;
/** Generated Node Admin SDK operation action function for the 'SetAiContentDraftStatus' Mutation. Allow users to pass in custom DataConnect instances. */
export function setAiContentDraftStatus(vars: SetAiContentDraftStatusVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<SetAiContentDraftStatusData>>;

/** Generated Node Admin SDK operation action function for the 'DeleteAiContentDraft' Mutation. Allow users to execute without passing in DataConnect. */
export function deleteAiContentDraft(dc: DataConnect, vars: DeleteAiContentDraftVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<DeleteAiContentDraftData>>;
/** Generated Node Admin SDK operation action function for the 'DeleteAiContentDraft' Mutation. Allow users to pass in custom DataConnect instances. */
export function deleteAiContentDraft(vars: DeleteAiContentDraftVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<DeleteAiContentDraftData>>;

/** Generated Node Admin SDK operation action function for the 'CreateAiContentDraft' Mutation. Allow users to execute without passing in DataConnect. */
export function createAiContentDraft(dc: DataConnect, vars: CreateAiContentDraftVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateAiContentDraftData>>;
/** Generated Node Admin SDK operation action function for the 'CreateAiContentDraft' Mutation. Allow users to pass in custom DataConnect instances. */
export function createAiContentDraft(vars: CreateAiContentDraftVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateAiContentDraftData>>;

/** Generated Node Admin SDK operation action function for the 'RegenerateAiContentDraft' Mutation. Allow users to execute without passing in DataConnect. */
export function regenerateAiContentDraft(dc: DataConnect, vars: RegenerateAiContentDraftVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<RegenerateAiContentDraftData>>;
/** Generated Node Admin SDK operation action function for the 'RegenerateAiContentDraft' Mutation. Allow users to pass in custom DataConnect instances. */
export function regenerateAiContentDraft(vars: RegenerateAiContentDraftVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<RegenerateAiContentDraftData>>;

/** Generated Node Admin SDK operation action function for the 'AddAiContentAlternative' Mutation. Allow users to execute without passing in DataConnect. */
export function addAiContentAlternative(dc: DataConnect, vars: AddAiContentAlternativeVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<AddAiContentAlternativeData>>;
/** Generated Node Admin SDK operation action function for the 'AddAiContentAlternative' Mutation. Allow users to pass in custom DataConnect instances. */
export function addAiContentAlternative(vars: AddAiContentAlternativeVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<AddAiContentAlternativeData>>;

/** Generated Node Admin SDK operation action function for the 'ListAiContentTemplates' Query. Allow users to execute without passing in DataConnect. */
export function listAiContentTemplates(dc: DataConnect, vars: ListAiContentTemplatesVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListAiContentTemplatesData>>;
/** Generated Node Admin SDK operation action function for the 'ListAiContentTemplates' Query. Allow users to pass in custom DataConnect instances. */
export function listAiContentTemplates(vars: ListAiContentTemplatesVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListAiContentTemplatesData>>;

/** Generated Node Admin SDK operation action function for the 'GetAiContentTemplate' Query. Allow users to execute without passing in DataConnect. */
export function getAiContentTemplate(dc: DataConnect, vars: GetAiContentTemplateVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetAiContentTemplateData>>;
/** Generated Node Admin SDK operation action function for the 'GetAiContentTemplate' Query. Allow users to pass in custom DataConnect instances. */
export function getAiContentTemplate(vars: GetAiContentTemplateVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetAiContentTemplateData>>;

/** Generated Node Admin SDK operation action function for the 'CreateAiContentTemplate' Mutation. Allow users to execute without passing in DataConnect. */
export function createAiContentTemplate(dc: DataConnect, vars: CreateAiContentTemplateVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateAiContentTemplateData>>;
/** Generated Node Admin SDK operation action function for the 'CreateAiContentTemplate' Mutation. Allow users to pass in custom DataConnect instances. */
export function createAiContentTemplate(vars: CreateAiContentTemplateVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateAiContentTemplateData>>;

/** Generated Node Admin SDK operation action function for the 'UpdateAiContentTemplate' Mutation. Allow users to execute without passing in DataConnect. */
export function updateAiContentTemplate(dc: DataConnect, vars: UpdateAiContentTemplateVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateAiContentTemplateData>>;
/** Generated Node Admin SDK operation action function for the 'UpdateAiContentTemplate' Mutation. Allow users to pass in custom DataConnect instances. */
export function updateAiContentTemplate(vars: UpdateAiContentTemplateVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateAiContentTemplateData>>;

/** Generated Node Admin SDK operation action function for the 'DeleteAiContentTemplate' Mutation. Allow users to execute without passing in DataConnect. */
export function deleteAiContentTemplate(dc: DataConnect, vars: DeleteAiContentTemplateVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<DeleteAiContentTemplateData>>;
/** Generated Node Admin SDK operation action function for the 'DeleteAiContentTemplate' Mutation. Allow users to pass in custom DataConnect instances. */
export function deleteAiContentTemplate(vars: DeleteAiContentTemplateVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<DeleteAiContentTemplateData>>;

/** Generated Node Admin SDK operation action function for the 'GetAiBrandProfile' Query. Allow users to execute without passing in DataConnect. */
export function getAiBrandProfile(dc: DataConnect, vars: GetAiBrandProfileVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetAiBrandProfileData>>;
/** Generated Node Admin SDK operation action function for the 'GetAiBrandProfile' Query. Allow users to pass in custom DataConnect instances. */
export function getAiBrandProfile(vars: GetAiBrandProfileVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetAiBrandProfileData>>;

/** Generated Node Admin SDK operation action function for the 'CreateAiBrandProfile' Mutation. Allow users to execute without passing in DataConnect. */
export function createAiBrandProfile(dc: DataConnect, vars: CreateAiBrandProfileVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateAiBrandProfileData>>;
/** Generated Node Admin SDK operation action function for the 'CreateAiBrandProfile' Mutation. Allow users to pass in custom DataConnect instances. */
export function createAiBrandProfile(vars: CreateAiBrandProfileVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateAiBrandProfileData>>;

/** Generated Node Admin SDK operation action function for the 'UpdateAiBrandProfile' Mutation. Allow users to execute without passing in DataConnect. */
export function updateAiBrandProfile(dc: DataConnect, vars: UpdateAiBrandProfileVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateAiBrandProfileData>>;
/** Generated Node Admin SDK operation action function for the 'UpdateAiBrandProfile' Mutation. Allow users to pass in custom DataConnect instances. */
export function updateAiBrandProfile(vars: UpdateAiBrandProfileVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateAiBrandProfileData>>;

/** Generated Node Admin SDK operation action function for the 'ListMyAiConversations' Query. Allow users to execute without passing in DataConnect. */
export function listMyAiConversations(dc: DataConnect, vars: ListMyAiConversationsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListMyAiConversationsData>>;
/** Generated Node Admin SDK operation action function for the 'ListMyAiConversations' Query. Allow users to pass in custom DataConnect instances. */
export function listMyAiConversations(vars: ListMyAiConversationsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListMyAiConversationsData>>;

/** Generated Node Admin SDK operation action function for the 'GetMyAiConversation' Query. Allow users to execute without passing in DataConnect. */
export function getMyAiConversation(dc: DataConnect, vars: GetMyAiConversationVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetMyAiConversationData>>;
/** Generated Node Admin SDK operation action function for the 'GetMyAiConversation' Query. Allow users to pass in custom DataConnect instances. */
export function getMyAiConversation(vars: GetMyAiConversationVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetMyAiConversationData>>;

/** Generated Node Admin SDK operation action function for the 'DeleteMyAiConversation' Mutation. Allow users to execute without passing in DataConnect. */
export function deleteMyAiConversation(dc: DataConnect, vars: DeleteMyAiConversationVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<DeleteMyAiConversationData>>;
/** Generated Node Admin SDK operation action function for the 'DeleteMyAiConversation' Mutation. Allow users to pass in custom DataConnect instances. */
export function deleteMyAiConversation(vars: DeleteMyAiConversationVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<DeleteMyAiConversationData>>;

/** Generated Node Admin SDK operation action function for the 'PurgeMyExpiredAiConversations' Mutation. Allow users to execute without passing in DataConnect. */
export function purgeMyExpiredAiConversations(dc: DataConnect, vars: PurgeMyExpiredAiConversationsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<PurgeMyExpiredAiConversationsData>>;
/** Generated Node Admin SDK operation action function for the 'PurgeMyExpiredAiConversations' Mutation. Allow users to pass in custom DataConnect instances. */
export function purgeMyExpiredAiConversations(vars: PurgeMyExpiredAiConversationsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<PurgeMyExpiredAiConversationsData>>;

/** Generated Node Admin SDK operation action function for the 'CreateAiConversationWithExchange' Mutation. Allow users to execute without passing in DataConnect. */
export function createAiConversationWithExchange(dc: DataConnect, vars: CreateAiConversationWithExchangeVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateAiConversationWithExchangeData>>;
/** Generated Node Admin SDK operation action function for the 'CreateAiConversationWithExchange' Mutation. Allow users to pass in custom DataConnect instances. */
export function createAiConversationWithExchange(vars: CreateAiConversationWithExchangeVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateAiConversationWithExchangeData>>;

/** Generated Node Admin SDK operation action function for the 'AppendAiExchange' Mutation. Allow users to execute without passing in DataConnect. */
export function appendAiExchange(dc: DataConnect, vars: AppendAiExchangeVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<AppendAiExchangeData>>;
/** Generated Node Admin SDK operation action function for the 'AppendAiExchange' Mutation. Allow users to pass in custom DataConnect instances. */
export function appendAiExchange(vars: AppendAiExchangeVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<AppendAiExchangeData>>;

/** Generated Node Admin SDK operation action function for the 'RecordAiUsage' Mutation. Allow users to execute without passing in DataConnect. */
export function recordAiUsage(dc: DataConnect, vars: RecordAiUsageVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<RecordAiUsageData>>;
/** Generated Node Admin SDK operation action function for the 'RecordAiUsage' Mutation. Allow users to pass in custom DataConnect instances. */
export function recordAiUsage(vars: RecordAiUsageVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<RecordAiUsageData>>;

/** Generated Node Admin SDK operation action function for the 'RecordAiToolExecution' Mutation. Allow users to execute without passing in DataConnect. */
export function recordAiToolExecution(dc: DataConnect, vars: RecordAiToolExecutionVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<RecordAiToolExecutionData>>;
/** Generated Node Admin SDK operation action function for the 'RecordAiToolExecution' Mutation. Allow users to pass in custom DataConnect instances. */
export function recordAiToolExecution(vars: RecordAiToolExecutionVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<RecordAiToolExecutionData>>;

/** Generated Node Admin SDK operation action function for the 'ReserveAiRequest' Mutation. Allow users to execute without passing in DataConnect. */
export function reserveAiRequest(dc: DataConnect, vars: ReserveAiRequestVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ReserveAiRequestData>>;
/** Generated Node Admin SDK operation action function for the 'ReserveAiRequest' Mutation. Allow users to pass in custom DataConnect instances. */
export function reserveAiRequest(vars: ReserveAiRequestVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ReserveAiRequestData>>;

/** Generated Node Admin SDK operation action function for the 'ReleaseAiRequest' Mutation. Allow users to execute without passing in DataConnect. */
export function releaseAiRequest(dc: DataConnect, vars: ReleaseAiRequestVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ReleaseAiRequestData>>;
/** Generated Node Admin SDK operation action function for the 'ReleaseAiRequest' Mutation. Allow users to pass in custom DataConnect instances. */
export function releaseAiRequest(vars: ReleaseAiRequestVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ReleaseAiRequestData>>;

/** Generated Node Admin SDK operation action function for the 'GetAiUsageCounters' Query. Allow users to execute without passing in DataConnect. */
export function getAiUsageCounters(dc: DataConnect, vars: GetAiUsageCountersVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetAiUsageCountersData>>;
/** Generated Node Admin SDK operation action function for the 'GetAiUsageCounters' Query. Allow users to pass in custom DataConnect instances. */
export function getAiUsageCounters(vars: GetAiUsageCountersVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetAiUsageCountersData>>;

/** Generated Node Admin SDK operation action function for the 'GetLeadSalesIntelligence' Query. Allow users to execute without passing in DataConnect. */
export function getLeadSalesIntelligence(dc: DataConnect, vars: GetLeadSalesIntelligenceVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetLeadSalesIntelligenceData>>;
/** Generated Node Admin SDK operation action function for the 'GetLeadSalesIntelligence' Query. Allow users to pass in custom DataConnect instances. */
export function getLeadSalesIntelligence(vars: GetLeadSalesIntelligenceVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetLeadSalesIntelligenceData>>;

/** Generated Node Admin SDK operation action function for the 'GetAiSalesInsight' Query. Allow users to execute without passing in DataConnect. */
export function getAiSalesInsight(dc: DataConnect, vars: GetAiSalesInsightVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetAiSalesInsightData>>;
/** Generated Node Admin SDK operation action function for the 'GetAiSalesInsight' Query. Allow users to pass in custom DataConnect instances. */
export function getAiSalesInsight(vars: GetAiSalesInsightVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetAiSalesInsightData>>;

/** Generated Node Admin SDK operation action function for the 'ListMyAiSalesSummaries' Query. Allow users to execute without passing in DataConnect. */
export function listMyAiSalesSummaries(dc: DataConnect, vars: ListMyAiSalesSummariesVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListMyAiSalesSummariesData>>;
/** Generated Node Admin SDK operation action function for the 'ListMyAiSalesSummaries' Query. Allow users to pass in custom DataConnect instances. */
export function listMyAiSalesSummaries(vars: ListMyAiSalesSummariesVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListMyAiSalesSummariesData>>;

/** Generated Node Admin SDK operation action function for the 'ListAiSalesAssessments' Query. Allow users to execute without passing in DataConnect. */
export function listAiSalesAssessments(dc: DataConnect, vars: ListAiSalesAssessmentsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListAiSalesAssessmentsData>>;
/** Generated Node Admin SDK operation action function for the 'ListAiSalesAssessments' Query. Allow users to pass in custom DataConnect instances. */
export function listAiSalesAssessments(vars: ListAiSalesAssessmentsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListAiSalesAssessmentsData>>;

/** Generated Node Admin SDK operation action function for the 'ListAiSalesViewings' Query. Allow users to execute without passing in DataConnect. */
export function listAiSalesViewings(dc: DataConnect, vars: ListAiSalesViewingsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListAiSalesViewingsData>>;
/** Generated Node Admin SDK operation action function for the 'ListAiSalesViewings' Query. Allow users to pass in custom DataConnect instances. */
export function listAiSalesViewings(vars: ListAiSalesViewingsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListAiSalesViewingsData>>;

/** Generated Node Admin SDK operation action function for the 'ListAiSalesActivity' Query. Allow users to execute without passing in DataConnect. */
export function listAiSalesActivity(dc: DataConnect, vars: ListAiSalesActivityVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListAiSalesActivityData>>;
/** Generated Node Admin SDK operation action function for the 'ListAiSalesActivity' Query. Allow users to pass in custom DataConnect instances. */
export function listAiSalesActivity(vars: ListAiSalesActivityVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListAiSalesActivityData>>;

/** Generated Node Admin SDK operation action function for the 'CreateLeadQualificationDetails' Mutation. Allow users to execute without passing in DataConnect. */
export function createLeadQualificationDetails(dc: DataConnect, vars: CreateLeadQualificationDetailsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateLeadQualificationDetailsData>>;
/** Generated Node Admin SDK operation action function for the 'CreateLeadQualificationDetails' Mutation. Allow users to pass in custom DataConnect instances. */
export function createLeadQualificationDetails(vars: CreateLeadQualificationDetailsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateLeadQualificationDetailsData>>;

/** Generated Node Admin SDK operation action function for the 'UpdateLeadQualificationDetails' Mutation. Allow users to execute without passing in DataConnect. */
export function updateLeadQualificationDetails(dc: DataConnect, vars: UpdateLeadQualificationDetailsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateLeadQualificationDetailsData>>;
/** Generated Node Admin SDK operation action function for the 'UpdateLeadQualificationDetails' Mutation. Allow users to pass in custom DataConnect instances. */
export function updateLeadQualificationDetails(vars: UpdateLeadQualificationDetailsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateLeadQualificationDetailsData>>;

/** Generated Node Admin SDK operation action function for the 'RecordLeadPriorityReview' Mutation. Allow users to execute without passing in DataConnect. */
export function recordLeadPriorityReview(dc: DataConnect, vars: RecordLeadPriorityReviewVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<RecordLeadPriorityReviewData>>;
/** Generated Node Admin SDK operation action function for the 'RecordLeadPriorityReview' Mutation. Allow users to pass in custom DataConnect instances. */
export function recordLeadPriorityReview(vars: RecordLeadPriorityReviewVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<RecordLeadPriorityReviewData>>;

/** Generated Node Admin SDK operation action function for the 'RecordLeadQualificationAssessment' Mutation. Allow users to execute without passing in DataConnect. */
export function recordLeadQualificationAssessment(dc: DataConnect, vars: RecordLeadQualificationAssessmentVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<RecordLeadQualificationAssessmentData>>;
/** Generated Node Admin SDK operation action function for the 'RecordLeadQualificationAssessment' Mutation. Allow users to pass in custom DataConnect instances. */
export function recordLeadQualificationAssessment(vars: RecordLeadQualificationAssessmentVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<RecordLeadQualificationAssessmentData>>;

/** Generated Node Admin SDK operation action function for the 'RecordAiSalesInsight' Mutation. Allow users to execute without passing in DataConnect. */
export function recordAiSalesInsight(dc: DataConnect, vars: RecordAiSalesInsightVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<RecordAiSalesInsightData>>;
/** Generated Node Admin SDK operation action function for the 'RecordAiSalesInsight' Mutation. Allow users to pass in custom DataConnect instances. */
export function recordAiSalesInsight(vars: RecordAiSalesInsightVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<RecordAiSalesInsightData>>;

/** Generated Node Admin SDK operation action function for the 'RequestAutomationApproval' Mutation. Allow users to execute without passing in DataConnect. */
export function requestAutomationApproval(dc: DataConnect, vars: RequestAutomationApprovalVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<RequestAutomationApprovalData>>;
/** Generated Node Admin SDK operation action function for the 'RequestAutomationApproval' Mutation. Allow users to pass in custom DataConnect instances. */
export function requestAutomationApproval(vars: RequestAutomationApprovalVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<RequestAutomationApprovalData>>;

/** Generated Node Admin SDK operation action function for the 'GetAutomationStepApprovals' Query. Allow users to execute without passing in DataConnect. */
export function getAutomationStepApprovals(dc: DataConnect, vars: GetAutomationStepApprovalsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetAutomationStepApprovalsData>>;
/** Generated Node Admin SDK operation action function for the 'GetAutomationStepApprovals' Query. Allow users to pass in custom DataConnect instances. */
export function getAutomationStepApprovals(vars: GetAutomationStepApprovalsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetAutomationStepApprovalsData>>;

/** Generated Node Admin SDK operation action function for the 'CloseAutomationApproval' Mutation. Allow users to execute without passing in DataConnect. */
export function closeAutomationApproval(dc: DataConnect, vars: CloseAutomationApprovalVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CloseAutomationApprovalData>>;
/** Generated Node Admin SDK operation action function for the 'CloseAutomationApproval' Mutation. Allow users to pass in custom DataConnect instances. */
export function closeAutomationApproval(vars: CloseAutomationApprovalVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CloseAutomationApprovalData>>;

/** Generated Node Admin SDK operation action function for the 'ListAutomationApprovals' Query. Allow users to execute without passing in DataConnect. */
export function listAutomationApprovals(dc: DataConnect, vars: ListAutomationApprovalsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListAutomationApprovalsData>>;
/** Generated Node Admin SDK operation action function for the 'ListAutomationApprovals' Query. Allow users to pass in custom DataConnect instances. */
export function listAutomationApprovals(vars: ListAutomationApprovalsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListAutomationApprovalsData>>;

/** Generated Node Admin SDK operation action function for the 'DecideAutomationApproval' Mutation. Allow users to execute without passing in DataConnect. */
export function decideAutomationApproval(dc: DataConnect, vars: DecideAutomationApprovalVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<DecideAutomationApprovalData>>;
/** Generated Node Admin SDK operation action function for the 'DecideAutomationApproval' Mutation. Allow users to pass in custom DataConnect instances. */
export function decideAutomationApproval(vars: DecideAutomationApprovalVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<DecideAutomationApprovalData>>;

/** Generated Node Admin SDK operation action function for the 'AutomationReassignLead' Mutation. Allow users to execute without passing in DataConnect. */
export function automationReassignLead(dc: DataConnect, vars: AutomationReassignLeadVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<AutomationReassignLeadData>>;
/** Generated Node Admin SDK operation action function for the 'AutomationReassignLead' Mutation. Allow users to pass in custom DataConnect instances. */
export function automationReassignLead(vars: AutomationReassignLeadVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<AutomationReassignLeadData>>;

/** Generated Node Admin SDK operation action function for the 'GetAutomationApprovalTarget' Query. Allow users to execute without passing in DataConnect. */
export function getAutomationApprovalTarget(dc: DataConnect, vars: GetAutomationApprovalTargetVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetAutomationApprovalTargetData>>;
/** Generated Node Admin SDK operation action function for the 'GetAutomationApprovalTarget' Query. Allow users to pass in custom DataConnect instances. */
export function getAutomationApprovalTarget(vars: GetAutomationApprovalTargetVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetAutomationApprovalTargetData>>;

/** Generated Node Admin SDK operation action function for the 'AutomationReassignConversation' Mutation. Allow users to execute without passing in DataConnect. */
export function automationReassignConversation(dc: DataConnect, vars: AutomationReassignConversationVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<AutomationReassignConversationData>>;
/** Generated Node Admin SDK operation action function for the 'AutomationReassignConversation' Mutation. Allow users to pass in custom DataConnect instances. */
export function automationReassignConversation(vars: AutomationReassignConversationVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<AutomationReassignConversationData>>;

/** Generated Node Admin SDK operation action function for the 'ListAutomationWorkflows' Query. Allow users to execute without passing in DataConnect. */
export function listAutomationWorkflows(dc: DataConnect, vars: ListAutomationWorkflowsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListAutomationWorkflowsData>>;
/** Generated Node Admin SDK operation action function for the 'ListAutomationWorkflows' Query. Allow users to pass in custom DataConnect instances. */
export function listAutomationWorkflows(vars: ListAutomationWorkflowsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListAutomationWorkflowsData>>;

/** Generated Node Admin SDK operation action function for the 'GetAutomationWorkflow' Query. Allow users to execute without passing in DataConnect. */
export function getAutomationWorkflow(dc: DataConnect, vars: GetAutomationWorkflowVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetAutomationWorkflowData>>;
/** Generated Node Admin SDK operation action function for the 'GetAutomationWorkflow' Query. Allow users to pass in custom DataConnect instances. */
export function getAutomationWorkflow(vars: GetAutomationWorkflowVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetAutomationWorkflowData>>;

/** Generated Node Admin SDK operation action function for the 'ListAutomationExecutions' Query. Allow users to execute without passing in DataConnect. */
export function listAutomationExecutions(dc: DataConnect, vars: ListAutomationExecutionsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListAutomationExecutionsData>>;
/** Generated Node Admin SDK operation action function for the 'ListAutomationExecutions' Query. Allow users to pass in custom DataConnect instances. */
export function listAutomationExecutions(vars: ListAutomationExecutionsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListAutomationExecutionsData>>;

/** Generated Node Admin SDK operation action function for the 'GetAutomationExecution' Query. Allow users to execute without passing in DataConnect. */
export function getAutomationExecution(dc: DataConnect, vars: GetAutomationExecutionVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetAutomationExecutionData>>;
/** Generated Node Admin SDK operation action function for the 'GetAutomationExecution' Query. Allow users to pass in custom DataConnect instances. */
export function getAutomationExecution(vars: GetAutomationExecutionVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetAutomationExecutionData>>;

/** Generated Node Admin SDK operation action function for the 'AutomationMetrics' Query. Allow users to execute without passing in DataConnect. */
export function automationMetrics(dc: DataConnect, vars: AutomationMetricsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<AutomationMetricsData>>;
/** Generated Node Admin SDK operation action function for the 'AutomationMetrics' Query. Allow users to pass in custom DataConnect instances. */
export function automationMetrics(vars: AutomationMetricsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<AutomationMetricsData>>;

/** Generated Node Admin SDK operation action function for the 'CreateAutomationWorkflow' Mutation. Allow users to execute without passing in DataConnect. */
export function createAutomationWorkflow(dc: DataConnect, vars: CreateAutomationWorkflowVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateAutomationWorkflowData>>;
/** Generated Node Admin SDK operation action function for the 'CreateAutomationWorkflow' Mutation. Allow users to pass in custom DataConnect instances. */
export function createAutomationWorkflow(vars: CreateAutomationWorkflowVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateAutomationWorkflowData>>;

/** Generated Node Admin SDK operation action function for the 'SaveAutomationWorkflow' Mutation. Allow users to execute without passing in DataConnect. */
export function saveAutomationWorkflow(dc: DataConnect, vars: SaveAutomationWorkflowVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<SaveAutomationWorkflowData>>;
/** Generated Node Admin SDK operation action function for the 'SaveAutomationWorkflow' Mutation. Allow users to pass in custom DataConnect instances. */
export function saveAutomationWorkflow(vars: SaveAutomationWorkflowVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<SaveAutomationWorkflowData>>;

/** Generated Node Admin SDK operation action function for the 'SubmitAutomationWorkflow' Mutation. Allow users to execute without passing in DataConnect. */
export function submitAutomationWorkflow(dc: DataConnect, vars: SubmitAutomationWorkflowVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<SubmitAutomationWorkflowData>>;
/** Generated Node Admin SDK operation action function for the 'SubmitAutomationWorkflow' Mutation. Allow users to pass in custom DataConnect instances. */
export function submitAutomationWorkflow(vars: SubmitAutomationWorkflowVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<SubmitAutomationWorkflowData>>;

/** Generated Node Admin SDK operation action function for the 'ReturnAutomationWorkflowToDraft' Mutation. Allow users to execute without passing in DataConnect. */
export function returnAutomationWorkflowToDraft(dc: DataConnect, vars: ReturnAutomationWorkflowToDraftVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ReturnAutomationWorkflowToDraftData>>;
/** Generated Node Admin SDK operation action function for the 'ReturnAutomationWorkflowToDraft' Mutation. Allow users to pass in custom DataConnect instances. */
export function returnAutomationWorkflowToDraft(vars: ReturnAutomationWorkflowToDraftVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ReturnAutomationWorkflowToDraftData>>;

/** Generated Node Admin SDK operation action function for the 'ApproveAutomationWorkflow' Mutation. Allow users to execute without passing in DataConnect. */
export function approveAutomationWorkflow(dc: DataConnect, vars: ApproveAutomationWorkflowVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ApproveAutomationWorkflowData>>;
/** Generated Node Admin SDK operation action function for the 'ApproveAutomationWorkflow' Mutation. Allow users to pass in custom DataConnect instances. */
export function approveAutomationWorkflow(vars: ApproveAutomationWorkflowVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ApproveAutomationWorkflowData>>;

/** Generated Node Admin SDK operation action function for the 'ActivateAutomationWorkflow' Mutation. Allow users to execute without passing in DataConnect. */
export function activateAutomationWorkflow(dc: DataConnect, vars: ActivateAutomationWorkflowVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ActivateAutomationWorkflowData>>;
/** Generated Node Admin SDK operation action function for the 'ActivateAutomationWorkflow' Mutation. Allow users to pass in custom DataConnect instances. */
export function activateAutomationWorkflow(vars: ActivateAutomationWorkflowVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ActivateAutomationWorkflowData>>;

/** Generated Node Admin SDK operation action function for the 'PauseAutomationWorkflow' Mutation. Allow users to execute without passing in DataConnect. */
export function pauseAutomationWorkflow(dc: DataConnect, vars: PauseAutomationWorkflowVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<PauseAutomationWorkflowData>>;
/** Generated Node Admin SDK operation action function for the 'PauseAutomationWorkflow' Mutation. Allow users to pass in custom DataConnect instances. */
export function pauseAutomationWorkflow(vars: PauseAutomationWorkflowVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<PauseAutomationWorkflowData>>;

/** Generated Node Admin SDK operation action function for the 'ArchiveAutomationWorkflow' Mutation. Allow users to execute without passing in DataConnect. */
export function archiveAutomationWorkflow(dc: DataConnect, vars: ArchiveAutomationWorkflowVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ArchiveAutomationWorkflowData>>;
/** Generated Node Admin SDK operation action function for the 'ArchiveAutomationWorkflow' Mutation. Allow users to pass in custom DataConnect instances. */
export function archiveAutomationWorkflow(vars: ArchiveAutomationWorkflowVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ArchiveAutomationWorkflowData>>;

/** Generated Node Admin SDK operation action function for the 'QueueManualAutomationRun' Mutation. Allow users to execute without passing in DataConnect. */
export function queueManualAutomationRun(dc: DataConnect, vars: QueueManualAutomationRunVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<QueueManualAutomationRunData>>;
/** Generated Node Admin SDK operation action function for the 'QueueManualAutomationRun' Mutation. Allow users to pass in custom DataConnect instances. */
export function queueManualAutomationRun(vars: QueueManualAutomationRunVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<QueueManualAutomationRunData>>;

/** Generated Node Admin SDK operation action function for the 'ListAutomationWorkOrganizations' Query. Allow users to execute without passing in DataConnect. */
export function listAutomationWorkOrganizations(dc: DataConnect, vars: ListAutomationWorkOrganizationsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListAutomationWorkOrganizationsData>>;
/** Generated Node Admin SDK operation action function for the 'ListAutomationWorkOrganizations' Query. Allow users to pass in custom DataConnect instances. */
export function listAutomationWorkOrganizations(vars: ListAutomationWorkOrganizationsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListAutomationWorkOrganizationsData>>;

/** Generated Node Admin SDK operation action function for the 'ReserveAutomationAiCall' Mutation. Allow users to execute without passing in DataConnect. */
export function reserveAutomationAiCall(dc: DataConnect, vars: ReserveAutomationAiCallVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ReserveAutomationAiCallData>>;
/** Generated Node Admin SDK operation action function for the 'ReserveAutomationAiCall' Mutation. Allow users to pass in custom DataConnect instances. */
export function reserveAutomationAiCall(vars: ReserveAutomationAiCallVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ReserveAutomationAiCallData>>;

/** Generated Node Admin SDK operation action function for the 'ListAutomationDueTasks' Query. Allow users to execute without passing in DataConnect. */
export function listAutomationDueTasks(dc: DataConnect, vars: ListAutomationDueTasksVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListAutomationDueTasksData>>;
/** Generated Node Admin SDK operation action function for the 'ListAutomationDueTasks' Query. Allow users to pass in custom DataConnect instances. */
export function listAutomationDueTasks(vars: ListAutomationDueTasksVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListAutomationDueTasksData>>;

/** Generated Node Admin SDK operation action function for the 'MarkAutomationScan' Mutation. Allow users to execute without passing in DataConnect. */
export function markAutomationScan(dc: DataConnect, vars: MarkAutomationScanVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<MarkAutomationScanData>>;
/** Generated Node Admin SDK operation action function for the 'MarkAutomationScan' Mutation. Allow users to pass in custom DataConnect instances. */
export function markAutomationScan(vars: MarkAutomationScanVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<MarkAutomationScanData>>;

/** Generated Node Admin SDK operation action function for the 'EnsureAutomationOrgState' Mutation. Allow users to execute without passing in DataConnect. */
export function ensureAutomationOrgState(dc: DataConnect, vars: EnsureAutomationOrgStateVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<EnsureAutomationOrgStateData>>;
/** Generated Node Admin SDK operation action function for the 'EnsureAutomationOrgState' Mutation. Allow users to pass in custom DataConnect instances. */
export function ensureAutomationOrgState(vars: EnsureAutomationOrgStateVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<EnsureAutomationOrgStateData>>;

/** Generated Node Admin SDK operation action function for the 'ClaimAutomationOrganization' Mutation. Allow users to execute without passing in DataConnect. */
export function claimAutomationOrganization(dc: DataConnect, vars: ClaimAutomationOrganizationVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ClaimAutomationOrganizationData>>;
/** Generated Node Admin SDK operation action function for the 'ClaimAutomationOrganization' Mutation. Allow users to pass in custom DataConnect instances. */
export function claimAutomationOrganization(vars: ClaimAutomationOrganizationVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ClaimAutomationOrganizationData>>;

/** Generated Node Admin SDK operation action function for the 'ReleaseAutomationOrganization' Mutation. Allow users to execute without passing in DataConnect. */
export function releaseAutomationOrganization(dc: DataConnect, vars: ReleaseAutomationOrganizationVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ReleaseAutomationOrganizationData>>;
/** Generated Node Admin SDK operation action function for the 'ReleaseAutomationOrganization' Mutation. Allow users to pass in custom DataConnect instances. */
export function releaseAutomationOrganization(vars: ReleaseAutomationOrganizationVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ReleaseAutomationOrganizationData>>;

/** Generated Node Admin SDK operation action function for the 'GetAutomationWork' Query. Allow users to execute without passing in DataConnect. */
export function getAutomationWork(dc: DataConnect, vars: GetAutomationWorkVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetAutomationWorkData>>;
/** Generated Node Admin SDK operation action function for the 'GetAutomationWork' Query. Allow users to pass in custom DataConnect instances. */
export function getAutomationWork(vars: GetAutomationWorkVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetAutomationWorkData>>;

/** Generated Node Admin SDK operation action function for the 'GetAutomationVersions' Query. Allow users to execute without passing in DataConnect. */
export function getAutomationVersions(dc: DataConnect, vars: GetAutomationVersionsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetAutomationVersionsData>>;
/** Generated Node Admin SDK operation action function for the 'GetAutomationVersions' Query. Allow users to pass in custom DataConnect instances. */
export function getAutomationVersions(vars: GetAutomationVersionsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetAutomationVersionsData>>;

/** Generated Node Admin SDK operation action function for the 'StartAutomationExecution' Mutation. Allow users to execute without passing in DataConnect. */
export function startAutomationExecution(dc: DataConnect, vars: StartAutomationExecutionVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<StartAutomationExecutionData>>;
/** Generated Node Admin SDK operation action function for the 'StartAutomationExecution' Mutation. Allow users to pass in custom DataConnect instances. */
export function startAutomationExecution(vars: StartAutomationExecutionVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<StartAutomationExecutionData>>;

/** Generated Node Admin SDK operation action function for the 'FinishAutomationEvent' Mutation. Allow users to execute without passing in DataConnect. */
export function finishAutomationEvent(dc: DataConnect, vars: FinishAutomationEventVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<FinishAutomationEventData>>;
/** Generated Node Admin SDK operation action function for the 'FinishAutomationEvent' Mutation. Allow users to pass in custom DataConnect instances. */
export function finishAutomationEvent(vars: FinishAutomationEventVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<FinishAutomationEventData>>;

/** Generated Node Admin SDK operation action function for the 'InsertAutomationEvent' Mutation. Allow users to execute without passing in DataConnect. */
export function insertAutomationEvent(dc: DataConnect, vars: InsertAutomationEventVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<InsertAutomationEventData>>;
/** Generated Node Admin SDK operation action function for the 'InsertAutomationEvent' Mutation. Allow users to pass in custom DataConnect instances. */
export function insertAutomationEvent(vars: InsertAutomationEventVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<InsertAutomationEventData>>;

/** Generated Node Admin SDK operation action function for the 'ClaimAutomationJob' Mutation. Allow users to execute without passing in DataConnect. */
export function claimAutomationJob(dc: DataConnect, vars: ClaimAutomationJobVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ClaimAutomationJobData>>;
/** Generated Node Admin SDK operation action function for the 'ClaimAutomationJob' Mutation. Allow users to pass in custom DataConnect instances. */
export function claimAutomationJob(vars: ClaimAutomationJobVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ClaimAutomationJobData>>;

/** Generated Node Admin SDK operation action function for the 'GetAutomationExecutionRun' Query. Allow users to execute without passing in DataConnect. */
export function getAutomationExecutionRun(dc: DataConnect, vars: GetAutomationExecutionRunVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetAutomationExecutionRunData>>;
/** Generated Node Admin SDK operation action function for the 'GetAutomationExecutionRun' Query. Allow users to pass in custom DataConnect instances. */
export function getAutomationExecutionRun(vars: GetAutomationExecutionRunVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetAutomationExecutionRunData>>;

/** Generated Node Admin SDK operation action function for the 'BeginAutomationJob' Mutation. Allow users to execute without passing in DataConnect. */
export function beginAutomationJob(dc: DataConnect, vars: BeginAutomationJobVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<BeginAutomationJobData>>;
/** Generated Node Admin SDK operation action function for the 'BeginAutomationJob' Mutation. Allow users to pass in custom DataConnect instances. */
export function beginAutomationJob(vars: BeginAutomationJobVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<BeginAutomationJobData>>;

/** Generated Node Admin SDK operation action function for the 'RecordAutomationStep' Mutation. Allow users to execute without passing in DataConnect. */
export function recordAutomationStep(dc: DataConnect, vars: RecordAutomationStepVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<RecordAutomationStepData>>;
/** Generated Node Admin SDK operation action function for the 'RecordAutomationStep' Mutation. Allow users to pass in custom DataConnect instances. */
export function recordAutomationStep(vars: RecordAutomationStepVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<RecordAutomationStepData>>;

/** Generated Node Admin SDK operation action function for the 'RetryAutomationStep' Mutation. Allow users to execute without passing in DataConnect. */
export function retryAutomationStep(dc: DataConnect, vars: RetryAutomationStepVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<RetryAutomationStepData>>;
/** Generated Node Admin SDK operation action function for the 'RetryAutomationStep' Mutation. Allow users to pass in custom DataConnect instances. */
export function retryAutomationStep(vars: RetryAutomationStepVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<RetryAutomationStepData>>;

/** Generated Node Admin SDK operation action function for the 'FinishAutomationStep' Mutation. Allow users to execute without passing in DataConnect. */
export function finishAutomationStep(dc: DataConnect, vars: FinishAutomationStepVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<FinishAutomationStepData>>;
/** Generated Node Admin SDK operation action function for the 'FinishAutomationStep' Mutation. Allow users to pass in custom DataConnect instances. */
export function finishAutomationStep(vars: FinishAutomationStepVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<FinishAutomationStepData>>;

/** Generated Node Admin SDK operation action function for the 'SettleAutomationExecution' Mutation. Allow users to execute without passing in DataConnect. */
export function settleAutomationExecution(dc: DataConnect, vars: SettleAutomationExecutionVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<SettleAutomationExecutionData>>;
/** Generated Node Admin SDK operation action function for the 'SettleAutomationExecution' Mutation. Allow users to pass in custom DataConnect instances. */
export function settleAutomationExecution(vars: SettleAutomationExecutionVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<SettleAutomationExecutionData>>;

/** Generated Node Admin SDK operation action function for the 'PauseAutomationWorkflowForSystem' Mutation. Allow users to execute without passing in DataConnect. */
export function pauseAutomationWorkflowForSystem(dc: DataConnect, vars: PauseAutomationWorkflowForSystemVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<PauseAutomationWorkflowForSystemData>>;
/** Generated Node Admin SDK operation action function for the 'PauseAutomationWorkflowForSystem' Mutation. Allow users to pass in custom DataConnect instances. */
export function pauseAutomationWorkflowForSystem(vars: PauseAutomationWorkflowForSystemVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<PauseAutomationWorkflowForSystemData>>;

/** Generated Node Admin SDK operation action function for the 'SetAutomationWorkflowNextRun' Mutation. Allow users to execute without passing in DataConnect. */
export function setAutomationWorkflowNextRun(dc: DataConnect, vars: SetAutomationWorkflowNextRunVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<SetAutomationWorkflowNextRunData>>;
/** Generated Node Admin SDK operation action function for the 'SetAutomationWorkflowNextRun' Mutation. Allow users to pass in custom DataConnect instances. */
export function setAutomationWorkflowNextRun(vars: SetAutomationWorkflowNextRunVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<SetAutomationWorkflowNextRunData>>;

/** Generated Node Admin SDK operation action function for the 'AutomationFacts' Query. Allow users to execute without passing in DataConnect. */
export function automationFacts(dc: DataConnect, vars: AutomationFactsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<AutomationFactsData>>;
/** Generated Node Admin SDK operation action function for the 'AutomationFacts' Query. Allow users to pass in custom DataConnect instances. */
export function automationFacts(vars: AutomationFactsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<AutomationFactsData>>;

/** Generated Node Admin SDK operation action function for the 'AutomationRecipients' Query. Allow users to execute without passing in DataConnect. */
export function automationRecipients(dc: DataConnect, vars: AutomationRecipientsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<AutomationRecipientsData>>;
/** Generated Node Admin SDK operation action function for the 'AutomationRecipients' Query. Allow users to pass in custom DataConnect instances. */
export function automationRecipients(vars: AutomationRecipientsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<AutomationRecipientsData>>;

/** Generated Node Admin SDK operation action function for the 'AutomationNotify' Mutation. Allow users to execute without passing in DataConnect. */
export function automationNotify(dc: DataConnect, vars: AutomationNotifyVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<AutomationNotifyData>>;
/** Generated Node Admin SDK operation action function for the 'AutomationNotify' Mutation. Allow users to pass in custom DataConnect instances. */
export function automationNotify(vars: AutomationNotifyVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<AutomationNotifyData>>;

/** Generated Node Admin SDK operation action function for the 'AutomationCreateLeadFollowUp' Mutation. Allow users to execute without passing in DataConnect. */
export function automationCreateLeadFollowUp(dc: DataConnect, vars: AutomationCreateLeadFollowUpVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<AutomationCreateLeadFollowUpData>>;
/** Generated Node Admin SDK operation action function for the 'AutomationCreateLeadFollowUp' Mutation. Allow users to pass in custom DataConnect instances. */
export function automationCreateLeadFollowUp(vars: AutomationCreateLeadFollowUpVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<AutomationCreateLeadFollowUpData>>;

/** Generated Node Admin SDK operation action function for the 'AutomationCreateWorkTask' Mutation. Allow users to execute without passing in DataConnect. */
export function automationCreateWorkTask(dc: DataConnect, vars: AutomationCreateWorkTaskVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<AutomationCreateWorkTaskData>>;
/** Generated Node Admin SDK operation action function for the 'AutomationCreateWorkTask' Mutation. Allow users to pass in custom DataConnect instances. */
export function automationCreateWorkTask(vars: AutomationCreateWorkTaskVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<AutomationCreateWorkTaskData>>;

/** Generated Node Admin SDK operation action function for the 'AutomationAddLeadNote' Mutation. Allow users to execute without passing in DataConnect. */
export function automationAddLeadNote(dc: DataConnect, vars: AutomationAddLeadNoteVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<AutomationAddLeadNoteData>>;
/** Generated Node Admin SDK operation action function for the 'AutomationAddLeadNote' Mutation. Allow users to pass in custom DataConnect instances. */
export function automationAddLeadNote(vars: AutomationAddLeadNoteVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<AutomationAddLeadNoteData>>;

/** Generated Node Admin SDK operation action function for the 'AutomationDistributeLead' Mutation. Allow users to execute without passing in DataConnect. */
export function automationDistributeLead(dc: DataConnect, vars: AutomationDistributeLeadVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<AutomationDistributeLeadData>>;
/** Generated Node Admin SDK operation action function for the 'AutomationDistributeLead' Mutation. Allow users to pass in custom DataConnect instances. */
export function automationDistributeLead(vars: AutomationDistributeLeadVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<AutomationDistributeLeadData>>;

/** Generated Node Admin SDK operation action function for the 'AutomationExecutorProfile' Query. Allow users to execute without passing in DataConnect. */
export function automationExecutorProfile(dc: DataConnect, vars: AutomationExecutorProfileVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<AutomationExecutorProfileData>>;
/** Generated Node Admin SDK operation action function for the 'AutomationExecutorProfile' Query. Allow users to pass in custom DataConnect instances. */
export function automationExecutorProfile(vars: AutomationExecutorProfileVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<AutomationExecutorProfileData>>;

/** Generated Node Admin SDK operation action function for the 'ListAutomationEventsForTarget' Query. Allow users to execute without passing in DataConnect. */
export function listAutomationEventsForTarget(dc: DataConnect, vars: ListAutomationEventsForTargetVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListAutomationEventsForTargetData>>;
/** Generated Node Admin SDK operation action function for the 'ListAutomationEventsForTarget' Query. Allow users to pass in custom DataConnect instances. */
export function listAutomationEventsForTarget(vars: ListAutomationEventsForTargetVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListAutomationEventsForTargetData>>;

/** Generated Node Admin SDK operation action function for the 'ListPropertyMapPins' Query. Allow users to execute without passing in DataConnect. */
export function listPropertyMapPins(dc: DataConnect, vars: ListPropertyMapPinsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListPropertyMapPinsData>>;
/** Generated Node Admin SDK operation action function for the 'ListPropertyMapPins' Query. Allow users to pass in custom DataConnect instances. */
export function listPropertyMapPins(vars: ListPropertyMapPinsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListPropertyMapPinsData>>;

/** Generated Node Admin SDK operation action function for the 'ListPropertyListingMapPins' Query. Allow users to execute without passing in DataConnect. */
export function listPropertyListingMapPins(dc: DataConnect, vars: ListPropertyListingMapPinsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListPropertyListingMapPinsData>>;
/** Generated Node Admin SDK operation action function for the 'ListPropertyListingMapPins' Query. Allow users to pass in custom DataConnect instances. */
export function listPropertyListingMapPins(vars: ListPropertyListingMapPinsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListPropertyListingMapPinsData>>;

/** Generated Node Admin SDK operation action function for the 'ListAssignedPropertyListingMapPins' Query. Allow users to execute without passing in DataConnect. */
export function listAssignedPropertyListingMapPins(dc: DataConnect, vars: ListAssignedPropertyListingMapPinsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListAssignedPropertyListingMapPinsData>>;
/** Generated Node Admin SDK operation action function for the 'ListAssignedPropertyListingMapPins' Query. Allow users to pass in custom DataConnect instances. */
export function listAssignedPropertyListingMapPins(vars: ListAssignedPropertyListingMapPinsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListAssignedPropertyListingMapPinsData>>;

/** Generated Node Admin SDK operation action function for the 'GetInventoryDashboardMetrics' Query. Allow users to execute without passing in DataConnect. */
export function getInventoryDashboardMetrics(dc: DataConnect, vars: GetInventoryDashboardMetricsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetInventoryDashboardMetricsData>>;
/** Generated Node Admin SDK operation action function for the 'GetInventoryDashboardMetrics' Query. Allow users to pass in custom DataConnect instances. */
export function getInventoryDashboardMetrics(vars: GetInventoryDashboardMetricsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetInventoryDashboardMetricsData>>;

/** Generated Node Admin SDK operation action function for the 'CreateDeveloper' Mutation. Allow users to execute without passing in DataConnect. */
export function createDeveloper(dc: DataConnect, vars: CreateDeveloperVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateDeveloperData>>;
/** Generated Node Admin SDK operation action function for the 'CreateDeveloper' Mutation. Allow users to pass in custom DataConnect instances. */
export function createDeveloper(vars: CreateDeveloperVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateDeveloperData>>;

/** Generated Node Admin SDK operation action function for the 'UpdateDeveloper' Mutation. Allow users to execute without passing in DataConnect. */
export function updateDeveloper(dc: DataConnect, vars: UpdateDeveloperVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateDeveloperData>>;
/** Generated Node Admin SDK operation action function for the 'UpdateDeveloper' Mutation. Allow users to pass in custom DataConnect instances. */
export function updateDeveloper(vars: UpdateDeveloperVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateDeveloperData>>;

/** Generated Node Admin SDK operation action function for the 'ArchiveDeveloper' Mutation. Allow users to execute without passing in DataConnect. */
export function archiveDeveloper(dc: DataConnect, vars: ArchiveDeveloperVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ArchiveDeveloperData>>;
/** Generated Node Admin SDK operation action function for the 'ArchiveDeveloper' Mutation. Allow users to pass in custom DataConnect instances. */
export function archiveDeveloper(vars: ArchiveDeveloperVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ArchiveDeveloperData>>;

/** Generated Node Admin SDK operation action function for the 'CreateProject' Mutation. Allow users to execute without passing in DataConnect. */
export function createProject(dc: DataConnect, vars: CreateProjectVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateProjectData>>;
/** Generated Node Admin SDK operation action function for the 'CreateProject' Mutation. Allow users to pass in custom DataConnect instances. */
export function createProject(vars: CreateProjectVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateProjectData>>;

/** Generated Node Admin SDK operation action function for the 'UpdateProject' Mutation. Allow users to execute without passing in DataConnect. */
export function updateProject(dc: DataConnect, vars: UpdateProjectVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateProjectData>>;
/** Generated Node Admin SDK operation action function for the 'UpdateProject' Mutation. Allow users to pass in custom DataConnect instances. */
export function updateProject(vars: UpdateProjectVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateProjectData>>;

/** Generated Node Admin SDK operation action function for the 'ArchiveProject' Mutation. Allow users to execute without passing in DataConnect. */
export function archiveProject(dc: DataConnect, vars: ArchiveProjectVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ArchiveProjectData>>;
/** Generated Node Admin SDK operation action function for the 'ArchiveProject' Mutation. Allow users to pass in custom DataConnect instances. */
export function archiveProject(vars: ArchiveProjectVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ArchiveProjectData>>;

/** Generated Node Admin SDK operation action function for the 'CreateProjectPhase' Mutation. Allow users to execute without passing in DataConnect. */
export function createProjectPhase(dc: DataConnect, vars: CreateProjectPhaseVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateProjectPhaseData>>;
/** Generated Node Admin SDK operation action function for the 'CreateProjectPhase' Mutation. Allow users to pass in custom DataConnect instances. */
export function createProjectPhase(vars: CreateProjectPhaseVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateProjectPhaseData>>;

/** Generated Node Admin SDK operation action function for the 'CreateBuilding' Mutation. Allow users to execute without passing in DataConnect. */
export function createBuilding(dc: DataConnect, vars: CreateBuildingVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateBuildingData>>;
/** Generated Node Admin SDK operation action function for the 'CreateBuilding' Mutation. Allow users to pass in custom DataConnect instances. */
export function createBuilding(vars: CreateBuildingVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateBuildingData>>;

/** Generated Node Admin SDK operation action function for the 'UpdateBuilding' Mutation. Allow users to execute without passing in DataConnect. */
export function updateBuilding(dc: DataConnect, vars: UpdateBuildingVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateBuildingData>>;
/** Generated Node Admin SDK operation action function for the 'UpdateBuilding' Mutation. Allow users to pass in custom DataConnect instances. */
export function updateBuilding(vars: UpdateBuildingVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateBuildingData>>;

/** Generated Node Admin SDK operation action function for the 'ArchiveBuilding' Mutation. Allow users to execute without passing in DataConnect. */
export function archiveBuilding(dc: DataConnect, vars: ArchiveBuildingVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ArchiveBuildingData>>;
/** Generated Node Admin SDK operation action function for the 'ArchiveBuilding' Mutation. Allow users to pass in custom DataConnect instances. */
export function archiveBuilding(vars: ArchiveBuildingVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ArchiveBuildingData>>;

/** Generated Node Admin SDK operation action function for the 'CreateProperty' Mutation. Allow users to execute without passing in DataConnect. */
export function createProperty(dc: DataConnect, vars: CreatePropertyVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreatePropertyData>>;
/** Generated Node Admin SDK operation action function for the 'CreateProperty' Mutation. Allow users to pass in custom DataConnect instances. */
export function createProperty(vars: CreatePropertyVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreatePropertyData>>;

/** Generated Node Admin SDK operation action function for the 'UpdateProperty' Mutation. Allow users to execute without passing in DataConnect. */
export function updateProperty(dc: DataConnect, vars: UpdatePropertyVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdatePropertyData>>;
/** Generated Node Admin SDK operation action function for the 'UpdateProperty' Mutation. Allow users to pass in custom DataConnect instances. */
export function updateProperty(vars: UpdatePropertyVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdatePropertyData>>;

/** Generated Node Admin SDK operation action function for the 'ArchiveProperty' Mutation. Allow users to execute without passing in DataConnect. */
export function archiveProperty(dc: DataConnect, vars: ArchivePropertyVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ArchivePropertyData>>;
/** Generated Node Admin SDK operation action function for the 'ArchiveProperty' Mutation. Allow users to pass in custom DataConnect instances. */
export function archiveProperty(vars: ArchivePropertyVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ArchivePropertyData>>;

/** Generated Node Admin SDK operation action function for the 'CreatePropertyListing' Mutation. Allow users to execute without passing in DataConnect. */
export function createPropertyListing(dc: DataConnect, vars: CreatePropertyListingVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreatePropertyListingData>>;
/** Generated Node Admin SDK operation action function for the 'CreatePropertyListing' Mutation. Allow users to pass in custom DataConnect instances. */
export function createPropertyListing(vars: CreatePropertyListingVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreatePropertyListingData>>;

/** Generated Node Admin SDK operation action function for the 'UpdatePropertyListing' Mutation. Allow users to execute without passing in DataConnect. */
export function updatePropertyListing(dc: DataConnect, vars: UpdatePropertyListingVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdatePropertyListingData>>;
/** Generated Node Admin SDK operation action function for the 'UpdatePropertyListing' Mutation. Allow users to pass in custom DataConnect instances. */
export function updatePropertyListing(vars: UpdatePropertyListingVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdatePropertyListingData>>;

/** Generated Node Admin SDK operation action function for the 'SetPropertyListingStatus' Mutation. Allow users to execute without passing in DataConnect. */
export function setPropertyListingStatus(dc: DataConnect, vars: SetPropertyListingStatusVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<SetPropertyListingStatusData>>;
/** Generated Node Admin SDK operation action function for the 'SetPropertyListingStatus' Mutation. Allow users to pass in custom DataConnect instances. */
export function setPropertyListingStatus(vars: SetPropertyListingStatusVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<SetPropertyListingStatusData>>;

/** Generated Node Admin SDK operation action function for the 'ArchivePropertyListing' Mutation. Allow users to execute without passing in DataConnect. */
export function archivePropertyListing(dc: DataConnect, vars: ArchivePropertyListingVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ArchivePropertyListingData>>;
/** Generated Node Admin SDK operation action function for the 'ArchivePropertyListing' Mutation. Allow users to pass in custom DataConnect instances. */
export function archivePropertyListing(vars: ArchivePropertyListingVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ArchivePropertyListingData>>;

/** Generated Node Admin SDK operation action function for the 'CreateFloorPlan' Mutation. Allow users to execute without passing in DataConnect. */
export function createFloorPlan(dc: DataConnect, vars: CreateFloorPlanVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateFloorPlanData>>;
/** Generated Node Admin SDK operation action function for the 'CreateFloorPlan' Mutation. Allow users to pass in custom DataConnect instances. */
export function createFloorPlan(vars: CreateFloorPlanVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateFloorPlanData>>;

/** Generated Node Admin SDK operation action function for the 'UpdateFloorPlan' Mutation. Allow users to execute without passing in DataConnect. */
export function updateFloorPlan(dc: DataConnect, vars: UpdateFloorPlanVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateFloorPlanData>>;
/** Generated Node Admin SDK operation action function for the 'UpdateFloorPlan' Mutation. Allow users to pass in custom DataConnect instances. */
export function updateFloorPlan(vars: UpdateFloorPlanVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateFloorPlanData>>;

/** Generated Node Admin SDK operation action function for the 'ArchiveFloorPlan' Mutation. Allow users to execute without passing in DataConnect. */
export function archiveFloorPlan(dc: DataConnect, vars: ArchiveFloorPlanVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ArchiveFloorPlanData>>;
/** Generated Node Admin SDK operation action function for the 'ArchiveFloorPlan' Mutation. Allow users to pass in custom DataConnect instances. */
export function archiveFloorPlan(vars: ArchiveFloorPlanVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ArchiveFloorPlanData>>;

/** Generated Node Admin SDK operation action function for the 'UpdateProjectPhase' Mutation. Allow users to execute without passing in DataConnect. */
export function updateProjectPhase(dc: DataConnect, vars: UpdateProjectPhaseVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateProjectPhaseData>>;
/** Generated Node Admin SDK operation action function for the 'UpdateProjectPhase' Mutation. Allow users to pass in custom DataConnect instances. */
export function updateProjectPhase(vars: UpdateProjectPhaseVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateProjectPhaseData>>;

/** Generated Node Admin SDK operation action function for the 'ArchiveProjectPhase' Mutation. Allow users to execute without passing in DataConnect. */
export function archiveProjectPhase(dc: DataConnect, vars: ArchiveProjectPhaseVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ArchiveProjectPhaseData>>;
/** Generated Node Admin SDK operation action function for the 'ArchiveProjectPhase' Mutation. Allow users to pass in custom DataConnect instances. */
export function archiveProjectPhase(vars: ArchiveProjectPhaseVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ArchiveProjectPhaseData>>;

/** Generated Node Admin SDK operation action function for the 'CreateInventoryAmenity' Mutation. Allow users to execute without passing in DataConnect. */
export function createInventoryAmenity(dc: DataConnect, vars: CreateInventoryAmenityVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateInventoryAmenityData>>;
/** Generated Node Admin SDK operation action function for the 'CreateInventoryAmenity' Mutation. Allow users to pass in custom DataConnect instances. */
export function createInventoryAmenity(vars: CreateInventoryAmenityVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateInventoryAmenityData>>;

/** Generated Node Admin SDK operation action function for the 'SetInventoryAmenityActive' Mutation. Allow users to execute without passing in DataConnect. */
export function setInventoryAmenityActive(dc: DataConnect, vars: SetInventoryAmenityActiveVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<SetInventoryAmenityActiveData>>;
/** Generated Node Admin SDK operation action function for the 'SetInventoryAmenityActive' Mutation. Allow users to pass in custom DataConnect instances. */
export function setInventoryAmenityActive(vars: SetInventoryAmenityActiveVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<SetInventoryAmenityActiveData>>;

/** Generated Node Admin SDK operation action function for the 'AttachPropertyAmenity' Mutation. Allow users to execute without passing in DataConnect. */
export function attachPropertyAmenity(dc: DataConnect, vars: AttachPropertyAmenityVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<AttachPropertyAmenityData>>;
/** Generated Node Admin SDK operation action function for the 'AttachPropertyAmenity' Mutation. Allow users to pass in custom DataConnect instances. */
export function attachPropertyAmenity(vars: AttachPropertyAmenityVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<AttachPropertyAmenityData>>;

/** Generated Node Admin SDK operation action function for the 'DetachPropertyAmenity' Mutation. Allow users to execute without passing in DataConnect. */
export function detachPropertyAmenity(dc: DataConnect, vars: DetachPropertyAmenityVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<DetachPropertyAmenityData>>;
/** Generated Node Admin SDK operation action function for the 'DetachPropertyAmenity' Mutation. Allow users to pass in custom DataConnect instances. */
export function detachPropertyAmenity(vars: DetachPropertyAmenityVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<DetachPropertyAmenityData>>;

/** Generated Node Admin SDK operation action function for the 'CreatePropertyFeature' Mutation. Allow users to execute without passing in DataConnect. */
export function createPropertyFeature(dc: DataConnect, vars: CreatePropertyFeatureVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreatePropertyFeatureData>>;
/** Generated Node Admin SDK operation action function for the 'CreatePropertyFeature' Mutation. Allow users to pass in custom DataConnect instances. */
export function createPropertyFeature(vars: CreatePropertyFeatureVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreatePropertyFeatureData>>;

/** Generated Node Admin SDK operation action function for the 'UpdatePropertyFeature' Mutation. Allow users to execute without passing in DataConnect. */
export function updatePropertyFeature(dc: DataConnect, vars: UpdatePropertyFeatureVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdatePropertyFeatureData>>;
/** Generated Node Admin SDK operation action function for the 'UpdatePropertyFeature' Mutation. Allow users to pass in custom DataConnect instances. */
export function updatePropertyFeature(vars: UpdatePropertyFeatureVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdatePropertyFeatureData>>;

/** Generated Node Admin SDK operation action function for the 'ArchivePropertyFeature' Mutation. Allow users to execute without passing in DataConnect. */
export function archivePropertyFeature(dc: DataConnect, vars: ArchivePropertyFeatureVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ArchivePropertyFeatureData>>;
/** Generated Node Admin SDK operation action function for the 'ArchivePropertyFeature' Mutation. Allow users to pass in custom DataConnect instances. */
export function archivePropertyFeature(vars: ArchivePropertyFeatureVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ArchivePropertyFeatureData>>;

/** Generated Node Admin SDK operation action function for the 'AttachProjectAmenity' Mutation. Allow users to execute without passing in DataConnect. */
export function attachProjectAmenity(dc: DataConnect, vars: AttachProjectAmenityVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<AttachProjectAmenityData>>;
/** Generated Node Admin SDK operation action function for the 'AttachProjectAmenity' Mutation. Allow users to pass in custom DataConnect instances. */
export function attachProjectAmenity(vars: AttachProjectAmenityVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<AttachProjectAmenityData>>;

/** Generated Node Admin SDK operation action function for the 'DetachProjectAmenity' Mutation. Allow users to execute without passing in DataConnect. */
export function detachProjectAmenity(dc: DataConnect, vars: DetachProjectAmenityVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<DetachProjectAmenityData>>;
/** Generated Node Admin SDK operation action function for the 'DetachProjectAmenity' Mutation. Allow users to pass in custom DataConnect instances. */
export function detachProjectAmenity(vars: DetachProjectAmenityVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<DetachProjectAmenityData>>;

/** Generated Node Admin SDK operation action function for the 'CreatePaymentPlan' Mutation. Allow users to execute without passing in DataConnect. */
export function createPaymentPlan(dc: DataConnect, vars: CreatePaymentPlanVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreatePaymentPlanData>>;
/** Generated Node Admin SDK operation action function for the 'CreatePaymentPlan' Mutation. Allow users to pass in custom DataConnect instances. */
export function createPaymentPlan(vars: CreatePaymentPlanVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreatePaymentPlanData>>;

/** Generated Node Admin SDK operation action function for the 'UpdatePaymentPlan' Mutation. Allow users to execute without passing in DataConnect. */
export function updatePaymentPlan(dc: DataConnect, vars: UpdatePaymentPlanVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdatePaymentPlanData>>;
/** Generated Node Admin SDK operation action function for the 'UpdatePaymentPlan' Mutation. Allow users to pass in custom DataConnect instances. */
export function updatePaymentPlan(vars: UpdatePaymentPlanVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdatePaymentPlanData>>;

/** Generated Node Admin SDK operation action function for the 'AddPaymentPlanInstallment' Mutation. Allow users to execute without passing in DataConnect. */
export function addPaymentPlanInstallment(dc: DataConnect, vars: AddPaymentPlanInstallmentVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<AddPaymentPlanInstallmentData>>;
/** Generated Node Admin SDK operation action function for the 'AddPaymentPlanInstallment' Mutation. Allow users to pass in custom DataConnect instances. */
export function addPaymentPlanInstallment(vars: AddPaymentPlanInstallmentVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<AddPaymentPlanInstallmentData>>;

/** Generated Node Admin SDK operation action function for the 'UpdatePaymentPlanInstallment' Mutation. Allow users to execute without passing in DataConnect. */
export function updatePaymentPlanInstallment(dc: DataConnect, vars: UpdatePaymentPlanInstallmentVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdatePaymentPlanInstallmentData>>;
/** Generated Node Admin SDK operation action function for the 'UpdatePaymentPlanInstallment' Mutation. Allow users to pass in custom DataConnect instances. */
export function updatePaymentPlanInstallment(vars: UpdatePaymentPlanInstallmentVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdatePaymentPlanInstallmentData>>;

/** Generated Node Admin SDK operation action function for the 'RemovePaymentPlanInstallment' Mutation. Allow users to execute without passing in DataConnect. */
export function removePaymentPlanInstallment(dc: DataConnect, vars: RemovePaymentPlanInstallmentVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<RemovePaymentPlanInstallmentData>>;
/** Generated Node Admin SDK operation action function for the 'RemovePaymentPlanInstallment' Mutation. Allow users to pass in custom DataConnect instances. */
export function removePaymentPlanInstallment(vars: RemovePaymentPlanInstallmentVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<RemovePaymentPlanInstallmentData>>;

/** Generated Node Admin SDK operation action function for the 'SetPaymentPlanActive' Mutation. Allow users to execute without passing in DataConnect. */
export function setPaymentPlanActive(dc: DataConnect, vars: SetPaymentPlanActiveVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<SetPaymentPlanActiveData>>;
/** Generated Node Admin SDK operation action function for the 'SetPaymentPlanActive' Mutation. Allow users to pass in custom DataConnect instances. */
export function setPaymentPlanActive(vars: SetPaymentPlanActiveVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<SetPaymentPlanActiveData>>;

/** Generated Node Admin SDK operation action function for the 'ArchivePaymentPlan' Mutation. Allow users to execute without passing in DataConnect. */
export function archivePaymentPlan(dc: DataConnect, vars: ArchivePaymentPlanVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ArchivePaymentPlanData>>;
/** Generated Node Admin SDK operation action function for the 'ArchivePaymentPlan' Mutation. Allow users to pass in custom DataConnect instances. */
export function archivePaymentPlan(vars: ArchivePaymentPlanVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ArchivePaymentPlanData>>;

/** Generated Node Admin SDK operation action function for the 'CreateInventoryMedia' Mutation. Allow users to execute without passing in DataConnect. */
export function createInventoryMedia(dc: DataConnect, vars: CreateInventoryMediaVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateInventoryMediaData>>;
/** Generated Node Admin SDK operation action function for the 'CreateInventoryMedia' Mutation. Allow users to pass in custom DataConnect instances. */
export function createInventoryMedia(vars: CreateInventoryMediaVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateInventoryMediaData>>;

/** Generated Node Admin SDK operation action function for the 'SetInventoryMediaStatus' Mutation. Allow users to execute without passing in DataConnect. */
export function setInventoryMediaStatus(dc: DataConnect, vars: SetInventoryMediaStatusVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<SetInventoryMediaStatusData>>;
/** Generated Node Admin SDK operation action function for the 'SetInventoryMediaStatus' Mutation. Allow users to pass in custom DataConnect instances. */
export function setInventoryMediaStatus(vars: SetInventoryMediaStatusVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<SetInventoryMediaStatusData>>;

/** Generated Node Admin SDK operation action function for the 'UpdateInventoryMediaOrder' Mutation. Allow users to execute without passing in DataConnect. */
export function updateInventoryMediaOrder(dc: DataConnect, vars: UpdateInventoryMediaOrderVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateInventoryMediaOrderData>>;
/** Generated Node Admin SDK operation action function for the 'UpdateInventoryMediaOrder' Mutation. Allow users to pass in custom DataConnect instances. */
export function updateInventoryMediaOrder(vars: UpdateInventoryMediaOrderVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateInventoryMediaOrderData>>;

/** Generated Node Admin SDK operation action function for the 'SetPropertyMediaCover' Mutation. Allow users to execute without passing in DataConnect. */
export function setPropertyMediaCover(dc: DataConnect, vars: SetPropertyMediaCoverVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<SetPropertyMediaCoverData>>;
/** Generated Node Admin SDK operation action function for the 'SetPropertyMediaCover' Mutation. Allow users to pass in custom DataConnect instances. */
export function setPropertyMediaCover(vars: SetPropertyMediaCoverVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<SetPropertyMediaCoverData>>;

/** Generated Node Admin SDK operation action function for the 'ListDevelopers' Query. Allow users to execute without passing in DataConnect. */
export function listDevelopers(dc: DataConnect, vars: ListDevelopersVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListDevelopersData>>;
/** Generated Node Admin SDK operation action function for the 'ListDevelopers' Query. Allow users to pass in custom DataConnect instances. */
export function listDevelopers(vars: ListDevelopersVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListDevelopersData>>;

/** Generated Node Admin SDK operation action function for the 'GetDeveloper' Query. Allow users to execute without passing in DataConnect. */
export function getDeveloper(dc: DataConnect, vars: GetDeveloperVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetDeveloperData>>;
/** Generated Node Admin SDK operation action function for the 'GetDeveloper' Query. Allow users to pass in custom DataConnect instances. */
export function getDeveloper(vars: GetDeveloperVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetDeveloperData>>;

/** Generated Node Admin SDK operation action function for the 'ListProjects' Query. Allow users to execute without passing in DataConnect. */
export function listProjects(dc: DataConnect, vars: ListProjectsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListProjectsData>>;
/** Generated Node Admin SDK operation action function for the 'ListProjects' Query. Allow users to pass in custom DataConnect instances. */
export function listProjects(vars: ListProjectsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListProjectsData>>;

/** Generated Node Admin SDK operation action function for the 'GetProject' Query. Allow users to execute without passing in DataConnect. */
export function getProject(dc: DataConnect, vars: GetProjectVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetProjectData>>;
/** Generated Node Admin SDK operation action function for the 'GetProject' Query. Allow users to pass in custom DataConnect instances. */
export function getProject(vars: GetProjectVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetProjectData>>;

/** Generated Node Admin SDK operation action function for the 'ListProjectAuditEvents' Query. Allow users to execute without passing in DataConnect. */
export function listProjectAuditEvents(dc: DataConnect, vars: ListProjectAuditEventsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListProjectAuditEventsData>>;
/** Generated Node Admin SDK operation action function for the 'ListProjectAuditEvents' Query. Allow users to pass in custom DataConnect instances. */
export function listProjectAuditEvents(vars: ListProjectAuditEventsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListProjectAuditEventsData>>;

/** Generated Node Admin SDK operation action function for the 'GetBuilding' Query. Allow users to execute without passing in DataConnect. */
export function getBuilding(dc: DataConnect, vars: GetBuildingVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetBuildingData>>;
/** Generated Node Admin SDK operation action function for the 'GetBuilding' Query. Allow users to pass in custom DataConnect instances. */
export function getBuilding(vars: GetBuildingVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetBuildingData>>;

/** Generated Node Admin SDK operation action function for the 'ListProjectPhases' Query. Allow users to execute without passing in DataConnect. */
export function listProjectPhases(dc: DataConnect, vars: ListProjectPhasesVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListProjectPhasesData>>;
/** Generated Node Admin SDK operation action function for the 'ListProjectPhases' Query. Allow users to pass in custom DataConnect instances. */
export function listProjectPhases(vars: ListProjectPhasesVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListProjectPhasesData>>;

/** Generated Node Admin SDK operation action function for the 'GetProjectPhase' Query. Allow users to execute without passing in DataConnect. */
export function getProjectPhase(dc: DataConnect, vars: GetProjectPhaseVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetProjectPhaseData>>;
/** Generated Node Admin SDK operation action function for the 'GetProjectPhase' Query. Allow users to pass in custom DataConnect instances. */
export function getProjectPhase(vars: GetProjectPhaseVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetProjectPhaseData>>;

/** Generated Node Admin SDK operation action function for the 'ListBuildings' Query. Allow users to execute without passing in DataConnect. */
export function listBuildings(dc: DataConnect, vars: ListBuildingsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListBuildingsData>>;
/** Generated Node Admin SDK operation action function for the 'ListBuildings' Query. Allow users to pass in custom DataConnect instances. */
export function listBuildings(vars: ListBuildingsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListBuildingsData>>;

/** Generated Node Admin SDK operation action function for the 'ListInventoryAmenities' Query. Allow users to execute without passing in DataConnect. */
export function listInventoryAmenities(dc: DataConnect, vars: ListInventoryAmenitiesVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListInventoryAmenitiesData>>;
/** Generated Node Admin SDK operation action function for the 'ListInventoryAmenities' Query. Allow users to pass in custom DataConnect instances. */
export function listInventoryAmenities(vars: ListInventoryAmenitiesVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListInventoryAmenitiesData>>;

/** Generated Node Admin SDK operation action function for the 'GetInventoryAmenity' Query. Allow users to execute without passing in DataConnect. */
export function getInventoryAmenity(dc: DataConnect, vars: GetInventoryAmenityVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetInventoryAmenityData>>;
/** Generated Node Admin SDK operation action function for the 'GetInventoryAmenity' Query. Allow users to pass in custom DataConnect instances. */
export function getInventoryAmenity(vars: GetInventoryAmenityVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetInventoryAmenityData>>;

/** Generated Node Admin SDK operation action function for the 'ListPropertyFeatures' Query. Allow users to execute without passing in DataConnect. */
export function listPropertyFeatures(dc: DataConnect, vars: ListPropertyFeaturesVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListPropertyFeaturesData>>;
/** Generated Node Admin SDK operation action function for the 'ListPropertyFeatures' Query. Allow users to pass in custom DataConnect instances. */
export function listPropertyFeatures(vars: ListPropertyFeaturesVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListPropertyFeaturesData>>;

/** Generated Node Admin SDK operation action function for the 'GetPropertyFeature' Query. Allow users to execute without passing in DataConnect. */
export function getPropertyFeature(dc: DataConnect, vars: GetPropertyFeatureVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetPropertyFeatureData>>;
/** Generated Node Admin SDK operation action function for the 'GetPropertyFeature' Query. Allow users to pass in custom DataConnect instances. */
export function getPropertyFeature(vars: GetPropertyFeatureVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetPropertyFeatureData>>;

/** Generated Node Admin SDK operation action function for the 'ListProperties' Query. Allow users to execute without passing in DataConnect. */
export function listProperties(dc: DataConnect, vars: ListPropertiesVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListPropertiesData>>;
/** Generated Node Admin SDK operation action function for the 'ListProperties' Query. Allow users to pass in custom DataConnect instances. */
export function listProperties(vars: ListPropertiesVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListPropertiesData>>;

/** Generated Node Admin SDK operation action function for the 'GetProperty' Query. Allow users to execute without passing in DataConnect. */
export function getProperty(dc: DataConnect, vars: GetPropertyVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetPropertyData>>;
/** Generated Node Admin SDK operation action function for the 'GetProperty' Query. Allow users to pass in custom DataConnect instances. */
export function getProperty(vars: GetPropertyVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetPropertyData>>;

/** Generated Node Admin SDK operation action function for the 'ListPropertiesAdvanced' Query. Allow users to execute without passing in DataConnect. */
export function listPropertiesAdvanced(dc: DataConnect, vars: ListPropertiesAdvancedVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListPropertiesAdvancedData>>;
/** Generated Node Admin SDK operation action function for the 'ListPropertiesAdvanced' Query. Allow users to pass in custom DataConnect instances. */
export function listPropertiesAdvanced(vars: ListPropertiesAdvancedVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListPropertiesAdvancedData>>;

/** Generated Node Admin SDK operation action function for the 'GetAssignedProperty' Query. Allow users to execute without passing in DataConnect. */
export function getAssignedProperty(dc: DataConnect, vars: GetAssignedPropertyVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetAssignedPropertyData>>;
/** Generated Node Admin SDK operation action function for the 'GetAssignedProperty' Query. Allow users to pass in custom DataConnect instances. */
export function getAssignedProperty(vars: GetAssignedPropertyVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetAssignedPropertyData>>;

/** Generated Node Admin SDK operation action function for the 'ListActiveInventoryAgents' Query. Allow users to execute without passing in DataConnect. */
export function listActiveInventoryAgents(dc: DataConnect, vars: ListActiveInventoryAgentsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListActiveInventoryAgentsData>>;
/** Generated Node Admin SDK operation action function for the 'ListActiveInventoryAgents' Query. Allow users to pass in custom DataConnect instances. */
export function listActiveInventoryAgents(vars: ListActiveInventoryAgentsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListActiveInventoryAgentsData>>;

/** Generated Node Admin SDK operation action function for the 'ListInventoryMedia' Query. Allow users to execute without passing in DataConnect. */
export function listInventoryMedia(dc: DataConnect, vars: ListInventoryMediaVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListInventoryMediaData>>;
/** Generated Node Admin SDK operation action function for the 'ListInventoryMedia' Query. Allow users to pass in custom DataConnect instances. */
export function listInventoryMedia(vars: ListInventoryMediaVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListInventoryMediaData>>;

/** Generated Node Admin SDK operation action function for the 'GetInventoryMedia' Query. Allow users to execute without passing in DataConnect. */
export function getInventoryMedia(dc: DataConnect, vars: GetInventoryMediaVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetInventoryMediaData>>;
/** Generated Node Admin SDK operation action function for the 'GetInventoryMedia' Query. Allow users to pass in custom DataConnect instances. */
export function getInventoryMedia(vars: GetInventoryMediaVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetInventoryMediaData>>;

/** Generated Node Admin SDK operation action function for the 'GetInventoryMediaForDeletion' Query. Allow users to execute without passing in DataConnect. */
export function getInventoryMediaForDeletion(dc: DataConnect, vars: GetInventoryMediaForDeletionVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetInventoryMediaForDeletionData>>;
/** Generated Node Admin SDK operation action function for the 'GetInventoryMediaForDeletion' Query. Allow users to pass in custom DataConnect instances. */
export function getInventoryMediaForDeletion(vars: GetInventoryMediaForDeletionVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetInventoryMediaForDeletionData>>;

/** Generated Node Admin SDK operation action function for the 'GetAssignedPropertyInventoryMedia' Query. Allow users to execute without passing in DataConnect. */
export function getAssignedPropertyInventoryMedia(dc: DataConnect, vars: GetAssignedPropertyInventoryMediaVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetAssignedPropertyInventoryMediaData>>;
/** Generated Node Admin SDK operation action function for the 'GetAssignedPropertyInventoryMedia' Query. Allow users to pass in custom DataConnect instances. */
export function getAssignedPropertyInventoryMedia(vars: GetAssignedPropertyInventoryMediaVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetAssignedPropertyInventoryMediaData>>;

/** Generated Node Admin SDK operation action function for the 'ListPropertyListings' Query. Allow users to execute without passing in DataConnect. */
export function listPropertyListings(dc: DataConnect, vars: ListPropertyListingsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListPropertyListingsData>>;
/** Generated Node Admin SDK operation action function for the 'ListPropertyListings' Query. Allow users to pass in custom DataConnect instances. */
export function listPropertyListings(vars: ListPropertyListingsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListPropertyListingsData>>;

/** Generated Node Admin SDK operation action function for the 'ListAssignedPropertyListings' Query. Allow users to execute without passing in DataConnect. */
export function listAssignedPropertyListings(dc: DataConnect, vars: ListAssignedPropertyListingsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListAssignedPropertyListingsData>>;
/** Generated Node Admin SDK operation action function for the 'ListAssignedPropertyListings' Query. Allow users to pass in custom DataConnect instances. */
export function listAssignedPropertyListings(vars: ListAssignedPropertyListingsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListAssignedPropertyListingsData>>;

/** Generated Node Admin SDK operation action function for the 'ListingStatusCounts' Query. Allow users to execute without passing in DataConnect. */
export function listingStatusCounts(dc: DataConnect, vars: ListingStatusCountsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListingStatusCountsData>>;
/** Generated Node Admin SDK operation action function for the 'ListingStatusCounts' Query. Allow users to pass in custom DataConnect instances. */
export function listingStatusCounts(vars: ListingStatusCountsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListingStatusCountsData>>;

/** Generated Node Admin SDK operation action function for the 'AssignedListingStatusCounts' Query. Allow users to execute without passing in DataConnect. */
export function assignedListingStatusCounts(dc: DataConnect, vars: AssignedListingStatusCountsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<AssignedListingStatusCountsData>>;
/** Generated Node Admin SDK operation action function for the 'AssignedListingStatusCounts' Query. Allow users to pass in custom DataConnect instances. */
export function assignedListingStatusCounts(vars: AssignedListingStatusCountsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<AssignedListingStatusCountsData>>;

/** Generated Node Admin SDK operation action function for the 'ListListingActivity' Query. Allow users to execute without passing in DataConnect. */
export function listListingActivity(dc: DataConnect, vars: ListListingActivityVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListListingActivityData>>;
/** Generated Node Admin SDK operation action function for the 'ListListingActivity' Query. Allow users to pass in custom DataConnect instances. */
export function listListingActivity(vars: ListListingActivityVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListListingActivityData>>;

/** Generated Node Admin SDK operation action function for the 'GetPropertyListing' Query. Allow users to execute without passing in DataConnect. */
export function getPropertyListing(dc: DataConnect, vars: GetPropertyListingVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetPropertyListingData>>;
/** Generated Node Admin SDK operation action function for the 'GetPropertyListing' Query. Allow users to pass in custom DataConnect instances. */
export function getPropertyListing(vars: GetPropertyListingVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetPropertyListingData>>;

/** Generated Node Admin SDK operation action function for the 'GetAssignedPropertyListing' Query. Allow users to execute without passing in DataConnect. */
export function getAssignedPropertyListing(dc: DataConnect, vars: GetAssignedPropertyListingVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetAssignedPropertyListingData>>;
/** Generated Node Admin SDK operation action function for the 'GetAssignedPropertyListing' Query. Allow users to pass in custom DataConnect instances. */
export function getAssignedPropertyListing(vars: GetAssignedPropertyListingVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetAssignedPropertyListingData>>;

/** Generated Node Admin SDK operation action function for the 'GetFloorPlan' Query. Allow users to execute without passing in DataConnect. */
export function getFloorPlan(dc: DataConnect, vars: GetFloorPlanVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetFloorPlanData>>;
/** Generated Node Admin SDK operation action function for the 'GetFloorPlan' Query. Allow users to pass in custom DataConnect instances. */
export function getFloorPlan(vars: GetFloorPlanVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetFloorPlanData>>;

/** Generated Node Admin SDK operation action function for the 'GetPaymentPlan' Query. Allow users to execute without passing in DataConnect. */
export function getPaymentPlan(dc: DataConnect, vars: GetPaymentPlanVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetPaymentPlanData>>;
/** Generated Node Admin SDK operation action function for the 'GetPaymentPlan' Query. Allow users to pass in custom DataConnect instances. */
export function getPaymentPlan(vars: GetPaymentPlanVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetPaymentPlanData>>;

/** Generated Node Admin SDK operation action function for the 'ListFloorPlans' Query. Allow users to execute without passing in DataConnect. */
export function listFloorPlans(dc: DataConnect, vars: ListFloorPlansVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListFloorPlansData>>;
/** Generated Node Admin SDK operation action function for the 'ListFloorPlans' Query. Allow users to pass in custom DataConnect instances. */
export function listFloorPlans(vars: ListFloorPlansVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListFloorPlansData>>;

/** Generated Node Admin SDK operation action function for the 'ListPaymentPlans' Query. Allow users to execute without passing in DataConnect. */
export function listPaymentPlans(dc: DataConnect, vars: ListPaymentPlansVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListPaymentPlansData>>;
/** Generated Node Admin SDK operation action function for the 'ListPaymentPlans' Query. Allow users to pass in custom DataConnect instances. */
export function listPaymentPlans(vars: ListPaymentPlansVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListPaymentPlansData>>;

/** Generated Node Admin SDK operation action function for the 'MetaLeadConnectionForPage' Query. Allow users to execute without passing in DataConnect. */
export function metaLeadConnectionForPage(dc: DataConnect, vars: MetaLeadConnectionForPageVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<MetaLeadConnectionForPageData>>;
/** Generated Node Admin SDK operation action function for the 'MetaLeadConnectionForPage' Query. Allow users to pass in custom DataConnect instances. */
export function metaLeadConnectionForPage(vars: MetaLeadConnectionForPageVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<MetaLeadConnectionForPageData>>;

/** Generated Node Admin SDK operation action function for the 'CreateMetaLeadConnection' Mutation. Allow users to execute without passing in DataConnect. */
export function createMetaLeadConnection(dc: DataConnect, vars: CreateMetaLeadConnectionVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateMetaLeadConnectionData>>;
/** Generated Node Admin SDK operation action function for the 'CreateMetaLeadConnection' Mutation. Allow users to pass in custom DataConnect instances. */
export function createMetaLeadConnection(vars: CreateMetaLeadConnectionVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateMetaLeadConnectionData>>;

/** Generated Node Admin SDK operation action function for the 'SetMetaLeadConnectionStatus' Mutation. Allow users to execute without passing in DataConnect. */
export function setMetaLeadConnectionStatus(dc: DataConnect, vars: SetMetaLeadConnectionStatusVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<SetMetaLeadConnectionStatusData>>;
/** Generated Node Admin SDK operation action function for the 'SetMetaLeadConnectionStatus' Mutation. Allow users to pass in custom DataConnect instances. */
export function setMetaLeadConnectionStatus(vars: SetMetaLeadConnectionStatusVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<SetMetaLeadConnectionStatusData>>;

/** Generated Node Admin SDK operation action function for the 'RecordMetaLeadEvent' Mutation. Allow users to execute without passing in DataConnect. */
export function recordMetaLeadEvent(dc: DataConnect, vars: RecordMetaLeadEventVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<RecordMetaLeadEventData>>;
/** Generated Node Admin SDK operation action function for the 'RecordMetaLeadEvent' Mutation. Allow users to pass in custom DataConnect instances. */
export function recordMetaLeadEvent(vars: RecordMetaLeadEventVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<RecordMetaLeadEventData>>;

/** Generated Node Admin SDK operation action function for the 'MetaLeadEventContext' Query. Allow users to execute without passing in DataConnect. */
export function metaLeadEventContext(dc: DataConnect, vars: MetaLeadEventContextVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<MetaLeadEventContextData>>;
/** Generated Node Admin SDK operation action function for the 'MetaLeadEventContext' Query. Allow users to pass in custom DataConnect instances. */
export function metaLeadEventContext(vars: MetaLeadEventContextVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<MetaLeadEventContextData>>;

/** Generated Node Admin SDK operation action function for the 'MetaLeadConnectionSecret' Query. Allow users to execute without passing in DataConnect. */
export function metaLeadConnectionSecret(dc: DataConnect, vars: MetaLeadConnectionSecretVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<MetaLeadConnectionSecretData>>;
/** Generated Node Admin SDK operation action function for the 'MetaLeadConnectionSecret' Query. Allow users to pass in custom DataConnect instances. */
export function metaLeadConnectionSecret(vars: MetaLeadConnectionSecretVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<MetaLeadConnectionSecretData>>;

/** Generated Node Admin SDK operation action function for the 'FindMetaLeadForm' Query. Allow users to execute without passing in DataConnect. */
export function findMetaLeadForm(dc: DataConnect, vars: FindMetaLeadFormVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<FindMetaLeadFormData>>;
/** Generated Node Admin SDK operation action function for the 'FindMetaLeadForm' Query. Allow users to pass in custom DataConnect instances. */
export function findMetaLeadForm(vars: FindMetaLeadFormVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<FindMetaLeadFormData>>;

/** Generated Node Admin SDK operation action function for the 'RegisterMetaLeadForm' Mutation. Allow users to execute without passing in DataConnect. */
export function registerMetaLeadForm(dc: DataConnect, vars: RegisterMetaLeadFormVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<RegisterMetaLeadFormData>>;
/** Generated Node Admin SDK operation action function for the 'RegisterMetaLeadForm' Mutation. Allow users to pass in custom DataConnect instances. */
export function registerMetaLeadForm(vars: RegisterMetaLeadFormVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<RegisterMetaLeadFormData>>;

/** Generated Node Admin SDK operation action function for the 'SetMetaLeadEventOutcome' Mutation. Allow users to execute without passing in DataConnect. */
export function setMetaLeadEventOutcome(dc: DataConnect, vars: SetMetaLeadEventOutcomeVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<SetMetaLeadEventOutcomeData>>;
/** Generated Node Admin SDK operation action function for the 'SetMetaLeadEventOutcome' Mutation. Allow users to pass in custom DataConnect instances. */
export function setMetaLeadEventOutcome(vars: SetMetaLeadEventOutcomeVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<SetMetaLeadEventOutcomeData>>;

/** Generated Node Admin SDK operation action function for the 'PendingMetaLeadEvents' Query. Allow users to execute without passing in DataConnect. */
export function pendingMetaLeadEvents(dc: DataConnect, vars: PendingMetaLeadEventsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<PendingMetaLeadEventsData>>;
/** Generated Node Admin SDK operation action function for the 'PendingMetaLeadEvents' Query. Allow users to pass in custom DataConnect instances. */
export function pendingMetaLeadEvents(vars: PendingMetaLeadEventsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<PendingMetaLeadEventsData>>;

/** Generated Node Admin SDK operation action function for the 'CaptureMetaLeadAd' Mutation. Allow users to execute without passing in DataConnect. */
export function captureMetaLeadAd(dc: DataConnect, vars: CaptureMetaLeadAdVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CaptureMetaLeadAdData>>;
/** Generated Node Admin SDK operation action function for the 'CaptureMetaLeadAd' Mutation. Allow users to pass in custom DataConnect instances. */
export function captureMetaLeadAd(vars: CaptureMetaLeadAdVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CaptureMetaLeadAdData>>;

/** Generated Node Admin SDK operation action function for the 'MetaLeadOverview' Query. Allow users to execute without passing in DataConnect. */
export function metaLeadOverview(dc: DataConnect, vars: MetaLeadOverviewVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<MetaLeadOverviewData>>;
/** Generated Node Admin SDK operation action function for the 'MetaLeadOverview' Query. Allow users to pass in custom DataConnect instances. */
export function metaLeadOverview(vars: MetaLeadOverviewVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<MetaLeadOverviewData>>;

/** Generated Node Admin SDK operation action function for the 'ReconnectMetaLeadConnection' Mutation. Allow users to execute without passing in DataConnect. */
export function reconnectMetaLeadConnection(dc: DataConnect, vars: ReconnectMetaLeadConnectionVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ReconnectMetaLeadConnectionData>>;
/** Generated Node Admin SDK operation action function for the 'ReconnectMetaLeadConnection' Mutation. Allow users to pass in custom DataConnect instances. */
export function reconnectMetaLeadConnection(vars: ReconnectMetaLeadConnectionVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ReconnectMetaLeadConnectionData>>;

/** Generated Node Admin SDK operation action function for the 'DisconnectMetaLeadConnection' Mutation. Allow users to execute without passing in DataConnect. */
export function disconnectMetaLeadConnection(dc: DataConnect, vars: DisconnectMetaLeadConnectionVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<DisconnectMetaLeadConnectionData>>;
/** Generated Node Admin SDK operation action function for the 'DisconnectMetaLeadConnection' Mutation. Allow users to pass in custom DataConnect instances. */
export function disconnectMetaLeadConnection(vars: DisconnectMetaLeadConnectionVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<DisconnectMetaLeadConnectionData>>;

/** Generated Node Admin SDK operation action function for the 'MetaLeadConnectionsDue' Query. Allow users to execute without passing in DataConnect. */
export function metaLeadConnectionsDue(dc: DataConnect, vars: MetaLeadConnectionsDueVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<MetaLeadConnectionsDueData>>;
/** Generated Node Admin SDK operation action function for the 'MetaLeadConnectionsDue' Query. Allow users to pass in custom DataConnect instances. */
export function metaLeadConnectionsDue(vars: MetaLeadConnectionsDueVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<MetaLeadConnectionsDueData>>;

/** Generated Node Admin SDK operation action function for the 'MarkMetaLeadConnectionPolled' Mutation. Allow users to execute without passing in DataConnect. */
export function markMetaLeadConnectionPolled(dc: DataConnect, vars: MarkMetaLeadConnectionPolledVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<MarkMetaLeadConnectionPolledData>>;
/** Generated Node Admin SDK operation action function for the 'MarkMetaLeadConnectionPolled' Mutation. Allow users to pass in custom DataConnect instances. */
export function markMetaLeadConnectionPolled(vars: MarkMetaLeadConnectionPolledVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<MarkMetaLeadConnectionPolledData>>;

/** Generated Node Admin SDK operation action function for the 'GetLeadPropertyContext' Query. Allow users to execute without passing in DataConnect. */
export function getLeadPropertyContext(dc: DataConnect, vars: GetLeadPropertyContextVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetLeadPropertyContextData>>;
/** Generated Node Admin SDK operation action function for the 'GetLeadPropertyContext' Query. Allow users to pass in custom DataConnect instances. */
export function getLeadPropertyContext(vars: GetLeadPropertyContextVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetLeadPropertyContextData>>;

/** Generated Node Admin SDK operation action function for the 'ListLeadPropertyCandidates' Query. Allow users to execute without passing in DataConnect. */
export function listLeadPropertyCandidates(dc: DataConnect, vars: ListLeadPropertyCandidatesVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListLeadPropertyCandidatesData>>;
/** Generated Node Admin SDK operation action function for the 'ListLeadPropertyCandidates' Query. Allow users to pass in custom DataConnect instances. */
export function listLeadPropertyCandidates(vars: ListLeadPropertyCandidatesVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListLeadPropertyCandidatesData>>;

/** Generated Node Admin SDK operation action function for the 'SaveLeadPropertyInterest' Mutation. Allow users to execute without passing in DataConnect. */
export function saveLeadPropertyInterest(dc: DataConnect, vars: SaveLeadPropertyInterestVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<SaveLeadPropertyInterestData>>;
/** Generated Node Admin SDK operation action function for the 'SaveLeadPropertyInterest' Mutation. Allow users to pass in custom DataConnect instances. */
export function saveLeadPropertyInterest(vars: SaveLeadPropertyInterestVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<SaveLeadPropertyInterestData>>;

/** Generated Node Admin SDK operation action function for the 'SetLeadPrimaryInterest' Mutation. Allow users to execute without passing in DataConnect. */
export function setLeadPrimaryInterest(dc: DataConnect, vars: SetLeadPrimaryInterestVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<SetLeadPrimaryInterestData>>;
/** Generated Node Admin SDK operation action function for the 'SetLeadPrimaryInterest' Mutation. Allow users to pass in custom DataConnect instances. */
export function setLeadPrimaryInterest(vars: SetLeadPrimaryInterestVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<SetLeadPrimaryInterestData>>;

/** Generated Node Admin SDK operation action function for the 'ScheduleLeadPropertyViewing' Mutation. Allow users to execute without passing in DataConnect. */
export function scheduleLeadPropertyViewing(dc: DataConnect, vars: ScheduleLeadPropertyViewingVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ScheduleLeadPropertyViewingData>>;
/** Generated Node Admin SDK operation action function for the 'ScheduleLeadPropertyViewing' Mutation. Allow users to pass in custom DataConnect instances. */
export function scheduleLeadPropertyViewing(vars: ScheduleLeadPropertyViewingVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ScheduleLeadPropertyViewingData>>;

/** Generated Node Admin SDK operation action function for the 'UpdateLeadPropertyViewing' Mutation. Allow users to execute without passing in DataConnect. */
export function updateLeadPropertyViewing(dc: DataConnect, vars: UpdateLeadPropertyViewingVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateLeadPropertyViewingData>>;
/** Generated Node Admin SDK operation action function for the 'UpdateLeadPropertyViewing' Mutation. Allow users to pass in custom DataConnect instances. */
export function updateLeadPropertyViewing(vars: UpdateLeadPropertyViewingVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateLeadPropertyViewingData>>;

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

/** Generated Node Admin SDK operation action function for the 'GetPortalSettings' Query. Allow users to execute without passing in DataConnect. */
export function getPortalSettings(dc: DataConnect, vars: GetPortalSettingsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetPortalSettingsData>>;
/** Generated Node Admin SDK operation action function for the 'GetPortalSettings' Query. Allow users to pass in custom DataConnect instances. */
export function getPortalSettings(vars: GetPortalSettingsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetPortalSettingsData>>;

/** Generated Node Admin SDK operation action function for the 'GetPortalExportListing' Query. Allow users to execute without passing in DataConnect. */
export function getPortalExportListing(dc: DataConnect, vars: GetPortalExportListingVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetPortalExportListingData>>;
/** Generated Node Admin SDK operation action function for the 'GetPortalExportListing' Query. Allow users to pass in custom DataConnect instances. */
export function getPortalExportListing(vars: GetPortalExportListingVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetPortalExportListingData>>;

/** Generated Node Admin SDK operation action function for the 'ListPortalExportListings' Query. Allow users to execute without passing in DataConnect. */
export function listPortalExportListings(dc: DataConnect, vars: ListPortalExportListingsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListPortalExportListingsData>>;
/** Generated Node Admin SDK operation action function for the 'ListPortalExportListings' Query. Allow users to pass in custom DataConnect instances. */
export function listPortalExportListings(vars: ListPortalExportListingsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListPortalExportListingsData>>;

/** Generated Node Admin SDK operation action function for the 'SavePortalConnection' Mutation. Allow users to execute without passing in DataConnect. */
export function savePortalConnection(dc: DataConnect, vars: SavePortalConnectionVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<SavePortalConnectionData>>;
/** Generated Node Admin SDK operation action function for the 'SavePortalConnection' Mutation. Allow users to pass in custom DataConnect instances. */
export function savePortalConnection(vars: SavePortalConnectionVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<SavePortalConnectionData>>;

/** Generated Node Admin SDK operation action function for the 'SetPortalFieldMapping' Mutation. Allow users to execute without passing in DataConnect. */
export function setPortalFieldMapping(dc: DataConnect, vars: SetPortalFieldMappingVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<SetPortalFieldMappingData>>;
/** Generated Node Admin SDK operation action function for the 'SetPortalFieldMapping' Mutation. Allow users to pass in custom DataConnect instances. */
export function setPortalFieldMapping(vars: SetPortalFieldMappingVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<SetPortalFieldMappingData>>;

/** Generated Node Admin SDK operation action function for the 'RemovePortalFieldMapping' Mutation. Allow users to execute without passing in DataConnect. */
export function removePortalFieldMapping(dc: DataConnect, vars: RemovePortalFieldMappingVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<RemovePortalFieldMappingData>>;
/** Generated Node Admin SDK operation action function for the 'RemovePortalFieldMapping' Mutation. Allow users to pass in custom DataConnect instances. */
export function removePortalFieldMapping(vars: RemovePortalFieldMappingVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<RemovePortalFieldMappingData>>;

/** Generated Node Admin SDK operation action function for the 'RecordListingValidation' Mutation. Allow users to execute without passing in DataConnect. */
export function recordListingValidation(dc: DataConnect, vars: RecordListingValidationVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<RecordListingValidationData>>;
/** Generated Node Admin SDK operation action function for the 'RecordListingValidation' Mutation. Allow users to pass in custom DataConnect instances. */
export function recordListingValidation(vars: RecordListingValidationVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<RecordListingValidationData>>;

/** Generated Node Admin SDK operation action function for the 'RecordFeedGenerationJob' Mutation. Allow users to execute without passing in DataConnect. */
export function recordFeedGenerationJob(dc: DataConnect, vars: RecordFeedGenerationJobVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<RecordFeedGenerationJobData>>;
/** Generated Node Admin SDK operation action function for the 'RecordFeedGenerationJob' Mutation. Allow users to pass in custom DataConnect instances. */
export function recordFeedGenerationJob(vars: RecordFeedGenerationJobVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<RecordFeedGenerationJobData>>;

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

/** Generated Node Admin SDK operation action function for the 'HitRateLimitCounter' Mutation. Allow users to execute without passing in DataConnect. */
export function hitRateLimitCounter(dc: DataConnect, vars: HitRateLimitCounterVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<HitRateLimitCounterData>>;
/** Generated Node Admin SDK operation action function for the 'HitRateLimitCounter' Mutation. Allow users to pass in custom DataConnect instances. */
export function hitRateLimitCounter(vars: HitRateLimitCounterVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<HitRateLimitCounterData>>;

/** Generated Node Admin SDK operation action function for the 'PurgeExpiredRateLimitCounters' Mutation. Allow users to execute without passing in DataConnect. */
export function purgeExpiredRateLimitCounters(dc: DataConnect, vars: PurgeExpiredRateLimitCountersVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<PurgeExpiredRateLimitCountersData>>;
/** Generated Node Admin SDK operation action function for the 'PurgeExpiredRateLimitCounters' Mutation. Allow users to pass in custom DataConnect instances. */
export function purgeExpiredRateLimitCounters(vars: PurgeExpiredRateLimitCountersVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<PurgeExpiredRateLimitCountersData>>;

/** Generated Node Admin SDK operation action function for the 'ListMyTasks' Query. Allow users to execute without passing in DataConnect. */
export function listMyTasks(dc: DataConnect, vars: ListMyTasksVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListMyTasksData>>;
/** Generated Node Admin SDK operation action function for the 'ListMyTasks' Query. Allow users to pass in custom DataConnect instances. */
export function listMyTasks(vars: ListMyTasksVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListMyTasksData>>;

/** Generated Node Admin SDK operation action function for the 'CompleteWorkTask' Mutation. Allow users to execute without passing in DataConnect. */
export function completeWorkTask(dc: DataConnect, vars: CompleteWorkTaskVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CompleteWorkTaskData>>;
/** Generated Node Admin SDK operation action function for the 'CompleteWorkTask' Mutation. Allow users to pass in custom DataConnect instances. */
export function completeWorkTask(vars: CompleteWorkTaskVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CompleteWorkTaskData>>;

/** Generated Node Admin SDK operation action function for the 'ListWebsitePages' Query. Allow users to execute without passing in DataConnect. */
export function listWebsitePages(dc: DataConnect, vars: ListWebsitePagesVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListWebsitePagesData>>;
/** Generated Node Admin SDK operation action function for the 'ListWebsitePages' Query. Allow users to pass in custom DataConnect instances. */
export function listWebsitePages(vars: ListWebsitePagesVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListWebsitePagesData>>;

/** Generated Node Admin SDK operation action function for the 'GetWebsitePage' Query. Allow users to execute without passing in DataConnect. */
export function getWebsitePage(dc: DataConnect, vars: GetWebsitePageVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetWebsitePageData>>;
/** Generated Node Admin SDK operation action function for the 'GetWebsitePage' Query. Allow users to pass in custom DataConnect instances. */
export function getWebsitePage(vars: GetWebsitePageVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetWebsitePageData>>;

/** Generated Node Admin SDK operation action function for the 'GetPageVersion' Query. Allow users to execute without passing in DataConnect. */
export function getPageVersion(dc: DataConnect, vars: GetPageVersionVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetPageVersionData>>;
/** Generated Node Admin SDK operation action function for the 'GetPageVersion' Query. Allow users to pass in custom DataConnect instances. */
export function getPageVersion(vars: GetPageVersionVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetPageVersionData>>;

/** Generated Node Admin SDK operation action function for the 'ListProjectWebsiteMedia' Query. Allow users to execute without passing in DataConnect. */
export function listProjectWebsiteMedia(dc: DataConnect, vars: ListProjectWebsiteMediaVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListProjectWebsiteMediaData>>;
/** Generated Node Admin SDK operation action function for the 'ListProjectWebsiteMedia' Query. Allow users to pass in custom DataConnect instances. */
export function listProjectWebsiteMedia(vars: ListProjectWebsiteMediaVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListProjectWebsiteMediaData>>;

/** Generated Node Admin SDK operation action function for the 'FindWebsitePageBySlug' Query. Allow users to execute without passing in DataConnect. */
export function findWebsitePageBySlug(dc: DataConnect, vars: FindWebsitePageBySlugVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<FindWebsitePageBySlugData>>;
/** Generated Node Admin SDK operation action function for the 'FindWebsitePageBySlug' Query. Allow users to pass in custom DataConnect instances. */
export function findWebsitePageBySlug(vars: FindWebsitePageBySlugVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<FindWebsitePageBySlugData>>;

/** Generated Node Admin SDK operation action function for the 'CreateWebsitePage' Mutation. Allow users to execute without passing in DataConnect. */
export function createWebsitePage(dc: DataConnect, vars: CreateWebsitePageVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateWebsitePageData>>;
/** Generated Node Admin SDK operation action function for the 'CreateWebsitePage' Mutation. Allow users to pass in custom DataConnect instances. */
export function createWebsitePage(vars: CreateWebsitePageVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateWebsitePageData>>;

/** Generated Node Admin SDK operation action function for the 'SaveWebsitePageVersion' Mutation. Allow users to execute without passing in DataConnect. */
export function saveWebsitePageVersion(dc: DataConnect, vars: SaveWebsitePageVersionVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<SaveWebsitePageVersionData>>;
/** Generated Node Admin SDK operation action function for the 'SaveWebsitePageVersion' Mutation. Allow users to pass in custom DataConnect instances. */
export function saveWebsitePageVersion(vars: SaveWebsitePageVersionVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<SaveWebsitePageVersionData>>;

/** Generated Node Admin SDK operation action function for the 'SubmitWebsitePageForReview' Mutation. Allow users to execute without passing in DataConnect. */
export function submitWebsitePageForReview(dc: DataConnect, vars: SubmitWebsitePageForReviewVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<SubmitWebsitePageForReviewData>>;
/** Generated Node Admin SDK operation action function for the 'SubmitWebsitePageForReview' Mutation. Allow users to pass in custom DataConnect instances. */
export function submitWebsitePageForReview(vars: SubmitWebsitePageForReviewVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<SubmitWebsitePageForReviewData>>;

/** Generated Node Admin SDK operation action function for the 'ApproveWebsitePage' Mutation. Allow users to execute without passing in DataConnect. */
export function approveWebsitePage(dc: DataConnect, vars: ApproveWebsitePageVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ApproveWebsitePageData>>;
/** Generated Node Admin SDK operation action function for the 'ApproveWebsitePage' Mutation. Allow users to pass in custom DataConnect instances. */
export function approveWebsitePage(vars: ApproveWebsitePageVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ApproveWebsitePageData>>;

/** Generated Node Admin SDK operation action function for the 'RejectWebsitePage' Mutation. Allow users to execute without passing in DataConnect. */
export function rejectWebsitePage(dc: DataConnect, vars: RejectWebsitePageVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<RejectWebsitePageData>>;
/** Generated Node Admin SDK operation action function for the 'RejectWebsitePage' Mutation. Allow users to pass in custom DataConnect instances. */
export function rejectWebsitePage(vars: RejectWebsitePageVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<RejectWebsitePageData>>;

/** Generated Node Admin SDK operation action function for the 'UnpublishWebsitePage' Mutation. Allow users to execute without passing in DataConnect. */
export function unpublishWebsitePage(dc: DataConnect, vars: UnpublishWebsitePageVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UnpublishWebsitePageData>>;
/** Generated Node Admin SDK operation action function for the 'UnpublishWebsitePage' Mutation. Allow users to pass in custom DataConnect instances. */
export function unpublishWebsitePage(vars: UnpublishWebsitePageVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UnpublishWebsitePageData>>;

/** Generated Node Admin SDK operation action function for the 'ArchiveWebsitePage' Mutation. Allow users to execute without passing in DataConnect. */
export function archiveWebsitePage(dc: DataConnect, vars: ArchiveWebsitePageVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ArchiveWebsitePageData>>;
/** Generated Node Admin SDK operation action function for the 'ArchiveWebsitePage' Mutation. Allow users to pass in custom DataConnect instances. */
export function archiveWebsitePage(vars: ArchiveWebsitePageVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ArchiveWebsitePageData>>;

/** Generated Node Admin SDK operation action function for the 'SetPageLeadFormBinding' Mutation. Allow users to execute without passing in DataConnect. */
export function setPageLeadFormBinding(dc: DataConnect, vars: SetPageLeadFormBindingVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<SetPageLeadFormBindingData>>;
/** Generated Node Admin SDK operation action function for the 'SetPageLeadFormBinding' Mutation. Allow users to pass in custom DataConnect instances. */
export function setPageLeadFormBinding(vars: SetPageLeadFormBindingVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<SetPageLeadFormBindingData>>;

/** Generated Node Admin SDK operation action function for the 'RemovePageLeadFormBinding' Mutation. Allow users to execute without passing in DataConnect. */
export function removePageLeadFormBinding(dc: DataConnect, vars: RemovePageLeadFormBindingVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<RemovePageLeadFormBindingData>>;
/** Generated Node Admin SDK operation action function for the 'RemovePageLeadFormBinding' Mutation. Allow users to pass in custom DataConnect instances. */
export function removePageLeadFormBinding(vars: RemovePageLeadFormBindingVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<RemovePageLeadFormBindingData>>;

/** Generated Node Admin SDK operation action function for the 'UpdateWebsiteSettings' Mutation. Allow users to execute without passing in DataConnect. */
export function updateWebsiteSettings(dc: DataConnect, vars: UpdateWebsiteSettingsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateWebsiteSettingsData>>;
/** Generated Node Admin SDK operation action function for the 'UpdateWebsiteSettings' Mutation. Allow users to pass in custom DataConnect instances. */
export function updateWebsiteSettings(vars: UpdateWebsiteSettingsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateWebsiteSettingsData>>;

/** Generated Node Admin SDK operation action function for the 'ListWebsitePageEnquiries' Query. Allow users to execute without passing in DataConnect. */
export function listWebsitePageEnquiries(dc: DataConnect, vars: ListWebsitePageEnquiriesVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListWebsitePageEnquiriesData>>;
/** Generated Node Admin SDK operation action function for the 'ListWebsitePageEnquiries' Query. Allow users to pass in custom DataConnect instances. */
export function listWebsitePageEnquiries(vars: ListWebsitePageEnquiriesVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListWebsitePageEnquiriesData>>;

/** Generated Node Admin SDK operation action function for the 'ListPendingWebsiteEnquiries' Query. Allow users to execute without passing in DataConnect. */
export function listPendingWebsiteEnquiries(dc: DataConnect, vars: ListPendingWebsiteEnquiriesVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListPendingWebsiteEnquiriesData>>;
/** Generated Node Admin SDK operation action function for the 'ListPendingWebsiteEnquiries' Query. Allow users to pass in custom DataConnect instances. */
export function listPendingWebsiteEnquiries(vars: ListPendingWebsiteEnquiriesVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListPendingWebsiteEnquiriesData>>;

/** Generated Node Admin SDK operation action function for the 'DismissPendingWebsiteEnquiry' Mutation. Allow users to execute without passing in DataConnect. */
export function dismissPendingWebsiteEnquiry(dc: DataConnect, vars: DismissPendingWebsiteEnquiryVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<DismissPendingWebsiteEnquiryData>>;
/** Generated Node Admin SDK operation action function for the 'DismissPendingWebsiteEnquiry' Mutation. Allow users to pass in custom DataConnect instances. */
export function dismissPendingWebsiteEnquiry(vars: DismissPendingWebsiteEnquiryVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<DismissPendingWebsiteEnquiryData>>;

/** Generated Node Admin SDK operation action function for the 'CreateDefaultWebsite' Mutation. Allow users to execute without passing in DataConnect. */
export function createDefaultWebsite(dc: DataConnect, vars: CreateDefaultWebsiteVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateDefaultWebsiteData>>;
/** Generated Node Admin SDK operation action function for the 'CreateDefaultWebsite' Mutation. Allow users to pass in custom DataConnect instances. */
export function createDefaultWebsite(vars: CreateDefaultWebsiteVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateDefaultWebsiteData>>;

/** Generated Node Admin SDK operation action function for the 'CreateGeneratedWebsitePage' Mutation. Allow users to execute without passing in DataConnect. */
export function createGeneratedWebsitePage(dc: DataConnect, vars: CreateGeneratedWebsitePageVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateGeneratedWebsitePageData>>;
/** Generated Node Admin SDK operation action function for the 'CreateGeneratedWebsitePage' Mutation. Allow users to pass in custom DataConnect instances. */
export function createGeneratedWebsitePage(vars: CreateGeneratedWebsitePageVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateGeneratedWebsitePageData>>;

/** Generated Node Admin SDK operation action function for the 'AddGeneratedPageVersion' Mutation. Allow users to execute without passing in DataConnect. */
export function addGeneratedPageVersion(dc: DataConnect, vars: AddGeneratedPageVersionVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<AddGeneratedPageVersionData>>;
/** Generated Node Admin SDK operation action function for the 'AddGeneratedPageVersion' Mutation. Allow users to pass in custom DataConnect instances. */
export function addGeneratedPageVersion(vars: AddGeneratedPageVersionVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<AddGeneratedPageVersionData>>;

/** Generated Node Admin SDK operation action function for the 'PublishWebsitePage' Mutation. Allow users to execute without passing in DataConnect. */
export function publishWebsitePage(dc: DataConnect, vars: PublishWebsitePageVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<PublishWebsitePageData>>;
/** Generated Node Admin SDK operation action function for the 'PublishWebsitePage' Mutation. Allow users to pass in custom DataConnect instances. */
export function publishWebsitePage(vars: PublishWebsitePageVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<PublishWebsitePageData>>;

/** Generated Node Admin SDK operation action function for the 'MarkPendingWebsiteEnquiryRecovered' Mutation. Allow users to execute without passing in DataConnect. */
export function markPendingWebsiteEnquiryRecovered(dc: DataConnect, vars: MarkPendingWebsiteEnquiryRecoveredVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<MarkPendingWebsiteEnquiryRecoveredData>>;
/** Generated Node Admin SDK operation action function for the 'MarkPendingWebsiteEnquiryRecovered' Mutation. Allow users to pass in custom DataConnect instances. */
export function markPendingWebsiteEnquiryRecovered(vars: MarkPendingWebsiteEnquiryRecoveredVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<MarkPendingWebsiteEnquiryRecoveredData>>;

/** Generated Node Admin SDK operation action function for the 'RecordPendingWebsiteEnquiryAttempt' Mutation. Allow users to execute without passing in DataConnect. */
export function recordPendingWebsiteEnquiryAttempt(dc: DataConnect, vars: RecordPendingWebsiteEnquiryAttemptVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<RecordPendingWebsiteEnquiryAttemptData>>;
/** Generated Node Admin SDK operation action function for the 'RecordPendingWebsiteEnquiryAttempt' Mutation. Allow users to pass in custom DataConnect instances. */
export function recordPendingWebsiteEnquiryAttempt(vars: RecordPendingWebsiteEnquiryAttemptVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<RecordPendingWebsiteEnquiryAttemptData>>;

/** Generated Node Admin SDK operation action function for the 'ResolvePublishedPage' Query. Allow users to execute without passing in DataConnect. */
export function resolvePublishedPage(dc: DataConnect, vars: ResolvePublishedPageVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ResolvePublishedPageData>>;
/** Generated Node Admin SDK operation action function for the 'ResolvePublishedPage' Query. Allow users to pass in custom DataConnect instances. */
export function resolvePublishedPage(vars: ResolvePublishedPageVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ResolvePublishedPageData>>;

/** Generated Node Admin SDK operation action function for the 'GetPublishedPageAsset' Query. Allow users to execute without passing in DataConnect. */
export function getPublishedPageAsset(dc: DataConnect, vars: GetPublishedPageAssetVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetPublishedPageAssetData>>;
/** Generated Node Admin SDK operation action function for the 'GetPublishedPageAsset' Query. Allow users to pass in custom DataConnect instances. */
export function getPublishedPageAsset(vars: GetPublishedPageAssetVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetPublishedPageAssetData>>;

/** Generated Node Admin SDK operation action function for the 'ListPublishedPagesForSitemap' Query. Allow users to execute without passing in DataConnect. */
export function listPublishedPagesForSitemap(dc: DataConnect, vars: ListPublishedPagesForSitemapVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListPublishedPagesForSitemapData>>;
/** Generated Node Admin SDK operation action function for the 'ListPublishedPagesForSitemap' Query. Allow users to pass in custom DataConnect instances. */
export function listPublishedPagesForSitemap(vars: ListPublishedPagesForSitemapVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListPublishedPagesForSitemapData>>;

/** Generated Node Admin SDK operation action function for the 'CheckPublishedSourcesEligibility' Query. Allow users to execute without passing in DataConnect. */
export function checkPublishedSourcesEligibility(dc: DataConnect, vars: CheckPublishedSourcesEligibilityVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CheckPublishedSourcesEligibilityData>>;
/** Generated Node Admin SDK operation action function for the 'CheckPublishedSourcesEligibility' Query. Allow users to pass in custom DataConnect instances. */
export function checkPublishedSourcesEligibility(vars: CheckPublishedSourcesEligibilityVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CheckPublishedSourcesEligibilityData>>;

/** Generated Node Admin SDK operation action function for the 'GetPublishedPageForm' Query. Allow users to execute without passing in DataConnect. */
export function getPublishedPageForm(dc: DataConnect, vars: GetPublishedPageFormVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetPublishedPageFormData>>;
/** Generated Node Admin SDK operation action function for the 'GetPublishedPageForm' Query. Allow users to pass in custom DataConnect instances. */
export function getPublishedPageForm(vars: GetPublishedPageFormVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetPublishedPageFormData>>;

/** Generated Node Admin SDK operation action function for the 'GetWebsiteLeadCaptureFormById' Query. Allow users to execute without passing in DataConnect. */
export function getWebsiteLeadCaptureFormById(dc: DataConnect, vars: GetWebsiteLeadCaptureFormByIdVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetWebsiteLeadCaptureFormByIdData>>;
/** Generated Node Admin SDK operation action function for the 'GetWebsiteLeadCaptureFormById' Query. Allow users to pass in custom DataConnect instances. */
export function getWebsiteLeadCaptureFormById(vars: GetWebsiteLeadCaptureFormByIdVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetWebsiteLeadCaptureFormByIdData>>;

/** Generated Node Admin SDK operation action function for the 'RecordWebsitePageEnquiry' Mutation. Allow users to execute without passing in DataConnect. */
export function recordWebsitePageEnquiry(dc: DataConnect, vars: RecordWebsitePageEnquiryVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<RecordWebsitePageEnquiryData>>;
/** Generated Node Admin SDK operation action function for the 'RecordWebsitePageEnquiry' Mutation. Allow users to pass in custom DataConnect instances. */
export function recordWebsitePageEnquiry(vars: RecordWebsitePageEnquiryVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<RecordWebsitePageEnquiryData>>;

/** Generated Node Admin SDK operation action function for the 'FindPendingWebsiteEnquiry' Query. Allow users to execute without passing in DataConnect. */
export function findPendingWebsiteEnquiry(dc: DataConnect, vars: FindPendingWebsiteEnquiryVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<FindPendingWebsiteEnquiryData>>;
/** Generated Node Admin SDK operation action function for the 'FindPendingWebsiteEnquiry' Query. Allow users to pass in custom DataConnect instances. */
export function findPendingWebsiteEnquiry(vars: FindPendingWebsiteEnquiryVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<FindPendingWebsiteEnquiryData>>;

/** Generated Node Admin SDK operation action function for the 'RecordPendingWebsiteEnquiry' Mutation. Allow users to execute without passing in DataConnect. */
export function recordPendingWebsiteEnquiry(dc: DataConnect, vars: RecordPendingWebsiteEnquiryVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<RecordPendingWebsiteEnquiryData>>;
/** Generated Node Admin SDK operation action function for the 'RecordPendingWebsiteEnquiry' Mutation. Allow users to pass in custom DataConnect instances. */
export function recordPendingWebsiteEnquiry(vars: RecordPendingWebsiteEnquiryVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<RecordPendingWebsiteEnquiryData>>;

/** Generated Node Admin SDK operation action function for the 'ListWebsiteAgents' Query. Allow users to execute without passing in DataConnect. */
export function listWebsiteAgents(dc: DataConnect, vars: ListWebsiteAgentsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListWebsiteAgentsData>>;
/** Generated Node Admin SDK operation action function for the 'ListWebsiteAgents' Query. Allow users to pass in custom DataConnect instances. */
export function listWebsiteAgents(vars: ListWebsiteAgentsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListWebsiteAgentsData>>;

/** Generated Node Admin SDK operation action function for the 'GetWebsiteAgent' Query. Allow users to execute without passing in DataConnect. */
export function getWebsiteAgent(dc: DataConnect, vars: GetWebsiteAgentVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetWebsiteAgentData>>;
/** Generated Node Admin SDK operation action function for the 'GetWebsiteAgent' Query. Allow users to pass in custom DataConnect instances. */
export function getWebsiteAgent(vars: GetWebsiteAgentVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetWebsiteAgentData>>;

/** Generated Node Admin SDK operation action function for the 'UpdateWebsiteAgentCard' Mutation. Allow users to execute without passing in DataConnect. */
export function updateWebsiteAgentCard(dc: DataConnect, vars: UpdateWebsiteAgentCardVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateWebsiteAgentCardData>>;
/** Generated Node Admin SDK operation action function for the 'UpdateWebsiteAgentCard' Mutation. Allow users to pass in custom DataConnect instances. */
export function updateWebsiteAgentCard(vars: UpdateWebsiteAgentCardVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateWebsiteAgentCardData>>;

/** Generated Node Admin SDK operation action function for the 'GetWebsiteMediaAccess' Query. Allow users to execute without passing in DataConnect. */
export function getWebsiteMediaAccess(dc: DataConnect, vars: GetWebsiteMediaAccessVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetWebsiteMediaAccessData>>;
/** Generated Node Admin SDK operation action function for the 'GetWebsiteMediaAccess' Query. Allow users to pass in custom DataConnect instances. */
export function getWebsiteMediaAccess(vars: GetWebsiteMediaAccessVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetWebsiteMediaAccessData>>;

/** Generated Node Admin SDK operation action function for the 'CreateWebsiteMedia' Mutation. Allow users to execute without passing in DataConnect. */
export function createWebsiteMedia(dc: DataConnect, vars: CreateWebsiteMediaVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateWebsiteMediaData>>;
/** Generated Node Admin SDK operation action function for the 'CreateWebsiteMedia' Mutation. Allow users to pass in custom DataConnect instances. */
export function createWebsiteMedia(vars: CreateWebsiteMediaVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateWebsiteMediaData>>;

/** Generated Node Admin SDK operation action function for the 'SetWebsiteMediaUploadStatus' Mutation. Allow users to execute without passing in DataConnect. */
export function setWebsiteMediaUploadStatus(dc: DataConnect, vars: SetWebsiteMediaUploadStatusVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<SetWebsiteMediaUploadStatusData>>;
/** Generated Node Admin SDK operation action function for the 'SetWebsiteMediaUploadStatus' Mutation. Allow users to pass in custom DataConnect instances. */
export function setWebsiteMediaUploadStatus(vars: SetWebsiteMediaUploadStatusVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<SetWebsiteMediaUploadStatusData>>;

/** Generated Node Admin SDK operation action function for the 'ListWebsiteMedia' Query. Allow users to execute without passing in DataConnect. */
export function listWebsiteMedia(dc: DataConnect, vars: ListWebsiteMediaVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListWebsiteMediaData>>;
/** Generated Node Admin SDK operation action function for the 'ListWebsiteMedia' Query. Allow users to pass in custom DataConnect instances. */
export function listWebsiteMedia(vars: ListWebsiteMediaVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListWebsiteMediaData>>;

/** Generated Node Admin SDK operation action function for the 'GetWebsiteMediaByIds' Query. Allow users to execute without passing in DataConnect. */
export function getWebsiteMediaByIds(dc: DataConnect, vars: GetWebsiteMediaByIdsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetWebsiteMediaByIdsData>>;
/** Generated Node Admin SDK operation action function for the 'GetWebsiteMediaByIds' Query. Allow users to pass in custom DataConnect instances. */
export function getWebsiteMediaByIds(vars: GetWebsiteMediaByIdsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetWebsiteMediaByIdsData>>;

/** Generated Node Admin SDK operation action function for the 'UpdateWebsiteMediaAlt' Mutation. Allow users to execute without passing in DataConnect. */
export function updateWebsiteMediaAlt(dc: DataConnect, vars: UpdateWebsiteMediaAltVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateWebsiteMediaAltData>>;
/** Generated Node Admin SDK operation action function for the 'UpdateWebsiteMediaAlt' Mutation. Allow users to pass in custom DataConnect instances. */
export function updateWebsiteMediaAlt(vars: UpdateWebsiteMediaAltVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateWebsiteMediaAltData>>;

/** Generated Node Admin SDK operation action function for the 'ArchiveWebsiteMedia' Mutation. Allow users to execute without passing in DataConnect. */
export function archiveWebsiteMedia(dc: DataConnect, vars: ArchiveWebsiteMediaVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ArchiveWebsiteMediaData>>;
/** Generated Node Admin SDK operation action function for the 'ArchiveWebsiteMedia' Mutation. Allow users to pass in custom DataConnect instances. */
export function archiveWebsiteMedia(vars: ArchiveWebsiteMediaVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ArchiveWebsiteMediaData>>;

/** Generated Node Admin SDK operation action function for the 'CreateWebsiteSectionTemplate' Mutation. Allow users to execute without passing in DataConnect. */
export function createWebsiteSectionTemplate(dc: DataConnect, vars: CreateWebsiteSectionTemplateVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateWebsiteSectionTemplateData>>;
/** Generated Node Admin SDK operation action function for the 'CreateWebsiteSectionTemplate' Mutation. Allow users to pass in custom DataConnect instances. */
export function createWebsiteSectionTemplate(vars: CreateWebsiteSectionTemplateVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateWebsiteSectionTemplateData>>;

/** Generated Node Admin SDK operation action function for the 'ListWebsiteSectionTemplates' Query. Allow users to execute without passing in DataConnect. */
export function listWebsiteSectionTemplates(dc: DataConnect, vars: ListWebsiteSectionTemplatesVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListWebsiteSectionTemplatesData>>;
/** Generated Node Admin SDK operation action function for the 'ListWebsiteSectionTemplates' Query. Allow users to pass in custom DataConnect instances. */
export function listWebsiteSectionTemplates(vars: ListWebsiteSectionTemplatesVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListWebsiteSectionTemplatesData>>;

/** Generated Node Admin SDK operation action function for the 'DeleteWebsiteSectionTemplate' Mutation. Allow users to execute without passing in DataConnect. */
export function deleteWebsiteSectionTemplate(dc: DataConnect, vars: DeleteWebsiteSectionTemplateVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<DeleteWebsiteSectionTemplateData>>;
/** Generated Node Admin SDK operation action function for the 'DeleteWebsiteSectionTemplate' Mutation. Allow users to pass in custom DataConnect instances. */
export function deleteWebsiteSectionTemplate(vars: DeleteWebsiteSectionTemplateVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<DeleteWebsiteSectionTemplateData>>;

