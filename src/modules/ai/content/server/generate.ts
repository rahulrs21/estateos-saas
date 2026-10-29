import "server-only";

import { randomUUID } from "node:crypto";
import * as sql from "@dataconnect/admin-generated";
import { cookies } from "next/headers";
import { getSession } from "@/lib/auth/session";
import { executeWorkspaceOperation } from "@/lib/firebase/dataconnect";
import { assertExpectedOrganization, parseWorkspaceJsonRequest } from "@/lib/http/request-policy";
import type { RateLimitRule } from "@/lib/rate-limit/limiter";
import { enforceRateLimit, requestClientIp } from "@/lib/rate-limit/server";
import { authCookies, getAppOrigin } from "@/modules/auth/server/config";
import { AUTH_RESPONSE_HEADERS } from "@/modules/auth/server/http";
import { validateMutationRequest } from "@/modules/auth/server/request-policy";
import { leadErrorResponse } from "@/modules/leads/server/http";
import { requireActiveOrganizationRequest } from "@/modules/organizations/server/context";
import { WorkspaceError } from "@/modules/organizations/server/errors";
import { validateInput } from "@/modules/organizations/server/validation";
import { estimateCostUsd, pricingFor, type AiConfig } from "../../config";
import { isRetryableAiError } from "../../provider-errors";
import { contentStreamFactory, requireAiConfig } from "../../server/anthropic";
import { logAndMapProviderError } from "../../server/chat";
import { reserveQuota, type QuotaReservation } from "../../server/store";
import { isAdPlatform } from "../ad-limits";
import { CONTENT_CATALOG, localesFor, type ContentAudience, type ContentLanguage, type ContentLength, type ContentTone, type ContentType, type SourceSelection } from "../catalog";
import type { ApprovedBranding, FactSheet, SourceRef } from "../facts";
import { generateContent, type ContentGenerationResult } from "../generate";
import { draftGenerateSchema, draftIdSchema, generateRequestSchema, logUnexpectedContentError, parseContentInput, type GenerationSettings } from "../policy";
import { CONTENT_PROMPT_VERSION, factsPrompt, instructionsPrompt, type ContentTask } from "../prompt";
import { encodeContentEvent, type ContentStreamEvent } from "../protocol";
import { contentToPlainText, type ContentData } from "../schemas";
import { buildFactIndex, buildValidation, isEmptyContent, serializeValidation } from "../validate";
import { loadFacts } from "./sources";
import { addGeneratedVersion, createGeneratedDraft, getActiveTemplate, getBrand, getDraft, type StoredDraft } from "./store";

type Context = Awaited<ReturnType<typeof requireActiveOrganizationRequest>>;

function rateLimitRules(config: AiConfig) {
  return {
    member: {scope: "ai.content.member", limit: config.requestsPerMinutePerMember, windowSeconds: 60},
    ip: {scope: "ai.content.ip", limit: config.requestsPerMinutePerMember * 4, windowSeconds: 60},
    company: {scope: "ai.content.company", limit: config.requestsPerMinutePerOrganization, windowSeconds: 60},
  } satisfies Record<string, RateLimitRule>;
}

/** Origin, CSRF, session, configuration, organization, expected-company header and rate limits. */
async function authorizeGeneration(request: Request) {
  validateMutationRequest(request, {origin: getAppOrigin(), csrfToken: (await cookies()).get(authCookies().csrf.name)?.value});
  if (!await getSession()) throw new WorkspaceError("UNAUTHENTICATED", 401, "Sign in to continue.");
  const body = await parseWorkspaceJsonRequest(request);
  const config = requireAiConfig();
  if (!config.adLimits || !config.contentMaxInstructionsChars) {
    // A long-running dev server can keep an older AI configuration module loaded after an update.
    throw new WorkspaceError("AI_NOT_CONFIGURED", 503, "The AI Content Studio settings are not loaded on this server. Restart the EstateOS server and try again.");
  }
  const context = await requireActiveOrganizationRequest();
  assertExpectedOrganization(request.headers.get("x-estateos-organization"), context.organizationId);
  return {body, config, context};
}

async function enforceGenerationRateLimit(request: Request, config: AiConfig, context: Context) {
  const rules = rateLimitRules(config);
  await enforceRateLimit([
    {rule: rules.member, subject: context.membership.id},
    {rule: rules.ip, subject: requestClientIp(request) ?? ""},
    {rule: rules.company, subject: context.organizationId},
  ], "You are generating content too quickly. Wait a moment and try again.");
}

