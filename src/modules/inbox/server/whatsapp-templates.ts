import "server-only";

import { enforceRateLimit } from "@/lib/rate-limit/server";
import { asServer, isAdministrator, sdk, type Context } from "@/modules/communications/server/data";
import { idSchema, parseInput } from "@/modules/communications/server/validation";
import { WorkspaceError } from "@/modules/organizations/server/errors";
import { canonicalUuid } from "@/modules/organizations/server/identifiers";
import { normalizeTemplate, selectable, type WhatsAppTemplate } from "../whatsapp-templates";
import { getConversation } from "./conversations";
import { accessToken, listMessageTemplates } from "./whatsapp-cloud";

/*
 * Approved WhatsApp templates from Meta (Phase 7B.2), read on the server with the
 * channel's own token and its WhatsApp Business Account. Members who may reply on a
 * conversation see its channel's templates; owners and administrators see them to
 * start a conversation. Kept in this server's memory for five minutes; a send
 * always reads them fresh, so a template paused or changed in Meta is never sent.
 */

const CACHE_MS = 5 * 60_000;
const LIST_LIMIT = {scope: "inbox.whatsapp.templates", limit: 30, windowSeconds: 60};
const cache = new Map<string, {at: number; templates: WhatsAppTemplate[]}>();

type Connection = NonNullable<Awaited<ReturnType<typeof sdk.whatsAppTemplateConnection>>["data"]["connection"]>;

async function connectionOf(organizationId: string, connectionId: string) {
  const data = await asServer("WhatsAppTemplateConnection", dc => sdk.whatsAppTemplateConnection(dc, {organizationId, id: connectionId}));
  if (!data.connection) throw new WorkspaceError("NOT_FOUND", 404, "This WhatsApp channel was not found.");
  return data.connection;
}

/** Every template of the channel's account, normalized (fresh when asked, otherwise from the short cache). */
export async function channelTemplates(connection: Connection, fresh = false): Promise<WhatsAppTemplate[]> {
  const key = canonicalUuid(connection.id);
  const cached = cache.get(key);
  if (!fresh && cached && Date.now() - cached.at < CACHE_MS) return cached.templates;
  if (!connection.businessAccountReference) throw new WorkspaceError("INBOX_TEMPLATES_UNAVAILABLE", 409, "Add the WhatsApp Business Account ID to this channel in Inbox settings to use templates.");
  const token = accessToken(connection.accessTokenReference);
  if (!token) throw new WorkspaceError("INBOX_TEMPLATES_UNAVAILABLE", 409, "The server has no access token for this WhatsApp channel. An administrator must set it and check the connection again.");
  const result = await listMessageTemplates(token, connection.businessAccountReference);
  if (!result.ok) throw new WorkspaceError("INBOX_TEMPLATES_UNAVAILABLE", 503, `Meta did not return the templates (${result.code}): ${result.message}`);
  const templates = result.templates.map(normalizeTemplate).filter((item): item is WhatsAppTemplate => item !== null)
    .sort((a, b) => a.name.localeCompare(b.name) || a.language.localeCompare(b.language));
  cache.set(key, {at: Date.now(), templates});
  return templates;
}

/** What a member may choose from: the approved ones, and how many others exist (pending, paused, rejected or not supported yet). */
function view(templates: WhatsAppTemplate[]) {
  return {templates: templates.filter(selectable), others: templates.filter(item => !selectable(item)).map(item => ({name: item.name, language: item.language, status: item.status, reason: item.unsupportedReason}))};
}
export type TemplatesView = ReturnType<typeof view>;

/** The templates of a conversation's WhatsApp channel, for a member who may see the conversation. */
export async function conversationTemplates(context: Context, rawConversationId: string) {
  const conversation = await getConversation(context, rawConversationId);
  if (conversation.channel !== "WHATSAPP" || !conversation.channelConnectionId || conversation.simulated) throw new WorkspaceError("VALIDATION_ERROR", 400, "Templates are only for real WhatsApp conversations.");
  await enforceRateLimit([{rule: LIST_LIMIT, subject: context.request.user.uid}], "Templates were loaded a moment ago. Wait a minute and try again.");
  return view(await channelTemplates(await connectionOf(context.organizationId, conversation.channelConnectionId)));
}

/** The templates of a WhatsApp channel, for an owner or administrator starting a conversation. */
export async function connectionTemplates(context: Context, rawConnectionId: string) {
  if (!isAdministrator(context)) throw new WorkspaceError("PERMISSION_DENIED", 403, "Only owners and administrators can start WhatsApp conversations.");
  const id = parseInput(idSchema, rawConnectionId);
  await enforceRateLimit([{rule: LIST_LIMIT, subject: context.request.user.uid}], "Templates were loaded a moment ago. Wait a minute and try again.");
  return view(await channelTemplates(await connectionOf(context.organizationId, id)));
}

/** One approved, supported template of the channel (fresh from Meta when sending), or a clear refusal. */
export async function approvedTemplate(organizationId: string, connectionId: string, name: string, language: string, fresh = false) {
  const templates = await channelTemplates(await connectionOf(organizationId, connectionId), fresh);
  const template = templates.find(item => item.name === name && item.language === language);
  if (!template) throw new WorkspaceError("INBOX_TEMPLATE_NOT_FOUND", 409, `The template "${name}" (${language}) is not in this WhatsApp account. Choose an approved template.`);
  if (template.status !== "APPROVED") throw new WorkspaceError("INBOX_TEMPLATE_NOT_APPROVED", 409, `The template "${name}" is ${template.status.toLowerCase()} in Meta, so it cannot be sent. Choose an approved template.`);
  if (!template.supported) throw new WorkspaceError("INBOX_TEMPLATE_UNSUPPORTED", 409, template.unsupportedReason ?? "EstateOS cannot send this template yet.");
  return template;
}

/** Forgets the cached templates of a channel (after its details change). */
export const forgetTemplates = (connectionId: string) => cache.delete(canonicalUuid(connectionId));
