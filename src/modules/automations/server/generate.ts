import "server-only";

import { randomUUID } from "node:crypto";
import { z } from "zod";
import * as sql from "@dataconnect/admin-generated";
import { executeWorkspaceOperation } from "@/lib/firebase/dataconnect";
import type { RateLimitRule } from "@/lib/rate-limit/limiter";
import { enforceRateLimit, requestClientIp } from "@/lib/rate-limit/server";
import { WorkspaceError } from "@/modules/organizations/server/errors";
import { validateInput } from "@/modules/organizations/server/validation";
import { estimateCostUsd, pricingFor, type AiConfig } from "../../ai/config";
import { contentStreamFactory, requireAiConfig } from "../../ai/server/anthropic";
import { logAndMapProviderError } from "../../ai/server/chat";
import { reserveQuota } from "../../ai/server/store";
import { generateStructured, type StructuredResult } from "../../ai/structured";
import {
  WORKFLOW_GENERATION_JSON, WORKFLOW_PROMPT_VERSION, WORKFLOW_SYSTEM_PROMPT, mapGeneratedWorkflow, workflowFactsPrompt, workflowGenerationZod, workflowTaskPrompt,
  type WorkflowGenerationOutput, type WorkflowProposal,
} from "../ai";
import { can, type Role } from "../policy";
import type { Context } from "./data";

/*
 * Claude workflow drafts (docs/WORKFLOW_BUILDER.md#claude). Order: verified
 * session and company (http.ts) → role → request validation → rate limits →
 * monthly AI allowance → one structured-output request with the allowlist
 * catalog → mapping onto the allowlisted definition. No CRM records are sent:
 * Claude sees the catalog and the staff member's description only. The result
 * is a proposal for the editor; nothing is saved, approved or activated here.
 */

const generateSchema = z.strictObject({description: z.string().trim().min(10, "Describe the workflow in a sentence or two.").max(2000), timeZone: z.string().max(64).default("Asia/Dubai")});

function rateLimitRules(config: AiConfig) {
  return {
    member: {scope: "ai.automation.member", limit: Math.max(1, Math.floor(config.requestsPerMinutePerMember / 2)), windowSeconds: 60},
    ip: {scope: "ai.automation.ip", limit: config.requestsPerMinutePerMember * 2, windowSeconds: 60},
    company: {scope: "ai.automation.company", limit: config.requestsPerMinutePerOrganization, windowSeconds: 60},
  } satisfies Record<string, RateLimitRule>;
}

const MESSAGES = {
  refused: "Claude declined to draft this workflow. Rephrase the description and try again.",
  incomplete: "Claude's draft was cut off. Try a shorter description.",
  invalid: "Claude returned a draft in an unexpected format. Try again.",
  cancelled: "Drafting was stopped.",
};

/** One AiUsageRecord per draft, feature AUTOMATION. Never includes the description or the draft. */
async function recordUsage(context: Context, config: AiConfig, input: {result: StructuredResult<unknown>; status: "SUCCEEDED" | "FAILED" | "CANCELLED"; errorCode: string | null; durationMs: number}) {
  const {request, organizationId} = context;
  const model = input.result.servedModel ?? config.model;
  const estimatedCostUsd = estimateCostUsd(model === config.model ? config.pricing : pricingFor(model), input.result.usage);
  try {
    await executeWorkspaceOperation(() => sql.recordAiUsage(request.dc, {
      organizationId, id: randomUUID(), userUid: request.user.uid, conversationId: null, model: model.slice(0, 80), promptVersion: WORKFLOW_PROMPT_VERSION,
      status: sql.AiRequestStatus[input.status], errorCode: input.errorCode?.slice(0, 40) ?? null,
      inputTokens: input.result.usage.inputTokens, outputTokens: input.result.usage.outputTokens, cacheReadInputTokens: input.result.usage.cacheReadInputTokens,
      cacheCreationInputTokens: input.result.usage.cacheCreationInputTokens, estimatedCostUsd, modelRequests: input.result.usage.modelRequests, toolCalls: 0,
      durationMs: Math.min(input.durationMs, 2_147_483_647), feature: "AUTOMATION", contentType: "WORKFLOW",
    }), "RecordAiUsage");
  } catch (error) {
    console.error(JSON.stringify({event: "ai.usage.record_failed", feature: "AUTOMATION", model, code: error instanceof WorkspaceError ? error.code : "ERROR"}));
  }
  return {model, estimatedCostUsd};
}

/** POST /api/automations/generate: a workflow proposal for the editor. */
export async function generateWorkflowDraft(request: Request, context: Context, raw: unknown): Promise<WorkflowProposal & {model: string}> {
  if (!can(context.membership.role as Role, "generate")) throw new WorkspaceError("FORBIDDEN", 403, "You cannot draft workflows with Claude.");
  const config = requireAiConfig();
  const input = validateInput(generateSchema, raw);
  const rules = rateLimitRules(config);
  await enforceRateLimit([
    {rule: rules.member, subject: context.membership.id},
    {rule: rules.ip, subject: requestClientIp(request) ?? ""},
    {rule: rules.company, subject: context.organizationId},
  ], "You are drafting workflows too quickly. Wait a moment and try again.");

  const reservation = await reserveQuota(context, config);
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(new WorkspaceError("AI_TIMEOUT", 504, "Claude took too long to draft this workflow. Try again.")), config.contentRequestTimeoutMs);
  let result: StructuredResult<WorkflowGenerationOutput>;
  try {
    result = await generateStructured({
      config, maxOutputTokens: config.contentMaxOutputTokens, system: WORKFLOW_SYSTEM_PROMPT, factsText: workflowFactsPrompt(),
      instructionsText: workflowTaskPrompt(input), jsonSchema: WORKFLOW_GENERATION_JSON, zod: workflowGenerationZod,
      createStream: contentStreamFactory(config), signal: controller.signal, mapError: logAndMapProviderError, messages: MESSAGES,
    });
  } finally { clearTimeout(timeout); }
  // A request that never reached Claude does not use the allowance.
  if (result.status !== "SUCCEEDED" && result.usage.modelRequests === 0) await reservation.release();
  const durationMs = Date.now() - startedAt;

  const proposal = result.status === "SUCCEEDED" && result.output ? mapGeneratedWorkflow(result.output, input.timeZone) : null;
  const status = proposal ? "SUCCEEDED" : result.status === "CANCELLED" ? "CANCELLED" : "FAILED";
  const usage = await recordUsage(context, config, {result: result as StructuredResult<unknown>, status, errorCode: proposal ? null : result.error?.code ?? "AI_ERROR", durationMs});
  console.info(JSON.stringify({event: "ai.automation", status, errorCode: proposal ? null : result.error?.code ?? null, model: usage.model, role: context.membership.role,
    rejected: proposal?.rejected.length ?? 0, inputTokens: result.usage.inputTokens, outputTokens: result.usage.outputTokens, estimatedCostUsd: usage.estimatedCostUsd, durationMs}));
  if (!proposal) throw result.error ?? new WorkspaceError("AI_UNAVAILABLE", 503, "Claude could not draft this workflow. Try again.");
  return {...proposal, model: usage.model};
}
