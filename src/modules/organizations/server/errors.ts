/** Messages are safe to return; never expose raw SQL Connect/provider errors. */
export class WorkspaceError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: 400 | 401 | 403 | 404 | 409 | 413 | 415 | 429 | 503 | 504,
    message: string,
    /** Sent as Retry-After on 429/503 responses. */
    public readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = "WorkspaceError";
  }
}

export function mapWorkspaceDataError(error: unknown): WorkspaceError {
  if (error instanceof WorkspaceError) return error;
  const providerError = typeof error === "object" && error !== null ? error as { code?: unknown; message?: unknown } : undefined;
  const code = providerError?.code;
  if (code === "data-connect/already-exists") {
    return new WorkspaceError("CONFLICT", 409, "A record with these unique identifiers already exists. Review the reference and try again.");
  }
  if (code === "data-connect/permission-denied") {
    return new WorkspaceError("PERMISSION_DENIED", 403, "You do not have permission to access this company data.");
  }
  if (code === "data-connect/query-error") {
    // SQL Connect reports failed @check predicates as query errors. Keep those
    // denials distinct, while unknown query failures remain database errors.
    const message = typeof providerError?.message === "string" ? providerError.message : "";
    if (/\b(?:SHORTLIST_CHANGED_RELOAD|LEAD_CHANGED_RELOAD|VIEWING_CHANGED_RELOAD|VIEWING_CHANGED_OR_FORBIDDEN)\b/.test(message)) {
      return new WorkspaceError("CONFLICT", 409, "This record changed or is no longer editable. Reload the lead and try again.");
    }
    if (message.includes("PROPERTY_UNAVAILABLE_OR_FORBIDDEN")) {
      return new WorkspaceError("PERMISSION_DENIED", 403, "This property is unavailable or outside your permitted inventory. Refresh the lead to see current availability.");
    }
    if (message.includes("SHORTLIST_REQUIRED")) {
      return new WorkspaceError("VALIDATION_ERROR", 400, "Save this property to the shortlist before scheduling a viewing.");
    }
    if (message.includes("VIEWING_ASSIGNEE_FORBIDDEN")) {
      return new WorkspaceError("VALIDATION_ERROR", 400, "Choose an active owner or administrator, or the agent assigned to both this lead and this property.");
    }
    if (/\b(?:PORTAL_CONNECTION_CHANGED_RELOAD|PUBLICATION_LOCKED)\b/.test(message)) {
      return new WorkspaceError("CONFLICT", 409, "This portal record changed or is locked by a publication in progress. Reload and try again.");
    }
    if (/\b(?:LISTING_NOT_FOUND|PORTAL_MAPPING_NOT_FOUND)\b/.test(message)) {
      return new WorkspaceError("NOT_FOUND", 404, "This record was not found in your company.");
    }
    if (message.includes("DEVELOPER_HAS_ACTIVE_PROJECTS")) {
      return new WorkspaceError("CONFLICT", 409, "Archive or move this developer’s active projects before archiving the developer.");
    }
    if (message.includes("AI_CONVERSATION_NOT_FOUND")) {
      return new WorkspaceError("NOT_FOUND", 404, "This conversation was not found.");
    }
    if (/\bINVENTORY_RECORD_NOT_FOUND\b/.test(message)) {
      // Raised by assigned-record queries: missing and not-assigned look the same.
      return new WorkspaceError("NOT_FOUND", 404, "This record is unavailable or outside your permitted inventory.");
    }
    if (/\b(?:AI_CONTENT_DRAFT_CHANGED|AI_CONTENT_RECORD_CHANGED)\b/.test(message)) {
      return new WorkspaceError("CONFLICT", 409, "This record was changed in another window or by a colleague. Reload it and try again.");
    }
    if (/\b(?:AI_CONTENT_DRAFT_NOT_FOUND|AI_CONTENT_RECORD_NOT_FOUND)\b/.test(message)) {
      return new WorkspaceError("NOT_FOUND", 404, "This record was not found.");
    }
    if (message.includes("AI_CONTENT_APPROVAL_FORBIDDEN")) {
      return new WorkspaceError("PERMISSION_DENIED", 403, "Only company owners and administrators can approve drafts, and other members can change only their own drafts.");
    }
    if (message.includes("QUALIFICATION_CHANGED_RELOAD")) {
      return new WorkspaceError("CONFLICT", 409, "The qualification details were changed in another window or by a colleague. Reload the lead and try again.");
    }
    if (message.includes("ASSESSMENT_NOT_FOUND")) {
      return new WorkspaceError("CONFLICT", 409, "This assessment is no longer current for the lead. Reload the lead and review the latest assessment.");
    }
    if (message.includes("AI_CONVERSATION_CHANGED")) {
      return new WorkspaceError("CONFLICT", 409, "This conversation changed in another window. Reload it and try again.");
    }
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

/**
 * Inventory operations added in Phase 5B must also be registered on a hosted
 * SQL Connect service. Local schema compilation/emulator success cannot make
 * an undeployed stored operation available to a hosted backend.
 */
export function mapWorkspaceOperationError(
  error: unknown,
  operationName: string,
  usingEmulator: boolean,
): WorkspaceError {
  const mapped = mapWorkspaceDataError(error);
  const providerError = typeof error === "object" && error !== null
    ? error as {code?: unknown}
    : undefined;
  const inventoryListOperation = ["ListDevelopers", "ListProjects", "ListPropertiesAdvanced"].includes(operationName);
  const failureHint = getSafeDataConnectDiagnostics(error).failureHint;
  const schemaOrOperationMismatch = [
    "graphql-field-not-found", "graphql-argument-not-found", "graphql-type-not-found",
    "stored-operation-not-found", "postgres-relation-not-found", "postgres-column-not-found",
  ].some((prefix) => failureHint.startsWith(prefix));

  if (!usingEmulator && inventoryListOperation && providerError?.code === "data-connect/query-error" && mapped.code === "DATABASE_ERROR" && schemaOrOperationMismatch) {
    return new WorkspaceError(
      "SQL_CONNECT_ROLLOUT_REQUIRED",
      503,
      "The connected SQL Connect service is missing an inventory schema or query update. Apply the reviewed EstateOS SQL Connect update to this development service, then reload this page.",
    );
  }
  return mapped;
}

const safeDataConnectCodes = new Set([
  "data-connect/aborted", "data-connect/already-exists", "data-connect/invalid-argument",
  "data-connect/invalid-credential", "data-connect/internal-error", "data-connect/not-found",
  "data-connect/permission-denied", "data-connect/query-error", "data-connect/unauthenticated",
  "data-connect/unknown-error",
]);

/** A low-risk server diagnostic: no provider message, request variables, IDs or file paths. */
export function getSafeDataConnectDiagnostics(error: unknown) {
  const providerError = typeof error === "object" && error !== null
    ? error as {
      code?: unknown;
      message?: unknown;
      stack?: unknown;
      httpResponse?: {status?: unknown; data?: unknown};
    }
    : undefined;
  const code = typeof providerError?.code === "string" && safeDataConnectCodes.has(providerError.code)
    ? providerError.code
    : "unclassified";
  const responseErrors = providerError?.httpResponse?.data && typeof providerError.httpResponse.data === "object"
    ? (providerError.httpResponse.data as {errors?: unknown}).errors
    : undefined;
  const responseMessages = Array.isArray(responseErrors)
    ? responseErrors.flatMap((item) => item && typeof item === "object" && "message" in item && typeof item.message === "string" ? [item.message] : [])
    : [];
  const message = [typeof providerError?.message === "string" ? providerError.message : "", ...responseMessages].join(" ").slice(0, 8_000);
  let failureHint = "unclassified-query-error";
  let failureClass = "provider-error";
  const graphqlField = message.match(/Cannot query field ['"]([A-Za-z_][A-Za-z0-9_]*)['"] on type ['"]([A-Za-z_][A-Za-z0-9_]*)['"]/i);
  const graphqlArgument = message.match(/Unknown argument ['"]([A-Za-z_][A-Za-z0-9_]*)['"]/i);
  const graphqlType = message.match(/Unknown type ['"]([A-Za-z_][A-Za-z0-9_]*)['"]/i);
  const pgRelation = message.match(/relation ['"]([a-z_][a-z0-9_]*)['"] does not exist/i);
  const pgColumn = message.match(/column ['"]([a-z_][a-z0-9_]*)['"] does not exist/i);
  if (message.includes("DEVELOPER_HAS_ACTIVE_PROJECTS")) {
    failureClass = "business-conflict";
    failureHint = "business-conflict";
  } else if (/ACTIVE_MEMBERSHIP_REQUIRED|ADMINISTRATOR_REQUIRED|INVENTORY_ADMIN_REQUIRED|@check|permission denied/i.test(message)) {
    failureClass = "authorization-check";
    failureHint = "authorization-check-failed";
  } else if (graphqlField) {
    failureClass = "schema-or-operation-mismatch";
    failureHint = `graphql-field-not-found:${graphqlField[1]}:${graphqlField[2]}`;
  } else if (graphqlArgument) {
    failureClass = "schema-or-operation-mismatch";
    failureHint = `graphql-argument-not-found:${graphqlArgument[1]}`;
  } else if (graphqlType) {
    failureClass = "schema-or-operation-mismatch";
    failureHint = `graphql-type-not-found:${graphqlType[1]}`;
  } else if (/unknown (?:query|mutation) operation|operation (?:was )?not found|operation is not deployed/i.test(message)) {
    failureClass = "schema-or-operation-mismatch";
    failureHint = "stored-operation-not-found";
  } else if (pgRelation) {
    failureClass = "schema-or-operation-mismatch";
    failureHint = `postgres-relation-not-found:${pgRelation[1].toLowerCase()}`;
  } else if (pgColumn) {
    failureClass = "schema-or-operation-mismatch";
    failureHint = `postgres-column-not-found:${pgColumn[1].toLowerCase()}`;
  } else if (/invalid input syntax|invalid value for argument|variable .* got invalid value/i.test(message)) {
    failureClass = "invalid-operation-arguments";
    failureHint = "invalid-operation-arguments";
  } else if (/timeout|unavailable|connection refused|could not connect|network/i.test(message)) {
    failureClass = "service-unavailable";
    failureHint = "service-unavailable";
  } else if (/violates (?:a )?(?:foreign key|unique|check) constraint/i.test(message)) {
    failureClass = "database-constraint";
    failureHint = "database-constraint";
  }

  const frames = typeof providerError?.stack === "string" ? providerError.stack.split("\n").slice(1, 5) : [];
  const stackFrames = frames.map((frame) => {
    const located = frame.match(/^\s*at\s+(.+?)\s+\((?:.*[\\/])?([^\\/():]+):(\d+):\d+\)?$/);
    if (located) {
      const functionName = located[1].replace(/[^A-Za-z0-9_.$<>-]/g, "").slice(0, 80) || "anonymous";
      return `${functionName} (${located[2]}:${located[3]})`;
    }
    const bare = frame.match(/^\s*at\s+(?:.*[\\/])?([^\\/():]+):(\d+):\d+\s*$/);
    return bare ? `${bare[1]}:${bare[2]}` : "unavailable";
  }).filter(value => value !== "unavailable");

  const httpStatus = typeof providerError?.httpResponse?.status === "number" && Number.isInteger(providerError.httpResponse.status)
    ? providerError.httpResponse.status
    : null;
  return {code, failureClass, failureHint, httpStatus, stackFrames};
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