function assertRoleCanUse(context: Context, type: ContentType) {
  if (context.membership.role === "MANAGER" && CONTENT_CATALOG[type].needsInventory) {
    throw new WorkspaceError("FORBIDDEN", 403, "Your role has no inventory access in EstateOS, so this content type is unavailable. WhatsApp and email drafts for your leads are available.");
  }
}

async function templateInstructions(context: Context, templateId: string | null | undefined, type: ContentType, purpose: string) {
  if (!templateId) return null;
  const template = await getActiveTemplate(context, templateId);
  if (template.contentType !== type || (template.purpose && template.purpose !== purpose)) {
    throw new WorkspaceError("VALIDATION_ERROR", 400, "This template is for a different content type or purpose.");
  }
  return template.instructions;
}

interface Prepared {
  context: Context; config: AiConfig; reservation: QuotaReservation;
  type: ContentType; purpose: string; language: ContentLanguage; tone: ContentTone; audience: ContentAudience; length: ContentLength;
  facts: FactSheet; sources: SourceRef[]; branding: ApprovedBranding; settings: GenerationSettings;
  templateId: string | null; template: string | null; userInstructions: string | null;
  mode: ContentTask["mode"]; draft: StoredDraft | null; expectedRevision: number;
}

/** POST /api/ai/content/generate: a new draft from selected records. */
export async function generateDraftResponse(request: Request): Promise<Response> {
  let prepared: Prepared;
  try {
    const {body, config, context} = await authorizeGeneration(request);
    const input = parseContentInput(generateRequestSchema(config.contentMaxInstructionsChars), body);
    assertRoleCanUse(context, input.contentType);
    await enforceGenerationRateLimit(request, config, context);
    const selection: SourceSelection = {propertyId: input.propertyId, listingId: input.listingId, projectId: input.projectId, leadId: input.leadId, listingIds: input.listingIds};
    const template = await templateInstructions(context, input.templateId, input.contentType, input.purpose);
    // Every source is re-read with the caller's permissions before any quota is used or data leaves EstateOS.
    const [{facts, sources}, brand] = await Promise.all([
      loadFacts(context, selection, {useLeadFirstName: input.useLeadFirstName, withPropertyDetail: true}),
      getBrand(context),
    ]);
    const reservation = await reserveQuota(context, config);
    prepared = {
      context, config, reservation, type: input.contentType, purpose: input.purpose, language: input.language, tone: input.tone, audience: input.audience, length: input.length,
      facts, sources, branding: brand.approved, settings: {schemaVersion: 1, selection, useLeadFirstName: input.useLeadFirstName, length: input.length},
      templateId: input.templateId ?? null, template, userInstructions: input.customInstructions ?? null, mode: "GENERATE", draft: null, expectedRevision: 0,
    };
  } catch (error) {
    logUnexpectedContentError("generate", error);
    return leadErrorResponse(error);
  }
  return streamGeneration(request, prepared);
}

/** POST /api/ai/content/drafts/{id}/generate: regenerate, or add an alternative version. */
export async function regenerateDraftResponse(request: Request, rawId: string): Promise<Response> {
  let prepared: Prepared;
  try {
    const {body, config, context} = await authorizeGeneration(request);
    const id = validateInput(draftIdSchema, rawId);
    const input = validateInput(draftGenerateSchema(config.contentMaxInstructionsChars), body);
    const {draft} = await getDraft(context, id);
    if (draft.status === "ARCHIVED") throw new WorkspaceError("VALIDATION_ERROR", 400, "Restore this draft from the archive before generating new versions.");
    if (draft.revision !== input.expectedRevision) throw new WorkspaceError("CONFLICT", 409, "This draft was changed in another window or by a colleague. Reload it and try again.");
    assertRoleCanUse(context, draft.contentType);
    await enforceGenerationRateLimit(request, config, context);
    let template: string | null = null;
    try { template = await templateInstructions(context, draft.templateId, draft.contentType, draft.purpose); } catch { template = null; }
    // Source permissions are checked again now, independently of draft ownership.
    const [{facts, sources}, brand] = await Promise.all([
      loadFacts(context, draft.settings.selection, {useLeadFirstName: draft.settings.useLeadFirstName, withPropertyDetail: true}),
      getBrand(context),
    ]);
    const reservation = await reserveQuota(context, config);
    prepared = {
      context, config, reservation, type: draft.contentType, purpose: draft.purpose, language: draft.language,
      tone: draft.tone as ContentTone, audience: draft.audience as ContentAudience, length: input.length ?? draft.settings.length,
      facts, sources, branding: brand.approved, settings: {...draft.settings, length: input.length ?? draft.settings.length},
      templateId: draft.templateId, template, userInstructions: input.customInstructions ?? null, mode: input.mode, draft, expectedRevision: input.expectedRevision,
    };
  } catch (error) {
    logUnexpectedContentError("regenerate", error);
    return leadErrorResponse(error);
  }
  return streamGeneration(request, prepared);
}

