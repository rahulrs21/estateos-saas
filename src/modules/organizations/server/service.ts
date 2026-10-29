import "server-only";

import {
  CompanySize as SqlCompanySize,
  Emirate as SqlEmirate,
  getMyProfile,
  getTeamMembershipByEmail,
  type ListMyOrganizationsData,
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
  listAuditLogs as listAuditLogsOperation,
  listInvitations as listInvitationsOperation,
  setMembershipRole as setMembershipRoleOperation,
  setMembershipStatus as setMembershipStatusOperation,
  switchOrganization as switchOrganizationOperation,
  upsertMyProfile as upsertMyProfileOperation,
  updateOrganization as updateOrganizationOperation,
} from "@dataconnect/admin-generated";
import { executeWorkspaceOperation, requireSqlConnectRequest } from "@/lib/firebase/dataconnect";
import { requireActiveOrganizationRequest, requireProfileRequest } from "./context";
import { createInvitationSecret, hashInvitationToken, invitationLifetimeMs } from "./invitation-token";
import { mapOrganizationCreationError, mapWorkspaceDataError, WorkspaceError } from "./errors";
import { canonicalUuid } from "./identifiers";
import { assertInvitationCanBeCreated } from "./invitation-policy";
import { assertExpectedOrganization } from "@/lib/http/request-policy";
import { companyDetailsSchema } from "../validation";
import {
  assertCanGrantMembershipRole, assertInvitationRecipient, assertOrganizationAdministrator,
} from "./permission-policy";
import {
  acceptInvitationInputSchema, createBranchInputSchema, createOrganizationInputSchema,
  inviteMembershipInputSchema, membershipIdInputSchema, membershipStatusInputSchema,
  paginationInputSchema, profileInputSchema, switchOrganizationInputSchema, validateInput, membershipRoleInputSchema,
} from "./validation";

/** Server-only internal services. Future actions must also enforce CSRF/origin. */
export async function upsertMyProfile(input: unknown) {
  const request = await requireSqlConnectRequest();
  const variables = validateInput(profileInputSchema, input);
  return executeWorkspaceOperation(() => upsertMyProfileOperation(request.dc, variables, request.options));
}

export async function listMyOrganizations() {
  const request = await requireSqlConnectRequest();
  const memberships: ListMyOrganizationsData["memberships"] = [];
  for (let offset = 0; offset <= 10_000; offset += 100) {
    const page = await executeWorkspaceOperation(() => listMyOrganizationsOperation(request.dc, { limit: 100, offset }, request.options), "ListMyOrganizations");
    memberships.push(...page.memberships);
    if (page.memberships.length < 100) return { memberships };
  }
  throw new WorkspaceError("WORKSPACE_LIMIT", 503, "Your workspace list could not be loaded. Contact support.");
}

export async function createOrganization(input: unknown) {
  const { request } = await requireProfileRequest();
  const variables = validateInput(createOrganizationInputSchema, input);
  // The transaction derives creator/OWNER identity from auth.uid and switches the
  // profile only after creating the organization and its active OWNER membership.
  try {
    return (await createOrganizationOperation(request.dc, {
      ...variables,
      emirate: variables.emirate ? SqlEmirate[variables.emirate] : undefined,
      companySize: variables.companySize ? SqlCompanySize[variables.companySize] : undefined,
    }, request.options)).data;
  } catch (error) {
    throw mapOrganizationCreationError(error);
  }
}

/** Onboarding creates missing identity metadata from the verified session only. */
async function ensureMyProfile() {
  const request = await requireSqlConnectRequest();
  const { userProfile } = await executeWorkspaceOperation(() => getMyProfile(request.dc, request.options), "GetMyProfile");
  if (!userProfile) {
    const name = request.user.name?.trim();
    const displayName = name && name.length >= 2 ? name.slice(0, 120) : request.user.email.slice(0, 120);
    await executeWorkspaceOperation(() => upsertMyProfileOperation(request.dc, { displayName }, request.options));
  }
  return request;
}

export async function registerCompany(input: unknown) {
  const variables = validateInput(companyDetailsSchema, input);
  await ensureMyProfile();
  return createOrganization(variables);
}

