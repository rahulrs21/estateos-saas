import "server-only";

import { connection } from "next/server";
import { enforceRateLimit } from "@/lib/rate-limit/server";
import type { Context } from "@/modules/communications/server/data";
import { errorResponse, read, readContext, write as baseWrite } from "@/modules/communications/server/http";
import { attachmentFile } from "./attachments";
import { createConnection, listConnections, setConnectionEnabled, updateConnection } from "./connections";
import { inboxWebhookHandshake, inboxWebhookResponse } from "./webhooks";
import {
  addNote, assignConversation, assignees, customerContext, getConversation, inboxCounts, inboxSettings, linkConversation, listConversations, listMessages, markRead, saveInboxSettings, setConversationState,
} from "./conversations";
import { SIMULATOR_BODY_BYTES, inboxSimulatorState, simulateInbound, simulateReceipt, simulateWebsiteEnquiry } from "./simulator";
import { analyseConversation, applyRequirements } from "./assistant";
import { cancelReply, checkReply, createReply, decideReply, listReplies, sendReply, submitReply, updateReply } from "./outbound";
import { devToolsEnabled } from "@/modules/communications/dev/guard";

/*
 * Inbox endpoints (docs/UNIFIED_INBOX.md#api). The same request policy as the
 * communication hub: reads need a verified session; changes also need
 * same-origin, the CSRF token and the company header matching the session's
 * company. The company always comes from the session.
 */

/** Inbox changes are limited per member (docs/INBOX_SECURITY.md#rate-limits); Claude, webhooks and the simulator have their own limits too. */
const WRITE_LIMIT = {scope: "inbox.write.member", limit: 120, windowSeconds: 60};
function write(request: Request, endpoint: string, work: (context: Context, body: unknown) => Promise<unknown>, status = 200, maxBytes?: number) {
  return baseWrite(request, endpoint, async (context, body) => {
    await enforceRateLimit([{rule: WRITE_LIMIT, subject: context.membership.id}], "You are making inbox changes too quickly. Wait a moment and try again.");
    return work(context, body);
  }, status, maxBytes);
}

export const listConversationsResponse = (request: Request) => read(request, "inbox.list", listConversations);
export const countsResponse = (request: Request) => read(request, "inbox.counts", inboxCounts);
export const getConversationResponse = (request: Request, id: string) => read(request, "inbox.get", context => getConversation(context, id));
export const messagesResponse = (request: Request, id: string) => read(request, "inbox.messages", (context, query) => listMessages(context, id, query));
export const assigneesResponse = (request: Request) => read(request, "inbox.assignees", context => assignees(context));
export const assignResponse = (request: Request, id: string) => write(request, "inbox.assign", (context, body) => assignConversation(context, id, body));
export const stateResponse = (request: Request, id: string) => write(request, "inbox.state", (context, body) => setConversationState(context, id, body));
export const linkResponse = (request: Request, id: string) => write(request, "inbox.link", (context, body) => linkConversation(context, id, body));
export const noteResponse = (request: Request, id: string) => write(request, "inbox.note", (context, body) => addNote(context, id, body), 201);
export const readMarkResponse = (request: Request, id: string) => write(request, "inbox.read", context => markRead(context, id));
export const settingsResponse = (request: Request) => read(request, "inbox.settings", context => inboxSettings(context));
export const saveSettingsResponse = (request: Request) => write(request, "inbox.settings.save", saveInboxSettings);
export const customerResponse = (request: Request, id: string) => read(request, "inbox.customer", context => customerContext(context, id));

