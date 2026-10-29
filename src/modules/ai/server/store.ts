import "server-only";

import * as sql from "@dataconnect/admin-generated";
import { executeWorkspaceOperation } from "@/lib/firebase/dataconnect";
import type { requireActiveOrganizationRequest } from "@/modules/organizations/server/context";
import { WorkspaceError } from "@/modules/organizations/server/errors";
import { canonicalUuid } from "@/modules/organizations/server/identifiers";
import { estimateCostUsd, pricingFor, type AiConfig } from "../config";
import type { HistoryMessage, TurnResult } from "../loop";
import { AI_PROMPT_VERSION } from "../prompt";
import { conversationTitle, escapeLikeSearch, usagePeriodKey, userQuotaKey } from "../policy";

type Context = Awaited<ReturnType<typeof requireActiveOrganizationRequest>>;

/*
 * Member reads and deletes run with the verified session identity, so the
 * stored operations re-check membership and ownership. Writes of completed
 * exchanges, usage and quota counters are NO_ACCESS operations run with the
 * server's Admin identity (no impersonation) after the caller has verified
 * the session and membership; client SDKs cannot call them.
 */

export async function listConversations(context: Context, input: {search?: string; limit: number; offset: number}) {
  const {request, organizationId} = context;
  const data = await executeWorkspaceOperation(() => sql.listMyAiConversations(request.dc, {
    organizationId, search: escapeLikeSearch(input.search), limit: input.limit, offset: input.offset,
  }, request.options), "ListMyAiConversations");
  const total = data.total[0]?.count ?? 0;
  return {
    conversations: data.conversations.map(row => ({...row, id: canonicalUuid(row.id)})),
    total, limit: input.limit, offset: input.offset, hasNext: input.offset + input.limit < total,
  };
}

export async function getConversation(context: Context, conversationId: string, limit = 50) {
  const {request, organizationId} = context;
  const data = await executeWorkspaceOperation(() => sql.getMyAiConversation(request.dc, {organizationId, conversationId, limit}, request.options), "GetMyAiConversation");
  if (!data.conversation) throw new WorkspaceError("NOT_FOUND", 404, "This conversation was not found.");
  return {
    conversation: {...data.conversation, id: canonicalUuid(data.conversation.id)},
    messages: [...data.messages].reverse().map(row => ({id: canonicalUuid(row.id), sequence: row.sequence, role: row.role, content: row.content, createdAt: row.createdAt})),
  };
}

export function toHistory(messages: Array<{role: string; content: string}>, historyMessages: number, maxChars = 60_000): HistoryMessage[] {
  const recent = messages.slice(-historyMessages);
  const kept: HistoryMessage[] = [];
  let chars = 0;
  for (let index = recent.length - 1; index >= 0; index -= 1) {
    chars += recent[index].content.length;
    if (chars > maxChars) break;
    kept.unshift({role: recent[index].role === "USER" ? "USER" : "ASSISTANT", content: recent[index].content});
  }
  return kept;
}

export async function deleteConversation(context: Context, conversationId: string) {
  const {request, organizationId} = context;
  await executeWorkspaceOperation(() => sql.deleteMyAiConversation(request.dc, {organizationId, conversationId}, request.options), "DeleteMyAiConversation");
  return {id: conversationId, deleted: true};
}

/** Applies AI_CONVERSATION_RETENTION_DAYS to the caller's own history; best effort. */
export async function purgeExpiredConversations(context: Context, retentionDays: number) {
  if (retentionDays <= 0) return;
  const {request, organizationId} = context;
  const before = new Date(Date.now() - retentionDays * 86_400_000).toISOString();
  try {
    await executeWorkspaceOperation(() => sql.purgeMyExpiredAiConversations(request.dc, {organizationId, before}, request.options), "PurgeMyExpiredAiConversations");
  } catch (error) {
    console.warn(JSON.stringify({event: "ai.retention.purge_failed", code: error instanceof WorkspaceError ? error.code : "ERROR"}));
  }
}

export async function saveExchange(context: Context, input: {conversationId: string; isNew: boolean; expectedMessageCount: number; userContent: string; assistantContent: string}) {
  const {request, organizationId} = context;
  const ownerUid = request.user.uid;
  if (input.isNew) {
    await executeWorkspaceOperation(() => sql.createAiConversationWithExchange(request.dc, {
      organizationId, conversationId: input.conversationId, ownerUid, title: conversationTitle(input.userContent),
      userContent: input.userContent, assistantContent: input.assistantContent,
    }), "CreateAiConversationWithExchange");
    return {title: conversationTitle(input.userContent), messageCount: 2};
  }
  const expected = input.expectedMessageCount;
  await executeWorkspaceOperation(() => sql.appendAiExchange(request.dc, {
    organizationId, conversationId: input.conversationId, ownerUid, expectedMessageCount: expected, nextMessageCount: expected + 2,
    userSequence: expected + 1, assistantSequence: expected + 2, userContent: input.userContent, assistantContent: input.assistantContent,
  }), "AppendAiExchange");
  return {title: null, messageCount: expected + 2};
}

