import "server-only";

import { randomUUID } from "node:crypto";
import * as sql from "@dataconnect/admin-generated";
import { executeWorkspaceOperation } from "@/lib/firebase/dataconnect";
import type { RateLimitRule } from "@/lib/rate-limit/limiter";
import { enforceRateLimit, requestClientIp } from "@/lib/rate-limit/server";
import { getInventoryRecordRequired, listInventory } from "@/modules/inventory/server/service";
import { matchProperty, type MatchingProperty } from "@/modules/leads/property-matching";
import { getLeadPropertyData, type LeadPropertyData } from "@/modules/leads/server/property-service";
import { getLead } from "@/modules/leads/server/service";
import { WorkspaceError } from "@/modules/organizations/server/errors";
import { canonicalUuid } from "@/modules/organizations/server/identifiers";
import type { AiConfig } from "../../config";
import { loadFacts } from "../../content/server/sources";
import { getBrand } from "../../content/server/store";
import { buildFactIndex, factCheckText } from "../../content/validate";
import { aiConfiguration, modelStreamFactory, requireAiConfig } from "../../server/anthropic";
import { logAndMapProviderError } from "../../server/chat";
import { reserveQuota } from "../../server/store";
import { generateStructured, type StructuredResult } from "../../structured";
import {
  LEAD_ANALYSIS_JSON, PIPELINE_SUMMARY_JSON, SALES_SYSTEM_PROMPT, VIEWING_BRIEF_JSON, leadAnalysisZod, pipelineSummaryZod, salesFactsPrompt, salesTaskPrompt,
  sanitizeLeadAnalysis, unverifiedFigures, viewingBriefZod, type InsightKind, type LeadAnalysisOutput, type PipelineSummaryOutput, type ViewingBriefOutput,
} from "../analysis";
import { ASSESSMENT_WINDOW_DAYS, TREND_DAYS, computeSalesMetrics, metricNumbers, type DashboardLead } from "../dashboard";
import { followUpSuggestions, type FollowUpSuggestion } from "../follow-ups";
import { buildSalesInputs, matchCriteriaGaps, presentMatch, type RawLeadState } from "../inputs";
import type { DashboardScope } from "../policy";
import {
  AI_LEAD_PRIORITIES, FACTOR_KEYS, PRIORITY_LABELS, READINESS_LABELS, TIMELINE_LABELS, evaluateLead, resolveScoringConfig,
  type AiLeadPriority, type QualificationResult,
} from "../scoring";
import {
  getInsight, getLeadIntelligenceRecords, listActivity, listMySummaries, listRecentAssessments, listViewings, recordAssessment, recordInsight,
  recordSalesUsage, type Context,
} from "./store";

const same = (a: string | null | undefined, b: string | null | undefined) => Boolean(a && b && a.replaceAll("-", "").toLowerCase() === b.replaceAll("-", "").toLowerCase());
const hasInventoryScope = (context: Context) => ["OWNER", "ADMIN", "AGENT"].includes(context.membership.role);

/** AI_LEAD_SCORING overrides; invalid settings stop scoring with a safe 503 rather than silently changing scores. */
export function scoringConfig() {
  const problems: string[] = [];
  const config = resolveScoringConfig(process.env.AI_LEAD_SCORING, problems);
  if (problems.length) {
    console.warn(JSON.stringify({event: "ai.sales.scoring_config", problems}));
    throw new WorkspaceError("LEAD_SCORING_NOT_CONFIGURED", 503, "Lead scoring settings are invalid. Ask an administrator to check AI_LEAD_SCORING.");
  }
  return config;
}

export async function enforceSalesRateLimit(request: Request, context: Context, kind: "evaluate" | "ai", config?: AiConfig) {
  const perMinute = kind === "ai" ? config!.requestsPerMinutePerMember : 30;
  const rules = {
    member: {scope: `ai.sales.${kind}.member`, limit: perMinute, windowSeconds: 60},
    ip: {scope: `ai.sales.${kind}.ip`, limit: perMinute * 4, windowSeconds: 60},
    company: {scope: `ai.sales.${kind}.company`, limit: kind === "ai" ? config!.requestsPerMinutePerOrganization : 300, windowSeconds: 60},
  } satisfies Record<string, RateLimitRule>;
  await enforceRateLimit([
    {rule: rules.member, subject: context.membership.id},
    {rule: rules.ip, subject: requestClientIp(request) ?? ""},
    {rule: rules.company, subject: context.organizationId},
  ], "You are using sales intelligence too quickly. Wait a moment and try again.");
}

