import "server-only";

import { normalizePhoneIdentity } from "../identity";
import type { MetaTemplate, templateComponents } from "../whatsapp-templates";
import { mediaUrlAllowed } from "../whatsapp-media";
import { readInboxSecret } from "./connections";

/*
 * The WhatsApp Cloud API (Meta Graph API), server only (docs/WHATSAPP_INTEGRATION_PLAN.md#phase-7b).
 * The access token is read from the server secret the connection names and is
 * never logged or returned. Phase 7B.1 sends only to the test recipients listed
 * in INBOX_WHATSAPP_TEST_RECIPIENTS; without that list nothing is sent at all.
 */

const DEFAULT_VERSION = "v27.0";
const TIMEOUT_MS = 15_000;

/** The Graph API origin. Tests may point it at a local fake server; nothing else is accepted. */
export function graphBase() {
  const override = process.env.INBOX_WHATSAPP_GRAPH_BASE?.trim();
  if (override && process.env.NODE_ENV !== "production" && /^http:\/\/127\.0\.0\.1:\d{2,5}$/.test(override)) return override;
  return "https://graph.facebook.com";
}
export function graphVersion() {
  const value = process.env.INBOX_WHATSAPP_GRAPH_VERSION?.trim();
  return value && /^v\d{1,3}\.\d$/.test(value) ? value : DEFAULT_VERSION;
}

/**
 * Phase 7B.1 test mode: the numbers EstateOS may send to (E.164, comma separated).
 * Empty means live sending is off on this server.
 */
export function testRecipients(): string[] {
  return (process.env.INBOX_WHATSAPP_TEST_RECIPIENTS ?? "").split(",").map(item => normalizePhoneIdentity(item.trim())).filter((item): item is string => Boolean(item)).slice(0, 10);
}
export const liveSendingConfigured = () => testRecipients().length > 0;
export const recipientAllowed = (identity: string) => testRecipients().includes(identity);

export const accessToken = (reference: string | null | undefined) => readInboxSecret(reference);

export interface GraphFailure {ok: false; status: number; code: string; message: string}
type GraphResult<T> = {ok: true; data: T} | GraphFailure;

/** Meta's error, reduced to a code and a short message safe to show administrators (no token, no payload). */
function failure(status: number, body: unknown): GraphFailure {
  const error = (body as {error?: {code?: unknown; error_subcode?: unknown; message?: unknown}} | null)?.error;
  const code = error?.code != null ? String(error.code).replace(/[^0-9A-Za-z_]/g, "").slice(0, 20) : String(status);
  const message = typeof error?.message === "string" ? error.message.replace(/\s+/g, " ").replace(/access token[^.]*/i, "access token problem").slice(0, 200) : `HTTP ${status}`;
  return {ok: false, status, code, message};
}

async function graph<T>(path: string, token: string, init: {method: "GET" | "POST"; body?: unknown} = {method: "GET"}): Promise<GraphResult<T>> {
  let response: Response;
  try {
    response = await fetch(`${graphBase()}/${graphVersion()}/${path}`, {
      method: init.method, redirect: "error", signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {Authorization: `Bearer ${token}`, ...(init.body ? {"Content-Type": "application/json"} : {})},
      body: init.body ? JSON.stringify(init.body) : undefined,
    });
  } catch (error) {
    const timeout = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
    return {ok: false, status: 0, code: timeout ? "TIMEOUT" : "NETWORK", message: timeout ? "Meta did not answer in time." : "Meta could not be reached."};
  }
  const body = await response.json().catch(() => null);
  return response.ok ? {ok: true, data: body as T} : failure(response.status, body);
}

/** The connection check: Meta confirms the phone number ID with the token. */
export async function checkPhoneNumber(token: string, phoneNumberId: string) {
  if (!/^\d{5,30}$/.test(phoneNumberId)) return {ok: false, status: 0, code: "ACCOUNT", message: "The phone number ID must be digits."} satisfies GraphFailure;
  const result = await graph<{id?: string; display_phone_number?: string; verified_name?: string; quality_rating?: string}>(
    `${phoneNumberId}?fields=id,display_phone_number,verified_name,quality_rating`, token);
  if (!result.ok) return result;
  if (result.data.id !== phoneNumberId) return {ok: false, status: 200, code: "ACCOUNT", message: "Meta returned a different phone number."} satisfies GraphFailure;
  return {ok: true as const, displayNumber: (result.data.display_phone_number ?? "").slice(0, 32) || null, verifiedName: (result.data.verified_name ?? "").slice(0, 160) || null};
}

/**
 * Phase 7B.2: the WhatsApp Business Account really holds this phone number (its templates are listed from it).
 * A read-only request; nothing is sent to anyone.
 */
export async function checkBusinessAccount(token: string, businessAccountId: string, phoneNumberId: string) {
  if (!/^\d{5,30}$/.test(businessAccountId)) return {ok: false, status: 0, code: "BUSINESS_ACCOUNT", message: "The WhatsApp Business Account ID must be digits."} satisfies GraphFailure;
  const result = await graph<{data?: Array<{id?: string}>}>(`${businessAccountId}/phone_numbers?fields=id&limit=100`, token);
  if (!result.ok) return result;
  if (!(result.data.data ?? []).some(item => item.id === phoneNumberId)) {
    return {ok: false, status: 200, code: "BUSINESS_ACCOUNT", message: "This phone number does not belong to that WhatsApp Business Account."} satisfies GraphFailure;
  }
  return {ok: true as const};
}

