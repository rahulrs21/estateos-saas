/**
 * AI Copilot configuration (docs/AI_COPILOT.md). Pure: callers pass the
 * environment so tests never touch process.env. The API key is validated for
 * presence and shape only and is never included in results or messages.
 */

import { resolveAdLimits, type AdPlatform, type AdPlatformLimits } from "./content/ad-limits";

export const AI_EFFORT_LEVELS = ["low", "medium", "high"] as const;
export type AiEffort = (typeof AI_EFFORT_LEVELS)[number];

/** Models that accept the server-side refusal fallback (`fallbacks: "default"`) on the Claude API. */
const REFUSAL_FALLBACK_MODELS = new Set(["claude-sonnet-5-5", "claude-opus-5-5", "claude-opus-5", "claude-fable-5-1"]);

export const DEFAULT_AI_MODEL = "claude-sonnet-5-5";

export interface AiConfig {
  apiKey: string;
  model: string;
  effort: AiEffort;
  refusalFallback: boolean;
  maxOutputTokens: number;
  maxToolRounds: number;
  maxToolCalls: number;
  requestTimeoutMs: number;
  toolTimeoutMs: number;
  maxInputChars: number;
  historyMessages: number;
  monthlyRequestsPerOrganization: number;
  monthlyRequestsPerUser: number;
  requestsPerMinutePerMember: number;
  requestsPerMinutePerOrganization: number;
  retentionDays: number;
  pricing: AiPricing | null;
  /** Content Studio (Phase 6B). */
  contentMaxOutputTokens: number;
  contentRequestTimeoutMs: number;
  contentMaxInstructionsChars: number;
  adLimits: Record<AdPlatform, AdPlatformLimits>;
}

/** USD per million tokens. Used only for an estimate; Anthropic's invoice is authoritative. */
export interface AiPricing { input: number; output: number; cacheRead: number; cacheWrite: number }

/** Anthropic list prices (USD / MTok) for current models, as published at the time of writing. */
const LIST_PRICES: Record<string, Omit<AiPricing, "cacheWrite">> = {
  "claude-sonnet-5-5": {input: 2, output: 10, cacheRead: 0.2},
  "claude-sonnet-5": {input: 2, output: 10, cacheRead: 0.2},
  "claude-opus-5-5": {input: 4, output: 20, cacheRead: 0.2},
  "claude-opus-5": {input: 5, output: 25, cacheRead: 0.5},
  "claude-haiku-5-5": {input: 0.1, output: 0.5, cacheRead: 0.01},
  "claude-fable-5-1": {input: 10, output: 50, cacheRead: 0.25},
};

export type AiConfigResult =
  | {ok: true; config: AiConfig}
  | {ok: false; code: "AI_DISABLED" | "AI_NOT_CONFIGURED"; problems: string[]};

type Env = Record<string, string | undefined>;

function integer(env: Env, name: string, fallback: number, min: number, max: number, problems: string[]) {
  const raw = env[name]?.trim();
  if (!raw) return fallback;
  if (!/^\d+$/.test(raw) || Number(raw) < min || Number(raw) > max) {
    problems.push(`${name} must be a whole number from ${min} to ${max}.`);
    return fallback;
  }
  return Number(raw);
}

function decimal(env: Env, name: string, problems: string[]) {
  const raw = env[name]?.trim();
  if (!raw) return undefined;
  if (!/^\d{1,4}(?:\.\d{1,6})?$/.test(raw)) {
    problems.push(`${name} must be a non-negative number (USD per million tokens).`);
    return undefined;
  }
  return Number(raw);
}

export function pricingFor(model: string, env: Env = {}, problems: string[] = []): AiPricing | null {
  const input = decimal(env, "AI_PRICE_INPUT_PER_MTOK", problems);
  const output = decimal(env, "AI_PRICE_OUTPUT_PER_MTOK", problems);
  if (input !== undefined && output !== undefined) {
    return {input, output, cacheRead: input * 0.1, cacheWrite: input * 1.25};
  }
  const listed = LIST_PRICES[model];
  return listed ? {...listed, cacheWrite: listed.input * 1.25} : null;
}

