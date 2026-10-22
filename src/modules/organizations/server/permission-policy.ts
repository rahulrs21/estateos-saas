import { WorkspaceError } from "./errors";
import { canonicalUuid } from "./identifiers";

export const membershipRoles = ["OWNER", "ADMIN", "MANAGER", "AGENT"] as const;
export type MembershipRole = (typeof membershipRoles)[number];
export type MembershipStatus = "INVITED" | "PENDING" | "ACTIVE" | "SUSPENDED" | "REVOKED" | "REMOVED";

/** These values must come from a fresh database result, never request JSON. */
export interface StoredMembership {
  id: string;
  organizationId: string;
  userUid: string | null;
  email: string;
  role: string;
  status: string;
}

export interface ActiveMembership extends StoredMembership {
  userUid: string;
  role: MembershipRole;
  status: "ACTIVE";
}

function denied(): never {
  throw new WorkspaceError("FORBIDDEN", 403, "You do not have permission to perform this operation.");
}

export function assertActiveMembership(
  membership: StoredMembership | null | undefined,
  organizationId: string,
  verifiedUid: string,
): asserts membership is ActiveMembership {
  if (!membership || canonicalUuid(membership.organizationId) !== canonicalUuid(organizationId) || membership.userUid !== verifiedUid ||
      membership.status !== "ACTIVE" || !membershipRoles.some((role) => role === membership.role)) denied();
}

export function assertOrganizationAdministrator(membership: ActiveMembership): void {
  if (membership.role !== "OWNER" && membership.role !== "ADMIN") denied();
}

/** An administrator can grant only a strictly lower privilege, never OWNER. */
export function assertCanGrantMembershipRole(actor: ActiveMembership, requestedRole: string): void {
  if (actor.role === "OWNER" && ["ADMIN", "MANAGER", "AGENT"].includes(requestedRole)) return;
  if (actor.role === "ADMIN" && ["MANAGER", "AGENT"].includes(requestedRole)) return;
  denied();
}

export function assertInvitationRecipient(actor: ActiveMembership, recipientEmail: string): void {
  if (actor.email.toLowerCase() === recipientEmail.toLowerCase()) denied();
}

export function assertCanManageMembership(
  actor: ActiveMembership,
  target: StoredMembership | null | undefined,
  requiredStatus?: MembershipStatus,
): asserts target is StoredMembership {
  if (!target || canonicalUuid(target.organizationId) !== canonicalUuid(actor.organizationId) || canonicalUuid(target.id) === canonicalUuid(actor.id) ||
      target.userUid === actor.userUid || target.email.toLowerCase() === actor.email.toLowerCase() ||
      (requiredStatus && target.status !== requiredStatus)) denied();
  assertCanGrantMembershipRole(actor, target.role);
}

/** Owners are deliberately immutable in this phase, including the last owner. */
export function assertCanChangeMembershipRole(actor: ActiveMembership, target: StoredMembership | null | undefined, role: string): void {
  assertCanManageMembership(actor, target, "ACTIVE");
  assertCanGrantMembershipRole(actor, role);
}

export function assertCanWriteLead(
  actor: ActiveMembership,
  assignedMembershipId: string | null | undefined,
): void {
  if (["AGENT", "MANAGER"].includes(actor.role) && (!assignedMembershipId || canonicalUuid(assignedMembershipId) !== canonicalUuid(actor.id))) denied();
}
