import "server-only";

import {
  listTeamMembers, listInvitations as invitationList, reissueInvitation, reinviteRevokedInvitation, revokeInvitation,
  recordInvitationDelivery, InvitationDeliveryStatus, MembershipStatus, InvitationStatus,
} from "@dataconnect/admin-generated";
import { executeWorkspaceOperation } from "@/lib/firebase/dataconnect";
import { assertExpectedOrganization } from "@/lib/http/request-policy";
import { getAppOrigin } from "@/modules/auth/server/config";
import { requireActiveOrganizationRequest } from "./context";
import { assertCanGrantMembershipRole, assertInvitationRecipient, assertOrganizationAdministrator } from "./permission-policy";
import { canReinviteRecipient } from "./invitation-policy";
import { validateInput } from "./validation";
import { inviteMembership, setMembershipRole, setMembershipStatus } from "./service";
import { createInvitationSecret, invitationLifetimeMs, hashInvitationToken } from "./invitation-token";
import { teamInviteSchema, invitationActionSchema, teamRoleSchema, teamSuspensionSchema, teamPageSchema, invitationPageSchema, teamSearchPattern } from "../team-validation";
import { invitationLink } from "../invitation-link";
import { invitationEmailConfiguration, deliverInvitation, type InvitationDelivery } from "./email-delivery";
import { canonicalUuid } from "./identifiers";
import { WorkspaceError } from "./errors";

async function administrator(expected?: string | null) {
  const context = await requireActiveOrganizationRequest();
  assertOrganizationAdministrator(context.membership);
  if (expected !== undefined) assertExpectedOrganization(expected, context.organizationId);
  return context;
}
function mailConfiguration() {
  return invitationEmailConfiguration({ nodeEnv: process.env.NODE_ENV, provider: process.env.INVITATION_EMAIL_PROVIDER, apiKey: process.env.RESEND_API_KEY, from: process.env.INVITATION_EMAIL_FROM });
}

export async function getTeamPage(input: unknown, invitations = false) {
  const context = await administrator();
  const filters = invitations ? validateInput(invitationPageSchema, input) : validateInput(teamPageSchema, input);
  const variables = { organizationId: context.organizationId, limit: 25, offset: (filters.page - 1) * 25, search: teamSearchPattern(filters.search) };
  const data = invitations
    ? await executeWorkspaceOperation(() => invitationList(context.request.dc, { ...variables, status: filters.status === "ALL" ? undefined : filters.status as InvitationStatus }, context.request.options))
    : await executeWorkspaceOperation(() => listTeamMembers(context.request.dc, { ...variables, status: filters.status === "ALL" ? undefined : filters.status as MembershipStatus }, context.request.options));
  return {
    organization: { id: canonicalUuid(context.organizationId), name: context.organization.name },
    actor: { id: canonicalUuid(context.membership.id), role: context.membership.role },
    filters, data,
    now: new Date().toISOString(),
  };
}

async function sendAndRecord(context: Awaited<ReturnType<typeof administrator>>, membershipId: string, token: string, expiresAt: string, recipient: string, configuration: ReturnType<typeof mailConfiguration>) {
  const url = invitationLink(getAppOrigin(), { organizationId: context.organizationId, membershipId, token });
  const delivery = await deliverInvitation(configuration, { to: recipient, companyName: context.organization.name, url, expiresAt });
  try {
    // Deliberate privileged exception: @auth(NO_ACCESS) rejects client SDK calls.
    // Actor/tenant come from the verified server context, never request JSON;
    // the transaction rechecks active admin membership and binds issuer + digest.
    await executeWorkspaceOperation(() => recordInvitationDelivery(context.request.dc, {
      organizationId: context.organizationId, membershipId, actorUid: context.request.user.uid,
      tokenHash: hashInvitationToken(token),
      outcome: { preview: InvitationDeliveryStatus.PREVIEW, accepted: InvitationDeliveryStatus.ACCEPTED, failed: InvitationDeliveryStatus.FAILED }[delivery.mode],
    }));
  } catch {
    // Creation/reissue was already audited atomically. Preserve the actual email
    // outcome if its later receipt conflicts with revocation, reissue or outage.
    console.error(JSON.stringify({ event: "invitation.delivery.receipt_failed", organizationId: context.organizationId, actorUid: context.request.user.uid, outcome: delivery.mode }));
    return { ...delivery, message: delivery.message + " Delivery status could not be recorded; refresh the invitations list." } satisfies InvitationDelivery;
  }
  return delivery;
}

