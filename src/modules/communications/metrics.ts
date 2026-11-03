import { isAnswered, isConversation, isFinal, isMissed } from "./call-state";
import { CALL_OUTCOMES, type CallDirection, type CallOutcome, type CallStatus } from "./model";

/*
 * Communication metrics from stored call records (docs/COMMUNICATION_HUB.md#metrics).
 * Attempts, answered calls, conversations and outcomes are kept apart: a dial
 * attempt is not contact, an answered call is not a conversation until the
 * agent records an outcome, and an outcome is not a sale. Duration is shown
 * only as an average of answered calls and is never a quality score.
 */

export interface MetricCall {
  direction: CallDirection;
  callStatus: CallStatus;
  answeredAt: string | null;
  outcome: CallOutcome | null;
  durationSeconds: number;
  agentId: string;
  agentName: string;
}

export interface CallTotals {
  /** Outgoing calls that finished (connected or not). */
  attempts: number;
  /** Outgoing calls the customer answered. */
  answered: number;
  /** Outgoing calls that ended unanswered (no answer, busy, failed, cancelled). */
  unanswered: number;
  incoming: number;
  incomingAnswered: number;
  /** Incoming calls nobody answered. */
  missed: number;
  /** Answered calls with an outcome recorded (excluding wrong numbers). */
  conversations: number;
  /** Average length of answered calls, in seconds (null without any). */
  averageAnsweredSeconds: number | null;
  /** Calls still ringing or in progress. */
  inProgress: number;
}

export function callTotals(calls: readonly MetricCall[]): CallTotals {
  const totals: CallTotals = {attempts: 0, answered: 0, unanswered: 0, incoming: 0, incomingAnswered: 0, missed: 0, conversations: 0, averageAnsweredSeconds: null, inProgress: 0};
  let answeredSeconds = 0, answeredWithDuration = 0;
  for (const call of calls) {
    if (!isFinal(call.callStatus)) { totals.inProgress += 1; continue; }
    const answered = isAnswered(call);
    if (call.direction === "OUTBOUND") {
      totals.attempts += 1;
      if (answered) totals.answered += 1; else totals.unanswered += 1;
    } else {
      totals.incoming += 1;
      if (answered) totals.incomingAnswered += 1;
      if (isMissed(call)) totals.missed += 1;
    }
    if (isConversation(call)) totals.conversations += 1;
    if (answered && call.durationSeconds > 0) { answeredSeconds += call.durationSeconds; answeredWithDuration += 1; }
  }
  totals.averageAnsweredSeconds = answeredWithDuration ? Math.round(answeredSeconds / answeredWithDuration) : null;
  return totals;
}

/** Recorded outcomes, in a fixed order, including zero counts. */
export function outcomeCounts(calls: readonly MetricCall[]) {
  const counts = Object.fromEntries(CALL_OUTCOMES.map(outcome => [outcome, 0])) as Record<CallOutcome, number>;
  for (const call of calls) if (call.outcome && isAnswered(call)) counts[call.outcome] += 1;
  return CALL_OUTCOMES.map(outcome => ({outcome, count: counts[outcome]}));
}

export function totalsByAgent(calls: readonly MetricCall[]) {
  const groups = new Map<string, {agentId: string; agentName: string; calls: MetricCall[]}>();
  for (const call of calls) {
    const group = groups.get(call.agentId) ?? {agentId: call.agentId, agentName: call.agentName, calls: []};
    group.calls.push(call);
    groups.set(call.agentId, group);
  }
  return [...groups.values()].map(group => ({agentId: group.agentId, agentName: group.agentName, ...callTotals(group.calls)}))
    .sort((a, b) => (b.attempts + b.incoming) - (a.attempts + a.incoming) || a.agentName.localeCompare(b.agentName));
}

export interface MetricMeeting { status: "SCHEDULED" | "COMPLETED" | "CANCELLED" | "NO_SHOW"; organizerId: string; organizerName: string }
export interface MeetingTotals { scheduled: number; held: number; noShow: number; cancelled: number }

/** Meetings by what happened; a scheduled meeting in the past that nobody updated stays "scheduled". */
export function meetingTotals(meetings: readonly MetricMeeting[]): MeetingTotals {
  const totals: MeetingTotals = {scheduled: 0, held: 0, noShow: 0, cancelled: 0};
  for (const meeting of meetings) {
    if (meeting.status === "COMPLETED") totals.held += 1;
    else if (meeting.status === "NO_SHOW") totals.noShow += 1;
    else if (meeting.status === "CANCELLED") totals.cancelled += 1;
    else totals.scheduled += 1;
  }
  return totals;
}

/**
 * One row per agent with calls and meetings kept apart. The answer rate is
 * answered outgoing calls over finished outgoing attempts (null without any).
 */
export function agentReport(calls: readonly MetricCall[], meetings: readonly MetricMeeting[]) {
  const names = new Map<string, string>();
  for (const call of calls) names.set(call.agentId, call.agentName);
  for (const meeting of meetings) if (!names.has(meeting.organizerId)) names.set(meeting.organizerId, meeting.organizerName);
  return [...names.entries()].map(([agentId, agentName]) => {
    const own = calls.filter(call => call.agentId === agentId);
    const totals = callTotals(own);
    return {
      agentId, agentName, ...totals, answerRate: totals.attempts ? Math.round((totals.answered / totals.attempts) * 100) : null,
      interested: own.filter(call => call.outcome === "INTERESTED" && isAnswered(call)).length,
      viewingRequested: own.filter(call => call.outcome === "VIEWING_REQUESTED" && isAnswered(call)).length,
      meetings: meetingTotals(meetings.filter(meeting => meeting.organizerId === agentId)),
    };
  }).sort((a, b) => (b.attempts + b.incoming) - (a.attempts + a.incoming) || a.agentName.localeCompare(b.agentName));
}
