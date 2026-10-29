import "server-only";

import { randomUUID } from "node:crypto";
import Anthropic from "@anthropic-ai/sdk";
import { cookies } from "next/headers";
import { getSession } from "@/lib/auth/session";
import { assertExpectedOrganization, parseWorkspaceJsonRequest } from "@/lib/http/request-policy";
import { enforceRateLimit, requestClientIp } from "@/lib/rate-limit/server";
import type { RateLimitRule } from "@/lib/rate-limit/limiter";
import { authCookies, getAppOrigin } from "@/modules/auth/server/config";
import { AUTH_RESPONSE_HEADERS } from "@/modules/auth/server/http";
import { validateMutationRequest } from "@/modules/auth/server/request-policy";
import { leadErrorResponse } from "@/modules/leads/server/http";
import { requireActiveOrganizationRequest } from "@/modules/organizations/server/context";
import { WorkspaceError } from "@/modules/organizations/server/errors";
import { validateInput } from "@/modules/organizations/server/validation";
import type { AiConfig } from "../config";
import { runCopilotTurn, type HistoryMessage } from "../loop";
import { chatRequestSchema } from "../policy";
import { requestContextPrompt } from "../prompt";
import { encodeEvent, type ChatStreamEvent } from "../protocol";
import { isRetryableAiError, mapAnthropicError } from "../provider-errors";
import { createToolExecutor } from "../tools/registry";
import { modelStreamFactory, requireAiConfig } from "./anthropic";
import { getConversation, recordUsage, reserveQuota, saveExchange, toHistory, type QuotaReservation } from "./store";
import { copilotToolHandlers } from "./tools";

/** Status and type are always logged; the provider message only outside production (it never contains the key). */
export function logAndMapProviderError(error: unknown) {
  const mapped = mapAnthropicError(error);
  const provider = error instanceof Anthropic.APIError ? error : null;
  console.warn(JSON.stringify({event: "ai.provider_error", code: mapped.code, status: provider?.status ?? null, type: provider?.type ?? null,
    requestId: provider?.requestID ?? null, ...(process.env.NODE_ENV !== "production" && error instanceof Error ? {detail: error.message.slice(0, 500)} : {})}));
  return mapped;
}

function rateLimitRules(config: AiConfig) {
  return {
    member: {scope: "ai.chat.member", limit: config.requestsPerMinutePerMember, windowSeconds: 60},
    ip: {scope: "ai.chat.ip", limit: config.requestsPerMinutePerMember * 4, windowSeconds: 60},
    company: {scope: "ai.chat.company", limit: config.requestsPerMinutePerOrganization, windowSeconds: 60},
  } satisfies Record<string, RateLimitRule>;
}

/**
 * POST /api/ai/chat. Every check happens before the stream starts: origin and
 * CSRF, verified session, configuration, the server-resolved organization and
 * ACTIVE membership, input validation, rate limits, conversation ownership and
 * the monthly allowance. The body may contain only `message` and an optional
 * `conversationId`; identity, organization and role come from the session.
 */
