import "server-only";

import { randomUUID } from "node:crypto";
import { z } from "zod";
import { devToolsEnabled } from "@/modules/communications/dev/guard";
import { asMember, asServer, sdk, type Context } from "@/modules/communications/server/data";
import { idSchema, parseInput } from "@/modules/communications/server/validation";
import { WorkspaceError } from "@/modules/organizations/server/errors";
import { canonicalUuid } from "@/modules/organizations/server/identifiers";
import { ADAPTERS, canSend } from "../adapters";
import type { CheckedInsight } from "../assistant";
import type { ChannelProvider, InboxChannel, Role } from "../model";
import {
  CANCELLABLE_STAGES, EDITABLE_STAGES, MAX_OUTBOUND_CHARS, STAGE_LABELS, TEMPLATE_NAME, nextVersions, outboundApproval, parseTemplate, validateOutbound, whatsappDelivery,
  type OutboundSource, type OutboundStage, type ValidationResult,
} from "../outbound";
import { channelIdentity } from "../identity";
import { stableUuid } from "@/modules/automations/ids";
import { channelAccessToken } from "./channel-credentials";
import { dailyTemplateLimit, liveSendingConfigured, realCustomersAllowed, recipientAllowed, sendWhatsAppMessage } from "./whatsapp-cloud";
import { enforceRateLimit } from "@/lib/rate-limit/server";
import { preview } from "../policy";
import { getConversation } from "./conversations";
import { buildReplyMessage, replySubject } from "../email";
import { gmailSend } from "./google";
import { emailRecipientAllowed, emailSendingConfigured, mailboxAccessToken, providerLabel } from "./mailboxes";
import { outlookReply } from "./microsoft";
import { renderTemplate, templateComponents, templateValueProblems, templateValues } from "../whatsapp-templates";
import { approvedTemplate } from "./whatsapp-templates";

/*
 * Inbox replies (docs/UNIFIED_INBOX.md#outbound). Members draft, check and
 * submit replies on conversations they may see; OWNERs, ADMINs and MANAGERs
 * approve them (never their own, unless an OWNER). Sending is offered only in
 * developer tools, for simulated conversations on the developer simulator, and
 * the database refuses anything else; a reply is SENT only when the adapter
 * acknowledges it. WhatsApp (7B.1) and email (Gmail 7C.1, Microsoft 365 7C.2) send in
 * test mode only: to the server's test recipients, and email from a personal mailbox
 * only for its owner.
 */

const id = (value: string | null | undefined) => value ? canonicalUuid(value) : null;
const uid = (context: Context) => context.request.user.uid;

export type SendMode = "SIMULATOR" | "WHATSAPP" | "EMAIL";
/**
 * How a conversation's replies can be delivered, if at all: the developer simulator
 * (simulated conversations, developer tools on), or the WhatsApp Cloud API (Phase 7B.1:
 * a VERIFIED connection with sending on, to the server's test recipients only).
 */
export function deliveryOf(input: {provider: ChannelProvider | null; connectionStatus: string | null | undefined; sendingEnabled: boolean; simulated: boolean; identity: string;
  /** Email: the personal mailbox's owner (null for a company mailbox) and the member who would send. */
  ownerUid?: string | null; actorUid?: string | null;
  /** WhatsApp (Phase 7B.2): the channel was switched to real customers by an OWNER. */
  liveSending?: boolean}):
  {mode: SendMode | null; note: string | null; live?: boolean} {
  const {provider} = input;
  if (input.simulated) {
    return devToolsEnabled() && provider !== null && canSend(provider) && input.sendingEnabled ? {mode: "SIMULATOR", note: null} : {mode: null, note: null};
  }
  if (provider === "GMAIL" || provider === "MICROSOFT_365") {
    if (input.connectionStatus !== "VERIFIED") return {mode: null, note: "This mailbox needs to be reconnected (Inbox settings) before replies can be sent. The message can be approved but not sent."};
    if (input.ownerUid && input.ownerUid !== input.actorUid) return {mode: null, note: "This conversation came through another member's personal mailbox: only they can send from it. The reply can be approved; its owner sends it."};
    if (!input.sendingEnabled) return {mode: null, note: input.ownerUid ? "Sending is off for this personal mailbox. Its owner can turn it on in Inbox settings." : "Sending is off for this mailbox. An owner or administrator can turn it on in Inbox settings."};
    if (!emailSendingConfigured()) return {mode: null, note: "Email sending is off on this server (test mode sends only to test addresses set in INBOX_EMAIL_TEST_RECIPIENTS)."};
    if (!emailRecipientAllowed(input.identity)) return {mode: null, note: `Email test mode: this server sends email only to its test addresses, and ${input.identity} is not one of them. To test with it, add it to INBOX_EMAIL_TEST_RECIPIENTS on the server and restart.`};
    return {mode: "EMAIL", note: null};
  }
  if (provider !== "WHATSAPP_CLOUD") return {mode: null, note: null};
  return whatsappDelivery({connectionStatus: input.connectionStatus, sendingEnabled: input.sendingEnabled, liveSending: Boolean(input.liveSending), serverAllowsLive: realCustomersAllowed(),
    testConfigured: liveSendingConfigured(), testRecipient: recipientAllowed(input.identity)});
}

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try { return JSON.parse(value) as T; } catch { return fallback; }
}

