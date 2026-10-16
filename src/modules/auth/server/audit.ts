import "server-only";
import type { AuthConfigurationReason } from "./configuration-error";

type AuthAuditEvent = "auth.session.created" | "auth.session.rejected" | "auth.session.logout";

/** Allowlisted fields only: never pass errors, tokens, passwords, email or credentials. */
export function recordAuthEvent(
  event: AuthAuditEvent,
  detail: { uid?: string; reason?: AuthConfigurationReason; outcome: "success" | "unauthorized" | "forbidden" | "unavailable" | "invalid-request" },
): void {
  console.info(JSON.stringify({
    event,
    timestamp: new Date().toISOString(),
    outcome: detail.outcome,
    ...(detail.uid ? { uid: detail.uid } : {}),
    ...(detail.reason ? { reason: detail.reason } : {}),
  }));
}
