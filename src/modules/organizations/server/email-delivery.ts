import { randomUUID } from "node:crypto";
import { z } from "zod";
import { WorkspaceError } from "./errors";

export type InvitationEmailConfiguration = { mode: "preview" } | { mode: "resend"; apiKey: string; from: string };
export type InvitationDelivery = { mode: "preview" | "accepted" | "failed"; message: string; previewUrl?: string };

export function invitationEmailConfiguration(environment: { nodeEnv?: string; provider?: string; apiKey?: string; from?: string }): InvitationEmailConfiguration {
  if (!environment.provider && environment.nodeEnv === "development") return { mode: "preview" };
  if (environment.provider === "resend" && environment.apiKey && environment.apiKey.length >= 8 &&
      environment.apiKey.length <= 1024 && !/[\r\n]/.test(environment.apiKey) && z.email().safeParse(environment.from).success) {
    return { mode: "resend", apiKey: environment.apiKey, from: environment.from! };
  }
  throw new WorkspaceError("EMAIL_NOT_CONFIGURED", 503, "Invitation email delivery is not configured. Ask your administrator to configure a provider.");
}
const escape = (value: string) => value.replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);

/** Production caller is server-only; fetch injection isolates provider tests. */
export async function deliverInvitation(configuration: InvitationEmailConfiguration, email: { to: string; companyName: string; url: string; expiresAt: string }, send: typeof fetch = fetch): Promise<InvitationDelivery> {
  if (configuration.mode === "preview") return {
    mode: "preview", message: "Development preview only. No email was sent.", previewUrl: email.url,
  };
  try {
    const response = await send("https://api.resend.com/emails", {
      method: "POST", cache: "no-store", redirect: "error", signal: AbortSignal.timeout(10_000),
      headers: { Authorization: "Bearer " + configuration.apiKey, "Content-Type": "application/json", "Idempotency-Key": "estateos-invite-" + randomUUID() },
      body: JSON.stringify({
        from: configuration.from, to: [email.to],
        subject: "Join " + email.companyName.replace(/[\r\n]+/g, " ") + " on EstateOS",
        text: "You are invited to join " + email.companyName + " on EstateOS. Sign in with this verified email address and accept your invitation: " + email.url + "\nThis link expires at " + email.expiresAt + ". Ignore this email if you were not expecting it.",
        html: "<p>You are invited to join <strong>" + escape(email.companyName) + "</strong> on EstateOS.</p><p>Sign in with this verified email address, then accept your invitation.</p><p><a href=\"" + escape(email.url) + "\">Accept invitation</a></p><p>Expires at " + escape(email.expiresAt) + ". Ignore this email if you were not expecting it.</p>",
      }),
    });
    const receipt: unknown = await response.json().catch(() => null);
    if (response.ok && typeof receipt === "object" && receipt !== null && "id" in receipt && typeof receipt.id === "string" && receipt.id.length > 0) {
      return { mode: "accepted", message: "The email provider accepted the invitation for delivery." };
    }
  } catch { /* Never expose provider response bodies, credentials or invitation URLs. */ }
  return { mode: "failed", message: "Email delivery could not be confirmed. The invitation remains pending. Reissue it after one minute to create and send a new link." };
}
