import { validateAdminArgs } from 'firebase-admin/data-connect';

export const ActivityKind = {
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

export const AgentAvailabilityStatus = {
  AVAILABLE: "AVAILABLE",
  UNAVAILABLE: "UNAVAILABLE",
}

export const AuditTargetType = {
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

export const CompanySize = {
  SOLO: "SOLO",
  TWO_TO_TEN: "TWO_TO_TEN",
  ELEVEN_TO_FIFTY: "ELEVEN_TO_FIFTY",
  FIFTY_ONE_TO_TWO_HUNDRED: "FIFTY_ONE_TO_TWO_HUNDRED",
  TWO_HUNDRED_PLUS: "TWO_HUNDRED_PLUS",
}

export const Emirate = {
  ABU_DHABI: "ABU_DHABI",
  DUBAI: "DUBAI",
  SHARJAH: "SHARJAH",
  AJMAN: "AJMAN",
  UMM_AL_QUWAIN: "UMM_AL_QUWAIN",
  RAS_AL_KHAIMAH: "RAS_AL_KHAIMAH",
  FUJAIRAH: "FUJAIRAH",
}

export const InAppNotificationType = {
  LEAD_ASSIGNED: "LEAD_ASSIGNED",
  LEAD_UNASSIGNED: "LEAD_UNASSIGNED",
}

export const InvitationDeliveryStatus = {
  NOT_SENT: "NOT_SENT",
  PREVIEW: "PREVIEW",
  ACCEPTED: "ACCEPTED",
  FAILED: "FAILED",
}

export const InvitationStatus = {
  PENDING: "PENDING",
  ACCEPTED: "ACCEPTED",
  REVOKED: "REVOKED",
}

export const LeadAssignmentType = {
  INITIAL: "INITIAL",
  MANUAL: "MANUAL",
  ROUND_ROBIN: "ROUND_ROBIN",
  REASSIGNMENT: "REASSIGNMENT",
}

export const LeadCaptureFormStatus = {
  DRAFT: "DRAFT",
  ACTIVE: "ACTIVE",
  DISABLED: "DISABLED",
}

export const LeadDistributionMode = {
  MANUAL: "MANUAL",
  ROUND_ROBIN: "ROUND_ROBIN",
}

export const LeadFollowUpStatus = {
  PENDING: "PENDING",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED",
}

export const LeadPriority = {
  LOW: "LOW",
  NORMAL: "NORMAL",
  HIGH: "HIGH",
  URGENT: "URGENT",
}

export const LeadSourceType = {
  MANUAL: "MANUAL",
  REFERRAL: "REFERRAL",
  WEBSITE: "WEBSITE",
  PORTAL: "PORTAL",
  OTHER: "OTHER",
}

export const LeadStatus = {
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

export const MembershipRole = {
  OWNER: "OWNER",
  ADMIN: "ADMIN",
  MANAGER: "MANAGER",
  AGENT: "AGENT",
}

export const MembershipStatus = {
  INVITED: "INVITED",
  PENDING: "PENDING",
  ACTIVE: "ACTIVE",
  SUSPENDED: "SUSPENDED",
  REVOKED: "REVOKED",
  REMOVED: "REMOVED",
}

export const NotificationAudience = {
  MEMBER: "MEMBER",
  ADMIN: "ADMIN",
}

export const TransactionType = {
  BUY: "BUY",
  RENT: "RENT",
  INVEST: "INVEST",
}

export const connectorConfig = {
  connector: 'example',
  serviceId: 'estateos',
  location: 'us-east4'
};

export function initializeLeadPipeline(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('InitializeLeadPipeline', inputVars, inputOpts);
}

export function createContact(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('CreateContact', inputVars, inputOpts);
}

export function updateContact(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('UpdateContact', inputVars, inputOpts);
}

export function createLead(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('CreateLead', inputVars, inputOpts);
}

export function createLeadForContact(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('CreateLeadForContact', inputVars, inputOpts);
}

export function updateLead(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('UpdateLead', inputVars, inputOpts);
}

export function changeLeadStatus(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('ChangeLeadStatus', inputVars, inputOpts);
}

export function moveLeadStage(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('MoveLeadStage', inputVars, inputOpts);
}

export function assignLead(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('AssignLead', inputVars, inputOpts);
}

export function unassignLead(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('UnassignLead', inputVars, inputOpts);
}

export function saveLeadDistributionSettings(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('SaveLeadDistributionSettings', inputVars, inputOpts);
}

export function setAgentAvailability(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('SetAgentAvailability', inputVars, inputOpts);
}

export function markInAppNotificationRead(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('MarkInAppNotificationRead', inputVars, inputOpts);
}

export function addLeadNote(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('AddLeadNote', inputVars, inputOpts);
}

export function archiveLead(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('ArchiveLead', inputVars, inputOpts);
}

export function scheduleLeadFollowUp(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('ScheduleLeadFollowUp', inputVars, inputOpts);
}

export function completeLeadFollowUp(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('CompleteLeadFollowUp', inputVars, inputOpts);
}

export function upsertMyProfile(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('UpsertMyProfile', inputVars, inputOpts);
}

export function createOrganization(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('CreateOrganization', inputVars, inputOpts);
}

export function updateOrganization(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('UpdateOrganization', inputVars, inputOpts);
}

export function switchOrganization(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('SwitchOrganization', inputVars, inputOpts);
}

export function createBranch(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('CreateBranch', inputVars, inputOpts);
}

export function inviteMembership(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('InviteMembership', inputVars, inputOpts);
}

export function acceptInvitation(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('AcceptInvitation', inputVars, inputOpts);
}

export function approveMembership(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('ApproveMembership', inputVars, inputOpts);
}

export function setMembershipStatus(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('SetMembershipStatus', inputVars, inputOpts);
}

export function revokeInvitation(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('RevokeInvitation', inputVars, inputOpts);
}

export function reissueInvitation(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('ReissueInvitation', inputVars, inputOpts);
}

export function reinviteRevokedInvitation(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('ReinviteRevokedInvitation', inputVars, inputOpts);
}

export function recordInvitationDelivery(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('RecordInvitationDelivery', inputVars, inputOpts);
}

export function setMembershipRole(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('SetMembershipRole', inputVars, inputOpts);
}

export function createLeadCaptureForm(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('CreateLeadCaptureForm', inputVars, inputOpts);
}

export function updateLeadCaptureForm(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('UpdateLeadCaptureForm', inputVars, inputOpts);
}

export function consumeWebsiteLeadCaptureRateWindow(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('ConsumeWebsiteLeadCaptureRateWindow', inputVars, inputOpts);
}

export function submitWebsiteLeadCapture(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('SubmitWebsiteLeadCapture', inputVars, inputOpts);
}

export function getMyProfile(dcOrOptions, options) {
  const { dc: dcInstance, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrOptions, options, undefined);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('GetMyProfile', undefined, inputOpts);
}

export function listMyOrganizations(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, false);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ListMyOrganizations', inputVars, inputOpts);
}

export function getMyPendingInvitations(dcOrOptions, options) {
  const { dc: dcInstance, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrOptions, options, undefined);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('GetMyPendingInvitations', undefined, inputOpts);
}

export function getOrganizationContext(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('GetOrganizationContext', inputVars, inputOpts);
}

export function listBranches(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ListBranches', inputVars, inputOpts);
}

export function listMemberships(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ListMemberships', inputVars, inputOpts);
}

export function listLeads(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ListLeads', inputVars, inputOpts);
}

export function listLeadsCreatedAsc(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ListLeadsCreatedAsc', inputVars, inputOpts);
}

export function listLeadsUpdatedDesc(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ListLeadsUpdatedDesc', inputVars, inputOpts);
}

export function listLeadsNameAsc(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ListLeadsNameAsc', inputVars, inputOpts);
}

export function listLeadsNameDesc(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ListLeadsNameDesc', inputVars, inputOpts);
}

export function listLeadsFollowUpAsc(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ListLeadsFollowUpAsc', inputVars, inputOpts);
}

export function getLead(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('GetLead', inputVars, inputOpts);
}

export function listLeadAssignees(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ListLeadAssignees', inputVars, inputOpts);
}

export function getLeadDistributionPlan(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('GetLeadDistributionPlan', inputVars, inputOpts);
}

export function getMyAgentAvailability(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('GetMyAgentAvailability', inputVars, inputOpts);
}

export function listInAppNotifications(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ListInAppNotifications', inputVars, inputOpts);
}

export function listLeadActivities(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ListLeadActivities', inputVars, inputOpts);
}

export function listActivities(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ListActivities', inputVars, inputOpts);
}

export function getTeamMembershipByEmail(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('GetTeamMembershipByEmail', inputVars, inputOpts);
}

export function listInvitations(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ListInvitations', inputVars, inputOpts);
}

export function listTeamMembers(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ListTeamMembers', inputVars, inputOpts);
}

export function listAuditLogs(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ListAuditLogs', inputVars, inputOpts);
}

export function getLeadConfiguration(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('GetLeadConfiguration', inputVars, inputOpts);
}

export function searchContacts(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('SearchContacts', inputVars, inputOpts);
}

export function getContact(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('GetContact', inputVars, inputOpts);
}

export function findDuplicateContacts(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('FindDuplicateContacts', inputVars, inputOpts);
}

export function getLeadCrmHistory(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('GetLeadCrmHistory', inputVars, inputOpts);
}

export function getLeadMetrics(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('GetLeadMetrics', inputVars, inputOpts);
}

export function listLeadFollowUps(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ListLeadFollowUps', inputVars, inputOpts);
}

export function listLeadCaptureForms(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ListLeadCaptureForms', inputVars, inputOpts);
}

export function getLeadCaptureForm(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('GetLeadCaptureForm', inputVars, inputOpts);
}

export function resolveWebsiteLeadCaptureForm(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ResolveWebsiteLeadCaptureForm', inputVars, inputOpts);
}

export function findWebsiteLeadCaptureContact(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('FindWebsiteLeadCaptureContact', inputVars, inputOpts);
}

export function getWebsiteLeadCaptureRateWindow(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('GetWebsiteLeadCaptureRateWindow', inputVars, inputOpts);
}

export function findWebsiteLeadCaptureSubmission(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('FindWebsiteLeadCaptureSubmission', inputVars, inputOpts);
}

export function getWebsiteLeadDistributionPlan(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('GetWebsiteLeadDistributionPlan', inputVars, inputOpts);
}

export function getLeadAnalytics(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('GetLeadAnalytics', inputVars, inputOpts);
}

