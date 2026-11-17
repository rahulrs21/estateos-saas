const { validateAdminArgs } = require('firebase-admin/data-connect');

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
}
exports.AuditTargetType = AuditTargetType;

const CallConsentStatus = {
  NOTICE_GIVEN: "NOTICE_GIVEN",
  GIVEN: "GIVEN",
  DECLINED: "DECLINED",
  WITHDRAWN: "WITHDRAWN",
}
exports.CallConsentStatus = CallConsentStatus;

const CallDirection = {
  OUTBOUND: "OUTBOUND",
  INBOUND: "INBOUND",
}
exports.CallDirection = CallDirection;

const CallMediaStatus = {
  STORED: "STORED",
  DELETED: "DELETED",
}
exports.CallMediaStatus = CallMediaStatus;

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

const CallSuggestionStatus = {
  PENDING: "PENDING",
  ACCEPTED: "ACCEPTED",
  DISMISSED: "DISMISSED",
}
exports.CallSuggestionStatus = CallSuggestionStatus;

const CallSummaryStatus = {
  DRAFT: "DRAFT",
  REVIEWED: "REVIEWED",
  DISMISSED: "DISMISSED",
}
exports.CallSummaryStatus = CallSummaryStatus;

const CallType = {
  SERVICE: "SERVICE",
  FOLLOW_UP: "FOLLOW_UP",
  MARKETING: "MARKETING",
  INBOUND_ENQUIRY: "INBOUND_ENQUIRY",
}
exports.CallType = CallType;

const ChannelConnectionStatus = {
  NOT_CONFIGURED: "NOT_CONFIGURED",
  CONFIGURED: "CONFIGURED",
  VERIFIED: "VERIFIED",
  DISABLED: "DISABLED",
  ERROR: "ERROR",
}
exports.ChannelConnectionStatus = ChannelConnectionStatus;

const ChannelProvider = {
  WHATSAPP_CLOUD: "WHATSAPP_CLOUD",
  GMAIL: "GMAIL",
  MICROSOFT_365: "MICROSOFT_365",
  WEBSITE_FORM: "WEBSITE_FORM",
  INTERNAL: "INTERNAL",
  DEVELOPMENT_SIMULATOR: "DEVELOPMENT_SIMULATOR",
}
exports.ChannelProvider = ChannelProvider;

const CommunicationConnectionStatus = {
  NOT_CONFIGURED: "NOT_CONFIGURED",
  CONFIGURED: "CONFIGURED",
  VERIFIED: "VERIFIED",
  DISABLED: "DISABLED",
  ERROR: "ERROR",
}
exports.CommunicationConnectionStatus = CommunicationConnectionStatus;

const CommunicationProviderType = {
  TWILIO: "TWILIO",
  RETELL: "RETELL",
  PBX: "PBX",
  OTHER_APPROVED_PROVIDER: "OTHER_APPROVED_PROVIDER",
}
exports.CommunicationProviderType = CommunicationProviderType;

const CommunicationSuppressionReason = {
  OPT_OUT: "OPT_OUT",
  DNCR_LISTED: "DNCR_LISTED",
  OFFER_REJECTED: "OFFER_REJECTED",
  WRONG_NUMBER: "WRONG_NUMBER",
  OTHER: "OTHER",
}
exports.CommunicationSuppressionReason = CommunicationSuppressionReason;

const CommunicationSuppressionScope = {
  ALL: "ALL",
  MARKETING: "MARKETING",
}
exports.CommunicationSuppressionScope = CommunicationSuppressionScope;

const InboxAttachmentScan = {
  PENDING: "PENDING",
  CLEAN: "CLEAN",
  BLOCKED: "BLOCKED",
  NOT_SCANNED: "NOT_SCANNED",
}
exports.InboxAttachmentScan = InboxAttachmentScan;

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

const InboxDeliveryStatus = {
  DRAFT: "DRAFT",
  QUEUED: "QUEUED",
  SENT: "SENT",
  DELIVERED: "DELIVERED",
  READ: "READ",
  FAILED: "FAILED",
  RECEIVED: "RECEIVED",
  UNKNOWN: "UNKNOWN",
}
exports.InboxDeliveryStatus = InboxDeliveryStatus;

const InboxDirection = {
  INBOUND: "INBOUND",
  OUTBOUND: "OUTBOUND",
}
exports.InboxDirection = InboxDirection;