/** The stored check result, bounded to the column (messages dropped first if needed). */
function storedValidation(result: ValidationResult) {
  const full = JSON.stringify(result);
  if (full.length <= 2000) return full;
  return JSON.stringify({...result, problems: result.problems.map(({code, blocksApproval}) => ({code, message: code, blocksApproval}))}).slice(0, 2000);
}

/** Lists the conversation's replies and its latest assistant analysis, with what this member may do with each. */
export async function listReplies(context: Context, rawConversationId: string) {
  const conversation = await getConversation(context, rawConversationId);
  const data = await asMember(context, "ListInboxReplies", (dc, options) => sdk.listInboxReplies(dc, {organizationId: context.organizationId, conversationId: conversation.id}, options));
  if (!data.conversation) throw new WorkspaceError("NOT_FOUND", 404, "This conversation was not found.");
  const role = (data.me?.role ?? context.membership.role) as Role;
  const me = uid(context);
  const provider = (conversation.channelConnection?.provider ?? null) as ChannelProvider | null;
  const delivery = deliveryOf({provider, connectionStatus: conversation.channelConnection?.connectionStatus, sendingEnabled: Boolean(conversation.channelConnection?.sendingEnabled),
    simulated: conversation.simulated, identity: conversation.customerIdentity, ownerUid: conversation.channelConnection?.ownerMembership?.userProfileUid ?? null, actorUid: me,
    liveSending: Boolean(conversation.channelConnection?.liveSending)});
  const simulatorSend = delivery.mode === "SIMULATOR";
  const window = conversation.serviceWindow;
  const approver = role === "OWNER" || role === "ADMIN" || role === "MANAGER";
  const insightRow = data.conversation.insights[0] ?? null;
  return {
    role, approvalRequired: data.settings?.approvalRequired ?? true, aiEnabled: data.settings?.aiEnabled ?? false, simulatorSend, sendMode: delivery.mode,
    // WhatsApp outside the 24-hour window (or a business-started conversation): only an approved template can be sent.
    templateOnly: conversation.channel === "WHATSAPP" && !conversation.simulated && Boolean(window && !window.open),
    sendingNote: simulatorSend ? "Developer simulator: approved replies are delivered to this simulated conversation only."
      : delivery.mode === "WHATSAPP" ? (delivery.live ? "WhatsApp (real customers): approved replies are sent by Meta to this customer." : "WhatsApp (test mode): approved replies are sent by Meta to this test number.")
      : delivery.mode === "EMAIL" ? `Email (test mode): approved replies are sent from ${conversation.channelConnection?.externalAccountReference ?? "the mailbox"} in this thread, to this test address.`
      : conversation.channel === "WEBSITE" ? "Website enquiries have no reply channel yet; reply by WhatsApp or email once one is connected."
      : delivery.note ?? "Sending is disabled until this provider is connected and approved (Phase 7B/7C). Replies can be drafted, checked and approved.",
    insight: insightRow ? {id: canonicalUuid(insightRow.id), createdAt: insightRow.createdAt, createdBy: insightRow.createdBy?.displayName ?? null, model: insightRow.model, source: insightRow.source,
      coveredUntil: insightRow.coveredUntil ?? null, draftJobId: id(insightRow.draftJobId), unverifiedCount: insightRow.unverifiedCount, insight: parseJson<CheckedInsight | null>(insightRow.insightJson, null)} : null,
    replies: data.conversation.jobs.map(job => {
      const stage = job.stage as OutboundStage;
      const own = job.createdByUid === me || job.lastEditedByUid === me;
      const approval = outboundApproval({approverUid: me, approverRole: role, createdByUid: job.createdByUid, lastEditedByUid: job.lastEditedByUid ?? null});
      return {
        id: canonicalUuid(job.id), stage, stageLabel: STAGE_LABELS[stage], source: job.source as OutboundSource, content: job.content, edited: job.edited, revision: job.revision,
        template: parseTemplate(job.templateName), templateValues: parseJson<Record<string, string>>(job.templateParamsJson, {}),
        versions: parseJson<Array<{content: string; at: string; by: string | null}>>(job.versionsJson, []), validation: parseJson<ValidationResult | null>(job.validationJson, null),
        createdBy: job.createdBy?.displayName ?? null, lastEditedBy: job.lastEditedBy?.displayName ?? null, approvedBy: job.approvedBy?.displayName ?? null, approvedAt: job.approvedAt ?? null,
        approvalRequestedAt: job.approvalRequestedAt ?? null, approvalNote: job.approvalNote ?? null, selfApproved: job.selfApproved, failureReason: job.failureReason ?? null,
        messageId: id(job.messageId), createdAt: job.createdAt, updatedAt: job.updatedAt,
        can: {
          edit: EDITABLE_STAGES.includes(stage) && !job.templateName, check: stage === "DRAFT", submit: stage === "VALIDATED",
          decide: stage === "PENDING_APPROVAL" && approval.allowed, ownReply: stage === "PENDING_APPROVAL" && approver && !approval.allowed,
          cancel: CANCELLABLE_STAGES.includes(stage) && (approver || own),
          remove: !["QUEUED", "SENT"].includes(stage) && (approver || own), send: stage === "APPROVED" && delivery.mode !== null,
        },
      };
    }),
  };
}
export type RepliesView = Awaited<ReturnType<typeof listReplies>>;

