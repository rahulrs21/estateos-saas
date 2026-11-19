import "server-only";

import { randomUUID } from "node:crypto";
import type { z } from "zod";
import * as sql from "@dataconnect/admin-generated";
import { executeWorkspaceOperation } from "@/lib/firebase/dataconnect";
import type { RateLimitRule } from "@/lib/rate-limit/limiter";
import { enforceRateLimit, requestClientIp } from "@/lib/rate-limit/server";
import { getBrand } from "@/modules/ai/content/server/store";
import type { requireActiveOrganizationRequest } from "@/modules/organizations/server/context";
import { WorkspaceError } from "@/modules/organizations/server/errors";
import { canonicalUuid } from "@/modules/organizations/server/identifiers";
import { estimateCostUsd, pricingFor, type AiConfig } from "../../ai/config";
import { contentStreamFactory, requireAiConfig } from "../../ai/server/anthropic";
import { logAndMapProviderError } from "../../ai/server/chat";
import { reserveQuota } from "../../ai/server/store";
import { generateStructured, type StructuredResult } from "../../ai/structured";
import {
  PAGE_GENERATION_JSON, PAGE_PROMPT_VERSION, PAGE_SYSTEM_PROMPT, mapGeneratedPage, pageFactWarnings, pageFactsPrompt, pageGenerationZod, pageTaskPrompt,
  serializePageValidation, type PageGenerationOutput,
} from "../ai";
import type { LinkedData } from "../linked";
import { generationRequestProblem, generatePageSchema, regeneratePageSchema } from "../policy";
import { isReservedSlug, slugify } from "../registry";
import { resolveStructure, type PageStructure } from "../structures";
import { PAGE_TEMPLATES } from "../templates";
import { editorMediaUrl, loadLinkedData, pageRefsOf } from "./sources";
import { addGeneratedVersion, availableSlug, createGeneratedPage, getPage, getVersion, listPages, slugTaken } from "./store";

type Context = Awaited<ReturnType<typeof requireActiveOrganizationRequest>>;

/*
 * Claude page generation (docs/AI_PAGE_BUILDER.md#claude-generation).
 * Order: verified session and company (http.ts) → request validation → rate
 * limits → every linked record re-read with the caller's permissions →
 * monthly allowance → one structured-output request → mapping and registry
 * validation → fact check → stored draft. Nothing is stored unless the whole
 * page validates, so a failure never changes an existing draft. No lead or
 * contact data is read for page generation.
 */

function rateLimitRules(config: AiConfig) {
  return {
    member: {scope: "ai.pages.member", limit: Math.max(1, Math.floor(config.requestsPerMinutePerMember / 2)), windowSeconds: 60},
    ip: {scope: "ai.pages.ip", limit: config.requestsPerMinutePerMember * 2, windowSeconds: 60},
    company: {scope: "ai.pages.company", limit: config.requestsPerMinutePerOrganization, windowSeconds: 60},
  } satisfies Record<string, RateLimitRule>;
}

async function enforcePageRateLimit(request: Request, config: AiConfig, context: Context) {
  const rules = rateLimitRules(config);
  await enforceRateLimit([
    {rule: rules.member, subject: context.membership.id},
    {rule: rules.ip, subject: requestClientIp(request) ?? ""},
    {rule: rules.company, subject: context.organizationId},
  ], "You are generating pages too quickly. Wait a moment and try again.");
}

const MESSAGES = {
  refused: "Claude declined to write this page. Review the brief and try again.",
  incomplete: "Claude's page was cut off before it was complete. Try a shorter brief.",
  invalid: "Claude returned a page in an unexpected format. Try again.",
  cancelled: "Generation was stopped.",
};

async function runClaude(context: Context, config: AiConfig, linked: LinkedData, branding: Awaited<ReturnType<typeof getBrand>>["approved"], task: {brief: string; style: Parameters<typeof pageTaskPrompt>[0]["style"]; structure: PageStructure | null; templateHint: string | null; hasForm: boolean}) {
  const reservation = await reserveQuota(context, config);
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(new WorkspaceError("AI_TIMEOUT", 504, "Claude took too long to design this page. Try again.")), config.contentRequestTimeoutMs + 5_000);
  let result: StructuredResult<PageGenerationOutput>;
  try {
    result = await generateStructured({
      config, maxOutputTokens: Math.max(config.contentMaxOutputTokens, 16_000), system: PAGE_SYSTEM_PROMPT,
      factsText: pageFactsPrompt(linked, branding, task.hasForm), instructionsText: pageTaskPrompt(task),
      jsonSchema: PAGE_GENERATION_JSON, zod: pageGenerationZod, createStream: contentStreamFactory(config), signal: controller.signal,
      mapError: logAndMapProviderError, messages: MESSAGES,
    });
  } finally { clearTimeout(timeout); }
  // A request that never reached Claude does not use the allowance.
  if (result.status !== "SUCCEEDED" && result.usage.modelRequests === 0) await reservation.release();
  return {result, durationMs: Date.now() - startedAt};
}