const InboxEventStatus = {
  RECEIVED: "RECEIVED",
  PROCESSED: "PROCESSED",
  DUPLICATE: "DUPLICATE",
  FAILED: "FAILED",
  DEAD: "DEAD",
}
exports.InboxEventStatus = InboxEventStatus;

const InboxMailboxSyncState = {
  ACTIVE: "ACTIVE",
  RESYNC: "RESYNC",
  NEEDS_RECONNECT: "NEEDS_RECONNECT",
  DISCONNECTED: "DISCONNECTED",
}
exports.InboxMailboxSyncState = InboxMailboxSyncState;

const InboxMessageType = {
  TEXT: "TEXT",
  IMAGE: "IMAGE",
  DOCUMENT: "DOCUMENT",
  AUDIO: "AUDIO",
  VIDEO: "VIDEO",
  TEMPLATE: "TEMPLATE",
  SYSTEM: "SYSTEM",
  UNKNOWN: "UNKNOWN",
}
exports.InboxMessageType = InboxMessageType;

const InboxPriority = {
  LOW: "LOW",
  NORMAL: "NORMAL",
  HIGH: "HIGH",
  URGENT: "URGENT",
}
exports.InboxPriority = InboxPriority;

const LeadPriority = {
  LOW: "LOW",
  NORMAL: "NORMAL",
  HIGH: "HIGH",
  URGENT: "URGENT",
}
exports.LeadPriority = LeadPriority;

const LeadPropertyViewingStatus = {
  SCHEDULED: "SCHEDULED",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED",
}
exports.LeadPropertyViewingStatus = LeadPropertyViewingStatus;

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

const OutboundStage = {
  DRAFT: "DRAFT",
  VALIDATED: "VALIDATED",
  PENDING_APPROVAL: "PENDING_APPROVAL",
  APPROVED: "APPROVED",
  QUEUED: "QUEUED",
  SENT: "SENT",
  FAILED: "FAILED",
  CANCELLED: "CANCELLED",
}
exports.OutboundStage = OutboundStage;

const PhoneLinePurpose = {
  SALES: "SALES",
  SUPPORT: "SUPPORT",
  MARKETING: "MARKETING",
  VOICE_ASSISTANT: "VOICE_ASSISTANT",
}
exports.PhoneLinePurpose = PhoneLinePurpose;

const PhoneLineStatus = {
  PENDING: "PENDING",
  ACTIVE: "ACTIVE",
  DISABLED: "DISABLED",
}
exports.PhoneLineStatus = PhoneLineStatus;

const TransactionType = {
  BUY: "BUY",
  RENT: "RENT",
  INVEST: "INVEST",
}
exports.TransactionType = TransactionType;

const TranscriptSource = {
  UPLOAD: "UPLOAD",
  PROVIDER: "PROVIDER",
}
exports.TranscriptSource = TranscriptSource;

const VoiceAssistantStatus = {
  DRAFT: "DRAFT",
  TEST_ONLY: "TEST_ONLY",
}
exports.VoiceAssistantStatus = VoiceAssistantStatus;

const VoiceTestSessionStatus = {
  ACTIVE: "ACTIVE",
  HANDED_OFF: "HANDED_OFF",
  ENDED: "ENDED",
  LIMIT_REACHED: "LIMIT_REACHED",
}
exports.VoiceTestSessionStatus = VoiceTestSessionStatus;

const connectorConfig = {
  connector: 'messaging',
  serviceId: 'estateos',
  location: 'us-east4'
};
exports.connectorConfig = connectorConfig;

function listCallSummaries(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ListCallSummaries', inputVars, inputOpts);
}
exports.listCallSummaries = listCallSummaries;

function createCallAiSummary(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('CreateCallAiSummary', inputVars, inputOpts);
}
exports.createCallAiSummary = createCallAiSummary;

function createCallAiSuggestion(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('CreateCallAiSuggestion', inputVars, inputOpts);
}
exports.createCallAiSuggestion = createCallAiSuggestion;

function reviewCallAiSummary(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('ReviewCallAiSummary', inputVars, inputOpts);
}
exports.reviewCallAiSummary = reviewCallAiSummary;

function decideCallAiSuggestion(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('DecideCallAiSuggestion', inputVars, inputOpts);
}
exports.decideCallAiSuggestion = decideCallAiSuggestion;