const contentSchema = z.string().trim().min(1, "Write the reply first.").max(MAX_OUTBOUND_CHARS);

const templateSchema = z.strictObject({name: z.string().trim().regex(/^[a-z0-9_]{1,100}$/, "Template names use lowercase letters, digits and underscores."),
  language: z.string().trim().regex(/^[a-z]{2,3}(_[A-Z]{2})?$/, "Use a language code such as en_US or ar."),
  /** Phase 7B.2: the filled blanks, keyed "BODY:1", "HEADER:1" or "BODY:first_name". */
  values: z.record(z.string().max(40), z.string().max(1000)).default({})});

/**
 * Phase 7B.2: an approved template of the conversation's channel (read from Meta), its blanks checked, and the
 * exact text the customer will receive. Throws with the reason a member can act on.
 */
async function preparedTemplate(organizationId: string, connectionId: string, input: {name: string; language: string; values: Record<string, unknown>}, fresh = false) {
  const template = await approvedTemplate(organizationId, connectionId, input.name, input.language, fresh);
  const values = templateValues(template, input.values);
  const problems = Object.values(templateValueProblems(template, values));
  if (problems.length) throw new WorkspaceError("VALIDATION_ERROR", 400, `Fill in the template: ${problems[0]}`);
  const rendered = renderTemplate(template, values).text;
  if (rendered.length > MAX_OUTBOUND_CHARS) throw new WorkspaceError("VALIDATION_ERROR", 400, "The filled template is too long.");
  return {template, values, rendered};
}
const createSchema = z.strictObject({content: contentSchema.optional(), template: templateSchema.optional(), fromInsightId: idSchema.optional()})
  .refine(value => Boolean(value.content) !== Boolean(value.template), "Write a reply or choose a template.");

/** A reply draft: the member's text, or (WhatsApp) an approved template, which goes through the same checks and approval. */
export async function createReply(context: Context, rawConversationId: string, body: unknown) {
  const conversation = await getConversation(context, rawConversationId);
  const input = parseInput(createSchema, body);
  if (input.template && conversation.channel !== "WHATSAPP") throw new WorkspaceError("VALIDATION_ERROR", 400, "Templates are only for WhatsApp conversations.");
  if (input.template && (!conversation.channelConnectionId || conversation.simulated)) throw new WorkspaceError("VALIDATION_ERROR", 400, "Templates are only for real WhatsApp conversations.");
  const templateName = input.template ? `${input.template.name}:${input.template.language}` : null;
  if (templateName && !TEMPLATE_NAME.test(templateName)) throw new WorkspaceError("VALIDATION_ERROR", 400, "Give a valid template name and language.");
  // A template draft holds the text the customer will receive, and its blanks.
  const prepared = input.template ? await preparedTemplate(context.organizationId, conversation.channelConnectionId!, input.template) : null;
  const content = prepared ? prepared.rendered : input.content!;
  const templateParamsJson = prepared && Object.keys(prepared.values).length ? JSON.stringify(prepared.values).slice(0, 4000) : null;
  const replyId = randomUUID();
  // Claude's suggested reply, taken into the message box (and perhaps edited there): kept as a Claude draft, so an
  // unedited one is still checked like any Claude draft (numbers not in the sources block approval).
  if (input.fromInsightId && !input.template) {
    const insight = (await asServer("InboxInsightDraft", dc => sdk.inboxInsightDraft(dc, {organizationId: context.organizationId, conversationId: conversation.id, id: input.fromInsightId!}))).insight;
    const suggested = parseJson<{reply?: string} | null>(insight?.insightJson, null)?.reply?.trim() ?? "";
    if (insight && !insight.draftJobId && suggested) {
      await asServer("CreateClaudeReplyFromInsight", dc => sdk.createClaudeReplyFromInsight(dc, {organizationId: context.organizationId, insightId: input.fromInsightId!, conversationId: conversation.id, jobId: replyId,
        actorUid: uid(context), content, edited: content.trim() !== suggested}));
      return {id: replyId};
    }
  }
  await asMember(context, "CreateInboxReplyDraft", (dc, options) => sdk.createInboxReplyDraft(dc, {organizationId: context.organizationId, id: replyId, conversationId: conversation.id, content, templateName, templateParamsJson}, options));
  return {id: replyId};
}

