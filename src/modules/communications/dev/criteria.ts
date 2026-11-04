/*
 * The Phase 6F acceptance criteria and the evidence that verifies each one
 * (docs/COMMUNICATION_TESTING.md). Three layers are kept apart: local
 * simulated verification, automated integration verification (real database,
 * browser and server on emulators), and real external-provider verification,
 * which stays BLOCKED until a provider is connected and approved. Passing the
 * first two never makes a feature production-ready on its own.
 */

export type Layer = "SIMULATED" | "INTEGRATION" | "REAL_PROVIDER";
export type EvidenceStatus = "PASSED" | "FAILED" | "BLOCKED" | "NOT_RUN";

/** A test reference: a suite from the runner and text the test's name contains. */
export interface EvidenceRef { suite: string; test: string }

export interface Criterion {
  id: number;
  title: string;
  /** Needs a connected, approved telephony provider (or live Claude) to be fully verified. */
  providerRequired: boolean;
  layers: Partial<Record<Exclude<Layer, "REAL_PROVIDER">, EvidenceRef[]>> & {REAL_PROVIDER: {blockedBy: string} | null};
}

const REAL_CALLING = "No verified telephony provider, public HTTPS APP_ORIGIN, UAE operating confirmation or registered company line (see docs/TELEPHONY_PROVIDERS.md#live-calling).";

export const CRITERIA: readonly Criterion[] = [
  {id: 1, title: "Calls can be logged against real Leads and Contacts", providerRequired: false, layers: {
    SIMULATED: [{suite: "unit", test: "numbers come from the record"}, {suite: "browser", test: "simulator creates fictional"}],
    INTEGRATION: [{suite: "dataconnect", test: "lets the assigned agent log a call"}, {suite: "dataconnect", test: "logs calls on contacts"}, {suite: "browser", test: "logs an answered call from the lead"}, {suite: "browser", test: "contact page shows calls"}, {suite: "browser", test: "display form"}],
    REAL_PROVIDER: null}},
  {id: 2, title: "Call records survive database/server restarts", providerRequired: false, layers: {
    INTEGRATION: [{suite: "persistence", test: ""}, {suite: "browser", test: "still there after a reload"}],
    REAL_PROVIDER: null}},
  {id: 3, title: "Unauthorized agents cannot access other agents' call records", providerRequired: false, layers: {
    INTEGRATION: [{suite: "dataconnect", test: "keeps it to members who may see the lead"}, {suite: "browser", test: "cannot read or change calls"}],
    REAL_PROVIDER: null}},
  {id: 4, title: "Provider webhooks are verified and duplicate events handled", providerRequired: true, layers: {
    SIMULATED: [{suite: "unit", test: "Twilio webhooks verify"}, {suite: "unit", test: "Retell webhooks verify"}, {suite: "unit", test: "call states only move forward"}],
    INTEGRATION: [{suite: "dataconnect", test: "records each provider event once"}, {suite: "browser", test: "Signed provider events"}, {suite: "browser", test: "Forged, unsigned"}, {suite: "browser", test: "Concurrent duplicate"}, {suite: "browser", test: "ignores replayed and late events"}],
    REAL_PROVIDER: {blockedBy: "Signatures are tested with test secrets and the official SDK helpers; no webhook from a real Twilio or Retell account has been received. " + REAL_CALLING}}},
  {id: 5, title: "Live calls are blocked without verified configuration", providerRequired: false, layers: {
    SIMULATED: [{suite: "unit", test: "live calling needs a verified provider"}],
    INTEGRATION: [{suite: "dataconnect", test: "refuse a live call"}, {suite: "browser", test: "Live calling is refused"}],
    REAL_PROVIDER: null}},
  {id: 6, title: "Recordings require appropriate consent/authorization", providerRequired: false, layers: {
    SIMULATED: [{suite: "unit", test: "recordings are recognised by their contents"}],
    INTEGRATION: [{suite: "dataconnect", test: "records consent only for answered calls"}, {suite: "dataconnect", test: "lets only the server create recordings"}, {suite: "browser", test: "With consent recorded"}, {suite: "browser", test: "cannot open recordings"}, {suite: "browser", test: "Withdrawing consent"}],
    REAL_PROVIDER: null}},
  {id: 7, title: "Claude generates accurate summaries from authorized transcripts", providerRequired: true, layers: {
    SIMULATED: [{suite: "unit", test: "quotes are checked against the source"}, {suite: "unit", test: "a budget is shown only"}, {suite: "unit", test: "flat answer maps"}],
    INTEGRATION: [{suite: "dataconnect", test: "stores summaries only from the server"}, {suite: "browser", test: "fails safely"}, {suite: "browser-live", test: "live Claude: a summary"}],
    REAL_PROVIDER: null}},
  {id: 8, title: "AI follow-up suggestions connect to Phase 6E workflows", providerRequired: false, layers: {
    SIMULATED: [{suite: "unit", test: "communication triggers"}],
    INTEGRATION: [{suite: "dataconnect", test: "workflow event per finished call"}, {suite: "dataconnect", test: "decide each suggestion once"}, {suite: "browser", test: "accepts a follow-up suggestion once"}, {suite: "browser", test: "missed-call workflow"}, {suite: "browser", test: "call.summarize"}],
    REAL_PROVIDER: null}},
  {id: 9, title: "Meeting records and approved meeting links work", providerRequired: false, layers: {
    SIMULATED: [{suite: "unit", test: "meeting links"}],
    INTEGRATION: [{suite: "dataconnect", test: "schedules meetings"}, {suite: "dataconnect", test: "completes a meeting once"}, {suite: "browser", test: "schedules a meeting"}],
    REAL_PROVIDER: null}},
  {id: 10, title: "Communication dashboards display verified statistics", providerRequired: false, layers: {
    SIMULATED: [{suite: "unit", test: "reports keep"}],
    INTEGRATION: [{suite: "dataconnect", test: "reports company-wide"}, {suite: "dataconnect", test: "dashboard follows the same rules"}, {suite: "browser", test: "dashboard counts"}, {suite: "browser", test: "Reports separate"}, {suite: "browser", test: "left out of dashboards"}],
    REAL_PROVIDER: null}},
  {id: 11, title: "Tenant isolation, browser tests and build checks pass", providerRequired: false, layers: {
    INTEGRATION: [{suite: "dataconnect", test: ""}, {suite: "browser", test: ""}, {suite: "lint", test: ""}, {suite: "typescript", test: ""}, {suite: "build", test: ""}],
    REAL_PROVIDER: null}},
];

