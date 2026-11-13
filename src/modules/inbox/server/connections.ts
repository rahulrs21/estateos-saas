import "server-only";

import { randomUUID } from "node:crypto";
import { z } from "zod";
import { getAppOrigin } from "@/modules/auth/server/config";
import { asMember, asServer, isAdministrator, sdk, type Context } from "@/modules/communications/server/data";
import { idSchema, parseInput } from "@/modules/communications/server/validation";
import { WorkspaceError } from "@/modules/organizations/server/errors";
import { canonicalUuid } from "@/modules/organizations/server/identifiers";
import { ADAPTERS, CREDENTIAL_REFERENCE, WEBHOOK_SLUGS, canSend } from "../adapters";
import { accessToken, checkBusinessAccount, checkPhoneNumber, liveSendingConfigured, testRecipients } from "./whatsapp-cloud";
import { forgetTemplates } from "./whatsapp-templates";
import type { ChannelProvider } from "../model";

/*
 * Channel connections (docs/CHANNEL_ADAPTERS.md#connections). OWNERs and ADMINs
 * only; the database checks the role again. Credentials are never stored or
 * returned: a connection names server secrets (INBOX_...) and the page only
 * shows whether they are set. A WhatsApp connection becomes VERIFIED only by a
 * live check with Meta (Phase 7B), and sends only after an administrator turns
 * sending on, on a server with test recipients configured (7B.1).
 */

const ADMIN_ONLY = "Only company owners and administrators can manage inbox channels.";
// Gmail is connected through Google sign-in (server/mailboxes.ts), never by entering details here.
const CONFIGURABLE = ["WHATSAPP_CLOUD"] as const;
export const VERIFY_TOKEN_SUFFIX = "_VERIFY_TOKEN";

/** A secret named by a connection, read on the server only (never returned to a browser). */
export function readInboxSecret(name: string | null | undefined): string | null {
  if (!name || !/^INBOX_[A-Z0-9_]{3,80}$/.test(name)) return null;
  const value = process.env[name]?.trim();
  return value && value.length >= 8 ? value : null;
}

const ACCOUNT_RULES: Record<(typeof CONFIGURABLE)[number], {pattern: RegExp; label: string}> = {
  WHATSAPP_CLOUD: {pattern: /^\d{5,30}$/, label: "WhatsApp phone number ID (digits, from Meta's WhatsApp Manager)"},
};

const optional = (max: number) => z.string().trim().max(max).nullable().default(null).transform(value => value || null);
const credential = optional(64).refine(value => value === null || CREDENTIAL_REFERENCE.test(value),
  "The secret name must start with INBOX_ and use capital letters, digits and underscores (for example INBOX_WHATSAPP_APP_SECRET). Enter the name of the server secret, never the secret itself.");
const connectionSchema = z.strictObject({
  provider: z.enum(CONFIGURABLE),
  displayName: z.string().trim().min(2).max(80),
  externalAccountReference: optional(200),
  credentialReference: credential,
  accessTokenReference: credential,
  /** Phase 7B.2: the WhatsApp Business Account the number belongs to (digits; not a secret). */
  businessAccountReference: optional(40).refine(value => value === null || /^\d{5,30}$/.test(value), "The WhatsApp Business Account ID is the number shown in WhatsApp Manager (digits only)."),
});
const updateSchema = connectionSchema.omit({provider: true}).extend({expectedRevision: z.number().int().min(1)});

const ACCOUNT_TAKEN = "This provider account is already connected to EstateOS. Each account can belong to one company only.";

/** A provider account belongs to one EstateOS company only (the webhook resolves the company from it). */
async function assertAccountFree(provider: (typeof CONFIGURABLE)[number], reference: string | null, ownId: string | null) {
  if (!reference) return;
  const {connections} = await asServer("ChannelAccountInUse", dc => sdk.channelAccountInUse(dc, {provider: sdk.ChannelProvider[provider], externalAccountReference: reference}));
  if (connections.some(row => canonicalUuid(row.id) !== ownId)) throw new WorkspaceError("CONFLICT", 409, ACCOUNT_TAKEN);
}
function accountTaken(error: unknown): never {
  if (error instanceof WorkspaceError && error.code === "CONFLICT" && /unique identifiers/.test(error.message)) throw new WorkspaceError("CONFLICT", 409, ACCOUNT_TAKEN);
  throw error;
}

function requireAdministrator(context: Context) {
  if (!isAdministrator(context)) throw new WorkspaceError("PERMISSION_DENIED", 403, ADMIN_ONLY);
}

function validateAccount(provider: (typeof CONFIGURABLE)[number], reference: string | null) {
  const rule = ACCOUNT_RULES[provider];
  if (reference && !rule.pattern.test(reference)) throw new WorkspaceError("VALIDATION_ERROR", 400, `Enter a valid ${rule.label}.`);
  return reference && provider !== "WHATSAPP_CLOUD" ? reference.toLowerCase() : reference;
}

export function webhookPath(provider: ChannelProvider, connectionId: string) {
  const slug = Object.entries(WEBHOOK_SLUGS).find(([, value]) => value === provider)?.[0];
  return slug ? `/api/inbox/webhooks/${slug}/${canonicalUuid(connectionId)}` : null;
}