/** The reply and its conversation, after checking the member may see that conversation. */
async function replyFacts(context: Context, rawConversationId: string, rawId: string) {
  const conversation = await getConversation(context, rawConversationId);
  const replyId = parseInput(idSchema, rawId);
  const facts = await asServer("InboxReplyFacts", dc => sdk.inboxReplyFacts(dc, {organizationId: context.organizationId, id: replyId}));
  const job = facts.job;
  if (!job || canonicalUuid(job.conversationId) !== conversation.id) throw new WorkspaceError("NOT_FOUND", 404, "This reply was not found.");
  return {conversation, job, facts, replyId};
}

/** Runs the reply rules on the server, from the stored reply and conversation (never from the browser). */
async function validationOf(context: Context, input: Awaited<ReturnType<typeof replyFacts>>) {
  const {job, facts} = input;
  const target = job.conversation;
  const restrictions = await asServer("InboxContactRestrictions", dc => sdk.inboxContactRestrictions(dc, {organizationId: context.organizationId, identity: target.customerIdentity}));
  const provider = (target.channelConnection?.provider ?? null) as ChannelProvider | null;
  const insight = parseJson<CheckedInsight | null>(facts.insight[0]?.insightJson, null);
  const delivery = deliveryOf({provider, connectionStatus: target.channelConnection?.connectionStatus, sendingEnabled: Boolean(target.channelConnection?.sendingEnabled), simulated: target.simulated, identity: target.customerIdentity,
    ownerUid: target.channelConnection?.ownerMembership?.userProfileUid ?? null, actorUid: uid(context), liveSending: Boolean(target.channelConnection?.liveSending)});
  return validateOutbound({
    channel: target.channel as InboxChannel, provider, connectionStatus: target.channelConnection?.connectionStatus ?? null,
    deliverable: delivery.mode !== null, deliveryNote: delivery.note, templateName: job.templateName ?? null,
    optedOut: target.optedOut, suppressed: restrictions.numbers.some(row => row.scope === "ALL") || restrictions.emails.length > 0, lastInboundAt: target.lastInboundAt ?? null,
    content: job.content, source: job.source as OutboundSource, edited: job.edited, unsupportedNumbers: insight?.unsupportedNumbers ?? [], now: Date.now(),
  });
}

const revisionSchema = z.strictObject({expectedRevision: z.number().int().min(1)});

export async function updateReply(context: Context, rawConversationId: string, rawId: string, body: unknown) {
  const input = parseInput(z.strictObject({expectedRevision: z.number().int().min(1), content: contentSchema}), body);
  const {job, replyId} = await replyFacts(context, rawConversationId, rawId);
  if (job.content === input.content) return {id: replyId, unchanged: true};
  const versionsJson = nextVersions(job.versionsJson, {content: job.content, at: new Date().toISOString(), by: job.lastEditedByUid ?? job.createdByUid});
  await asMember(context, "UpdateInboxReplyDraft", (dc, options) => sdk.updateInboxReplyDraft(dc, {organizationId: context.organizationId, id: replyId, expectedRevision: input.expectedRevision, content: input.content, versionsJson}, options));
  return {id: replyId, unchanged: false};
}

/** Checks a draft: VALIDATED when it passes the content and customer rules, otherwise it stays a draft with the problems. */
export async function checkReply(context: Context, rawConversationId: string, rawId: string, body: unknown) {
  const {expectedRevision} = parseInput(revisionSchema, body);
  const facts = await replyFacts(context, rawConversationId, rawId);
  const result = await validationOf(context, facts);
  await asMember(context, "RecordInboxReplyCheck", (dc, options) => sdk.recordInboxReplyCheck(dc, {organizationId: context.organizationId, id: facts.replyId, expectedRevision, valid: result.valid, validationJson: storedValidation(result)}, options));
  return {id: facts.replyId, valid: result.valid, sendable: result.sendable, problems: result.problems};
}

