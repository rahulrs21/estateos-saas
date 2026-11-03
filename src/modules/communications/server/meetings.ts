import "server-only";

import { z } from "zod";
import { stableUuid } from "@/modules/automations/ids";
import { requireAiConfig } from "@/modules/ai/server/anthropic";
import { enforceRateLimit, requestClientIp } from "@/lib/rate-limit/server";
import { mapWorkspaceDataError, WorkspaceError } from "@/modules/organizations/server/errors";
import { canonicalUuid } from "@/modules/organizations/server/identifiers";
import { SUGGESTION_KINDS, sourceLines, type CheckedSummary, type SuggestionKind } from "../intelligence";
import { MEETING_STATUSES, MEETING_SUMMARY_TASK, meetingInputSchema, parseDecisions, type MeetingDecisions } from "../meetings";
import { asMember, asServer, isAdministrator, isDuplicate, sdk, type Context } from "./data";
import { claudeSummary } from "./intelligence";
import { idSchema, parseInput } from "./validation";

/*
 * Meetings (docs/COMMUNICATION_HUB.md#meetings): scheduled from a lead or
 * contact, held in the provider's own app, notes recorded afterwards, and an
 * optional Claude summary of the notes with suggestions a person decides.
 * The database re-checks access on every operation; scheduling and completing
 * write the meeting.scheduled and meeting.completed workflow events.
 */

const DAY = 86_400_000;
const listSchema = z.strictObject({
  when: z.enum(["UPCOMING", "PAST", "ALL"]).default("UPCOMING"),
  status: z.enum(MEETING_STATUSES).optional(),
  leadId: idSchema.optional(),
  contactId: idSchema.optional(),
  page: z.coerce.number().int().min(1).max(400).default(1),
});

export async function listMeetings(context: Context, query: Record<string, string>) {
  const input = parseInput(listSchema, query);
  const now = Date.now();
  const range = input.when === "UPCOMING" ? {from: new Date(now - 2 * 3_600_000).toISOString()} : input.when === "PAST" ? {to: new Date(now).toISOString()} : {};
  const data = await asMember(context, "ListMeetings", (dc, options) => sdk.listMeetings(dc, {
    organizationId: context.organizationId, ...range, status: input.status ? sdk.MeetingStatus[input.status] : undefined, leadId: input.leadId, contactId: input.contactId, limit: 26, offset: (input.page - 1) * 25,
  }, options));
  const rows = input.when === "UPCOMING" ? [...data.meetings].sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt)) : data.meetings;
  return {meetings: rows.slice(0, 25), hasMore: rows.length > 25, page: input.page};
}
export type MeetingListView = Awaited<ReturnType<typeof listMeetings>>;

export async function meetingAttendeeOptions(context: Context) {
  const {members} = await asMember(context, "ListMeetingAttendeeOptions", (dc, options) => sdk.listMeetingAttendeeOptions(dc, {organizationId: context.organizationId}, options));
  return members.map(member => ({id: canonicalUuid(member.id), name: member.userProfile?.displayName || "Team member", role: member.role}));
}

export async function getMeeting(context: Context, rawId: string) {
  const id = parseInput(idSchema, rawId);
  const data = await asMember(context, "GetMeeting", (dc, options) => sdk.getMeeting(dc, {organizationId: context.organizationId, id}, options));
  if (!data.meeting) throw new WorkspaceError("NOT_FOUND", 404, "This meeting was not found.");
  const meeting = data.meeting;
  const canEdit = isAdministrator(context) || canonicalUuid(meeting.organizerMembershipId) === canonicalUuid(context.membership.id);
  const aiAnalysisEnabled = Boolean(data.settings?.aiAnalysisEnabled);
  return {
    ...meeting, summaryJson: undefined, suggestionDecisionsJson: undefined, organizerMembershipId: canonicalUuid(meeting.organizerMembershipId),
    attendees: meeting.attendees.map(row => ({...row, membershipId: canonicalUuid(row.membershipId)})),
    summary: meeting.summaryJson ? JSON.parse(meeting.summaryJson) as CheckedSummary : null, decisions: parseDecisions(meeting.suggestionDecisionsJson),
    canEdit, aiAnalysisEnabled, canSummarize: canEdit && aiAnalysisEnabled && meeting.status === "COMPLETED" && Boolean(meeting.notes?.trim()),
    attendeeOptions: canEdit && meeting.status === "SCHEDULED" ? await meetingAttendeeOptions(context) : [],
  };
}
export type MeetingView = Awaited<ReturnType<typeof getMeeting>>;

const createSchema = z.strictObject({
  requestId: idSchema, leadId: idSchema.optional(), contactId: idSchema.optional(), attendeeIds: z.array(idSchema).max(10).default([]), details: z.unknown(),
}).refine(value => Boolean(value.leadId) !== Boolean(value.contactId), "Choose a lead or a contact.");

