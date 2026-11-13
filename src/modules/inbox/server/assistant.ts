import "server-only";

import { randomUUID } from "node:crypto";
import { z } from "zod";
import { enforceRateLimit, requestClientIp } from "@/lib/rate-limit/server";
import type { AiConfig } from "@/modules/ai/config";
import { modelStreamFactory, requireAiConfig } from "@/modules/ai/server/anthropic";
import { logAndMapProviderError } from "@/modules/ai/server/chat";
import { reserveQuota } from "@/modules/ai/server/store";
import { generateStructured, type StructuredResult } from "@/modules/ai/structured";
import { asMember, isDuplicate, sdk, serverDataConnect, type Context } from "@/modules/communications/server/data";
import { recordCommunicationAiUsage } from "@/modules/communications/server/intelligence";
import { parseInput } from "@/modules/communications/server/validation";
import { getLeadPropertyData } from "@/modules/leads/server/property-service";
import { getLeadInContext, updateLead } from "@/modules/leads/server/service";
import { WorkspaceError, mapWorkspaceDataError } from "@/modules/organizations/server/errors";
import { canonicalUuid } from "@/modules/organizations/server/identifiers";
import {
  ASSISTANT_JSON, ASSISTANT_PROMPT_VERSION, ASSISTANT_SYSTEM_PROMPT, ASSISTANT_TASK, MAX_LISTINGS, MAX_SOURCE_MESSAGES, REQUIREMENT_FIELDS, assistantFacts, assistantWireZod, checkInsight, leadFieldOf, messageLines,
  type AssistantWire, type CheckedInsight, type LeadRecord, type ListingFact, type RequirementField,
} from "../assistant";
import { customerContext, getConversation } from "./conversations";

/*
 * The inbox assistant (docs/UNIFIED_INBOX.md#assistant). One Claude request
 * (feature INBOX_AI, the company's AI allowance and usage records) over a
 * conversation the member may see, when an OWNER or ADMIN has turned Claude on
 * for the inbox. The result is advice and a draft: requirements change the lead
 * only when a member reviews and applies them, and the draft goes through the
 * normal reply checks and approval. Nothing is sent.
 */

const MAX_OUTPUT_TOKENS = 4000;
const SOURCE_LIMIT_CHARS = 60_000;
const MESSAGES = {
  refused: "Claude declined to analyse this conversation.",
  incomplete: "Claude's answer was cut off. Try again.",
  invalid: "Claude returned an answer in an unexpected format. Try again.",
  cancelled: "The analysis was stopped.",
};
const priceText = (minor: string, currency: string, purpose: string, period?: string | null) =>
  `${currency} ${(Number(minor) / 100).toLocaleString("en-US", {maximumFractionDigits: 0})}${purpose === "RENT" && period ? ` per ${period === "MONTHLY" ? "month" : "year"}` : ""}`;

async function enforceRate(request: Request, context: Context, config: AiConfig) {
  await enforceRateLimit([
    {rule: {scope: "ai.inbox.member", limit: config.requestsPerMinutePerMember, windowSeconds: 60}, subject: context.membership.id},
    {rule: {scope: "ai.inbox.ip", limit: config.requestsPerMinutePerMember * 4, windowSeconds: 60}, subject: requestClientIp(request) ?? ""},
    {rule: {scope: "ai.inbox.company", limit: config.requestsPerMinutePerOrganization, windowSeconds: 60}, subject: context.organizationId},
  ], "You are using the inbox assistant too quickly. Wait a moment and try again.");
}

async function aiEnabled(context: Context) {
  const data = await asMember(context, "GetInboxSettings", (dc, options) => sdk.getInboxSettings(dc, {organizationId: context.organizationId}, options));
  return data.settings?.aiEnabled ?? false;
}

