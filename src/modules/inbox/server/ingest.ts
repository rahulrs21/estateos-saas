import "server-only";

import { randomUUID } from "node:crypto";
import { asServer, isDuplicate, sdk, serverDataConnect } from "@/modules/communications/server/data";
import { mapWorkspaceDataError } from "@/modules/organizations/server/errors";
import { canonicalUuid } from "@/modules/organizations/server/identifiers";
import { stableUuid } from "@/modules/automations/ids";
import { channelIdentity, matchDecision, type MatchCandidate } from "../identity";
import type { InboxChannel, MessageType } from "../model";
import { isOptOutMessage, preview } from "../policy";

/*
 * The one ingestion path for inbound messages (docs/UNIFIED_INBOX.md#ingestion):
 * website enquiries, the developer simulator and, from Phase 7B, verified
 * provider webhooks. Callers have already verified the source and resolved the
 * company from a trusted record; nothing here trusts a company from a payload.
 * The conversation, the message and the 6E workflow events are written in one
 * transaction; a repeated provider message is a duplicate, never a second row.
 */

export interface InboundMessage {
  organizationId: string;
  channelConnectionId: string | null;
  channel: InboxChannel;
  externalThreadId: string;
  externalMessageId: string;
  from: {phone?: string | null; email?: string | null; name?: string | null};
  to?: string | null;
  subject?: string | null;
  messageType: MessageType;
  content: string | null;
  providerTimestamp?: string | null;
  simulated?: boolean;
  /** A known link (for example the website form's own new lead); otherwise the identity is matched. */
  link?: {contactId: string | null; leadId: string | null; assignedMembershipId: string | null};
}

export type IngestResult =
  | {status: "CREATED" | "APPENDED"; conversationId: string; messageId: string; match: "LINKED" | "MATCHED" | "AMBIGUOUS" | "UNKNOWN" | "EXISTING"}
  | {status: "DUPLICATE"; conversationId: string | null}
  | {status: "REJECTED"; reason: "NO_IDENTITY"};

const clip = (value: string | null | undefined, max: number) => value ? value.slice(0, max) : null;

async function findConversation(input: InboundMessage) {
  const data = await asServer("FindInboxConversation", dc => sdk.findInboxConversation(dc, {
    organizationId: input.organizationId, hasConnection: Boolean(input.channelConnectionId), channelConnectionId: input.channelConnectionId, externalThreadId: input.externalThreadId,
  }));
  return (data.connected ?? data.internal ?? [])[0] ?? null;
}

async function matchIdentity(organizationId: string, identity: {kind: "PHONE" | "EMAIL"; value: string}) {
  const data = await asServer("MatchInboxIdentity", dc => sdk.matchInboxIdentity(dc, {
    organizationId, hasPhone: identity.kind === "PHONE", phone: identity.kind === "PHONE" ? identity.value : null, hasEmail: identity.kind === "EMAIL", email: identity.kind === "EMAIL" ? identity.value : null,
  }));
  const candidates: MatchCandidate[] = [...(data.byPhone ?? []), ...(data.byEmail ?? [])]
    .map(contact => ({id: canonicalUuid(contact.id), leads: contact.leads.map(lead => ({id: canonicalUuid(lead.id), assignedMembershipId: lead.assignedMembershipId ? canonicalUuid(lead.assignedMembershipId) : null}))}));
  return matchDecision(candidates);
}

export async function ingestInbound(input: InboundMessage): Promise<IngestResult> {
  const identity = channelIdentity(input.channel, {phone: input.from.phone, email: input.from.email});
  if (!identity) return {status: "REJECTED", reason: "NO_IDENTITY"};
  const content = clip(input.content, 8000);
  const message = {
    channelConnectionId: input.channelConnectionId, externalMessageId: input.externalMessageId.slice(0, 200), messageType: sdk.InboxMessageType[input.messageType], content,
    senderIdentity: identity.value, recipientIdentity: clip(input.to, 254), providerTimestamp: input.providerTimestamp ?? null, preview: clip(preview(content || `[${input.messageType.toLowerCase()}]`), 200),
    simulated: Boolean(input.simulated), optedOut: isOptOutMessage(content),
  };
  // A stable message ID per provider message, so a retried delivery finds the same row.
  const messageId = stableUuid("inbox-message", input.organizationId, input.channelConnectionId ?? "internal", message.externalMessageId);

  for (let attempt = 0; attempt < 2; attempt++) {
    const existing = await findConversation(input);
    try {
      if (existing) {
        // Called directly (not asServer) so a unique-key conflict is still recognisable as a duplicate.
        await sdk.appendInboxMessage(serverDataConnect(), {organizationId: input.organizationId, conversationId: canonicalUuid(existing.id), messageId, ...message});
        return {status: "APPENDED", conversationId: canonicalUuid(existing.id), messageId, match: "EXISTING"};
      }
      const decision = input.link ? null : await matchIdentity(input.organizationId, identity);
      const link = input.link ?? (decision?.status === "MATCHED" ? {contactId: decision.contactId, leadId: decision.leadId, assignedMembershipId: decision.assignedMembershipId} : {contactId: null, leadId: null, assignedMembershipId: null});
      const conversationId = randomUUID();
      await sdk.createInboxConversationWithMessage(serverDataConnect(), {
        organizationId: input.organizationId, conversationId, channel: sdk.InboxChannel[input.channel], externalThreadId: input.externalThreadId.slice(0, 200),
        customerIdentity: identity.value, customerName: clip(input.from.name, 160), subject: clip(input.subject, 300), ...link, messageId, ...message,
      });
      return {status: "CREATED", conversationId, messageId, match: input.link ? "LINKED" : decision!.status};
    } catch (error) {
      if (!isDuplicate(error)) throw mapWorkspaceDataError(error);
      // Either this message was already stored (a retried delivery), or another delivery created the
      // conversation a moment ago: look again, and append unless the message itself exists.
      const again = await findConversation(input);
      if (attempt === 1 || !again || (existing && canonicalUuid(existing.id) === canonicalUuid(again.id))) return {status: "DUPLICATE", conversationId: again ? canonicalUuid(again.id) : null};
    }
  }
  return {status: "DUPLICATE", conversationId: null};
}
