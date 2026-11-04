import "server-only";

import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { getFirebaseAdminStorageBucket } from "@/lib/firebase/admin";
import { createLead } from "@/modules/leads/server/service";
import { WorkspaceError } from "@/modules/organizations/server/errors";
import { canonicalUuid } from "@/modules/organizations/server/identifiers";
import { statusChange, transition } from "../call-state";
import { CRITERIA, layerStatus, type SuiteResult } from "../dev/criteria";
import { devToolsEnabled } from "../dev/guard";
import { SCENARIOS, SCENARIO_KEYS, fictionalNumber } from "../dev/scenarios";
import { CALL_DIRECTIONS, CALL_OUTCOMES, CALL_STATUSES, CALL_TYPES, type CallDirection, type CallStatus } from "../model";
import { asServer, isAdministrator, sdk, type Context } from "./data";
import { idSchema, parseInput } from "./validation";

/*
 * Developer communication simulator (docs/COMMUNICATION_TESTING.md).
 * Available only when devToolsEnabled() (never in production) and only to
 * OWNER and ADMIN members; the database re-checks the role and that every
 * simulated call is on a lead the simulator registered. Nothing is dialled and
 * no provider connection is used or pretended: simulated calls apply the same
 * state machine (transition), status rule (statusChange) and compare-and-set
 * write as provider webhooks, and their workflow events are marked SIMULATOR.
 */

export const SIMULATOR_LEAD_SOURCE = "EstateOS simulator";

/** Not found (not "forbidden") when developer tools are off, so the feature is invisible. */
export function requireSimulator(context: Context | null) {
  if (!devToolsEnabled()) throw new WorkspaceError("NOT_FOUND", 404, "Not found.");
  if (context && !isAdministrator(context)) throw new WorkspaceError("PERMISSION_DENIED", 403, "Only owners and administrators can use the communication simulator.");
}

const actor = (context: Context) => context.request.user.uid;

/** The latest verification results written by scripts/test-communications-verify.mjs, if any. */
async function latestResults() {
  try {
    const text = await readFile(join(process.cwd(), ".tmp", "test-results", "communications.json"), "utf8");
    return JSON.parse(text) as {runAt: string; environment: Record<string, unknown>; suites: Array<SuiteResult & {label: string; layer: string; command: string; live: boolean; passed: number; failed: number; durationMs: number}>};
  } catch { return null; }
}

export async function simulatorState(context: Context) {
  requireSimulator(context);
  const data = await asServer("CommunicationSimulationState", dc => sdk.communicationSimulationState(dc, {organizationId: context.organizationId, actorUid: actor(context)}));
  const results = await latestResults();
  const suites = results?.suites ?? [];
  return {
    leads: data.records.map(row => ({registryId: canonicalUuid(row.id), leadId: canonicalUuid(row.leadId), label: row.label, name: row.lead.fullName, phone: row.lead.phone, contactId: row.lead.contactId ? canonicalUuid(row.lead.contactId) : null, createdAt: row.createdAt})),
    calls: data.calls.map(call => ({...call, id: canonicalUuid(call.id), leadId: call.leadId ? canonicalUuid(call.leadId) : null})),
    scenarios: SCENARIO_KEYS.map(key => ({key, label: SCENARIOS[key].label, steps: SCENARIOS[key].steps, answered: SCENARIOS[key].answered})),
    results: results ? {runAt: results.runAt, environment: results.environment, suites: suites.map(({tests, ...suite}) => ({...suite, tests: tests.length}))} : null,
    criteria: CRITERIA.map(criterion => ({
      id: criterion.id, title: criterion.title, providerRequired: criterion.providerRequired,
      simulated: layerStatus(criterion.layers.SIMULATED, suites), integration: layerStatus(criterion.layers.INTEGRATION, suites),
      realProvider: criterion.layers.REAL_PROVIDER ? {status: "BLOCKED" as const, reason: criterion.layers.REAL_PROVIDER.blockedBy} : {status: "NOT_REQUIRED" as const, reason: null},
    })),
  };
}
export type SimulatorView = Awaited<ReturnType<typeof simulatorState>>;

/** A fictional lead through the normal lead service (same validation and records), registered as simulator-owned. */
export async function createFictionalLead(context: Context) {
  requireSimulator(context);
  const tag = randomUUID().slice(0, 4).toUpperCase();
  const created = await createLead({fullName: `[SIM] Test customer ${tag}`, phone: fictionalNumber(Number.parseInt(tag, 16)), source: SIMULATOR_LEAD_SOURCE}, context.organizationId) as {lead?: {id: string}};
  if (!created.lead?.id) throw new WorkspaceError("CONFLICT", 409, "The fictional lead could not be created.");
  const leadId = canonicalUuid(created.lead.id);
  await asServer("RegisterSimulationLead", dc => sdk.registerSimulationLead(dc, {organizationId: context.organizationId, id: randomUUID(), actorUid: actor(context), leadId, label: `Simulator lead ${tag}`}));
  return {leadId};
}

const simulateSchema = z.strictObject({
  leadId: idSchema,
  direction: z.enum(CALL_DIRECTIONS),
  callType: z.enum(CALL_TYPES).default("FOLLOW_UP"),
  scenario: z.enum(SCENARIO_KEYS as [keyof typeof SCENARIOS, ...Array<keyof typeof SCENARIOS>]),
  durationSeconds: z.number().int().min(0).max(14_400).default(120),
  outcome: z.enum(CALL_OUTCOMES).nullable().default(null),
});

