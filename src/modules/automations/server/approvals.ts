import "server-only";

import { z } from "zod";
import { WorkspaceError } from "@/modules/organizations/server/errors";
import { canonicalUuid } from "@/modules/organizations/server/identifiers";
import { validateInput } from "@/modules/organizations/server/validation";
import { canonicalJson } from "../definition";
import { sha256 } from "../ids";
import { adminDataConnect, member, raw, sdk, type Context } from "./data";
import { idSchema } from "./workflows";

/*
 * Approvals for MEDIUM-risk and approval steps (docs/WORKFLOW_APPROVALS.md).
 * The decision is one compare-and-set in the database, which re-checks the
 * approver's role, separation of duties, expiry, the snapshot the approver saw
 * and the record's current state. The worker then applies exactly the approved
 * change, checking the record again, or ends the execution.
 */

/** The parts of a lead that an approved reassignment depends on. Unrelated edits (notes, budget) do not invalidate an approval. */
export function leadStateHash(lead: {assignedMembershipId: string | null | undefined; status: string; archived: boolean} | null) {
  if (!lead) return sha256("NO_TARGET");
  return sha256(canonicalJson({assignedMembershipId: lead.assignedMembershipId ? canonicalUuid(lead.assignedMembershipId) : null, status: lead.status, archived: lead.archived}));
}
/** The parts of a conversation an approved reassignment depends on (7A.5). */
export function conversationStateHash(conversation: {assignedMembershipId?: string | null; status: string} | null) {
  if (!conversation) return sha256("NO_TARGET");
  return sha256(canonicalJson({assignedMembershipId: conversation.assignedMembershipId ? canonicalUuid(conversation.assignedMembershipId) : null, status: conversation.status}));
}
/** approval.request steps approve continuing, not a change to a record. */
export const NO_TARGET_HASH = sha256("NO_TARGET");

const listSchema = z.strictObject({view: z.enum(["pending", "history"]).default("pending"), offset: z.coerce.number().int().min(0).max(10_000).default(0)});

export async function listApprovals(context: Context, input: unknown) {
  const query = validateInput(listSchema, input);
  const statuses = query.view === "pending" ? [sdk.AutomationApprovalStatus.PENDING]
    : [sdk.AutomationApprovalStatus.APPROVED, sdk.AutomationApprovalStatus.REJECTED, sdk.AutomationApprovalStatus.EXPIRED, sdk.AutomationApprovalStatus.CANCELLED, sdk.AutomationApprovalStatus.EXECUTED];
  const data = await member(() => sdk.listAutomationApprovals(context.request.dc, {organizationId: context.organizationId, statuses, limit: 50, offset: query.offset}, context.request.options));
  const uid = context.request.user.uid;
  const role = data.member?.role ?? context.membership.role;
  return {
    role, view: query.view,
    approvals: data.approvals.map(row => ({
      ...row,
      // What this member may do; the database checks the same rules when they decide.
      canDecide: row.status === "PENDING" && Date.parse(row.expiresAt) > Date.now() && (!["lead.reassign", "inbox.reassign"].includes(row.actionType) || ["OWNER", "ADMIN"].includes(role))
        && (row.requestedByUid !== uid || role === "OWNER"),
      selfApproval: row.requestedByUid === uid,
    })),
  };
}

const decisionSchema = z.strictObject({decision: z.enum(["APPROVED", "REJECTED"]), reason: z.string().trim().max(500).default(""), snapshotHash: z.string().regex(/^[0-9a-f]{64}$/)});

export async function decideApproval(context: Context, rawId: string, body: Record<string, unknown>) {
  const id = validateInput(idSchema, rawId);
  const input = validateInput(decisionSchema, body);
  if (input.decision === "REJECTED" && input.reason.length < 3) throw new WorkspaceError("VALIDATION_ERROR", 400, "Give a short reason for rejecting.");
  // The record's current state, read on the server (never from the browser) and compared in the decision's transaction.
  const {approval} = await raw(() => sdk.getAutomationApprovalTarget(adminDataConnect(), {organizationId: context.organizationId, id}));
  if (!approval) throw new WorkspaceError("NOT_FOUND", 404, "This approval was not found in your company.");
  const current = approval.actionType === "lead.reassign"
    ? leadStateHash(approval.lead ? {assignedMembershipId: approval.lead.assignedMembershipId, status: approval.lead.status, archived: !!approval.lead.archivedAt} : null)
    : approval.actionType === "inbox.reassign"
      ? conversationStateHash(approval.targetId ? (await raw(() => sdk.automationConversationState(adminDataConnect(), {organizationId: context.organizationId, id: canonicalUuid(approval.targetId!)}))).conversation ?? null : null)
      : NO_TARGET_HASH;
  if (approval.status === "PENDING" && current !== approval.targetStateHash) {
    // The lead changed since the request: this approval no longer describes the change. Close it; the worker
    // requests a fresh one for the lead's current state if the workflow still applies.
    await raw(() => sdk.closeAutomationApproval(adminDataConnect(), {organizationId: context.organizationId, id, expectedStatus: sdk.AutomationApprovalStatus.PENDING,
      status: sdk.AutomationApprovalStatus.EXPIRED, resultStatus: "EXPIRED", resultErrorCode: "TARGET_CHANGED", actorUid: approval.requestedByUid})).catch(() => undefined);
    throw new WorkspaceError("AUTOMATION_APPROVAL_CHANGED", 409, "The record changed after this approval was requested, so it was closed. A fresh approval will be requested if the workflow still applies.");
  }
  await member(() => sdk.decideAutomationApproval(context.request.dc, {organizationId: context.organizationId, id, decision: sdk.AutomationApprovalStatus[input.decision],
    reason: input.reason || null, expectedSnapshotHash: input.snapshotHash, currentTargetStateHash: current}, context.request.options));
  return {id, decision: input.decision};
}