/** Phase 7B.2: the account's message templates (every status; the caller offers only approved ones). Bounded to three pages. */
export async function listMessageTemplates(token: string, businessAccountId: string) {
  if (!/^\d{5,30}$/.test(businessAccountId)) return {ok: false, status: 0, code: "BUSINESS_ACCOUNT", message: "Add the WhatsApp Business Account ID to this channel in Inbox settings first."} satisfies GraphFailure;
  const templates: MetaTemplate[] = [];
  let after: string | null = null;
  for (let page = 0; page < 3; page++) {
    const query: URLSearchParams = new URLSearchParams({fields: "id,name,language,status,category,components,parameter_format", limit: "100", ...(after ? {after} : {})});
    const result: GraphResult<{data?: MetaTemplate[]; paging?: {cursors?: {after?: string}; next?: string}}> = await graph(`${businessAccountId}/message_templates?${query}`, token);
    if (!result.ok) return result;
    templates.push(...(result.data.data ?? []));
    after = result.data.paging?.next ? result.data.paging.cursors?.after ?? null : null;
    if (!after) break;
  }
  return {ok: true as const, templates};
}

export type WhatsAppMessage = {kind: "TEXT"; text: string} | {kind: "TEMPLATE"; name: string; language: string; components?: ReturnType<typeof templateComponents>};

/** Phase 7B.2: where a customer's media can be downloaded (Meta answers with a short-lived URL, its type, size and sha256). */
export async function whatsappMediaLookup(token: string, mediaId: string) {
  if (!/^[A-Za-z0-9_.-]{1,200}$/.test(mediaId)) return {ok: false, status: 0, code: "MEDIA_ID", message: "Not a WhatsApp media ID."} satisfies GraphFailure;
  const result = await graph<{url?: unknown; mime_type?: unknown; sha256?: unknown; file_size?: unknown; id?: unknown}>(encodeURIComponent(mediaId), token);
  if (!result.ok) return result;
  const url = typeof result.data.url === "string" ? result.data.url : "";
  return {ok: true as const, url, mimeType: typeof result.data.mime_type === "string" ? result.data.mime_type.slice(0, 100) : null,
    sha256: typeof result.data.sha256 === "string" && /^[0-9a-f]{64}$/i.test(result.data.sha256) ? result.data.sha256.toLowerCase() : null,
    sizeBytes: Number(result.data.file_size) > 0 ? Number(result.data.file_size) : null};
}

/**
 * Downloads the media with the token: only from Meta's media hosts (the token is sent along), no redirects,
 * at most maxBytes read. A larger file is refused without being read to the end.
 */
export async function downloadWhatsAppMedia(token: string, url: string, maxBytes: number) {
  const testOrigin = graphBase() === "https://graph.facebook.com" ? null : graphBase();
  if (!mediaUrlAllowed(url, testOrigin)) return {ok: false, status: 0, code: "URL_NOT_ALLOWED", message: "Not a WhatsApp media address."} satisfies GraphFailure;
  let response: Response;
  try {
    response = await fetch(url, {redirect: "error", cache: "no-store", signal: AbortSignal.timeout(60_000), headers: {Authorization: `Bearer ${token}`}});
  } catch (error) {
    const timeout = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
    return {ok: false, status: 0, code: timeout ? "TIMEOUT" : "NETWORK", message: timeout ? "WhatsApp did not send the file in time." : "WhatsApp could not be reached."} satisfies GraphFailure;
  }
  if (!response.ok) return {ok: false, status: response.status, code: String(response.status), message: `HTTP ${response.status}`} satisfies GraphFailure;
  const declared = Number(response.headers.get("content-length"));
  if (declared > maxBytes) { await response.body?.cancel().catch(() => undefined); return {ok: false, status: 413, code: "TOO_LARGE", message: "The file is too large."} satisfies GraphFailure; }
  const reader = response.body?.getReader();
  if (!reader) return {ok: false, status: 0, code: "EMPTY", message: "WhatsApp sent no file."} satisfies GraphFailure;
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const {done, value} = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) { await reader.cancel().catch(() => undefined); return {ok: false, status: 413, code: "TOO_LARGE", message: "The file is too large."} satisfies GraphFailure; }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return {ok: true as const, bytes};
}

/** Sends one message. Only an accepted response with a message ID counts as sent. */
export async function sendWhatsAppMessage(token: string, phoneNumberId: string, to: string, message: WhatsAppMessage) {
  const recipient = to.replace(/\D/g, "");
  const body = message.kind === "TEXT"
    ? {messaging_product: "whatsapp", recipient_type: "individual", to: recipient, type: "text", text: {preview_url: false, body: message.text}}
    : {messaging_product: "whatsapp", recipient_type: "individual", to: recipient, type: "template",
      template: {name: message.name, language: {code: message.language}, ...(message.components?.length ? {components: message.components} : {})}};
  const result = await graph<{messages?: Array<{id?: unknown}>}>(`${phoneNumberId}/messages`, token, {method: "POST", body});
  if (!result.ok) return result;
  const id = result.data.messages?.[0]?.id;
  if (typeof id !== "string" || !id.trim()) return {ok: false, status: 200, code: "NO_MESSAGE_ID", message: "Meta accepted the request but returned no message ID."} satisfies GraphFailure;
  return {ok: true as const, providerMessageId: id.slice(0, 200)};
}
