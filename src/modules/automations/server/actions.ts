import "server-only";

import { requireAiConfig } from "@/modules/ai/server/anthropic";
import { generateWorkflowDraft } from "@/modules/ai/content/server/generate";
import { analyzeLead } from "@/modules/ai/sales/server/service";
import { summarizeCallForWorkflow } from "@/modules/communications/server/intelligence";
import { planNewLeadAssignment } from "@/modules/leads/distribution/service";
import { canonicalUuid } from "@/modules/organizations/server/identifiers";
import { fillPlaceholders } from "../conditions";
import type { Action } from "../definition";
import { stableUuid } from "../ids";
import { AutomationDbError, raw, sdk, type Context } from "./data";
import type { AutomationEventRow, RunState } from "./facts";

/*
 * One handler per allowlisted action (docs/AUTOMATION_ENGINE.md#actions).
 * Handlers reuse existing services and transactional operations, run as the
 * workflow's executor, and give every row they create a deterministic ID, so
 * a repeated step finds its earlier result instead of duplicating it. No
 * handler sends anything outside EstateOS.
 */

export interface StepRun {
  context: Context;
  organizationId: string;
  now: Date;
  execution: {id: string; workflowId: string; chainDepth: number};
  event: AutomationEventRow;
  workflowName: string;
  position: number;
  state: RunState;
}

export interface StepOutcome {
  status: "SUCCEEDED" | "SKIPPED";
  summary: string;
  resultType?: string;
  resultId?: string;
  aiCalls?: number;
}

/** A failure that a retry cannot fix (missing record, permission, invalid target): the execution fails at once. */
export class PermanentStepError extends Error {
  constructor(readonly code: string, readonly detail = "") { super(code); this.name = "PermanentStepError"; }
}

const PERMANENT = new Set(["EXECUTOR_NOT_AUTHORIZED", "LEAD_NOT_FOUND", "AUTOMATION_TARGET_INVALID", "AUTOMATION_RECIPIENT_INVALID", "ASSIGNMENT_PERMISSION_REQUIRED", "DISTRIBUTION_AGENT_UNAVAILABLE"]);

/** Converts database failures: a duplicate key means the step already ran; known checks are permanent. */
async function once<T>(operation: () => Promise<T>): Promise<T | "DUPLICATE"> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof AutomationDbError) {
      if (error.duplicate) return "DUPLICATE";
      if (error.token && PERMANENT.has(error.token)) throw new PermanentStepError(error.token);
    }
    throw error;
  }
}

function placeholders(run: StepRun) {
  return {"lead.fullName": run.state.lead?.fullName ?? null, "lead.status": run.state.lead?.status?.toLowerCase().replaceAll("_", " ") ?? null,
    "listing.title": run.state.listing?.title ?? null, "workflow.name": run.workflowName, "task.title": run.state.task?.title ?? null};
}
const fill = (run: StepRun, text: string) => fillPlaceholders(text, placeholders(run));
const lineage = (run: StepRun) => ({
  originalEventId: run.event.originalEventId ? canonicalUuid(run.event.originalEventId) : canonicalUuid(run.event.id),
  parentExecutionId: run.execution.id, originWorkflowId: run.execution.workflowId, chainDepth: run.execution.chainDepth + 1,
});
const dueAt = (run: StepRun, minutes: number) => new Date(run.now.getTime() + minutes * 60_000).toISOString();
/** The agent responsible for the target: the lead's, the listing's or the task's. */
const assigneeOf = (state: RunState) => state.lead?.assignedMembershipId ?? state.listing?.assignedMembershipId ?? state.task?.assignedMembershipId
  ?? state.call?.agentMembershipId ?? state.meeting?.organizerMembershipId ?? null;

async function createTask(run: StepRun, title: string, minutes: number, assignee: "ASSIGNEE" | "UNASSIGNED"): Promise<StepOutcome> {
  const {context, organizationId} = run;
  const leadId = run.state.lead?.id ?? null;
  if (leadId) {
    const id = stableUuid("automation-follow-up", run.execution.id, run.position);
    const result = await once(() => raw(() => sdk.automationCreateLeadFollowUp(context.request.dc, {organizationId, id, leadId, title: fill(run, title), dueAt: dueAt(run, minutes),
      eventId: stableUuid("automation-event", run.execution.id, run.position), ...lineage(run)}, context.request.options)));
    return {status: "SUCCEEDED", resultType: "LEAD_FOLLOW_UP", resultId: id, summary: result === "DUPLICATE" ? "Follow-up already created." : `Follow-up created, due in ${minutes} min.`};
  }
  const id = stableUuid("automation-work-task", run.execution.id, run.position);
  const assignedMembershipId = assignee === "ASSIGNEE" ? assigneeOf(run.state) : null;
  const result = await once(() => raw(() => sdk.automationCreateWorkTask(context.request.dc, {organizationId, id, title: fill(run, title), dueAt: dueAt(run, minutes), assignedMembershipId,
    listingId: run.state.listing?.id ?? null, leadId: null, eventId: stableUuid("automation-event", run.execution.id, run.position), ...lineage(run)}, context.request.options)));
  return {status: "SUCCEEDED", resultType: "WORK_TASK", resultId: id, summary: result === "DUPLICATE" ? "Task already created." : assignedMembershipId ? "Task created for the assigned agent." : "Task created in the team queue."};
}

