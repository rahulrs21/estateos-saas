import "server-only";

import { randomUUID } from "node:crypto";
import { z } from "zod";
import { WorkspaceError } from "@/modules/organizations/server/errors";
import { canonicalUuid } from "@/modules/organizations/server/identifiers";
import { validateInput } from "@/modules/organizations/server/validation";
import { WorkflowDefinitionError, canonicalJson, parseWorkflowDefinition, referencedMemberships, type WorkflowDefinition } from "../definition";
import { sha256 } from "../ids";
import { can, definitionHasApprovalSteps, type Role } from "../policy";
import { nextScheduledTime } from "../scheduling";
import { member, sdk, type Context } from "./data";

/*
 * Member-facing workflow service (docs/WORKFLOW_BUILDER.md). Every definition
 * is validated here before it is stored; the database repeats the company and
 * role checks of every operation. Nothing here runs a workflow: activation only
 * marks it active, and the worker does the rest.
 */

/** Invalid definitions, with readable issues for the editor. */
export class WorkflowValidationError extends Error {
  readonly code = "WORKFLOW_INVALID";
  constructor(readonly issues: string[]) { super("The workflow needs changes before it can be saved."); }
}

/** IDs arrive in either UUID form (the database returns them without hyphens); they are canonicalised first. */
export const idSchema = z.string().max(40).transform(canonicalUuid).pipe(z.uuid());
const roleOf = (context: Context) => context.membership.role as Role;
const uidOf = (context: Context) => context.request.user.uid;
/** AGENTs see only their own workflows; the database enforces the same filter. */
const ownFilter = (context: Context) => can(roleOf(context), "viewAll") ? {} : {createdByUid: uidOf(context)};

export function parseDefinitionInput(input: unknown): WorkflowDefinition {
  try { return parseWorkflowDefinition(input); } catch (error) {
    if (error instanceof WorkflowDefinitionError) throw new WorkflowValidationError(error.issues);
    throw error;
  }
}

/** Members named in the definition must be active agents of this company (checked with the caller's own access). */
async function assertReferences(context: Context, definition: WorkflowDefinition) {
  const ids = referencedMemberships(definition).map(canonicalUuid);
  if (!ids.length) return;
  const {memberships} = await member(() => sdk.listLeadAssignees(context.request.dc, {organizationId: context.organizationId, limit: 100, offset: 0}, context.request.options));
  const agents = new Set(memberships.filter(row => row.role === "AGENT").map(row => canonicalUuid(row.id)));
  if (ids.some(id => !agents.has(id))) throw new WorkflowValidationError(["A reassignment step names someone who is not an active agent of this company."]);
}

function stored(definition: WorkflowDefinition) {
  const json = JSON.stringify(definition);
  return {name: definition.name, description: definition.description, triggerType: definition.trigger, definitionJson: json, definitionHash: sha256(canonicalJson(definition)),
    hasApprovalSteps: definitionHasApprovalSteps(definition), timeZone: definition.timeZone};
}

export async function listWorkflows(context: Context, input: unknown) {
  const query = validateInput(z.strictObject({status: z.enum(["DRAFT", "IN_REVIEW", "APPROVED", "ACTIVE", "PAUSED", "ARCHIVED"]).optional()}), input);
  const viewAll = can(roleOf(context), "viewAll");
  const [data, assignees] = await Promise.all([
    member(() => sdk.listAutomationWorkflows(context.request.dc, {organizationId: context.organizationId, ...ownFilter(context),
      status: query.status ? sdk.AutomationWorkflowStatus[query.status] : undefined, limit: 200, offset: 0}, context.request.options)),
    // Agents for the execution filters and reassignment steps: the same list lead assignment uses.
    viewAll ? member(() => sdk.listLeadAssignees(context.request.dc, {organizationId: context.organizationId, limit: 100, offset: 0}, context.request.options)) : null,
  ]);
  const agents = (assignees?.memberships ?? []).filter(row => row.role === "AGENT").map(row => ({id: canonicalUuid(row.id), name: row.userProfile?.displayName || row.email}));
  return {workflows: data.workflows, role: roleOf(context), canViewAll: viewAll, agents, membershipId: canonicalUuid(context.membership.id), uid: uidOf(context)};
}

