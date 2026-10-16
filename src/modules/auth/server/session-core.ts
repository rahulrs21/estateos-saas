import { classifyAuthConfigurationError } from "./configuration-error";
import {
  assertSessionClaims,
  authenticatedUserFromClaims,
  SESSION_MAX_AGE_SECONDS,
  SessionPolicyError,
  type AuthUser,
  type VerifiedTokenClaims,
} from "./session-policy";

/** Production uses Firebase Admin. The port permits isolated security boundary tests. */
export interface SessionAuthGateway {
  verifyIdToken(idToken: string, checkRevoked: boolean): Promise<VerifiedTokenClaims>;
  createSessionCookie(idToken: string, options: { expiresIn: number }): Promise<string>;
  verifySessionCookie(cookie: string, checkRevoked: boolean): Promise<VerifiedTokenClaims>;
  revokeRefreshTokens(uid: string): Promise<void>;
}

const INVALID_CREDENTIAL_CODES = new Set([
  "auth/argument-error",
  "auth/invalid-argument",
  "auth/invalid-id-token",
  "auth/id-token-expired",
  "auth/id-token-revoked",
  "auth/invalid-session-cookie",
  "auth/session-cookie-expired",
  "auth/session-cookie-revoked",
  "auth/user-disabled",
  "auth/user-not-found",
]);

export function isInvalidCredentialError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error &&
    typeof error.code === "string" && INVALID_CREDENTIAL_CODES.has(error.code);
}

export function authServiceUnavailable(): SessionPolicyError {
  return new SessionPolicyError("AUTH_UNAVAILABLE", 503, "Authentication is temporarily unavailable. Please try again.");
}

export async function exchangeSessionToken(
  idToken: string,
  auth: SessionAuthGateway,
  nowSeconds?: number,
): Promise<{ cookie: string; user: AuthUser }> {
  try {
    const claims = await auth.verifyIdToken(idToken, true);
    const user = assertSessionClaims(claims, nowSeconds);
    const cookie = await auth.createSessionCookie(idToken, { expiresIn: SESSION_MAX_AGE_SECONDS * 1000 });
    return { cookie, user };
  } catch (error) {
    if (error instanceof SessionPolicyError) throw error;
    const configurationError = classifyAuthConfigurationError(error);
    if (configurationError) throw configurationError;
    if (isInvalidCredentialError(error)) {
      throw new SessionPolicyError("INVALID_SESSION", 401, "Your sign-in has expired. Sign in again.");
    }
    throw authServiceUnavailable();
  }
}

export async function verifyAuthenticationSession(
  cookie: string | undefined,
  auth: SessionAuthGateway,
): Promise<AuthUser | null> {
  if (!cookie) return null;
  try {
    return authenticatedUserFromClaims(await auth.verifySessionCookie(cookie, true));
  } catch (error) {
    const configurationError = classifyAuthConfigurationError(error);
    if (configurationError) throw configurationError;
    if (isInvalidCredentialError(error) ||
        (error instanceof SessionPolicyError && error.status !== 503)) return null;
    throw authServiceUnavailable();
  }
}

/** Logout revokes every session for this verified identity, including copied cookies. */
export async function revokeAuthenticationSession(
  cookie: string | undefined,
  auth: SessionAuthGateway,
): Promise<AuthUser | null> {
  const user = await verifyAuthenticationSession(cookie, auth);
  if (!user) return null;
  try {
    await auth.revokeRefreshTokens(user.uid);
    return user;
  } catch (error) {
    const configurationError = classifyAuthConfigurationError(error);
    if (configurationError) throw configurationError;
    throw authServiceUnavailable();
  }
}
