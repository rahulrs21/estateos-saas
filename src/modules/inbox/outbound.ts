import type { InboxChannel, Role } from "./model";
import { serviceWindow } from "./policy";

/*
 * Outbound messages (docs/UNIFIED_INBOX.md#outbound). A reply moves through
 * DRAFT → VALIDATED → PENDING_APPROVAL → APPROVED → QUEUED → SENT or FAILED,
 * each step a compare-and-set in the database. Queueing is possible only
 * through a connection whose adapter can send (in Phase 7A, the developer
 * simulator, for simulated conversations only); SENT, DELIVERED and READ come
 * only from the adapter's acknowledgement and receipts, never from queueing.
 */

export const OUTBOUND_STAGES = ["DRAFT", "VALIDATED", "PENDING_APPROVAL", "APPROVED", "QUEUED", "SENT", "FAILED", "CANCELLED"] as const;
export type OutboundStage = (typeof OUTBOUND_STAGES)[number];
export const STAGE_LABELS: Record<OutboundStage, string> = {
  DRAFT: "Draft", VALIDATED: "Checked", PENDING_APPROVAL: "Waiting for approval", APPROVED: "Approved", QUEUED: "Queued", SENT: "Sent", FAILED: "Failed", CANCELLED: "Cancelled",
};
export type OutboundSource = "AGENT" | "CLAUDE" | "WORKFLOW";

/** Moves a member may make (the database enforces the same table). Queueing, acknowledgement and failure are the server's. */
export const STAGE_TRANSITIONS: Record<OutboundStage, readonly OutboundStage[]> = {
  DRAFT: ["VALIDATED", "CANCELLED"],
  VALIDATED: ["PENDING_APPROVAL", "APPROVED", "DRAFT", "CANCELLED"],
  // Rejected goes back to DRAFT with the approver's note.
  PENDING_APPROVAL: ["APPROVED", "DRAFT", "CANCELLED"],
  APPROVED: ["QUEUED", "CANCELLED"],
  QUEUED: ["SENT", "FAILED"],
  SENT: [], FAILED: [], CANCELLED: [],
};
export const canMove = (from: OutboundStage, to: OutboundStage) => STAGE_TRANSITIONS[from].includes(to);
/** Content can change until the message is approved; editing returns it to DRAFT. */
export const EDITABLE_STAGES: readonly OutboundStage[] = ["DRAFT", "VALIDATED", "PENDING_APPROVAL"];
export const CANCELLABLE_STAGES: readonly OutboundStage[] = ["DRAFT", "VALIDATED", "PENDING_APPROVAL", "APPROVED"];
export const MAX_OUTBOUND_CHARS = 4000;
export const MAX_VERSIONS = 10;

export const APPROVER_ROLES: readonly Role[] = ["OWNER", "ADMIN", "MANAGER"];
/**
 * Separation of duties (as for workflow approvals, docs/WORKFLOW_APPROVALS.md):
 * the author and the last editor may not approve their own message, except an
 * OWNER, whose approval is then recorded as a self-approval.
 */
export function outboundApproval(input: {approverUid: string; approverRole: Role; createdByUid: string; lastEditedByUid: string | null}):
  {allowed: true; selfApproved: boolean} | {allowed: false; reason: "ROLE" | "SELF_APPROVAL"} {
  if (!APPROVER_ROLES.includes(input.approverRole)) return {allowed: false, reason: "ROLE"};
  const own = input.approverUid === input.createdByUid || input.approverUid === (input.lastEditedByUid ?? input.createdByUid);
  if (!own) return {allowed: true, selfApproved: false};
  return input.approverRole === "OWNER" ? {allowed: true, selfApproved: true} : {allowed: false, reason: "SELF_APPROVAL"};
}

/** Earlier versions kept on an edit (newest last, bounded). */
export function nextVersions(versionsJson: string | null | undefined, previous: {content: string; at: string; by: string | null}) {
  let list: unknown = [];
  try { list = JSON.parse(versionsJson || "[]"); } catch { list = []; }
  const versions = (Array.isArray(list) ? list : []).filter((item): item is {content: string; at: string; by: string | null} => typeof item?.content === "string");
  return JSON.stringify([...versions, {...previous, content: previous.content.slice(0, 1500)}].slice(-MAX_VERSIONS));
}

