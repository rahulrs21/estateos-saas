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
  CANCELLABLE_STAGES, EDITABLE_STAGES, MAX_OUTBOUND_CHARS, STAGE_LABELS, nextVersions, outboundApproval, validateOutbound,
  type OutboundSource, type OutboundStage, type ValidationResult,
} from "../outbound";
import { preview } from "../policy";
import { getConversation } from "./conversations";

/*
 * Inbox replies (docs/UNIFIED_INBOX.md#outbound). Members draft, check and
 * submit replies on conversations they may see; OWNERs, ADMINs and MANAGERs
 * approve them (never their own, unless an OWNER). Sending is offered only in
 * developer tools, for simulated conversations on the developer simulator, and
 * the database refuses anything else; a reply is SENT only when the adapter
 * acknowledges it. Real WhatsApp and email sending is Phase 7B/7C.
 */

const id = (value: string | null | undefined) => value ? canonicalUuid(value) : null;
const uid = (context: Context) => context.request.user.uid;

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
  const simulatorSend = devToolsEnabled() && conversation.simulated && provider !== null && canSend(provider) && Boolean(conversation.channelConnection?.sendingEnabled);
  const approver = role === "OWNER" || role === "ADMIN" || role === "MANAGER";
  const insightRow = data.conversation.insights[0] ?? null;
  return {
    role, approvalRequired: data.settings?.approvalRequired ?? true, aiEnabled: data.settings?.aiEnabled ?? false, simulatorSend,
    sendingNote: simulatorSend ? "Developer simulator: approved replies are delivered to this simulated conversation only."
      : conversation.channel === "WEBSITE" ? "Website enquiries have no reply channel yet; reply by WhatsApp or email once one is connected."
      : "Sending is disabled until this provider is connected and approved (Phase 7B/7C). Replies can be drafted, checked and approved.",
    insight: insightRow ? {id: canonicalUuid(insightRow.id), createdAt: insightRow.createdAt, createdBy: insightRow.createdBy?.displayName ?? null, model: insightRow.model, source: insightRow.source,
      coveredUntil: insightRow.coveredUntil ?? null, draftJobId: id(insightRow.draftJobId), unverifiedCount: insightRow.unverifiedCount, insight: parseJson<CheckedInsight | null>(insightRow.insightJson, null)} : null,
    replies: data.conversation.jobs.map(job => {
      const stage = job.stage as OutboundStage;
      const own = job.createdByUid === me || job.lastEditedByUid === me;
      const approval = outboundApproval({approverUid: me, approverRole: role, createdByUid: job.createdByUid, lastEditedByUid: job.lastEditedByUid ?? null});
      return {
        id: canonicalUuid(job.id), stage, stageLabel: STAGE_LABELS[stage], source: job.source as OutboundSource, content: job.content, edited: job.edited, revision: job.revision,
        versions: parseJson<Array<{content: string; at: string; by: string | null}>>(job.versionsJson, []), validation: parseJson<ValidationResult | null>(job.validationJson, null),
        createdBy: job.createdBy?.displayName ?? null, lastEditedBy: job.lastEditedBy?.displayName ?? null, approvedBy: job.approvedBy?.displayName ?? null, approvedAt: job.approvedAt ?? null,
        approvalRequestedAt: job.approvalRequestedAt ?? null, approvalNote: job.approvalNote ?? null, selfApproved: job.selfApproved, failureReason: job.failureReason ?? null,
        messageId: id(job.messageId), createdAt: job.createdAt, updatedAt: job.updatedAt,
        can: {
          edit: EDITABLE_STAGES.includes(stage), check: stage === "DRAFT", submit: stage === "VALIDATED",
          decide: stage === "PENDING_APPROVAL" && approval.allowed, ownReply: stage === "PENDING_APPROVAL" && approver && !approval.allowed,
          cancel: CANCELLABLE_STAGES.includes(stage) && (approver || own), send: stage === "APPROVED" && simulatorSend,
        },
      };
    }),
  };
}
export type RepliesView = Awaited<ReturnType<typeof listReplies>>;

const contentSchema = z.string().trim().min(1, "Write the reply first.").max(MAX_OUTBOUND_CHARS);