/** One AiUsageRecord per generation, feature PAGES. Never includes facts, brief or page text. */
async function recordPageUsage(context: Context, config: AiConfig, input: {usageId: string; result: StructuredResult<unknown>; status: "SUCCEEDED" | "FAILED" | "CANCELLED"; errorCode: string | null; durationMs: number}) {
  const {request, organizationId} = context;
  const model = input.result.servedModel ?? config.model;
  const estimatedCostUsd = estimateCostUsd(model === config.model ? config.pricing : pricingFor(model), input.result.usage);
  try {
    await executeWorkspaceOperation(() => sql.recordAiUsage(request.dc, {
      organizationId, id: input.usageId, userUid: request.user.uid, conversationId: null, model: model.slice(0, 80), promptVersion: PAGE_PROMPT_VERSION,
      status: sql.AiRequestStatus[input.status], errorCode: input.errorCode?.slice(0, 40) ?? null,
      inputTokens: input.result.usage.inputTokens, outputTokens: input.result.usage.outputTokens, cacheReadInputTokens: input.result.usage.cacheReadInputTokens,
      cacheCreationInputTokens: input.result.usage.cacheCreationInputTokens, estimatedCostUsd, modelRequests: input.result.usage.modelRequests, toolCalls: 0,
      durationMs: Math.min(input.durationMs, 2_147_483_647), feature: "PAGES", contentType: "LANDING_PAGE",
    }), "RecordAiUsage");
  } catch (error) {
    console.error(JSON.stringify({event: "ai.usage.record_failed", usageId: input.usageId, feature: "PAGES", model, code: error instanceof WorkspaceError ? error.code : "ERROR"}));
  }
  return {model, estimatedCostUsd};
}

async function finish(context: Context, config: AiConfig, run: Awaited<ReturnType<typeof runClaude>>, save: (output: PageGenerationOutput, model: string) => Promise<Record<string, unknown>>) {
  const {result} = run;
  let saved: Record<string, unknown> | null = null;
  let error = result.error;
  if (result.status === "SUCCEEDED" && result.output) {
    try { saved = await save(result.output, (result.servedModel ?? config.model).slice(0, 80)); } catch (failure) {
      error = failure instanceof WorkspaceError && failure.code === "CONFLICT"
        ? new WorkspaceError("AI_SAVE_FAILED", 409, "The page changed while Claude was writing, so the new version was not saved. Reload and try again.")
        : failure instanceof WorkspaceError && failure.status < 500 ? failure : new WorkspaceError("AI_SAVE_FAILED", 503, "Claude's page could not be saved. Your existing page is unchanged. Try again.");
    }
  }
  const status = saved ? "SUCCEEDED" : result.status === "CANCELLED" ? "CANCELLED" : "FAILED";
  const usage = await recordPageUsage(context, config, {usageId: randomUUID(), result: result as StructuredResult<unknown>, status, errorCode: saved ? null : error?.code ?? "AI_ERROR", durationMs: run.durationMs});
  console.info(JSON.stringify({event: "ai.pages", status, errorCode: saved ? null : error?.code ?? null, model: usage.model, role: context.membership.role,
    inputTokens: result.usage.inputTokens, outputTokens: result.usage.outputTokens, cacheReadInputTokens: result.usage.cacheReadInputTokens, estimatedCostUsd: usage.estimatedCostUsd, durationMs: run.durationMs}));
  if (!saved) throw error ?? new WorkspaceError("AI_UNAVAILABLE", 503, "Claude could not design this page. Try again.");
  return saved;
}

/**
 * Validates a generation request with a message that names the problem (the
 * title, the brief, a choice that is not in the list, an out-of-date form).
 * Only field names and issue codes are logged, never the values.
 */
function parseGenerationRequest<T>(schema: z.ZodType<T>, raw: unknown, endpoint: string): T {
  const result = schema.safeParse(raw);
  if (result.success) return result.data;
  console.warn(JSON.stringify({event: "websites.generate.invalid_request", endpoint, issues: result.error.issues.slice(0, 5).map(issue => ({path: issue.path.join(".").slice(0, 40), code: issue.code}))}));
  throw new WorkspaceError("VALIDATION_ERROR", 400, generationRequestProblem(result.error.issues));
}

