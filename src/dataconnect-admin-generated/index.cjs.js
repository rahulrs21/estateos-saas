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
}
exports.AuditTargetType = AuditTargetType;

const BuildingType = {
  RESIDENTIAL: "RESIDENTIAL",
  COMMERCIAL: "COMMERCIAL",
  MIXED_USE: "MIXED_USE",
  TOWNHOUSE: "TOWNHOUSE",
  VILLA: "VILLA",
  OTHER: "OTHER",
}
exports.BuildingType = BuildingType;

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
}
exports.InAppNotificationType = InAppNotificationType;

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

const PaymentDueTrigger = {
  CONSTRUCTION_MILESTONE: "CONSTRUCTION_MILESTONE",
  HANDOVER: "HANDOVER",
  POST_HANDOVER: "POST_HANDOVER",
}
exports.PaymentDueTrigger = PaymentDueTrigger;

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

