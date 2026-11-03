import "server-only";

import { z } from "zod";
import { WorkspaceError } from "@/modules/organizations/server/errors";
import { canonicalUuid } from "@/modules/organizations/server/identifiers";
import { agentReport, callTotals, meetingTotals, outcomeCounts, type MetricCall, type MetricMeeting } from "../metrics";
import type { CallDirection, CallOutcome, CallStatus } from "../model";
import { asMember, isAdministrator, sdk, type Context } from "./data";
import { idSchema, parseInput } from "./validation";

/*
 * Communication reports (docs/COMMUNICATION_HUB.md#reports). Dates are Dubai
 * calendar days. OWNER and ADMIN members see the company or one agent; others
 * see only their own calls and meetings (the database enforces the same).
 */

const CALL_LIMIT = 5000;
const DAY = 86_400_000;
const DUBAI_OFFSET = 4 * 3_600_000;
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const reportSchema = z.strictObject({from: dateSchema.optional(), to: dateSchema.optional(), agent: idSchema.optional()});

/** The start of a Dubai calendar day, as an instant. */
const dubaiDayStart = (date: string) => Date.parse(`${date}T00:00:00Z`) - DUBAI_OFFSET;
const dubaiDate = (instant: number) => new Date(instant + DUBAI_OFFSET).toISOString().slice(0, 10);

export async function communicationReport(context: Context, query: Record<string, string>) {
  const input = parseInput(reportSchema, query);
  const today = dubaiDate(Date.now());
  const to = input.to ?? today;
  const from = input.from ?? dubaiDate(dubaiDayStart(to) - 29 * DAY);
  const start = dubaiDayStart(from), end = dubaiDayStart(to) + DAY;
  if (!(start < end)) throw new WorkspaceError("VALIDATION_ERROR", 400, "The start date must be on or before the end date.");
  if (end - start > 92 * DAY) throw new WorkspaceError("VALIDATION_ERROR", 400, "Reports cover at most 92 days.");
  const companyWide = isAdministrator(context);
  // Members other than owners and administrators always see their own figures.
  const agentMembershipId = companyWide ? input.agent ?? null : canonicalUuid(context.membership.id);
  const data = await asMember(context, "CommunicationReport", (dc, options) => sdk.communicationReport(dc, {
    // Absent (not null) means every agent: an explicit null filter matches nothing.
    organizationId: context.organizationId, from: new Date(start).toISOString(), to: new Date(end).toISOString(), agentMembershipId: agentMembershipId ?? undefined,
  }, options));
  const calls: MetricCall[] = data.calls.map(call => ({
    direction: call.direction as CallDirection, callStatus: call.callStatus as CallStatus, answeredAt: call.answeredAt ?? null, outcome: (call.outcome ?? null) as CallOutcome | null,
    durationSeconds: call.durationSeconds, agentId: canonicalUuid(call.agentMembershipId), agentName: call.agentMembership.userProfile?.displayName || call.agentMembership.email,
  }));
  const meetings: MetricMeeting[] = data.meetings.map(meeting => ({
    status: meeting.status as MetricMeeting["status"], organizerId: canonicalUuid(meeting.organizerMembershipId), organizerName: meeting.organizerMembership.userProfile?.displayName || meeting.organizerMembership.email,
  }));
  return {
    from, to, companyWide, agent: agentMembershipId, truncated: data.calls.length >= CALL_LIMIT,
    manualCalls: data.calls.filter(call => call.source === "MANUAL").length,
    totals: callTotals(calls), outcomes: outcomeCounts(calls), meetings: meetingTotals(meetings), byAgent: agentReport(calls, meetings),
    agents: data.agents.map(agent => ({id: canonicalUuid(agent.id), name: agent.userProfile?.displayName || agent.email})),
  };
}
export type CommunicationReportView = Awaited<ReturnType<typeof communicationReport>>;
