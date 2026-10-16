import { createHash, randomBytes } from "node:crypto";

export const INVITATION_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;

export function hashInvitationToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/** Return the secret once for manual delivery; persist only its SHA-256 digest. */
export function createInvitationSecret(now = new Date()) {
  const token = randomBytes(32).toString("base64url");
  return {
    token,
    tokenHash: hashInvitationToken(token),
    expiresAt: new Date(now.getTime() + INVITATION_LIFETIME_MS).toISOString(),
  };
}
