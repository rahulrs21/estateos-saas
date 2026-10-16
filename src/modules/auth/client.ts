"use client";

import { createUserWithEmailAndPassword, sendEmailVerification, sendPasswordResetEmail, signInWithEmailAndPassword, signOut, validatePassword } from "firebase/auth";
import { getFirebaseClientAuth } from "@/lib/firebase/client";

export class AuthFlowError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = "AuthFlowError";
  }
}

function providerCode(error: unknown): string | undefined {
  return typeof error === "object" && error !== null && "code" in error && typeof error.code === "string" ? error.code : undefined;
}

export function authErrorMessage(error: unknown): string {
  if (error instanceof AuthFlowError) return error.message;
  switch (providerCode(error)) {
    case "auth/invalid-credential": case "auth/invalid-login-credentials": case "auth/wrong-password": case "auth/user-not-found":
      return "We couldn’t sign you in. Check your email and password and try again.";
    case "auth/email-already-in-use": return "We couldn’t create this account. Try signing in or resetting your password.";
    case "auth/invalid-email": return "Enter a valid email address.";
    case "auth/weak-password": case "auth/password-does-not-meet-requirements": return "Choose a stronger password that meets the requirements below.";
    case "auth/too-many-requests": return "Too many attempts. Please wait before trying again.";
    case "auth/network-request-failed": return "We couldn’t reach the sign-in service. Check your connection and try again.";
    case "auth/user-disabled": return "Sign-in is unavailable for this account. Contact your administrator.";
    case "auth/operation-not-allowed": case "auth/invalid-api-key": case "auth/app-not-authorized": case "auth/unauthorized-domain":
      return "Authentication is not configured correctly. Contact your administrator.";
    default:
      return error instanceof Error && error.message === "AUTH_CONFIGURATION_MISSING"
        ? "Authentication setup is incomplete. Contact your administrator."
        : "We couldn’t complete that request. Please try again.";
  }
}

async function requestJson(response: Response): Promise<Record<string, unknown>> {
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = typeof body === "object" && body !== null && "error" in body ? body.error : null;
    const code = typeof detail === "object" && detail !== null && "code" in detail && typeof detail.code === "string" ? detail.code : "SESSION_UNAVAILABLE";
    const message = code === "AUTH_CONFIGURATION_ERROR"
      ? "Server sign-in setup is incomplete. Ask your administrator to check the Firebase Admin configuration."
      : response.status === 403 && code === "EMAIL_NOT_VERIFIED"
      ? "Verify your email address before signing in."
      : response.status === 401 ? "Your sign-in expired. Please sign in again."
      : response.status === 403 ? "This request could not be verified. Reload the page and try again."
      : "The session service is unavailable. Please try again shortly.";
    throw new AuthFlowError(code, message);
  }
  if (typeof body !== "object" || body === null) throw new AuthFlowError("INVALID_RESPONSE", "The session service returned an unexpected response. Please try again.");
  return body as Record<string, unknown>;
}

async function csrfToken(): Promise<string> {
  const body = await requestJson(await fetch("/api/auth/csrf", { credentials: "same-origin", cache: "no-store" }));
  if (typeof body.csrfToken !== "string") throw new AuthFlowError("INVALID_RESPONSE", "Please reload the page and try again.");
  return body.csrfToken;
}

export async function loginWithEmail(email: string, password: string): Promise<void> {
  const auth = getFirebaseClientAuth();
  try {
    const { user } = await signInWithEmailAndPassword(auth, email, password);
    if (!user.emailVerified) throw new AuthFlowError("EMAIL_NOT_VERIFIED", "Verify your email address before signing in. Need another email? Use the verification link below.");
    const idToken = await user.getIdToken(true);
    const csrf = await csrfToken();
    await requestJson(await fetch("/api/auth/session", {
      method: "POST", credentials: "same-origin", cache: "no-store",
      headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf },
      body: JSON.stringify({ idToken }),
    }));
  } finally {
    // Server cookies are the only persisted session; no browser refresh token.
    await signOut(auth);
  }
}

export async function signupWithEmail(email: string, password: string): Promise<void> {
  const auth = getFirebaseClientAuth();
  let created = false;
  try {
    const policy = await validatePassword(auth, password);
    if (!policy.isValid) {
      const requirements = policy.passwordPolicy.customStrengthOptions;
      const missing = [
        policy.meetsMinPasswordLength === false ? `at least ${requirements.minPasswordLength ?? 8} characters` : null,
        policy.containsLowercaseLetter === false ? "a lowercase letter" : null,
        policy.containsUppercaseLetter === false ? "an uppercase letter" : null,
        policy.containsNumericCharacter === false ? "a number" : null,
        policy.containsNonAlphanumericCharacter === false ? "a symbol" : null,
      ].filter(Boolean);
      throw new AuthFlowError("PASSWORD_POLICY", missing.length ? `Your password needs ${missing.join(", ")}.` : "Your password does not meet the account password policy.");
    }
    const { user } = await createUserWithEmailAndPassword(auth, email, password);
    created = true;
    await sendEmailVerification(user, { url: `${window.location.origin}/login?verified=1` });
  } catch (error) {
    if (created) throw new AuthFlowError("VERIFICATION_SEND_FAILED", "Your account was created, but we couldn’t send its verification email. Open email verification below and sign in there to resend it.");
    throw error;
  } finally { await signOut(auth); }
}

export async function resendVerification(email: string, password: string): Promise<void> {
  const auth = getFirebaseClientAuth();
  try {
    const { user } = await signInWithEmailAndPassword(auth, email, password);
    if (user.emailVerified) throw new AuthFlowError("ALREADY_VERIFIED", "Your email is already verified. Return to login to open your workspace.");
    await sendEmailVerification(user, { url: `${window.location.origin}/login?verified=1` });
  } finally { await signOut(auth); }
}

export async function resetPassword(email: string): Promise<void> {
  try {
    await sendPasswordResetEmail(getFirebaseClientAuth(), email, { url: `${window.location.origin}/login?reset=1` });
  } catch (error) {
    // Avoid disclosing whether a particular email address has an account.
    if (providerCode(error) !== "auth/user-not-found") throw error;
  }
}

export async function logout(): Promise<void> {
  const csrf = await csrfToken();
  await requestJson(await fetch("/api/auth/session", {
    method: "DELETE", credentials: "same-origin", cache: "no-store", headers: { "X-CSRF-Token": csrf },
  }));
  // Firebase client auth has no persisted credentials. Do not initialize it here:
  // sign-out of the server session must work even if public config is missing.
}
