import "server-only";

import { asMember, asServer, sdk, type Context } from "@/modules/communications/server/data";
import { WorkspaceError } from "@/modules/organizations/server/errors";
import { canonicalUuid } from "@/modules/organizations/server/identifiers";
import { TokenVaultError, openSecret, sealSecret, vaultConfigured, type VaultBinding } from "../vault";
import { readInboxSecret } from "./connections";

/*
 * WhatsApp channel credentials without server secret names (docs/CHANNEL_ADAPTERS.md#connections).
 *
 * - The Meta APP SECRET belongs to EstateOS (one Meta app for every company), so a channel uses the platform's
 *   secret, INBOX_WHATSAPP_APP_SECRET (and its _VERIFY_TOKEN), unless EstateOS staff name another one.
 * - The ACCESS TOKEN belongs to the company: an owner or administrator pastes it once; the server encrypts it
 *   (AES-256-GCM, bound to the company and the connection) and stores only the ciphertext, which no query returns.
 *   A token named as a server secret (accessTokenReference) still works for staff-managed channels.
 */

export const PLATFORM_APP_SECRET = "INBOX_WHATSAPP_APP_SECRET";
const binding = (organizationId: string, connectionId: string): VaultBinding => ({purpose: "whatsapp-access-token", organizationId: canonicalUuid(organizationId), recordId: canonicalUuid(connectionId)});
/** A Meta access token: one line, no spaces, of a plausible length (it is never logged or returned). */
export const ACCESS_TOKEN_PATTERN = /^[A-Za-z0-9._|-]{40,2048}$/;

/** Encrypts and saves a channel's access token as the signed-in owner or administrator (the database checks the role). */
export async function saveChannelAccessToken(context: Context, connectionId: string, expectedRevision: number, token: string) {
  if (!ACCESS_TOKEN_PATTERN.test(token)) throw new WorkspaceError("VALIDATION_ERROR", 400, "Paste the whole access token from Meta (one line, no spaces).");
  if (!vaultConfigured()) throw new WorkspaceError("INBOX_TOKEN_STORAGE_UNAVAILABLE", 409, "This server cannot store access tokens yet: it has no encryption key (INBOX_TOKEN_ENCRYPTION_KEY). Ask the EstateOS administrator.");
  const sealed = sealSecret(token, binding(context.organizationId, connectionId));
  await asMember(context, "SaveChannelAccessToken", (dc, options) => sdk.saveChannelAccessToken(dc, {organizationId: context.organizationId, id: connectionId, expectedRevision,
    tokenCiphertext: sealed.ciphertext, tokenKeyId: sealed.keyId}, options));
}

/** The access token a channel sends and checks with: the saved one (decrypted on the server), otherwise the named server secret. */
export async function channelAccessToken(organizationId: string, connection: {id: string; accessTokenStoredAt?: string | null; accessTokenReference?: string | null}): Promise<string | null> {
  if (connection.accessTokenStoredAt) {
    const credential = (await asServer("ChannelAccessToken", dc => sdk.channelAccessToken(dc, {organizationId, id: canonicalUuid(connection.id)}))).credential;
    if (!credential) return null;
    try {
      return openSecret(credential.tokenCiphertext, credential.tokenKeyId, binding(organizationId, connection.id));
    } catch (error) {
      // A missing or changed server key: the token must be pasted again. Nothing about the token is logged.
      if (error instanceof TokenVaultError) { console.warn(JSON.stringify({event: "inbox.channel_token_unreadable", code: error.code})); return null; }
      throw error;
    }
  }
  return readInboxSecret(connection.accessTokenReference);
}
