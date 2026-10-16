"use client";

import { signOut } from "firebase/auth";
import { clearFirebaseClientAuth, getFirebaseClientAuth } from "@/lib/firebase/client";
import { AuthFlowError } from "./errors";
import { registerAccount, requestPasswordReset, resendAccountVerification, verifiedSignInToken } from "./firebase-operations";
export { authErrorMessage } from "./errors";

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
    const idToken = await verifiedSignInToken(auth, email, password);
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

export async function signupWithEmail(fullName: string, email: string, password: string): Promise<void> {
  await registerAccount(getFirebaseClientAuth(), { fullName, email, password }, `${window.location.origin}/login?verified=1`);
}

export async function resendVerification(email: string, password: string): Promise<void> {
  await resendAccountVerification(getFirebaseClientAuth(), email, password, `${window.location.origin}/login?verified=1`);
}

export async function resetPassword(email: string): Promise<void> {
  await requestPasswordReset(getFirebaseClientAuth(), email, `${window.location.origin}/login?reset=1`);
}

export async function logout(): Promise<void> {
  try {
    const csrf = await csrfToken();
    await requestJson(await fetch("/api/auth/logout", {
      method: "POST", credentials: "same-origin", cache: "no-store", headers: { "X-CSRF-Token": csrf },
    }));
  } finally { await clearFirebaseClientAuth(); }
}