// --- Loading one lead with the member's permissions ---------------------------

async function inventoryData(context: Context, leadId: string, archived: boolean): Promise<LeadPropertyData | null> {
  if (archived || !hasInventoryScope(context)) return null;
  try {
    return await getLeadPropertyData({leadId});
  } catch (error) {
    if (error instanceof WorkspaceError && ["FORBIDDEN", "PERMISSION_DENIED", "NOT_FOUND"].includes(error.code)) return null;
    throw error;
  }
}

/** Every read runs as the member: lead visibility, inventory scope and property assignment are enforced by the stored operations. */
export async function loadLeadState(context: Context, rawLeadId: string) {
  const {lead} = await getLead({leadId: rawLeadId});
  if (!lead) throw new WorkspaceError("NOT_FOUND", 404, "Lead not found.");
  const leadId = canonicalUuid(lead.id);
  const {request, organizationId} = context;
  const [followUps, activities, property, records] = await Promise.all([
    executeWorkspaceOperation(() => sql.listLeadFollowUps(request.dc, {organizationId, leadId, limit: 50, offset: 0}, request.options), "ListLeadFollowUps"),
    executeWorkspaceOperation(() => sql.listLeadActivities(request.dc, {organizationId, leadId, limit: 100, offset: 0}, request.options), "ListLeadActivities"),
    inventoryData(context, leadId, Boolean(lead.archivedAt)),
    getLeadIntelligenceRecords(context, leadId),
  ]);
  const raw: RawLeadState = {
    now: new Date().toISOString(),
    lead: {
      status: lead.status, archivedAt: lead.archivedAt ?? null, transactionType: lead.transactionType, preferredLocation: lead.preferredLocation ?? null,
      propertyType: lead.propertyType ?? null, bedroomPreference: lead.bedroomPreference ?? null, budgetMin: lead.budgetMin ?? null, budgetMax: lead.budgetMax ?? null,
      currency: lead.currency ?? "AED", createdAt: lead.createdAt, followUpAt: lead.followUpAt ?? null,
    },
    details: records.details ? {timeline: records.details.timeline ?? null, readiness: records.details.readiness ?? null} : null,
    followUps: followUps.followUps.map(item => ({title: item.title, dueAt: item.dueAt, status: item.status})),
    activities: activities.activities.map(item => ({kind: item.kind, createdAt: item.createdAt})),
    property: property ? {
      matches: property.matches.map(match => ({...match, listing: {...match.listing, id: canonicalUuid(match.listing.id)}})),
      reviewed: property.reviewed, candidateTotal: property.candidateTotal, viewings: property.viewings, shortlist: property.shortlist,
    } : null,
  };
  return {lead, leadId, raw, property, records};
}

type LeadState = Awaited<ReturnType<typeof loadLeadState>>;

function evaluateState(state: LeadState) {
  const {scoring, followUp} = buildSalesInputs(state.raw);
  const result = evaluateLead(scoring, scoringConfig());
  const suggestions = followUpSuggestions({...followUp, missing: result.missing});
  return {scoring, result, suggestions};
}

function auditDetail(evaluation: ReturnType<typeof evaluateState>, matches: ReturnType<typeof presentMatch>[]) {
  return {
    schemaVersion: 1, inputs: evaluation.scoring, state: evaluation.result.state, evaluatedWeight: evaluation.result.evaluatedWeight,
    factors: evaluation.result.factors, missing: evaluation.result.missing,
    suggestions: evaluation.suggestions.map(item => ({code: item.code, severity: item.severity, title: item.title})),
    matches: matches.slice(0, 10).map(item => ({propertyId: item.propertyId, reference: item.reference})),
  };
}

/** Parses a stored assessment for display; tolerates rows from older rule versions. */
function presentAssessment(row: LeadState["records"]["assessments"][number]) {
  let detail: {state?: string; factors?: unknown[]; missing?: unknown[]; suggestions?: unknown[]; evaluatedWeight?: number} = {};
  try { detail = JSON.parse(row.result); } catch { detail = {}; }
  return {
    id: row.id, score: row.score ?? null, priority: row.priority as AiLeadPriority, priorityLabel: PRIORITY_LABELS[row.priority as AiLeadPriority],
    state: detail.state ?? (row.sufficientData ? "SCORED" : "INSUFFICIENT_DATA"), sufficientData: row.sufficientData,
    factors: detail.factors ?? [], missing: detail.missing ?? [], evaluatedWeight: detail.evaluatedWeight ?? null,
    ruleVersion: row.ruleVersion, configHash: row.configHash, evaluatedAt: row.evaluatedAt, evaluatedBy: row.evaluatedBy.displayName,
  };
}

