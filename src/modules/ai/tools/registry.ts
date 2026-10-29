import { WorkspaceError } from "../../organizations/server/errors";
import { AI_TOOL_INPUT_SCHEMAS, isAiToolName, withoutNullArguments, type AiToolInputs, type AiToolName } from "./definitions";

export type ToolExecutionStatus = "SUCCEEDED" | "FAILED" | "REJECTED";

export interface ToolOutcome {
  status: ToolExecutionStatus;
  /** JSON text returned to Claude as the tool_result content. */
  content: string;
  errorCode: string | null;
  resultCount: number | null;
  durationMs: number;
}

export interface ToolResultData { data: unknown; resultCount?: number | null }

export type ToolHandlers = {[K in AiToolName]: (input: AiToolInputs[K]) => Promise<ToolResultData>};

export type ToolExecutor = (name: string, input: unknown, signal: AbortSignal) => Promise<ToolOutcome>;

/** Upper bound on one tool result sent to Claude; presenters already page and trim. */
export const MAX_TOOL_RESULT_CHARS = 40_000;

const NOT_PERMITTED_CODES = new Set(["NOT_FOUND", "PERMISSION_DENIED", "FORBIDDEN"]);

/**
 * Validates and executes one model-requested tool call. Unknown tools and
 * invalid arguments are rejected before any handler runs. Errors are reduced
 * to safe codes and messages: not-found and forbidden are reported the same
 * way, so guessed identifiers cannot reveal whether a record exists.
 */
export function createToolExecutor(handlers: ToolHandlers, {timeoutMs, now = () => performance.now()}: {timeoutMs: number; now?: () => number}): ToolExecutor {
  return async (name, input, signal) => {
    const started = now();
    const finish = (status: ToolExecutionStatus, body: unknown, errorCode: string | null, resultCount: number | null = null): ToolOutcome => {
      let content = JSON.stringify(body);
      if (content.length > MAX_TOOL_RESULT_CHARS) {
        status = "FAILED"; errorCode = "RESULT_TOO_LARGE"; resultCount = null;
        content = JSON.stringify({ok: false, error: {code: "RESULT_TOO_LARGE", message: "The result was too large. Narrow the filters or lower the limit."}});
      }
      return {status, content, errorCode, resultCount, durationMs: Math.max(0, Math.round(now() - started))};
    };

    if (!isAiToolName(name)) {
      return finish("REJECTED", {ok: false, error: {code: "UNKNOWN_TOOL", message: "This tool does not exist. Use only the tools provided."}}, "UNKNOWN_TOOL");
    }
    const parsed = AI_TOOL_INPUT_SCHEMAS[name].safeParse(withoutNullArguments(input ?? {}));
    if (!parsed.success) {
      const issues = parsed.error.issues.slice(0, 5).map(issue => `${issue.path.join(".") || "input"}: ${issue.message}`.slice(0, 160));
      return finish("REJECTED", {ok: false, error: {code: "INVALID_ARGUMENTS", message: "The tool arguments were invalid.", issues}}, "INVALID_ARGUMENTS");
    }
    if (signal.aborted) return finish("FAILED", {ok: false, error: {code: "CANCELLED", message: "The request was cancelled."}}, "CANCELLED");

    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const handler = handlers[name] as (value: unknown) => Promise<ToolResultData>;
      const result = await Promise.race([
        handler(parsed.data),
        new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new WorkspaceError("TOOL_TIMEOUT", 504, "The CRM query took too long. Try narrower filters.")), timeoutMs); }),
      ]);
      return finish("SUCCEEDED", {ok: true, data: result.data}, null, result.resultCount ?? null);
    } catch (error) {
      const safe = safeToolError(error);
      return finish("FAILED", {ok: false, error: safe}, safe.code);
    } finally {
      if (timer) clearTimeout(timer);
    }
  };
}

export function safeToolError(error: unknown): {code: string; message: string} {
  if (error instanceof WorkspaceError) {
    if (NOT_PERMITTED_CODES.has(error.code)) {
      return {code: "NOT_FOUND_OR_NOT_PERMITTED", message: "No matching record is available to this user. It may not exist or may be outside their permitted access."};
    }
    if (error.code === "VALIDATION_ERROR") return {code: "INVALID_ARGUMENTS", message: error.message};
    if (error.code === "TOOL_TIMEOUT") return {code: error.code, message: error.message};
    if (error.code === "UNAUTHENTICATED") return {code: error.code, message: "The user's session has ended."};
    return {code: "CRM_UNAVAILABLE", message: "EstateOS data could not be loaded for this request. Say so and do not guess."};
  }
  return {code: "CRM_UNAVAILABLE", message: "EstateOS data could not be loaded for this request. Say so and do not guess."};
}
