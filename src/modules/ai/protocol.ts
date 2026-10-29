/**
 * Newline-delimited JSON events streamed by POST /api/ai/chat. The browser
 * receives answer text, tool progress labels and outcomes only: never tool
 * arguments, tool results, thinking or provider error details.
 */
export type ChatStreamEvent =
  | {type: "start"; requestId: string; conversationId: string; isNew: boolean}
  | {type: "text"; text: string}
  | {type: "tool"; id: string; label: string; state: "running" | "done" | "failed"}
  | {type: "done"; conversationId: string; title: string | null; saved: true; usage: {inputTokens: number; outputTokens: number}}
  | {type: "error"; code: string; message: string; retryable: boolean; partialTextShown: boolean};

export function encodeEvent(event: ChatStreamEvent) {
  return `${JSON.stringify(event)}\n`;
}

/** Parse complete lines from a buffer; returns parsed events and the unfinished remainder. */
export function decodeEvents(buffer: string): {events: ChatStreamEvent[]; rest: string} {
  const lines = buffer.split("\n");
  const rest = lines.pop() ?? "";
  const events: ChatStreamEvent[] = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    try { events.push(JSON.parse(line) as ChatStreamEvent); } catch { /* ignore a malformed line */ }
  }
  return {events, rest};
}