async function latestInsightContent(context: Context, records: LeadState["records"], kind: InsightKind, filter: (row: LeadState["records"]["insights"][number]) => boolean = () => true) {
  const row = records.insights.find(item => item.kind === kind && filter(item));
  if (!row) return null;
  try {
    const insight = await getInsight(context, row.id);
    return {id: insight.id, createdAt: insight.createdAt, createdBy: insight.createdBy.displayName, model: insight.model, viewingId: row.viewingId, content: JSON.parse(insight.content) as unknown};
  } catch { return null; }
}

/** Everything the lead page shows. Follow-up suggestions and matches are always live; the score is the latest stored assessment. */
async function intelligenceView(context: Context, state: LeadState) {
  const evaluation = evaluateState(state);
  const assessments = state.records.assessments.map(presentAssessment);
  const latest = assessments[0] ?? null;
  const reviewOfLatest = latest ? state.records.reviews.find(review => review.assessmentId === latest.id) ?? null : null;
  const config = aiConfiguration();
  const matches = (state.raw.property?.matches ?? []).map(presentMatch);
  const viewings = (state.property?.viewings ?? []).map(item => ({
    id: item.id, propertyId: item.propertyId, propertyReference: item.property.propertyReference, scheduledAt: item.scheduledAt,
    status: item.status, customerConfirmation: item.customerConfirmation, outcome: item.outcome ?? null,
  }));
  const [analysis, brief] = await Promise.all([
    latestInsightContent(context, state.records, "LEAD_ANALYSIS"),
    latestInsightContent(context, state.records, "VIEWING_BRIEF"),
  ]);
  return {
    leadId: state.leadId, status: state.lead.status, archived: Boolean(state.lead.archivedAt), role: context.membership.role,
    canEdit: !state.lead.archivedAt, inventoryAccess: Boolean(state.property), aiAvailable: config.ok,
    aiUnavailableReason: config.ok ? null : config.code === "AI_DISABLED" ? "AI features are turned off for this EstateOS environment." : "Claude is not configured. Ask an administrator to set the Anthropic settings.",
    qualification: state.records.details ? {
      timeline: state.records.details.timeline ?? null, readiness: state.records.details.readiness ?? null, revision: state.records.details.revision,
      updatedAt: state.records.details.updatedAt, updatedBy: state.records.details.updatedBy.displayName,
    } : {timeline: null, readiness: null, revision: 0, updatedAt: null, updatedBy: null},
    labels: {timeline: TIMELINE_LABELS, readiness: READINESS_LABELS, priority: PRIORITY_LABELS},
    latestAssessment: latest,
    /** What the rules would give right now, so the member can see when the stored assessment is out of date. */
    currentEstimate: {score: evaluation.result.score, priority: evaluation.result.priority, state: evaluation.result.state},
    review: reviewOfLatest ? {...reviewOfLatest, createdBy: reviewOfLatest.createdBy.displayName} : null,
    history: assessments.map(item => ({id: item.id, score: item.score, priority: item.priority, ruleVersion: item.ruleVersion, evaluatedAt: item.evaluatedAt, evaluatedBy: item.evaluatedBy})),
    reviews: state.records.reviews.map(review => ({...review, createdBy: review.createdBy.displayName})),
    suggestions: evaluation.suggestions,
    matches: {
      items: matches.slice(0, 10), total: matches.length,
      coverage: state.raw.property ? {reviewed: state.raw.property.reviewed, inScope: state.raw.property.candidateTotal} : null,
      criteriaGaps: matchCriteriaGaps(state.raw.lead),
    },
    viewings,
    latestAnalysis: analysis,
    latestViewingBrief: brief,
  };
}

export async function getLeadIntelligence(context: Context, leadId: string) {
  return intelligenceView(context, await loadLeadState(context, leadId));
}

/** Rule-based evaluation only: no Claude call and no AI allowance used. Stores one assessment row. */
export async function evaluateAndStore(context: Context, state: LeadState) {
  const evaluation = evaluateState(state);
  const id = randomUUID();
  const matches = (state.raw.property?.matches ?? []).map(presentMatch);
  await recordAssessment(context, {id, leadId: state.leadId, result: evaluation.result, detail: auditDetail(evaluation, matches)});
  return {id, evaluation, matches};
}

