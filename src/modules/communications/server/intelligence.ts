import "server-only";

import { randomUUID } from "node:crypto";
import * as sql from "@dataconnect/admin-generated";
import { z } from "zod";
import { getFirebaseAdminStorageBucket } from "@/lib/firebase/admin";
import { stableUuid } from "@/modules/automations/ids";
import { executeWorkspaceOperation } from "@/lib/firebase/dataconnect";
import { enforceRateLimit, requestClientIp } from "@/lib/rate-limit/server";
import { estimateCostUsd, pricingFor, type AiConfig } from "@/modules/ai/config";
import { modelStreamFactory, requireAiConfig } from "@/modules/ai/server/anthropic";
import { logAndMapProviderError } from "@/modules/ai/server/chat";
import { reserveQuota } from "@/modules/ai/server/store";
import { generateStructured, type StructuredResult } from "@/modules/ai/structured";
import { WorkspaceError } from "@/modules/organizations/server/errors";
import { canonicalUuid } from "@/modules/organizations/server/identifiers";
import {
  CALL_SUMMARY_JSON, CALL_SUMMARY_PROMPT_VERSION, CALL_SUMMARY_SYSTEM_PROMPT, SUGGESTION_KINDS, callSummaryTask, callSummaryZod, checkSummary, sourceLines, sourceText,
  type CallSummaryOutput, type CheckedSummary, type SuggestionKind,
} from "../intelligence";
import type { TranscriptSegment } from "../media";
import { asMember, asServer, isAdministrator, sdk, type Context } from "./data";
import { idSchema, parseInput } from "./validation";

/*
 * Claude call summaries (docs/AI_CALL_INTELLIGENCE.md). Reuses the Anthropic
 * client, structured outputs, AI allowances and usage records of Phases
 * 6A-6C (feature CALL_AI). Needs the company's Claude-analysis switch, an
 * answered call, and the call's agent or an OWNER or ADMIN. The summary is a
 * draft for the agent; suggestions run existing operations only when a person
 * accepts them.
 */

const MAX_OUTPUT_TOKENS = 6000;
const SOURCE_LIMIT_CHARS = 120_000;

async function enforceRate(request: Request, context: Context, config: AiConfig) {
  await enforceRateLimit([
    {rule: {scope: "ai.calls.member", limit: config.requestsPerMinutePerMember, windowSeconds: 60}, subject: context.membership.id},
    {rule: {scope: "ai.calls.ip", limit: config.requestsPerMinutePerMember * 4, windowSeconds: 60}, subject: requestClientIp(request) ?? ""},
    {rule: {scope: "ai.calls.company", limit: config.requestsPerMinutePerOrganization, windowSeconds: 60}, subject: context.organizationId},
  ], "You are using call summaries too quickly. Wait a moment and try again.");
}

async function recordUsage(context: Context, config: AiConfig, input: {result: StructuredResult<unknown>; durationMs: number}) {
  const {result} = input;
  const model = result.servedModel ?? config.model;
  const estimatedCostUsd = estimateCostUsd(model === config.model ? config.pricing : pricingFor(model), result.usage);
  try {
    await executeWorkspaceOperation(() => sql.recordAiUsage(context.request.dc, {
      organizationId: context.organizationId, id: randomUUID(), userUid: context.request.user.uid, conversationId: null, model: model.slice(0, 80), promptVersion: CALL_SUMMARY_PROMPT_VERSION,
      status: sql.AiRequestStatus[result.status], errorCode: result.status === "SUCCEEDED" ? null : result.error?.code.slice(0, 40) ?? null,
      inputTokens: result.usage.inputTokens, outputTokens: result.usage.outputTokens, cacheReadInputTokens: result.usage.cacheReadInputTokens, cacheCreationInputTokens: result.usage.cacheCreationInputTokens,
      estimatedCostUsd, modelRequests: result.usage.modelRequests, toolCalls: 0, durationMs: Math.min(input.durationMs, 2_147_483_647), feature: "CALL_AI", contentType: "CALL_SUMMARY",
    }), "RecordAiUsage"); // server-only operation: the company and user come from the verified context
  } catch (error) {
    console.error(JSON.stringify({event: "ai.usage.record_failed", feature: "CALL_AI", model, code: error instanceof WorkspaceError ? error.code : "ERROR"}));
  }
  return {model, estimatedCostUsd};
}

const SUMMARY_MESSAGES = {
  refused: "Claude declined to summarise this call.",
  incomplete: "Claude's summary was cut off. Try again.",
  invalid: "Claude returned a summary in an unexpected format. Try again.",
  cancelled: "The summary was stopped.",
};