async function notify(run: StepRun, action: Extract<Action, {type: "notification.create"}>): Promise<StepOutcome> {
  const {context, organizationId} = run;
  const title = fill(run, action.title).slice(0, 160) || run.workflowName;
  const body = fill(run, action.message).slice(0, 500);
  const leadId = run.state.lead?.id ?? null;
  const send = (recipient: string | null) => {
    const id = stableUuid("automation-notification", run.execution.id, run.position, recipient ?? "ADMIN");
    return once(() => raw(() => sdk.automationNotify(context.request.dc, {organizationId, id, audience: recipient ? sdk.NotificationAudience.MEMBER : sdk.NotificationAudience.ADMIN,
      recipientMembershipId: recipient, leadId, title, body}, context.request.options)));
  };
  if (action.audience === "ADMINISTRATORS") {
    await send(null);
    return {status: "SUCCEEDED", resultType: "NOTIFICATION", summary: "Owners and administrators notified."};
  }
  if (action.audience === "ASSIGNEE") {
    const assignee = assigneeOf(run.state);
    if (!assignee) return {status: "SKIPPED", summary: "No assigned agent to notify."};
    await send(assignee);
    return {status: "SUCCEEDED", resultType: "NOTIFICATION", resultId: stableUuid("automation-notification", run.execution.id, run.position, assignee), summary: "Assigned agent notified."};
  }
  const {managers} = await raw(() => sdk.automationRecipients(context.request.dc, {organizationId}, context.request.options));
  const recipients = [...new Set(managers.map(member => canonicalUuid(member.id)))];
  for (const recipient of recipients) await send(recipient);
  return {status: "SUCCEEDED", resultType: "NOTIFICATION", summary: `${recipients.length} manager${recipients.length === 1 ? "" : "s"} notified.`};
}

/** The company's approved distribution rule, through the same planner lead creation uses. */
async function distribute(run: StepRun): Promise<StepOutcome> {
  const lead = run.state.lead;
  if (!lead) throw new PermanentStepError("AUTOMATION_TARGET_INVALID", "No lead.");
  if (lead.assignedMembershipId) return {status: "SKIPPED", summary: "The lead is already assigned."};
  const plan = await planNewLeadAssignment(run.context, {branchId: lead.branchId, projectId: lead.projectId}, null);
  if (!plan.hasAutoAssignment || !plan.assignedMembershipId || !plan.distributionRuleId || plan.expectedCursorVersion === null) {
    return {status: "SKIPPED", summary: plan.hasDistributionAttempt ? "No eligible agent is available under the distribution rule." : "No active distribution rule applies to this lead."};
  }
  try {
    await raw(() => sdk.automationDistributeLead(run.context.request.dc, {organizationId: run.organizationId, leadId: lead.id, assignedMembershipId: plan.assignedMembershipId!,
      distributionRuleId: plan.distributionRuleId!, expectedCursorVersion: plan.expectedCursorVersion!, executionId: run.execution.id,
      eventId: stableUuid("automation-event", run.execution.id, run.position), originalEventId: lineage(run).originalEventId, originWorkflowId: run.execution.workflowId, chainDepth: run.execution.chainDepth + 1}, run.context.request.options));
  } catch (error) {
    // Assigned meanwhile (by a person, or by this step before a restart): nothing more to do.
    if (error instanceof AutomationDbError && error.token === "LEAD_ALREADY_ASSIGNED") return {status: "SKIPPED", summary: "The lead was assigned meanwhile."};
    if (error instanceof AutomationDbError && error.token && ["DISTRIBUTION_AGENT_UNAVAILABLE", "EXECUTOR_NOT_AUTHORIZED"].includes(error.token)) throw new PermanentStepError(error.token);
    throw error;
  }
  return {status: "SUCCEEDED", resultType: "LEAD_ASSIGNMENT", resultId: canonicalUuid(plan.assignedMembershipId), summary: "Lead assigned by the distribution rule."};
}