export async function evaluateLeadResponse(context: Context, leadId: string) {
  const state = await loadLeadState(context, leadId);
  await evaluateAndStore(context, state);
  return getLeadIntelligence(context, state.leadId);
}

// --- Claude requests ------------------------------------------------------------

async function runClaude<T>(context: Context, config: AiConfig, kind: InsightKind, facts: string, jsonSchema: Record<string, unknown>, zod: import("zod").ZodType<T>) {
  const reservation = await reserveQuota(context, config);
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(new WorkspaceError("AI_TIMEOUT", 504, "Claude took too long to respond. Try again.")), config.requestTimeoutMs + 5_000);
  let result: StructuredResult<T>;
  try {
    result = await generateStructured({
      config, maxOutputTokens: Math.min(config.maxOutputTokens, 8000), system: SALES_SYSTEM_PROMPT, factsText: facts, instructionsText: salesTaskPrompt(kind),
      jsonSchema, zod, createStream: modelStreamFactory(config), signal: controller.signal, mapError: logAndMapProviderError,
      messages: {
        refused: "Claude declined this request. Review the lead details and try again.",
        incomplete: "Claude's answer was cut off. Try again.",
        invalid: "Claude returned an answer in an unexpected format. Try again.",
        cancelled: "The request was stopped.",
      },
    });
  } finally { clearTimeout(timeout); }
  // The allowance is returned when Claude was never reached (for example a connection failure).
  if (result.status !== "SUCCEEDED" && result.usage.modelRequests === 0) await reservation.release();
  const usage = await recordSalesUsage(context, config, {usageId: randomUUID(), kind, result: result as StructuredResult<unknown>, status: result.status, durationMs: Date.now() - startedAt});
  console.info(JSON.stringify({event: "ai.sales", kind, status: result.status, errorCode: result.error?.code ?? null, model: usage.model, role: context.membership.role,
    inputTokens: result.usage.inputTokens, outputTokens: result.usage.outputTokens, cacheReadInputTokens: result.usage.cacheReadInputTokens,
    estimatedCostUsd: usage.estimatedCostUsd, durationMs: Date.now() - startedAt}));
  if (result.status !== "SUCCEEDED" || !result.output) throw result.error ?? new WorkspaceError("AI_UNAVAILABLE", 503, "Claude could not complete this request. Try again.");
  return {output: result.output, model: usage.model};
}

const money = (value: number | null | undefined, currency: string) => value == null ? null : `${currency} ${value.toLocaleString("en-US")}`;
const daysSince = (iso: string) => Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / 86_400_000));

/** The minimized fact sheet for a lead analysis: no name, contact details, nationality, language, source or note text. */
export function leadAnalysisFacts(state: LeadState, evaluation: ReturnType<typeof evaluateState>, matches: ReturnType<typeof presentMatch>[]) {
  const {lead} = state.raw;
  const currency = lead.currency ?? "AED";
  return {
    readAt: state.raw.now,
    lead: {
      stage: lead.status, transactionType: lead.transactionType, daysSinceEnquiry: daysSince(lead.createdAt),
      requirements: {
        preferredLocation: lead.preferredLocation, propertyType: lead.propertyType, bedrooms: lead.bedroomPreference,
        budget: lead.budgetMin == null && lead.budgetMax == null ? null : {minimum: money(lead.budgetMin, currency), maximum: money(lead.budgetMax, currency)},
      },
      customerStated: {
        timeline: state.raw.details?.timeline ? TIMELINE_LABELS[state.raw.details.timeline as keyof typeof TIMELINE_LABELS] : null,
        readiness: state.raw.details?.readiness ? READINESS_LABELS[state.raw.details.readiness as keyof typeof READINESS_LABELS] : null,
      },
    },
    assessment: {
      calculatedBy: "EstateOS rules (not Claude)", state: evaluation.result.state, score: evaluation.result.score, priority: PRIORITY_LABELS[evaluation.result.priority],
      ruleVersion: evaluation.result.ruleVersion,
      factors: evaluation.result.factors.map(factor => ({key: factor.key, label: factor.label, status: factor.status, points: factor.points, maxPoints: factor.maxPoints, evidence: factor.evidence})),
      missingInformation: evaluation.result.missing.map(item => item.label),
    },
    followUpSignals: evaluation.suggestions.map(item => ({code: item.code, severity: item.severity, title: item.title})),
    followUps: state.raw.followUps.slice(0, 10).map(item => ({dueAt: item.dueAt, status: item.status})),
    recentActivity: state.raw.activities.slice(0, 15).map(item => ({type: item.kind, at: item.createdAt})),
    viewings: (state.raw.property?.viewings ?? []).slice(0, 10).map(item => ({
      propertyId: item.propertyId, propertyReference: item.property.propertyReference, scheduledAt: item.scheduledAt, status: item.status,
      customerConfirmation: item.customerConfirmation, outcome: item.outcome ?? null,
    })),
    shortlist: (state.raw.property?.shortlist ?? []).slice(0, 15).map(item => ({propertyId: item.propertyId, propertyReference: item.property.propertyReference, status: item.status})),
    matchingProperties: matches.slice(0, 10).map(item => ({...item, link: undefined})),
    matching: state.raw.property
      ? {engine: "EstateOS matching: available properties with an active listing that meet the recorded requirements", candidatesReviewed: state.raw.property.reviewed, candidatesInScope: state.raw.property.candidateTotal, criteriaNotRecorded: matchCriteriaGaps(lead)}
      : "Inventory is outside this user's role, so no properties were matched.",
  };
}

