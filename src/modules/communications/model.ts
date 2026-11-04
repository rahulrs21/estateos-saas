/*
 * Phase 6F call vocabulary (docs/COMMUNICATION_HUB.md#calls). The connection
 * status of a call (did it ring, was it answered) and the sales outcome the
 * agent records are separate: a dial attempt is never a conversation, and an
 * outcome can only be recorded for an answered call.
 */

export const CALL_DIRECTIONS = ["OUTBOUND", "INBOUND"] as const;
export type CallDirection = (typeof CALL_DIRECTIONS)[number];

/** MANUAL: logged by the agent afterwards. PROVIDER: created from a verified provider's signed events. SIMULATED: developer simulator only (synthetic, never real activity). */
export const CALL_SOURCES = ["MANUAL", "PROVIDER", "SIMULATED"] as const;
export type CallSource = (typeof CALL_SOURCES)[number];

export const CALL_TYPES = ["SERVICE", "FOLLOW_UP", "MARKETING", "INBOUND_ENQUIRY"] as const;
export type CallType = (typeof CALL_TYPES)[number];

export const CALL_STATUSES = ["INITIATED", "RINGING", "IN_PROGRESS", "COMPLETED", "FAILED", "BUSY", "NO_ANSWER", "CANCELLED"] as const;
export type CallStatus = (typeof CALL_STATUSES)[number];

/** Statuses an agent can log for a call that already ended. COMPLETED means the customer answered. */
export const MANUAL_CALL_STATUSES = ["COMPLETED", "NO_ANSWER", "BUSY", "FAILED", "CANCELLED"] as const satisfies readonly CallStatus[];
export type ManualCallStatus = (typeof MANUAL_CALL_STATUSES)[number];

export const CALL_OUTCOMES = ["INTERESTED", "NOT_INTERESTED", "CALLBACK_REQUESTED", "VIEWING_REQUESTED", "NO_DECISION", "WRONG_NUMBER", "DO_NOT_CALL_REQUESTED", "OFFER_REJECTED"] as const;
export type CallOutcome = (typeof CALL_OUTCOMES)[number];

export const SUPPRESSION_SCOPES = ["ALL", "MARKETING"] as const;
export type SuppressionScope = (typeof SUPPRESSION_SCOPES)[number];
export const SUPPRESSION_REASONS = ["OPT_OUT", "DNCR_LISTED", "OFFER_REJECTED", "WRONG_NUMBER", "OTHER"] as const;
export type SuppressionReason = (typeof SUPPRESSION_REASONS)[number];

/**
 * Outcomes that stop further calls to the number. The database adds the
 * suppression in the same transaction as the outcome (LogLeadCall,
 * UpdateCallRecord) with exactly this scope and reason.
 */
export const SUPPRESSING_OUTCOMES: Partial<Record<CallOutcome, {scope: SuppressionScope; reason: SuppressionReason}>> = {
  DO_NOT_CALL_REQUESTED: {scope: "ALL", reason: "OPT_OUT"},
  OFFER_REJECTED: {scope: "MARKETING", reason: "OFFER_REJECTED"},
  WRONG_NUMBER: {scope: "ALL", reason: "WRONG_NUMBER"},
};
export const suppresses = (outcome: CallOutcome | null | undefined) => Boolean(outcome && SUPPRESSING_OUTCOMES[outcome]);

export const CALL_DIRECTION_LABELS: Record<CallDirection, string> = {OUTBOUND: "Outgoing", INBOUND: "Incoming"};
export const CALL_TYPE_LABELS: Record<CallType, string> = {
  SERVICE: "Service (customer request)", FOLLOW_UP: "Follow-up on their enquiry", MARKETING: "Marketing call", INBOUND_ENQUIRY: "Incoming enquiry",
};
export const CALL_STATUS_LABELS: Record<CallStatus, string> = {
  INITIATED: "Dialling", RINGING: "Ringing", IN_PROGRESS: "In progress", COMPLETED: "Answered", FAILED: "Failed", BUSY: "Busy", NO_ANSWER: "No answer", CANCELLED: "Cancelled",
};
export const CALL_OUTCOME_LABELS: Record<CallOutcome, string> = {
  INTERESTED: "Interested", NOT_INTERESTED: "Not interested", CALLBACK_REQUESTED: "Asked for a call back", VIEWING_REQUESTED: "Asked for a viewing",
  NO_DECISION: "No decision yet", WRONG_NUMBER: "Wrong number", DO_NOT_CALL_REQUESTED: "Asked not to be called", OFFER_REJECTED: "Rejected the offer",
};
export const SUPPRESSION_REASON_LABELS: Record<SuppressionReason, string> = {
  OPT_OUT: "Asked not to be called", DNCR_LISTED: "On the Do Not Call Registry", OFFER_REJECTED: "Rejected the offer (no further marketing calls)", WRONG_NUMBER: "Wrong number", OTHER: "Other",
};

/** Calling codes without "+", from the company's comma-separated setting. */
export const parseCallingCodes = (value: string) => value.split(",").map(code => code.trim()).filter(code => /^[1-9][0-9]{0,3}$/.test(code));
