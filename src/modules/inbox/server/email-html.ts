import "server-only";

import { asMember, asServer, sdk, type Context } from "@/modules/communications/server/data";
import { idSchema, parseInput } from "@/modules/communications/server/validation";
import { WorkspaceError } from "@/modules/organizations/server/errors";
import { canonicalUuid } from "@/modules/organizations/server/identifiers";
import { emailHtmlForStorage } from "../email";
import { outlookHtmlForStorage } from "../outlook";
import { gmailMessage } from "./google";
import { mailboxAccessToken } from "./mailboxes";
import { outlookMessage } from "./microsoft";

/*
 * An email's formatted (HTML) version (docs/INBOX_SECURITY.md#safe-rendering).
 * Cleaned on the server and returned only to members who may see the
 * conversation; the browser shows it inside a sandboxed frame. Emails imported
 * before HTML was kept are fetched from their mailbox the first time someone opens them,
 * then stored, so each is fetched at most once.
 */

/** Stores the cleaned HTML of an imported message (null and size 0 when it has none usable). */
export async function storeMessageHtml(organizationId: string, messageId: string, html: string | null) {
  await asServer("SetInboxMessageHtml", dc => sdk.setInboxMessageHtml(dc, {organizationId, id: messageId, html, bytes: html?.length ?? 0}));
}

export async function messageHtml(context: Context, rawConversationId: string, rawMessageId: string): Promise<{html: string | null; removed: boolean}> {
  const conversationId = parseInput(idSchema, rawConversationId);
  const id = parseInput(idSchema, rawMessageId);
  const data = await asMember(context, "GetInboxMessageHtml", (dc, options) => sdk.getInboxMessageHtml(dc, {organizationId: context.organizationId, conversationId, id}, options));
  const message = data.message;
  if (!data.conversation || !message) throw new WorkspaceError("NOT_FOUND", 404, "This message was not found.");
  if (message.contentRedactedAt) return {html: null, removed: true};
  if (message.contentHtmlBytes !== null && message.contentHtmlBytes !== undefined) return {html: message.contentHtml || null, removed: false};
  // Not looked up yet: only an incoming email from a connected mailbox can be fetched again.
  const connectionId = data.conversation.channelConnectionId ? canonicalUuid(data.conversation.channelConnectionId) : null;
  const provider = data.conversation.channelConnection?.provider;
  if (data.conversation.channel !== "EMAIL" || (provider !== "GMAIL" && provider !== "MICROSOFT_365") || message.direction !== "INBOUND" || !connectionId || !message.externalMessageId) {
    return {html: null, removed: false};
  }
  const mailbox = (await asServer("MailboxForAction", dc => sdk.mailboxForAction(dc, {organizationId: context.organizationId, id: connectionId, actorUid: context.request.user.uid}))).mailbox;
  const access = mailbox?.connectionStatus === "VERIFIED" ? await mailboxAccessToken(context.organizationId, connectionId, provider, mailbox.account) : null;
  if (!access?.ok) return {html: null, removed: false};
  const full = provider === "GMAIL"
    ? await gmailMessage(access.token, message.externalMessageId).then(result => result.ok ? {ok: true as const, html: emailHtmlForStorage(result.data.payload)} : result)
    : await outlookMessage(access.token, message.externalMessageId).then(result => result.ok ? {ok: true as const, html: outlookHtmlForStorage(result.data.body)} : result);
  if (!full.ok) {
    // Gone from the mailbox: remember that there is nothing to show; other failures are tried again next time.
    if (full.status === 404) await storeMessageHtml(context.organizationId, id, null);
    return {html: null, removed: false};
  }
  const html = full.html;
  await storeMessageHtml(context.organizationId, id, html);
  return {html, removed: false};
}