function currentText(draft: StoredDraft) {
  return localesFor(draft.language).map(locale => {
    const content = draft.contentData.content[locale];
    return content ? contentToPlainText(draft.contentType, content) : "";
  }).join("\n\n").slice(0, 8000);
}

function streamGeneration(request: Request, prepared: Prepared): Response {
  const startedAt = Date.now();
  const {context, config} = prepared;
  const requestId = randomUUID();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(new WorkspaceError("AI_TIMEOUT", 504, "Claude took too long to write this draft. Try a shorter length or try again.")), config.contentRequestTimeoutMs + 5_000);
  const onClientAbort = () => controller.abort(new WorkspaceError("AI_CANCELLED", 409, "Generation was stopped."));
  request.signal.addEventListener("abort", onClientAbort, {once: true});
  const encoder = new TextEncoder();

  const body = new ReadableStream<Uint8Array>({
    async start(stream) {
      let open = true;
      const send = (event: ContentStreamEvent) => {
        if (!open) return;
        try { stream.enqueue(encoder.encode(encodeContentEvent(event))); } catch { open = false; }
      };
      send({type: "start", requestId});
      send({type: "stage", stage: "writing"});
      const task: ContentTask = {
        type: prepared.type, purpose: prepared.purpose, language: prepared.language, tone: prepared.tone, audience: prepared.audience, length: prepared.length,
        adLimits: prepared.type === "ADVERTISING" && isAdPlatform(prepared.purpose) ? config.adLimits[prepared.purpose] : null,
        mode: prepared.mode, currentText: prepared.mode === "ALTERNATIVE" && prepared.draft ? currentText(prepared.draft) : null,
      };
      let lastProgress = 0;
      const result: ContentGenerationResult = await generateContent({
        config, maxOutputTokens: config.contentMaxOutputTokens, type: prepared.type, language: prepared.language,
        factsText: factsPrompt(prepared.facts, prepared.branding),
        instructionsText: instructionsPrompt({task, templateInstructions: prepared.template, userInstructions: prepared.userInstructions}),
        createStream: contentStreamFactory(config), signal: controller.signal, mapError: logAndMapProviderError,
        onProgress: characters => {
          const now = Date.now();
          if (now - lastProgress < 300) return;
          lastProgress = now;
          send({type: "progress", characters});
        },
      });
      clearTimeout(timeout);
      request.signal.removeEventListener("abort", onClientAbort);

      let saved: {draftId: string; versionNumber: number; warnings: number} | null = null;
      if (result.status === "SUCCEEDED" && result.output) {
        send({type: "stage", stage: "checking"});
        const model = result.servedModel ?? config.model;
        const generatedAt = new Date().toISOString();
        const validation = buildValidation({
          type: prepared.type, purpose: prepared.purpose, language: prepared.language, content: result.output.content,
          factIndex: buildFactIndex(prepared.facts, prepared.branding), adLimits: config.adLimits,
          generatedAt, factsReadAt: prepared.facts.readAt, model, sources: prepared.sources,
          missingInformation: [...result.output.missingInformation, ...prepared.facts.unavailable], claimsToReview: result.output.claimsToReview, editedAfterGeneration: false,
        });
        if (isEmptyContent(prepared.type, result.output.content)) {
          result.status = "FAILED";
          result.error = new WorkspaceError("AI_EMPTY_RESPONSE", 409, "Claude returned an empty draft, usually because the selected records lack the facts this content needs. Check the records and try again.");
        } else {
          send({type: "stage", stage: "saving"});
          const contentData: ContentData = {schemaVersion: 1, content: result.output.content};
          const stored = {
            title: result.output.title.slice(0, 200), contentData: JSON.stringify(contentData), validation: serializeValidation(validation),
            sourceRefs: JSON.stringify(prepared.settings), model: model.slice(0, 80), generatedAt,
          };
          try {
            if (prepared.mode === "GENERATE") {
              const id = randomUUID();
              const selection = prepared.settings.selection;
              await createGeneratedDraft(context, {
                ...stored, id, contentType: prepared.type, purpose: prepared.purpose, language: prepared.language, tone: prepared.tone, audience: prepared.audience,
                sourceProjectId: selection.projectId, sourcePropertyId: selection.propertyId, sourceListingId: selection.listingId ?? selection.listingIds?.[0],
                sourceLeadId: selection.leadId, templateId: prepared.templateId ?? undefined,
              });
              saved = {draftId: id, versionNumber: 1, warnings: validation.warnings.length};
            } else {
              const version = await addGeneratedVersion(context, prepared.draft!, prepared.mode, prepared.expectedRevision, stored);
              saved = {draftId: prepared.draft!.id, versionNumber: version.versionNumber, warnings: validation.warnings.length};
            }
          } catch (error) {
            result.status = "FAILED";
            const conflict = error instanceof WorkspaceError && error.code === "CONFLICT";
            result.error = new WorkspaceError("AI_SAVE_FAILED", 503, conflict
              ? "The draft changed while this version was being written, so it was not saved. Reload the draft and try again."
              : "The draft was written but could not be saved. Try again.");
          }
        }
      }
      if (saved) {
        send({type: "done", draftId: saved.draftId, versionNumber: saved.versionNumber, mode: prepared.mode, warnings: saved.warnings});
      } else {
        const error = result.error ?? new WorkspaceError("AI_ERROR", 503, "The draft could not be generated.");
        send({type: "error", code: error.code, message: error.message, retryable: isRetryableAiError(error.code) || error.code === "AI_EMPTY_RESPONSE"});
      }

      // A request that never reached Claude does not use the allowance.
      if (result.usage.modelRequests === 0) await prepared.reservation.release();
      const usage = await recordContentUsage(context, config, {usageId: requestId, type: prepared.type, result, status: saved ? "SUCCEEDED" : result.status === "CANCELLED" ? "CANCELLED" : "FAILED", durationMs: Date.now() - startedAt});
      // Safe operational audit line: no facts, prompt, draft text or member identifiers.
      console.info(JSON.stringify({event: "ai.content", requestId, mode: prepared.mode, contentType: prepared.type, purpose: prepared.purpose, language: prepared.language,
        status: saved ? "SUCCEEDED" : result.status, errorCode: saved ? null : result.error?.code ?? null, model: usage.model, role: context.membership.role,
        sources: prepared.sources.map(source => source.kind), inputTokens: result.usage.inputTokens, outputTokens: result.usage.outputTokens,
        cacheReadInputTokens: result.usage.cacheReadInputTokens, estimatedCostUsd: usage.estimatedCostUsd, durationMs: Date.now() - startedAt}));
      if (open) { try { stream.close(); } catch { /* client already gone */ } }
    },
    cancel() {
      controller.abort(new WorkspaceError("AI_CANCELLED", 409, "Generation was stopped."));
    },
  });

  return new Response(body, {status: 200, headers: {...AUTH_RESPONSE_HEADERS, "Content-Type": "application/x-ndjson; charset=utf-8", "X-Accel-Buffering": "no"}});
}

