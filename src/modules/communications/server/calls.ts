import "server-only";

import { stableUuid } from "@/modules/automations/ids";
import { mapWorkspaceDataError, WorkspaceError } from "@/modules/organizations/server/errors";
import { finalCallTrigger, isAnswered, isConversation } from "../call-state";
import { COMPLIANCE_MESSAGES, evaluateCall, rulesFrom, type CommunicationRules, type ComplianceIssue, type PriorCall, type SuppressionFact } from "../compliance";
import { suppresses, type CallDirection, type CallOutcome, type CallSource, type CallStatus, type CallType } from "../model";
import { displayNumber, numbersOnRecord } from "../phone";
import { asMember, asServer, isAdministrator, isDuplicate, sdk, type Context } from "./data";
import { liveCallingStatus } from "./dial";
import { callListSchema, idSchema, logCallSchema, parseInput, updateCallSchema } from "./validation";

/*
 * Call records (docs/COMMUNICATION_HUB.md#calls). Agents log calls they made
 * or took through the company's approved phone service. The database checks
 * that the member may work on the lead or contact, that the number is the one
 * on record, and adds a suppression when the customer asked not to be called.
 * Compliance rules are evaluated on the server with the company's own records
 * (calls by every agent count) and returned as warnings for a manual log.
 */

const PAGE_SIZE = 20;
/** Enough history for the weekly marketing limit. */
const FACT_WINDOW_MS = 8 * 24 * 60 * 60 * 1000;

const text = <T extends string>(value: string) => value as T;

interface ComplianceFacts {rules: CommunicationRules; suppressions: SuppressionFact[]; priorCalls: PriorCall[]}

/** The company's rules, active suppressions and recent calls for one number (server-only read; the company comes from the session). */
async function complianceFacts(context: Context, number: string | null, at: Date): Promise<ComplianceFacts> {
  const data = await asServer("CallComplianceFacts", dc => sdk.callComplianceFacts(dc, {organizationId: context.organizationId, number: number ?? "", since: new Date(at.getTime() - FACT_WINDOW_MS).toISOString()}));
  return {
    rules: rulesFrom(data.settings),
    suppressions: data.suppressions.map(item => ({scope: text(item.scope), reason: text(item.reason), createdAt: item.createdAt})),
    priorCalls: data.calls.map(call => ({id: call.id, startedAt: call.startedAt, direction: text(call.direction), callType: text(call.callType), callStatus: text(call.callStatus), answeredAt: call.answeredAt ?? null})),
  };
}

const describeIssues = (issues: ComplianceIssue[]) => issues.map(code => ({code, message: COMPLIANCE_MESSAGES[code]}));

function rulesSummary(rules: CommunicationRules) {
  return {
    timeZone: rules.timeZone,
    callingHours: `${rules.callingWindowStart}-${rules.callingWindowEnd}`,
    telemarketingEnabled: rules.telemarketingEnabled && Boolean(rules.telemarketingApprovalReference),
    marketingHours: `${rules.marketingWindowStart}-${rules.marketingWindowEnd}`,
    recordingEnabled: rules.recordingEnabled,
  };
}

interface StoredCall {
  id: string; direction: string; source: string; callType: string; callStatus: string; outcome?: string | null; counterpartyNumber?: string | null;
  startedAt: string; answeredAt?: string | null; durationSeconds: number; notes?: string | null; followUpRequired: boolean; revision: number; agentMembershipId: string;
  agentMembership: {id: string; email: string; userProfile?: {displayName: string} | null};
  followUp?: {id: string; title: string; dueAt: string; status: string} | null;
  viewing?: {id: string; scheduledAt: string; status: string} | null;
  lead?: {id: string; fullName: string} | null;
  contact?: {id: string; fullName: string} | null;
}

export function presentCall(context: Context, call: StoredCall) {
  const facts = {direction: text<CallDirection>(call.direction), callStatus: text<CallStatus>(call.callStatus), answeredAt: call.answeredAt ?? null, outcome: call.outcome ? text<CallOutcome>(call.outcome) : null};
  return {
    id: call.id, direction: facts.direction, source: text<CallSource>(call.source), callType: text<CallType>(call.callType), callStatus: facts.callStatus, outcome: facts.outcome,
    number: displayNumber(call.counterpartyNumber), startedAt: call.startedAt, answeredAt: facts.answeredAt, durationSeconds: call.durationSeconds,
    notes: call.notes ?? null, followUpRequired: call.followUpRequired, followUp: call.followUp ?? null, viewing: call.viewing ?? null, lead: call.lead ?? null, contact: call.contact ?? null,
    agent: call.agentMembership.userProfile?.displayName || call.agentMembership.email, revision: call.revision,
    answered: isAnswered(facts), conversation: isConversation(facts),
    canEdit: isAdministrator(context) || call.agentMembershipId === context.membership.id,
  };
}
export type CallView = ReturnType<typeof presentCall>;

