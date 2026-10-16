import "server-only";

import {
  MembershipRole as SqlMembershipRole,
  MembershipStatus as SqlMembershipStatus,
  acceptInvitation as acceptInvitationOperation,
  approveMembership as approveMembershipOperation,
  createBranch as createBranchOperation,
  createOrganization as createOrganizationOperation,
  inviteMembership as inviteMembershipOperation,
  listActivities as listActivitiesOperation,
  listBranches as listBranchesOperation,
  listMemberships as listMembershipsOperation,
  listMyOrganizations as listMyOrganizationsOperation,
  setMembershipStatus as setMembershipStatusOperation,
  switchOrganization as switchOrganizationOperation,
  upsertMyProfile as upsertMyProfileOperation,
} from "@dataconnect/admin-generated";
import { executeWorkspaceOperation, requireSqlConnectRequest } from "@/lib/firebase/dataconnect";
import { requireActiveOrganizationRequest, requireProfileRequest } from "./context";
import { createInvitationSecret, hashInvitationToken } from "./invitation-token";
import {
  assertCanGrantMembershipRole, assertInvitationRecipient, assertOrganizationAdministrator,
} from "./permission-policy";
import {
  acceptInvitationInputSchema, createBranchInputSchema, createOrganizationInputSchema,
  inviteMembershipInputSchema, membershipIdInputSchema, membershipStatusInputSchema,
  paginationInputSchema, profileInputSchema, switchOrganizationInputSchema, validateInput,
} from "./validation";

/** Server-only internal services. Future actions must also enforce CSRF/origin. */
export async function upsertMyProfile(input: unknown) {
  const request = await requireSqlConnectRequest();
  const variables = validateInput(profileInputSchema, input);
  return executeWorkspaceOperation(() => upsertMyProfileOperation(request.dc, variables, request.options));
}

export async function listMyOrganizations() {
  const request = await requireSqlConnectRequest();
  return executeWorkspaceOperation(() => listMyOrganizationsOperation(request.dc, request.options));
}

export async function createOrganization(input: unknown) {
  const { request } = await requireProfileRequest();
  const variables = validateInput(createOrganizationInputSchema, input);
  // The transaction derives creator/OWNER identity from auth.uid and switches the
  // profile only after creating the organization and its active OWNER membership.
  return executeWorkspaceOperation(() => createOrganizationOperation(request.dc, variables, request.options));
}

export async function switchOrganization(input: unknown) {
  const { request } = await requireProfileRequest();
  const variables = validateInput(switchOrganizationInputSchema, input);
  // A selector is untrusted: this transaction rechecks ACTIVE membership before
  // writing the preference and its audit event. No role comes from a cookie.
  return executeWorkspaceOperation(() => switchOrganizationOperation(request.dc, variables, request.options));
}

export async function getCurrentOrganization() {
  const context = await requireActiveOrganizationRequest();
  return { organization: context.organization, membership: context.membership };
}

export async function listBranches() {
  const { request, organizationId } = await requireActiveOrganizationRequest();
  return executeWorkspaceOperation(() => listBranchesOperation(request.dc, { organizationId }, request.options));
}

export async function createBranch(input: unknown) {
  const { request, organizationId, membership } = await requireActiveOrganizationRequest();
  const variables = validateInput(createBranchInputSchema, input);
  assertOrganizationAdministrator(membership);
  return executeWorkspaceOperation(() => createBranchOperation(request.dc, { ...variables, organizationId }, request.options));
}

export async function listMemberships() {
  const { request, organizationId, membership } = await requireActiveOrganizationRequest();
  assertOrganizationAdministrator(membership);
  return executeWorkspaceOperation(() => listMembershipsOperation(request.dc, { organizationId }, request.options));
}

export async function inviteMembership(input: unknown) {
  const { request, organizationId, membership } = await requireActiveOrganizationRequest();
  const variables = validateInput(inviteMembershipInputSchema, input);
  assertCanGrantMembershipRole(membership, variables.role);
  assertInvitationRecipient(membership, variables.email);
  const secret = createInvitationSecret();
  const role = { ADMIN: SqlMembershipRole.ADMIN, MANAGER: SqlMembershipRole.MANAGER, AGENT: SqlMembershipRole.AGENT }[variables.role];
  const data = await executeWorkspaceOperation(() => inviteMembershipOperation(request.dc, {
    ...variables, role, organizationId, tokenHash: secret.tokenHash, expiresAt: secret.expiresAt,
  }, request.options));
  // Do not log or persist the raw token, including in audit metadata. There is
  // deliberately no email provider in this phase; the caller delivers it safely.
  return { ...data, invitationToken: secret.token, invitationExpiresAt: secret.expiresAt };
}

export async function acceptInvitation(input: unknown) {
  const { request } = await requireProfileRequest();
  const { token, ...variables } = validateInput(acceptInvitationInputSchema, input);
  // The transaction verifies the stored invite email, expiry and digest; binds
  // only auth.uid; consumes the secret; and enters PENDING, never ACTIVE.
  return executeWorkspaceOperation(() => acceptInvitationOperation(request.dc, {
    ...variables, tokenHash: hashInvitationToken(token),
  }, request.options));
}

export async function approveMembership(input: unknown) {
  const { request, organizationId, membership } = await requireActiveOrganizationRequest();
  const variables = validateInput(membershipIdInputSchema, input);
  assertOrganizationAdministrator(membership);
  // Connector checks the target's PENDING state, lower privilege and non-self UID
  // in the same transaction as activation and the append-only audit event.
  return executeWorkspaceOperation(() => approveMembershipOperation(request.dc, { ...variables, organizationId }, request.options));
}

export async function setMembershipStatus(input: unknown) {
  const { request, organizationId, membership } = await requireActiveOrganizationRequest();
  const variables = validateInput(membershipStatusInputSchema, input);
  assertOrganizationAdministrator(membership);
  const status = { SUSPENDED: SqlMembershipStatus.SUSPENDED, REVOKED: SqlMembershipStatus.REVOKED }[variables.status];
  return executeWorkspaceOperation(() => setMembershipStatusOperation(request.dc, { ...variables, status, organizationId }, request.options));
}

export async function listActivities(input: unknown = {}) {
  const { request, organizationId, membership } = await requireActiveOrganizationRequest();
  const variables = validateInput(paginationInputSchema, input);
  assertOrganizationAdministrator(membership);
  return executeWorkspaceOperation(() => listActivitiesOperation(request.dc, { ...variables, organizationId }, request.options));
}