export interface ValidationFacts {
  channel: InboxChannel;
  /** The connection's provider, null for internal channels (website enquiries). */
  provider: string | null;
  connectionStatus: string | null;
  /** The adapter can deliver for this conversation (Phase 7A: the developer simulator, simulated conversations only). */
  deliverable: boolean;
  optedOut: boolean;
  /** An active do-not-contact entry (WhatsApp: the Phase 6F list; email: the inbox email opt-outs). */
  suppressed: boolean;
  lastInboundAt: string | null;
  content: string;
  source: OutboundSource;
  edited: boolean;
  /** Numbers in an unedited Claude draft that its sources do not contain. */
  unsupportedNumbers: readonly string[];
  now: number;
}

export type ProblemCode = "EMPTY" | "TOO_LONG" | "PLACEHOLDER" | "LINK_SCHEME" | "OPTED_OUT" | "SUPPRESSED" | "WINDOW_CLOSED" | "UNSUPPORTED_NUMBERS" | "NO_CHANNEL" | "SENDING_DISABLED";
export interface Problem {code: ProblemCode; message: string; /** Blocks approval (the content or customer rules); delivery problems only block sending. */ blocksApproval: boolean}
export interface ValidationResult {valid: boolean; sendable: boolean; problems: Problem[]; checkedAt: string; window: {open: boolean; closesAt: string | null} | null}

const PLACEHOLDER = /\{\{[^}]{0,60}\}\}|\[(?:agent|your|customer|client|name|insert|price|date|time|property|link)[^\]]{0,40}\]/i;

/**
 * Checks a reply before approval and again before sending. Content and customer
 * rules (empty, length, leftover placeholders, opt-out, do-not-contact, the
 * WhatsApp 24-hour window, unchecked numbers in an unedited Claude draft) make
 * it invalid; a channel that cannot deliver only makes it unsendable.
 */
export function validateOutbound(facts: ValidationFacts): ValidationResult {
  const problems: Problem[] = [];
  const add = (code: ProblemCode, message: string, blocksApproval = true) => problems.push({code, message, blocksApproval});
  const text = facts.content.trim();
  if (!text) add("EMPTY", "Write the message first.");
  if (facts.content.length > MAX_OUTBOUND_CHARS) add("TOO_LONG", `Keep the message under ${MAX_OUTBOUND_CHARS} characters.`);
  if (PLACEHOLDER.test(text)) add("PLACEHOLDER", "Replace the placeholder text (in brackets or braces) with the real details.");
  if (/(javascript|data|vbscript):/i.test(text)) add("LINK_SCHEME", "Remove the script or data link.");
  if (facts.optedOut) add("OPTED_OUT", "The customer asked not to be contacted on this channel.");
  if (facts.suppressed) add("SUPPRESSED", "The customer is on the do-not-contact list.");
  const window = facts.channel === "WHATSAPP" ? serviceWindow(facts.lastInboundAt, facts.now) : null;
  if (window && !window.open) add("WINDOW_CLOSED", "WhatsApp allows a free-form reply only within 24 hours of the customer's last message. An approved template is needed (Phase 7B).");
  if (facts.source !== "AGENT" && !facts.edited && facts.unsupportedNumbers.length) {
    add("UNSUPPORTED_NUMBERS", `Claude's draft mentions ${facts.unsupportedNumbers.slice(0, 3).join(", ")}, which is not in the conversation or the matched listings. Check and edit the draft before it is approved.`);
  }
  if (facts.channel === "WEBSITE" || facts.channel === "INTERNAL") add("NO_CHANNEL", "Website enquiries have no reply channel yet. Reply by WhatsApp or email once one is connected.", false);
  else if (!facts.deliverable) add("SENDING_DISABLED", facts.provider ? "Sending is disabled until this provider is connected and approved (Phase 7B/7C). The message can be approved but not sent."
    : "This conversation has no connected channel to send from. The message can be approved but not sent.", false);
  const valid = problems.every(problem => !problem.blocksApproval);
  return {valid, sendable: valid && problems.length === 0, problems, checkedAt: new Date(facts.now).toISOString(), window};
}