/** Schedules a meeting with a lead or contact. The request ID makes a repeated submission harmless. */
export async function createMeeting(context: Context, body: unknown) {
  const input = parseInput(createSchema, body);
  const details = parseInput(meetingInputSchema, input.details);
  const id = stableUuid("meeting", context.organizationId, input.requestId);
  try {
    await sdk.createMeeting(context.request.dc, {
      organizationId: context.organizationId, id, hasLead: Boolean(input.leadId), leadId: input.leadId ?? null, hasContact: Boolean(input.contactId), contactId: input.contactId ?? null,
      title: details.title, provider: sdk.MeetingProvider[details.provider], meetingUrl: details.meetingUrl ?? null, location: details.location ?? null,
      startsAt: new Date(details.startsAt).toISOString(), endsAt: new Date(details.endsAt).toISOString(), agenda: details.agenda ?? null,
    }, context.request.options);
  } catch (error) {
    if (isDuplicate(error)) return {id, duplicate: true};
    throw mapWorkspaceDataError(error);
  }
  for (const membershipId of new Set(input.attendeeIds)) {
    if (membershipId === canonicalUuid(context.membership.id)) continue; // the organizer attends anyway
    await asMember(context, "AddMeetingAttendee", (dc, options) => sdk.addMeetingAttendee(dc, {organizationId: context.organizationId, id: stableUuid("meeting-attendee", id, membershipId), meetingId: id, membershipId}, options));
  }
  return {id, duplicate: false};
}

const updateSchema = z.strictObject({expectedRevision: z.number().int().min(1), details: z.unknown(), notes: z.string().trim().max(8000).nullable().optional(), attendeeIds: z.array(idSchema).max(10).optional()});

export async function updateMeeting(context: Context, rawId: string, body: unknown) {
  const id = parseInput(idSchema, rawId);
  const input = parseInput(updateSchema, body);
  const details = parseInput(meetingInputSchema, input.details);
  await asMember(context, "UpdateMeeting", (dc, options) => sdk.updateMeeting(dc, {
    organizationId: context.organizationId, id, expectedRevision: input.expectedRevision, title: details.title, provider: sdk.MeetingProvider[details.provider], meetingUrl: details.meetingUrl ?? null,
    location: details.location ?? null, startsAt: new Date(details.startsAt).toISOString(), endsAt: new Date(details.endsAt).toISOString(), agenda: details.agenda ?? null, notes: input.notes || null,
  }, options));
  if (input.attendeeIds) {
    const {meeting} = await asMember(context, "GetMeeting", (dc, options) => sdk.getMeeting(dc, {organizationId: context.organizationId, id}, options));
    const current = new Set((meeting?.attendees ?? []).map(row => canonicalUuid(row.membershipId)));
    const wanted = new Set(input.attendeeIds.map(canonicalUuid).filter(member => member !== canonicalUuid(context.membership.id)));
    for (const membershipId of wanted) if (!current.has(membershipId)) {
      await asMember(context, "AddMeetingAttendee", (dc, options) => sdk.addMeetingAttendee(dc, {organizationId: context.organizationId, id: stableUuid("meeting-attendee", id, membershipId), meetingId: id, membershipId}, options));
    }
    for (const membershipId of current) if (!wanted.has(membershipId)) {
      await asMember(context, "RemoveMeetingAttendee", (dc, options) => sdk.removeMeetingAttendee(dc, {organizationId: context.organizationId, meetingId: id, membershipId}, options));
    }
  }
  return {id, revision: input.expectedRevision + 1};
}

const statusSchema = z.strictObject({expectedRevision: z.number().int().min(1), status: z.enum(["COMPLETED", "CANCELLED", "NO_SHOW"]), notes: z.string().trim().max(8000).nullable().optional()});

/** Held (with notes), cancelled, or the customer did not attend. Only a scheduled meeting changes status. */
export async function setMeetingStatus(context: Context, rawId: string, body: unknown) {
  const id = parseInput(idSchema, rawId);
  const input = parseInput(statusSchema, body);
  if (input.status === "COMPLETED") {
    const {meeting} = await asMember(context, "GetMeeting", (dc, options) => sdk.getMeeting(dc, {organizationId: context.organizationId, id}, options));
    if (!meeting) throw new WorkspaceError("NOT_FOUND", 404, "This meeting was not found.");
    const leadId = meeting.leadId ? canonicalUuid(meeting.leadId) : null;
    await asMember(context, "CompleteMeeting", (dc, options) => sdk.completeMeeting(dc, {organizationId: context.organizationId, id, expectedRevision: input.expectedRevision, leadId, hasLead: Boolean(leadId), notes: input.notes || null}, options));
  } else {
    await asMember(context, "SetMeetingStatus", (dc, options) => sdk.setMeetingStatus(dc, {organizationId: context.organizationId, id, expectedRevision: input.expectedRevision, status: sdk.MeetingStatus[input.status]}, options));
  }
  return {id, status: input.status};
}

