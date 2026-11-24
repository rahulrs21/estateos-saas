import "server-only";

import { randomUUID } from "node:crypto";
import { z } from "zod";
import { escapeLikeSearch } from "@/modules/ai/policy";
import { devToolsEnabled } from "@/modules/communications/dev/guard";
import { asMember, isAdministrator, sdk, type Context } from "@/modules/communications/server/data";
import { idSchema, parseInput } from "@/modules/communications/server/validation";
import { WorkspaceError } from "@/modules/organizations/server/errors";
import { canonicalUuid } from "@/modules/organizations/server/identifiers";
import { linkGivesSource } from "../ad-referral";
import { identityMatchesContact } from "../identity";
import { CONVERSATION_STATUSES, INBOX_CHANNELS, INBOX_VIEWS, PRIORITIES, type Role } from "../model";
import { STATUS_ACTIONS, canAssign, nextCursor, serviceWindow } from "../policy";

/*
 * Inbox conversations (docs/UNIFIED_INBOX.md). Every read and change runs as
 * the signed-in member, so the database applies the visibility rule
 * (dataconnect/connector-messaging/inbox.gql) on each call; guessed IDs give not-found.
 */

const PAGE_SIZE = 25;
const MESSAGE_PAGE = 30;
const id = (value: string | null | undefined) => value ? canonicalUuid(value) : null;

const cursorSchema = z.strictObject({at: z.iso.datetime({offset: true}), seen: z.array(idSchema).max(100)});
function decodeCursor(value: string | undefined) {
  if (!value) return null;
  try { return parseInput(cursorSchema, JSON.parse(Buffer.from(value, "base64url").toString("utf8"))); }
  catch { throw new WorkspaceError("VALIDATION_ERROR", 400, "This page link is no longer valid. Reload the inbox."); }
}
const encodeCursor = (cursor: {at: string; seen: string[]} | null) => cursor ? Buffer.from(JSON.stringify(cursor)).toString("base64url") : null;

/** Developer simulator records are listed only where developer tools are on and they are asked for. */
const simulatedFilter = (flag: string | undefined) => flag === "1" && devToolsEnabled() ? undefined : false;

const listSchema = z.strictObject({
  view: z.enum(INBOX_VIEWS).default("ALL"),
  channel: z.enum(INBOX_CHANNELS).optional(),
  search: z.string().trim().max(100).optional(),
  cursor: z.string().max(4000).optional(),
  leadId: idSchema.optional(),
  contactId: idSchema.optional(),
  includeSimulated: z.enum(["1"]).optional(),
});

export async function listConversations(context: Context, query: Record<string, string>) {
  const input = parseInput(listSchema, query);
  const cursor = decodeCursor(input.cursor);
  const view = input.view;
  const data = await asMember(context, "ListInboxConversations", (dc, options) => sdk.listInboxConversations(dc, {
    organizationId: context.organizationId, limit: PAGE_SIZE + 1, cursorAt: cursor?.at, seenIds: cursor?.seen,
    channel: input.channel ? sdk.InboxChannel[input.channel] : undefined, search: escapeLikeSearch(input.search), leadId: input.leadId, contactId: input.contactId,
    simulated: simulatedFilter(input.includeSimulated),
    status: view === "OPEN" ? sdk.InboxConversationStatus.OPEN : view === "PENDING" ? sdk.InboxConversationStatus.PENDING : view === "RESOLVED" ? sdk.InboxConversationStatus.RESOLVED : undefined,
    assignedMembershipId: view === "MINE" ? canonicalUuid(context.membership.id) : undefined,
    unassigned: view === "UNASSIGNED" ? true : undefined, needsMatching: view === "NEEDS_MATCHING" ? true : undefined, minUnread: view === "UNREAD" ? 1 : undefined,
  }, options));
  const rows = data.conversations.map(row => ({...row, id: canonicalUuid(row.id), contactId: id(row.contactId), leadId: id(row.leadId), assignedMembershipId: id(row.assignedMembershipId)}));
  return {conversations: rows.slice(0, PAGE_SIZE), nextCursor: encodeCursor(nextCursor(rows, row => row.lastMessageAt, PAGE_SIZE)), view, role: data.me?.role ?? "AGENT",
    simulated: {available: devToolsEnabled(), included: simulatedFilter(input.includeSimulated) === undefined}};
}
export type ConversationListView = Awaited<ReturnType<typeof listConversations>>;

