import Anthropic from "@anthropic-ai/sdk";
import { WorkspaceError } from "../organizations/server/errors";

/**
 * Map Anthropic SDK failures to safe, user-facing errors. Provider messages,
 * request IDs and credentials are never included; the code is logged instead.
 * Order matters: in the TypeScript SDK the connection and abort errors are
 * subclasses of APIError, so they are checked first.
 */
export function mapAnthropicError(error: unknown): WorkspaceError {
  if (error instanceof WorkspaceError) return error;
  if (error instanceof Anthropic.APIUserAbortError) {
    return new WorkspaceError("AI_CANCELLED", 409, "The response was stopped.");
  }
  if (error instanceof Anthropic.APIConnectionTimeoutError) {
    return new WorkspaceError("AI_TIMEOUT", 504, "Claude took too long to respond. Try again or ask a narrower question.");
  }
  if (error instanceof Anthropic.APIConnectionError) {
    return new WorkspaceError("AI_PROVIDER_UNREACHABLE", 503, "The AI service could not be reached. Try again shortly.");
  }
  if (error instanceof Anthropic.AuthenticationError) {
    return new WorkspaceError("AI_PROVIDER_AUTH", 503, "The AI service rejected EstateOS's credentials. Ask an administrator to check the Anthropic API key.");
  }
  if (error instanceof Anthropic.PermissionDeniedError) {
    return new WorkspaceError("AI_PROVIDER_FORBIDDEN", 503, "The configured Anthropic API key is not permitted to use this model or feature.");
  }
  if (error instanceof Anthropic.NotFoundError) {
    return new WorkspaceError("AI_MODEL_UNAVAILABLE", 503, "The configured Claude model is not available. Ask an administrator to check ANTHROPIC_MODEL.");
  }
  if (error instanceof Anthropic.RateLimitError) {
    return new WorkspaceError("AI_PROVIDER_RATE_LIMITED", 429, "The AI service is receiving too many requests. Wait a moment and try again.", retryAfter(error.headers));
  }
  if (error instanceof Anthropic.APIError) {
    if (error.status === 402 || error.type === "billing_error") {
      return new WorkspaceError("AI_PROVIDER_BILLING", 503, "The AI service account has insufficient credits. Ask an administrator to review Anthropic billing.");
    }
    if (error.status === 529 || error.type === "overloaded_error") {
      return new WorkspaceError("AI_PROVIDER_OVERLOADED", 503, "The AI service is temporarily overloaded. Try again shortly.", 30);
    }
    if (error.type === "timeout_error" || error.status === 504) {
      return new WorkspaceError("AI_TIMEOUT", 504, "Claude took too long to respond. Try again or ask a narrower question.");
    }
    if (error instanceof Anthropic.BadRequestError) {
      return new WorkspaceError("AI_PROVIDER_REJECTED", 503, "The AI service rejected this request. Start a new conversation or shorten your message.");
    }
    return new WorkspaceError("AI_PROVIDER_ERROR", 503, "The AI service returned an error. Try again shortly.");
  }
  return new WorkspaceError("AI_ERROR", 503, "The AI Copilot could not complete this request. Try again shortly.");
}

function retryAfter(headers: Headers | undefined) {
  const value = Number(headers?.get("retry-after"));
  return Number.isFinite(value) && value > 0 ? Math.min(Math.ceil(value), 3600) : 30;
}

/** Errors worth a manual retry from the chat interface. */
export function isRetryableAiError(code: string) {
  return ["AI_TIMEOUT", "AI_PROVIDER_UNREACHABLE", "AI_PROVIDER_RATE_LIMITED", "AI_PROVIDER_OVERLOADED", "AI_PROVIDER_ERROR",
    "AI_ERROR", "AI_CANCELLED", "AI_RESPONSE_INCOMPLETE", "AI_INVALID_OUTPUT", "RATE_LIMITED", "DATABASE_ERROR", "CONFLICT", "AI_SAVE_FAILED"].includes(code);
}