function getCallAiSuggestion(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('GetCallAiSuggestion', inputVars, inputOpts);
}
exports.getCallAiSuggestion = getCallAiSuggestion;

function getCallMedia(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('GetCallMedia', inputVars, inputOpts);
}
exports.getCallMedia = getCallMedia;

function recordCallConsent(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('RecordCallConsent', inputVars, inputOpts);
}
exports.recordCallConsent = recordCallConsent;

function withdrawCallConsent(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('WithdrawCallConsent', inputVars, inputOpts);
}
exports.withdrawCallConsent = withdrawCallConsent;

function createCallRecording(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('CreateCallRecording', inputVars, inputOpts);
}
exports.createCallRecording = createCallRecording;

function createCallTranscript(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('CreateCallTranscript', inputVars, inputOpts);
}
exports.createCallTranscript = createCallTranscript;

function deleteCallRecording(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('DeleteCallRecording', inputVars, inputOpts);
}
exports.deleteCallRecording = deleteCallRecording;

function deleteCallTranscript(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('DeleteCallTranscript', inputVars, inputOpts);
}
exports.deleteCallTranscript = deleteCallTranscript;

function getCallRecordingFile(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('GetCallRecordingFile', inputVars, inputOpts);
}
exports.getCallRecordingFile = getCallRecordingFile;

function getCallTranscriptFile(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('GetCallTranscriptFile', inputVars, inputOpts);
}
exports.getCallTranscriptFile = getCallTranscriptFile;

function recordCallMediaAccess(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('RecordCallMediaAccess', inputVars, inputOpts);
}
exports.recordCallMediaAccess = recordCallMediaAccess;

function callMediaToRemove(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('CallMediaToRemove', inputVars, inputOpts);
}
exports.callMediaToRemove = callMediaToRemove;

function expireCallRecording(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('ExpireCallRecording', inputVars, inputOpts);
}
exports.expireCallRecording = expireCallRecording;

function expireCallTranscript(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('ExpireCallTranscript', inputVars, inputOpts);
}
exports.expireCallTranscript = expireCallTranscript;

function markCallMediaFileDeleted(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('MarkCallMediaFileDeleted', inputVars, inputOpts);
}
exports.markCallMediaFileDeleted = markCallMediaFileDeleted;

function deletedCallMediaFile(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('DeletedCallMediaFile', inputVars, inputOpts);
}
exports.deletedCallMediaFile = deletedCallMediaFile;

function listMeetings(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ListMeetings', inputVars, inputOpts);
}
exports.listMeetings = listMeetings;

function getMeeting(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('GetMeeting', inputVars, inputOpts);
}
exports.getMeeting = getMeeting;

function createMeeting(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('CreateMeeting', inputVars, inputOpts);
}
exports.createMeeting = createMeeting;

function addMeetingAttendee(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('AddMeetingAttendee', inputVars, inputOpts);
}
exports.addMeetingAttendee = addMeetingAttendee;

function removeMeetingAttendee(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('RemoveMeetingAttendee', inputVars, inputOpts);
}
exports.removeMeetingAttendee = removeMeetingAttendee;

function updateMeeting(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('UpdateMeeting', inputVars, inputOpts);
}
exports.updateMeeting = updateMeeting;

function completeMeeting(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('CompleteMeeting', inputVars, inputOpts);
}
exports.completeMeeting = completeMeeting;

function setMeetingStatus(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('SetMeetingStatus', inputVars, inputOpts);
}
exports.setMeetingStatus = setMeetingStatus;

function saveMeetingSummary(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('SaveMeetingSummary', inputVars, inputOpts);
}
exports.saveMeetingSummary = saveMeetingSummary;

function decideMeetingSuggestion(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('DecideMeetingSuggestion', inputVars, inputOpts);
}
exports.decideMeetingSuggestion = decideMeetingSuggestion;

function listMeetingAttendeeOptions(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ListMeetingAttendeeOptions', inputVars, inputOpts);
}
exports.listMeetingAttendeeOptions = listMeetingAttendeeOptions;

function listCommunicationProviders(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ListCommunicationProviders', inputVars, inputOpts);
}
exports.listCommunicationProviders = listCommunicationProviders;

