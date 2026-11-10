import "server-only";

import { connection } from "next/server";
import { enforceRateLimit } from "@/lib/rate-limit/server";
import type { Context } from "@/modules/communications/server/data";
import { errorResponse, read, readContext, write as baseWrite } from "@/modules/communications/server/http";
import { attachmentFile } from "./attachments";
import { checkConnection, createConnection, listConnections, setConnectionEnabled, setConnectionSending, updateConnection } from "./connections";
import { inboxWebhookHandshake, inboxWebhookResponse } from "./webhooks";
import {
  addNote, assignConversation, assignees, customerContext, getConversation, inboxCounts, inboxSettings, linkConversation, listConversations, listMessages, markRead, saveInboxSettings, setConversationState,
} from "./conversations";
import { SIMULATOR_BODY_BYTES, inboxSimulatorState, simulateInbound, simulateReceipt, simulateWebsiteEnquiry } from "./simulator";
import { analyseConversation, applyRequirements } from "./assistant";
import { cancelReply, checkReply, createReply, decideReply, listReplies, sendReply, startWhatsAppConversation, submitReply, updateReply } from "./outbound";
import { devToolsEnabled } from "@/modules/communications/dev/guard";
import { completeMailboxConnect, disconnectMailbox, listMailboxes, setMailboxSending, startMailboxConnect, type ConnectOutcome } from "./mailboxes";
import { syncMailboxNow } from "./mail-sync";

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
export const connectionCheckResponse = (request: Request, id: string) => write(request, "inbox.connections.check", context => checkConnection(context, id));
export const connectionSendingResponse = (request: Request, id: string) => write(request, "inbox.connections.sending", (context, body) => setConnectionSending(context, id, body));
export const startWhatsAppResponse = (request: Request) => write(request, "inbox.whatsapp.start", startWhatsAppConversation, 201);
export const connectionEnabledResponse = (request: Request, id: string) => write(request, "inbox.connections.enabled", (context, body) => setConnectionEnabled(context, id, body));

// --- Mailboxes connected through OAuth (Phase 7C) ----------------------------------------------
export const mailboxesResponse = (request: Request) => read(request, "inbox.mailboxes", context => listMailboxes(context));
export const mailboxStartResponse = (request: Request) => write(request, "inbox.mailboxes.start", startMailboxConnect);
export const mailboxDisconnectResponse = (request: Request, id: string) => write(request, "inbox.mailboxes.disconnect", (context, body) => disconnectMailbox(context, id, body));
export const mailboxSendingResponse = (request: Request, id: string) => write(request, "inbox.mailboxes.sending", (context, body) => setMailboxSending(context, id, body));
export const mailboxSyncResponse = (request: Request, id: string) => write(request, "inbox.mailboxes.sync", context => syncMailboxNow(context, id));

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, char => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;"})[char]!);

/**
 * Google's return (no session cookie: it is SameSite=strict). The page then
 * navigates to Inbox settings from this site, so the session cookie is sent again.
 * Nothing secret is placed in the page or its address.
 */
export async function oauthCallbackResponse(request: Request) {
  await connection();
  let outcome: ConnectOutcome;
  try { outcome = await completeMailboxConnect(new URL(request.url)); }
  catch (error) {
    console.error(JSON.stringify({event: "inbox.mailbox.connect_failed", name: error instanceof Error ? error.name : typeof error}));
    outcome = {ok: false, code: "ERROR", message: "The mailbox could not be connected. Try again in a moment."};
  }
  if (!outcome.ok) console.warn(JSON.stringify({event: "inbox.mailbox.connect_refused", code: outcome.code}));
  const target = outcome.ok ? "/inbox/settings?mailbox=connected" : `/inbox/settings?mailbox=failed&reason=${encodeURIComponent(outcome.code)}`;
  const title = outcome.ok ? "Mailbox connected" : "Mailbox not connected";
  const message = outcome.ok ? `${outcome.address} is connected. EstateOS will start importing ${outcome.personal ? "emails from your CRM customers" : "customer emails"} within a minute.` : outcome.message;
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex, nofollow">${outcome.ok ? `<meta http-equiv="refresh" content="1;url=${target}">` : ""}<title>${title}</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;font-family:system-ui,sans-serif;background:#fafafa;color:#18181b}main{max-width:30rem;padding:2rem;text-align:center}a{color:inherit;font-weight:600}</style></head>
<body><main><h1>${title}</h1><p data-testid="mailbox-connect-result">${escapeHtml(message)}</p><p><a href="${target}">Back to Inbox settings</a></p></main></body></html>`;
  return new Response(html, {status: outcome.ok ? 200 : 400, headers: {"Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Referrer-Policy": "no-referrer",
    "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"}});
}

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
