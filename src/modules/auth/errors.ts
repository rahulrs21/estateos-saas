export class AuthFlowError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = "AuthFlowError";
  }
}

export function providerCode(error: unknown): string | undefined {
  return typeof error === "object" && error !== null && "code" in error && typeof error.code === "string" ? error.code : undefined;
}

/** Never show raw provider details or disclose whether a reset email has an account. */
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
