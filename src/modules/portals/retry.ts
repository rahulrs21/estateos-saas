/**
 * Retry policy for future live publishing. Nothing calls a portal in this
 * phase; the policy is defined and tested now so the publisher, connection
 * status and ListingPublication.nextRetryAt follow one rule set later.
 */
export type PortalFailure = {httpStatus?: number; code?: string};
export type FailureClass = "RETRYABLE" | "PERMANENT" | "AUTHENTICATION";

export function classifyPortalFailure(failure: PortalFailure): FailureClass {
  const status = failure.httpStatus;
  if (status === 401 || status === 403) return "AUTHENTICATION";
  if (status === 408 || status === 425 || status === 429 || (status !== undefined && status >= 500)) return "RETRYABLE";
  if (failure.code && ["ETIMEDOUT", "ECONNRESET", "ECONNREFUSED", "EAI_AGAIN", "TIMEOUT"].includes(failure.code)) return "RETRYABLE";
  return "PERMANENT";
}

export type RetryPolicy = {baseDelaySeconds: number; maxDelaySeconds: number; maxAttempts: number};
export const defaultRetryPolicy: RetryPolicy = {baseDelaySeconds: 60, maxDelaySeconds: 6 * 60 * 60, maxAttempts: 6};

/**
 * Exponential backoff for the attempt that just failed (1-based). Returns null
 * when the failure must not be retried. `jitter` (0..1) is injected for tests.
 */
export function nextRetryAt(now: Date, attempt: number, failure: PortalFailure, policy = defaultRetryPolicy, jitter = 0): Date | null {
  if (classifyPortalFailure(failure) !== "RETRYABLE" || attempt >= policy.maxAttempts) return null;
  const delay = Math.min(policy.maxDelaySeconds, policy.baseDelaySeconds * 2 ** Math.max(0, attempt - 1));
  const withJitter = delay * (1 + Math.min(1, Math.max(0, jitter)) * 0.2);
  return new Date(now.getTime() + Math.round(withJitter) * 1000);
}
