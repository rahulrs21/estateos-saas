import type Anthropic from "@anthropic-ai/sdk";
import type { z } from "zod";
import { WorkspaceError } from "../organizations/server/errors";
import type { AiConfig } from "./config";
import type { CreateModelStream, UsageTotals } from "./loop";

type BetaMessage = Anthropic.Beta.Messages.BetaMessage;

/** Feature-specific wording for the failures every structured request can have. */
export interface StructuredMessages { refused: string; incomplete: string; invalid: string; cancelled: string }

export interface StructuredRequest<T> {
  config: Pick<AiConfig, "model" | "effort" | "refusalFallback">;
  maxOutputTokens: number;
  system: string;
  /** Verified facts. Sent first and marked as a cache breakpoint, so repeat requests on the same records reuse it. */
  factsText: string;
  instructionsText: string;
  jsonSchema: Record<string, unknown>;
  zod: z.ZodType<T>;
  createStream: CreateModelStream;
  signal: AbortSignal;
  mapError: (error: unknown) => WorkspaceError;
  messages: StructuredMessages;
  onProgress?: (characters: number) => void;
}

export interface StructuredResult<T> {
  status: "SUCCEEDED" | "FAILED" | "CANCELLED";
  output: T | null;
  error: WorkspaceError | null;
  usage: UsageTotals;
  servedModel: string | null;
}

/**
 * One Messages API request with structured outputs (output_config.format),
 * streamed so long answers do not hit request timeouts, with adaptive
 * thinking and no tools: EstateOS reads and authorizes the facts before the
 * request. The response is parsed and validated with Zod; a refusal,
 * truncation or invalid shape is an error, never a partial result.
 * Shared by the Content Studio (6B) and sales intelligence (6C).
 */
export async function generateStructured<T>(request: StructuredRequest<T>): Promise<StructuredResult<T>> {
  const usage: UsageTotals = {inputTokens: 0, outputTokens: 0, cacheReadInputTokens: 0, cacheCreationInputTokens: 0, modelRequests: 0, toolCalls: 0};
  let servedModel: string | null = null;
  const fail = (error: WorkspaceError): StructuredResult<T> => ({status: error.code === "AI_CANCELLED" ? "CANCELLED" : "FAILED", output: null, error, usage, servedModel});
  try {
    if (request.signal.aborted) throw request.signal.reason ?? new WorkspaceError("AI_CANCELLED", 409, request.messages.cancelled);
    const {config} = request;
    const stream = request.createStream({
      model: config.model,
      max_tokens: request.maxOutputTokens,
      system: [{type: "text", text: request.system, cache_control: {type: "ephemeral"}}],
      messages: [{role: "user", content: [
        {type: "text", text: request.factsText, cache_control: {type: "ephemeral"}},
        {type: "text", text: request.instructionsText},
      ]}],
      thinking: {type: "adaptive"},
      output_config: {effort: config.effort, format: {type: "json_schema", schema: request.jsonSchema}},
      ...(config.refusalFallback ? {betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const} : {}),
    }, request.signal);
    let characters = 0;
    if (request.onProgress) stream.on("text", delta => { characters += delta.length; request.onProgress!(characters); });
    const message: BetaMessage = await stream.finalMessage();
    usage.inputTokens += message.usage?.input_tokens ?? 0;
    usage.outputTokens += message.usage?.output_tokens ?? 0;
    usage.cacheReadInputTokens += message.usage?.cache_read_input_tokens ?? 0;
    usage.cacheCreationInputTokens += message.usage?.cache_creation_input_tokens ?? 0;
    usage.modelRequests += 1;
    servedModel = message.model ?? null;

    if (message.stop_reason === "refusal") return fail(new WorkspaceError("AI_REFUSED", 409, request.messages.refused));
    if (message.stop_reason === "max_tokens" || message.stop_reason === "model_context_window_exceeded") {
      return fail(new WorkspaceError("AI_RESPONSE_INCOMPLETE", 409, request.messages.incomplete));
    }
    const text = message.content.filter((block): block is Anthropic.Beta.Messages.BetaTextBlock => block.type === "text").map(block => block.text).join("");
    let parsed: unknown;
    try { parsed = JSON.parse(text); } catch {
      return fail(new WorkspaceError("AI_INVALID_OUTPUT", 409, request.messages.invalid));
    }
    const result = request.zod.safeParse(parsed);
    if (!result.success) return fail(new WorkspaceError("AI_INVALID_OUTPUT", 409, request.messages.invalid));
    return {status: "SUCCEEDED", output: result.data, error: null, usage, servedModel};
  } catch (error) {
    if (request.signal.aborted) {
      const reason = request.signal.reason;
      return fail(reason instanceof WorkspaceError ? reason : new WorkspaceError("AI_CANCELLED", 409, request.messages.cancelled));
    }
    return fail(request.mapError(error));
  }
}
