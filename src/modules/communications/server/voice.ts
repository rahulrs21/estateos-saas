import "server-only";

import { randomUUID } from "node:crypto";
import { z } from "zod";
import { enforceRateLimit, requestClientIp } from "@/lib/rate-limit/server";
import { modelStreamFactory, requireAiConfig } from "@/modules/ai/server/anthropic";
import { logAndMapProviderError } from "@/modules/ai/server/chat";
import { reserveQuota } from "@/modules/ai/server/store";
import { loadFacts } from "@/modules/ai/content/server/sources";
import { cleanText } from "@/modules/ai/tools/present";
import { generateStructured, type StructuredResult } from "@/modules/ai/structured";
import { getInventoryRecord, listInventory } from "@/modules/inventory/server/service";
import { mapWorkspaceDataError, WorkspaceError } from "@/modules/organizations/server/errors";
import { canonicalUuid } from "@/modules/organizations/server/identifiers";
import {
  VOICE_LIMITS, VOICE_PROMPT_VERSION, VOICE_REPLY_JSON, VOICE_SYSTEM_PROMPT, beginTurn, checkVoiceReply, endSession, finishTurn, interruptTurn, openingTurns, resolveReply,
  voiceConfigSchema, voiceFactsText, voiceListingFacts, voiceProjectFacts, voiceReplyZod, voiceTask,
  type VoiceFactSheet, type VoiceReplyOutput, type VoiceSessionState, type VoiceSettings, type VoiceTurn,
} from "../voice";
import { asMember, asServer, isAdministrator, isDuplicate, sdk, type Context } from "./data";
import { recordCommunicationAiUsage } from "./intelligence";
import { idSchema, parseInput } from "./validation";

/*
 * Voice assistant, test mode only (docs/AI_VOICE_ARCHITECTURE.md). OWNER and
 * ADMIN members configure it and type simulated calls; no phone call is
 * placed or answered. The facts come from the allowed active projects and
 * listings, read through the inventory services as the member when the test
 * starts. Each Claude reply is checked (voice.ts) before it is saved, and
 * sessions are written only by the server.
 */

const FACTS_LIMIT_CHARS = 38_000;
const TURNS_LIMIT_CHARS = 32_000;

function requireAdministrator(context: Context) {
  if (!isAdministrator(context)) throw new WorkspaceError("PERMISSION_DENIED", 403, "Only an owner or administrator can configure or test the voice assistant.");
}

/** A stored JSON list of strings (questions or record IDs); anything else reads as empty. */
const parseList = (value: string) => { try { const items = JSON.parse(value) as unknown; return Array.isArray(items) ? items.filter((item): item is string => typeof item === "string") : []; } catch { return []; } };
const parseIds = (value: string) => parseList(value).filter(item => idSchema.safeParse(item).success);

type OptionRow = {id: string; projectName?: string; listingReference?: string; title?: string; developer?: {name: string} | null};

/** Active projects and listings the member can read, offered as the assistant's sources. */
async function sourceOptions() {
  const [projects, listings] = await Promise.all([
    listInventory("projects", {projectStatus: "ACTIVE", limit: 50, offset: 0}) as Promise<unknown> as Promise<{projects: OptionRow[]}>,
    listInventory("listings", {listingStatus: "ACTIVE", limit: 50, offset: 0}) as Promise<unknown> as Promise<{propertyListings: OptionRow[]}>,
  ]);
  return {
    projects: projects.projects.map(row => ({id: canonicalUuid(row.id), label: cleanText(row.projectName, 120) ?? "Project", detail: cleanText(row.developer?.name, 120)})),
    listings: listings.propertyListings.map(row => ({id: canonicalUuid(row.id), label: cleanText(row.listingReference, 80) ?? "Listing", detail: cleanText(row.title, 120)})),
  };
}