/** Sends a checked reply for approval (or approves it, when the company does not require approval). Checked again first. */
export async function submitReply(context: Context, rawConversationId: string, rawId: string, body: unknown) {
  const {expectedRevision} = parseInput(revisionSchema, body);
  const facts = await replyFacts(context, rawConversationId, rawId);
  const result = await validationOf(context, facts);
  if (!result.valid) throw new WorkspaceError("INBOX_REPLY_INVALID", 409, result.problems.find(problem => problem.blocksApproval)?.message ?? "Check the reply again.");
  const approvalRequired = facts.facts.settings?.approvalRequired ?? true;
  await asMember(context, "SubmitInboxReply", (dc, options) => sdk.submitInboxReply(dc, {organizationId: context.organizationId, id: facts.replyId, expectedRevision, approvalRequired, notificationId: randomUUID()}, options));
  return {id: facts.replyId, stage: approvalRequired ? "PENDING_APPROVAL" as const : "APPROVED" as const};
}

const decideSchema = z.strictObject({expectedRevision: z.number().int().min(1), decision: z.enum(["APPROVE", "REJECT"]), note: z.string().trim().max(300).optional()});

export async function decideReply(context: Context, rawConversationId: string, rawId: string, body: unknown) {
  const input = parseInput(decideSchema, body);
  if (input.decision === "REJECT" && (input.note ?? "").length < 3) throw new WorkspaceError("VALIDATION_ERROR", 400, "Give a short reason for rejecting, so the author knows what to change.");
  const facts = await replyFacts(context, rawConversationId, rawId);
  // The UI explains the rule; the database enforces it in the same transaction as the decision.
  const rule = outboundApproval({approverUid: uid(context), approverRole: context.membership.role as Role, createdByUid: facts.job.createdByUid, lastEditedByUid: facts.job.lastEditedByUid ?? null});
  if (input.decision === "APPROVE" && !rule.allowed) {
    throw rule.reason === "ROLE" ? new WorkspaceError("PERMISSION_DENIED", 403, "Only owners, administrators and managers can approve replies.")
      : new WorkspaceError("INBOX_SELF_APPROVAL", 403, "You wrote or last edited this reply, so another owner, administrator or manager must approve it.");
  }
  if (input.decision === "APPROVE") {
    const result = await validationOf(context, facts);
    if (!result.valid) throw new WorkspaceError("INBOX_REPLY_INVALID", 409, result.problems.find(problem => problem.blocksApproval)?.message ?? "The reply no longer passes the checks.");
  }
  await asMember(context, "DecideInboxReply", (dc, options) => sdk.decideInboxReply(dc, {organizationId: context.organizationId, id: facts.replyId, expectedRevision: input.expectedRevision,
    approve: input.decision === "APPROVE", note: input.note || null}, options));
  return {id: facts.replyId, stage: input.decision === "APPROVE" ? "APPROVED" as const : "DRAFT" as const, selfApproved: input.decision === "APPROVE" && rule.allowed && rule.selfApproved};
}

/** Deletes a reply that was never sent: its author, or an OWNER, ADMIN or MANAGER (the database checks again). Sent replies stay. */
export async function deleteReply(context: Context, rawConversationId: string, rawId: string, body: unknown) {
  const {expectedRevision} = parseInput(revisionSchema, body);
  const {replyId, job} = await replyFacts(context, rawConversationId, rawId);
  if (job.stage === "QUEUED" || job.stage === "SENT") throw new WorkspaceError("INBOX_REPLY_CHANGED", 409, "A reply that was sent (or is being sent) cannot be deleted.");
  await asMember(context, "DeleteInboxReply", (dc, options) => sdk.deleteInboxReply(dc, {organizationId: context.organizationId, id: replyId, expectedRevision}, options));
  return {id: replyId, deleted: true};
}

export async function cancelReply(context: Context, rawConversationId: string, rawId: string, body: unknown) {
  const {expectedRevision} = parseInput(revisionSchema, body);
  const {replyId} = await replyFacts(context, rawConversationId, rawId);
  await asMember(context, "CancelInboxReply", (dc, options) => sdk.cancelInboxReply(dc, {organizationId: context.organizationId, id: replyId, expectedRevision}, options));
  return {id: replyId, stage: "CANCELLED" as const};
}

/**
 * Sends an approved reply. The developer simulator delivers to simulated conversations
 * (developer tools only); the WhatsApp Cloud API (Phase 7B.1) to the server's test
 * recipients on a VERIFIED connection with sending on. Both are refused by the database
 * otherwise. Queued first; SENT only on the provider's acknowledgement (with its message
 * ID, which receipts match); FAILED, with a workflow event, when it refuses.
 */