export async function listConnections(context: Context) {
  requireAdministrator(context);
  const data = await asMember(context, "ListChannelConnections", (dc, options) => sdk.listChannelConnections(dc, {organizationId: context.organizationId}, options));
  const origin = getAppOrigin();
  return {
    providers: CONFIGURABLE.map(provider => ({provider, label: ADAPTERS[provider].label, capabilities: ADAPTERS[provider].capabilities, accountLabel: ACCOUNT_RULES[provider].label})),
    connections: data.connections.filter(row => row.provider !== "GMAIL" && row.provider !== "MICROSOFT_365").map(row => {
      const provider = row.provider as ChannelProvider;
      const adapter = ADAPTERS[provider];
      const receives = adapter.capabilities.RECEIVE_EVENTS === "SUPPORTED" && provider !== "DEVELOPMENT_SIMULATOR" && provider !== "WEBSITE_FORM" && provider !== "INTERNAL";
      const path = receives ? webhookPath(provider, row.id) : null;
      return {
        id: canonicalUuid(row.id), provider, label: adapter.label, displayName: row.displayName, externalAccountReference: row.externalAccountReference ?? null, businessAccountReference: row.businessAccountReference ?? null,
        connectionStatus: row.connectionStatus, credentialReference: row.credentialReference ?? null, revision: row.revision, lastEventAt: row.lastEventAt ?? null,
        createdAt: row.createdAt, createdBy: row.createdBy?.displayName ?? null, capabilities: adapter.capabilities,
        secretAvailable: Boolean(readInboxSecret(row.credentialReference)),
        accessTokenReference: row.accessTokenReference ?? null, accessTokenAvailable: Boolean(readInboxSecret(row.accessTokenReference)),
        verifiedAt: row.verifiedAt ?? null, verifiedName: row.verifiedName ?? null, verifiedDisplayNumber: row.verifiedDisplayNumber ?? null,
        sendingEnabled: row.sendingEnabled,
        // What this server allows: the 7B.1 test recipients (a count only; numbers stay on the server).
        liveSending: provider === "WHATSAPP_CLOUD" ? {configured: liveSendingConfigured(), testRecipients: testRecipients().length} : null,
        verifyTokenName: provider === "WHATSAPP_CLOUD" && row.credentialReference ? `${row.credentialReference}${VERIFY_TOKEN_SUFFIX}` : null,
        verifyTokenAvailable: provider === "WHATSAPP_CLOUD" && Boolean(readInboxSecret(row.credentialReference ? `${row.credentialReference}${VERIFY_TOKEN_SUFFIX}` : null)),
        webhookUrl: path ? `${origin}${path}` : null,
        canSend: (canSend(provider) && row.sendingEnabled) || (provider === "WHATSAPP_CLOUD" && row.sendingEnabled && row.connectionStatus === "VERIFIED" && liveSendingConfigured()),
        simulator: provider === "DEVELOPMENT_SIMULATOR",
      };
    }),
  };
}
export type ConnectionsView = Awaited<ReturnType<typeof listConnections>>;

export async function createConnection(context: Context, body: unknown) {
  requireAdministrator(context);
  const input = parseInput(connectionSchema, body);
  const externalAccountReference = validateAccount(input.provider, input.externalAccountReference);
  await assertAccountFree(input.provider, externalAccountReference, null);
  const id = randomUUID();
  await asMember(context, "CreateChannelConnection", (dc, options) => sdk.createChannelConnection(dc, {
    organizationId: context.organizationId, id, provider: sdk.ChannelProvider[input.provider], displayName: input.displayName, externalAccountReference, credentialReference: input.credentialReference,
    accessTokenReference: input.provider === "WHATSAPP_CLOUD" ? input.accessTokenReference : null, businessAccountReference: input.provider === "WHATSAPP_CLOUD" ? input.businessAccountReference : null,
  }, options)).catch(accountTaken);
  return {id};
}

export async function updateConnection(context: Context, rawId: string, body: unknown) {
  requireAdministrator(context);
  const id = parseInput(idSchema, rawId);
  const input = parseInput(updateSchema, body);
  // The account is checked against the stored provider, never one named in the request.
  const {connections} = await asMember(context, "ListChannelConnections", (dc, options) => sdk.listChannelConnections(dc, {organizationId: context.organizationId}, options));
  const provider = connections.find(row => canonicalUuid(row.id) === id)?.provider as ChannelProvider | undefined;
  if (!provider || !(CONFIGURABLE as readonly string[]).includes(provider)) throw new WorkspaceError("NOT_FOUND", 404, "This channel connection was not found.");
  const externalAccountReference = validateAccount(provider as (typeof CONFIGURABLE)[number], input.externalAccountReference);
  await assertAccountFree(provider as (typeof CONFIGURABLE)[number], externalAccountReference, id);
  await asMember(context, "UpdateChannelConnection", (dc, options) => sdk.updateChannelConnection(dc, {
    organizationId: context.organizationId, id, expectedRevision: input.expectedRevision, displayName: input.displayName, externalAccountReference, credentialReference: input.credentialReference,
    accessTokenReference: provider === "WHATSAPP_CLOUD" ? input.accessTokenReference : null, businessAccountReference: provider === "WHATSAPP_CLOUD" ? input.businessAccountReference : null,
  }, options)).catch(accountTaken);
  forgetTemplates(id);
  return {id};
}

