import "server-only";

import { z } from "zod";
import { stableUuid } from "@/modules/automations/ids";
import { getAppOrigin } from "@/modules/auth/server/config";
import { WorkspaceError } from "@/modules/organizations/server/errors";
import { evaluateCall, localMoment, rulesFrom, type CommunicationRules } from "../compliance";
import { LIVE_CALLING_ATTESTATION, describeDialRefusal, liveCallBlockers, type DialFacts } from "../dial-policy";
import { numbersOnRecord } from "../phone";
import { ADAPTERS, webhookPath } from "../providers";
import type { ProviderType } from "../providers/types";
import { asMember, asServer, sdk, serverDataConnect, type Context } from "./data";
import { readProviderSecret } from "./providers";
import { idSchema, parseInput } from "./validation";

/*
 * Live calls through a verified provider (docs/TELEPHONY_PROVIDERS.md#live-calling).
 * Off until every condition holds: a VERIFIED connection that can dial, its
 * secret on the server, a public HTTPS origin for status events, an OWNER or
 * ADMIN's current attestation, the agent's ACTIVE registered line with a
 * forwarding number, capacity, and no calling-rule issue for the number. The
 * database repeats the provider, line and attestation checks (StartLeadCall).
 */

const ACTIVE_WINDOW_MS = 4 * 60 * 60 * 1000;
const FACT_WINDOW_MS = 8 * 24 * 60 * 60 * 1000;

/** Midnight in the company timezone, as an instant (for the per-agent daily limit). */
function startOfLocalDay(now: Date, timeZone: string) {
  const {time} = localMoment(now, timeZone);
  const [hours, minutes] = time.split(":").map(Number);
  return new Date(Math.floor((now.getTime() - (hours * 60 + minutes) * 60_000) / 60_000) * 60_000);
}

async function liveCallFacts(context: Context, rules: CommunicationRules) {
  const now = new Date();
  const data = await asServer("DialFacts", dc => sdk.dialFacts(dc, {organizationId: context.organizationId, agentMembershipId: context.membership.id,
    activeSince: new Date(now.getTime() - ACTIVE_WINDOW_MS).toISOString(), daySince: startOfLocalDay(now, rules.timeZone).toISOString()}));
  const line = data.lines.find(item => item.status === "ACTIVE") ?? data.lines[0] ?? null;
  const connection = line?.providerConnection ?? null;
  const type = connection?.providerType as ProviderType | undefined;
  const secretRef = connection?.secretRef ?? null;
  const facts: DialFacts = {
    connection: connection && type ? {connectionStatus: connection.connectionStatus, capabilities: ADAPTERS[type].capabilities} : null,
    secretAvailable: Boolean(readProviderSecret(secretRef)),
    publicOrigin: getAppOrigin(),
    rules,
    line: line ? {status: line.status, registrationConfirmedAt: line.registrationConfirmedAt ?? null, forwardToNumber: line.forwardToNumber ?? null} : null,
    activeCompanyCalls: data.activeCompany[0]?.count ?? 0,
    agentHasActiveCall: (data.activeAgent[0]?.count ?? 0) > 0,
    agentCallsToday: data.agentToday[0]?.count ?? 0,
  };
  return {facts, line, connection, type, secret: readProviderSecret(secretRef)};
}

/** Whether the member could place a live call now (shown on the call panel). */
export async function liveCallingStatus(context: Context, rules: CommunicationRules) {
  const {facts} = await liveCallFacts(context, rules);
  const blockers = liveCallBlockers(facts);
  const reasons = describeDialRefusal(blockers, []);
  return {available: blockers.length === 0, reason: reasons[0]?.message ?? null, reasons};
}

const dialSchema = z.strictObject({
  requestId: idSchema,
  leadId: idSchema,
  number: z.enum(["PRIMARY", "ALTERNATE"]).default("PRIMARY"),
  callType: z.enum(["SERVICE", "FOLLOW_UP", "MARKETING"]),
});