export async function getWorkflow(context: Context, rawId: string) {
  const id = validateInput(idSchema, rawId);
  const data = await member(() => sdk.getAutomationWorkflow(context.request.dc, {organizationId: context.organizationId, id, ...ownFilter(context)}, context.request.options));
  if (!data.workflow) throw new WorkspaceError("NOT_FOUND", 404, "This workflow was not found in your company.");
  const {workflow} = data;
  const role = roleOf(context);
  const own = workflow.createdByUid === uidOf(context);
  const admin = role === "OWNER" || role === "ADMIN";
  return {
    workflow: {...workflow, definition: JSON.parse(workflow.definitionJson) as WorkflowDefinition},
    versions: data.versions,
    permissions: {
      edit: workflow.status !== "ARCHIVED" && (admin || (own && ["DRAFT", "IN_REVIEW"].includes(workflow.status))),
      submit: workflow.status === "DRAFT" && (admin || own),
      returnToDraft: (workflow.status === "IN_REVIEW" && (admin || own)) || (workflow.status === "APPROVED" && admin),
      approve: workflow.status === "IN_REVIEW" && can(role, "approve"),
      activate: ["APPROVED", "PAUSED"].includes(workflow.status) && can(role, "activate") && workflow.approvedVersionNumber === workflow.currentVersionNumber,
      pause: workflow.status === "ACTIVE" && can(role, "activate"),
      archive: workflow.status !== "ARCHIVED" && (admin || (own && workflow.status === "DRAFT")),
      run: workflow.status === "ACTIVE" && workflow.triggerType === "workflow.manual" && can(role, "runManual"),
      viewExecutions: can(role, "viewAll"),
    },
    selfApproval: own,
  };
}

export async function createWorkflow(context: Context, body: Record<string, unknown>) {
  const {definition: input} = validateInput(z.strictObject({definition: z.unknown()}), body);
  const definition = parseDefinitionInput(input);
  await assertReferences(context, definition);
  const id = randomUUID();
  await member(() => sdk.createAutomationWorkflow(context.request.dc, {organizationId: context.organizationId, id, versionId: randomUUID(), ...stored(definition)}, context.request.options));
  return {id};
}

export async function saveWorkflow(context: Context, rawId: string, body: Record<string, unknown>) {
  const id = validateInput(idSchema, rawId);
  const input = validateInput(z.strictObject({definition: z.unknown(), expectedRevision: z.number().int().min(1), versionNumber: z.number().int().min(2)}), body);
  const definition = parseDefinitionInput(input.definition);
  await assertReferences(context, definition);
  await member(() => sdk.saveAutomationWorkflow(context.request.dc, {organizationId: context.organizationId, id, versionId: randomUUID(), expectedRevision: input.expectedRevision,
    versionNumber: input.versionNumber, ...stored(definition)}, context.request.options));
  return {id, versionNumber: input.versionNumber};
}

const transitionSchema = z.discriminatedUnion("action", [
  z.strictObject({action: z.literal("submit"), expectedRevision: z.number().int().min(1)}),
  z.strictObject({action: z.literal("return"), expectedRevision: z.number().int().min(1), note: z.string().trim().max(500).default("")}),
  z.strictObject({action: z.literal("approve"), expectedRevision: z.number().int().min(1), versionNumber: z.number().int().min(1)}),
  z.strictObject({action: z.literal("activate"), expectedRevision: z.number().int().min(1)}),
  z.strictObject({action: z.literal("pause"), expectedRevision: z.number().int().min(1)}),
  z.strictObject({action: z.literal("archive"), expectedRevision: z.number().int().min(1)}),
]);