/** Each number on record with whether it may be called (shown before an agent calls). */
async function numberViews(context: Context, numbers: string[]) {
  const now = new Date();
  return Promise.all(numbers.map(async (number, index) => {
    const facts = await complianceFacts(context, number, now);
    return {
      choice: index === 0 ? "PRIMARY" as const : "ALTERNATE" as const, number: displayNumber(number),
      doNotCall: facts.suppressions.some(item => item.scope === "ALL"),
      noMarketing: facts.suppressions.some(item => item.scope === "MARKETING"),
    };
  }));
}

export async function leadCallsView(context: Context, rawLeadId: string, query: unknown) {
  const leadId = parseInput(idSchema, rawLeadId);
  const {offset} = parseInput(callListSchema, query);
  const data = await asMember(context, "ListLeadCalls", (dc, options) => sdk.listLeadCalls(dc, {organizationId: context.organizationId, leadId, limit: PAGE_SIZE, offset}, options));
  if (!data.lead) throw new WorkspaceError("NOT_FOUND", 404, "This lead was not found.");
  const numbers = data.lead.contact ? numbersOnRecord(data.lead.contact) : numbersOnRecord({phone: data.lead.phone});
  const settings = await complianceFacts(context, null, new Date());
  const total = data.total[0]?.count ?? 0;
  return {
    subject: {kind: "LEAD" as const, id: data.lead.id, name: data.lead.contact?.fullName ?? data.lead.fullName, archived: Boolean(data.lead.archivedAt)},
    numbers: await numberViews(context, numbers),
    calls: data.calls.map(call => presentCall(context, call)),
    lastAnsweredAt: data.lastAnswered[0]?.startedAt ?? null,
    total, offset, hasMore: offset + PAGE_SIZE < total,
    viewings: data.viewings,
    rules: rulesSummary(settings.rules),
    liveCalling: await liveCallingStatus(context, settings.rules),
  };
}

export async function contactCallsView(context: Context, rawContactId: string, query: unknown) {
  const contactId = parseInput(idSchema, rawContactId);
  const {offset} = parseInput(callListSchema, query);
  const data = await asMember(context, "ListContactCalls", (dc, options) => sdk.listContactCalls(dc, {organizationId: context.organizationId, contactId, limit: PAGE_SIZE, offset}, options));
  if (!data.contact) throw new WorkspaceError("NOT_FOUND", 404, "This contact was not found.");
  const settings = await complianceFacts(context, null, new Date());
  const total = data.total[0]?.count ?? 0;
  const calls = data.calls.map(call => presentCall(context, call));
  return {
    subject: {kind: "CONTACT" as const, id: data.contact.id, name: data.contact.fullName, archived: false},
    numbers: await numberViews(context, numbersOnRecord(data.contact)),
    calls,
    lastAnsweredAt: calls.find(call => call.answered)?.startedAt ?? null,
    total, offset, hasMore: offset + PAGE_SIZE < total,
    viewings: [] as Array<{id: string; scheduledAt: string; status: string}>,
    rules: rulesSummary(settings.rules),
    liveCalling: {available: false, reason: "Live calls start from one of the customer's leads, so the call is recorded against it.", reasons: [] as Array<{code: string; message: string}>},
  };
}
export type CallHistoryView = Awaited<ReturnType<typeof leadCallsView>>;

export async function getCall(context: Context, rawId: string) {
  const id = parseInput(idSchema, rawId);
  const data = await asMember(context, "GetCallRecord", (dc, options) => sdk.getCallRecord(dc, {organizationId: context.organizationId, id}, options));
  const call = data.call;
  if (!call) throw new WorkspaceError("NOT_FOUND", 404, "This call was not found.");
  const at = new Date(call.startedAt);
  const number = call.counterpartyNumber ?? null;
  const facts = await complianceFacts(context, number, at);
  const issues = evaluateCall({direction: text<CallDirection>(call.direction), callType: text<CallType>(call.callType), at, number, callId: call.id, ...facts});
  return {
    ...presentCall(context, call), leadId: call.leadId ?? null, contactId: call.contactId ?? null, callerNumber: displayNumber(call.callerNumber), recipientNumber: displayNumber(call.recipientNumber),
    endedAt: call.endedAt ?? null, provider: call.providerConnection ? {type: call.providerConnection.providerType, name: call.providerConnection.displayName} : null,
    line: call.phoneLine ? {number: displayNumber(call.phoneLine.phoneNumber), name: call.phoneLine.displayName ?? null} : null,
    events: data.events, issues: describeIssues(issues),
  };
}

/**
 * Logs a call that already happened. The same form submission (requestId)
 * always maps to the same call, so a retried request cannot log it twice.
 */