type SimCall = {id: string; direction: CallDirection; startedAt: string; answeredAt: string | null; callStatus: CallStatus};

/** One status event, decided and written exactly as a provider event would be. Returns the decision. */
async function applyEvent(context: Context, call: SimCall, incoming: CallStatus, at: string, durationSeconds: number | null, outcome: string | null) {
  const decision = transition(call.callStatus, incoming);
  if (!decision.apply) return {status: incoming, result: decision.reason};
  const change = statusChange(call, incoming, at, durationSeconds);
  try {
    await asServer("ApplySimulatedCallStatus", dc => sdk.applySimulatedCallStatus(dc, {
      organizationId: context.organizationId, id: call.id, actorUid: actor(context), expectedStatus: sdk.CallStatus[call.callStatus], callStatus: sdk.CallStatus[incoming],
      answeredAt: change.answeredAt, endedAt: change.endedAt, durationSeconds: change.durationSeconds,
      outcome: incoming === "COMPLETED" && outcome ? sdk.CallOutcome[outcome as keyof typeof sdk.CallOutcome] : null,
      emitFinal: change.trigger !== null, finalTrigger: change.trigger ?? "call.completed",
    }));
  } catch (error) {
    if (error instanceof WorkspaceError && error.code === "CONFLICT") return {status: incoming, result: "CHANGED_CONCURRENTLY" as const};
    throw error;
  }
  call.callStatus = incoming;
  if (change.answeredAt) call.answeredAt = change.answeredAt;
  return {status: incoming, result: "APPLIED" as const, trigger: change.trigger};
}

/** Creates a simulated call on a registered fictional lead and plays the scenario's events in order. */
export async function simulateCall(context: Context, body: unknown) {
  requireSimulator(context);
  const input = parseInput(simulateSchema, body);
  const scenario = SCENARIOS[input.scenario];
  if (input.outcome && !scenario.answered) throw new WorkspaceError("VALIDATION_ERROR", 400, "An outcome can only be recorded for an answered call.");
  const id = randomUUID();
  const started = Date.now() - (scenario.answered ? input.durationSeconds * 1000 + 15_000 : 30_000);
  const startedAt = new Date(started).toISOString();
  await asServer("CreateSimulatedCall", dc => sdk.createSimulatedCall(dc, {
    organizationId: context.organizationId, id, actorUid: actor(context), leadId: input.leadId, direction: sdk.CallDirection[input.direction], callType: sdk.CallType[input.callType],
    counterpartyNumber: null, startedAt,
  }));
  const call: SimCall = {id, direction: input.direction, startedAt, answeredAt: null, callStatus: "INITIATED"};
  const log: Array<{status: CallStatus; result: string; trigger?: string | null}> = [{status: "INITIATED", result: "CREATED", trigger: "call.started"}];
  let at = started;
  for (const step of scenario.steps) {
    at += step === "COMPLETED" || (step === "FAILED" && scenario.answered) ? input.durationSeconds * 1000 : 5_000;
    log.push(await applyEvent(context, call, step, new Date(Math.min(at, Date.now())).toISOString(), step === "COMPLETED" ? input.durationSeconds : null, input.outcome));
  }
  return {callId: id, log};
}

const eventSchema = z.strictObject({status: z.enum(CALL_STATUSES), durationSeconds: z.number().int().min(0).max(14_400).optional()});

/** A single event for an existing simulated call (to replay duplicates or send events out of order). */
export async function simulateEvent(context: Context, rawId: string, body: unknown) {
  requireSimulator(context);
  const id = parseInput(idSchema, rawId);
  const input = parseInput(eventSchema, body);
  const {calls} = await asServer("CommunicationSimulationState", dc => sdk.communicationSimulationState(dc, {organizationId: context.organizationId, actorUid: actor(context)}));
  const row = calls.find(call => canonicalUuid(call.id) === id);
  if (!row) throw new WorkspaceError("NOT_FOUND", 404, "This simulated call was not found.");
  const call: SimCall = {id, direction: row.direction as CallDirection, startedAt: row.startedAt, answeredAt: row.answeredAt ?? null, callStatus: row.callStatus as CallStatus};
  return applyEvent(context, call, input.status, new Date().toISOString(), input.durationSeconds ?? null, null);
}

/** Removes simulated calls (and their files), meetings on simulator leads, and archives the simulator's leads. */
export async function resetSimulation(context: Context) {
  requireSimulator(context);
  const files = await asServer("SimulatedCallFiles", dc => sdk.simulatedCallFiles(dc, {organizationId: context.organizationId, actorUid: actor(context)}));
  const bucket = getFirebaseAdminStorageBucket();
  const paths = [...files.recordings.map(row => row.storagePath), ...files.transcripts.map(row => row.transcriptReference)]
    .filter(path => path.startsWith(`organizations/${context.organizationId}/`));
  for (const path of paths) await bucket.file(path).delete({ignoreNotFound: true});
  const result = await asServer("ResetCommunicationSimulation", dc => sdk.resetCommunicationSimulation(dc, {organizationId: context.organizationId, actorUid: actor(context)}));
  return {calls: result.calls, meetings: result.meetings, leadsArchived: result.leads, filesRemoved: paths.length};
}