export interface SuiteResult { id: string; status: "PASSED" | "FAILED"; startedAt: string; tests: Array<{name: string; status: "PASSED" | "FAILED"}> }

/**
 * The status of one layer from the latest runner results. An empty test text
 * means the whole suite. Missing suites are NOT_RUN; any failed match FAILED.
 */
export function layerStatus(refs: EvidenceRef[] | undefined, suites: readonly SuiteResult[]): {status: EvidenceStatus; evidence: Array<{ref: EvidenceRef; status: EvidenceStatus; matched: string[]; at: string | null}>} {
  if (!refs?.length) return {status: "NOT_RUN", evidence: []};
  const evidence = refs.map(ref => {
    const suite = suites.find(item => item.id === ref.suite);
    if (!suite) return {ref, status: "NOT_RUN" as EvidenceStatus, matched: [], at: null};
    if (!ref.test) return {ref, status: suite.status as EvidenceStatus, matched: [`whole suite (${suite.tests.length} tests)`], at: suite.startedAt};
    const matched = suite.tests.filter(test => test.name.toLowerCase().includes(ref.test.toLowerCase()));
    const status: EvidenceStatus = !matched.length ? "NOT_RUN" : matched.some(test => test.status === "FAILED") ? "FAILED" : "PASSED";
    return {ref, status, matched: matched.map(test => test.name), at: suite.startedAt};
  });
  const status: EvidenceStatus = evidence.some(item => item.status === "FAILED") ? "FAILED" : evidence.every(item => item.status === "PASSED") ? "PASSED" : "NOT_RUN";
  return {status, evidence};
}
