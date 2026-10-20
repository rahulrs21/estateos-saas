import { createHash, randomBytes } from "node:crypto";
import { WorkspaceError } from "./errors";

export const INVITATION_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;

export function hashInvitationToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/** Return the secret once for manual delivery; persist only its SHA-256 digest. */
export function invitationLifetimeMs(hours: string | undefined): number {
  if (hours === undefined || hours === "") return INVITATION_LIFETIME_MS;
  const value = Number(hours);
  if (!/^\d+$/.test(hours) || !Number.isInteger(value) || value < 1 || value > 168) {
    throw new WorkspaceError("INVALID_INVITATION_CONFIGURATION", 503, "Invitation expiry is not configured correctly.");
  }
  return value * 60 * 60 * 1000;
}

export function createInvitationSecret(now = new Date(), lifetimeMs = INVITATION_LIFETIME_MS) {
  const token = randomBytes(32).toString("base64url");
  return {
    token,
    tokenHash: hashInvitationToken(token),
    expiresAt: new Date(now.getTime() + lifetimeMs).toISOString(),
  };
}