export async function callSummaries(context: Context, rawCallId: string) {
  const callId = parseInput(idSchema, rawCallId);
  const data = await asMember(context, "ListCallSummaries", (dc, options) => sdk.listCallSummaries(dc, {organizationId: context.organizationId, callId}, options));
  if (!data.call) throw new WorkspaceError("NOT_FOUND", 404, "This call was not found.");
  const canEdit = isAdministrator(context) || data.call.agentMembershipId === context.membership.id;
  const enabled = Boolean(data.settings?.aiAnalysisEnabled);
  return {
    aiAnalysisEnabled: enabled, canGenerate: canEdit && enabled && data.call.callStatus === "COMPLETED", canEdit,
    hasNotes: Boolean(data.call.notes?.trim()), leadId: data.call.leadId ?? null, transcripts: data.transcripts,
    summaries: data.summaries.map(row => ({...row, summary: JSON.parse(row.summaryJson) as CheckedSummary, summaryJson: undefined})),
  };
}
export type CallSummariesView = Awaited<ReturnType<typeof callSummaries>>;

const generateSchema = z.strictObject({source: z.enum(["TRANSCRIPT", "NOTES"]), transcriptId: idSchema.optional()});

/** Asks Claude for a summary, checks every quote against the source, and stores it as a draft. */
export async function generateCallSummary(request: Request, context: Context, rawCallId: string, body: unknown) {
  const callId = parseInput(idSchema, rawCallId);
  const input = parseInput(generateSchema, body);
  const view = await callSummaries(context, callId);
  if (!view.aiAnalysisEnabled) throw new WorkspaceError("CALL_AI_NOT_AVAILABLE", 409, "Claude analysis of calls is not enabled for your company. An owner or administrator can enable it in Calling settings.");
  if (!view.canEdit) throw new WorkspaceError("PERMISSION_DENIED", 403, "Only the call's agent, or an owner or administrator, can summarise this call.");
  if (!view.canGenerate) throw new WorkspaceError("CALL_AI_NOT_AVAILABLE", 409, "Only answered calls can be summarised.");
  const config = requireAiConfig();
  await enforceRate(request, context, config);

  // The source, read as the member and minimized before it leaves EstateOS.
  let lines;
  let transcriptId: string | null = null;
  if (input.source === "TRANSCRIPT") {
    transcriptId = input.transcriptId ?? (view.transcripts[0] ? canonicalUuid(view.transcripts[0].id) : null);
    if (!transcriptId || !view.transcripts.some(item => canonicalUuid(item.id) === transcriptId)) throw new WorkspaceError("VALIDATION_ERROR", 400, "This call has no transcript to summarise. Use the agent's notes instead.");
    const {transcript} = await asMember(context, "GetCallTranscriptFile", (dc, options) => sdk.getCallTranscriptFile(dc, {organizationId: context.organizationId, id: transcriptId!}, options));
    if (!transcript) throw new WorkspaceError("NOT_FOUND", 404, "This transcript was not found.");
    const [bytes] = await getFirebaseAdminStorageBucket().file(transcript.transcriptReference).download();
    lines = sourceLines({kind: "TRANSCRIPT", segments: (JSON.parse(bytes.toString("utf8")) as {segments: TranscriptSegment[]}).segments});
  } else {
    const {call} = await asMember(context, "GetCallRecord", (dc, options) => sdk.getCallRecord(dc, {organizationId: context.organizationId, id: callId}, options));
    if (!call?.notes?.trim()) throw new WorkspaceError("VALIDATION_ERROR", 400, "Add notes to the call before summarising them.");
    lines = sourceLines({kind: "NOTES", notes: call.notes});
  }
  const facts = sourceText(input.source, lines);
  if (facts.length > SOURCE_LIMIT_CHARS) throw new WorkspaceError("VALIDATION_ERROR", 400, "This call is too long to summarise in one request.");

  const reservation = await reserveQuota(context, config);
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(new WorkspaceError("AI_TIMEOUT", 504, "Claude took too long to respond. Try again.")), config.requestTimeoutMs + 5_000);
  let result: StructuredResult<CallSummaryOutput>;
  try {
    result = await generateStructured({
      config, maxOutputTokens: Math.min(config.maxOutputTokens, MAX_OUTPUT_TOKENS), system: CALL_SUMMARY_SYSTEM_PROMPT, factsText: facts, instructionsText: callSummaryTask(input.source),
      jsonSchema: CALL_SUMMARY_JSON, zod: callSummaryZod, createStream: modelStreamFactory(config), signal: controller.signal, mapError: logAndMapProviderError, messages: SUMMARY_MESSAGES,
    });
  } finally { clearTimeout(timeout); }
  if (result.status !== "SUCCEEDED" && result.usage.modelRequests === 0) await reservation.release();
  const usage = await recordUsage(context, config, {result: result as StructuredResult<unknown>, durationMs: Date.now() - startedAt});
  console.info(JSON.stringify({event: "ai.call_summary", status: result.status, errorCode: result.error?.code ?? null, model: usage.model, inputTokens: result.usage.inputTokens, outputTokens: result.usage.outputTokens, durationMs: Date.now() - startedAt}));
  if (result.status !== "SUCCEEDED" || !result.output) throw result.error ?? new WorkspaceError("AI_UNAVAILABLE", 503, "Claude could not summarise this call. Try again.");

  const checked = checkSummary(result.output, lines);
  const id = randomUUID();
  await asServer("CreateCallAiSummary", dc => sdk.createCallAiSummary(dc, {
    organizationId: context.organizationId, id, callId, actorUid: context.request.user.uid, sourceKind: input.source, hasTranscript: Boolean(transcriptId), transcriptId,
    summaryJson: JSON.stringify(checked), overallConfidence: checked.overallConfidence, unverifiedCount: checked.unverifiedCount, model: usage.model.slice(0, 80), promptVersion: CALL_SUMMARY_PROMPT_VERSION,
  }));
  for (const [index, entry] of checked.suggestions.entries()) {
    await asServer("CreateCallAiSuggestion", dc => sdk.createCallAiSuggestion(dc, {organizationId: context.organizationId, id: stableUuid("call-suggestion", id, index), summaryId: id, callId,
      kind: entry.kind, title: entry.title.slice(0, 120), detail: entry.text.slice(0, 400), basis: entry.basis, confidence: entry.confidence, verified: entry.verified}));
  }
  return {id, unverifiedCount: checked.unverifiedCount};
}

