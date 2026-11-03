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