export async function analyzeLeadResponse(request: Request, context: Context, leadId: string) {
  const config = requireAiConfig();
  await enforceSalesRateLimit(request, context, "ai", config);
  const state = await loadLeadState(context, leadId);
  if (state.lead.archivedAt) throw new WorkspaceError("VALIDATION_ERROR", 400, "Archived leads are not analysed.");
  // The analysis explains the current rule-based assessment. The latest stored one is reused when the rules
  // still give the same result (so a person's review of it stays current); otherwise a new one is stored first.
  const current = evaluateState(state);
  const latest = state.records.assessments[0];
  const unchanged = latest && latest.ruleVersion === current.result.ruleVersion && latest.configHash === current.result.configHash
    && (latest.score ?? null) === current.result.score && latest.priority === current.result.priority;
  const {id: assessmentId, evaluation, matches} = unchanged
    ? {id: latest.id, evaluation: current, matches: (state.raw.property?.matches ?? []).map(presentMatch)}
    : await evaluateAndStore(context, state);
  const facts = salesFactsPrompt(leadAnalysisFacts(state, evaluation, matches), {propertyInterest: state.lead.propertyInterest ?? null});
  const {output, model} = await runClaude<LeadAnalysisOutput>(context, config, "LEAD_ANALYSIS", facts, LEAD_ANALYSIS_JSON, leadAnalysisZod);
  const {analysis, removedReferences} = sanitizeLeadAnalysis(output, matches.map(item => item.propertyId), FACTOR_KEYS);
  await recordInsight(context, {id: randomUUID(), kind: "LEAD_ANALYSIS", leadId: state.leadId, assessmentId, model,
    content: {schemaVersion: 1, analysis, removedReferences, factsReadAt: state.raw.now, assessmentId}});
  return getLeadIntelligence(context, state.leadId);
}

/** Viewing brief: viewing, lead requirements and property facts are re-read with the member's permissions. */
export async function viewingBriefResponse(request: Request, context: Context, viewingId: string, leadId: string) {
  const config = requireAiConfig();
  if (!hasInventoryScope(context)) throw new WorkspaceError("FORBIDDEN", 403, "Viewing preparation needs inventory access, which your role does not have.");
  await enforceSalesRateLimit(request, context, "ai", config);
  const state = await loadLeadState(context, leadId);
  const viewing = state.property?.viewings.find(item => same(item.id, viewingId));
  if (!viewing) throw new WorkspaceError("NOT_FOUND", 404, "This viewing is unavailable or outside your permitted access.");
  const [{facts, sources}, brand] = await Promise.all([
    loadFacts(context, {propertyId: viewing.propertyId, leadId: state.leadId}, {useLeadFirstName: false, withPropertyDetail: true}),
    getBrand(context),
  ]);
  const evaluation = evaluateState(state);
  const others = [
    ...(state.raw.property?.shortlist ?? []).filter(item => !same(item.propertyId, viewing.propertyId) && item.status !== "REMOVED").map(item => ({propertyId: item.propertyId, reference: item.property.propertyReference, relation: `shortlisted (${item.status.toLowerCase()})`})),
    ...(state.raw.property?.matches ?? []).map(presentMatch).filter(item => !same(item.propertyId, viewing.propertyId)).map(item => ({...item, link: undefined, relation: "matching available property"})),
  ].slice(0, 6);
  const factSheet = {
    viewing: {scheduledAt: viewing.scheduledAt, status: viewing.status, customerConfirmation: viewing.customerConfirmation, outcome: viewing.outcome ?? null},
    crm: {...facts, sender: undefined},
    missingInformation: evaluation.result.missing.map(item => item.label),
    otherProperties: others,
  };
  const {output, model} = await runClaude<ViewingBriefOutput>(context, config, "VIEWING_BRIEF", salesFactsPrompt(factSheet, {propertyInterest: state.lead.propertyInterest ?? null}), VIEWING_BRIEF_JSON, viewingBriefZod);
  const warnings = factCheckText(output.postViewingMessage, "postViewingMessage", buildFactIndex(factSheet, brand.approved));
  await recordInsight(context, {id: randomUUID(), kind: "VIEWING_BRIEF", leadId: state.leadId, propertyId: viewing.propertyId, viewingId: canonicalUuid(viewing.id), model,
    content: {schemaVersion: 1, brief: output, warnings, factsReadAt: facts.readAt, sources: sources.map(source => source.kind), propertyReference: viewing.property.propertyReference}});
  return getLeadIntelligence(context, state.leadId);
}