export async function reviewCallSummary(context: Context, rawId: string, body: unknown) {
  const id = parseInput(idSchema, rawId);
  const {status} = parseInput(z.strictObject({status: z.enum(["REVIEWED", "DISMISSED"])}), body);
  await asMember(context, "ReviewCallAiSummary", (dc, options) => sdk.reviewCallAiSummary(dc, {organizationId: context.organizationId, id, status: sdk.CallSummaryStatus[status]}, options));
  return {id, status};
}

const FOLLOW_UP_KINDS: readonly SuggestionKind[] = ["FOLLOW_UP", "CLARIFY_BUDGET", "SHARE_PAYMENT_PLAN", "ALTERNATIVE_PROPERTY"];
const decideSchema = z.strictObject({
  action: z.enum(["ACCEPT", "DISMISS"]),
  followUpAt: z.iso.datetime({offset: true}).optional(),
  title: z.string().trim().min(1).max(500).optional(),
});

/**
 * Accepting a suggestion is the member's own action through existing operations:
 * a follow-up is scheduled on the lead (FOLLOW_UP and similar), or the page sends
 * the member to Content Studio or the viewing form to finish it themselves.
 */
export async function decideSuggestion(context: Context, rawId: string, body: unknown) {
  const id = parseInput(idSchema, rawId);
  const input = parseInput(decideSchema, body);
  const {suggestion} = await asMember(context, "GetCallAiSuggestion", (dc, options) => sdk.getCallAiSuggestion(dc, {organizationId: context.organizationId, id}, options));
  if (!suggestion || suggestion.status !== "PENDING") throw new WorkspaceError("CONFLICT", 409, "This suggestion was already decided. Reload the call.");
  const kind = suggestion.kind as SuggestionKind;
  if (!SUGGESTION_KINDS.includes(kind)) throw new WorkspaceError("VALIDATION_ERROR", 400, "Unknown suggestion.");
  const decide = (status: "ACCEPTED" | "DISMISSED", resultType: string | null = null, resultId: string | null = null) =>
    asMember(context, "DecideCallAiSuggestion", (dc, options) => sdk.decideCallAiSuggestion(dc, {organizationId: context.organizationId, id, status: sdk.CallSuggestionStatus[status], resultType, resultId}, options));
  if (input.action === "DISMISS") { await decide("DISMISSED"); return {id, status: "DISMISSED" as const, next: null}; }

  const leadId = suggestion.call.leadId ?? null;
  if (FOLLOW_UP_KINDS.includes(kind)) {
    if (!leadId) throw new WorkspaceError("VALIDATION_ERROR", 400, "Follow-ups are scheduled on leads; this call has no lead.");
    if (!input.followUpAt) throw new WorkspaceError("VALIDATION_ERROR", 400, "Choose when to follow up.");
    const due = Date.parse(input.followUpAt);
    if (due <= Date.now() || due > Date.now() + 365 * 86_400_000) throw new WorkspaceError("VALIDATION_ERROR", 400, "Choose a follow-up time in the future, within the next year.");
    // Claim the suggestion first so a repeated click cannot schedule twice, then schedule as the member.
    await decide("ACCEPTED", "FOLLOW_UP", null);
    const scheduled = await asMember(context, "ScheduleLeadFollowUp", (dc, options) => sdk.scheduleLeadFollowUp(dc, {
      organizationId: context.organizationId, leadId, followUpAt: new Date(due).toISOString(), followUpNote: null, title: (input.title ?? suggestion.title).slice(0, 500), replaceExisting: false,
    }, options));
    return {id, status: "ACCEPTED" as const, next: {type: "FOLLOW_UP" as const, followUpId: scheduled.followUp.id, leadId}};
  }
  if (kind === "PROPOSAL_DRAFT") {
    await decide("ACCEPTED", "CONTENT_STUDIO");
    return {id, status: "ACCEPTED" as const, next: {type: "CONTENT_STUDIO" as const, leadId}};
  }
  await decide("ACCEPTED", "VIEWING_FORM");
  return {id, status: "ACCEPTED" as const, next: {type: "VIEWING_FORM" as const, leadId}};
}
