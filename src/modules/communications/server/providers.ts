import "server-only";

import { randomUUID } from "node:crypto";
import { z } from "zod";
import { enforceRateLimit } from "@/lib/rate-limit/server";
import { getAppOrigin } from "@/modules/auth/server/config";
import { WorkspaceError } from "@/modules/organizations/server/errors";
import { rulesFrom } from "../compliance";
import { LIVE_CALLING_ATTESTATION } from "../dial-policy";
import { normalizeCallNumber } from "../phone";
import { ADAPTERS, SECRET_REF, webhookPath } from "../providers";
import { PROVIDER_TYPES, type ProviderType } from "../providers/types";
import { asMember, asServer, isAdministrator, sdk, type Context } from "./data";
import { idSchema, parseInput } from "./validation";

/*
 * Provider connections, company lines and the live-calling confirmation
 * (docs/TELEPHONY_PROVIDERS.md). OWNERs and ADMINs only; the database checks
 * the role again. Credentials are never stored or returned: a connection names
 * a server secret (COMMS_...), and the page only shows whether it is set.
 */

const ADMIN_ONLY = "Only company owners and administrators can manage calling providers and lines.";
const VERIFY_RULE = {scope: "communications.provider.verify", limit: 5, windowSeconds: 60};

/** The credential for a connection, read on the server only. */
export function readProviderSecret(secretRef: string | null | undefined): string | null {
  if (!secretRef || !SECRET_REF.test(secretRef)) return null;
  const value = process.env[secretRef]?.trim();
  return value && value.length >= 8 ? value : null;
}

function requireAdministrator(context: Context) {
  if (!isAdministrator(context)) throw new WorkspaceError("PERMISSION_DENIED", 403, ADMIN_ONLY);
}

const optional = (max: number) => z.string().trim().max(max).nullable().default(null).transform(value => value || null);
const connectionSchema = z.strictObject({
  providerType: z.enum(PROVIDER_TYPES),
  displayName: z.string().trim().min(2).max(80),
  secretRef: optional(80).refine(value => value === null || SECRET_REF.test(value), "The secret name must start with COMMS_ and use capital letters, digits and underscores (for example COMMS_TWILIO_AUTH_TOKEN). Enter the name of the server secret, never the secret itself."),
  externalAccountId: optional(80).refine(value => value === null || /^[A-Za-z0-9_-]{2,80}$/.test(value), "The account identifier may contain letters, digits, - and _ only."),
});
const revisionSchema = z.strictObject({expectedRevision: z.number().int().min(1)});
const lineSchema = z.strictObject({
  providerConnectionId: idSchema,
  phoneNumber: z.string().trim().min(5).max(32),
  displayName: optional(80),
  assignedMembershipId: idSchema.nullable().default(null),
  forwardToNumber: optional(32),
  linePurpose: z.enum(["SALES", "SUPPORT", "MARKETING", "VOICE_ASSISTANT"]),
});
const lineUpdateSchema = lineSchema.omit({providerConnectionId: true, phoneNumber: true}).extend({expectedRevision: z.number().int().min(1)});

function validateAccount(type: ProviderType, externalAccountId: string | null) {
  const pattern = ADAPTERS[type].accountIdPattern;
  if (externalAccountId && pattern && !pattern.test(externalAccountId)) throw new WorkspaceError("VALIDATION_ERROR", 400, `Enter a valid ${ADAPTERS[type].accountIdLabel}.`);
}

function e164(value: string | null, label: string) {
  if (value === null) return null;
  const normalized = normalizeCallNumber(value);
  if (!normalized) throw new WorkspaceError("VALIDATION_ERROR", 400, `Enter the ${label} with its country code, for example +971 4 123 4567.`);
  return normalized;
}

