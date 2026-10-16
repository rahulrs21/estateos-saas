export type AuthConfigurationReason =
  | "APP_ORIGIN_MISSING"
  | "APP_ORIGIN_INVALID"
  | "ADMIN_PROJECT_MISSING"
  | "ADMIN_PROJECT_MISMATCH"
  | "ADMIN_CONFIGURATION_CONFLICT"
  | "ADMIN_CREDENTIALS_INCOMPLETE"
  | "ADMIN_CREDENTIALS_INVALID"
  | "ADMIN_PERMISSION_DENIED";

/** Fixed public details; reason is for allowlisted server diagnostics only. */
export class AuthConfigurationError extends Error {
  readonly code = "AUTH_CONFIGURATION_ERROR";
  readonly status = 503;

  constructor(public readonly reason: AuthConfigurationReason) {
    super("Authentication setup is incomplete. Contact your administrator.");
    this.name = "AuthConfigurationError";
  }
}

/** Never retain provider messages, credential values or arbitrary error fields. */
export function classifyAuthConfigurationError(error: unknown): AuthConfigurationError | undefined {
  if (error instanceof AuthConfigurationError) return error;
  if (typeof error !== "object" || error === null || !("code" in error)) return undefined;
  switch (error.code) {
    case "app/invalid-credential":
    case "auth/invalid-credential":
      return new AuthConfigurationError("ADMIN_CREDENTIALS_INVALID");
    case "auth/insufficient-permission":
      return new AuthConfigurationError("ADMIN_PERMISSION_DENIED");
    default:
      return undefined;
  }
}
