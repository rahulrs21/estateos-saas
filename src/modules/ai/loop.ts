import type Anthropic from "@anthropic-ai/sdk";
import { WorkspaceError } from "../organizations/server/errors";
import type { AiConfig } from "./config";
import { COPILOT_SYSTEM_PROMPT } from "./prompt";
import { AI_TOOL_LABELS, anthropicTools, isAiToolName } from "./tools/definitions";
import type { ToolExecutor, ToolOutcome } from "./tools/registry";

type BetaMessage = Anthropic.Beta.Messages.BetaMessage;
type BetaMessageParam = Anthropic.Beta.Messages.BetaMessageParam;
type BetaToolUseBlock = Anthropic.Beta.Messages.BetaToolUseBlock;
type BetaToolResultBlockParam = Anthropic.Beta.Messages.BetaToolResultBlockParam;
export type CopilotStreamParams = Anthropic.Beta.Messages.MessageCreateParamsStreaming;

/** The part of the SDK's BetaMessageStream the loop uses; tests supply fakes. */
export interface ModelStream {
  on(event: "text", listener: (delta: string) => void): unknown;
  finalMessage(): Promise<BetaMessage>;
}
export type CreateModelStream = (params: Omit<CopilotStreamParams, "stream">, signal: AbortSignal) => ModelStream;

export type CopilotEvent =
  | {type: "text"; text: string}
  | {type: "tool"; id: string; name: string; label: string; state: "running" | "done" | "failed"};

export interface HistoryMessage { role: "USER" | "ASSISTANT"; content: string }

export interface UsageTotals {
  inputTokens: number; outputTokens: number; cacheReadInputTokens: number; cacheCreationInputTokens: number;
  modelRequests: number; toolCalls: number;
}

export interface ToolExecutionRecord { name: string; status: ToolOutcome["status"]; errorCode: string | null; resultCount: number | null; durationMs: number }

export interface TurnResult {
  status: "SUCCEEDED" | "FAILED" | "CANCELLED";
  /** Exactly the text streamed to the user, in order. */
  text: string;
  error: WorkspaceError | null;
  usage: UsageTotals;
  /** The model that served the last response (may differ when a refusal fallback ran). */
  servedModel: string | null;
  tools: ToolExecutionRecord[];
}

export interface RunTurnOptions {
  config: Pick<AiConfig, "model" | "effort" | "refusalFallback" | "maxOutputTokens" | "maxToolRounds" | "maxToolCalls">;
  history: HistoryMessage[];
  userMessage: string;
  contextPrompt: string;
  createStream: CreateModelStream;
  executeTool: ToolExecutor;
  emit: (event: CopilotEvent) => void;
  signal: AbortSignal;
  /** Classifies provider failures; injected so this module has no SDK runtime dependency. */
  mapError: (error: unknown) => WorkspaceError;
}

/** Rebuild provider context from stored history: alternating text turns, starting with a user turn. */
export function historyToMessages(history: HistoryMessage[]): BetaMessageParam[] {
  const messages: BetaMessageParam[] = [];
  for (const item of history) {
    const role = item.role === "USER" ? "user" : "assistant";
    if (!item.content.trim()) continue;
    if (!messages.length && role !== "user") continue;
    const previous = messages[messages.length - 1];
    if (previous && previous.role === role) {
      previous.content = `${previous.content as string}\n\n${item.content}`;
    } else {
      messages.push({role, content: item.content});
    }
  }
  // A dangling user turn (an earlier failure) would make two user turns in a row.
  if (messages.length && messages[messages.length - 1].role === "user") messages.pop();
  return messages;
}

function addUsage(totals: UsageTotals, message: BetaMessage) {
  const usage = message.usage;
  totals.inputTokens += usage?.input_tokens ?? 0;
  totals.outputTokens += usage?.output_tokens ?? 0;
  totals.cacheReadInputTokens += usage?.cache_read_input_tokens ?? 0;
  totals.cacheCreationInputTokens += usage?.cache_creation_input_tokens ?? 0;
  totals.modelRequests += 1;
}

/**
 * One Copilot turn using the Messages API tool-use cycle: send the
 * conversation and tools, run every requested tool on the server, return all
 * tool_result blocks (matched by tool_use_id) in one user message, and repeat
 * until Claude answers or a limit is reached. On the last allowed round tools
 * are disabled (tool_choice none) so Claude must answer with what it has.
 * Assistant content, including thinking blocks, is passed back unchanged.
 */
