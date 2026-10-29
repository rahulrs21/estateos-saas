import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { WorkspaceError } from "@/modules/organizations/server/errors";
import { readAiConfig, type AiConfig } from "../config";
import type { CreateModelStream } from "../loop";
import { mapAnthropicError } from "../provider-errors";

/**
 * The only place EstateOS talks to Anthropic. The API key is read from the
 * server environment (or the hosting secret manager that populates it) and
 * never leaves this module. There is no fallback to another provider and no
 * simulated response when configuration is missing.
 */

let cachedClient: {key: string; timeoutMs: number; client: Anthropic} | null = null;

export function aiConfiguration() {
  return readAiConfig(process.env);
}

/** Throws a safe 503 when the Copilot is disabled or misconfigured; problems are logged, never returned. */
export function requireAiConfig(): AiConfig {
  const result = aiConfiguration();
  if (result.ok) return result.config;
  console.warn(JSON.stringify({event: "ai.config", code: result.code, problems: result.problems}));
  if (result.code === "AI_DISABLED") throw new WorkspaceError("AI_DISABLED", 503, "The AI Copilot is turned off for this EstateOS environment.");
  throw new WorkspaceError("AI_NOT_CONFIGURED", 503, "The AI Copilot is not configured. Ask an administrator to set the Anthropic settings.");
}

export function anthropicClient(config: AiConfig) {
  if (cachedClient?.key !== config.apiKey || cachedClient.timeoutMs !== config.requestTimeoutMs) {
    // Retries cover 408/409/429/5xx and connection errors with backoff; the
    // overall turn deadline still applies through the abort signal.
    cachedClient = {key: config.apiKey, timeoutMs: config.requestTimeoutMs, client: new Anthropic({apiKey: config.apiKey, maxRetries: 2, timeout: config.requestTimeoutMs})};
  }
  return cachedClient.client;
}

export function modelStreamFactory(config: AiConfig): CreateModelStream {
  const client = anthropicClient(config);
  return (params, signal) => client.beta.messages.stream(params, {signal});
}

/** Content Studio requests can produce long structured drafts, so they use their own per-request timeout. */
export function contentStreamFactory(config: AiConfig): CreateModelStream {
  const client = anthropicClient(config);
  return (params, signal) => client.beta.messages.stream(params, {signal, timeout: config.contentRequestTimeoutMs});
}

const MODEL_CHECK_TTL_MS = 10 * 60_000;
let modelCheck: {model: string; key: string; at: number; result: ModelStatus} | null = null;

export type ModelStatus =
  | {available: true; model: string; displayName: string | null}
  | {available: false; model: string; code: string; message: string};

/**
 * Confirm the configured model with the Models API. Cached for ten minutes
 * per model and key so the status endpoint does not call Anthropic on every
 * page load. Failures are reported, not hidden.
 */
export async function checkModelAvailability(config: AiConfig): Promise<ModelStatus> {
  const now = Date.now();
  const ttl = modelCheck?.result.available ? MODEL_CHECK_TTL_MS : 60_000;
  if (modelCheck && modelCheck.model === config.model && modelCheck.key === config.apiKey && now - modelCheck.at < ttl) return modelCheck.result;
  let result: ModelStatus;
  try {
    const info = await anthropicClient(config).models.retrieve(config.model, {}, {timeout: 10_000, maxRetries: 1});
    result = {available: true, model: info.id, displayName: info.display_name ?? null};
  } catch (error) {
    const safe = mapAnthropicError(error);
    result = {available: false, model: config.model, code: safe.code, message: safe.message};
  }
  modelCheck = {model: config.model, key: config.apiKey, at: now, result};
  return result;
}