async function addNote(run: StepRun, note: string): Promise<StepOutcome> {
  const lead = run.state.lead;
  if (!lead) throw new PermanentStepError("AUTOMATION_TARGET_INVALID", "No lead.");
  const id = stableUuid("automation-note", run.execution.id, run.position);
  const result = await once(() => raw(() => sdk.automationAddLeadNote(run.context.request.dc, {organizationId: run.organizationId, id, leadId: lead.id, note: fill(run, note), executionId: run.execution.id}, run.context.request.options)));
  return {status: "SUCCEEDED", resultType: "LEAD_ACTIVITY", resultId: id, summary: result === "DUPLICATE" ? "Note already added." : "Note added to the lead."};
}

/** Content Studio purposes for a lead draft, by what started the workflow. */
const DRAFT_PURPOSES: Record<string, {WHATSAPP_MESSAGE: string; EMAIL: string}> = {
  "lead.created": {WHATSAPP_MESSAGE: "NEW_LEAD_INTRODUCTION", EMAIL: "ENQUIRY_RESPONSE"},
  "website_form.submitted": {WHATSAPP_MESSAGE: "NEW_LEAD_INTRODUCTION", EMAIL: "ENQUIRY_RESPONSE"},
  "viewing.scheduled": {WHATSAPP_MESSAGE: "VIEWING_CONFIRMATION", EMAIL: "VIEWING_CONFIRMATION"},
  "viewing.completed": {WHATSAPP_MESSAGE: "POST_VIEWING_FOLLOW_UP", EMAIL: "FOLLOW_UP"},
};
const FOLLOW_UP_PURPOSE = {WHATSAPP_MESSAGE: "ENQUIRY_FOLLOW_UP", EMAIL: "FOLLOW_UP"};

/** An editable Content Studio draft for the lead, written by Claude as the executor. Never sent. */
async function aiDraft(run: StepRun, action: Extract<Action, {type: "ai.draft"}>): Promise<StepOutcome> {
  const lead = run.state.lead;
  if (!lead) throw new PermanentStepError("AUTOMATION_TARGET_INVALID", "No lead.");
  const purpose = (DRAFT_PURPOSES[run.event.triggerType] ?? FOLLOW_UP_PURPOSE)[action.contentType];
  const {saved, error} = await generateWorkflowDraft(run.context, {contentType: action.contentType, purpose, leadId: lead.id, instructions: fill(run, action.instructions)});
  if (!saved) throw error;
  return {status: "SUCCEEDED", resultType: "AI_CONTENT_DRAFT", resultId: saved.draftId, aiCalls: 1,
    summary: `Draft saved in Content Studio for the agent to review${saved.warnings ? ` (${saved.warnings} checks to review)` : ""}. Nothing was sent.`};
}

/** The existing AI sales analysis of the lead, stored as an internal insight. */
async function salesReview(run: StepRun): Promise<StepOutcome> {
  const lead = run.state.lead;
  if (!lead) throw new PermanentStepError("AUTOMATION_TARGET_INVALID", "No lead.");
  await analyzeLead(run.context, requireAiConfig(), lead.id);
  return {status: "SUCCEEDED", resultType: "AI_LEAD_ANALYSIS", resultId: lead.id, aiCalls: 1, summary: "AI sales analysis saved as an internal insight on the lead."};
}

/**
 * A Claude summary of the call (6F.4) as the executor, from its transcript or
 * else the agent's notes. Skipped (not failed) when the company has Claude call
 * analysis off or there is nothing to summarise; a repeated step reuses the summary.
 */
async function summarizeCallStep(run: StepRun): Promise<StepOutcome> {
  const call = run.state.call;
  if (!call) throw new PermanentStepError("AUTOMATION_TARGET_INVALID", "No call.");
  const result = await summarizeCallForWorkflow(run.context, call.id, {
    summaryId: stableUuid("automation-call-summary", run.execution.id, run.position), ...lineage(run),
  });
  if (result.status === "SKIPPED") return {status: "SKIPPED", summary: result.reason};
  return {status: "SUCCEEDED", resultType: "CALL_AI_SUMMARY", resultId: result.id, aiCalls: result.claude ? 1 : 0,
    summary: result.claude ? "Claude summary saved as a draft for the agent to review." : "Summary already saved."};
}

/** Runs one side-effect action. Waiting and approvals are handled by the engine. */
export async function runAction(run: StepRun, action: Action): Promise<StepOutcome> {
  switch (action.type) {
    case "task.create": return createTask(run, action.title, action.dueMinutes, action.assignee);
    case "viewing.followup": return createTask(run, action.title, action.dueMinutes, "ASSIGNEE");
    case "notification.create": return notify(run, action);
    case "lead.distribute": return distribute(run);
    case "lead.activity": return addNote(run, action.note);
    case "ai.draft": return aiDraft(run, action);
    case "ai.sales_review": return salesReview(run);
    case "call.summarize": return summarizeCallStep(run);
    default: throw new PermanentStepError("ACTION_NOT_AVAILABLE", action.type);
  }
}
