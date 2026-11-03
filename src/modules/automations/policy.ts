import { ACTIONS, needsApproval, type Action, type WorkflowDefinition } from "./definition";

/*
 * Server-side automation policy (docs/WORKFLOW_SECURITY.md). Risk comes from
 * the action registry in code, never from Claude or the browser. HIGH-risk
 * actions (customer messages, publishing, financial or destructive changes)
 * are not in the registry at all, so no definition can contain them.
 *
 * The database repeats these role checks in every operation; this module lets
 * the UI and API explain them and keeps the rules in one place.
 */

export type Role = "OWNER" | "ADMIN" | "MANAGER" | "AGENT";
export type WorkflowStatus = "DRAFT" | "IN_REVIEW" | "APPROVED" | "ACTIVE" | "PAUSED" | "ARCHIVED";

export const riskOf = (action: Action) => ACTIONS[action.type].risk;
export const definitionHasApprovalSteps = (definition: WorkflowDefinition) => definition.steps.some(needsApproval);

/** Who may do what with workflows. AGENTs draft and view their own; OWNERs and ADMINs approve and run. */
export const WORKFLOW_PERMISSIONS = {
  /** See the automation area, templates and their own workflows. */
  view: ["OWNER", "ADMIN", "MANAGER", "AGENT"],
  /** See every workflow of the company and its executions. */
  viewAll: ["OWNER", "ADMIN", "MANAGER"],
  /** Create drafts and edit their own (OWNER and ADMIN edit any). */
  create: ["OWNER", "ADMIN", "MANAGER", "AGENT"],
  /** Ask Claude for a workflow draft (uses the AI allowance). */
  generate: ["OWNER", "ADMIN", "MANAGER", "AGENT"],
  /** Submit their own drafts for review. */
  submit: ["OWNER", "ADMIN", "MANAGER", "AGENT"],
  /** Approve or return a workflow in review. */
  approve: ["OWNER", "ADMIN"],
  /** Activate, pause, resume and archive. The activating member becomes the executor. */
  activate: ["OWNER", "ADMIN"],
  /** Run an active manual workflow. */
  runManual: ["OWNER", "ADMIN", "MANAGER"],
} as const satisfies Record<string, readonly Role[]>;
export type WorkflowPermission = keyof typeof WORKFLOW_PERMISSIONS;
export const can = (role: Role, permission: WorkflowPermission) => (WORKFLOW_PERMISSIONS[permission] as readonly Role[]).includes(role);

/** Roles that may decide a pending approval for an action (and must be able to perform it themselves). */
export function approverRoles(action: Pick<Action, "type">): readonly Role[] {
  // Reassigning needs company-wide lead access, which only OWNERs and ADMINs have.
  if (action.type === "lead.reassign") return ["OWNER", "ADMIN"];
  return ["OWNER", "ADMIN", "MANAGER"];
}

/**
 * Separation of duties for sensitive actions: the member a workflow runs as
 * (its executor, who "requested" the action) cannot approve that action,
 * unless they are an OWNER (then the approval is marked as a self-approval
 * in the audit log), so a company with a single owner can still operate.
 */
export function approvalConflict(input: {approverUid: string; approverRole: Role; requestedByUid: string}): "SELF_APPROVAL_ALLOWED" | "SELF_APPROVAL_FORBIDDEN" | null {
  if (input.approverUid !== input.requestedByUid) return null;
  return input.approverRole === "OWNER" ? "SELF_APPROVAL_ALLOWED" : "SELF_APPROVAL_FORBIDDEN";
}

/** Allowed status changes (the database enforces the same table with compare-and-set). */
export const STATUS_TRANSITIONS: Record<WorkflowStatus, readonly WorkflowStatus[]> = {
  DRAFT: ["IN_REVIEW", "ARCHIVED"],
  IN_REVIEW: ["DRAFT", "APPROVED", "ARCHIVED"],
  APPROVED: ["ACTIVE", "DRAFT", "ARCHIVED"],
  ACTIVE: ["PAUSED", "ARCHIVED"],
  PAUSED: ["ACTIVE", "ARCHIVED"],
  ARCHIVED: [],
};
export const canTransition = (from: WorkflowStatus, to: WorkflowStatus) => STATUS_TRANSITIONS[from].includes(to);

/** The permission a status change needs. */
export function transitionPermission(to: WorkflowStatus): WorkflowPermission {
  if (to === "IN_REVIEW" || to === "DRAFT") return "submit";
  if (to === "APPROVED") return "approve";
  return "activate";
}