function createCommunicationProvider(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('CreateCommunicationProvider', inputVars, inputOpts);
}
exports.createCommunicationProvider = createCommunicationProvider;

function updateCommunicationProvider(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('UpdateCommunicationProvider', inputVars, inputOpts);
}
exports.updateCommunicationProvider = updateCommunicationProvider;

function setCommunicationProviderEnabled(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('SetCommunicationProviderEnabled', inputVars, inputOpts);
}
exports.setCommunicationProviderEnabled = setCommunicationProviderEnabled;

function recordCommunicationProviderVerification(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('RecordCommunicationProviderVerification', inputVars, inputOpts);
}
exports.recordCommunicationProviderVerification = recordCommunicationProviderVerification;

function attestLiveCalling(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('AttestLiveCalling', inputVars, inputOpts);
}
exports.attestLiveCalling = attestLiveCalling;

function revokeLiveCallingAttestation(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('RevokeLiveCallingAttestation', inputVars, inputOpts);
}
exports.revokeLiveCallingAttestation = revokeLiveCallingAttestation;

function createCommunicationPhoneLine(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('CreateCommunicationPhoneLine', inputVars, inputOpts);
}
exports.createCommunicationPhoneLine = createCommunicationPhoneLine;

function updateCommunicationPhoneLine(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('UpdateCommunicationPhoneLine', inputVars, inputOpts);
}
exports.updateCommunicationPhoneLine = updateCommunicationPhoneLine;

function confirmPhoneLineRegistration(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('ConfirmPhoneLineRegistration', inputVars, inputOpts);
}
exports.confirmPhoneLineRegistration = confirmPhoneLineRegistration;

function setPhoneLineActive(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('SetPhoneLineActive', inputVars, inputOpts);
}
exports.setPhoneLineActive = setPhoneLineActive;

function providerConnectionForWebhook(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ProviderConnectionForWebhook', inputVars, inputOpts);
}
exports.providerConnectionForWebhook = providerConnectionForWebhook;

function recordCallProviderEvent(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('RecordCallProviderEvent', inputVars, inputOpts);
}
exports.recordCallProviderEvent = recordCallProviderEvent;

function markCallProviderEvent(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('MarkCallProviderEvent', inputVars, inputOpts);
}
exports.markCallProviderEvent = markCallProviderEvent;

function resolveProviderCall(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ResolveProviderCall', inputVars, inputOpts);
}
exports.resolveProviderCall = resolveProviderCall;

function createIncomingProviderCall(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('CreateIncomingProviderCall', inputVars, inputOpts);
}
exports.createIncomingProviderCall = createIncomingProviderCall;

function applyProviderCallStatus(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('ApplyProviderCallStatus', inputVars, inputOpts);
}
exports.applyProviderCallStatus = applyProviderCallStatus;

function setProviderCallId(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('SetProviderCallId', inputVars, inputOpts);
}
exports.setProviderCallId = setProviderCallId;

function providerCallForControl(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ProviderCallForControl', inputVars, inputOpts);
}
exports.providerCallForControl = providerCallForControl;

function dialFacts(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('DialFacts', inputVars, inputOpts);
}
exports.dialFacts = dialFacts;

function startLeadCall(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('StartLeadCall', inputVars, inputOpts);
}
exports.startLeadCall = startLeadCall;

function listCalls(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ListCalls', inputVars, inputOpts);
}
exports.listCalls = listCalls;

function communicationDashboard(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('CommunicationDashboard', inputVars, inputOpts);
}
exports.communicationDashboard = communicationDashboard;

function communicationReport(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('CommunicationReport', inputVars, inputOpts);
}
exports.communicationReport = communicationReport;

function communicationSimulationState(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('CommunicationSimulationState', inputVars, inputOpts);
}
exports.communicationSimulationState = communicationSimulationState;

function registerSimulationLead(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('RegisterSimulationLead', inputVars, inputOpts);
}
exports.registerSimulationLead = registerSimulationLead;

function createSimulatedCall(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('CreateSimulatedCall', inputVars, inputOpts);
}
exports.createSimulatedCall = createSimulatedCall;

function applySimulatedCallStatus(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('ApplySimulatedCallStatus', inputVars, inputOpts);
}
exports.applySimulatedCallStatus = applySimulatedCallStatus;

function simulatedCallFiles(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('SimulatedCallFiles', inputVars, inputOpts);
}
exports.simulatedCallFiles = simulatedCallFiles;

