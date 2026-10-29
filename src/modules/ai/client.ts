"use client";

import { decodeEvents, type ChatStreamEvent } from "./protocol";

interface ApiError { error?: {code?: string; message?: string} }

export class CopilotRequestError extends Error {
  constructor(message: string, public readonly code: string, public readonly status: number) { super(message); }
}

export interface ConversationSummary { id: string; title: string; messageCount: number; createdAt: string; updatedAt: string; lastMessageAt: string }
export interface StoredMessage { id: string; sequence: number; role: "USER" | "ASSISTANT"; content: string; createdAt: string }
export type CopilotStatus =
  | {enabled: false; code: string; message: string}
  | {enabled: true; role: string; organizationId: string; maxInputChars: number;
    model: {available: true; model: string; displayName: string | null} | {available: false; model: string; code: string; message: string};
    usage: {period: string; user: {used: number; limit: number}; organization: {used: number; limit: number}}};

async function readJson<T>(response: Response, fallback: string): Promise<T> {
  let body: ApiError & {data?: T} = {};
  try { body = await response.json(); } catch { /* non-JSON error page */ }
  if (!response.ok || body.data === undefined) {
    throw new CopilotRequestError(body.error?.message || fallback, body.error?.code || "REQUEST_FAILED", response.status);
  }
  return body.data;
}

const get = <T,>(path: string, fallback: string) => fetch(path, {credentials: "same-origin", cache: "no-store"}).then(response => readJson<T>(response, fallback));

export const getCopilotStatus = () => get<CopilotStatus>("/api/ai/status", "The AI Copilot status could not be loaded.");

export function listCopilotConversations(search = "") {
  const query = new URLSearchParams({limit: "50"});
  if (search.trim()) query.set("search", search.trim());
  return get<{conversations: ConversationSummary[]; total: number}>(`/api/ai/conversations?${query}`, "Conversations could not be loaded.");
}

export const getCopilotConversation = (id: string) =>
  get<{conversation: ConversationSummary; messages: StoredMessage[]}>(`/api/ai/conversations/${encodeURIComponent(id)}`, "This conversation could not be loaded.");

async function csrfToken() {
  const response = await fetch("/api/auth/csrf", {credentials: "same-origin", cache: "no-store"});
  const body: ApiError & {csrfToken?: string} = await response.json().catch(() => ({}));
  if (!response.ok || !body.csrfToken) throw new CopilotRequestError(body.error?.message || "Could not prepare a secure request. Reload and try again.", "CSRF_UNAVAILABLE", response.status);
  return body.csrfToken;
}

export async function deleteCopilotConversation(id: string, organizationId: string) {
  const token = await csrfToken();
  const response = await fetch(`/api/ai/conversations/${encodeURIComponent(id)}`, {
    method: "DELETE", credentials: "same-origin", cache: "no-store",
    headers: {"X-CSRF-Token": token, "X-EstateOS-Organization": organizationId},
  });
  return readJson<{id: string; deleted: true}>(response, "The conversation could not be deleted.");
}

/**
 * Send one question and read the NDJSON event stream. Errors before streaming
 * starts (session, validation, rate limit, allowance) are thrown; errors during
 * the stream arrive as `error` events.
 */
export async function streamCopilotChat(input: {message: string; conversationId: string | null; organizationId: string; signal: AbortSignal; onEvent: (event: ChatStreamEvent) => void}) {
  const token = await csrfToken();
  const response = await fetch("/api/ai/chat", {
    method: "POST", credentials: "same-origin", cache: "no-store", signal: input.signal,
    headers: {"Content-Type": "application/json", "X-CSRF-Token": token, "X-EstateOS-Organization": input.organizationId},
    body: JSON.stringify(input.conversationId ? {message: input.message, conversationId: input.conversationId} : {message: input.message}),
  });
  if (!response.ok || !response.body || !response.headers.get("content-type")?.includes("application/x-ndjson")) {
    await readJson(response, "The AI Copilot could not answer. Try again.");
    throw new CopilotRequestError("The AI Copilot returned an unexpected response.", "UNEXPECTED_RESPONSE", response.status);
  }
  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  let finished = false;
  while (true) {
    const {value, done} = await reader.read();
    if (done) break;
    buffer += value;
    const {events, rest} = decodeEvents(buffer);
    buffer = rest;
    for (const event of events) {
      if (event.type === "done" || event.type === "error") finished = true;
      input.onEvent(event);
    }
  }
  const {events} = decodeEvents(`${buffer}\n`);
  for (const event of events) { if (event.type === "done" || event.type === "error") finished = true; input.onEvent(event); }
  if (!finished) throw new CopilotRequestError("The connection closed before the answer finished. Try again.", "STREAM_INTERRUPTED", 0);
}