// --- Monthly allowances -------------------------------------------------------

export interface QuotaReservation { release(): Promise<void> }

/**
 * Reserve one request against the member's and the organization's monthly
 * allowances. Each reservation is a single conditional upsert, so concurrent
 * requests on any number of instances can never push a counter past its limit.
 * If the second allowance is exhausted the first reservation is returned.
 */
export async function reserveQuota(context: Context, config: AiConfig, now = new Date()): Promise<QuotaReservation> {
  const {request, organizationId} = context;
  const periodKey = usagePeriodKey(now);
  const subjects = [
    {subjectKey: userQuotaKey(request.user.uid), limit: config.monthlyRequestsPerUser, message: "You have used your monthly AI allowance (Copilot and Content Studio)."},
    {subjectKey: "organization", limit: config.monthlyRequestsPerOrganization, message: "Your company has used its monthly AI allowance (Copilot and Content Studio)."},
  ];
  const reserved: string[] = [];
  const release = async () => {
    await Promise.allSettled(reserved.map(subjectKey => sql.releaseAiRequest(request.dc, {organizationId, periodKey, subjectKey})));
    reserved.length = 0;
  };
  for (const subject of subjects) {
    const result = await executeWorkspaceOperation(() => sql.reserveAiRequest(request.dc, {organizationId, periodKey, subjectKey: subject.subjectKey, limit: subject.limit}), "ReserveAiRequest");
    if (!result.counter) {
      await release();
      throw new WorkspaceError("AI_QUOTA_EXCEEDED", 429, `${subject.message} Ask your company owner about the allowance, or try again next month.`, secondsUntilNextMonth(now));
    }
    reserved.push(subject.subjectKey);
  }
  return {release};
}

function secondsUntilNextMonth(now: Date) {
  const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1);
  return Math.max(1, Math.ceil((next - now.getTime()) / 1000));
}

export async function usageSummary(context: Context, config: AiConfig, now = new Date()) {
  const {request, organizationId} = context;
  const periodKey = usagePeriodKey(now);
  const data = await executeWorkspaceOperation(() => sql.getAiUsageCounters(request.dc, {organizationId, periodKey, userKey: userQuotaKey(request.user.uid)}), "GetAiUsageCounters");
  return {
    period: periodKey,
    user: {used: data.user?.requestCount ?? 0, limit: config.monthlyRequestsPerUser},
    organization: {used: data.organization?.requestCount ?? 0, limit: config.monthlyRequestsPerOrganization},
  };
}

/** One usage row per request plus one row per tool call. Never includes prompt, answer or tool data. */
export async function recordUsage(context: Context, config: AiConfig, input: {usageId: string; conversationId: string | null; result: TurnResult; durationMs: number}) {
  const {request, organizationId} = context;
  const {result} = input;
  const model = result.servedModel ?? config.model;
  const estimatedCostUsd = estimateCostUsd(model === config.model ? config.pricing : pricingFor(model), result.usage);
  try {
    await executeWorkspaceOperation(() => sql.recordAiUsage(request.dc, {
      organizationId, id: input.usageId, userUid: request.user.uid, conversationId: input.conversationId,
      model: model.slice(0, 80), promptVersion: AI_PROMPT_VERSION, status: sql.AiRequestStatus[result.status],
      errorCode: result.error?.code.slice(0, 40) ?? null,
      inputTokens: result.usage.inputTokens, outputTokens: result.usage.outputTokens,
      cacheReadInputTokens: result.usage.cacheReadInputTokens, cacheCreationInputTokens: result.usage.cacheCreationInputTokens,
      estimatedCostUsd, modelRequests: result.usage.modelRequests, toolCalls: result.usage.toolCalls, durationMs: Math.min(input.durationMs, 2_147_483_647), feature: "COPILOT",
    }), "RecordAiUsage");
    await Promise.all(result.tools.map(tool => executeWorkspaceOperation(() => sql.recordAiToolExecution(request.dc, {
      organizationId, usageRecordId: input.usageId, toolName: tool.name, status: sql.AiToolExecutionStatus[tool.status],
      errorCode: tool.errorCode?.slice(0, 40) ?? null, resultCount: tool.resultCount, durationMs: tool.durationMs,
    }), "RecordAiToolExecution")));
  } catch (error) {
    // Usage must not be silently lost: log the safe totals so they can be reconciled.
    console.error(JSON.stringify({event: "ai.usage.record_failed", usageId: input.usageId, model, status: result.status,
      inputTokens: result.usage.inputTokens, outputTokens: result.usage.outputTokens, code: error instanceof WorkspaceError ? error.code : "ERROR"}));
  }
  return {model, estimatedCostUsd};
}
