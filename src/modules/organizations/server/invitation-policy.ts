import { WorkspaceError } from "./errors";

type ExistingMembership = {
  status: string;
  invitation_on_membership?: { status: string } | null;
} | null | undefined;

/** Only call with an authorized, exact-email lookup in the selected company. */
export function assertInvitationCanBeCreated(existing: ExistingMembership) {
  if (!existing) return;
  if (existing.status === "INVITED" && existing.invitation_on_membership?.status === "PENDING") {
    throw new WorkspaceError("INVITATION_PENDING", 409, "An invitation for this email is already pending. Use Reissue on its row to create a new link; the recipient does not need to accept first. You can invite other colleagues now.");
  }
  if (existing.status === "REMOVED" && existing.invitation_on_membership?.status === "REVOKED") {
    throw new WorkspaceError("INVITATION_REVOKED", 409, "This invitation was revoked. Use Re-invite on its row to create a fresh link. The old link cannot be used.");
  }
  throw new WorkspaceError("MEMBERSHIP_EXISTS", 409, "This email already has a membership in this company. Manage the existing member instead of creating another invitation.");
}

type ReinvitationCandidate = {
  status: string;
  role: string;
  acceptedAt?: string | null;
  acceptedByUid?: string | null;
  membership: { status: string; role: string; userProfileUid?: string | null; acceptedAt?: string | null; approvedAt?: string | null };
};

/** State eligibility only. Server and connector must also verify actor authority. */
export function canReinviteRecipient(row: ReinvitationCandidate): boolean {
  return row.status === "REVOKED" && row.acceptedAt == null && row.acceptedByUid == null &&
    ["ADMIN", "MANAGER", "AGENT"].includes(row.role) && row.role === row.membership.role &&
    row.membership.status === "REMOVED" && row.membership.userProfileUid == null &&
    row.membership.acceptedAt == null && row.membership.approvedAt == null;
}