export function readAiConfig(env: Env): AiConfigResult {
  const enabled = env.ESTATEOS_AI_ENABLED?.trim().toLowerCase();
  if (enabled !== "true") {
    return {ok: false, code: "AI_DISABLED", problems: ["ESTATEOS_AI_ENABLED is not set to true."]};
  }
  const problems: string[] = [];
  const apiKey = env.ANTHROPIC_API_KEY?.trim() ?? "";
  if (!apiKey) problems.push("ANTHROPIC_API_KEY is not set.");
  else if (!/^sk-ant-[A-Za-z0-9_-]{20,}$/.test(apiKey)) problems.push("ANTHROPIC_API_KEY does not look like an Anthropic API key.");

  const model = env.ANTHROPIC_MODEL?.trim() || DEFAULT_AI_MODEL;
  if (!/^[a-z0-9][a-z0-9._@-]{2,79}$/.test(model)) problems.push("ANTHROPIC_MODEL is not a valid model identifier.");

  const effortRaw = env.ANTHROPIC_EFFORT?.trim().toLowerCase() || "medium";
  const effort = (AI_EFFORT_LEVELS as readonly string[]).includes(effortRaw) ? effortRaw as AiEffort : "medium";
  if (effort !== effortRaw) problems.push("ANTHROPIC_EFFORT must be low, medium or high.");

  const fallbackRaw = env.ANTHROPIC_REFUSAL_FALLBACK?.trim().toLowerCase() || "default";
  if (fallbackRaw !== "default" && fallbackRaw !== "off") problems.push("ANTHROPIC_REFUSAL_FALLBACK must be default or off.");

  const config: AiConfig = {
    apiKey,
    model,
    effort,
    refusalFallback: fallbackRaw === "default" && REFUSAL_FALLBACK_MODELS.has(model),
    maxOutputTokens: integer(env, "AI_MAX_OUTPUT_TOKENS", 8000, 1024, 32000, problems),
    maxToolRounds: integer(env, "AI_MAX_TOOL_ROUNDS", 5, 1, 10, problems),
    maxToolCalls: integer(env, "AI_MAX_TOOL_CALLS", 12, 1, 30, problems),
    requestTimeoutMs: integer(env, "AI_REQUEST_TIMEOUT_MS", 120_000, 10_000, 300_000, problems),
    toolTimeoutMs: integer(env, "AI_TOOL_TIMEOUT_MS", 15_000, 1_000, 60_000, problems),
    maxInputChars: integer(env, "AI_MAX_INPUT_CHARS", 4000, 200, 8000, problems),
    historyMessages: integer(env, "AI_HISTORY_MESSAGES", 20, 2, 60, problems),
    monthlyRequestsPerOrganization: integer(env, "AI_MONTHLY_REQUESTS_PER_ORGANIZATION", 2000, 1, 10_000_000, problems),
    monthlyRequestsPerUser: integer(env, "AI_MONTHLY_REQUESTS_PER_USER", 300, 1, 1_000_000, problems),
    requestsPerMinutePerMember: integer(env, "AI_REQUESTS_PER_MINUTE_PER_MEMBER", 6, 1, 600, problems),
    requestsPerMinutePerOrganization: integer(env, "AI_REQUESTS_PER_MINUTE_PER_ORGANIZATION", 60, 1, 6000, problems),
    retentionDays: integer(env, "AI_CONVERSATION_RETENTION_DAYS", 180, 0, 3650, problems),
    pricing: null,
    contentMaxOutputTokens: integer(env, "AI_CONTENT_MAX_OUTPUT_TOKENS", 16_000, 2048, 64_000, problems),
    contentRequestTimeoutMs: integer(env, "AI_CONTENT_REQUEST_TIMEOUT_MS", 180_000, 30_000, 300_000, problems),
    contentMaxInstructionsChars: integer(env, "AI_CONTENT_MAX_INSTRUCTIONS_CHARS", 1500, 200, 4000, problems),
    adLimits: resolveAdLimits(env.AI_AD_LIMITS, problems),
  };
  config.pricing = pricingFor(model, env, problems);
  if (problems.length) return {ok: false, code: "AI_NOT_CONFIGURED", problems};
  return {ok: true, config};
}

/** Estimated USD cost from provider-reported usage; null when no price is known for the model. */
export function estimateCostUsd(pricing: AiPricing | null, usage: {inputTokens: number; outputTokens: number; cacheReadInputTokens: number; cacheCreationInputTokens: number}) {
  if (!pricing) return null;
  const cost = (usage.inputTokens * pricing.input + usage.outputTokens * pricing.output
    + usage.cacheReadInputTokens * pricing.cacheRead + usage.cacheCreationInputTokens * pricing.cacheWrite) / 1_000_000;
  return Math.round(cost * 1_000_000) / 1_000_000;
}
