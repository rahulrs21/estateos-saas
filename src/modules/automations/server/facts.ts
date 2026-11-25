import "server-only";

import { canonicalUuid } from "@/modules/organizations/server/identifiers";
import type { Facts } from "../conditions";
import { raw, sdk, type Context } from "./data";

/*
 * Facts for conditions, read fresh from the database (as the executor) each
 * time a step runs, so a delayed step sees the current state: for example an
 * escalation is skipped when the agent has contacted the lead meanwhile.
 */

export interface AutomationEventRow {
  id: string; triggerType: string; targetType: string; targetId?: string | null; origin: string; chainDepth: number; createdAt: string;
  originalEventId?: string | null; parentExecutionId?: string | null; originWorkflowId?: string | null; payload?: unknown; actorUid?: string | null;
}

/** The records a run acts on. */
export interface RunTarget {
  leadId: string | null;
  listingId: string | null;
  viewingId: string | null;
  contactId: string | null;
  followUpId: string | null;
  workTaskId: string | null;
  callId: string | null;
  meetingId: string | null;
  conversationId: string | null;
}

export interface RunState {
  facts: Facts;
  target: RunTarget;
  lead: {id: string; fullName: string; status: string; assignedMembershipId: string | null; branchId: string | null; projectId: string | null} | null;
  listing: {id: string; title: string; assignedMembershipId: string | null} | null;
  task: {kind: "FOLLOW_UP" | "WORK_TASK"; title: string; assignedMembershipId: string | null} | null;
  call: {id: string; agentMembershipId: string; leadId: string | null; contactId: string | null} | null;
  meeting: {id: string; title: string; organizerMembershipId: string; leadId: string | null; contactId: string | null} | null;
  conversation: {id: string; assignedMembershipId: string | null; leadId: string | null; customerName: string | null; status: string} | null;
}

const id = (value: string | null | undefined) => value ? canonicalUuid(value) : null;
const payloadOf = (event: AutomationEventRow) => (event.payload && typeof event.payload === "object" ? event.payload : {}) as Record<string, unknown>;
const text = (value: unknown) => typeof value === "string" ? value : null;

/** What the event points at, before reading anything. */
export function targetOf(event: AutomationEventRow): RunTarget {
  const payload = payloadOf(event);
  const targetId = id(event.targetId);
  const target: RunTarget = {leadId: null, listingId: null, viewingId: null, contactId: null, followUpId: null, workTaskId: null, callId: null, meetingId: null, conversationId: null};
  switch (event.targetType) {
    case "LEAD": target.leadId = targetId; break;
    case "VIEWING": target.viewingId = targetId; target.leadId = id(text(payload.leadId)); break;
    case "LISTING": target.listingId = targetId; break;
    case "CONTACT": target.contactId = targetId; break;
    case "CALL": target.callId = targetId; target.leadId = id(text(payload.leadId)); break;
    case "MEETING": target.meetingId = targetId; target.leadId = id(text(payload.leadId)); break;
    case "CONVERSATION": target.conversationId = targetId; target.leadId = id(text(payload.leadId)); break;
    case "TASK":
      if (payload.kind === "WORK_TASK") target.workTaskId = targetId; else target.followUpId = targetId;
      target.leadId = id(text(payload.leadId));
      break;
  }
  return target;
}

