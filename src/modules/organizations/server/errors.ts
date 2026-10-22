/** Messages are safe to return; never expose raw SQL Connect/provider errors. */
export class WorkspaceError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: 400 | 401 | 403 | 404 | 409 | 413 | 415 | 429 | 503,
    message: string,
  ) {
    super(message);
    this.name = "WorkspaceError";
  }
}

export function mapWorkspaceDataError(error: unknown): WorkspaceError {
  if (error instanceof WorkspaceError) return error;
  const providerError = typeof error === "object" && error !== null ? error as { code?: unknown; message?: unknown } : undefined;
  const code = providerError?.code;
  if (code === "data-connect/permission-denied") {
    return new WorkspaceError("PERMISSION_DENIED", 403, "You do not have permission to access this company data.");
  }
  if (code === "data-connect/query-error") {
    // SQL Connect reports failed @check predicates as query errors. Keep those
    // denials distinct, while unknown query failures remain database errors.
    const message = typeof providerError?.message === "string" ? providerError.message : "";
    if (message.includes("@check") || message.includes("PERMISSION_DENIED") ||
        /\b(?:ACTIVE_MEMBERSHIP_REQUIRED|ADMINISTRATOR_REQUIRED|LEAD_NOT_FOUND_OR_FORBIDDEN|CONTACT_NOT_FOUND_OR_FORBIDDEN)\b/.test(message)) {
      return new WorkspaceError("PERMISSION_DENIED", 403, "You do not have permission to access this company data.");
    }
    return new WorkspaceError("DATABASE_ERROR", 503, "Company data could not be loaded. Please try again.");
  }
  if (code === "data-connect/unauthenticated") {
    return new WorkspaceError("UNAUTHENTICATED", 401, "Sign in to continue.");
  }
  if (code === "data-connect/invalid-argument") {
    return new WorkspaceError("VALIDATION_ERROR", 400, "Check the supplied details and try again.");
  }
  if (code === "data-connect/not-found") {
    // Stored queries return null/[] for absent rows. This provider-level 404
    // means the configured service, connector or operation was not found.
    return new WorkspaceError("SQL_CONNECT_NOT_CONFIGURED", 503, "The company database connection is unavailable. Contact your workspace administrator.");
  }
  if (code === "data-connect/aborted") {
    return new WorkspaceError("CONFLICT", 409, "The record changed. Reload it and try again.");
  }
  return new WorkspaceError("DATABASE_ERROR", 503, "Workspace data is temporarily unavailable. Please try again.");
}

/** Match only allowlisted conflict signals; never return provider/SQL text. */
export function mapOrganizationCreationError(error: unknown): WorkspaceError {
  const code = typeof error === "object" && error !== null && "code" in error ? error.code : undefined;
  const message = typeof error === "object" && error !== null && "message" in error && typeof error.message === "string" ? error.message : "";
  if (code === "data-connect/already-exists" ||
      (["data-connect/query-error", "data-connect/permission-denied"].includes(String(code)) &&
       (/\bORGANIZATION_SLUG_TAKEN\b/.test(message) || /organization[^\n]*slug[^\n]*(?:key|unique)|unique[^\n]*organization[^\n]*slug/i.test(message)))) {
    return new WorkspaceError("ORGANIZATION_SLUG_TAKEN", 409, "A company with this slug already exists. Choose another slug.");
  }
  return mapWorkspaceDataError(error);
}