/** What Claude may read, as the member sees it: the newest messages, the linked lead's requirements and the listings EstateOS matched for it. */
async function assistantSources(context: Context, conversationId: string) {
  const conversation = await getConversation(context, conversationId);
  const page = await asMember(context, "ListInboxMessages", (dc, options) => sdk.listInboxMessages(dc, {organizationId: context.organizationId, conversationId: conversation.id, limit: MAX_SOURCE_MESSAGES}, options));
  const lines = messageLines([...page.messages].reverse());
  const customer = await customerContext(context, conversation.id);
  const lead = customer.lead && !customer.lead.archivedAt ? customer.lead : null;
  const record: LeadRecord | null = lead ? {propertyType: lead.propertyType, preferredLocation: lead.preferredLocation, bedroomPreference: lead.bedroomPreference,
    budgetMin: lead.budgetMin, budgetMax: lead.budgetMax, transactionType: lead.transactionType, currency: lead.currency} : null;
  let listings: ListingFact[] = [];
  // Matching is the existing permitted lead-property matching (available inventory, active listings, the lead's recorded requirements).
  if (lead && ["OWNER", "ADMIN", "AGENT"].includes(context.membership.role)) {
    try {
      const data = await getLeadPropertyData({leadId: lead.id}, context);
      listings = data.matches.slice(0, MAX_LISTINGS).map((match, index) => ({
        ref: `L${index + 1}`, listingId: canonicalUuid(match.listing.id), propertyId: canonicalUuid(match.property.id), title: match.listing.title.slice(0, 160), reference: match.property.propertyReference,
        location: [match.property.area, match.property.community, match.property.emirate].filter(Boolean).join(", ") || match.property.project?.projectName || "Location not recorded",
        propertyType: match.property.propertyType.replaceAll("_", " ").toLowerCase(), bedrooms: match.property.bedrooms ?? null,
        price: priceText(match.listing.askingPriceMinor, match.listing.currency, match.listing.listingPurpose, match.listing.rentalPeriod), purpose: match.listing.listingPurpose,
      }));
    } catch (error) {
      if (!(error instanceof WorkspaceError && error.status < 500)) throw error;
    }
  }
  return {conversation, lines, record, listings, coveredUntil: page.messages[0]?.createdAt ?? null};
}

/** One Claude request over the checked sources; the result is checked before anything is stored. */
async function analyse(context: Context, sources: Awaited<ReturnType<typeof assistantSources>>) {
  const config = requireAiConfig();
  const facts = assistantFacts({channel: sources.conversation.channel, lines: sources.lines, lead: sources.record, listings: sources.listings});
  if (facts.length > SOURCE_LIMIT_CHARS) throw new WorkspaceError("VALIDATION_ERROR", 400, "This conversation is too long to analyse in one request.");
  const reservation = await reserveQuota(context, config);
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(new WorkspaceError("AI_TIMEOUT", 504, "Claude took too long to respond. Try again.")), config.requestTimeoutMs + 5_000);
  let result: StructuredResult<AssistantWire>;
  try {
    result = await generateStructured({
      config, maxOutputTokens: Math.min(config.maxOutputTokens, MAX_OUTPUT_TOKENS), system: ASSISTANT_SYSTEM_PROMPT, factsText: facts, instructionsText: ASSISTANT_TASK,
      jsonSchema: ASSISTANT_JSON, zod: assistantWireZod, createStream: modelStreamFactory(config), signal: controller.signal, mapError: logAndMapProviderError, messages: MESSAGES,
    });
  } finally { clearTimeout(timeout); }
  if (result.status !== "SUCCEEDED" && result.usage.modelRequests === 0) await reservation.release();
  const usage = await recordCommunicationAiUsage(context, config, {result: result as StructuredResult<unknown>, durationMs: Date.now() - startedAt, feature: "INBOX_AI", contentType: "INBOX_ANALYSIS", promptVersion: ASSISTANT_PROMPT_VERSION});
  console.info(JSON.stringify({event: "ai.inbox_analysis", status: result.status, errorCode: result.error?.code ?? null, model: usage.model, inputTokens: result.usage.inputTokens, outputTokens: result.usage.outputTokens, durationMs: Date.now() - startedAt}));
  if (result.status !== "SUCCEEDED" || !result.output) throw result.error ?? new WorkspaceError("AI_UNAVAILABLE", 503, "Claude could not analyse the conversation. Try again.");
  return {checked: checkInsight(result.output, {lines: sources.lines, lead: sources.record, listings: sources.listings}), model: usage.model};
}