export async function runCopilotTurn(options: RunTurnOptions): Promise<TurnResult> {
  const {config, emit, signal} = options;
  const usage: UsageTotals = {inputTokens: 0, outputTokens: 0, cacheReadInputTokens: 0, cacheCreationInputTokens: 0, modelRequests: 0, toolCalls: 0};
  const tools: ToolExecutionRecord[] = [];
  const messages: BetaMessageParam[] = [...historyToMessages(options.history), {role: "user", content: options.userMessage}];
  const toolDefinitions = anthropicTools();
  let text = "";
  let servedModel: string | null = null;
  let roundHasText = false;

  const write = (delta: string) => {
    if (!delta) return;
    if (!roundHasText && text) {
      // Separate text from different rounds the same way in the stream and the saved answer.
      text += "\n\n";
      emit({type: "text", text: "\n\n"});
    }
    roundHasText = true;
    text += delta;
    emit({type: "text", text: delta});
  };
  const fail = (error: WorkspaceError): TurnResult => ({status: error.code === "AI_CANCELLED" ? "CANCELLED" : "FAILED", text, error, usage, servedModel, tools});

  try {
    for (let round = 0; round < config.maxToolRounds + 1; round += 1) {
      if (signal.aborted) throw signal.reason ?? new WorkspaceError("AI_CANCELLED", 409, "The response was stopped.");
      const finalRound = round === config.maxToolRounds;
      roundHasText = false;
      const stream = options.createStream({
        model: config.model,
        max_tokens: config.maxOutputTokens,
        system: [
          {type: "text", text: COPILOT_SYSTEM_PROMPT, cache_control: {type: "ephemeral"}},
          {type: "text", text: options.contextPrompt},
        ],
        tools: toolDefinitions,
        tool_choice: finalRound ? {type: "none"} : {type: "auto"},
        thinking: {type: "adaptive"},
        output_config: {effort: config.effort},
        messages,
        ...(config.refusalFallback ? {betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const} : {}),
      }, signal);
      stream.on("text", write);
      const message = await stream.finalMessage();
      addUsage(usage, message);
      servedModel = message.model ?? servedModel;

      if (message.stop_reason === "refusal") {
        return fail(new WorkspaceError("AI_REFUSED", 409, "Claude declined to answer this request. Rephrase it as a CRM question."));
      }
      const toolUses = message.content.filter((block): block is BetaToolUseBlock => block.type === "tool_use");
      if (message.stop_reason === "max_tokens" || message.stop_reason === "model_context_window_exceeded") {
        // A truncated answer or tool input is incomplete and is never saved or executed.
        return fail(new WorkspaceError("AI_RESPONSE_INCOMPLETE", 409, "The answer was cut off before it finished. Ask a narrower question or start a new conversation."));
      }
      if (message.stop_reason === "pause_turn") {
        messages.push({role: "assistant", content: message.content});
        continue;
      }
      if (!toolUses.length) {
        if (!text.trim()) return fail(new WorkspaceError("AI_EMPTY_RESPONSE", 409, "Claude returned an empty answer. Try again."));
        return {status: "SUCCEEDED", text, error: null, usage, servedModel, tools};
      }
      if (finalRound) break;

      messages.push({role: "assistant", content: message.content});
      const executions = await Promise.all(toolUses.map(async (block): Promise<{result: BetaToolResultBlockParam; record: ToolExecutionRecord}> => {
        const name = block.name.slice(0, 64);
        const label = isAiToolName(block.name) ? AI_TOOL_LABELS[block.name] : "Checking a request";
        if (usage.toolCalls >= config.maxToolCalls) {
          return {record: {name, status: "REJECTED", errorCode: "TOOL_LIMIT", resultCount: null, durationMs: 0},
            result: {type: "tool_result", tool_use_id: block.id, is_error: true,
              content: JSON.stringify({ok: false, error: {code: "TOOL_LIMIT", message: "The tool-call limit for this question was reached. Answer with the information already gathered."}})}};
        }
        usage.toolCalls += 1;
        emit({type: "tool", id: block.id, name, label, state: "running"});
        const outcome = await options.executeTool(block.name, block.input, signal);
        emit({type: "tool", id: block.id, name, label, state: outcome.status === "SUCCEEDED" ? "done" : "failed"});
        return {record: {name, status: outcome.status, errorCode: outcome.errorCode, resultCount: outcome.resultCount, durationMs: outcome.durationMs},
          result: {type: "tool_result", tool_use_id: block.id, content: outcome.content, ...(outcome.status === "SUCCEEDED" ? {} : {is_error: true})}};
      }));
      // Records and results keep the order of Claude's tool_use blocks.
      for (const execution of executions) tools.push(execution.record);
      messages.push({role: "user", content: executions.map(execution => execution.result)});
    }
    return fail(new WorkspaceError("AI_RESPONSE_INCOMPLETE", 409, "Claude could not finish within the tool-use limit. Ask a narrower question."));
  } catch (error) {
    if (signal.aborted) {
      const reason = signal.reason;
      if (reason instanceof WorkspaceError) return fail(reason);
      return fail(new WorkspaceError("AI_CANCELLED", 409, "The response was stopped."));
    }
    return fail(options.mapError(error));
  }
}
