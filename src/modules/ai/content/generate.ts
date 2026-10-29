import type { WorkspaceError } from "../../organizations/server/errors";
import type { AiConfig } from "../config";
import type { CreateModelStream, UsageTotals } from "../loop";
import { generateStructured } from "../structured";
import type { ContentLanguage, ContentType } from "./catalog";
import { CONTENT_SYSTEM_PROMPT } from "./prompt";
import { outputJsonSchema, outputZod, type GeneratedOutput } from "./schemas";

export interface ContentGenerationOptions {
  config: Pick<AiConfig, "model" | "effort" | "refusalFallback">;
  maxOutputTokens: number;
  type: ContentType;
  language: ContentLanguage;
  factsText: string;
  instructionsText: string;
  createStream: CreateModelStream;
  signal: AbortSignal;
  /** Characters of structured output received so far; drives the progress bar. */
  onProgress: (characters: number) => void;
  mapError: (error: unknown) => WorkspaceError;
}

export interface ContentGenerationResult {
  status: "SUCCEEDED" | "FAILED" | "CANCELLED";
  output: GeneratedOutput | null;
  error: WorkspaceError | null;
  usage: UsageTotals;
  servedModel: string | null;
}

/**
 * One Content Studio generation: a single structured-output Messages API
 * request (shared with sales intelligence in ../structured.ts). The response
 * is validated with Zod before anything is saved; a refusal, truncation or
 * invalid shape is an error, never a partial draft. No tools are offered:
 * the facts are read by EstateOS before the request.
 */
export async function generateContent(options: ContentGenerationOptions): Promise<ContentGenerationResult> {
  const result = await generateStructured({
    config: options.config, maxOutputTokens: options.maxOutputTokens, system: CONTENT_SYSTEM_PROMPT,
    factsText: options.factsText, instructionsText: options.instructionsText,
    jsonSchema: outputJsonSchema(options.type, options.language), zod: outputZod(options.type, options.language),
    createStream: options.createStream, signal: options.signal, mapError: options.mapError, onProgress: options.onProgress,
    messages: {
      refused: "Claude declined to write this content. Review the instructions and try again.",
      incomplete: "The draft was cut off before it finished. Choose a shorter length or a single language and try again.",
      invalid: "Claude returned a draft in an unexpected format. Try again.",
      cancelled: "Generation was stopped.",
    },
  });
  return {...result, output: result.output as GeneratedOutput | null};
}