/** Stores the checked analysis and, when Claude suggested one, a reply DRAFT (never sent). */
async function store(context: Context, input: {insightId: string; draftJobId: string; conversationId: string; checked: CheckedInsight; model: string; coveredUntil: string | null; source: "CLAUDE" | "WORKFLOW";
  /** False when the reply goes to the member's message box instead (it is saved from there). */ saveDraft?: boolean}) {
  const hasDraft = Boolean(input.checked.reply) && input.saveDraft !== false;
  await sdk.saveInboxAiInsight(serverDataConnect(), {
    organizationId: context.organizationId, id: input.insightId, conversationId: input.conversationId, actorUid: context.request.user.uid, insightJson: JSON.stringify(input.checked).slice(0, 24_000),
    unverifiedCount: input.checked.unverifiedCount, coveredUntil: input.coveredUntil, model: input.model.slice(0, 80), promptVersion: ASSISTANT_PROMPT_VERSION, source: input.source,
    hasDraft, draftJobId: hasDraft ? input.draftJobId : null, draftContent: hasDraft ? input.checked.reply.slice(0, 2000) : "",
  });
}

/**
 * A member asks Claude to analyse the conversation. With `target: "composer"` (Draft with Claude in the message
 * box) the suggested reply is returned for the member to edit instead of being saved as a separate draft; saving it
 * from the box keeps it a Claude draft (createReply, fromInsightId).
 */
export async function analyseConversation(request: Request, context: Context, rawConversationId: string, body: unknown = {}) {
  const composer = typeof body === "object" && body !== null && (body as {target?: unknown}).target === "composer";
  await getConversation(context, rawConversationId); // not found before anything else
  if (!await aiEnabled(context)) throw new WorkspaceError("INBOX_AI_DISABLED", 409, "Claude is not turned on for the inbox. An owner or administrator can enable it in Inbox settings.");
  const config = requireAiConfig();
  await enforceRate(request, context, config);
  const sources = await assistantSources(context, rawConversationId);
  if (!sources.lines.length) throw new WorkspaceError("VALIDATION_ERROR", 400, "There are no messages with text to analyse yet.");
  const {checked, model} = await analyse(context, sources);
  const insightId = randomUUID(), draftJobId = randomUUID();
  try { await store(context, {insightId, draftJobId, conversationId: sources.conversation.id, checked, model, coveredUntil: sources.coveredUntil, source: "CLAUDE", saveDraft: !composer}); }
  catch (error) { throw mapWorkspaceDataError(error); }
  return {insightId, draftJobId: checked.reply && !composer ? draftJobId : null, draft: composer ? checked.reply || null : null, unverifiedCount: checked.unverifiedCount, proposedChanges: checked.proposedChanges.length};
}

/**
 * The workflow step inbox.draft_reply, as the workflow's executor. Skipped (not
 * failed) when Claude is off for the inbox or there is nothing to read; a
 * repeated step finds its stored analysis instead of calling Claude again.
 */