export async function voiceAssistantView(context: Context) {
  requireAdministrator(context);
  const data = await asMember(context, "GetVoiceAssistant", (dc, options) => sdk.getVoiceAssistant(dc, {organizationId: context.organizationId}, options));
  const config = data.config ? {
    ...data.config, questions: parseList(data.config.questionsJson), projectIds: parseIds(data.config.projectIdsJson).map(canonicalUuid), listingIds: parseIds(data.config.listingIdsJson).map(canonicalUuid),
    questionsJson: undefined, projectIdsJson: undefined, listingIdsJson: undefined,
  } : null;
  return {config, sessions: data.sessions, options: await sourceOptions(), liveCallsAvailable: false as const};
}
export type VoiceAssistantView = Awaited<ReturnType<typeof voiceAssistantView>>;

/** Saves the configuration. Every allowed record must be one the member can read now. */
export async function saveVoiceAssistant(context: Context, body: unknown) {
  requireAdministrator(context);
  const input = parseInput(voiceConfigSchema, body);
  const projectIds = [...new Set(input.projectIds.map(canonicalUuid))];
  const listingIds = [...new Set(input.listingIds.map(canonicalUuid))];
  for (const [resource, ids] of [["projects", projectIds], ["listings", listingIds]] as const) {
    for (const id of ids) {
      const record = await getInventoryRecord(resource, {id}).catch(() => null);
      if (!record) throw new WorkspaceError("VALIDATION_ERROR", 400, "One of the chosen projects or listings is unavailable. Choose it again from the list.");
    }
  }
  const variables = {
    organizationId: context.organizationId, status: sdk.VoiceAssistantStatus[input.status], assistantName: input.assistantName, disclosureText: input.disclosureText, greeting: input.greeting,
    questionsJson: JSON.stringify(input.questions), handoffMessage: input.handoffMessage, projectIdsJson: JSON.stringify(projectIds), listingIdsJson: JSON.stringify(listingIds),
    maxTurns: input.maxTurns, maxSessionMinutes: input.maxSessionMinutes, maxReplyTokens: input.maxReplyTokens,
  };
  if (input.expectedRevision === 0) {
    try { await sdk.createVoiceAssistantConfig(context.request.dc, variables, context.request.options); }
    catch (error) {
      if (isDuplicate(error)) throw new WorkspaceError("CONFLICT", 409, "A colleague set up the voice assistant first. Reload and try again.");
      throw mapWorkspaceDataError(error);
    }
    return {revision: 1};
  }
  await asMember(context, "UpdateVoiceAssistantConfig", (dc, options) => sdk.updateVoiceAssistantConfig(dc, {...variables, expectedRevision: input.expectedRevision}, options));
  return {revision: input.expectedRevision + 1};
}

/** Reads the allowed records as the member; inactive or unavailable ones are left out and listed. */
async function readFactSheet(context: Context, projectIds: string[], listingIds: string[]): Promise<VoiceFactSheet> {
  const sheet: VoiceFactSheet = {readAt: new Date().toISOString(), records: [], omitted: []};
  const options = {useLeadFirstName: false, withPropertyDetail: false};
  for (const id of projectIds.slice(0, VOICE_LIMITS.projects)) {
    const project = await loadFacts(context, {projectId: id}, options).then(result => result.facts.project, () => null);
    if (project && project.status === "Active") sheet.records.push(voiceProjectFacts(`PROJECT_${sheet.records.filter(record => record.kind === "PROJECT").length + 1}`, project));
    else sheet.omitted.push(project ? `${project.name ?? "A project"} is not active` : "An allowed project is unavailable");
  }
  for (const id of listingIds.slice(0, VOICE_LIMITS.listings)) {
    const listing = await loadFacts(context, {listingIds: [id]}, options).then(result => result.facts.listings[0] ?? null, () => null);
    if (listing && listing.status === "Active") sheet.records.push(voiceListingFacts(`LISTING_${sheet.records.filter(record => record.kind === "LISTING").length + 1}`, listing));
    else sheet.omitted.push(listing ? `${listing.reference ?? "A listing"} is not active` : "An allowed listing is unavailable");
  }
  if (JSON.stringify(sheet).length > FACTS_LIMIT_CHARS) throw new WorkspaceError("VALIDATION_ERROR", 400, "The allowed projects and listings hold too many facts for one test. Choose fewer.");
  return sheet;
}

