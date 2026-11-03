import { isFinal, isAnswered } from "./call-state";
import { parseCallingCodes, type CallDirection, type CallStatus, type CallType, type SuppressionReason, type SuppressionScope } from "./model";
import { destinationProblems } from "./phone";

/*
 * Calling rules (docs/CALL_PRIVACY_COMPLIANCE.md). One evaluation serves both
 * paths: a live call through a provider is refused when any issue applies; a
 * manual log of a call that already happened is saved and its issues are shown
 * as warnings (blocking would only stop agents recording what happened).
 *
 * Marketing calls follow UAE Cabinet Resolution 56 of 2024 as summarised in
 * the compliance document (TDRA approval, 09:00-18:00, one a day, two a week
 * when unanswered, no calls after a rejected offer or to the Do Not Call
 * Registry). The company configures the limits within those bounds; the
 * database refuses settings outside them. These checks are not legal advice.
 */

export interface CommunicationRules {
  timeZone: string;
  callingWindowStart: string;
  callingWindowEnd: string;
  maxCallsPerContactPerDay: number;
  telemarketingEnabled: boolean;
  telemarketingApprovalReference: string | null;
  marketingWindowStart: string;
  marketingWindowEnd: string;
  marketingMaxCallsPerDay: number;
  marketingMaxUnansweredPerWeek: number;
  allowedCallingCodes: string;
  liveCallingAttestedAt: string | null;
  liveCallingAttestationVersion: string | null;
  maxConcurrentLiveCalls: number;
  maxLiveCallsPerAgentPerDay: number;
  recordingEnabled: boolean;
  retentionDays: number;
  aiAnalysisEnabled: boolean;
}

/** The defaults a company has before an OWNER or ADMIN saves settings (the same as the schema defaults). */
export const DEFAULT_RULES: CommunicationRules = {
  timeZone: "Asia/Dubai", callingWindowStart: "08:00", callingWindowEnd: "21:00", maxCallsPerContactPerDay: 3,
  telemarketingEnabled: false, telemarketingApprovalReference: null, marketingWindowStart: "09:00", marketingWindowEnd: "18:00",
  marketingMaxCallsPerDay: 1, marketingMaxUnansweredPerWeek: 2, allowedCallingCodes: "971",
  liveCallingAttestedAt: null, liveCallingAttestationVersion: null, maxConcurrentLiveCalls: 5, maxLiveCallsPerAgentPerDay: 60,
  recordingEnabled: false, retentionDays: 90, aiAnalysisEnabled: false,
};

export function rulesFrom(row: Partial<{[K in keyof CommunicationRules]: CommunicationRules[K] | null}> | null | undefined): CommunicationRules {
  if (!row) return {...DEFAULT_RULES};
  const rules = {...DEFAULT_RULES};
  for (const key of Object.keys(DEFAULT_RULES) as Array<keyof CommunicationRules>) {
    const value = row[key];
    if (value !== undefined && (value !== null || DEFAULT_RULES[key] === null)) (rules as Record<string, unknown>)[key] = value;
  }
  return rules;
}

export const COMPLIANCE_ISSUES = [
  "INVALID_NUMBER", "COUNTRY_NOT_ALLOWED", "PREMIUM_RATE_NUMBER", "NUMBER_SUPPRESSED", "MARKETING_SUPPRESSED",
  "OUTSIDE_CALLING_HOURS", "TELEMARKETING_NOT_ENABLED", "OUTSIDE_MARKETING_HOURS", "MARKETING_DAILY_LIMIT", "MARKETING_UNANSWERED_LIMIT", "CONTACT_DAILY_LIMIT",
] as const;
export type ComplianceIssue = (typeof COMPLIANCE_ISSUES)[number];

export const COMPLIANCE_MESSAGES: Record<ComplianceIssue, string> = {
  INVALID_NUMBER: "The customer's number on record is missing or not a valid international number.",
  COUNTRY_NOT_ALLOWED: "The number's country is not in the company's allowed calling codes.",
  PREMIUM_RATE_NUMBER: "Premium-rate numbers are never called.",
  NUMBER_SUPPRESSED: "This number is on the company's do-not-call list.",
  MARKETING_SUPPRESSED: "This number must not receive marketing calls (opted out, rejected an offer or on the Do Not Call Registry).",
  OUTSIDE_CALLING_HOURS: "The call is outside the company's calling hours.",
  TELEMARKETING_NOT_ENABLED: "Marketing calls are not enabled for the company (TDRA telemarketing approval not recorded).",
  OUTSIDE_MARKETING_HOURS: "Marketing calls are allowed only within the marketing hours (at most 09:00-18:00 UAE time).",
  MARKETING_DAILY_LIMIT: "This number already had a marketing call today.",
  MARKETING_UNANSWERED_LIMIT: "This number already had the maximum unanswered marketing calls in the last 7 days.",
  CONTACT_DAILY_LIMIT: "This number already reached the company's daily call limit.",
};