function resetCommunicationSimulation(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('ResetCommunicationSimulation', inputVars, inputOpts);
}
exports.resetCommunicationSimulation = resetCommunicationSimulation;

function getVoiceAssistant(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('GetVoiceAssistant', inputVars, inputOpts);
}
exports.getVoiceAssistant = getVoiceAssistant;

function createVoiceAssistantConfig(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('CreateVoiceAssistantConfig', inputVars, inputOpts);
}
exports.createVoiceAssistantConfig = createVoiceAssistantConfig;

function updateVoiceAssistantConfig(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('UpdateVoiceAssistantConfig', inputVars, inputOpts);
}
exports.updateVoiceAssistantConfig = updateVoiceAssistantConfig;

function getVoiceTestSession(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('GetVoiceTestSession', inputVars, inputOpts);
}
exports.getVoiceTestSession = getVoiceTestSession;

function startVoiceTestSession(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('StartVoiceTestSession', inputVars, inputOpts);
}
exports.startVoiceTestSession = startVoiceTestSession;

function saveVoiceTestSession(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('SaveVoiceTestSession', inputVars, inputOpts);
}
exports.saveVoiceTestSession = saveVoiceTestSession;

function logLeadCall(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('LogLeadCall', inputVars, inputOpts);
}
exports.logLeadCall = logLeadCall;

function logContactCall(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('LogContactCall', inputVars, inputOpts);
}
exports.logContactCall = logContactCall;

function updateCallRecord(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('UpdateCallRecord', inputVars, inputOpts);
}
exports.updateCallRecord = updateCallRecord;

function linkCallFollowUp(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('LinkCallFollowUp', inputVars, inputOpts);
}
exports.linkCallFollowUp = linkCallFollowUp;

function getCallRecord(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('GetCallRecord', inputVars, inputOpts);
}
exports.getCallRecord = getCallRecord;

function listLeadCalls(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ListLeadCalls', inputVars, inputOpts);
}
exports.listLeadCalls = listLeadCalls;

function listContactCalls(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ListContactCalls', inputVars, inputOpts);
}
exports.listContactCalls = listContactCalls;

function callComplianceFacts(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('CallComplianceFacts', inputVars, inputOpts);
}
exports.callComplianceFacts = callComplianceFacts;

function getCommunicationSettings(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('GetCommunicationSettings', inputVars, inputOpts);
}
exports.getCommunicationSettings = getCommunicationSettings;

function createCommunicationSettings(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('CreateCommunicationSettings', inputVars, inputOpts);
}
exports.createCommunicationSettings = createCommunicationSettings;

function updateCommunicationSettings(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('UpdateCommunicationSettings', inputVars, inputOpts);
}
exports.updateCommunicationSettings = updateCommunicationSettings;

function listCommunicationSuppressions(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ListCommunicationSuppressions', inputVars, inputOpts);
}
exports.listCommunicationSuppressions = listCommunicationSuppressions;

function addCommunicationSuppression(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('AddCommunicationSuppression', inputVars, inputOpts);
}
exports.addCommunicationSuppression = addCommunicationSuppression;

function withdrawCommunicationSuppression(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('WithdrawCommunicationSuppression', inputVars, inputOpts);
}
exports.withdrawCommunicationSuppression = withdrawCommunicationSuppression;

function inboxReplyFacts(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('InboxReplyFacts', inputVars, inputOpts);
}
exports.inboxReplyFacts = inboxReplyFacts;

function inboxContactRestrictions(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('InboxContactRestrictions', inputVars, inputOpts);
}
exports.inboxContactRestrictions = inboxContactRestrictions;

function queueInboxReply(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('QueueInboxReply', inputVars, inputOpts);
}
exports.queueInboxReply = queueInboxReply;

function acknowledgeInboxReply(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('AcknowledgeInboxReply', inputVars, inputOpts);
}
exports.acknowledgeInboxReply = acknowledgeInboxReply;

function failInboxReply(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('FailInboxReply', inputVars, inputOpts);
}
exports.failInboxReply = failInboxReply;

function saveInboxAiInsight(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('SaveInboxAiInsight', inputVars, inputOpts);
}
exports.saveInboxAiInsight = saveInboxAiInsight;

