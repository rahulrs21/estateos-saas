import "server-only";

import { randomUUID } from "node:crypto";
import { z } from "zod";
import { getAppOrigin } from "@/modules/auth/server/config";
import { asMember, asServer, isAdministrator, sdk, type Context } from "@/modules/communications/server/data";
import { idSchema, parseInput } from "@/modules/communications/server/validation";
import { WorkspaceError } from "@/modules/organizations/server/errors";
import { canonicalUuid } from "@/modules/organizations/server/identifiers";
import { ADAPTERS, CREDENTIAL_REFERENCE, WEBHOOK_SLUGS, canSend } from "../adapters";
import type { ChannelProvider } from "../model";

/*
 * Channel connections (docs/CHANNEL_ADAPTERS.md#connections). OWNERs and ADMINs
 * only; the database checks the role again. Credentials are never stored or
 * returned: a connection names a server secret (INBOX_...) and the page only
 * shows whether it is set. A connection is never VERIFIED in Phase 7A and real
 * providers never send: both need the live connectors of Phase 7B/7C.
 */

const ADMIN_ONLY = "Only company owners and administrators can manage inbox channels.";
const CONFIGURABLE = ["WHATSAPP_CLOUD", "GMAIL", "MICROSOFT_365"] as const;
export const VERIFY_TOKEN_SUFFIX = "_VERIFY_TOKEN";

/** A secret named by a connection, read on the server only (never returned to a browser). */
export function readInboxSecret(name: string | null | undefined): string | null {
  if (!name || !/^INBOX_[A-Z0-9_]{3,80}$/.test(name)) return null;
  const value = process.env[name]?.trim();
  return value && value.length >= 8 ? value : null;
}

const ACCOUNT_RULES: Record<(typeof CONFIGURABLE)[number], {pattern: RegExp; label: string}> = {
  WHATSAPP_CLOUD: {pattern: /^\d{5,30}$/, label: "WhatsApp phone number ID (digits, from Meta's WhatsApp Manager)"},
  GMAIL: {pattern: /^[^\s@]{1,64}@[^\s@]{1,190}\.[a-z]{2,}$/i, label: "mailbox address"},
  MICROSOFT_365: {pattern: /^[^\s@]{1,64}@[^\s@]{1,190}\.[a-z]{2,}$/i, label: "mailbox address"},
};

const optional = (max: number) => z.string().trim().max(max).nullable().default(null).transform(value => value || null);
const credential = optional(64).refine(value => value === null || CREDENTIAL_REFERENCE.test(value),
  "The secret name must start with INBOX_ and use capital letters, digits and underscores (for example INBOX_WHATSAPP_APP_SECRET). Enter the name of the server secret, never the secret itself.");
const connectionSchema = z.strictObject({
  provider: z.enum(CONFIGURABLE),
  displayName: z.string().trim().min(2).max(80),
  externalAccountReference: optional(200),
  credentialReference: credential,
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
    connections: data.connections.map(row => {
      const provider = row.provider as ChannelProvider;
      const adapter = ADAPTERS[provider];
      const receives = adapter.capabilities.RECEIVE_EVENTS === "SUPPORTED" && provider !== "DEVELOPMENT_SIMULATOR" && provider !== "WEBSITE_FORM" && provider !== "INTERNAL";
      const path = receives ? webhookPath(provider, row.id) : null;
      return {
        id: canonicalUuid(row.id), provider, label: adapter.label, displayName: row.displayName, externalAccountReference: row.externalAccountReference ?? null,
        connectionStatus: row.connectionStatus, credentialReference: row.credentialReference ?? null, revision: row.revision, lastEventAt: row.lastEventAt ?? null,
        createdAt: row.createdAt, createdBy: row.createdBy?.displayName ?? null, capabilities: adapter.capabilities,
        secretAvailable: Boolean(readInboxSecret(row.credentialReference)),
        verifyTokenName: provider === "WHATSAPP_CLOUD" && row.credentialReference ? `${row.credentialReference}${VERIFY_TOKEN_SUFFIX}` : null,
        verifyTokenAvailable: provider === "WHATSAPP_CLOUD" && Boolean(readInboxSecret(row.credentialReference ? `${row.credentialReference}${VERIFY_TOKEN_SUFFIX}` : null)),
        webhookUrl: path ? `${origin}${path}` : null,
        // Never true for a real provider in Phase 7A, whatever the row says.
        canSend: canSend(provider) && row.sendingEnabled,
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
  }, options)).catch(accountTaken);
  return {id};
}

export async function setConnectionEnabled(context: Context, rawId: string, body: unknown) {
  requireAdministrator(context);
  const id = parseInput(idSchema, rawId);
  const {expectedRevision, enabled} = parseInput(z.strictObject({expectedRevision: z.number().int().min(1), enabled: z.boolean()}), body);
  await asMember(context, "SetChannelConnectionEnabled", (dc, options) => sdk.setChannelConnectionEnabled(dc, {organizationId: context.organizationId, id, expectedRevision, enabled}, options));
  return {id, enabled};
}