export async function sendReply(context: Context, rawConversationId: string, rawId: string, body: unknown) {
  const {expectedRevision} = parseInput(revisionSchema, body);
  const facts = await replyFacts(context, rawConversationId, rawId);
  const {job} = facts;
  const target = job.conversation;
  const connection = target.channelConnection;
  const provider = (connection?.provider ?? null) as ChannelProvider | null;
  if (job.stage !== "APPROVED") throw new WorkspaceError("INBOX_REPLY_CHANGED", 409, "Only approved replies can be sent. Reload the conversation.");
  const delivery = deliveryOf({provider, connectionStatus: connection?.connectionStatus, sendingEnabled: Boolean(connection?.sendingEnabled), simulated: target.simulated, identity: target.customerIdentity,
    ownerUid: connection?.ownerMembership?.userProfileUid ?? null, actorUid: uid(context), liveSending: Boolean(connection?.liveSending)});
  if (!delivery.mode || !target.channelConnectionId || !connection) {
    throw new WorkspaceError("INBOX_SENDING_DISABLED", 409, delivery.note ?? "Sending is disabled for this conversation. Only simulated conversations (developer tools) and verified WhatsApp test recipients can be sent to.");
  }
  const result = await validationOf(context, facts);
  if (!result.sendable) throw new WorkspaceError("INBOX_REPLY_INVALID", 409, result.problems[0]?.message ?? "The reply cannot be sent.");
  const template = parseTemplate(job.templateName);
  const token = delivery.mode === "WHATSAPP" ? await channelAccessToken(context.organizationId, connection) : null;
  if (delivery.mode === "WHATSAPP" && (!token || !connection.externalAccountReference)) {
    throw new WorkspaceError("INBOX_SENDING_DISABLED", 409, "The server has no access token for this WhatsApp channel. An administrator must set it and check the connection again.");
  }
  // Phase 7B.2: a template is read fresh from Meta before anything is queued. Paused, rejected, or changed since it
  // was drafted (it would no longer read as the approved text) means nothing is sent.
  let components: ReturnType<typeof templateComponents> | undefined;
  if (delivery.mode === "WHATSAPP" && template) {
    const values = parseJson<Record<string, string>>(job.templateParamsJson, {});
    const prepared = await preparedTemplate(context.organizationId, canonicalUuid(target.channelConnectionId), {...template, values}, true);
    if (prepared.rendered !== job.content) throw new WorkspaceError("INBOX_TEMPLATE_CHANGED", 409, "This template changed in Meta after the reply was drafted, so it was not sent. Draft it again from the template list.");
    components = templateComponents(prepared.template, prepared.values);
  }
  // Phase 7B.2: safety limits per WhatsApp channel, counted in the database: a slip or a runaway can flood neither the
  // customers nor the bill (Meta charges for template messages).
  if (delivery.mode === "WHATSAPP") {
    const channel = canonicalUuid(target.channelConnectionId);
    await enforceRateLimit([{rule: {scope: "inbox.whatsapp.send", limit: 60, windowSeconds: 60}, subject: channel}], "This WhatsApp channel is sending too fast. Wait a minute and try again.");
    if (template) await enforceRateLimit([{rule: {scope: "inbox.whatsapp.templates.daily", limit: dailyTemplateLimit(), windowSeconds: 86_400}, subject: channel}],
      "This WhatsApp channel has sent its daily allowance of template messages (a cost guard). Try again tomorrow, or ask the server administrator to raise INBOX_WHATSAPP_DAILY_TEMPLATE_LIMIT.");
  }
  const messageId = randomUUID();
  const simulated = target.simulated;
  // Email: the grant and the threaded reply are ready before anything is queued, so a mailbox that cannot send queues nothing.
  let email: {provider: "GMAIL"; token: string; raw: string; threadId: string | null} | {provider: "MICROSOFT_365"; token: string; replyToId: string} | null = null;
  if (delivery.mode === "EMAIL") {
    const connectionId = canonicalUuid(target.channelConnectionId);
    const label = providerLabel(provider);
    const mailbox = (await asServer("MailboxForAction", dc => sdk.mailboxForAction(dc, {organizationId: context.organizationId, id: connectionId, actorUid: uid(context)}))).mailbox;
    const access = mailbox ? await mailboxAccessToken(context.organizationId, connectionId, mailbox.provider, mailbox.account) : null;
    if (!mailbox?.externalAccountReference || !access?.ok) throw new WorkspaceError("INBOX_SENDING_DISABLED", 409, `${label} no longer accepts this mailbox's sign-in. Reconnect it in Inbox settings, then send again.`);
    const thread = await asServer("EmailReplyThread", dc => sdk.emailReplyThread(dc, {organizationId: context.organizationId, conversationId: facts.conversation.id}));
    if (provider === "MICROSOFT_365") {
      // Outlook replies to a message in its own thread: the newest email from the customer.
      const replyToId = thread.messages.find(row => row.direction === "INBOUND" && row.externalMessageId && !row.externalMessageId.startsWith("pending:"))?.externalMessageId;
      if (!replyToId) throw new WorkspaceError("INBOX_SENDING_DISABLED", 409, "There is no email from the customer in this conversation to reply to.");
      email = {provider: "MICROSOFT_365", token: access.token, replyToId};
    } else {
      const ids = thread.messages.map(row => row.internetMessageId).filter((value): value is string => Boolean(value));
      email = {
        provider: "GMAIL", token: access.token,
        threadId: target.externalThreadId?.startsWith("gmail:") ? target.externalThreadId.slice(6) : null,
        raw: buildReplyMessage({from: mailbox.externalAccountReference, to: target.customerIdentity, subject: replySubject(target.subject), text: job.content, estateosMessageId: messageId,
          inReplyTo: thread.messages.find(row => row.direction === "INBOUND")?.internetMessageId ?? null, references: [...ids].reverse()}),
      };
    }
  }
  const variables = {organizationId: context.organizationId, id: facts.replyId, conversationId: facts.conversation.id, messageId, actorUid: uid(context)};
  await asServer("QueueInboxReply", dc => sdk.queueInboxReply(dc, {...variables, expectedRevision, channelConnectionId: canonicalUuid(target.channelConnectionId!), content: job.content,
    pendingExternalId: `pending:${facts.replyId}`, recipientIdentity: target.customerIdentity, preview: preview(job.content), simulated, template: Boolean(template)}));

  let ack: {accepted: true; providerMessageId: string} | {accepted: false; reason: string};
  if (delivery.mode === "WHATSAPP") {
    const sent = await sendWhatsAppMessage(token!, connection.externalAccountReference!, target.customerIdentity,
      template ? {kind: "TEMPLATE", name: template.name, language: template.language, components} : {kind: "TEXT", text: job.content});
    console.info(JSON.stringify({event: "inbox.whatsapp.send", replyId: facts.replyId, ok: sent.ok, code: sent.ok ? null : sent.code, template: Boolean(template)}));
    ack = sent.ok ? {accepted: true, providerMessageId: sent.providerMessageId}
      : {accepted: false, reason: sent.code === "TIMEOUT" || sent.code === "NETWORK" ? `${sent.message} It may or may not have been delivered; check WhatsApp before sending again.` : `Meta refused it (${sent.code}): ${sent.message}`};
  } else if (delivery.mode === "EMAIL" && email) {
    const sent = email.provider === "GMAIL" ? await gmailSend(email.token, email.raw, email.threadId)
      : await outlookReply(email.token, {replyToId: email.replyToId, to: target.customerIdentity, text: job.content, reference: messageId});
    console.info(JSON.stringify({event: "inbox.email.send", provider: email.provider, replyId: facts.replyId, ok: sent.ok, code: sent.ok ? null : sent.code}));
    ack = sent.ok ? {accepted: true, providerMessageId: sent.providerMessageId}
      : {accepted: false, reason: sent.code === "TIMEOUT" || sent.code === "NETWORK" ? `${sent.message} It may or may not have been sent; check the mailbox's Sent folder before sending again.` : `${providerLabel(email.provider)} refused it (${sent.code}): ${sent.message}`};
  } else {
    const adapter = ADAPTERS[provider!];
    try {
      ack = adapter.send ? await adapter.send({conversationId: facts.conversation.id, simulated, recipient: target.customerIdentity, content: job.content}) : {accepted: false, reason: "This channel cannot send."};
    } catch (error) {
      ack = {accepted: false, reason: error instanceof Error ? error.message.slice(0, 200) : "The provider did not respond."};
    }
  }
  if (!ack.accepted) {
    await asServer("FailInboxReply", dc => sdk.failInboxReply(dc, {...variables, reason: ack.accepted ? "" : ack.reason.slice(0, 300), simulated}));
    return {id: facts.replyId, stage: "FAILED" as const, messageId, reason: ack.accepted ? null : ack.reason};
  }
  await asServer("AcknowledgeInboxReply", dc => sdk.acknowledgeInboxReply(dc, {...variables, providerMessageId: ack.accepted ? ack.providerMessageId : ""}));
  return {id: facts.replyId, stage: "SENT" as const, messageId};
}