// --- Property page: matching leads ---------------------------------------------------

/** Leads whose recorded requirements match this property, from the leads the member can see. Deterministic; no Claude call. */
export async function propertyMatchingLeads(context: Context, propertyId: string) {
  if (!hasInventoryScope(context)) throw new WorkspaceError("FORBIDDEN", 403, "Property matching needs inventory access, which your role does not have.");
  const property = await getInventoryRecordRequired("properties", {id: propertyId}) as unknown as MatchingProperty & {id: string; archivedAt?: string | null};
  const listings = await listInventory("listings", {propertyId, limit: 100, offset: 0}) as {propertyListings: Array<MatchingProperty["propertyListings_on_property"][number] & {archivedAt?: string | null}>};
  const candidate: MatchingProperty = {
    ...property, id: canonicalUuid(property.id), projectId: property.projectId ? canonicalUuid(property.projectId) : null,
    propertyListings_on_property: listings.propertyListings.filter(listing => !listing.archivedAt),
  };
  const {request, organizationId} = context;
  const matches: Array<{leadId: string; name: string; status: string; reasons: string[]; listingTitle: string; link: string}> = [];
  let reviewed = 0;
  let total = 0;
  for (let offset = 0; offset < 500; offset += 100) {
    const page = await executeWorkspaceOperation(() => sql.listLeads(request.dc, {organizationId, limit: 100, offset, activeOnly: true}, request.options), "ListLeads");
    total = page.total[0]?.count ?? 0;
    for (const lead of page.leads) {
      reviewed += 1;
      if (["WON", "LOST", "CONVERTED"].includes(lead.status)) continue;
      const result = matchProperty({...lead, projectId: lead.projectId ?? null, currency: lead.currency ?? "AED"}, candidate);
      if (result) matches.push({leadId: canonicalUuid(lead.id), name: lead.contact?.fullName ?? lead.fullName, status: lead.status, reasons: result.reasons, listingTitle: result.listing.title, link: `/leads/${canonicalUuid(lead.id)}`});
    }
    if (page.leads.length < 100) break;
  }
  return {
    propertyAvailable: candidate.inventoryStatus === "AVAILABLE" && !property.archivedAt,
    // Leads that meet more of the recorded criteria first.
    matches: matches.sort((left, right) => right.reasons.length - left.reasons.length).slice(0, 50), totalMatches: matches.length, coverage: {leadsReviewed: reviewed, leadsInScope: total},
    note: candidate.inventoryStatus !== "AVAILABLE" ? "This property is not available, so it is not matched to leads." : null,
  };
}

/** Upcoming and recent viewings of a property, for "Prepare viewing summary" on the property page. */
export async function propertyViewings(context: Context, propertyId: string) {
  if (!hasInventoryScope(context)) throw new WorkspaceError("FORBIDDEN", 403, "Viewings need inventory access, which your role does not have.");
  await getInventoryRecordRequired("properties", {id: propertyId});
  const now = Date.now();
  const {viewings} = await listViewings(context, {from: new Date(now - 14 * 86_400_000).toISOString(), to: new Date(now + 60 * 86_400_000).toISOString(), propertyId});
  return viewings.map(item => ({id: item.id, leadId: item.leadId, leadName: item.lead.fullName, scheduledAt: item.scheduledAt, status: item.status, customerConfirmation: item.customerConfirmation}));
}