export async function createReply(context: Context, rawConversationId: string, body: unknown) {
  const conversation = await getConversation(context, rawConversationId);
  const {content} = parseInput(z.strictObject({content: contentSchema}), body);
  const replyId = randomUUID();
  await asMember(context, "CreateInboxReplyDraft", (dc, options) => sdk.createInboxReplyDraft(dc, {organizationId: context.organizationId, id: replyId, conversationId: conversation.id, content}, options));
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
  return validateOutbound({
    channel: target.channel as InboxChannel, provider, connectionStatus: target.channelConnection?.connectionStatus ?? null,
    deliverable: devToolsEnabled() && target.simulated && provider !== null && canSend(provider) && Boolean(target.channelConnection?.sendingEnabled),
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

export async function cancelReply(context: Context, rawConversationId: string, rawId: string, body: unknown) {
  const {expectedRevision} = parseInput(revisionSchema, body);
  const {replyId} = await replyFacts(context, rawConversationId, rawId);
  await asMember(context, "CancelInboxReply", (dc, options) => sdk.cancelInboxReply(dc, {organizationId: context.organizationId, id: replyId, expectedRevision}, options));
  return {id: replyId, stage: "CANCELLED" as const};
}

/**
 * Sends an approved reply through the conversation's adapter. Phase 7A: developer
 * tools only, simulated conversations on the developer simulator only (the database
 * refuses any other conversation). Queued first; SENT only on the adapter's
 * acknowledgement; FAILED (with a workflow event) when it refuses.
 */
export async function sendReply(context: Context, rawConversationId: string, rawId: string, body: unknown) {
  if (!devToolsEnabled()) throw new WorkspaceError("INBOX_SENDING_DISABLED", 409, "Sending is disabled until a provider is connected and approved (Phase 7B/7C).");
  const {expectedRevision} = parseInput(revisionSchema, body);
  const facts = await replyFacts(context, rawConversationId, rawId);
  const {job} = facts;
  const target = job.conversation;
  const provider = (target.channelConnection?.provider ?? null) as ChannelProvider | null;
  if (job.stage !== "APPROVED") throw new WorkspaceError("INBOX_REPLY_CHANGED", 409, "Only approved replies can be sent. Reload the conversation.");
  if (!provider || !canSend(provider) || !target.simulated || !target.channelConnectionId) {
    throw new WorkspaceError("INBOX_SENDING_DISABLED", 409, "Sending is disabled for this conversation. In this phase only simulated conversations on the developer simulator can be sent.");
  }
  const result = await validationOf(context, facts);
  if (!result.sendable) throw new WorkspaceError("INBOX_REPLY_INVALID", 409, result.problems[0]?.message ?? "The reply cannot be sent.");
  const messageId = randomUUID();
  const variables = {organizationId: context.organizationId, id: facts.replyId, conversationId: facts.conversation.id, messageId, actorUid: uid(context)};
  await asServer("QueueInboxReply", dc => sdk.queueInboxReply(dc, {...variables, expectedRevision, channelConnectionId: canonicalUuid(target.channelConnectionId!), content: job.content,
    pendingExternalId: `pending:${facts.replyId}`, recipientIdentity: target.customerIdentity, preview: preview(job.content)}));
  const adapter = ADAPTERS[provider];
  let ack: Awaited<ReturnType<NonNullable<typeof adapter.send>>>;
  try {
    ack = adapter.send ? await adapter.send({conversationId: facts.conversation.id, simulated: target.simulated, recipient: target.customerIdentity, content: job.content})
      : {accepted: false, reason: "This channel cannot send."};
  } catch (error) {
    ack = {accepted: false, reason: error instanceof Error ? error.message.slice(0, 200) : "The provider did not respond."};
  }
  if (!ack.accepted) {
    await asServer("FailInboxReply", dc => sdk.failInboxReply(dc, {...variables, reason: ack.accepted ? "" : ack.reason.slice(0, 300)}));
    return {id: facts.replyId, stage: "FAILED" as const, messageId};
  }
  await asServer("AcknowledgeInboxReply", dc => sdk.acknowledgeInboxReply(dc, {...variables, providerMessageId: ack.accepted ? ack.providerMessageId : ""}));
  return {id: facts.replyId, stage: "SENT" as const, messageId};
}
