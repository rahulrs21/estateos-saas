import type { CallDirection, CallOutcome, CallStatus } from "./model";

/*
 * Call connection states (docs/COMMUNICATION_HUB.md#call-states). Provider
 * events can arrive late, twice or out of order; a call only moves forward,
 * and a final state never changes. Answered is a connection fact; whether a
 * conversation took place is what the agent recorded afterwards.
 */

const RANK: Record<CallStatus, number> = {INITIATED: 0, RINGING: 1, IN_PROGRESS: 2, COMPLETED: 3, FAILED: 3, BUSY: 3, NO_ANSWER: 3, CANCELLED: 3};
export const FINAL_STATUSES: readonly CallStatus[] = ["COMPLETED", "FAILED", "BUSY", "NO_ANSWER", "CANCELLED"];
export const isFinal = (status: CallStatus) => FINAL_STATUSES.includes(status);

/** Which statuses may follow which. A call can end at any point before it is answered; an answered call ends completed or failed (dropped). */
const NEXT: Record<CallStatus, readonly CallStatus[]> = {
  INITIATED: ["RINGING", "IN_PROGRESS", "COMPLETED", "FAILED", "BUSY", "NO_ANSWER", "CANCELLED"],
  RINGING: ["IN_PROGRESS", "COMPLETED", "FAILED", "BUSY", "NO_ANSWER", "CANCELLED"],
  IN_PROGRESS: ["COMPLETED", "FAILED"],
  COMPLETED: [], FAILED: [], BUSY: [], NO_ANSWER: [], CANCELLED: [],
};

export type TransitionResult =
  | {apply: true; next: CallStatus}
  | {apply: false; reason: "DUPLICATE" | "FINAL" | "OUT_OF_ORDER" | "NOT_ALLOWED"};

/** Decides whether an incoming status (for example from a provider event) changes the call. */
export function transition(current: CallStatus, incoming: CallStatus): TransitionResult {
  if (incoming === current) return {apply: false, reason: "DUPLICATE"};
  if (isFinal(current)) return {apply: false, reason: "FINAL"};
  if (RANK[incoming] < RANK[current]) return {apply: false, reason: "OUT_OF_ORDER"};
  if (!NEXT[current].includes(incoming)) return {apply: false, reason: "NOT_ALLOWED"};
  return {apply: true, next: incoming};
}

interface CallFacts {direction: CallDirection; callStatus: CallStatus; answeredAt?: string | null; outcome?: CallOutcome | null}

/** The customer picked up (from the connection status, never from an outcome). */
export const isAnswered = (call: Pick<CallFacts, "callStatus" | "answeredAt">) => Boolean(call.answeredAt) || call.callStatus === "IN_PROGRESS" || call.callStatus === "COMPLETED";

/** An incoming call nobody answered. */
export const isMissed = (call: Pick<CallFacts, "direction" | "callStatus" | "answeredAt">) =>
  call.direction === "INBOUND" && isFinal(call.callStatus) && !isAnswered(call);

/** A conversation: answered, and the agent recorded an outcome from talking to the customer (a wrong number is not one). */
export const isConversation = (call: CallFacts) => isAnswered(call) && Boolean(call.outcome) && call.outcome !== "WRONG_NUMBER";

export type FinalCallTrigger = "call.completed" | "call.failed" | "call.missed";
/**
 * The workflow event a finished call starts (docs/COMMUNICATION_HUB.md#workflow-events):
 * answered, failed, or an incoming call nobody answered. An unanswered outgoing
 * attempt starts none. The database applies the same rule to manual logs.
 */
export function finalCallTrigger(direction: CallDirection, status: CallStatus): FinalCallTrigger | null {
  if (status === "COMPLETED") return "call.completed";
  if (status === "FAILED") return "call.failed";
  if (direction === "INBOUND" && isFinal(status)) return "call.missed";
  return null;
}

/**
 * What moving a call to `next` at `at` writes (provider webhooks and the
 * developer simulator use the same rule): when it was answered, when it ended,
 * its talk time, and its one final workflow event.
 */
export function statusChange(call: {direction: CallDirection; startedAt: string; answeredAt?: string | null}, next: CallStatus, at: string, reportedSeconds: number | null | undefined) {
  const final = isFinal(next);
  const answeredAt = next === "IN_PROGRESS" ? at
    // Only the final status was reported: answered at the end minus the talk time, never before the call started.
    : next === "COMPLETED" && !call.answeredAt ? new Date(Math.max(Date.parse(call.startedAt), Date.parse(at) - (reportedSeconds ?? 0) * 1000)).toISOString()
    : null;
  return {
    answeredAt, endedAt: final ? at : null,
    durationSeconds: final && next === "COMPLETED" ? reportedSeconds ?? null : final ? 0 : null,
    trigger: final ? finalCallTrigger(call.direction, next) : null,
  };
}