function inboxUnansweredMinutes(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('InboxUnansweredMinutes', inputVars, inputOpts);
}
exports.inboxUnansweredMinutes = inboxUnansweredMinutes;

function unansweredInboxCandidates(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('UnansweredInboxCandidates', inputVars, inputOpts);
}
exports.unansweredInboxCandidates = unansweredInboxCandidates;

function automationConversationState(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('AutomationConversationState', inputVars, inputOpts);
}
exports.automationConversationState = automationConversationState;

function inboxRetentionRules(dcOrOptions, options) {
  const { dc: dcInstance, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrOptions, options, undefined);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('InboxRetentionRules', undefined, inputOpts);
}
exports.inboxRetentionRules = inboxRetentionRules;

function inboxRetentionCandidates(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('InboxRetentionCandidates', inputVars, inputOpts);
}
exports.inboxRetentionCandidates = inboxRetentionCandidates;

function applyInboxRetention(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('ApplyInboxRetention', inputVars, inputOpts);
}
exports.applyInboxRetention = applyInboxRetention;

function emailReplyThread(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('EmailReplyThread', inputVars, inputOpts);
}
exports.emailReplyThread = emailReplyThread;

function inboxInsightDraft(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('InboxInsightDraft', inputVars, inputOpts);
}
exports.inboxInsightDraft = inboxInsightDraft;

function createClaudeReplyFromInsight(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('CreateClaudeReplyFromInsight', inputVars, inputOpts);
}
exports.createClaudeReplyFromInsight = createClaudeReplyFromInsight;

function matchInboxIdentity(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('MatchInboxIdentity', inputVars, inputOpts);
}
exports.matchInboxIdentity = matchInboxIdentity;

function findInboxConversation(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('FindInboxConversation', inputVars, inputOpts);
}
exports.findInboxConversation = findInboxConversation;

function createInboxConversationWithMessage(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('CreateInboxConversationWithMessage', inputVars, inputOpts);
}
exports.createInboxConversationWithMessage = createInboxConversationWithMessage;

function appendInboxMessage(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('AppendInboxMessage', inputVars, inputOpts);
}
exports.appendInboxMessage = appendInboxMessage;

function mailboxActor(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('MailboxActor', inputVars, inputOpts);
}
exports.mailboxActor = mailboxActor;

function mailboxConflicts(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('MailboxConflicts', inputVars, inputOpts);
}
exports.mailboxConflicts = mailboxConflicts;

function saveMailboxConnection(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('SaveMailboxConnection', inputVars, inputOpts);
}
exports.saveMailboxConnection = saveMailboxConnection;

function mailboxesOverview(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('MailboxesOverview', inputVars, inputOpts);
}
exports.mailboxesOverview = mailboxesOverview;

function mailboxForAction(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('MailboxForAction', inputVars, inputOpts);
}
exports.mailboxForAction = mailboxForAction;

function disconnectMailbox(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('DisconnectMailbox', inputVars, inputOpts);
}
exports.disconnectMailbox = disconnectMailbox;

function setMailboxSending(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('SetMailboxSending', inputVars, inputOpts);
}
exports.setMailboxSending = setMailboxSending;

function dueMailboxes(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('DueMailboxes', inputVars, inputOpts);
}
exports.dueMailboxes = dueMailboxes;

function claimMailboxSync(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('ClaimMailboxSync', inputVars, inputOpts);
}
exports.claimMailboxSync = claimMailboxSync;

function finishMailboxSync(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('FinishMailboxSync', inputVars, inputOpts);
}
exports.finishMailboxSync = finishMailboxSync;

function failMailboxSync(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('FailMailboxSync', inputVars, inputOpts);
}
exports.failMailboxSync = failMailboxSync;

function retireMailbox(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('RetireMailbox', inputVars, inputOpts);
}
exports.retireMailbox = retireMailbox;

function requestMailboxSync(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('RequestMailboxSync', inputVars, inputOpts);
}
exports.requestMailboxSync = requestMailboxSync;

function mailboxSyncRow(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('MailboxSyncRow', inputVars, inputOpts);
}
exports.mailboxSyncRow = mailboxSyncRow;

function setInboxMessageHtml(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('SetInboxMessageHtml', inputVars, inputOpts);
}
exports.setInboxMessageHtml = setInboxMessageHtml;

function updateMailboxToken(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('UpdateMailboxToken', inputVars, inputOpts);
}
exports.updateMailboxToken = updateMailboxToken;