/** POST /api/websites/pages/generate: a new draft page from Claude. */
export async function generateNewPage(request: Request, context: Context, raw: unknown) {
  const config = requireAiConfig();
  const input = parseGenerationRequest(generatePageSchema, raw, "generate");
  const overview = await listPages(context, ["DRAFT"], 1);
  if (context.membership.role === "AGENT" && !overview.website.allowAgentDrafts) throw new WorkspaceError("FORBIDDEN", 403, "Agents can create pages only when an owner or administrator allows agent drafts.");
  const requested = input.slug ?? slugify(input.title);
  if (isReservedSlug(requested)) throw new WorkspaceError("VALIDATION_ERROR", 400, "This page address is reserved. Choose another.");
  if (input.slug && await slugTaken(context, input.slug)) throw new WorkspaceError("CONFLICT", 409, "Another page already uses this address. Choose another.");
  await enforcePageRateLimit(request, config, context);
  const sources = {projectId: input.projectId ?? null, propertyId: input.propertyId ?? null, listingId: input.listingId ?? null};
  const brand = await getBrand(context);
  // Every source is re-read with the caller's permissions before any allowance is used or data leaves EstateOS.
  const linked = await loadLinkedData(context, sources, {branding: brand.approved, mediaUrl: editorMediaUrl, required: true});
  const template = input.templateKey ? PAGE_TEMPLATES[input.templateKey] : null;
  const style = input.style ?? template?.style ?? null;
  const structure = resolveStructure(style, input.structure);
  const run = await runClaude(context, config, linked, brand.approved, {
    brief: input.brief, style, structure, templateHint: template ? `${template.name}: ${template.sections.join(", ")}` : null, hasForm: false,
  });
  return finish(context, config, run, async (output, model) => {
    const mapped = mapGeneratedPage(output, linked, {hasForm: false, fallbackTitle: input.title, style, structure});
    const warnings = pageFactWarnings(mapped.data, linked, brand.approved, {title: input.title, seoTitle: mapped.seoTitle, seoDescription: mapped.seoDescription});
    const id = randomUUID();
    const slug = input.slug ?? await availableSlug(context, requested);
    await createGeneratedPage(context, {
      id, websiteId: overview.website.id, title: input.title, slug, description: null, seoTitle: mapped.seoTitle, seoDescription: mapped.seoDescription || null,
      designStyle: mapped.data.theme.style, data: mapped.data, model, sources,
      validation: serializePageValidation({
        schemaVersion: 1, checkedAt: new Date().toISOString(), warnings, missingInformation: [...output.missingInformation, ...linked.unavailable].slice(0, 20),
        claimsToReview: output.claimsToReview.slice(0, 20), removed: mapped.removed, omitted: mapped.omitted,
        generated: {model, promptVersion: PAGE_PROMPT_VERSION, factsReadAt: linked.readAt},
      }),
    });
    return {pageId: id, slug, versionNumber: 1, warnings: warnings.length, omitted: mapped.omitted, removed: mapped.removed, structure: mapped.structure};
  });
}

/** POST /api/websites/pages/{id}/generate: a new generated version of an existing page. */
export async function regeneratePage(request: Request, context: Context, rawId: string, raw: unknown) {
  const config = requireAiConfig();
  const id = canonicalUuid(rawId);
  const input = parseGenerationRequest(regeneratePageSchema, raw, "regenerate");
  const stored = await getPage(context, id);
  const page = stored.page;
  if (page.revision !== input.expectedRevision) throw new WorkspaceError("CONFLICT", 409, "This page was changed in another window or by a colleague. Reload it and try again.");
  if (page.status === "ARCHIVED") throw new WorkspaceError("CONFLICT", 409, "Archived pages cannot be regenerated.");
  const ownDraftAllowed = page.createdByUid === context.request.user.uid && (context.membership.role === "MANAGER" || (context.membership.role === "AGENT" && page.website.allowAgentDrafts));
  if (context.membership.role !== "OWNER" && context.membership.role !== "ADMIN" && !ownDraftAllowed) throw new WorkspaceError("FORBIDDEN", 403, "You can regenerate only your own page drafts.");
  await enforcePageRateLimit(request, config, context);
  const current = await getVersion(context, id, page.currentVersionNumber);
  const brand = await getBrand(context);
  const sources = {projectId: page.sourceProjectId, propertyId: page.sourcePropertyId, listingId: page.sourceListingId};
  const linked = await loadLinkedData(context, {...sources, ...pageRefsOf(current.data)}, {branding: brand.approved, mediaUrl: editorMediaUrl, required: true});
  const hasForm = Boolean(stored.binding && stored.binding.form.status === "ACTIVE");
  const style = input.style ?? null;
  const structure = resolveStructure(style, input.structure);
  const run = await runClaude(context, config, linked, brand.approved, {brief: input.brief, style, structure, templateHint: null, hasForm});
  return finish(context, config, run, async (output, model) => {
    const mapped = mapGeneratedPage(output, linked, {hasForm, fallbackTitle: page.title, style, structure});
    const warnings = pageFactWarnings(mapped.data, linked, brand.approved, {title: page.title, seoTitle: mapped.seoTitle, seoDescription: mapped.seoDescription});
    const saved = await addGeneratedVersion(context, page, {
      expectedRevision: input.expectedRevision, title: page.title, seoTitle: mapped.seoTitle, seoDescription: mapped.seoDescription || null, designStyle: mapped.data.theme.style,
      data: mapped.data, model,
      validation: serializePageValidation({
        schemaVersion: 1, checkedAt: new Date().toISOString(), warnings, missingInformation: [...output.missingInformation, ...linked.unavailable].slice(0, 20),
        claimsToReview: output.claimsToReview.slice(0, 20), removed: mapped.removed, omitted: mapped.omitted,
        generated: {model, promptVersion: PAGE_PROMPT_VERSION, factsReadAt: linked.readAt},
      }),
    });
    return {pageId: id, versionNumber: saved.versionNumber, warnings: warnings.length, omitted: mapped.omitted, removed: mapped.removed};
  });
}