export async function setConnectionEnabled(context: Context, rawId: string, body: unknown) {
  requireAdministrator(context);
  const id = parseInput(idSchema, rawId);
  const {expectedRevision, enabled} = parseInput(z.strictObject({expectedRevision: z.number().int().min(1), enabled: z.boolean()}), body);
  await asMember(context, "SetChannelConnectionEnabled", (dc, options) => sdk.setChannelConnectionEnabled(dc, {organizationId: context.organizationId, id, expectedRevision, enabled}, options));
  return {id, enabled};
}

/** The connection with its secret names, after checking the actor is an OWNER or ADMIN. */
async function connectionForCheck(context: Context, id: string) {
  const data = await asServer("ChannelConnectionForCheck", dc => sdk.channelConnectionForCheck(dc, {organizationId: context.organizationId, id, actorUid: context.request.user.uid}));
  if (!data.connection) throw new WorkspaceError("NOT_FOUND", 404, "This channel connection was not found.");
  return data.connection;
}

/**
 * The live connection check (Phase 7B): Meta must confirm the phone number ID with
 * the access token. Only then is the connection VERIFIED; a failure marks it ERROR
 * and turns sending off. A read-only request; nothing is sent to anyone.
 */
export async function checkConnection(context: Context, rawId: string) {
  requireAdministrator(context);
  const id = parseInput(idSchema, rawId);
  const connection = await connectionForCheck(context, id);
  if (connection.provider !== "WHATSAPP_CLOUD") throw new WorkspaceError("VALIDATION_ERROR", 400, "Only WhatsApp connections can be checked in this phase.");
  if (!["CONFIGURED", "VERIFIED", "ERROR"].includes(connection.connectionStatus) || !connection.externalAccountReference) {
    throw new WorkspaceError("VALIDATION_ERROR", 400, "Enter the phone number ID and secret names, and enable the channel, before checking it.");
  }
  const token = accessToken(connection.accessTokenReference);
  if (!token) throw new WorkspaceError("VALIDATION_ERROR", 400, connection.accessTokenReference
    ? `The server has no value for ${connection.accessTokenReference}. Add it to the server environment and restart.`
    : "Enter the name of the access token secret (for example INBOX_WHATSAPP_ACCESS_TOKEN) on this channel first.");
  const phone = await checkPhoneNumber(token, connection.externalAccountReference);
  // Phase 7B.2: with a WhatsApp Business Account ID, the number must belong to it (its templates are listed from it).
  const account = phone.ok && connection.businessAccountReference ? await checkBusinessAccount(token, connection.businessAccountReference, connection.externalAccountReference) : null;
  const result = !phone.ok ? phone : account && !account.ok ? account : phone;
  forgetTemplates(id);
  await asServer("MarkChannelConnectionChecked", dc => sdk.markChannelConnectionChecked(dc, {
    organizationId: context.organizationId, id, expectedRevision: connection.revision, actorUid: context.request.user.uid, verified: result.ok,
    verifiedName: result.ok ? result.verifiedName : null, verifiedDisplayNumber: result.ok ? result.displayNumber : null, errorCode: result.ok ? null : result.code,
  }));
  // Recorded first (the channel is now ERROR, sending off), then explained to the administrator.
  if (!result.ok) throw new WorkspaceError("INBOX_CHECK_FAILED", 409, `Meta did not confirm this number (${result.code}): ${result.message}`);
  return {id, verified: true, verifiedName: phone.ok ? phone.verifiedName : null, displayNumber: phone.ok ? phone.displayNumber : null, templatesAvailable: Boolean(connection.businessAccountReference)};
}

/** Sending on or off for a VERIFIED WhatsApp connection; on only where the server has test recipients (7B.1). */
export async function setConnectionSending(context: Context, rawId: string, body: unknown) {
  requireAdministrator(context);
  const id = parseInput(idSchema, rawId);
  const {expectedRevision, enabled} = parseInput(z.strictObject({expectedRevision: z.number().int().min(1), enabled: z.boolean()}), body);
  const connection = await connectionForCheck(context, id);
  if (enabled && connection.connectionStatus !== "VERIFIED") throw new WorkspaceError("VALIDATION_ERROR", 400, "Check the connection with Meta first. Only a verified channel can send.");
  if (enabled && !liveSendingConfigured()) throw new WorkspaceError("INBOX_SENDING_DISABLED", 409, "Live sending is off on this server. In Phase 7B.1 it needs INBOX_WHATSAPP_TEST_RECIPIENTS (your own test numbers) in the server environment.");
  await asServer("SetChannelConnectionSending", dc => sdk.setChannelConnectionSending(dc, {organizationId: context.organizationId, id, expectedRevision, actorUid: context.request.user.uid, enabled}));
  return {id, sendingEnabled: enabled};
}
