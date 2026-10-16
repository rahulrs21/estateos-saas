export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 5;
export const RECENT_SIGN_IN_SECONDS = 60 * 5;

/** Identity only. This never represents organization membership or permissions. */
export interface AuthUser {
  uid: string;
  email: string;
  emailVerified: true;
}

export interface VerifiedTokenClaims {
  uid: string;
  email?: string;
  email_verified?: boolean;
  firebase?: { sign_in_provider?: string };
  auth_time?: number;
}

export class SessionPolicyError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: 401 | 403 | 503,
    message: string,
  ) {
    super(message);
    this.name = "SessionPolicyError";
  }
}

/** Only call with claims returned by Firebase Admin's cryptographic verification. */
export function authenticatedUserFromClaims(claims: VerifiedTokenClaims): AuthUser {
  if (!claims.uid || !claims.email || claims.firebase?.sign_in_provider !== "password") {
    throw new SessionPolicyError("INVALID_SESSION", 401, "Sign in with your email and password.");
  }
  if (claims.email_verified !== true) {
    throw new SessionPolicyError("EMAIL_NOT_VERIFIED", 403, "Verify your email before entering the workspace.");
  }
  return { uid: claims.uid, email: claims.email, emailVerified: true };
}

/** Five-minute recency is for issuing a cookie, not for reading an existing session. */
export function assertSessionClaims(
  claims: VerifiedTokenClaims,
  nowSeconds = Date.now() / 1000,
): AuthUser {
  const user = authenticatedUserFromClaims(claims);
  if (
    typeof claims.auth_time !== "number" ||
    !Number.isFinite(claims.auth_time) ||
    claims.auth_time > nowSeconds ||
    nowSeconds - claims.auth_time > RECENT_SIGN_IN_SECONDS
  ) {
    throw new SessionPolicyError("RECENT_LOGIN_REQUIRED", 401, "Sign in again to start a secure session.");
  }
  return user;
}