export async function copilotChatResponse(request: Request): Promise<Response> {
  const startedAt = Date.now();
  let context: Awaited<ReturnType<typeof requireActiveOrganizationRequest>>;
  let config: AiConfig;
  let reservation: QuotaReservation;
  let history: HistoryMessage[] = [];
  let conversationId: string;
  let isNew: boolean;
  let expectedMessageCount = 0;
  let message: string;
  try {
    validateMutationRequest(request, {origin: getAppOrigin(), csrfToken: (await cookies()).get(authCookies().csrf.name)?.value});
    if (!await getSession()) throw new WorkspaceError("UNAUTHENTICATED", 401, "Sign in to continue.");
    const body = await parseWorkspaceJsonRequest(request);
    config = requireAiConfig();
    context = await requireActiveOrganizationRequest();
    assertExpectedOrganization(request.headers.get("x-estateos-organization"), context.organizationId);
    const input = validateInput(chatRequestSchema(config.maxInputChars), body);
    message = input.message;
    const rules = rateLimitRules(config);
    await enforceRateLimit([
      {rule: rules.member, subject: context.membership.id},
      {rule: rules.ip, subject: requestClientIp(request) ?? ""},
      {rule: rules.company, subject: context.organizationId},
    ], "You are sending questions too quickly. Wait a moment and try again.");
    isNew = !input.conversationId;
    conversationId = input.conversationId ?? randomUUID();
    if (!isNew) {
      const stored = await getConversation(context, conversationId, Math.min(200, config.historyMessages));
      history = toHistory(stored.messages, config.historyMessages);
      expectedMessageCount = stored.conversation.messageCount;
    }
    reservation = await reserveQuota(context, config);
  } catch (error) {
    return leadErrorResponse(error);
  }

  const requestId = randomUUID();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(new WorkspaceError("AI_TIMEOUT", 504, "Claude took too long to respond. Try again or ask a narrower question.")), config.requestTimeoutMs);
  const onClientAbort = () => controller.abort(new WorkspaceError("AI_CANCELLED", 409, "The response was stopped."));
  request.signal.addEventListener("abort", onClientAbort, {once: true});
  const encoder = new TextEncoder();
  const executeTool = createToolExecutor(copilotToolHandlers, {timeoutMs: config.toolTimeoutMs});

  const body = new ReadableStream<Uint8Array>({
    async start(stream) {
      let open = true;
      const send = (event: ChatStreamEvent) => {
        if (!open) return;
        try { stream.enqueue(encoder.encode(encodeEvent(event))); } catch { open = false; }
      };
      send({type: "start", requestId, conversationId, isNew});
      const result = await runCopilotTurn({
        config, history, userMessage: message,
        contextPrompt: requestContextPrompt({companyName: context.organization.name, role: context.membership.role, now: new Date().toISOString()}),
        createStream: modelStreamFactory(config), executeTool,
        emit: event => send(event.type === "text" ? event : {type: "tool", id: event.id, label: event.label, state: event.state}),
        signal: controller.signal, mapError: logAndMapProviderError,
      });
      clearTimeout(timeout);
      request.signal.removeEventListener("abort", onClientAbort);

      let savedConversationId: string | null = null;
      if (result.status === "SUCCEEDED") {
        try {
          const saved = await saveExchange(context, {conversationId, isNew, expectedMessageCount, userContent: message, assistantContent: result.text});
          savedConversationId = conversationId;
          send({type: "done", conversationId, title: saved.title, saved: true, usage: {inputTokens: result.usage.inputTokens, outputTokens: result.usage.outputTokens}});
        } catch (error) {
          const safe = error instanceof WorkspaceError ? error : new WorkspaceError("DATABASE_ERROR", 503, "The answer could not be saved.");
          result.status = "FAILED";
          result.error = new WorkspaceError("AI_SAVE_FAILED", 503, safe.code === "CONFLICT" ? safe.message : "The answer was shown but could not be saved to this conversation. Try again.");
          send({type: "error", code: result.error.code, message: result.error.message, retryable: true, partialTextShown: true});
        }
      } else {
        const error = result.error ?? new WorkspaceError("AI_ERROR", 503, "The AI Copilot could not complete this request.");
        send({type: "error", code: error.code, message: error.message, retryable: isRetryableAiError(error.code), partialTextShown: Boolean(result.text)});
      }

      // A request that never reached a model response does not use the allowance.
      if (result.usage.modelRequests === 0) await reservation.release();
      const durationMs = Date.now() - startedAt;
      const usage = await recordUsage(context, config, {usageId: requestId, conversationId: savedConversationId ?? (isNew ? null : conversationId), result, durationMs});
      // Safe operational audit line: no prompt, answer, tool arguments or member identifiers.
      console.info(JSON.stringify({event: "ai.chat", requestId, status: result.status, errorCode: result.error?.code ?? null, model: usage.model,
        role: context.membership.role, modelRequests: result.usage.modelRequests, inputTokens: result.usage.inputTokens, outputTokens: result.usage.outputTokens,
        cacheReadInputTokens: result.usage.cacheReadInputTokens, toolCalls: result.tools.map(tool => `${tool.name}:${tool.status}`), estimatedCostUsd: usage.estimatedCostUsd, durationMs}));
      if (open) { try { stream.close(); } catch { /* client already gone */ } }
    },
    cancel() {
      controller.abort(new WorkspaceError("AI_CANCELLED", 409, "The response was stopped."));
    },
  });

  return new Response(body, {status: 200, headers: {
    ...AUTH_RESPONSE_HEADERS,
    "Content-Type": "application/x-ndjson; charset=utf-8",
    "X-Accel-Buffering": "no",
  }});
}
