import { COMPLIANCE_MESSAGES, type CommunicationRules, type ComplianceIssue } from "./compliance";
import { E164 } from "./phone";
import type { ProviderCapabilities } from "./providers/types";

/*
 * When EstateOS may place a live call (docs/TELEPHONY_PROVIDERS.md#live-calling).
 * Every condition must hold; the database checks the same provider, line and
 * attestation conditions again when the call record is created. Calling rules
 * (compliance.ts) apply in full: any issue refuses a live call.
 */

/** The statement an OWNER or ADMIN confirms before live calling can be used. Changing it needs a new version. */
export const LIVE_CALLING_ATTESTATION = {
  version: "2026-11-03",
  text: "I confirm, for this company, that the selected calling provider and our operating arrangements have been reviewed for use in the UAE: the numbers are registered to our commercial licence, calls run through TDRA-licensed infrastructure, our telemarketing approval (if we make marketing calls) is in place, and our agents are trained on the Do Not Call Registry. I understand EstateOS does not verify these arrangements.",
};

export const LIVE_CALL_BLOCKERS = [
  "NO_VERIFIED_PROVIDER", "PROVIDER_CANNOT_DIAL", "SECRET_MISSING", "PUBLIC_ORIGIN_MISSING", "NOT_ATTESTED", "ATTESTATION_OUTDATED",
  "NO_ACTIVE_LINE", "LINE_NOT_REGISTERED", "NO_FORWARDING_NUMBER", "COMPANY_CONCURRENCY_LIMIT", "AGENT_ON_A_CALL", "AGENT_DAILY_LIMIT",
] as const;
export type LiveCallBlocker = (typeof LIVE_CALL_BLOCKERS)[number];

export const BLOCKER_MESSAGES: Record<LiveCallBlocker, string> = {
  NO_VERIFIED_PROVIDER: "No calling provider is connected and verified for your company.",
  PROVIDER_CANNOT_DIAL: "The connected provider cannot place agents' calls in EstateOS.",
  SECRET_MISSING: "The provider credential is not available on the server.",
  PUBLIC_ORIGIN_MISSING: "EstateOS has no public HTTPS address for provider status updates (APP_ORIGIN).",
  NOT_ATTESTED: "An owner or administrator has not confirmed the provider and UAE operating arrangements.",
  ATTESTATION_OUTDATED: "The live-calling confirmation must be renewed for the current statement.",
  NO_ACTIVE_LINE: "You have no active company line assigned to you.",
  LINE_NOT_REGISTERED: "Your line has not been confirmed as registered to the company's licence.",
  NO_FORWARDING_NUMBER: "Your line has no phone number to ring you on.",
  COMPANY_CONCURRENCY_LIMIT: "Your company has reached its limit of simultaneous calls.",
  AGENT_ON_A_CALL: "You already have a call in progress.",
  AGENT_DAILY_LIMIT: "You have reached your daily limit of calls through EstateOS.",
};

export interface DialFacts {
  connection: {connectionStatus: string; capabilities: ProviderCapabilities} | null;
  secretAvailable: boolean;
  publicOrigin: string | null;
  rules: CommunicationRules;
  line: {status: string; registrationConfirmedAt: string | null; forwardToNumber: string | null} | null;
  activeCompanyCalls: number;
  agentHasActiveCall: boolean;
  agentCallsToday: number;
}

export function liveCallBlockers(facts: DialFacts): LiveCallBlocker[] {
  const blockers: LiveCallBlocker[] = [];
  if (!facts.connection || facts.connection.connectionStatus !== "VERIFIED") blockers.push("NO_VERIFIED_PROVIDER");
  else {
    if (!facts.connection.capabilities.outboundCalls) blockers.push("PROVIDER_CANNOT_DIAL");
    if (!facts.secretAvailable) blockers.push("SECRET_MISSING");
  }
  if (!facts.publicOrigin || !facts.publicOrigin.startsWith("https://")) blockers.push("PUBLIC_ORIGIN_MISSING");
  if (!facts.rules.liveCallingAttestedAt) blockers.push("NOT_ATTESTED");
  else if (facts.rules.liveCallingAttestationVersion !== LIVE_CALLING_ATTESTATION.version) blockers.push("ATTESTATION_OUTDATED");
  if (!facts.line || facts.line.status !== "ACTIVE") blockers.push("NO_ACTIVE_LINE");
  else {
    if (!facts.line.registrationConfirmedAt) blockers.push("LINE_NOT_REGISTERED");
    if (!facts.line.forwardToNumber || !E164.test(facts.line.forwardToNumber)) blockers.push("NO_FORWARDING_NUMBER");
  }
  if (facts.activeCompanyCalls >= facts.rules.maxConcurrentLiveCalls) blockers.push("COMPANY_CONCURRENCY_LIMIT");
  if (facts.agentHasActiveCall) blockers.push("AGENT_ON_A_CALL");
  if (facts.agentCallsToday >= facts.rules.maxLiveCallsPerAgentPerDay) blockers.push("AGENT_DAILY_LIMIT");
  return blockers;
}

/** Everything that stops a live call, in the order a person should fix it. */
export function describeDialRefusal(blockers: readonly LiveCallBlocker[], issues: readonly ComplianceIssue[]) {
  return [
    ...blockers.map(code => ({code, message: BLOCKER_MESSAGES[code]})),
    ...issues.map(code => ({code, message: COMPLIANCE_MESSAGES[code]})),
  ];
}