export async function startVoiceTest(context: Context) {
  requireAdministrator(context);
  const {config} = await asMember(context, "GetVoiceAssistant", (dc, options) => sdk.getVoiceAssistant(dc, {organizationId: context.organizationId}, options));
  if (!config || config.status !== "TEST_ONLY") throw new WorkspaceError("VOICE_ASSISTANT_NOT_READY", 409, "Save the voice assistant and mark it ready for testing first.");
  const sheet = await readFactSheet(context, parseIds(config.projectIdsJson).map(canonicalUuid), parseIds(config.listingIdsJson).map(canonicalUuid));
  const id = randomUUID();
  const turns = openingTurns(config, new Date().toISOString(), [randomUUID(), randomUUID()]);
  await asServer("StartVoiceTestSession", dc => sdk.startVoiceTestSession(dc, {
    organizationId: context.organizationId, id, actorUid: context.request.user.uid, configRevision: config.revision, factsJson: JSON.stringify(sheet), turnsJson: JSON.stringify(turns),
  }));
  return {id};
}

async function loadSession(context: Context, rawId: string) {
  requireAdministrator(context);
  const id = parseInput(idSchema, rawId);
  const data = await asMember(context, "GetVoiceTestSession", (dc, options) => sdk.getVoiceTestSession(dc, {organizationId: context.organizationId, id}, options));
  if (!data.session || !data.config) throw new WorkspaceError("NOT_FOUND", 404, "This test call was not found.");
  const row = data.session;
  const state: VoiceSessionState = {
    status: row.status, turns: JSON.parse(row.turnsJson) as VoiceTurn[], callerTurns: row.callerTurns, pendingTurnId: row.pendingTurnId ? canonicalUuid(row.pendingTurnId) : null,
    pendingSince: row.pendingSince ?? null, handoffReason: row.handoffReason ?? null, viewingRequest: row.viewingRequestJson ? JSON.parse(row.viewingRequestJson) : null, createdAt: row.createdAt,
  };
  const settings: VoiceSettings = {
    assistantName: data.config.assistantName, handoffMessage: data.config.handoffMessage, questions: parseList(data.config.questionsJson),
    maxTurns: data.config.maxTurns, maxSessionMinutes: data.config.maxSessionMinutes,
  };
  return {id, row, state, settings, maxReplyTokens: data.config.maxReplyTokens, sheet: JSON.parse(row.factsJson) as VoiceFactSheet, ownSession: row.createdByUid === context.request.user.uid};
}

export async function voiceTestSession(context: Context, rawId: string) {
  const session = await loadSession(context, rawId);
  const {row, state, settings, sheet} = session;
  return {
    id: session.id, status: state.status, revision: row.revision, turns: state.turns, pending: Boolean(state.pendingTurnId), handoffReason: state.handoffReason, viewingRequest: state.viewingRequest,
    callerTurns: state.callerTurns, maxTurns: settings.maxTurns, maxSessionMinutes: settings.maxSessionMinutes, questions: settings.questions,
    facts: sheet.records.map(record => ({key: record.key, label: (record.kind === "PROJECT" ? record.name : `${record.reference ?? ""} ${record.title ?? ""}`.trim()) || record.key})), omitted: sheet.omitted,
    inputTokens: row.inputTokens, outputTokens: row.outputTokens, createdAt: row.createdAt, endedAt: row.endedAt ?? null, createdBy: row.createdBy.displayName, canContinue: session.ownSession && state.status === "ACTIVE",
  };
}
export type VoiceTestSessionView = Awaited<ReturnType<typeof voiceTestSession>>;