export async function logCall(context: Context, body: unknown) {
  const input = parseInput(logCallSchema, body);
  const {organizationId} = context;
  const id = stableUuid("manual-call", organizationId, context.request.user.uid, input.requestId);

  // The customer's numbers on record, read as the member (the database checks access).
  let numbers: string[];
  if (input.leadId) {
    const leadId = input.leadId;
    const data = await asMember(context, "ListLeadCalls", (dc, options) => sdk.listLeadCalls(dc, {organizationId, leadId, limit: 1, offset: 0}, options));
    if (!data.lead) throw new WorkspaceError("NOT_FOUND", 404, "This lead was not found.");
    if (data.lead.archivedAt) throw new WorkspaceError("VALIDATION_ERROR", 400, "Calls cannot be logged on an archived lead.");
    numbers = data.lead.contact ? numbersOnRecord(data.lead.contact) : numbersOnRecord({phone: data.lead.phone});
  } else {
    const contactId = input.contactId!;
    const data = await asMember(context, "ListContactCalls", (dc, options) => sdk.listContactCalls(dc, {organizationId, contactId, limit: 1, offset: 0}, options));
    if (!data.contact) throw new WorkspaceError("NOT_FOUND", 404, "This contact was not found.");
    numbers = numbersOnRecord(data.contact);
  }
  if (input.number === "ALTERNATE" && !numbers[1]) throw new WorkspaceError("VALIDATION_ERROR", 400, "There is no alternate number on record.");
  const number = (input.number === "ALTERNATE" ? numbers[1] : numbers[0]) ?? null;

  const at = new Date(input.startedAt);
  const facts = await complianceFacts(context, number, at);
  const issues = evaluateCall({direction: input.direction, callType: input.callType, at, number, ...facts});
  const suppress = suppresses(input.outcome) && Boolean(number);
  const common = {
    organizationId, id, direction: sdk.CallDirection[input.direction], callType: sdk.CallType[input.callType], callStatus: sdk.CallStatus[input.callStatus],
    outcome: input.outcome ? sdk.CallOutcome[input.outcome] : null, startedAt: at.toISOString(), durationSeconds: input.callStatus === "COMPLETED" ? input.durationSeconds : 0,
    notes: input.notes, counterpartyNumber: number, followUpRequired: input.followUpRequired || Boolean(input.followUpAt), suppress, suppressionId: stableUuid("call-suppression", id),
    emitEvent: finalCallTrigger(input.direction, input.callStatus) !== null,
  };
  let duplicate = false;
  try {
    if (input.leadId) await sdk.logLeadCall(context.request.dc, {...common, leadId: input.leadId, hasViewing: Boolean(input.viewingId), viewingId: input.viewingId}, context.request.options);
    else await sdk.logContactCall(context.request.dc, {...common, contactId: input.contactId!}, context.request.options);
  } catch (error) {
    if (!isDuplicate(error)) throw mapWorkspaceDataError(error);
    duplicate = true;
  }

  // The follow-up goes through the existing lead operation (as the member), then is linked to the call.
  const followUp = {scheduled: false, error: null as string | null};
  if (!duplicate && input.followUpAt && input.leadId) {
    const leadId = input.leadId, followUpAt = input.followUpAt;
    try {
      const scheduled = await asMember(context, "ScheduleLeadFollowUp", (dc, options) => sdk.scheduleLeadFollowUp(dc, {
        organizationId, leadId, followUpAt: new Date(followUpAt).toISOString(), followUpNote: null, title: input.followUpTitle ?? "Follow up after call", replaceExisting: false,
      }, options));
      await asMember(context, "LinkCallFollowUp", (dc, options) => sdk.linkCallFollowUp(dc, {organizationId, id, followUpId: scheduled.followUp.id}, options));
      followUp.scheduled = true;
    } catch (error) {
      followUp.error = error instanceof WorkspaceError ? error.message : "The follow-up could not be scheduled.";
    }
  }
  return {call: await getCall(context, id), duplicate, issues: describeIssues(issues), followUp};
}

/** Outcome, notes and the follow-up flag; a new do-not-call outcome also adds the suppression (in the database transaction). */
export async function updateCall(context: Context, rawId: string, body: unknown) {
  const id = parseInput(idSchema, rawId);
  const input = parseInput(updateCallSchema, body);
  const current = await getCall(context, id);
  if (!current.canEdit) throw new WorkspaceError("PERMISSION_DENIED", 403, "Only the agent who handled this call, or an owner or administrator, can change it.");
  if (input.outcome && current.callStatus !== "COMPLETED") throw new WorkspaceError("VALIDATION_ERROR", 400, "Record an outcome only for a call the customer answered.");
  const suppress = suppresses(input.outcome) && input.outcome !== current.outcome && Boolean(current.number);
  await asMember(context, "UpdateCallRecord", (dc, options) => sdk.updateCallRecord(dc, {
    organizationId: context.organizationId, id, expectedRevision: input.expectedRevision, outcome: input.outcome ? sdk.CallOutcome[input.outcome] : null,
    notes: input.notes, followUpRequired: input.followUpRequired, suppress, suppressionId: stableUuid("call-suppression", id, input.outcome ?? "", input.expectedRevision),
  }, options));
  return getCall(context, id);
}