export async function providerSettings(context: Context) {
  requireAdministrator(context);
  const [data, settings] = await Promise.all([
    asMember(context, "ListCommunicationProviders", (dc, options) => sdk.listCommunicationProviders(dc, {organizationId: context.organizationId}, options)),
    asMember(context, "GetCommunicationSettings", (dc, options) => sdk.getCommunicationSettings(dc, {organizationId: context.organizationId}, options)),
  ]);
  const origin = getAppOrigin();
  const rules = rulesFrom(settings.settings);
  return {
    providers: PROVIDER_TYPES.map(type => ({type, label: ADAPTERS[type].label, capabilities: ADAPTERS[type].capabilities, accountIdLabel: ADAPTERS[type].accountIdLabel})),
    connections: data.connections.map(connection => {
      const type = connection.providerType as ProviderType;
      return {
        ...connection, providerType: type, label: ADAPTERS[type].label, capabilities: ADAPTERS[type].capabilities,
        secretAvailable: Boolean(readProviderSecret(connection.secretRef)),
        webhookUrl: ADAPTERS[type].capabilities.verifiedWebhooks ? `${origin}${webhookPath(type, connection.id)}` : null,
      };
    }),
    lines: data.lines,
    members: data.members,
    attestation: {
      statement: LIVE_CALLING_ATTESTATION.text, version: LIVE_CALLING_ATTESTATION.version,
      attestedAt: rules.liveCallingAttestedAt, attestedVersion: rules.liveCallingAttestationVersion,
      attestedBy: settings.settings?.liveCallingAttestedBy?.displayName ?? null,
      current: Boolean(rules.liveCallingAttestedAt) && rules.liveCallingAttestationVersion === LIVE_CALLING_ATTESTATION.version,
      settingsSaved: Boolean(settings.settings),
    },
    publicOrigin: origin,
  };
}

export async function createProvider(context: Context, body: unknown) {
  requireAdministrator(context);
  const input = parseInput(connectionSchema, body);
  validateAccount(input.providerType, input.externalAccountId);
  const id = randomUUID();
  await asMember(context, "CreateCommunicationProvider", (dc, options) => sdk.createCommunicationProvider(dc, {
    organizationId: context.organizationId, id, providerType: sdk.CommunicationProviderType[input.providerType], displayName: input.displayName,
    secretRef: input.secretRef, externalAccountId: input.externalAccountId,
  }, options));
  return {id};
}

export async function updateProvider(context: Context, rawId: string, body: unknown) {
  requireAdministrator(context);
  const id = parseInput(idSchema, rawId);
  const {expectedRevision, ...rest} = parseInput(connectionSchema.omit({providerType: true}).extend({expectedRevision: z.number().int().min(1), providerType: z.enum(PROVIDER_TYPES)}), body);
  validateAccount(rest.providerType, rest.externalAccountId);
  await asMember(context, "UpdateCommunicationProvider", (dc, options) => sdk.updateCommunicationProvider(dc, {
    organizationId: context.organizationId, id, expectedRevision, displayName: rest.displayName, secretRef: rest.secretRef, externalAccountId: rest.externalAccountId,
  }, options));
  return {id};
}

export async function setProviderEnabled(context: Context, rawId: string, body: unknown) {
  requireAdministrator(context);
  const id = parseInput(idSchema, rawId);
  const {expectedRevision, enabled} = parseInput(z.strictObject({expectedRevision: z.number().int().min(1), enabled: z.boolean()}), body);
  await asMember(context, "SetCommunicationProviderEnabled", (dc, options) => sdk.setCommunicationProviderEnabled(dc, {organizationId: context.organizationId, id, expectedRevision, enabled}, options));
  return {id, enabled};
}

/**
 * Checks the credentials with the provider (one external request, started by
 * an OWNER or ADMIN). Only the server can record the result. Provider error
 * details are not shown or stored.
 */
export async function verifyProvider(context: Context, rawId: string, body: unknown) {
  requireAdministrator(context);
  const id = parseInput(idSchema, rawId);
  const {expectedRevision} = parseInput(revisionSchema, body);
  await enforceRateLimit([{rule: VERIFY_RULE, subject: context.organizationId}], "Wait a minute before checking the connection again.");
  const {connections} = await asMember(context, "ListCommunicationProviders", (dc, options) => sdk.listCommunicationProviders(dc, {organizationId: context.organizationId}, options));
  const connection = connections.find(row => idSchema.parse(row.id) === id);
  if (!connection) throw new WorkspaceError("NOT_FOUND", 404, "This connection was not found in your company.");
  if (connection.revision !== expectedRevision) throw new WorkspaceError("CONFLICT", 409, "This connection was changed by a colleague. Reload and try again.");
  if (connection.connectionStatus === "DISABLED" || connection.connectionStatus === "NOT_CONFIGURED") throw new WorkspaceError("VALIDATION_ERROR", 400, "Complete and enable the connection before checking it.");
  const adapter = ADAPTERS[connection.providerType as ProviderType];
  const secret = readProviderSecret(connection.secretRef);
  if (!secret) throw new WorkspaceError("VALIDATION_ERROR", 400, `The server secret ${connection.secretRef ?? ""} is not set. Add it to the server environment (Secret Manager when hosted), restart, then check again.`);
  let result: {ok: boolean; note: string};
  try {
    result = await adapter.verifyCredentials({externalAccountId: connection.externalAccountId ?? null}, secret);
  } catch {
    result = {ok: false, note: "The provider rejected the credentials or could not be reached."};
  }
  await asServer("RecordCommunicationProviderVerification", dc => sdk.recordCommunicationProviderVerification(dc, {
    organizationId: context.organizationId, id, expectedRevision, actorUid: context.request.user.uid, verified: result.ok, note: result.note.slice(0, 300),
  }));
  return {id, verified: result.ok, note: result.note};
}