async function save(context: Context, id: string, expectedRevision: number, next: VoiceSessionState, tokens = {input: 0, output: 0}) {
  await asServer("SaveVoiceTestSession", dc => sdk.saveVoiceTestSession(dc, {
    organizationId: context.organizationId, id, actorUid: context.request.user.uid, expectedRevision, status: sdk.VoiceTestSessionStatus[next.status],
    turnsJson: JSON.stringify(next.turns), callerTurns: next.callerTurns, pendingTurnId: next.pendingTurnId, pendingSince: next.pendingSince, handoffReason: next.handoffReason,
    viewingRequestJson: next.viewingRequest ? JSON.stringify(next.viewingRequest) : null, endedAt: next.status === "ACTIVE" ? null : new Date().toISOString(),
    inputTokens: tokens.input, outputTokens: tokens.output,
  }));
}

function requireOwnSession(session: {ownSession: boolean}) {
  if (!session.ownSession) throw new WorkspaceError("PERMISSION_DENIED", 403, "Only the person who started this test call can continue it.");
}

const turnSchema = z.strictObject({utterance: z.string().trim().min(1).max(VOICE_LIMITS.utterance), turnId: idSchema, expectedRevision: z.number().int().min(1)});
const REPLY_MESSAGES = {
  refused: "Claude declined to answer.", incomplete: "Claude's reply was cut off.", invalid: "Claude replied in an unexpected format.", cancelled: "The reply was interrupted.",
};

async function enforceRate(request: Request, context: Context, perMinute: number) {
  await enforceRateLimit([
    {rule: {scope: "ai.voice.member", limit: perMinute, windowSeconds: 60}, subject: context.membership.id},
    {rule: {scope: "ai.voice.ip", limit: perMinute * 4, windowSeconds: 60}, subject: requestClientIp(request) ?? ""},
  ], "You are sending test turns too quickly. Wait a moment and try again.");
}

/**
 * One caller turn. The caller's words are saved first with the reply marked
 * pending; Claude's reply is saved only if the turn was not interrupted in the
 * meantime (compare-and-set). Claude failures and replies that fail the checks
 * become a handoff to a person.
 */
