import "server-only";

import { getMyProfile, getOrganizationContext } from "@dataconnect/admin-generated";
import { executeWorkspaceOperation, requireSqlConnectRequest } from "@/lib/firebase/dataconnect";
import { WorkspaceError } from "./errors";
import { assertActiveMembership, type StoredMembership } from "./permission-policy";

type SqlConnectRequest = Awaited<ReturnType<typeof requireSqlConnectRequest>>;

async function requireUserProfile(request: SqlConnectRequest) {
  const { userProfile } = await executeWorkspaceOperation(() => getMyProfile(request.dc, request.options));
  if (!userProfile) {
    throw new WorkspaceError("PROFILE_REQUIRED", 409, "Create your user profile before setting up an organization or accepting an invitation.");
  }
  return userProfile;
}

/** Exported entry points never accept a caller-supplied actor or SDK options. */
export async function requireProfileRequest() {
  const request = await requireSqlConnectRequest();
  return { request, profile: await requireUserProfile(request) };
}

/** The stored active organization is a preference, never proof of membership. */
export async function requireActiveOrganizationRequest() {
  const { request, profile } = await requireProfileRequest();
  if (!profile.activeOrganizationId) {
    throw new WorkspaceError("ORGANIZATION_REQUIRED", 409, "Select an organization with an active membership to continue.");
  }
  const organizationId = profile.activeOrganizationId;
  const data = await executeWorkspaceOperation(() => getOrganizationContext(request.dc, { organizationId }, request.options));
  const row = data.ownMembership;
  const membership: StoredMembership | null = row ? {
    id: row.id,
    organizationId: row.organizationId,
    userUid: row.userProfileUid ?? null,
    email: row.email,
    role: row.role,
    status: row.status,
  } : null;
  assertActiveMembership(membership, organizationId, request.user.uid);
  if (!data.organization) throw new WorkspaceError("NOT_FOUND", 404, "The selected organization is unavailable.");
  return { request, profile, membership, organizationId, organization: data.organization };
}