export interface SuppressionFact {scope: SuppressionScope; reason: SuppressionReason; createdAt: string}
export interface PriorCall {id?: string; startedAt: string; direction: CallDirection; callType: CallType; callStatus: CallStatus; answeredAt: string | null}

export interface CallCheck {
  direction: CallDirection;
  callType: CallType;
  /** When the call starts (now for a live call; the logged start for a manual log). */
  at: Date;
  number: string | null;
  rules: CommunicationRules;
  suppressions: readonly SuppressionFact[];
  priorCalls: readonly PriorCall[];
  /** The call itself, when re-evaluating a saved call. */
  callId?: string;
}

export function isTimeZone(value: string) {
  try { new Intl.DateTimeFormat("en-GB", {timeZone: value}); return value.length > 0 && value.length <= 64; } catch { return false; }
}

/** The local date (YYYY-MM-DD) and time (HH:MM) of a moment in a timezone. */
export function localMoment(at: Date, timeZone: string) {
  const zone = isTimeZone(timeZone) ? timeZone : DEFAULT_RULES.timeZone;
  const parts = new Intl.DateTimeFormat("en-GB", {timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23"}).formatToParts(at);
  const get = (type: string) => parts.find(part => part.type === type)?.value ?? "";
  return {date: `${get("year")}-${get("month")}-${get("day")}`, time: `${get("hour")}:${get("minute")}`};
}

const inWindow = (time: string, start: string, end: string) => time >= start && time < end;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Every rule that applies to one call. Incoming calls are the customer's own
 * calls, so only outgoing calls are checked. Earlier calls to the same number
 * by any agent of the company count towards the limits.
 */
export function evaluateCall(check: CallCheck): ComplianceIssue[] {
  if (check.direction !== "OUTBOUND") return [];
  const {rules, at} = check;
  const issues = new Set<ComplianceIssue>(destinationProblems(check.number, parseCallingCodes(rules.allowedCallingCodes)));
  const atMs = at.getTime();
  const suppressions = check.suppressions.filter(item => Date.parse(item.createdAt) <= atMs);
  const marketing = check.callType === "MARKETING";
  if (suppressions.some(item => item.scope === "ALL")) issues.add("NUMBER_SUPPRESSED");
  if (marketing && suppressions.some(item => item.scope === "MARKETING")) issues.add("MARKETING_SUPPRESSED");

  const local = localMoment(at, rules.timeZone);
  if (!inWindow(local.time, rules.callingWindowStart, rules.callingWindowEnd)) issues.add("OUTSIDE_CALLING_HOURS");

  const earlier = check.priorCalls.filter(call => call.direction === "OUTBOUND" && !(check.callId && call.id === check.callId) && Date.parse(call.startedAt) < atMs);
  const sameDay = earlier.filter(call => localMoment(new Date(call.startedAt), rules.timeZone).date === local.date);
  if (sameDay.length >= rules.maxCallsPerContactPerDay) issues.add("CONTACT_DAILY_LIMIT");

  if (marketing) {
    if (!rules.telemarketingEnabled || !rules.telemarketingApprovalReference) issues.add("TELEMARKETING_NOT_ENABLED");
    if (!inWindow(local.time, rules.marketingWindowStart, rules.marketingWindowEnd)) issues.add("OUTSIDE_MARKETING_HOURS");
    if (sameDay.filter(call => call.callType === "MARKETING").length >= rules.marketingMaxCallsPerDay) issues.add("MARKETING_DAILY_LIMIT");
    const unansweredThisWeek = earlier.filter(call => call.callType === "MARKETING" && atMs - Date.parse(call.startedAt) < WEEK_MS && isFinal(call.callStatus) && !isAnswered(call));
    if (unansweredThisWeek.length >= rules.marketingMaxUnansweredPerWeek) issues.add("MARKETING_UNANSWERED_LIMIT");
  }
  return COMPLIANCE_ISSUES.filter(issue => issues.has(issue));
}