export async function inviteTeamMember(input: unknown, expected: string | null) {
  const context = await administrator(expected);
  const fields = validateInput(teamInviteSchema, input);
  const configuration = mailConfiguration(); // Fail closed before creating a production invitation.
  getAppOrigin();
  const created = await inviteMembership(fields, expected);
  const delivery = await sendAndRecord(context, created.membership.id, created.invitationToken, created.invitationExpiresAt, fields.email, configuration);
  return { membershipId: canonicalUuid(created.membership.id), delivery };
}
export async function reissueTeamInvitation(input: unknown, expected: string | null) {
  return refreshTeamInvitation(input, expected, "reissue");
}
export async function reinviteTeamMember(input: unknown, expected: string | null) {
  return refreshTeamInvitation(input, expected, "reinvite");
}
async function refreshTeamInvitation(input: unknown, expected: string | null, intent: "reissue" | "reinvite") {
  const context = await administrator(expected);
  const { membershipId } = validateInput(invitationActionSchema, input);
  const configuration = mailConfiguration();
  getAppOrigin();
  const secret = createInvitationSecret(new Date(), invitationLifetimeMs(process.env.INVITATION_TTL_HOURS));
  // Authorized lookup provides the recipient; never accept delivery addresses or
  // roles from the reissue request. Paginate so older invitations remain usable.
  let target: Awaited<ReturnType<typeof invitationList>>["data"]["invitations"][number] | undefined;
  for (let offset = 0; offset <= 10_000; offset += 100) {
    const page = await executeWorkspaceOperation(() => invitationList(context.request.dc, { organizationId: context.organizationId, limit: 100, offset }, context.request.options));
    target = page.invitations.find(row => canonicalUuid(row.membershipId) === membershipId);
    if (target || page.invitations.length < 100) break;
  }
  if (!target) throw new WorkspaceError("NOT_FOUND", 404, "This invitation is unavailable.");
  assertCanGrantMembershipRole(context.membership, target.role);
  assertInvitationRecipient(context.membership, target.email);
  if (intent === "reinvite" ? !canReinviteRecipient(target) : target.status !== "PENDING") {
    throw new WorkspaceError("INVITATION_STATE_CHANGED", 409, "This invitation cannot be renewed with this action. Refresh the list and check its status.");
  }
  if (Date.now() - new Date(target.updatedAt).getTime() < 60_000) {
    throw new WorkspaceError("INVITATION_COOLDOWN", 409, "Wait one minute after the last invitation change, then try again.");
  }
  const variables = { organizationId: context.organizationId, membershipId, tokenHash: secret.tokenHash, expiresAt: secret.expiresAt };
  if (intent === "reinvite") await executeWorkspaceOperation(() => reinviteRevokedInvitation(context.request.dc, variables, context.request.options));
  else await executeWorkspaceOperation(() => reissueInvitation(context.request.dc, variables, context.request.options));
  return { membershipId, delivery: await sendAndRecord(context, membershipId, secret.token, secret.expiresAt, target.email, configuration) };
}
export async function revokeTeamInvitation(input: unknown, expected: string | null) {
  const context = await administrator(expected);
  const fields = validateInput(invitationActionSchema, input);
  return executeWorkspaceOperation(() => revokeInvitation(context.request.dc, { ...fields, organizationId: context.organizationId }, context.request.options));
}
export async function changeTeamRole(input: unknown, expected: string | null) {
  validateInput(teamRoleSchema, input);
  return setMembershipRole(input, expected);
}
export async function suspendTeamMember(input: unknown, expected: string | null) {
  validateInput(teamSuspensionSchema, input);
  return setMembershipStatus(input, expected);
}