export async function voiceTurn(request: Request, context: Context, rawId: string, body: unknown) {
  const input = parseInput(turnSchema, body);
  const session = await loadSession(context, rawId);
  requireOwnSession(session);
  if (session.row.revision !== input.expectedRevision) throw new WorkspaceError("CONFLICT", 409, "This test call changed. Reload it.");
  const turnId = canonicalUuid(input.turnId);
  const replyId = randomUUID();
  const now = new Date().toISOString();
  // A long transcript ends the test like the turn limit, before the stored text grows too large.
  const settings = JSON.stringify(session.state.turns).length > TURNS_LIMIT_CHARS ? {...session.settings, maxTurns: 0} : session.settings;
  const plan = beginTurn(session.state, {turnId, replyId, utterance: input.utterance, now}, settings);
  if (plan.kind === "BLOCKED") throw new WorkspaceError(plan.code === "REPLY_PENDING" ? "CONFLICT" : "VOICE_TEST_ENDED", 409, plan.message);
  if (plan.kind === "FINAL") {
    await save(context, session.id, session.row.revision, plan.next);
    return {outcome: "SAVED" as const, claude: false};
  }

  const config = requireAiConfig();
  await enforceRate(request, context, config.requestsPerMinutePerMember);
  await save(context, session.id, session.row.revision, plan.next);

  const reservation = await reserveQuota(context, config);
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(new WorkspaceError("AI_TIMEOUT", 504, "Claude took too long to respond.")), config.requestTimeoutMs + 5_000);
  let result: StructuredResult<VoiceReplyOutput>;
  try {
    result = await generateStructured({
      config, maxOutputTokens: Math.min(config.maxOutputTokens, session.maxReplyTokens), system: VOICE_SYSTEM_PROMPT, factsText: voiceFactsText(session.sheet),
      instructionsText: voiceTask({assistantName: session.settings.assistantName, questions: session.settings.questions, turns: plan.next.turns.slice(0, -1), utterance: input.utterance}),
      jsonSchema: VOICE_REPLY_JSON, zod: voiceReplyZod, createStream: modelStreamFactory(config),
      // The tester's Interrupt (or closing the page) aborts the request, which stops Claude.
      signal: AbortSignal.any([controller.signal, request.signal]), mapError: logAndMapProviderError, messages: REPLY_MESSAGES,
    });
  } finally { clearTimeout(timeout); }
  if (result.status !== "SUCCEEDED" && result.usage.modelRequests === 0) await reservation.release();
  await recordCommunicationAiUsage(context, config, {result: result as StructuredResult<unknown>, durationMs: Date.now() - startedAt, feature: "VOICE_ASSISTANT", contentType: "VOICE_TEST_TURN", promptVersion: VOICE_PROMPT_VERSION});
  const tokens = {input: result.usage.inputTokens, output: result.usage.outputTokens};

  const output = result.status === "SUCCEEDED" ? result.output : null;
  const allowedText = [session.settings.assistantName, session.settings.handoffMessage, ...session.settings.questions,
    ...plan.next.turns.filter(turn => turn.role === "CALLER" || turn.kind === "DISCLOSURE" || turn.kind === "GREETING").map(turn => turn.text)].join("\n");
  const problems = output ? checkVoiceReply(output, {sheet: session.sheet, allowedText}) : [];
  const resolved = resolveReply(output, problems, {replyId, now: new Date().toISOString(), handoffMessage: session.settings.handoffMessage});
  console.info(JSON.stringify({event: "ai.voice_test_turn", status: result.status, errorCode: result.error?.code ?? null, checks: problems, outcome: resolved.status, durationMs: Date.now() - startedAt}));

  // Re-read: the turn may have been interrupted while Claude was answering.
  const current = await loadSession(context, session.id);
  const interrupted = request.signal.aborted || result.status === "CANCELLED";
  const next = interrupted ? interruptTurn(current.state, turnId, {markerId: randomUUID(), now: new Date().toISOString()}) : finishTurn(current.state, turnId, resolved);
  if (!next) return {outcome: "INTERRUPTED" as const, claude: true};
  try { await save(context, session.id, current.row.revision, next, tokens); }
  catch (error) { if (error instanceof WorkspaceError && error.code === "CONFLICT") return {outcome: "INTERRUPTED" as const, claude: true}; throw error; }
  return {outcome: interrupted ? "INTERRUPTED" as const : "SAVED" as const, claude: true, error: output ? null : result.error?.message ?? null};
}

/** The caller talked over the assistant: the pending reply is discarded. */
export async function interruptVoiceTurn(context: Context, rawId: string, body: unknown) {
  const {turnId} = parseInput(z.strictObject({turnId: idSchema}), body);
  const session = await loadSession(context, rawId);
  requireOwnSession(session);
  const next = interruptTurn(session.state, canonicalUuid(turnId), {markerId: randomUUID(), now: new Date().toISOString()});
  if (!next) throw new WorkspaceError("CONFLICT", 409, "There is no reply to interrupt: it was already given or discarded.");
  await save(context, session.id, session.row.revision, next);
  return {interrupted: true};
}

export async function endVoiceTest(context: Context, rawId: string) {
  const session = await loadSession(context, rawId);
  requireOwnSession(session);
  const next = endSession(session.state, {markerId: randomUUID(), now: new Date().toISOString()});
  if (!next) throw new WorkspaceError("VOICE_TEST_ENDED", 409, "This test call has already ended.");
  await save(context, session.id, session.row.revision, next);
  return {status: next.status};
}
