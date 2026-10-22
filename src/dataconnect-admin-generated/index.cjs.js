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
}
exports.ActivityKind = ActivityKind;

const AgentAvailabilityStatus = {
  AVAILABLE: "AVAILABLE",
  UNAVAILABLE: "UNAVAILABLE",
}
exports.AgentAvailabilityStatus = AgentAvailabilityStatus;

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
}
exports.AuditTargetType = AuditTargetType;

const CompanySize = {
  SOLO: "SOLO",
  TWO_TO_TEN: "TWO_TO_TEN",
  ELEVEN_TO_FIFTY: "ELEVEN_TO_FIFTY",
  FIFTY_ONE_TO_TWO_HUNDRED: "FIFTY_ONE_TO_TWO_HUNDRED",
  TWO_HUNDRED_PLUS: "TWO_HUNDRED_PLUS",
}
exports.CompanySize = CompanySize;

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

const InAppNotificationType = {
  LEAD_ASSIGNED: "LEAD_ASSIGNED",
  LEAD_UNASSIGNED: "LEAD_UNASSIGNED",
}
exports.InAppNotificationType = InAppNotificationType;

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