/** A Claude summary of the meeting notes (the company's Claude analysis switch, the organizer or an OWNER or ADMIN). */
export async function summarizeMeeting(request: Request, context: Context, rawId: string) {
  const view = await getMeeting(context, rawId);
  if (!view.aiAnalysisEnabled) throw new WorkspaceError("CALL_AI_NOT_AVAILABLE", 409, "Claude analysis is not enabled for your company. An owner or administrator can enable it in Calling settings.");
  if (!view.canEdit) throw new WorkspaceError("PERMISSION_DENIED", 403, "Only the organizer, or an owner or administrator, can summarise this meeting.");
  if (view.status !== "COMPLETED" || !view.notes?.trim()) throw new WorkspaceError("VALIDATION_ERROR", 400, "Mark the meeting as held and add notes before summarising them.");
  const config = requireAiConfig();
  await enforceRateLimit([
    {rule: {scope: "ai.calls.member", limit: config.requestsPerMinutePerMember, windowSeconds: 60}, subject: context.membership.id},
    {rule: {scope: "ai.calls.ip", limit: config.requestsPerMinutePerMember * 4, windowSeconds: 60}, subject: requestClientIp(request) ?? ""},
  ], "You are using summaries too quickly. Wait a moment and try again.");
  const {checked, model} = await claudeSummary(context, {kind: "NOTES", lines: sourceLines({kind: "NOTES", notes: view.notes}), task: MEETING_SUMMARY_TASK, contentType: "MEETING_SUMMARY"});
  await asServer("SaveMeetingSummary", dc => sdk.saveMeetingSummary(dc, {organizationId: context.organizationId, id: canonicalUuid(view.id), actorUid: context.request.user.uid,
    expectedRevision: view.revision, summaryJson: JSON.stringify(checked), model: model.slice(0, 80)}));
  return {id: canonicalUuid(view.id), unverifiedCount: checked.unverifiedCount};
}

const FOLLOW_UP_KINDS: readonly SuggestionKind[] = ["FOLLOW_UP", "CLARIFY_BUDGET", "SHARE_PAYMENT_PLAN", "ALTERNATIVE_PROPERTY"];
const decideSchema = z.strictObject({action: z.enum(["ACCEPT", "DISMISS"]), followUpAt: z.iso.datetime({offset: true}).optional(), title: z.string().trim().min(1).max(500).optional()});

/**
 * Decides one suggestion of the meeting summary, once. Accepting a follow-up
 * kind records the decision first (compare-and-set, so a double click cannot
 * schedule twice) and then schedules the lead follow-up as the member.
 */
export async function decideMeetingSuggestion(context: Context, rawId: string, rawIndex: string, body: unknown) {
  const index = parseInput(z.coerce.number().int().min(0).max(5), rawIndex);
  const input = parseInput(decideSchema, body);
  const view = await getMeeting(context, rawId);
  if (!view.canEdit) throw new WorkspaceError("PERMISSION_DENIED", 403, "Only the organizer, or an owner or administrator, can decide suggestions.");
  const suggestion = view.summary?.suggestions[index];
  if (!suggestion || !SUGGESTION_KINDS.includes(suggestion.kind)) throw new WorkspaceError("NOT_FOUND", 404, "This suggestion was not found.");
  if (view.decisions[String(index)]) throw new WorkspaceError("CONFLICT", 409, "This suggestion was already decided. Reload the meeting.");
  const leadId = view.leadId ? canonicalUuid(view.leadId) : null;
  const followUp = input.action === "ACCEPT" && FOLLOW_UP_KINDS.includes(suggestion.kind);
  let due: number | null = null;
  if (followUp) {
    if (!leadId) throw new WorkspaceError("VALIDATION_ERROR", 400, "Follow-ups are scheduled on leads; this meeting has no lead.");
    due = input.followUpAt ? Date.parse(input.followUpAt) : NaN;
    if (!(due > Date.now() && due <= Date.now() + 365 * DAY)) throw new WorkspaceError("VALIDATION_ERROR", 400, "Choose a follow-up time in the future, within the next year.");
  }
  const decisions: MeetingDecisions = {...view.decisions, [String(index)]: {status: input.action === "ACCEPT" ? "ACCEPTED" : "DISMISSED", decidedAt: new Date().toISOString()}};
  await asMember(context, "DecideMeetingSuggestion", (dc, options) => sdk.decideMeetingSuggestion(dc, {organizationId: context.organizationId, id: canonicalUuid(view.id), expectedRevision: view.revision, suggestionDecisionsJson: JSON.stringify(decisions)}, options));
  if (!followUp) {
    const next = input.action === "DISMISS" ? null : suggestion.kind === "PROPOSAL_DRAFT" ? {type: "CONTENT_STUDIO" as const, leadId} : {type: "VIEWING_FORM" as const, leadId};
    return {status: input.action === "ACCEPT" ? "ACCEPTED" as const : "DISMISSED" as const, next};
  }
  const scheduled = await asMember(context, "ScheduleLeadFollowUp", (dc, options) => sdk.scheduleLeadFollowUp(dc, {
    organizationId: context.organizationId, leadId: leadId!, followUpAt: new Date(due!).toISOString(), followUpNote: null, title: (input.title ?? suggestion.title).slice(0, 500), replaceExisting: false,
  }, options));
  return {status: "ACCEPTED" as const, next: {type: "FOLLOW_UP" as const, followUpId: scheduled.followUp.id, leadId}};
}
