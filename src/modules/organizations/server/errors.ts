/** Messages are safe to return; never expose raw SQL Connect/provider errors. */
export class WorkspaceError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: 400 | 401 | 403 | 404 | 409 | 413 | 415 | 503,
    message: string,
  ) {
    super(message);
    this.name = "WorkspaceError";
  }
}

export function mapWorkspaceDataError(error: unknown): WorkspaceError {
  if (error instanceof WorkspaceError) return error;
  const code = typeof error === "object" && error !== null && "code" in error
    ? error.code
    : undefined;
  if (code === "data-connect/permission-denied" || code === "data-connect/query-error") {
    return new WorkspaceError("OPERATION_REJECTED", 403, "This operation is not permitted or the record is no longer available.");
  }
  if (code === "data-connect/unauthenticated") {
    return new WorkspaceError("UNAUTHENTICATED", 401, "Sign in to continue.");
  }
  if (code === "data-connect/invalid-argument") {
    return new WorkspaceError("INVALID_INPUT", 400, "Check the supplied details and try again.");
  }
  if (code === "data-connect/not-found") {
    return new WorkspaceError("NOT_FOUND", 404, "The requested record is unavailable.");
  }
  if (code === "data-connect/aborted") {
    return new WorkspaceError("CONFLICT", 409, "The record changed. Reload it and try again.");
  }
  return new WorkspaceError("DATA_UNAVAILABLE", 503, "Workspace data is temporarily unavailable. Please try again.");
}