// --- Dashboard -----------------------------------------------------------------------

async function scopedLeads(context: Context, scope: DashboardScope) {
  const {request, organizationId} = context;
  const rows: Array<DashboardLead & {assignedName: string | null; branchName: string | null}> = [];
  let total = 0;
  for (let offset = 0; offset < 1000; offset += 100) {
    const page = await executeWorkspaceOperation(() => sql.listLeads(request.dc, {organizationId, limit: 100, offset, activeOnly: true}, request.options), "ListLeads");
    total = page.total[0]?.count ?? 0;
    for (const lead of page.leads) rows.push({
      id: canonicalUuid(lead.id), status: lead.status, archived: Boolean(lead.archivedAt), assignedMembershipId: lead.assignedMembershipId ? canonicalUuid(lead.assignedMembershipId) : null,
      branchId: lead.branchId ? canonicalUuid(lead.branchId) : null, followUpAt: lead.followUpAt ?? null, createdAt: lead.createdAt, updatedAt: lead.updatedAt,
      assignedName: lead.assignedMembership ? lead.assignedMembership.userProfile?.displayName || lead.assignedMembership.email : null, branchName: lead.branch?.name ?? null,
    });
    if (page.leads.length < 100) break;
  }
  const agents = new Map<string, string>();
  const branches = new Map<string, string>();
  for (const row of rows) {
    if (row.assignedMembershipId && row.assignedName) agents.set(row.assignedMembershipId, row.assignedName);
    if (row.branchId && row.branchName) branches.set(row.branchId, row.branchName);
  }
  const inScope = rows.filter(row => scope.kind === "agent" ? same(row.assignedMembershipId, scope.id) : scope.kind === "branch" ? same(row.branchId, scope.id) : true);
  return {rows: inScope, complete: rows.length >= total, loaded: rows.length, total, agents: [...agents].map(([id, name]) => ({id, name})), branches: [...branches].map(([id, name]) => ({id, name}))};
}

async function matchingInventorySample(context: Context, leads: DashboardLead[]) {
  if (!hasInventoryScope(context)) return null;
  const sample = leads.filter(lead => !["WON", "LOST", "CONVERTED"].includes(lead.status)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 20);
  const properties = new Set<string>();
  let withMatches = 0;
  for (let index = 0; index < sample.length; index += 5) {
    const results = await Promise.allSettled(sample.slice(index, index + 5).map(lead => getLeadPropertyData({leadId: lead.id})));
    for (const result of results) {
      if (result.status !== "fulfilled") continue;
      if (result.value.matches.length) withMatches += 1;
      for (const match of result.value.matches) properties.add(match.property.id);
    }
  }
  return {leadsChecked: sample.length, leadsWithMatches: withMatches, distinctMatchingProperties: properties.size, sampleRule: "The 20 most recently updated open leads"};
}

export async function salesDashboard(context: Context, scope: DashboardScope) {
  const now = new Date();
  const since = (days: number) => new Date(now.getTime() - days * 86_400_000).toISOString();
  const [leads, assessments, viewings, activity] = await Promise.all([
    scopedLeads(context, scope),
    listRecentAssessments(context, since(ASSESSMENT_WINDOW_DAYS)),
    listViewings(context, {from: since(30), to: new Date(now.getTime() + 30 * 86_400_000).toISOString()}),
    listActivity(context, since(TREND_DAYS)),
  ]);
  const administrator = context.membership.role === "OWNER" || context.membership.role === "ADMIN";
  const metrics = computeSalesMetrics({
    now: now.toISOString(), leads: leads.rows, showUnassigned: administrator && scope.kind === "company",
    assessments: assessments.assessments.map(row => ({id: row.id, leadId: row.leadId, priority: row.priority as AiLeadPriority, evaluatedAt: row.evaluatedAt})),
    reviews: assessments.reviews.map(row => ({leadId: row.leadId, assessmentId: row.assessmentId, reviewedPriority: row.reviewedPriority as AiLeadPriority, createdAt: row.createdAt})),
    viewings: viewings.viewings.map(row => ({leadId: row.leadId, scheduledAt: row.scheduledAt, status: row.status, customerConfirmation: row.customerConfirmation})),
    activities: activity.activities.map(row => ({leadId: row.leadId, kind: row.kind, createdAt: row.createdAt})),
  });
  const matching = await matchingInventorySample(context, leads.rows);
  const config = aiConfiguration();
  return {
    scope: scope.kind === "mine" ? {kind: "mine", label: "Leads assigned to you"} : scope.kind === "company" ? {kind: "company", label: "Whole company"}
      : {kind: scope.kind, id: scope.id, label: (scope.kind === "agent" ? leads.agents : leads.branches).find(item => same(item.id, scope.id))?.name ?? "Selected"},
    scopeOptions: administrator ? {agents: leads.agents, branches: leads.branches} : null,
    role: context.membership.role,
    metrics,
    matchingInventory: matching,
    coverage: {leadsLoaded: leads.loaded, leadsInScope: leads.total, leadsComplete: leads.complete, assessmentsComplete: assessments.complete, viewingsComplete: viewings.complete, activityComplete: activity.complete},
    aiAvailable: config.ok,
    recentSummaries: await listMySummaries(context).catch(() => []),
  };
}

