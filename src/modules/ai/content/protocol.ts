/**
 * Newline-delimited JSON events streamed by the Content Studio generation
 * endpoints. The browser receives progress and the saved draft's identity
 * only: never facts, prompts, thinking or provider error details. The saved
 * draft is then loaded through the normal draft API.
 */
export type ContentStreamEvent =
  | {type: "start"; requestId: string}
  | {type: "stage"; stage: "writing" | "checking" | "saving"}
  | {type: "progress"; characters: number}
  | {type: "done"; draftId: string; versionNumber: number; mode: "GENERATE" | "REGENERATE" | "ALTERNATIVE"; warnings: number}
  | {type: "error"; code: string; message: string; retryable: boolean};

export function encodeContentEvent(event: ContentStreamEvent) {
  return `${JSON.stringify(event)}\n`;
}

export function decodeContentEvents(buffer: string): {events: ContentStreamEvent[]; rest: string} {
  const lines = buffer.split("\n");
  const rest = lines.pop() ?? "";
  const events: ContentStreamEvent[] = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    try { events.push(JSON.parse(line) as ContentStreamEvent); } catch { /* ignore a malformed line */ }
  }
  return {events, rest};
}
