import "server-only";

import { canonicalUuid } from "@/modules/organizations/server/identifiers";
import type { VaultBinding } from "@/modules/inbox/vault";

/*
 * Server secrets for Meta Lead Ads, read on the server only and never logged or returned.
 * - The Meta APP SECRET signs every webhook. Lead Ads uses the same Meta app as WhatsApp, so it is the same
 *   secret: META_APP_SECRET if set, otherwise INBOX_WHATSAPP_APP_SECRET (no second copy needed).
 * - META_LEAD_ADS_VERIFY_TOKEN is the random value Meta echoes when the webhook is set up.
 * - Page access tokens are stored encrypted in the database, bound to the company and the connection.
 */

const read = (name: string) => {
  const value = process.env[name]?.trim();
  return value && value.length >= 16 ? value : null;
};

export const metaAppSecret = () => read("META_APP_SECRET") ?? read("INBOX_WHATSAPP_APP_SECRET");
export const metaVerifyToken = () => read("META_LEAD_ADS_VERIFY_TOKEN");

export function pageTokenBinding(organizationId: string, connectionId: string): VaultBinding {
  return {purpose: "meta-page-token", organizationId: canonicalUuid(organizationId), recordId: canonicalUuid(connectionId)};
}