// --- Replies and the assistant (7A.5) ---------------------------------------------------------
export const repliesResponse = (request: Request, id: string) => read(request, "inbox.replies", context => listReplies(context, id));
export const createReplyResponse = (request: Request, id: string) => write(request, "inbox.replies.create", (context, body) => createReply(context, id, body), 201);
export const updateReplyResponse = (request: Request, id: string, replyId: string) => write(request, "inbox.replies.update", (context, body) => updateReply(context, id, replyId, body));
const REPLY_ACTIONS = {check: checkReply, submit: submitReply, decide: decideReply, cancel: cancelReply, send: sendReply} as const;
export function replyActionResponse(request: Request, id: string, replyId: string, action: string) {
  const work = REPLY_ACTIONS[action as keyof typeof REPLY_ACTIONS];
  if (!work || !Object.hasOwn(REPLY_ACTIONS, action)) return new Response(null, {status: 404, headers: {"Cache-Control": "no-store"}});
  return write(request, `inbox.replies.${action}`, (context, body) => work(context, id, replyId, body));
}
export const assistantResponse = (request: Request, id: string) => write(request, "inbox.assistant", context => analyseConversation(request, context, id), 201);
export const applyRequirementsResponse = (request: Request, id: string) => write(request, "inbox.assistant.apply", (context, body) => applyRequirements(context, id, body));

// --- Channel connections (OWNER or ADMIN) -----------------------------------------------------
export const connectionsResponse = (request: Request) => read(request, "inbox.connections", context => listConnections(context));
export const createConnectionResponse = (request: Request) => write(request, "inbox.connections.create", createConnection, 201);
export const updateConnectionResponse = (request: Request, id: string) => write(request, "inbox.connections.update", (context, body) => updateConnection(context, id, body));
export const connectionEnabledResponse = (request: Request, id: string) => write(request, "inbox.connections.enabled", (context, body) => setConnectionEnabled(context, id, body));

/** Streams an attachment as a download to a member who may see the conversation; every access is audited. */
export async function attachmentResponse(request: Request, conversationId: string, id: string) {
  await connection();
  try {
    const file = await attachmentFile(await readContext(request), conversationId, id);
    const body = new Uint8Array(file.bytes.byteLength);
    body.set(file.bytes);
    const ascii = file.fileName.replace(/[^A-Za-z0-9._ -]/g, "_");
    return new Response(body, {headers: {
      "Content-Type": file.mimeType, "Content-Length": String(body.byteLength), "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox", "Content-Disposition": `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(file.fileName)}`,
    }});
  } catch (error) { return errorResponse("inbox.attachment", error); }
}

// --- Provider webhooks (no session: the provider signature authenticates the request) ---------
export async function webhookPostResponse(request: Request, provider: string, connectionId: string) {
  try { return await inboxWebhookResponse(request, provider, connectionId); }
  catch (error) { console.error(JSON.stringify({event: "inbox.webhook.unexpected_error", name: error instanceof Error ? error.name : typeof error})); return new Response(null, {status: 500, headers: {"Cache-Control": "no-store"}}); }
}
export async function webhookGetResponse(request: Request, provider: string, connectionId: string) {
  try { return await inboxWebhookHandshake(request, provider, connectionId); }
  catch { return new Response(null, {status: 500, headers: {"Cache-Control": "no-store"}}); }
}

/** Developer inbox simulator: not found (before authentication) unless developer tools are enabled. */
const notFound = () => new Response(null, {status: 404, headers: {"Cache-Control": "no-store"}});
export const simulatorStateResponse = (request: Request) => devToolsEnabled() ? read(request, "inbox.simulator.state", context => inboxSimulatorState(context)) : notFound();
export const simulatorInboundResponse = (request: Request) => devToolsEnabled() ? write(request, "inbox.simulator.inbound", simulateInbound, 201, SIMULATOR_BODY_BYTES) : notFound();
export const simulatorWebsiteResponse = (request: Request) => devToolsEnabled() ? write(request, "inbox.simulator.website", simulateWebsiteEnquiry, 201) : notFound();
export const simulatorReceiptResponse = (request: Request) => devToolsEnabled() ? write(request, "inbox.simulator.receipt", simulateReceipt) : notFound();
