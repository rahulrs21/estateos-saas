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
    if (/\b(?:WEBSITE_PAGE_CHANGED|WEBSITE_CHANGED)\b/.test(message)) {
      return new WorkspaceError("CONFLICT", 409, "This page was changed in another window or by a colleague. Reload it and try again.");
    }
    if (message.includes("WEBSITE_PAGE_LIVE_OR_CHANGED")) {
      return new WorkspaceError("CONFLICT", 409, "Unpublish the page before archiving it, or reload it if it was changed by a colleague.");
    }
    if (message.includes("WEBSITE_PAGE_SLUG_LIVE")) {
      return new WorkspaceError("CONFLICT", 409, "Another live page already uses this address. Change the page address or unpublish the other page.");
    }
    if (message.includes("PAGE_VERSION_NOT_APPROVED")) {
      return new WorkspaceError("CONFLICT", 409, "Only an approved version can be published. Submit the page for review first.");
    }
    if (/\b(?:WEBSITE_PAGE_NOT_FOUND|PAGE_VERSION_NOT_FOUND|PENDING_ENQUIRY_NOT_FOUND|WEBSITE_AGENT_NOT_FOUND|WEBSITE_MEDIA_NOT_FOUND|WEBSITE_SECTION_TEMPLATE_NOT_FOUND)\b/.test(message)) {
      return new WorkspaceError("NOT_FOUND", 404, "This record was not found or has already been handled.");
    }
    if (message.includes("LEAD_FORM_UNAVAILABLE")) {
      return new WorkspaceError("VALIDATION_ERROR", 400, "Choose a lead form of this company that is not disabled.");
    }
    if (/\b(?:WEBSITE_PAGE_CREATE_FORBIDDEN|WEBSITE_PAGE_EDIT_FORBIDDEN)\b/.test(message)) {
      return new WorkspaceError("PERMISSION_DENIED", 403, "You can create and edit only your own page drafts, and agents only when an owner or administrator allows agent drafts.");
    }
    if (/\b(?:WEBSITE_MEDIA_FORBIDDEN|WEBSITE_SECTION_TEMPLATE_FORBIDDEN)\b/.test(message)) {
      return new WorkspaceError("PERMISSION_DENIED", 403, "You can change only items you added, unless you are a company owner or administrator.");
    }
    if (/\b(?:WEBSITE_PAGE_APPROVAL_FORBIDDEN|WEBSITE_PUBLISH_FORBIDDEN|WEBSITE_FORM_FORBIDDEN|WEBSITE_SETTINGS_FORBIDDEN|WEBSITE_ENQUIRIES_FORBIDDEN)\b/.test(message)) {
      return new WorkspaceError("PERMISSION_DENIED", 403, "Only company owners and administrators can do this.");
    }
    if (message.includes("WEBSITE_PAGE_REVIEW_FORBIDDEN")) {
      return new WorkspaceError("PERMISSION_DENIED", 403, "Only owners, administrators and managers can review pages.");
    }
    if (message.includes("AUTOMATION_APPROVER_REQUIRED")) {
      return new WorkspaceError("PERMISSION_DENIED", 403, "Only company owners and administrators can approve, activate or pause workflows.");
    }
    if (message.includes("AUTOMATION_PERMISSION_DENIED")) {
      return new WorkspaceError("PERMISSION_DENIED", 403, "You can view and change only your own workflow drafts, unless you are a company owner, administrator or manager.");
    }
    if (/\b(?:AUTOMATION_CHANGED_RELOAD|AUTOMATION_TRANSITION_DENIED)\b/.test(message)) {
      return new WorkspaceError("CONFLICT", 409, "This workflow was changed in another window or by a colleague, or is no longer in a state that allows this. Reload it and try again.");
    }
    if (message.includes("AUTOMATION_WORKFLOW_LIMIT")) {
      return new WorkspaceError("CONFLICT", 409, "Your company has reached the limit of 200 workflows. Archive workflows you no longer need.");
    }
    if (message.includes("AUTOMATION_ACTIVE_LIMIT")) {
      return new WorkspaceError("CONFLICT", 409, "Your company has 50 active workflows, the most allowed. Pause one before activating another.");
    }
    if (message.includes("AUTOMATION_NOT_RUNNABLE")) {
      return new WorkspaceError("CONFLICT", 409, "Only an active workflow with the \"Run manually\" trigger can be run now.");
    }
    if (message.includes("AUTOMATION_APPROVAL_EXPIRED")) {
      return new WorkspaceError("AUTOMATION_APPROVAL_EXPIRED", 409, "This approval has expired and can no longer be decided. The workflow will not make this change.");
    }
    if (message.includes("AUTOMATION_APPROVAL_CHANGED")) {
      return new WorkspaceError("CONFLICT", 409, "This approval was already decided, cancelled or has expired. Reload the approvals list.");
    }
    if (message.includes("AUTOMATION_APPROVAL_FORBIDDEN")) {
      return new WorkspaceError("PERMISSION_DENIED", 403, "You cannot decide this approval: it needs a member who is allowed to perform the action and did not request it.");
    }
    if (/\b(?:AUTOMATION_NOT_FOUND|WORK_TASK_NOT_FOUND)\b/.test(message)) {
      return new WorkspaceError("NOT_FOUND", 404, "This record was not found in your company.");
    }
    if (message.includes("CALL_NUMBER_NOT_ON_RECORD")) {
      return new WorkspaceError("VALIDATION_ERROR", 400, "The number must be the customer's phone number on record. Update the contact first if they use another number.");
    }
    if (/\b(?:CALL_VIEWING_NOT_FOUND|CALL_FOLLOW_UP_NOT_FOUND)\b/.test(message)) {
      return new WorkspaceError("VALIDATION_ERROR", 400, "Choose a viewing or follow-up of this lead.");
    }
    if (message.includes("CALL_CHANGED_OR_FORBIDDEN")) {
      return new WorkspaceError("CONFLICT", 409, "This call was changed in another window, or only its agent or an administrator can change it. Reload and try again.");
    }
    if (message.includes("COMMUNICATION_ADMIN_REQUIRED")) {
      return new WorkspaceError("PERMISSION_DENIED", 403, "Only company owners and administrators can change communication settings and the do-not-call list.");
    }
    if (message.includes("COMMUNICATION_SETTINGS_CHANGED")) {
      return new WorkspaceError("CONFLICT", 409, "These settings were changed by a colleague. Reload and try again.");
    }
    if (/\b(?:COMMUNICATION_PROVIDER_CHANGED|CALL_STATUS_CHANGED)\b/.test(message)) {
      return new WorkspaceError("CONFLICT", 409, "This record was changed in another window or by a colleague. Reload and try again.");
    }
    if (message.includes("COMMUNICATION_PROVIDER_LIMIT")) {
      return new WorkspaceError("CONFLICT", 409, "Your company already has 10 provider connections. Disable or reuse one instead.");
    }
    if (message.includes("COMMUNICATION_SETTINGS_REQUIRED")) {
      return new WorkspaceError("VALIDATION_ERROR", 400, "Save the company's calling rules before confirming live calling.");
    }
    if (message.includes("PHONE_LINE_NOT_READY")) {
      return new WorkspaceError("VALIDATION_ERROR", 400, "Confirm the number is registered to the company and assign an active member before activating the line.");
    }
    if (message.includes("PHONE_LINE_INVALID")) {
      return new WorkspaceError("VALIDATION_ERROR", 400, "Choose a provider connection of this company and an active member, or reload if the line was changed. An active line must stay assigned.");
    }
    if (/\b(?:LIVE_CALL_LINE_UNAVAILABLE|LIVE_CALLING_NOT_ATTESTED)\b/.test(message)) {
      return new WorkspaceError("LIVE_CALLING_UNAVAILABLE", 409, "Live calling is not available: it needs a verified provider, an active registered line assigned to you and an administrator's confirmation.");
    }
    if (message.includes("CALL_AI_NOT_AVAILABLE")) {
      return new WorkspaceError("CALL_AI_NOT_AVAILABLE", 409, "Claude analysis is not available for this call: it needs the company's switch, an answered call, and the call's agent or an owner or administrator.");
    }
    if (/\b(?:CALL_AI_SUMMARY_CHANGED|CALL_AI_SUGGESTION_DECIDED)\b/.test(message)) {
      return new WorkspaceError("CONFLICT", 409, "This summary or suggestion was already handled, or you cannot change it. Reload the call.");
    }
    if (/\b(?:INBOX_CONVERSATION_NOT_FOUND|INBOX_LINK_TARGET_NOT_FOUND)\b/.test(message)) {
      return new WorkspaceError("NOT_FOUND", 404, "This conversation, lead or contact was not found, or you cannot use it.");
    }
    if (/\b(?:INBOX_CONVERSATION_CHANGED|INBOX_SETTINGS_CHANGED|OUTBOUND_MESSAGE_CHANGED)\b/.test(message)) {
      return new WorkspaceError("CONFLICT", 409, "This changed since you opened it, or you cannot change it. Reload and try again.");
    }
    if (/\b(?:INBOX_ASSIGNMENT_FORBIDDEN|INBOX_ADMIN_REQUIRED)\b/.test(message)) {
      return new WorkspaceError("PERMISSION_DENIED", 403, "You do not have permission to do this in the inbox.");
    }
    if (message.includes("CHANNEL_CONNECTION_LIMIT")) {
      return new WorkspaceError("VALIDATION_ERROR", 400, "A company can have up to 10 inbox channels. Disable or reuse an existing one.");
    }
    if (message.includes("CHANNEL_CONNECTION_CHANGED")) {
      return new WorkspaceError("CONFLICT", 409, "This channel changed since you opened it, or it cannot be changed here. Reload and try again.");
    }
    if (/\b(?:INBOX_ATTACHMENT_NOT_FOUND|INBOX_MESSAGE_NOT_FOUND)\b/.test(message)) {
      return new WorkspaceError("NOT_FOUND", 404, "This attachment was not found, or you cannot open it.");
    }
    if (message.includes("INBOX_ATTACHMENT_UNAVAILABLE")) {
      return new WorkspaceError("CONFLICT", 409, "This attachment cannot be opened: it was not downloaded from the provider, or the file check blocked it.");
    }
    if (message.includes("INBOX_ASSIGNEE_INVALID")) {
      return new WorkspaceError("VALIDATION_ERROR", 400, "Assign the conversation to an active member of your company.");
    }
    if (message.includes("SIMULATION_ADMIN_REQUIRED")) {
      return new WorkspaceError("PERMISSION_DENIED", 403, "Only owners and administrators can use the communication simulator.");
    }
    if (message.includes("SIMULATION_LEAD_REQUIRED")) {
      return new WorkspaceError("VALIDATION_ERROR", 400, "Simulated calls can only be made on the simulator's own fictional leads.");
    }
    if (message.includes("MEETING_TARGET_NOT_FOUND")) {
      return new WorkspaceError("NOT_FOUND", 404, "This lead or contact was not found, or you cannot schedule meetings for it.");
    }
    if (message.includes("MEETING_ATTENDEE_INVALID")) {
      return new WorkspaceError("VALIDATION_ERROR", 400, "Invite active members of your company only.");
    }
    if (message.includes("MEETING_CHANGED")) {
      return new WorkspaceError("CONFLICT", 409, "This meeting changed, was already updated, or you cannot change it. Reload it.");
    }
    if (message.includes("VOICE_ASSISTANT_ADMIN_REQUIRED")) {
      return new WorkspaceError("PERMISSION_DENIED", 403, "Only an owner or administrator can configure or test the voice assistant.");
    }
    if (message.includes("VOICE_ASSISTANT_NOT_READY")) {
      return new WorkspaceError("VOICE_ASSISTANT_NOT_READY", 409, "The voice assistant is not ready for testing, or its settings changed. Mark it ready for testing and try again.");
    }
    if (message.includes("VOICE_ASSISTANT_CHANGED")) {
      return new WorkspaceError("CONFLICT", 409, "The voice assistant settings were changed by someone else. Reload and try again.");
    }
    if (message.includes("VOICE_TEST_SESSION_CHANGED")) {
      return new WorkspaceError("CONFLICT", 409, "This test call changed or has ended. Reload it.");
    }
    if (message.includes("RECORDING_NOT_ENABLED")) {
      return new WorkspaceError("RECORDING_NOT_ENABLED", 409, "Recording is not enabled for your company. An owner or administrator can enable it with the notice and legal basis in Calling settings.");
    }
    if (message.includes("CALL_CONSENT_REQUIRED")) {
      return new WorkspaceError("CALL_CONSENT_REQUIRED", 409, "Record the customer's notice or consent for this answered call before adding a recording or transcript.");
    }
    if (/\b(?:CALL_CONSENT_NOT_FOUND|CALL_MEDIA_NOT_FOUND)\b/.test(message)) {
      return new WorkspaceError("NOT_FOUND", 404, "This record was not found, was already withdrawn or deleted, or you cannot change it.");
    }
    if (/\b(?:CALL_NOT_FOUND|COMMUNICATION_SUPPRESSION_NOT_FOUND)\b/.test(message)) {
      return new WorkspaceError("NOT_FOUND", 404, "This record was not found in your company.");
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