function knownMailboxMessages(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('KnownMailboxMessages', inputVars, inputOpts);
}
exports.knownMailboxMessages = knownMailboxMessages;

function listInboxReplies(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ListInboxReplies', inputVars, inputOpts);
}
exports.listInboxReplies = listInboxReplies;

function createInboxReplyDraft(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('CreateInboxReplyDraft', inputVars, inputOpts);
}
exports.createInboxReplyDraft = createInboxReplyDraft;

function updateInboxReplyDraft(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('UpdateInboxReplyDraft', inputVars, inputOpts);
}
exports.updateInboxReplyDraft = updateInboxReplyDraft;

function recordInboxReplyCheck(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('RecordInboxReplyCheck', inputVars, inputOpts);
}
exports.recordInboxReplyCheck = recordInboxReplyCheck;

function submitInboxReply(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('SubmitInboxReply', inputVars, inputOpts);
}
exports.submitInboxReply = submitInboxReply;

function decideInboxReply(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('DecideInboxReply', inputVars, inputOpts);
}
exports.decideInboxReply = decideInboxReply;

function cancelInboxReply(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('CancelInboxReply', inputVars, inputOpts);
}
exports.cancelInboxReply = cancelInboxReply;

function deleteInboxReply(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('DeleteInboxReply', inputVars, inputOpts);
}
exports.deleteInboxReply = deleteInboxReply;

function listChannelConnections(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ListChannelConnections', inputVars, inputOpts);
}
exports.listChannelConnections = listChannelConnections;

function createChannelConnection(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('CreateChannelConnection', inputVars, inputOpts);
}
exports.createChannelConnection = createChannelConnection;

function updateChannelConnection(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('UpdateChannelConnection', inputVars, inputOpts);
}
exports.updateChannelConnection = updateChannelConnection;

function saveChannelAccessToken(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('SaveChannelAccessToken', inputVars, inputOpts);
}
exports.saveChannelAccessToken = saveChannelAccessToken;

function channelAccessToken(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ChannelAccessToken', inputVars, inputOpts);
}
exports.channelAccessToken = channelAccessToken;

function setChannelConnectionEnabled(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('SetChannelConnectionEnabled', inputVars, inputOpts);
}
exports.setChannelConnectionEnabled = setChannelConnectionEnabled;

function channelConnectionForCheck(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ChannelConnectionForCheck', inputVars, inputOpts);
}
exports.channelConnectionForCheck = channelConnectionForCheck;

function markChannelConnectionChecked(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('MarkChannelConnectionChecked', inputVars, inputOpts);
}
exports.markChannelConnectionChecked = markChannelConnectionChecked;

function setChannelConnectionSending(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('SetChannelConnectionSending', inputVars, inputOpts);
}
exports.setChannelConnectionSending = setChannelConnectionSending;

function setChannelConnectionLiveSending(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('SetChannelConnectionLiveSending', inputVars, inputOpts);
}
exports.setChannelConnectionLiveSending = setChannelConnectionLiveSending;

function startWhatsAppConversation(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('StartWhatsAppConversation', inputVars, inputOpts);
}
exports.startWhatsAppConversation = startWhatsAppConversation;

function inboxWebhookConnection(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('InboxWebhookConnection', inputVars, inputOpts);
}
exports.inboxWebhookConnection = inboxWebhookConnection;

function recordInboxEvent(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('RecordInboxEvent', inputVars, inputOpts);
}
exports.recordInboxEvent = recordInboxEvent;

function completeInboxEvent(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('CompleteInboxEvent', inputVars, inputOpts);
}
exports.completeInboxEvent = completeInboxEvent;

function failInboxEvent(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('FailInboxEvent', inputVars, inputOpts);
}
exports.failInboxEvent = failInboxEvent;

function pendingInboxEvents(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('PendingInboxEvents', inputVars, inputOpts);
}
exports.pendingInboxEvents = pendingInboxEvents;

function inboxMessageByExternalId(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('InboxMessageByExternalId', inputVars, inputOpts);
}
exports.inboxMessageByExternalId = inboxMessageByExternalId;

function applyInboxDeliveryStatus(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('ApplyInboxDeliveryStatus', inputVars, inputOpts);
}
exports.applyInboxDeliveryStatus = applyInboxDeliveryStatus;