export async function updateCompany(input: unknown, expectedOrganizationId: string | null) {
  const { request, organizationId, membership } = await requireActiveOrganizationRequest();
  assertExpectedOrganization(expectedOrganizationId, organizationId);
  assertOrganizationAdministrator(membership);
  const variables = validateInput(companyDetailsSchema, input);
  try {
    return (await updateOrganizationOperation(request.dc, {
      ...variables, organizationId, emirate: SqlEmirate[variables.emirate],
      companySize: SqlCompanySize[variables.companySize],
    }, request.options)).data;
  } catch (error) { throw mapOrganizationCreationError(error); }
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

export async function inviteMembership(input: unknown, expectedOrganizationId?: string | null) {
  const { request, organizationId, membership } = await requireActiveOrganizationRequest();
  if (expectedOrganizationId !== undefined) assertExpectedOrganization(expectedOrganizationId, organizationId);
  const variables = validateInput(inviteMembershipInputSchema, input);
  assertCanGrantMembershipRole(membership, variables.role);
  assertInvitationRecipient(membership, variables.email);
  const lookup = await executeWorkspaceOperation(() => getTeamMembershipByEmail(request.dc, { organizationId, email: variables.email }, request.options));
  assertInvitationCanBeCreated(lookup.membership);
  const secret = createInvitationSecret(new Date(), invitationLifetimeMs(process.env.INVITATION_TTL_HOURS));
  const role = { ADMIN: SqlMembershipRole.ADMIN, MANAGER: SqlMembershipRole.MANAGER, AGENT: SqlMembershipRole.AGENT }[variables.role];
  let data;
  try {
    data = (await inviteMembershipOperation(request.dc, {
    ...variables, role, organizationId, tokenHash: secret.tokenHash, expiresAt: secret.expiresAt,
    }, request.options)).data;
  } catch (error) {
    const provider = error as { code?: string; message?: string };
    if (["data-connect/query-error", "data-connect/permission-denied"].includes(provider?.code ?? "") &&
        /MEMBERSHIP_ALREADY_EXISTS|membership[^\n]*(?:organization|email)[^\n]*(?:unique|key)|unique[^\n]*membership/i.test(provider?.message ?? "")) {
      throw new WorkspaceError("MEMBERSHIP_EXISTS", 409, "This email already has a membership or invitation in this company. Refresh the list and use Reissue for a pending invitation.");
    }
    throw mapWorkspaceDataError(error);
  }
  // Server-only delivery consumes the raw token. Never log or persist it.
  return { ...data, invitationToken: secret.token, invitationExpiresAt: secret.expiresAt };
}

export async function acceptInvitation(input: unknown) {
  const { token, ...variables } = validateInput(acceptInvitationInputSchema, input);
  const request = await requireSqlConnectRequest();
  const name = request.user.name?.trim();
  const displayName = (name || request.user.email).slice(0, 120);
  // Profile initialization, token consumption, ACTIVE membership, company
  // selection and audit commit together. Identity comes only from the session.
  try {
    return await executeWorkspaceOperation(() => acceptInvitationOperation(request.dc, {
      ...variables, tokenHash: hashInvitationToken(token), displayName,
    }, request.options));
  } catch (error) {
    if (error instanceof WorkspaceError && error.status === 403) {
      throw new WorkspaceError("INVITATION_UNAVAILABLE", 403, "This invitation cannot be accepted. It may be expired, revoked, already used, or intended for a different verified email.");
    }
    throw error;
  }
}

export async function approveMembership(input: unknown) {
  const { request, organizationId, membership } = await requireActiveOrganizationRequest();
  const variables = validateInput(membershipIdInputSchema, input);
  assertOrganizationAdministrator(membership);
  // Connector checks the target's PENDING state, lower privilege and non-self UID
  // in the same transaction as activation and the append-only audit event.
  return executeWorkspaceOperation(() => approveMembershipOperation(request.dc, { ...variables, organizationId }, request.options));
}

export async function setMembershipStatus(input: unknown, expectedOrganizationId?: string | null) {
  const { request, organizationId, membership } = await requireActiveOrganizationRequest();
  if (expectedOrganizationId !== undefined) assertExpectedOrganization(expectedOrganizationId, organizationId);
  const variables = validateInput(membershipStatusInputSchema, input);
  assertOrganizationAdministrator(membership);
  if (canonicalUuid(variables.membershipId) === canonicalUuid(membership.id)) {
    throw new WorkspaceError("FORBIDDEN", 403, "You cannot change your own membership status.");
  }
  const status = { SUSPENDED: SqlMembershipStatus.SUSPENDED, REMOVED: SqlMembershipStatus.REMOVED, REVOKED: SqlMembershipStatus.REVOKED }[variables.status];
  return executeWorkspaceOperation(() => setMembershipStatusOperation(request.dc, { ...variables, status, organizationId }, request.options));
}

export async function setMembershipRole(input: unknown, expectedOrganizationId?: string | null) {
  const { request, organizationId, membership } = await requireActiveOrganizationRequest();
  if (expectedOrganizationId !== undefined) assertExpectedOrganization(expectedOrganizationId, organizationId);
  const variables = validateInput(membershipRoleInputSchema, input);
  assertCanGrantMembershipRole(membership, variables.role);
  if (canonicalUuid(variables.membershipId) === canonicalUuid(membership.id)) {
    throw new WorkspaceError("FORBIDDEN", 403, "You cannot change your own membership role.");
  }
  const role = { ADMIN: SqlMembershipRole.ADMIN, MANAGER: SqlMembershipRole.MANAGER, AGENT: SqlMembershipRole.AGENT }[variables.role];
  return executeWorkspaceOperation(() => setMembershipRoleOperation(request.dc, { ...variables, role, organizationId }, request.options));
}

export async function listInvitations(input: unknown = {}) {
  const { request, organizationId, membership } = await requireActiveOrganizationRequest();
  assertOrganizationAdministrator(membership);
  const variables = validateInput(paginationInputSchema, input);
  return executeWorkspaceOperation(() => listInvitationsOperation(request.dc, { ...variables, organizationId }, request.options));
}

export async function listAuditLogs(input: unknown = {}) {
  const { request, organizationId, membership } = await requireActiveOrganizationRequest();
  assertOrganizationAdministrator(membership);
  const variables = validateInput(paginationInputSchema, input);
  return executeWorkspaceOperation(() => listAuditLogsOperation(request.dc, { ...variables, organizationId }, request.options));
}

export async function listActivities(input: unknown = {}) {
  const { request, organizationId, membership } = await requireActiveOrganizationRequest();
  const variables = validateInput(paginationInputSchema, input);
  assertOrganizationAdministrator(membership);
  return executeWorkspaceOperation(() => listActivitiesOperation(request.dc, { ...variables, organizationId }, request.options));
}