export async function inboxCounts(context: Context, query: Record<string, string> = {}) {
  const data = await asMember(context, "InboxCounts", (dc, options) => sdk.inboxCounts(dc, {organizationId: context.organizationId, simulated: simulatedFilter(query.includeSimulated)}, options));
  const count = (rows: Array<{count: number}>) => rows[0]?.count ?? 0;
  return {
    UNREAD: count(data.unread), MINE: count(data.mine), UNASSIGNED: count(data.unassigned), NEEDS_MATCHING: count(data.needsMatching),
    OPEN: count(data.open), PENDING: count(data.pending), RESOLVED: count(data.resolved),
  };
}
export type InboxCountsView = Awaited<ReturnType<typeof inboxCounts>>;

export async function getConversation(context: Context, rawId: string) {
  const conversationId = parseInput(idSchema, rawId);
  const data = await asMember(context, "GetInboxConversation", (dc, options) => sdk.getInboxConversation(dc, {organizationId: context.organizationId, id: conversationId}, options));
  if (!data.conversation) throw new WorkspaceError("NOT_FOUND", 404, "This conversation was not found.");
  const row = data.conversation;
  if (!data.me) throw new WorkspaceError("FORBIDDEN", 403, "You are not an active member of this company.");
  const role = data.me.role as Role;
  const me = canonicalUuid(data.me.id);
  return {
    ...row, id: canonicalUuid(row.id), contactId: id(row.contactId), leadId: id(row.leadId), assignedMembershipId: id(row.assignedMembershipId), channelConnectionId: id(row.channelConnectionId),
    identityVerified: row.contact ? identityMatchesContact(row.customerIdentity, row.contact) : false,
    serviceWindow: row.channel === "WHATSAPP" ? serviceWindow(row.lastInboundAt, Date.now()) : null,
    permissions: {
      assignOthers: canAssign(role, {toSelf: false, unassign: false}), takeForSelf: canAssign(role, {toSelf: true, unassign: false}) && id(row.assignedMembershipId) !== me,
      statuses: STATUS_ACTIONS[row.status as keyof typeof STATUS_ACTIONS], me,
    },
  };
}
export type ConversationView = Awaited<ReturnType<typeof getConversation>>;

const messagesSchema = z.strictObject({cursor: z.string().max(4000).optional()});

/** Newest page first from the database; returned oldest-first for display, with a cursor to earlier messages. */
export async function listMessages(context: Context, rawId: string, query: Record<string, string>) {
  const conversationId = parseInput(idSchema, rawId);
  const cursor = decodeCursor(parseInput(messagesSchema, query).cursor);
  const data = await asMember(context, "ListInboxMessages", (dc, options) => sdk.listInboxMessages(dc, {
    organizationId: context.organizationId, conversationId, limit: MESSAGE_PAGE + 1, cursorAt: cursor?.at, seenIds: cursor?.seen,
  }, options));
  const rows = data.messages.map(row => ({...row, id: canonicalUuid(row.id), attachments: row.attachments.map(({storagePath, providerMediaId, mediaFetchAttempts, mediaError, ...item}) => ({...item, id: canonicalUuid(item.id), available: Boolean(storagePath) && item.scanStatus !== "BLOCKED",
    // Phase 7B.2: a WhatsApp file still being downloaded, or why it was not stored.
    downloading: !storagePath && Boolean(providerMediaId) && mediaFetchAttempts < 5, mediaError: storagePath ? null : mediaError ?? null}))}));
  return {messages: rows.slice(0, MESSAGE_PAGE).reverse(), earlierCursor: encodeCursor(nextCursor(rows, row => row.createdAt, MESSAGE_PAGE))};
}
export type MessageListView = Awaited<ReturnType<typeof listMessages>>;