export async function loadRunState(context: Context, event: AutomationEventRow): Promise<RunState> {
  const target = targetOf(event);
  const payload = payloadOf(event);
  const data = await raw(() => sdk.automationFacts(context.request.dc, {
    organizationId: context.organizationId, since: event.createdAt,
    leadId: target.leadId, hasLead: Boolean(target.leadId), listingId: target.listingId, hasListing: Boolean(target.listingId),
    viewingId: target.viewingId, hasViewing: Boolean(target.viewingId), followUpId: target.followUpId, hasFollowUp: Boolean(target.followUpId),
    workTaskId: target.workTaskId, hasWorkTask: Boolean(target.workTaskId), contactId: target.contactId, hasContact: Boolean(target.contactId),
    callId: target.callId, hasCall: Boolean(target.callId), meetingId: target.meetingId, hasMeeting: Boolean(target.meetingId),
    conversationId: target.conversationId, hasConversation: Boolean(target.conversationId),
  }, context.request.options));
  // A viewing or task names its lead; read the lead too when the event did not carry it.
  const leadFromRecord = id(data.viewing?.leadId ?? data.followUp?.leadId ?? data.workTask?.leadId ?? data.call?.leadId ?? data.meeting?.leadId ?? data.conversation?.leadId ?? null);
  if (!target.leadId && leadFromRecord) return loadRunState(context, {...event, payload: {...payload, leadId: leadFromRecord}});

  const facts: Facts = {"event.origin": event.origin, "event.occurredAt": event.createdAt};
  const lead = data.lead ?? null;
  if (lead) Object.assign(facts, {
    "lead.status": lead.status, "lead.previousStatus": text(payload.previousStatus), "lead.source": lead.source ?? null, "lead.priority": lead.priority,
    "lead.assignedAgentId": id(lead.assignedMembershipId), "lead.projectId": id(lead.projectId), "lead.propertyId": id(lead.propertyId),
    "lead.budgetMax": lead.budgetMax ?? null, "lead.archived": Boolean(lead.archivedAt), "lead.createdAt": lead.createdAt,
    "lead.channel": lead.origin?.channel ?? null, "lead.platform": lead.origin?.platform ?? null, "lead.campaign": lead.origin?.campaignKey ?? null,
    "lead.contacted": data.contactActivity.length > 0 || (data.answeredCalls?.length ?? 0) > 0, "lead.followupCompleted": data.completedFollowUps.length > 0,
  });
  const followUp = data.followUp ?? null, workTask = data.workTask ?? null;
  if (followUp) Object.assign(facts, {"task.status": followUp.status, "task.dueAt": followUp.dueAt, "task.assignedAgentId": id(followUp.assignedUserId), "task.kind": "FOLLOW_UP"});
  if (workTask) Object.assign(facts, {"task.status": workTask.status, "task.dueAt": workTask.dueAt, "task.assignedAgentId": id(workTask.assignedMembershipId), "task.kind": "WORK_TASK"});
  const viewing = data.viewing ?? null;
  if (viewing) Object.assign(facts, {"viewing.status": viewing.status, "viewing.outcome": viewing.outcome ?? null, "viewing.scheduledAt": viewing.scheduledAt});
  const listing = data.listing ?? null;
  if (listing) Object.assign(facts, {
    "listing.status": listing.listingStatus, "listing.previousStatus": text(payload.previousStatus), "listing.purpose": listing.listingPurpose,
    "listing.assignedAgentId": id(listing.assignedMembershipId), "listing.price": Number(listing.askingPriceMinor) / 100,
  });
  const call = data.call ?? null;
  if (call) Object.assign(facts, {
    "call.direction": call.direction, "call.type": call.callType, "call.status": call.callStatus, "call.outcome": call.outcome ?? null,
    "call.durationSeconds": call.durationSeconds ?? null, "call.source": call.source, "call.agentId": id(call.agentMembershipId),
  });
  const meeting = data.meeting ?? null;
  if (meeting) Object.assign(facts, {"meeting.status": meeting.status, "meeting.provider": meeting.provider, "meeting.startsAt": meeting.startsAt, "meeting.organizerId": id(meeting.organizerMembershipId)});
  const conversation = data.conversation ?? null;
  if (conversation) Object.assign(facts, {
    "conversation.channel": conversation.channel, "conversation.status": conversation.status, "conversation.priority": conversation.priority,
    "conversation.assignedAgentId": id(conversation.assignedMembershipId), "conversation.linked": Boolean(conversation.contactId), "conversation.optedOut": conversation.optedOut,
    "conversation.unanswered": Boolean(conversation.lastInboundAt) && (!conversation.lastOutboundAt || Date.parse(conversation.lastOutboundAt) < Date.parse(conversation.lastInboundAt!)),
    "conversation.lastCustomerMessageAt": conversation.lastInboundAt ?? null,
  });
  const contact = data.contact ?? null;
  if (contact) Object.assign(facts, {"contact.preferredLanguage": contact.preferredLanguage ?? null, "contact.hasEmail": Boolean(contact.email), "contact.hasPhone": Boolean(contact.phone)});

  return {
    facts, target: {...target, leadId: id(lead?.id) ?? target.leadId},
    lead: lead ? {id: canonicalUuid(lead.id), fullName: lead.fullName, status: lead.status, assignedMembershipId: id(lead.assignedMembershipId), branchId: id(lead.branchId), projectId: id(lead.projectId)} : null,
    listing: listing ? {id: canonicalUuid(listing.id), title: listing.title, assignedMembershipId: id(listing.assignedMembershipId)} : null,
    task: followUp ? {kind: "FOLLOW_UP", title: followUp.title, assignedMembershipId: id(followUp.assignedUserId)}
      : workTask ? {kind: "WORK_TASK", title: workTask.title, assignedMembershipId: id(workTask.assignedMembershipId)} : null,
    call: call ? {id: canonicalUuid(call.id), agentMembershipId: canonicalUuid(call.agentMembershipId), leadId: id(call.leadId), contactId: id(call.contactId)} : null,
    meeting: meeting ? {id: canonicalUuid(meeting.id), title: meeting.title, organizerMembershipId: canonicalUuid(meeting.organizerMembershipId), leadId: id(meeting.leadId), contactId: id(meeting.contactId)} : null,
    conversation: conversation ? {id: canonicalUuid(conversation.id), assignedMembershipId: id(conversation.assignedMembershipId), leadId: id(conversation.leadId), customerName: conversation.customerName ?? null, status: conversation.status} : null,
  };
}
