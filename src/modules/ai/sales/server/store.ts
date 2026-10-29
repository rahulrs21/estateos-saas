import "server-only";

import * as sql from "@dataconnect/admin-generated";
import { executeWorkspaceOperation } from "@/lib/firebase/dataconnect";
import type { requireActiveOrganizationRequest } from "@/modules/organizations/server/context";
import { WorkspaceError } from "@/modules/organizations/server/errors";
import { canonicalUuid } from "@/modules/organizations/server/identifiers";
import { estimateCostUsd, pricingFor, type AiConfig } from "../../config";
import type { StructuredResult } from "../../structured";
import { SALES_PROMPT_VERSION, type InsightKind } from "../analysis";
import type { AiLeadPriority, LeadReadiness, LeadTimeline, QualificationResult } from "../scoring";

export type Context = Awaited<ReturnType<typeof requireActiveOrganizationRequest>>;

/*
 * Reads and member writes run with the verified session identity, so every
 * stored operation re-checks membership and lead visibility in the database.
 * Assessments, insights and usage are written by NO_ACCESS operations with
 * the server's Admin identity, only after the caller's access is verified.
 */

export async function getLeadIntelligenceRecords(context: Context, leadId: string) {
  const {request, organizationId} = context;
  const data = await executeWorkspaceOperation(() => sql.getLeadSalesIntelligence(request.dc, {organizationId, leadId}, request.options), "GetLeadSalesIntelligence");
  return {
    details: data.details ? {...data.details, id: canonicalUuid(data.details.id)} : null,
    assessments: data.assessments.map(row => ({...row, id: canonicalUuid(row.id)})),
    reviews: data.reviews.map(row => ({...row, id: canonicalUuid(row.id), assessmentId: canonicalUuid(row.assessmentId)})),
    insights: data.insights.map(row => ({...row, id: canonicalUuid(row.id), propertyId: row.propertyId ? canonicalUuid(row.propertyId) : null,
      viewingId: row.viewingId ? canonicalUuid(row.viewingId) : null, assessmentId: row.assessmentId ? canonicalUuid(row.assessmentId) : null})),
  };
}

export async function getInsight(context: Context, id: string) {
  const {request, organizationId} = context;
  const data = await executeWorkspaceOperation(() => sql.getAiSalesInsight(request.dc, {organizationId, id}, request.options), "GetAiSalesInsight");
  if (!data.insight) throw new WorkspaceError("NOT_FOUND", 404, "This AI result was not found.");
  return {...data.insight, id: canonicalUuid(data.insight.id), leadId: data.insight.leadId ? canonicalUuid(data.insight.leadId) : null};
}

export async function listMySummaries(context: Context) {
  const {request, organizationId} = context;
  const data = await executeWorkspaceOperation(() => sql.listMyAiSalesSummaries(request.dc, {organizationId, limit: 5}, request.options), "ListMyAiSalesSummaries");
  return data.insights.map(row => ({...row, id: canonicalUuid(row.id)}));
}

export async function saveQualificationDetails(context: Context, input: {leadId: string; expectedRevision: number; timeline: LeadTimeline | null; readiness: LeadReadiness | null}) {
  const {request, organizationId} = context;
  const values = {timeline: input.timeline ? sql.LeadTimeline[input.timeline] : null, readiness: input.readiness ? sql.LeadReadiness[input.readiness] : null};
  if (input.expectedRevision === 0) {
    await executeWorkspaceOperation(() => sql.createLeadQualificationDetails(request.dc, {organizationId, leadId: input.leadId, ...values}, request.options), "CreateLeadQualificationDetails");
  } else {
    await executeWorkspaceOperation(() => sql.updateLeadQualificationDetails(request.dc, {
      organizationId, leadId: input.leadId, expectedRevision: input.expectedRevision, nextRevision: input.expectedRevision + 1, ...values,
    }, request.options), "UpdateLeadQualificationDetails");
  }
}

export async function recordPriorityReview(context: Context, input: {leadId: string; assessmentId: string; suggestedPriority: AiLeadPriority; reviewedPriority: Exclude<AiLeadPriority, "INSUFFICIENT_DATA">; reason: string}) {
  const {request, organizationId} = context;
  const data = await executeWorkspaceOperation(() => sql.recordLeadPriorityReview(request.dc, {
    organizationId, leadId: input.leadId, assessmentId: input.assessmentId, suggestedPriority: sql.AiLeadPriority[input.suggestedPriority],
    reviewedPriority: sql.AiLeadPriority[input.reviewedPriority], reason: input.reason,
  }, request.options), "RecordLeadPriorityReview");
  return {id: canonicalUuid(data.review.id)};
}

/** Stores one assessment. The JSON keeps every evaluated input and factor so the score can be audited later. */
export async function recordAssessment(context: Context, input: {id: string; leadId: string; result: QualificationResult; detail: unknown}) {
  const {request, organizationId} = context;
  const result = JSON.stringify(input.detail);
  if (result.length > 20_000) throw new WorkspaceError("AI_SAVE_FAILED", 503, "The assessment was too large to save.");
  await executeWorkspaceOperation(() => sql.recordLeadQualificationAssessment(request.dc, {
    organizationId, id: input.id, leadId: input.leadId, evaluatedByUid: request.user.uid, ruleVersion: input.result.ruleVersion, configHash: input.result.configHash,
    score: input.result.score, priority: sql.AiLeadPriority[input.result.priority], sufficientData: input.result.sufficientData, result,
  }), "RecordLeadQualificationAssessment");
}