export async function draftReplyForWorkflow(context: Context, conversationId: string, ids: {insightId: string; draftJobId: string}):
  Promise<{status: "SKIPPED"; reason: string} | {status: "SUCCEEDED"; claude: boolean; draftJobId: string | null}> {
  if (!await aiEnabled(context)) return {status: "SKIPPED", reason: "Claude is off for the inbox (Inbox settings)."};
  let sources: Awaited<ReturnType<typeof assistantSources>>;
  try { sources = await assistantSources(context, conversationId); }
  catch (error) { if (error instanceof WorkspaceError && error.status === 404) return {status: "SKIPPED", reason: "The workflow's executor cannot read this conversation."}; throw error; }
  const existing = await asMember(context, "ListInboxReplies", (dc, options) => sdk.listInboxReplies(dc, {organizationId: context.organizationId, conversationId: sources.conversation.id}, options));
  if (existing.conversation?.insights.some(row => canonicalUuid(row.id) === ids.insightId)) return {status: "SUCCEEDED", claude: false, draftJobId: ids.draftJobId};
  if (!sources.lines.length) return {status: "SKIPPED", reason: "The conversation has no text messages yet."};
  const {checked, model} = await analyse(context, sources);
  try { await store(context, {...ids, conversationId: sources.conversation.id, checked, model, coveredUntil: sources.coveredUntil, source: "WORKFLOW"}); }
  catch (error) { if (!isDuplicate(error)) throw mapWorkspaceDataError(error); }
  return {status: "SUCCEEDED", claude: true, draftJobId: checked.reply ? ids.draftJobId : null};
}

const applySchema = z.strictObject({insightId: z.uuid(), fields: z.array(z.enum(REQUIREMENT_FIELDS.filter(field => field !== "NONE") as [RequirementField, ...RequirementField[]])).min(1).max(6)});

/**
 * Applies requirements a member reviewed to the linked lead, through the normal
 * lead update (its permissions, validation and activity log). Only verified,
 * stated requirements from the latest analysis can be applied, and only fields
 * whose value still differs from the lead's.
 */
export async function applyRequirements(context: Context, rawConversationId: string, body: unknown) {
  const input = parseInput(applySchema, body);
  const conversation = await getConversation(context, rawConversationId);
  if (!conversation.leadId) throw new WorkspaceError("VALIDATION_ERROR", 400, "Link this conversation to a lead first.");
  const data = await asMember(context, "ListInboxReplies", (dc, options) => sdk.listInboxReplies(dc, {organizationId: context.organizationId, conversationId: conversation.id}, options));
  const latest = data.conversation?.insights[0];
  if (!latest || canonicalUuid(latest.id) !== canonicalUuid(input.insightId)) throw new WorkspaceError("CONFLICT", 409, "A newer analysis exists. Review it before applying requirements.");
  const insight = JSON.parse(latest.insightJson) as CheckedInsight;
  const {lead} = await getLeadInContext(context, {leadId: conversation.leadId});
  if (!lead || lead.archivedAt) throw new WorkspaceError("NOT_FOUND", 404, "The linked lead was not found, or you cannot change it.");
  const changes = insight.proposedChanges.filter(change => input.fields.includes(change.field));
  const update: Record<string, unknown> = {};
  const applied: Array<{field: RequirementField; before: unknown; after: unknown}> = [];
  for (const change of changes) {
    const key = leadFieldOf(change.field);
    const before = (lead as unknown as Record<string, unknown>)[key] ?? null;
    if (before !== null && String(before).toLowerCase() === String(change.value).toLowerCase()) continue;
    update[key] = change.value;
    applied.push({field: change.field, before, after: change.value});
  }
  if (!applied.length) return {leadId: conversation.leadId, applied};
  // The full record, as the lead form sends it, with only the reviewed fields changed (absent optional values stay absent).
  await updateLead({
    leadId: conversation.leadId, status: lead.status, fullName: lead.fullName, email: lead.email ?? null, phone: lead.phone ?? null, alternatePhone: lead.contact?.alternatePhone ?? null,
    nationality: lead.contact?.nationality ?? null, sourceId: lead.sourceId ?? null, source: lead.source ?? null, propertyInterest: lead.propertyInterest ?? null,
    preferredLocation: lead.preferredLocation ?? null, propertyType: lead.propertyType ?? null, transactionType: lead.transactionType ?? undefined, budgetMin: lead.budgetMin ?? null,
    budgetMax: lead.budgetMax ?? null, currency: lead.currency ?? undefined, bedroomPreference: lead.bedroomPreference ?? null, priority: lead.priority ?? undefined,
    branchId: lead.branchId ?? null, assignedMembershipId: lead.assignedMembershipId ?? null, ...update,
  }, context.organizationId);
  return {leadId: conversation.leadId, applied};
}