function createInboxAttachment(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('CreateInboxAttachment', inputVars, inputOpts);
}
exports.createInboxAttachment = createInboxAttachment;

function channelAccountInUse(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ChannelAccountInUse', inputVars, inputOpts);
}
exports.channelAccountInUse = channelAccountInUse;

function whatsAppTemplateConnection(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('WhatsAppTemplateConnection', inputVars, inputOpts);
}
exports.whatsAppTemplateConnection = whatsAppTemplateConnection;

function pendingInboxMedia(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('PendingInboxMedia', inputVars, inputOpts);
}
exports.pendingInboxMedia = pendingInboxMedia;

function claimInboxMediaFetch(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('ClaimInboxMediaFetch', inputVars, inputOpts);
}
exports.claimInboxMediaFetch = claimInboxMediaFetch;

function storeInboxMedia(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('StoreInboxMedia', inputVars, inputOpts);
}
exports.storeInboxMedia = storeInboxMedia;

function failInboxMedia(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('FailInboxMedia', inputVars, inputOpts);
}
exports.failInboxMedia = failInboxMedia;

function inboxSimulatorChannel(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('InboxSimulatorChannel', inputVars, inputOpts);
}
exports.inboxSimulatorChannel = inboxSimulatorChannel;

function createInboxSimulatorChannel(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('CreateInboxSimulatorChannel', inputVars, inputOpts);
}
exports.createInboxSimulatorChannel = createInboxSimulatorChannel;

function markInboxLeadConversationsSimulated(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('MarkInboxLeadConversationsSimulated', inputVars, inputOpts);
}
exports.markInboxLeadConversationsSimulated = markInboxLeadConversationsSimulated;

function resetInboxSimulation(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('ResetInboxSimulation', inputVars, inputOpts);
}
exports.resetInboxSimulation = resetInboxSimulation;

function inboxSimulatedOutbound(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('InboxSimulatedOutbound', inputVars, inputOpts);
}
exports.inboxSimulatedOutbound = inboxSimulatedOutbound;

function listInboxConversations(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ListInboxConversations', inputVars, inputOpts);
}
exports.listInboxConversations = listInboxConversations;

function inboxCounts(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('InboxCounts', inputVars, inputOpts);
}
exports.inboxCounts = inboxCounts;

function getInboxConversation(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('GetInboxConversation', inputVars, inputOpts);
}
exports.getInboxConversation = getInboxConversation;

function listInboxMessages(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ListInboxMessages', inputVars, inputOpts);
}
exports.listInboxMessages = listInboxMessages;

function assignInboxConversation(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('AssignInboxConversation', inputVars, inputOpts);
}
exports.assignInboxConversation = assignInboxConversation;

function setInboxConversationState(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('SetInboxConversationState', inputVars, inputOpts);
}
exports.setInboxConversationState = setInboxConversationState;

function linkInboxConversation(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('LinkInboxConversation', inputVars, inputOpts);
}
exports.linkInboxConversation = linkInboxConversation;

function addInboxNote(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('AddInboxNote', inputVars, inputOpts);
}
exports.addInboxNote = addInboxNote;

function openInboxAttachment(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('OpenInboxAttachment', inputVars, inputOpts);
}
exports.openInboxAttachment = openInboxAttachment;

function markInboxConversationRead(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('MarkInboxConversationRead', inputVars, inputOpts);
}
exports.markInboxConversationRead = markInboxConversationRead;

function getInboxSettings(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('GetInboxSettings', inputVars, inputOpts);
}
exports.getInboxSettings = getInboxSettings;

function saveInboxSettings(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('SaveInboxSettings', inputVars, inputOpts);
}
exports.saveInboxSettings = saveInboxSettings;

function inboxLinkTarget(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('InboxLinkTarget', inputVars, inputOpts);
}
exports.inboxLinkTarget = inboxLinkTarget;

function inboxAssignees(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('InboxAssignees', inputVars, inputOpts);
}
exports.inboxAssignees = inboxAssignees;

function inboxCustomerContext(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('InboxCustomerContext', inputVars, inputOpts);
}
exports.inboxCustomerContext = inboxCustomerContext;

function getInboxMessageHtml(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('GetInboxMessageHtml', inputVars, inputOpts);
}
exports.getInboxMessageHtml = getInboxMessageHtml;