/** Starts an agent's live call on a lead, or refuses with every reason. */
export async function startLiveCall(context: Context, body: unknown) {
  const input = parseInput(dialSchema, body);
  const {organizationId} = context;
  const lead = await asMember(context, "ListLeadCalls", (dc, options) => sdk.listLeadCalls(dc, {organizationId, leadId: input.leadId, limit: 1, offset: 0}, options));
  if (!lead.lead || lead.lead.archivedAt) throw new WorkspaceError("NOT_FOUND", 404, "This lead was not found.");
  const numbers = lead.lead.contact ? numbersOnRecord(lead.lead.contact) : [];
  const number = (input.number === "ALTERNATE" ? numbers[1] : numbers[0]) ?? null;
  const now = new Date();
  const compliance = await asServer("CallComplianceFacts", dc => sdk.callComplianceFacts(dc, {organizationId, number: number ?? "", since: new Date(now.getTime() - FACT_WINDOW_MS).toISOString()}));
  const rules = rulesFrom(compliance.settings);
  const {facts, line, connection, type, secret} = await liveCallFacts(context, rules);
  const blockers = liveCallBlockers(facts);
  const issues = evaluateCall({direction: "OUTBOUND", callType: input.callType, at: now, number, rules,
    suppressions: compliance.suppressions.map(item => ({scope: item.scope as "ALL" | "MARKETING", reason: item.reason as "OPT_OUT", createdAt: item.createdAt})),
    priorCalls: compliance.calls.map(call => ({id: call.id, startedAt: call.startedAt, direction: call.direction as "OUTBOUND", callType: call.callType as "SERVICE", callStatus: call.callStatus as "COMPLETED", answeredAt: call.answeredAt ?? null}))});
  if (blockers.length || issues.length || !line || !connection || !type || !secret || !number) {
    return {started: false as const, reasons: describeDialRefusal(blockers, issues)};
  }
  const forwardTo = line.forwardToNumber!;
  const id = stableUuid("live-call", organizationId, context.request.user.uid, input.requestId);
  await asMember(context, "StartLeadCall", (dc, options) => sdk.startLeadCall(dc, {organizationId, id, leadId: input.leadId, phoneLineId: line.id,
    callType: sdk.CallType[input.callType], counterpartyNumber: number, attestationVersion: LIVE_CALLING_ATTESTATION.version}, options));
  const dc = serverDataConnect();
  try {
    const {providerCallId} = await ADAPTERS[type].initiateCall({externalAccountId: connection.externalAccountId ?? null}, secret, {
      from: line.phoneNumber, agentNumber: forwardTo, customerNumber: number, statusCallbackUrl: `${getAppOrigin()}${webhookPath(type, connection.id)}`,
    });
    await sdk.setProviderCallId(dc, {organizationId, id, providerCallId});
    return {started: true as const, callId: id};
  } catch {
    await sdk.applyProviderCallStatus(dc, {organizationId, id, expectedStatus: sdk.CallStatus.INITIATED, callStatus: sdk.CallStatus.FAILED, answeredAt: null, endedAt: now.toISOString(), durationSeconds: 0}).catch(() => undefined);
    return {started: false as const, callId: id, reasons: [{code: "PROVIDER_REJECTED", message: "The provider could not start the call. Nothing was dialled; try again or log the call manually."}]};
  }
}

/** Hangs up the member's own live call (or any, for an OWNER or ADMIN) where the provider supports it. */
export async function endLiveCall(context: Context, rawId: string) {
  const id = parseInput(idSchema, rawId);
  const {call} = await asMember(context, "GetCallRecord", (dc, options) => sdk.getCallRecord(dc, {organizationId: context.organizationId, id}, options));
  const isAdmin = context.membership.role === "OWNER" || context.membership.role === "ADMIN";
  if (!call || (!isAdmin && call.agentMembershipId !== context.membership.id)) throw new WorkspaceError("NOT_FOUND", 404, "This call was not found.");
  const control = (await asServer("ProviderCallForControl", dc => sdk.providerCallForControl(dc, {organizationId: context.organizationId, id}))).call;
  const type = control?.providerConnection?.providerType as ProviderType | undefined;
  if (!control || !type || !control.providerCallId || ["COMPLETED", "FAILED", "BUSY", "NO_ANSWER", "CANCELLED"].includes(control.callStatus)) {
    throw new WorkspaceError("CONFLICT", 409, "This call is not in progress through a provider.");
  }
  if (!ADAPTERS[type].capabilities.endCall) throw new WorkspaceError("CONFLICT", 409, "This provider does not support hanging up from EstateOS.");
  const secret = readProviderSecret(control.providerConnection?.secretRef);
  if (!secret) throw new WorkspaceError("CONFLICT", 409, "The provider credential is not available on the server.");
  try { await ADAPTERS[type].endCall({externalAccountId: control.providerConnection?.externalAccountId ?? null}, secret, control.providerCallId); }
  catch { throw new WorkspaceError("CONFLICT", 409, "The provider could not end the call. End it on the phone."); }
  // The provider's signed status event records the end of the call.
  return {id, requested: true};
}