export async function pipelineSummaryResponse(request: Request, context: Context, scope: DashboardScope) {
  const config = requireAiConfig();
  await enforceSalesRateLimit(request, context, "ai", config);
  const dashboard = await salesDashboard(context, scope);
  const facts = {scope: dashboard.scope.label, metrics: dashboard.metrics, matchingInventory: dashboard.matchingInventory, coverage: dashboard.coverage,
    priorityLabels: Object.fromEntries(AI_LEAD_PRIORITIES.map(key => [key, PRIORITY_LABELS[key]]))};
  const {output, model} = await runClaude<PipelineSummaryOutput>(context, config, "PIPELINE_SUMMARY", salesFactsPrompt(facts), PIPELINE_SUMMARY_JSON, pipelineSummaryZod);
  const unverified = unverifiedFigures([output.headline, ...output.observations, ...output.suggestedFocus], [...metricNumbers(facts), 7, 14, 20, 30, 90]);
  const id = randomUUID();
  await recordInsight(context, {id, kind: "PIPELINE_SUMMARY", model, content: {schemaVersion: 1, summary: output, unverifiedFigures: unverified, scope: dashboard.scope.label, metricsAsOf: dashboard.metrics.asOf}});
  return {id: id as string, summary: output, unverifiedFigures: unverified, scope: dashboard.scope.label, createdAt: new Date().toISOString(), model};
}

export async function getSummary(context: Context, id: string) {
  const insight = await getInsight(context, id);
  if (insight.kind !== "PIPELINE_SUMMARY") throw new WorkspaceError("NOT_FOUND", 404, "This AI result was not found.");
  return {id: insight.id, createdAt: insight.createdAt, model: insight.model, content: JSON.parse(insight.content) as unknown};
}

export type LeadIntelligenceView = Awaited<ReturnType<typeof getLeadIntelligence>>;
export type SalesDashboardView = Awaited<ReturnType<typeof salesDashboard>>;
export type PipelineSummaryView = Awaited<ReturnType<typeof pipelineSummaryResponse>>;
export type FollowUpSuggestionView = FollowUpSuggestion;
export type QualificationView = QualificationResult;

/** Copilot tool result: live rule-based evaluation without storing it. No contact details or note text. */
export async function liveQualification(context: Context, leadId: string) {
  const state = await loadLeadState(context, leadId);
  const evaluation = evaluateState(state);
  const stored = state.records.assessments[0] ?? null;
  const review = stored ? state.records.reviews.find(item => item.assessmentId === stored.id) ?? null : null;
  return {
    link: `/leads/${state.leadId}`, calculatedBy: "EstateOS rules (not the AI)", ruleVersion: evaluation.result.ruleVersion,
    state: evaluation.result.state, score: evaluation.result.score, priority: PRIORITY_LABELS[evaluation.result.priority],
    factors: evaluation.result.factors.map(factor => ({factor: factor.label, status: factor.status, points: factor.points, maxPoints: factor.maxPoints, evidence: factor.evidence})),
    missingInformation: evaluation.result.missing.map(item => item.label),
    storedAssessment: stored ? {score: stored.score ?? null, priority: PRIORITY_LABELS[stored.priority as AiLeadPriority], evaluatedAt: stored.evaluatedAt,
      reviewedPriority: review ? PRIORITY_LABELS[review.reviewedPriority as AiLeadPriority] : null} : "No assessment has been stored for this lead yet.",
    followUpSuggestions: evaluation.suggestions.map(item => ({severity: item.severity, title: item.title})),
    note: "Advisory only. Never use the score to refuse or limit service to a customer.",
  };
}