export async function assignees(context: Context) {
  const data = await asMember(context, "InboxAssignees", (dc, options) => sdk.inboxAssignees(dc, {organizationId: context.organizationId}, options));
  return data.members.map(member => ({id: canonicalUuid(member.id), name: member.userProfile?.displayName || "Team member", role: member.role}));
}

const assignSchema = z.strictObject({expectedRevision: z.number().int().min(1), toMembershipId: idSchema.nullable(), reason: z.string().trim().max(300).optional()});

export async function assignConversation(context: Context, rawId: string, body: unknown) {
  const conversationId = parseInput(idSchema, rawId);
  const input = parseInput(assignSchema, body);
  const me = canonicalUuid(context.membership.id);
  const toSelf = input.toMembershipId === me;
  if (!canAssign(context.membership.role as Role, {toSelf, unassign: input.toMembershipId === null})) {
    throw new WorkspaceError("PERMISSION_DENIED", 403, "Agents can only take a conversation for themselves. Ask a manager to reassign it.");
  }
  await asMember(context, "AssignInboxConversation", (dc, options) => sdk.assignInboxConversation(dc, {
    organizationId: context.organizationId, id: conversationId, expectedRevision: input.expectedRevision, hasTarget: input.toMembershipId !== null, toMembershipId: input.toMembershipId,
    reason: input.reason || null, historyId: randomUUID(), notify: input.toMembershipId !== null && !toSelf, notificationId: randomUUID(),
  }, options));
  return {id: conversationId, assignedMembershipId: input.toMembershipId};
}

const stateSchema = z.strictObject({expectedRevision: z.number().int().min(1), status: z.enum(CONVERSATION_STATUSES), priority: z.enum(PRIORITIES)});

export async function setConversationState(context: Context, rawId: string, body: unknown) {
  const conversationId = parseInput(idSchema, rawId);
  const input = parseInput(stateSchema, body);
  await asMember(context, "SetInboxConversationState", (dc, options) => sdk.setInboxConversationState(dc, {
    organizationId: context.organizationId, id: conversationId, expectedRevision: input.expectedRevision, status: sdk.InboxConversationStatus[input.status],
    priority: sdk.InboxPriority[input.priority], emitResolved: input.status === "RESOLVED",
  }, options));
  return {id: conversationId, status: input.status, priority: input.priority};
}

const linkSchema = z.strictObject({expectedRevision: z.number().int().min(1), leadId: idSchema.optional(), contactId: idSchema.optional()})
  .refine(value => !(value.leadId && value.contactId), "Link a lead or a contact, not both.");

/**
 * Links (or unlinks, with neither) a lead or contact the member may access. The lead's assignment is not changed.
 * Phase 7E.2: a lead with no source yet, created after the conversation began, takes the conversation's source
 * (its click-to-WhatsApp ad, or WhatsApp or email); the database checks the same rule.
 */
export async function linkConversation(context: Context, rawId: string, body: unknown) {
  const conversationId = parseInput(idSchema, rawId);
  const input = parseInput(linkSchema, body);
  const conversation = await getConversation(context, conversationId);
  let identityMatches = false;
  let attribute = false;
  if (input.leadId || input.contactId) {
    const target = await asMember(context, "InboxLinkTarget", (dc, options) => sdk.inboxLinkTarget(dc, {
      organizationId: context.organizationId, hasLead: Boolean(input.leadId), leadId: input.leadId ?? null, hasContact: Boolean(input.contactId), contactId: input.contactId ?? null,
    }, options));
    const contact = input.leadId ? target.lead?.contact : target.contact;
    if ((input.leadId && !target.lead) || (input.contactId && !target.contact)) throw new WorkspaceError("NOT_FOUND", 404, "This lead or contact was not found, or you cannot use it.");
    identityMatches = contact ? identityMatchesContact(conversation.customerIdentity, contact) : false;
    if (input.leadId && target.lead) attribute = linkGivesSource(conversation, {createdAt: target.lead.createdAt, hasSource: Boolean(target.lead.source)});
  }
  await asMember(context, "LinkInboxConversation", (dc, options) => sdk.linkInboxConversation(dc, {
    organizationId: context.organizationId, id: conversationId, expectedRevision: input.expectedRevision, hasLead: Boolean(input.leadId), leadId: input.leadId ?? null,
    hasContact: Boolean(input.contactId), contactId: input.contactId ?? null, identityMatches, attribute,
  }, options));
  return {id: conversationId, identityMatches, sourceAdded: attribute};
}