/** One AiUsageRecord per generation, tagged CONTENT with the content type. Never includes facts or text. */
async function recordContentUsage(context: Context, config: AiConfig, input: {usageId: string; type: ContentType; result: ContentGenerationResult; status: "SUCCEEDED" | "FAILED" | "CANCELLED"; durationMs: number}) {
  const {request, organizationId} = context;
  const {result} = input;
  const model = result.servedModel ?? config.model;
  const estimatedCostUsd = estimateCostUsd(model === config.model ? config.pricing : pricingFor(model), result.usage);
  try {
    await executeWorkspaceOperation(() => sql.recordAiUsage(request.dc, {
      organizationId, id: input.usageId, userUid: request.user.uid, conversationId: null, model: model.slice(0, 80), promptVersion: CONTENT_PROMPT_VERSION,
      status: sql.AiRequestStatus[input.status], errorCode: input.status === "SUCCEEDED" ? null : result.error?.code.slice(0, 40) ?? null,
      inputTokens: result.usage.inputTokens, outputTokens: result.usage.outputTokens, cacheReadInputTokens: result.usage.cacheReadInputTokens,
      cacheCreationInputTokens: result.usage.cacheCreationInputTokens, estimatedCostUsd, modelRequests: result.usage.modelRequests, toolCalls: 0,
      durationMs: Math.min(input.durationMs, 2_147_483_647), feature: "CONTENT", contentType: input.type,
    }), "RecordAiUsage");
  } catch (error) {
    console.error(JSON.stringify({event: "ai.usage.record_failed", usageId: input.usageId, feature: "CONTENT", model, inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens, code: error instanceof WorkspaceError ? error.code : "ERROR"}));
  }
  return {model, estimatedCostUsd};
}