export type SendNowOutcome =
  | {id: string; outcome: "SENT"; messageId: string}
  | {id: string; outcome: "PENDING_APPROVAL"}
  | {id: string; outcome: "NEEDS_CHANGES"; problems: {code: string; message: string; blocksApproval: boolean}[]}
  | {id: string; outcome: "FAILED" | "NOT_SENT"; reason: string};

/**
 * The message box's Send, like a chat app: the reply is drafted, checked and, when the company does not require approval,
 * approved and sent in one step. When approval is required it goes for approval instead. Every step is the same server
 * step (and rule) as the reply's own buttons; nothing is skipped. A reply that is not sent stays in the replies list with
 * the reason, to fix, send again or delete.
 */
export async function sendNow(context: Context, rawConversationId: string, body: unknown): Promise<SendNowOutcome> {
  const {id} = await createReply(context, rawConversationId, body);
  const revision = async () => (await replyFacts(context, rawConversationId, id)).job.revision;
  const checked = await checkReply(context, rawConversationId, id, {expectedRevision: await revision()});
  if (!checked.valid) return {id, outcome: "NEEDS_CHANGES", problems: checked.problems.map(problem => ({code: problem.code, message: problem.message, blocksApproval: problem.blocksApproval}))};
  const submitted = await submitReply(context, rawConversationId, id, {expectedRevision: await revision()});
  if (submitted.stage !== "APPROVED") return {id, outcome: "PENDING_APPROVAL"};
  try {
    const sent = await sendReply(context, rawConversationId, id, {expectedRevision: await revision()});
    return sent.stage === "SENT" ? {id, outcome: "SENT", messageId: sent.messageId} : {id, outcome: "FAILED", reason: sent.reason ?? "The provider refused it."};
  } catch (error) {
    // Approved but not sent (sending off, a template changed in Meta, a limit reached): it waits in the replies list.
    if (error instanceof WorkspaceError) return {id, outcome: "NOT_SENT", reason: error.message};
    throw error;
  }
}