export async function attestLiveCalling(context: Context, body: unknown) {
  requireAdministrator(context);
  const {confirm, version} = parseInput(z.strictObject({confirm: z.literal(true), version: z.string()}), body);
  if (!confirm || version !== LIVE_CALLING_ATTESTATION.version) throw new WorkspaceError("CONFLICT", 409, "The confirmation statement has changed. Reload and read it again.");
  await asMember(context, "AttestLiveCalling", (dc, options) => sdk.attestLiveCalling(dc, {organizationId: context.organizationId, version}, options));
  return {version};
}

export async function revokeLiveCalling(context: Context) {
  requireAdministrator(context);
  await asMember(context, "RevokeLiveCallingAttestation", (dc, options) => sdk.revokeLiveCallingAttestation(dc, {organizationId: context.organizationId}, options));
  return {revoked: true};
}

export async function createLine(context: Context, body: unknown) {
  requireAdministrator(context);
  const input = parseInput(lineSchema, body);
  const id = randomUUID();
  const phoneNumber = e164(input.phoneNumber, "company number")!;
  await asMember(context, "CreateCommunicationPhoneLine", (dc, options) => sdk.createCommunicationPhoneLine(dc, {
    organizationId: context.organizationId, id, providerConnectionId: input.providerConnectionId, phoneNumber, displayName: input.displayName,
    hasAssignee: Boolean(input.assignedMembershipId), assignedMembershipId: input.assignedMembershipId, forwardToNumber: e164(input.forwardToNumber, "agent's phone number"),
    linePurpose: sdk.PhoneLinePurpose[input.linePurpose],
  }, options));
  return {id, phoneNumber};
}

export async function updateLine(context: Context, rawId: string, body: unknown) {
  requireAdministrator(context);
  const id = parseInput(idSchema, rawId);
  const input = parseInput(lineUpdateSchema, body);
  await asMember(context, "UpdateCommunicationPhoneLine", (dc, options) => sdk.updateCommunicationPhoneLine(dc, {
    organizationId: context.organizationId, id, expectedRevision: input.expectedRevision, displayName: input.displayName, hasAssignee: Boolean(input.assignedMembershipId),
    assignedMembershipId: input.assignedMembershipId, forwardToNumber: e164(input.forwardToNumber, "agent's phone number"), linePurpose: sdk.PhoneLinePurpose[input.linePurpose],
  }, options));
  return {id};
}

export async function confirmLineRegistration(context: Context, rawId: string, body: unknown) {
  requireAdministrator(context);
  const id = parseInput(idSchema, rawId);
  const {expectedRevision} = parseInput(revisionSchema, body);
  await asMember(context, "ConfirmPhoneLineRegistration", (dc, options) => sdk.confirmPhoneLineRegistration(dc, {organizationId: context.organizationId, id, expectedRevision}, options));
  return {id};
}

export async function setLineActive(context: Context, rawId: string, body: unknown) {
  requireAdministrator(context);
  const id = parseInput(idSchema, rawId);
  const {expectedRevision, active} = parseInput(z.strictObject({expectedRevision: z.number().int().min(1), active: z.boolean()}), body);
  await asMember(context, "SetPhoneLineActive", (dc, options) => sdk.setPhoneLineActive(dc, {organizationId: context.organizationId, id, expectedRevision, active}, options));
  return {id, active};
}