export async function recordInsight(context: Context, input: {id: string; kind: InsightKind; leadId?: string | null; propertyId?: string | null; viewingId?: string | null; assessmentId?: string | null; content: unknown; model: string}) {
  const {request, organizationId} = context;
  const content = JSON.stringify(input.content);
  if (content.length > 60_000) throw new WorkspaceError("AI_SAVE_FAILED", 503, "The AI result was too large to save.");
  await executeWorkspaceOperation(() => sql.recordAiSalesInsight(request.dc, {
    organizationId, id: input.id, kind: sql.AiSalesInsightKind[input.kind], leadId: input.leadId ?? null, propertyId: input.propertyId ?? null,
    viewingId: input.viewingId ?? null, assessmentId: input.assessmentId ?? null, content, model: input.model.slice(0, 80), promptVersion: SALES_PROMPT_VERSION,
    createdByUid: request.user.uid,
  }), "RecordAiSalesInsight");
}

/** One AiUsageRecord per Claude request, tagged SALES with the insight kind. Never includes facts or text. */
export async function recordSalesUsage(context: Context, config: AiConfig, input: {usageId: string; kind: InsightKind; result: StructuredResult<unknown>; status: "SUCCEEDED" | "FAILED" | "CANCELLED"; durationMs: number}) {
  const {request, organizationId} = context;
  const {result} = input;
  const model = result.servedModel ?? config.model;
  const estimatedCostUsd = estimateCostUsd(model === config.model ? config.pricing : pricingFor(model), result.usage);
  try {
    await executeWorkspaceOperation(() => sql.recordAiUsage(request.dc, {
      organizationId, id: input.usageId, userUid: request.user.uid, conversationId: null, model: model.slice(0, 80), promptVersion: SALES_PROMPT_VERSION,
      status: sql.AiRequestStatus[input.status], errorCode: input.status === "SUCCEEDED" ? null : result.error?.code.slice(0, 40) ?? null,
      inputTokens: result.usage.inputTokens, outputTokens: result.usage.outputTokens, cacheReadInputTokens: result.usage.cacheReadInputTokens,
      cacheCreationInputTokens: result.usage.cacheCreationInputTokens, estimatedCostUsd, modelRequests: result.usage.modelRequests, toolCalls: 0,
      durationMs: Math.min(input.durationMs, 2_147_483_647), feature: "SALES", contentType: input.kind,
    }), "RecordAiUsage");
  } catch (error) {
    console.error(JSON.stringify({event: "ai.usage.record_failed", usageId: input.usageId, feature: "SALES", model, inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens, code: error instanceof WorkspaceError ? error.code : "ERROR"}));
  }
  return {model, estimatedCostUsd};
}

// --- Dashboard reads ---------------------------------------------------------

export async function listRecentAssessments(context: Context, since: string) {
  const {request, organizationId} = context;
  const data = await executeWorkspaceOperation(() => sql.listAiSalesAssessments(request.dc, {organizationId, since, limit: 1000, offset: 0}, request.options), "ListAiSalesAssessments");
  return {
    assessments: data.assessments.map(row => ({...row, id: canonicalUuid(row.id), leadId: canonicalUuid(row.leadId)})),
    reviews: data.reviews.map(row => ({...row, leadId: canonicalUuid(row.leadId), assessmentId: canonicalUuid(row.assessmentId)})),
    complete: data.assessments.length < 1000,
  };
}

export async function listViewings(context: Context, input: {from: string; to: string; propertyId?: string}) {
  const {request, organizationId} = context;
  const data = await executeWorkspaceOperation(() => sql.listAiSalesViewings(request.dc, {organizationId, from: input.from, to: input.to, propertyId: input.propertyId, limit: 1000}, request.options), "ListAiSalesViewings");
  return {
    viewings: data.viewings.map(row => ({...row, id: canonicalUuid(row.id), leadId: canonicalUuid(row.leadId), propertyId: canonicalUuid(row.propertyId),
      assignedMembershipId: row.assignedMembershipId ? canonicalUuid(row.assignedMembershipId) : null,
      lead: {fullName: row.lead.fullName, assignedMembershipId: row.lead.assignedMembershipId ? canonicalUuid(row.lead.assignedMembershipId) : null, branchId: row.lead.branchId ? canonicalUuid(row.lead.branchId) : null}})),
    complete: data.viewings.length < 1000,
  };
}

export async function listActivity(context: Context, since: string) {
  const {request, organizationId} = context;
  const data = await executeWorkspaceOperation(() => sql.listAiSalesActivity(request.dc, {organizationId, since, limit: 2000}, request.options), "ListAiSalesActivity");
  return {
    activities: data.activities.map(row => ({kind: row.kind as string, createdAt: row.createdAt, leadId: row.leadId ? canonicalUuid(row.leadId) : null,
      assignedMembershipId: row.lead?.assignedMembershipId ? canonicalUuid(row.lead.assignedMembershipId) : null, branchId: row.lead?.branchId ? canonicalUuid(row.lead.branchId) : null})),
    complete: data.activities.length < 2000,
  };
}