const startSchema = z.strictObject({connectionId: idSchema, phone: z.string().trim().min(6).max(32), template: templateSchema});

/**
 * Starts a WhatsApp conversation from EstateOS (Phase 7B.1, OWNER or ADMIN): a new thread
 * with a test recipient and an approved-template reply DRAFT, which then goes through the
 * normal checks and approval. A reply from the customer joins the same conversation.
 */
export async function startWhatsAppConversation(context: Context, body: unknown) {
  if (context.membership.role !== "OWNER" && context.membership.role !== "ADMIN") throw new WorkspaceError("PERMISSION_DENIED", 403, "Only owners and administrators can start WhatsApp conversations in this phase.");
  const input = parseInput(startSchema, body);
  const identity = channelIdentity("WHATSAPP", {phone: input.phone});
  if (!identity) throw new WorkspaceError("VALIDATION_ERROR", 400, "Enter the number in international format, for example +971 50 123 4567.");
  // Phase 7B.2: any number on a channel the OWNER switched to real customers (where the server allows it); otherwise only the test numbers.
  const channel = (await asServer("ChannelConnectionForCheck", dc => sdk.channelConnectionForCheck(dc, {organizationId: context.organizationId, id: input.connectionId, actorUid: uid(context)}))).connection;
  if (!channel || channel.provider !== "WHATSAPP_CLOUD") throw new WorkspaceError("NOT_FOUND", 404, "This WhatsApp channel was not found.");
  const delivery = whatsappDelivery({connectionStatus: channel.connectionStatus, sendingEnabled: channel.sendingEnabled, liveSending: channel.liveSending, serverAllowsLive: realCustomersAllowed(),
    testConfigured: liveSendingConfigured(), testRecipient: recipientAllowed(identity.value)});
  if (!delivery.mode) throw new WorkspaceError("INBOX_SENDING_DISABLED", 409, delivery.note ?? "This channel cannot start conversations.");
  const conversationId = stableUuid("whatsapp-started", context.organizationId, input.connectionId, identity.value);
  const existing = await asServer("FindInboxConversation", dc => sdk.findInboxConversation(dc, {organizationId: context.organizationId, hasConnection: true, channelConnectionId: input.connectionId, externalThreadId: `wa:${identity.value}`}));
  const found = existing.connected?.[0];
  const id = found ? canonicalUuid(found.id) : conversationId;
  if (!found) {
    const match = await asServer("MatchInboxIdentity", dc => sdk.matchInboxIdentity(dc, {organizationId: context.organizationId, hasPhone: true, phone: identity.value, hasEmail: false, email: null}));
    const contacts = match.byPhone ?? [];
    const contact = contacts.length === 1 ? contacts[0] : null;
    const lead = contact && contact.leads.length === 1 ? contact.leads[0] : null;
    await asServer("StartWhatsAppConversation", dc => sdk.startWhatsAppConversation(dc, {organizationId: context.organizationId, id, channelConnectionId: input.connectionId, actorUid: uid(context),
      customerIdentity: identity.value, externalThreadId: `wa:${identity.value}`, contactId: contact ? canonicalUuid(contact.id) : null, leadId: lead ? canonicalUuid(lead.id) : null}));
  }
  const reply = await createReply(context, id, {template: input.template});
  return {conversationId: id, replyId: reply.id, existing: Boolean(found)};
}
