import "server-only";

import { randomUUID } from "node:crypto";
import { WorkspaceError } from "@/modules/organizations/server/errors";
import { rulesFrom } from "../compliance";
import { normalizeCallNumber } from "../phone";
import { asMember, isAdministrator, isDuplicate, sdk, type Context } from "./data";
import { idSchema, parseInput, settingsSchema, suppressionSchema, withdrawSchema } from "./validation";

/*
 * Communication settings and the do-not-call list (docs/CALL_PRIVACY_COMPLIANCE.md#settings).
 * Every member can read the rules that apply to their calls; only OWNERs and
 * ADMINs change them, and the database enforces the legal bounds again.
 */

const ADMIN_ONLY = "Only company owners and administrators can change communication settings.";

export async function getCommunicationSettings(context: Context) {
  const {settings} = await asMember(context, "GetCommunicationSettings", (dc, options) => sdk.getCommunicationSettings(dc, {organizationId: context.organizationId}, options));
  return {
    rules: rulesFrom(settings),
    revision: settings?.revision ?? 0,
    recordingNoticeText: settings?.recordingNoticeText ?? null,
    recordingLegalBasis: settings?.recordingLegalBasis ?? null,
    liveCallingAttestedBy: settings?.liveCallingAttestedBy?.displayName ?? null,
    updatedAt: settings?.updatedAt ?? null,
    updatedBy: settings?.updatedBy?.displayName ?? null,
    canManage: isAdministrator(context),
  };
}

export async function saveCommunicationSettings(context: Context, body: unknown) {
  if (!isAdministrator(context)) throw new WorkspaceError("PERMISSION_DENIED", 403, ADMIN_ONLY);
  const {expectedRevision, ...values} = parseInput(settingsSchema, body);
  const variables = {organizationId: context.organizationId, ...values};
  if (expectedRevision === 0) {
    try {
      await sdk.createCommunicationSettings(context.request.dc, variables, context.request.options);
    } catch (error) {
      if (isDuplicate(error)) throw new WorkspaceError("CONFLICT", 409, "A colleague saved these settings first. Reload and try again.");
      throw error;
    }
  } else {
    await asMember(context, "UpdateCommunicationSettings", (dc, options) => sdk.updateCommunicationSettings(dc, {...variables, expectedRevision}, options));
  }
  return getCommunicationSettings(context);
}

export async function listSuppressions(context: Context) {
  if (!isAdministrator(context)) throw new WorkspaceError("PERMISSION_DENIED", 403, "Only company owners and administrators can view the do-not-call list.");
  const data = await asMember(context, "ListCommunicationSuppressions", (dc, options) => sdk.listCommunicationSuppressions(dc, {organizationId: context.organizationId, limit: 200, offset: 0}, options));
  return {active: data.active, withdrawn: data.withdrawn};
}

export async function addSuppression(context: Context, body: unknown) {
  if (!isAdministrator(context)) throw new WorkspaceError("PERMISSION_DENIED", 403, ADMIN_ONLY);
  const input = parseInput(suppressionSchema, body);
  const normalizedNumber = normalizeCallNumber(input.number);
  if (!normalizedNumber) throw new WorkspaceError("VALIDATION_ERROR", 400, "Enter the number with its country code, for example +971 50 123 4567.");
  const id = randomUUID();
  await asMember(context, "AddCommunicationSuppression", (dc, options) => sdk.addCommunicationSuppression(dc, {
    organizationId: context.organizationId, id, normalizedNumber, scope: sdk.CommunicationSuppressionScope[input.scope], reason: sdk.CommunicationSuppressionReason[input.reason], note: input.note,
  }, options));
  return {id, normalizedNumber};
}

export async function withdrawSuppression(context: Context, rawId: string, body: unknown) {
  if (!isAdministrator(context)) throw new WorkspaceError("PERMISSION_DENIED", 403, ADMIN_ONLY);
  const id = parseInput(idSchema, rawId);
  const {reason} = parseInput(withdrawSchema, body);
  await asMember(context, "WithdrawCommunicationSuppression", (dc, options) => sdk.withdrawCommunicationSuppression(dc, {organizationId: context.organizationId, id, reason}, options));
  return {id, withdrawn: true};
}