export async function transitionWorkflow(context: Context, rawId: string, body: Record<string, unknown>) {
  const id = validateInput(idSchema, rawId);
  const input = validateInput(transitionSchema, body);
  const base = {organizationId: context.organizationId, id, expectedRevision: input.expectedRevision};
  const {dc, options} = context.request;
  switch (input.action) {
    case "submit": await member(() => sdk.submitAutomationWorkflow(dc, base, options)); break;
    case "return": await member(() => sdk.returnAutomationWorkflowToDraft(dc, {...base, note: input.note}, options)); break;
    case "approve": await member(() => sdk.approveAutomationWorkflow(dc, {...base, versionNumber: input.versionNumber}, options)); break;
    case "activate": {
      // A scheduled workflow gets its first run time now; it is stored in UTC.
      const {workflow} = await getWorkflow(context, id);
      const next = workflow.triggerType === "workflow.scheduled" ? nextScheduledTime(parseDefinitionInput(workflow.definition), new Date()) : null;
      if (workflow.triggerType === "workflow.scheduled" && !next) throw new WorkspaceError("VALIDATION_ERROR", 400, "This schedule has no future run time. Edit the schedule first.");
      await member(() => sdk.activateAutomationWorkflow(dc, {...base, nextRunAt: next?.toISOString() ?? null}, options));
      break;
    }
    case "pause": await member(() => sdk.pauseAutomationWorkflow(dc, base, options)); break;
    case "archive": await member(() => sdk.archiveAutomationWorkflow(dc, base, options)); break;
  }
  return {id, action: input.action};
}

/** "Run now": queues a manual event (idempotent per request ID); the worker runs it. */
export async function runWorkflow(context: Context, rawId: string, body: Record<string, unknown>) {
  const workflowId = validateInput(idSchema, rawId);
  const input = validateInput(z.strictObject({requestId: idSchema, leadId: idSchema.nullable().default(null)}), body);
  await member(() => sdk.queueManualAutomationRun(context.request.dc, {organizationId: context.organizationId, workflowId, eventId: input.requestId, leadId: input.leadId, hasLead: input.leadId !== null}, context.request.options));
  return {queued: true, eventId: canonicalUuid(input.requestId)};
}

const executionFilters = z.strictObject({
  workflowId: idSchema.optional(), status: z.enum(["QUEUED", "RUNNING", "WAITING", "APPROVAL_REQUIRED", "PAUSED", "SUCCEEDED", "SKIPPED", "FAILED", "CANCELLED"]).optional(),
  triggerType: z.string().max(60).optional(), agentId: idSchema.optional(), from: z.iso.datetime({offset: true}).optional(), to: z.iso.datetime({offset: true}).optional(),
  offset: z.coerce.number().int().min(0).max(10_000).default(0),
});

export async function listExecutions(context: Context, input: unknown) {
  const filters = validateInput(executionFilters, input);
  const data = await member(() => sdk.listAutomationExecutions(context.request.dc, {organizationId: context.organizationId, workflowId: filters.workflowId,
    status: filters.status ? sdk.AutomationExecutionStatus[filters.status] : undefined, triggerType: filters.triggerType, agentMembershipId: filters.agentId,
    from: filters.from, to: filters.to, limit: 30, offset: filters.offset}, context.request.options));
  return {executions: data.executions};
}

export async function getExecution(context: Context, rawId: string) {
  const id = validateInput(idSchema, rawId);
  const data = await member(() => sdk.getAutomationExecution(context.request.dc, {organizationId: context.organizationId, id}, context.request.options));
  if (!data.execution) throw new WorkspaceError("NOT_FOUND", 404, "This execution was not found in your company.");
  return {execution: data.execution, steps: data.steps, job: data.job[0] ?? null};
}

/** Real counts for the dashboard (the last 30 days of executions). */
export async function automationMetrics(context: Context) {
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const data = await member(() => sdk.automationMetrics(context.request.dc, {organizationId: context.organizationId, since}, context.request.options));
  const byStatus = (rows: Array<{status: string; count: number}>) => Object.fromEntries(rows.map(row => [row.status, row.count]));
  const executions = data.executions;
  const finished = executions.filter(row => row.averageDurationMs !== null && row.averageDurationMs !== undefined && ["SUCCEEDED", "FAILED"].includes(row.status));
  const weight = finished.reduce((sum, row) => sum + row.count, 0);
  return {
    since, workflows: byStatus(data.workflows), executions: byStatus(executions), pendingApprovals: data.pendingApprovals[0]?.count ?? 0,
    averageDurationMs: weight ? Math.round(finished.reduce((sum, row) => sum + (row.averageDurationMs ?? 0) * row.count, 0) / weight) : null,
    topWorkflows: [...data.byWorkflow].sort((a, b) => b.count - a.count).slice(0, 5).map(row => ({workflowId: canonicalUuid(row.workflowId), count: row.count})),
  };
}