/** Phase 7E.2: links a conversation to the lead just created from it (Create lead in the inbox). */
export async function linkCreatedLead(context: Context, conversationId: string, leadId: string) {
  const conversation = await getConversation(context, conversationId);
  return linkConversation(context, conversation.id, {expectedRevision: conversation.revision, leadId});
}

const noteSchema = z.strictObject({body: z.string().trim().min(1).max(4000)});

export async function addNote(context: Context, rawId: string, body: unknown) {
  const conversationId = parseInput(idSchema, rawId);
  const input = parseInput(noteSchema, body);
  const noteId = randomUUID();
  await asMember(context, "AddInboxNote", (dc, options) => sdk.addInboxNote(dc, {organizationId: context.organizationId, id: noteId, conversationId, body: input.body}, options));
  return {id: noteId};
}

export async function markRead(context: Context, rawId: string) {
  const conversationId = parseInput(idSchema, rawId);
  await asMember(context, "MarkInboxConversationRead", (dc, options) => sdk.markInboxConversationRead(dc, {organizationId: context.organizationId, id: conversationId}, options));
  return {id: conversationId};
}

export async function inboxSettings(context: Context) {
  const data = await asMember(context, "GetInboxSettings", (dc, options) => sdk.getInboxSettings(dc, {organizationId: context.organizationId}, options));
  return {
    revision: data.settings?.revision ?? 0, approvalRequired: data.settings?.approvalRequired ?? true, retentionDays: data.settings?.retentionDays ?? 730,
    unansweredMinutes: data.settings?.unansweredMinutes ?? 120, aiEnabled: data.settings?.aiEnabled ?? false, canEdit: isAdministrator(context),
  };
}

const settingsSchema = z.strictObject({expectedRevision: z.number().int().min(0), approvalRequired: z.boolean(), retentionDays: z.number().int().min(30).max(3650), unansweredMinutes: z.number().int().min(15).max(10080), aiEnabled: z.boolean().default(false)});

export async function saveInboxSettings(context: Context, body: unknown) {
  const input = parseInput(settingsSchema, body);
  await asMember(context, "SaveInboxSettings", (dc, options) => sdk.saveInboxSettings(dc, {organizationId: context.organizationId, ...input}, options));
  return {revision: input.expectedRevision + 1};
}

/** The customer panel: the linked lead and contact as the member may see them, and the contact's other conversations. */
export async function customerContext(context: Context, rawId: string) {
  const conversation = await getConversation(context, rawId);
  const data = await asMember(context, "InboxCustomerContext", (dc, options) => sdk.inboxCustomerContext(dc, {
    organizationId: context.organizationId, conversationId: conversation.id, hasLead: Boolean(conversation.leadId), leadId: conversation.leadId,
    hasContact: Boolean(conversation.contactId), contactId: conversation.contactId,
  }, options));
  return {
    lead: data.lead ?? null, leadHidden: Boolean(conversation.leadId) && !data.lead, contact: data.contact ?? null,
    others: (data.others ?? []).map(row => ({...row, id: canonicalUuid(row.id)})),
  };
}
export type CustomerContextView = Awaited<ReturnType<typeof customerContext>>;
