import "server-only";

import { randomUUID } from "node:crypto";
import { canonicalUuid } from "@/modules/organizations/server/identifiers";
import { evaluateCondition } from "../conditions";
import { planNewLeadAssignment } from "@/modules/leads/distribution/service";
import { WorkspaceError } from "@/modules/organizations/server/errors";
import { ACTIONS, LIMITS, TRIGGERS, canonicalJson, parseWorkflowDefinition, type Action, type WorkflowDefinition } from "../definition";
import { periodKey, sha256, stableUuid, stepKey } from "../ids";
import { riskOf } from "../policy";
import { nextAllowedTime, nextScheduledTime, withinHours } from "../scheduling";
import { PermanentStepError, runAction, type StepOutcome, type StepRun } from "./actions";
import { NO_TARGET_HASH, leadStateHash } from "./approvals";
import { AutomationDbError, ExecutorUnavailableError, adminDataConnect, executorContext, raw, sdk, type Context } from "./data";
import { loadRunState, type AutomationEventRow } from "./facts";

/*
 * The durable workflow engine (docs/AUTOMATION_ENGINE.md#execution).
 *
 * A tick, called by the worker, handles a bounded batch per company:
 * 1. it claims a short company lease (one tick per company at a time);
 * 2. turns pending outbox events into executions of matching active workflows
 *    (unique per workflow and event, within the daily limit and chain depth);
 * 3. queues due schedules as events;
 * 4. claims due jobs and runs their steps as the workflow's executor, recording
 *    each step, until a delay, an approval, the end, or the per-tick step limit.
 *
 * All progress is in PostgreSQL, so a crash or restart loses nothing: an
 * unfinished job's lease expires and the next tick continues it, and every side
 * effect has a deterministic ID, so continuing never duplicates one.
 */

export interface TickResult {
  organizations: number;
  events: number;
  executionsStarted: number;
  jobs: number;
  steps: number;
  errors: string[];
}

interface WorkflowRow {id: string; name: string; triggerType: string; approvedVersionId?: string | null; executorUid?: string | null; timeZone: string; nextRunAt?: string | null; activatedAt?: string | null}
type Dc = ReturnType<typeof adminDataConnect>;

/** Outside production, the provider's message helps trace a failing operation; production logs keep codes only. */
const diagnostic = (error: unknown) => {
  if (process.env.NODE_ENV === "production" || !(error instanceof AutomationDbError) || !(error.cause instanceof Error)) return "";
  return ` (${error.cause.message.replace(/\s+/g, " ").slice(0, 400)})`;
};
const leaseUntil = (now: Date) => new Date(now.getTime() + LIMITS.leaseSeconds * 1000).toISOString();
/** Claude failures a retry within minutes cannot fix (configuration, credentials, model, billing, a rejected request). Overload, rate limits and timeouts are retried. */
const PERMANENT_AI_ERRORS = new Set(["AI_DISABLED", "AI_NOT_CONFIGURED", "AI_PROVIDER_AUTH", "AI_PROVIDER_FORBIDDEN", "AI_MODEL_UNAVAILABLE", "AI_PROVIDER_BILLING", "AI_PROVIDER_REJECTED"]);
/** Retry backoff for a failing step: 1, 5 and 15 minutes. */
const BACKOFF_MINUTES = [1, 5, 15];

export async function runAutomationTick(options: {now?: () => Date; maxOrganizations?: number; budgetMs?: number} = {}): Promise<TickResult> {
  const clock = options.now ?? (() => new Date());
  const started = Date.now();
  const budget = options.budgetMs ?? 20_000;
  const dc = adminDataConnect();
  const result: TickResult = {organizations: 0, events: 0, executionsStarted: 0, jobs: 0, steps: 0, errors: []};
  const work = await raw(() => sdk.listAutomationWorkOrganizations(dc, {now: clock().toISOString()}));
  const organizations = [...new Set([...work.events, ...work.jobs, ...work.schedules, ...work.scans].map(row => canonicalUuid(row.organizationId)))].slice(0, options.maxOrganizations ?? 20);
  for (const organizationId of organizations) {
    if (Date.now() - started > budget) break;
    try {
      await processOrganization(dc, organizationId, clock, result, () => Date.now() - started > budget);
      result.organizations += 1;
    } catch (error) {
      result.errors.push(`${organizationId}: ${error instanceof Error ? error.message : "UNKNOWN"}${diagnostic(error)}`);
    }
  }
  return result;
}

async function processOrganization(dc: Dc, organizationId: string, clock: () => Date, result: TickResult, outOfTime: () => boolean) {
  try { await raw(() => sdk.ensureAutomationOrgState(dc, {organizationId})); } catch (error) { if (!(error instanceof AutomationDbError && error.duplicate)) throw error; }
  const claimToken = randomUUID();
  try {
    await raw(() => sdk.claimAutomationOrganization(dc, {organizationId, claimToken, now: clock().toISOString(), leaseUntil: leaseUntil(clock())}));
  } catch (error) {
    if (error instanceof AutomationDbError && error.token === "AUTOMATION_ORGANIZATION_BUSY") return;
    throw error;
  }
  try {
    const work = await raw(() => sdk.getAutomationWork(dc, {organizationId, now: clock().toISOString()}));
    const workflows = work.workflows as WorkflowRow[];
    const definitions = await loadDefinitions(dc, organizationId, workflows);
    await queueSchedules(dc, organizationId, claimToken, workflows, definitions, clock());
    await scanDueTasks(dc, organizationId, claimToken, workflows, work.state?.lastScanAt ?? null, clock());
    const events = (await raw(() => sdk.getAutomationWork(dc, {organizationId, now: clock().toISOString()}))).events as AutomationEventRow[];
    for (const event of events) {
      if (outOfTime()) break;
      result.events += 1;
      result.executionsStarted += await routeEvent(dc, organizationId, claimToken, event, workflows, definitions, clock());
    }
    const jobs = (await raw(() => sdk.getAutomationWork(dc, {organizationId, now: clock().toISOString()}))).jobs;
    for (const job of jobs) {
      if (outOfTime()) break;
      const steps = await runJob(dc, organizationId, canonicalUuid(job.id), canonicalUuid(job.executionId), clock);
      if (steps !== null) { result.jobs += 1; result.steps += steps; }
    }
  } finally {
    await raw(() => sdk.releaseAutomationOrganization(dc, {organizationId, claimToken})).catch(() => undefined);
  }
}

async function loadDefinitions(dc: Dc, organizationId: string, workflows: WorkflowRow[]) {
  const ids = workflows.flatMap(workflow => workflow.approvedVersionId ? [canonicalUuid(workflow.approvedVersionId)] : []);
  const definitions = new Map<string, {versionId: string; definition: WorkflowDefinition}>();
  if (!ids.length) return definitions;
  const {versions} = await raw(() => sdk.getAutomationVersions(dc, {organizationId, ids}));
  for (const version of versions) {
    try { definitions.set(canonicalUuid(version.workflowId), {versionId: canonicalUuid(version.id), definition: parseWorkflowDefinition(JSON.parse(version.definitionJson))}); } catch { /* an invalid stored definition never runs */ }
  }
  return definitions;
}

/** Due scheduled workflows become events; the next run is set with compare-and-set so it fires once. */
async function queueSchedules(dc: Dc, organizationId: string, claimToken: string, workflows: WorkflowRow[], definitions: Awaited<ReturnType<typeof loadDefinitions>>, now: Date) {
  for (const workflow of workflows) {
    if (workflow.triggerType !== "workflow.scheduled" || !workflow.nextRunAt || Date.parse(workflow.nextRunAt) > now.getTime()) continue;
    const definition = definitions.get(canonicalUuid(workflow.id))?.definition;
    const next = definition ? nextScheduledTime(definition, now) : null;
    try {
      await raw(() => sdk.setAutomationWorkflowNextRun(dc, {organizationId, claimToken, id: workflow.id, expectedNextRunAt: workflow.nextRunAt!, nextRunAt: next?.toISOString() ?? null}));
    } catch (error) {
      if (error instanceof AutomationDbError && error.token === "AUTOMATION_SCHEDULE_TAKEN") continue;
      throw error;
    }
    const key = `schedule:${canonicalUuid(workflow.id)}:${workflow.nextRunAt}`;
    try {
      await raw(() => sdk.insertAutomationEvent(dc, {organizationId, id: stableUuid("automation-schedule", key), deduplicationKey: key, triggerType: "workflow.scheduled", targetType: "NONE",
        targetId: null, actorUid: null, origin: "SCHEDULE", originalEventId: null, parentExecutionId: null, originWorkflowId: null, chainDepth: 0, payload: {workflowId: canonicalUuid(workflow.id)}}));
    } catch (error) { if (!(error instanceof AutomationDbError && error.duplicate)) throw error; }
  }
}

const SCAN_TRIGGERS = ["lead.followup_due", "task.overdue"];
const SCAN_EVERY_MS = 60_000;
const SCAN_LIMIT = 50;

/**
 * Time-based triggers (docs/AUTOMATION_ENGINE.md#time-based-triggers): pending follow-ups and work tasks that
 * became due since the last scan become events, at most once a minute per company and only while a workflow uses
 * them. Each event key includes the due time, so a rescheduled task can fire again but a repeated scan cannot.
 * Tasks that were already due before the workflow was activated, or more than a day ago, are not picked up.
 */
async function scanDueTasks(dc: Dc, organizationId: string, claimToken: string, workflows: WorkflowRow[], lastScanAt: string | null, now: Date) {
  const scanning = workflows.filter(workflow => SCAN_TRIGGERS.includes(workflow.triggerType) && workflow.activatedAt && workflow.executorUid);
  if (!scanning.length || (lastScanAt && now.getTime() - Date.parse(lastScanAt) < SCAN_EVERY_MS)) return;
  const wants = new Set(scanning.map(workflow => workflow.triggerType));
  // Due times are set in the future when tasks are created, so the window can start exactly where the last scan ended.
  const since = Math.max(Math.min(...scanning.map(workflow => Date.parse(workflow.activatedAt!))), now.getTime() - 86_400_000, lastScanAt ? Date.parse(lastScanAt) : 0);
  const {followUps, workTasks} = await raw(() => sdk.listAutomationDueTasks(dc, {organizationId, since: new Date(since).toISOString(), now: now.toISOString()}));
  const emit = async (triggerType: string, id: string, dueAt: string, payload: Record<string, unknown>) => {
    const key = `${triggerType}:${canonicalUuid(id)}:${new Date(dueAt).toISOString()}`;
    try {
      await raw(() => sdk.insertAutomationEvent(dc, {organizationId, id: stableUuid("automation-scan", key), deduplicationKey: key, triggerType, targetType: "TASK", targetId: canonicalUuid(id),
        actorUid: null, origin: "SCHEDULE", originalEventId: null, parentExecutionId: null, originWorkflowId: null, chainDepth: 0, payload}));
    } catch (error) { if (!(error instanceof AutomationDbError && error.duplicate)) throw error; }
  };
  for (const row of followUps) {
    const payload = {kind: "FOLLOW_UP", leadId: canonicalUuid(row.leadId)};
    if (wants.has("lead.followup_due")) await emit("lead.followup_due", row.id, row.dueAt, payload);
    if (wants.has("task.overdue")) await emit("task.overdue", row.id, row.dueAt, payload);
  }
  if (wants.has("task.overdue")) for (const row of workTasks) await emit("task.overdue", row.id, row.dueAt, {kind: "WORK_TASK", leadId: row.leadId ? canonicalUuid(row.leadId) : null});
  // A full page means more are due: record coverage up to the last one seen (ties are re-read; their keys deduplicate).
  const full = [followUps, workTasks].filter(rows => rows.length >= SCAN_LIMIT).map(rows => Date.parse(rows[rows.length - 1].dueAt) - 1);
  const scannedAt = full.length ? new Date(Math.min(...full)) : now;
  await raw(() => sdk.markAutomationScan(dc, {organizationId, claimToken, scannedAt: scannedAt.toISOString()}));
}

/** Starts executions of the active workflows an event matches. Returns how many started. */
async function routeEvent(dc: Dc, organizationId: string, claimToken: string, event: AutomationEventRow & {forWorkflowId?: string | null}, workflows: WorkflowRow[], definitions: Awaited<ReturnType<typeof loadDefinitions>>, now: Date) {
  const finish = (status: "PROCESSED" | "SKIPPED" | "FAILED", matchedCount: number, errorCode: string | null = null) =>
    raw(() => sdk.finishAutomationEvent(dc, {organizationId, claimToken, id: event.id, status: sdk.AutomationEventStatus[status], matchedCount, errorCode}));
  if (!(event.triggerType in TRIGGERS)) { await finish("SKIPPED", 0, "UNKNOWN_TRIGGER"); return 0; }
  // Loop prevention: events created by workflows go at most LIMITS.chainDepth levels deep.
  if (event.chainDepth >= LIMITS.chainDepth) { await finish("SKIPPED", 0, "CHAIN_DEPTH_LIMIT"); return 0; }
  const scheduledFor = event.origin === "SCHEDULE" && event.payload && typeof event.payload === "object" ? (event.payload as {workflowId?: unknown}).workflowId : null;
  const candidates = workflows.filter(workflow => workflow.triggerType === event.triggerType && workflow.executorUid && definitions.has(canonicalUuid(workflow.id))
    && (!event.forWorkflowId || canonicalUuid(event.forWorkflowId) === canonicalUuid(workflow.id))
    && (typeof scheduledFor !== "string" || canonicalUuid(scheduledFor) === canonicalUuid(workflow.id))
    // A workflow never runs on an event its own execution created.
    && !(event.originWorkflowId && canonicalUuid(event.originWorkflowId) === canonicalUuid(workflow.id)));
  let started = 0;
  let failure: string | null = null;
  for (const workflow of candidates) {
    const {versionId, definition} = definitions.get(canonicalUuid(workflow.id))!;
    try {
      const context = await executorContext(organizationId, workflow.executorUid!);
      const state = await loadRunState(context, event);
      if (!evaluateCondition(definition.conditions, state.facts, now)) continue;
      const executionId = stableUuid("automation-execution", workflow.id, event.id);
      await raw(() => sdk.startAutomationExecution(dc, {organizationId, claimToken, executionId, jobId: stableUuid("automation-job", executionId), workflowId: workflow.id, workflowVersionId: versionId,
        eventId: event.id, triggerType: event.triggerType, targetType: event.targetType, targetId: event.targetId ?? null,
        leadId: state.target.leadId, chainDepth: event.chainDepth, executorUid: workflow.executorUid!, periodKey: periodKey(now), dailyLimit: LIMITS.dailyExecutions}));
      started += 1;
    } catch (error) {
      if (error instanceof AutomationDbError && error.duplicate) { started += 1; continue; }
      if (error instanceof ExecutorUnavailableError) {
        await raw(() => sdk.pauseAutomationWorkflowForSystem(dc, {organizationId, id: workflow.id, reason: "EXECUTOR_NOT_AUTHORIZED"})).catch(() => undefined);
        continue;
      }
      failure = error instanceof AutomationDbError ? error.token ?? error.providerCode ?? "DATABASE_ERROR" : "EVENT_ROUTING_FAILED";
      if (failure === "AUTOMATION_DAILY_LIMIT" || failure === "AUTOMATION_LEASE_LOST") break;
    }
  }
  await finish(failure ? "FAILED" : started ? "PROCESSED" : "SKIPPED", started, failure);
  return started;
}

interface JobState {
  dc: Dc; organizationId: string; jobId: string; jobToken: string; executionId: string; startedAt: string; clock: () => Date;
}

function durationOf(job: JobState) {
  return Math.max(0, Math.min(2_147_483_647, job.clock().getTime() - Date.parse(job.startedAt)));
}

/** Ends or reschedules the execution without a step result. */
async function settle(job: JobState, input: {nextStep: number; status: "QUEUED" | "WAITING" | "APPROVAL_REQUIRED" | "SUCCEEDED" | "SKIPPED" | "FAILED" | "CANCELLED" | "PAUSED"; jobStatus: "QUEUED" | "SUCCEEDED" | "FAILED" | "DEAD" | "CANCELLED"; runAt?: Date; errorCode?: string | null}) {
  const final = !["QUEUED", "WAITING", "APPROVAL_REQUIRED"].includes(input.status);
  await raw(() => sdk.settleAutomationExecution(job.dc, {organizationId: job.organizationId, jobId: job.jobId, jobToken: job.jobToken, executionId: job.executionId, nextStep: input.nextStep,
    executionStatus: sdk.AutomationExecutionStatus[input.status], executionErrorCode: input.errorCode ?? null, jobStatus: sdk.AutomationJobStatus[input.jobStatus],
    runAt: (input.runAt ?? job.clock()).toISOString(), completedAt: final ? job.clock().toISOString() : null, durationMs: final ? durationOf(job) : null}));
}

/** Claims and runs one job. Returns the number of steps run, or null when another worker had it. */
async function runJob(dc: Dc, organizationId: string, jobId: string, executionId: string, clock: () => Date): Promise<number | null> {
  const jobToken = randomUUID();
  try {
    await raw(() => sdk.claimAutomationJob(dc, {organizationId, id: jobId, jobToken, now: clock().toISOString(), leaseUntil: leaseUntil(clock())}));
  } catch (error) {
    if (error instanceof AutomationDbError && error.token === "AUTOMATION_JOB_TAKEN") return null;
    throw error;
  }
  const {execution, steps: recorded} = await raw(() => sdk.getAutomationExecutionRun(dc, {organizationId, id: executionId}));
  if (!execution) return 0;
  const job: JobState = {dc, organizationId, jobId, jobToken, executionId, startedAt: execution.startedAt ?? clock().toISOString(), clock};
  const nextStep = execution.nextStep;

  if (["SUCCEEDED", "SKIPPED", "FAILED", "CANCELLED"].includes(execution.status)) { await settle(job, {nextStep, status: execution.status as "SUCCEEDED", jobStatus: "SUCCEEDED"}); return 0; }
  const workflow = execution.workflow;
  if (workflow.status === "PAUSED") { await settle(job, {nextStep, status: "PAUSED", jobStatus: "QUEUED", runAt: new Date(clock().getTime() + 15 * 60_000)}); return 0; }
  if (workflow.status !== "ACTIVE") { await settle(job, {nextStep, status: "CANCELLED", jobStatus: "CANCELLED", errorCode: "WORKFLOW_NOT_ACTIVE"}); return 0; }
  if (clock().getTime() - Date.parse(execution.createdAt) > LIMITS.executionDays * 86_400_000) { await settle(job, {nextStep, status: "FAILED", jobStatus: "DEAD", errorCode: "EXECUTION_EXPIRED"}); return 0; }

  let definition: WorkflowDefinition;
  try { definition = parseWorkflowDefinition(JSON.parse(execution.workflowVersion.definitionJson)); } catch { await settle(job, {nextStep, status: "FAILED", jobStatus: "DEAD", errorCode: "DEFINITION_INVALID"}); return 0; }

  await raw(() => sdk.beginAutomationJob(dc, {organizationId, jobId, jobToken, executionId, now: clock().toISOString()}));
  let context: Context;
  try {
    context = await executorContext(organizationId, execution.executorUid);
  } catch (error) {
    if (!(error instanceof ExecutorUnavailableError)) throw error;
    await raw(() => sdk.pauseAutomationWorkflowForSystem(dc, {organizationId, id: execution.workflowId, reason: "EXECUTOR_NOT_AUTHORIZED"})).catch(() => undefined);
    await settle(job, {nextStep, status: "FAILED", jobStatus: "FAILED", errorCode: "EXECUTOR_NOT_AUTHORIZED"});
    return 0;
  }

  const event = execution.triggeringEvent as AutomationEventRow;
  const byPosition = new Map(recorded.map(step => [step.position, step]));
  let position = nextStep;
  let ran = 0;
  while (true) {
    const action = definition.steps[position];
    if (!action) { await settle(job, {nextStep: position, status: "SUCCEEDED", jobStatus: "SUCCEEDED"}); return ran; }
    if (ran >= LIMITS.stepsPerTick) { await settle(job, {nextStep: position, status: "QUEUED", jobStatus: "QUEUED"}); return ran; }
    const now = clock();
    // Steps with side effects wait for business hours and outside quiet hours.
    if (!["delay", "end"].includes(action.type) && !withinHours(definition, now)) {
      const next = nextAllowedTime(definition, now);
      await settle(job, next ? {nextStep: position, status: "WAITING", jobStatus: "QUEUED", runAt: next} : {nextStep: position, status: "FAILED", jobStatus: "DEAD", errorCode: "NO_ALLOWED_TIME"});
      return ran;
    }
    const state = await loadRunState(context, event);
    const previous = byPosition.get(position);
    // A step waiting for a decision continues where it stopped; its condition was checked when approval was requested.
    const resuming = previous?.status === "APPROVAL_REQUIRED";
    const stepId = previous ? canonicalUuid(previous.id) : stableUuid("automation-step", executionId, position);
    if (previous && !resuming) await raw(() => sdk.retryAutomationStep(dc, {organizationId, jobId, jobToken, id: stepId}));
    else if (!previous) await raw(() => sdk.recordAutomationStep(dc, {organizationId, jobId, jobToken, id: stepId, executionId, position, actionId: action.id, actionType: action.type,
      actionSnapshot: JSON.stringify(action).slice(0, 5000), idempotencyKey: stepKey(executionId, position)}));
    const attempts = resuming ? previous.attemptCount : (previous?.attemptCount ?? 0) + 1;
    ran += 1;

    let outcome: StepOutcome;
    if (!resuming && !evaluateCondition(action.when, state.facts, now)) {
      outcome = {status: "SKIPPED", summary: "Conditions not met."};
    } else {
      try {
        const run = {context, organizationId, now, execution: {id: executionId, workflowId: canonicalUuid(execution.workflowId), chainDepth: execution.chainDepth, workflowVersionId: canonicalUuid(execution.workflowVersion.id)},
          event, workflowName: workflow.name, position, state};
        if (action.type === "lead.reassign" || action.type === "approval.request") {
          const result = await approvalStep(job, run, action, stepId, resuming);
          if (result === "STOPPED") return ran;
          outcome = result;
        } else if (ACTIONS[action.type].ai && !await reserveAiCall(job, now)) {
          outcome = {status: "SKIPPED", summary: `Skipped: the company's limit of ${LIMITS.dailyAiCalls} Claude steps per day was reached.`};
        } else {
          outcome = await runControl(action, now) ?? await runAction(run, action);
        }
      } catch (error) {
        // Claude and validation failures that a retry cannot fix (configuration, allowance, refusals, invalid input) are permanent.
        const permanent = error instanceof PermanentStepError || error instanceof ExecutorUnavailableError
          || (error instanceof WorkspaceError && (error.status < 500 || PERMANENT_AI_ERRORS.has(error.code)));
        const code = error instanceof PermanentStepError ? error.code : error instanceof ExecutorUnavailableError ? "EXECUTOR_NOT_AUTHORIZED" : error instanceof WorkspaceError ? error.code.slice(0, 64)
          : error instanceof AutomationDbError ? (error.token ?? error.providerCode ?? "DATABASE_ERROR").slice(0, 64) : "STEP_FAILED";
        if (code === "EXECUTOR_NOT_AUTHORIZED") await raw(() => sdk.pauseAutomationWorkflowForSystem(dc, {organizationId, id: execution.workflowId, reason: code})).catch(() => undefined);
        const retry = !permanent && attempts < LIMITS.stepAttempts;
        await finishStep(job, {stepId, stepStatus: "FAILED", errorCode: code, nextStep: position, executionStatus: retry ? "WAITING" : "FAILED", executionErrorCode: retry ? null : code,
          jobStatus: retry ? "QUEUED" : permanent ? "FAILED" : "DEAD", runAt: new Date(now.getTime() + BACKOFF_MINUTES[Math.min(attempts - 1, BACKOFF_MINUTES.length - 1)] * 60_000), release: true, final: !retry});
        return ran;
      }
    }

    if (action.type === "delay" && outcome.status === "SUCCEEDED") {
      await finishStep(job, {stepId, stepStatus: "SUCCEEDED", outcome, nextStep: position + 1, executionStatus: "WAITING", jobStatus: "QUEUED", runAt: new Date(now.getTime() + action.minutes * 60_000), release: true});
      return ran;
    }
    if ((action.type === "end" || action.type === "pause") && outcome.status === "SUCCEEDED") {
      if (action.type === "pause") await raw(() => sdk.pauseAutomationWorkflowForSystem(dc, {organizationId, id: execution.workflowId, reason: "PAUSE_STEP"})).catch(() => undefined);
      await finishStep(job, {stepId, stepStatus: "SUCCEEDED", outcome, nextStep: position + 1, executionStatus: action.type === "end" ? "SUCCEEDED" : "PAUSED", jobStatus: "SUCCEEDED", release: true, final: true});
      return ran;
    }
    const last = position + 1 >= definition.steps.length;
    await finishStep(job, {stepId, stepStatus: outcome.status, outcome, nextStep: position + 1, executionStatus: last ? "SUCCEEDED" : "RUNNING", jobStatus: last ? "SUCCEEDED" : "CLAIMED", release: last, final: last,
      actionIncrement: outcome.status === "SUCCEEDED" ? 1 : 0, aiIncrement: outcome.aiCalls ?? 0});
    if (last) return ran;
    position += 1;
  }
}

/** Reserves one Claude call within the company's daily workflow limit. False when the limit is reached. */
async function reserveAiCall(job: JobState, now: Date) {
  try {
    await raw(() => sdk.reserveAutomationAiCall(job.dc, {organizationId: job.organizationId, jobId: job.jobId, jobToken: job.jobToken, periodKey: periodKey(now), dailyLimit: LIMITS.dailyAiCalls}));
    return true;
  } catch (error) {
    if (error instanceof AutomationDbError && error.token === "AUTOMATION_AI_DAILY_LIMIT") return false;
    throw error;
  }
}

/** Steps the engine itself handles. Returns null for side-effect actions. */
async function runControl(action: Action, now: Date): Promise<StepOutcome | null> {
  switch (action.type) {
    case "delay": return {status: "SUCCEEDED", summary: `Waiting ${action.minutes} min, until ${new Date(now.getTime() + action.minutes * 60_000).toISOString()}.`};
    case "end": return {status: "SUCCEEDED", summary: "Execution ended."};
    case "pause": return {status: "SUCCEEDED", summary: `Workflow paused: ${action.reason}`};
    default: return null;
  }
}

/**
 * A step that needs a human decision (docs/WORKFLOW_APPROVALS.md#lifecycle). The first time, it records an
 * approval with the exact change and parks the job until expiry; a decision wakes the job early. Afterwards it
 * applies exactly what was approved, ends the execution on rejection or expiry, or asks again when the record
 * changed before anyone decided. Returns the step's outcome, or STOPPED when the job is parked or the execution ended.
 */
async function approvalStep(job: JobState, run: StepRun & {execution: StepRun["execution"] & {workflowVersionId: string}}, action: Extract<Action, {type: "lead.reassign" | "approval.request"}>, stepId: string, resuming: boolean): Promise<StepOutcome | "STOPPED"> {
  const {organizationId, now} = run;
  const approvals = resuming ? (await raw(() => sdk.getAutomationStepApprovals(job.dc, {organizationId, stepId}))).approvals : [];
  const latest = approvals[0];
  const end = async (code: string, summary: string) => {
    await finishStep(job, {stepId, stepStatus: "CANCELLED", outcome: {status: "SKIPPED", summary}, errorCode: code, nextStep: run.position, executionStatus: "CANCELLED", executionErrorCode: code, jobStatus: "SUCCEEDED", release: true, final: true});
    return "STOPPED" as const;
  };
  const close = (id: string, expected: "PENDING" | "APPROVED", status: "EXPIRED" | "EXECUTED" | "APPROVED", resultStatus: string, resultErrorCode: string | null) =>
    raw(() => sdk.closeAutomationApproval(job.dc, {organizationId, id, expectedStatus: sdk.AutomationApprovalStatus[expected], status: sdk.AutomationApprovalStatus[status], resultStatus, resultErrorCode, actorUid: run.context.request.user.uid}));

  if (latest) {
    const approvalId = canonicalUuid(latest.id);
    const by = latest.approver?.displayName ?? "an authorized member";
    switch (latest.status) {
      case "PENDING":
        if (Date.parse(latest.expiresAt) > now.getTime()) {
          await settle(job, {nextStep: run.position, status: "APPROVAL_REQUIRED", jobStatus: "QUEUED", runAt: new Date(latest.expiresAt)});
          return "STOPPED";
        }
        await close(approvalId, "PENDING", "EXPIRED", "EXPIRED", "APPROVAL_EXPIRED").catch(error => { if (!(error instanceof AutomationDbError && error.token === "AUTOMATION_APPROVAL_CHANGED")) throw error; });
        return end("APPROVAL_EXPIRED", "Nobody decided before the approval expired.");
      case "REJECTED": case "CANCELLED":
        return end("APPROVAL_REJECTED", `Rejected by ${by}${latest.decisionReason ? `: ${latest.decisionReason}` : "."}`);
      case "EXECUTED":
        return {status: "SUCCEEDED", resultType: "APPROVAL", resultId: approvalId, summary: `Approved by ${by} and applied.`};
      case "EXPIRED":
        // Closed because the lead changed before a decision: ask again for its current state, a few times at most.
        if (latest.resultErrorCode !== "TARGET_CHANGED" || approvals.length >= 3) return end("APPROVAL_EXPIRED", "The approval expired.");
        break;
      case "APPROVED": {
        if (action.type === "approval.request") {
          await close(approvalId, "APPROVED", "EXECUTED", "EXECUTED", null);
          return {status: "SUCCEEDED", resultType: "APPROVAL", resultId: approvalId, summary: `Approved by ${by}.`};
        }
        const lineage = {originalEventId: run.event.originalEventId ? canonicalUuid(run.event.originalEventId) : canonicalUuid(run.event.id), originWorkflowId: run.execution.workflowId, chainDepth: run.execution.chainDepth + 1};
        try {
          await raw(() => sdk.automationReassignLead(run.context.request.dc, {organizationId, leadId: canonicalUuid(latest.leadId!), expectedMembershipId: latest.fromMembershipId ? canonicalUuid(latest.fromMembershipId) : null,
            toMembershipId: canonicalUuid(latest.toMembershipId!), approvalId, executionId: run.execution.id, eventId: stableUuid("automation-event", run.execution.id, run.position, approvalId), ...lineage}, run.context.request.options));
        } catch (error) {
          const code = error instanceof AutomationDbError ? error.token : null;
          if (code && ["AUTOMATION_TARGET_CHANGED", "LEAD_CHANGED_RELOAD", "DISTRIBUTION_AGENT_UNAVAILABLE"].includes(code)) {
            await close(approvalId, "APPROVED", "APPROVED", "FAILED", code).catch(() => undefined);
            throw new PermanentStepError(code);
          }
          throw error;
        }
        return {status: "SUCCEEDED", resultType: "LEAD_ASSIGNMENT", resultId: canonicalUuid(latest.toMembershipId!), summary: `Approved by ${by}; the lead was reassigned.`};
      }
    }
  }

  // Request a decision for the exact change, as the records stand now.
  const lead = run.state.lead;
  let from: string | null = null, to: string | null = null;
  if (action.type === "lead.reassign") {
    if (!lead) throw new PermanentStepError("AUTOMATION_TARGET_INVALID");
    from = lead.assignedMembershipId;
    if (action.membershipId) to = canonicalUuid(action.membershipId);
    else {
      const plan = await planNewLeadAssignment(run.context, {branchId: lead.branchId, projectId: lead.projectId}, null);
      to = plan.hasAutoAssignment && plan.assignedMembershipId ? canonicalUuid(plan.assignedMembershipId) : null;
    }
    if (!to) throw new PermanentStepError("NO_REASSIGNMENT_TARGET");
    if (to === from) return {status: "SKIPPED", summary: "The lead is already assigned to that agent."};
  }
  const round = approvals.length + 1;
  const approvalId = stableUuid("automation-approval", run.execution.id, run.position, round);
  const snapshot = canonicalJson({round, executionId: run.execution.id, workflowVersionId: run.execution.workflowVersionId, position: run.position, action, leadId: lead?.id ?? null, fromMembershipId: from, toMembershipId: to});
  const expiresAt = new Date(now.getTime() + action.expiresMinutes * 60_000);
  await raw(() => sdk.requestAutomationApproval(job.dc, {organizationId, jobId: job.jobId, jobToken: job.jobToken, executionId: run.execution.id, stepId, approvalId,
    notificationId: stableUuid("automation-approval-notification", approvalId), workflowId: run.execution.workflowId, actionId: action.id, actionType: action.type, risk: riskOf(action),
    targetType: run.event.targetType, targetId: run.event.targetId ? canonicalUuid(run.event.targetId) : null, leadId: lead?.id ?? null, fromMembershipId: from, toMembershipId: to,
    requestedByUid: run.context.request.user.uid, snapshot: snapshot.slice(0, 8000), snapshotHash: sha256(snapshot),
    targetStateHash: action.type === "lead.reassign" ? leadStateHash(lead ? {assignedMembershipId: lead.assignedMembershipId, status: lead.status, archived: run.state.facts["lead.archived"] === true} : null) : NO_TARGET_HASH,
    expiresAt: expiresAt.toISOString(), title: `Approval needed: ${run.workflowName}`.slice(0, 160),
    body: (action.type === "lead.reassign" ? `Reassign ${lead?.fullName ?? "a lead"}. ${action.reason}` : action.reason).slice(0, 500)}));
  return "STOPPED";
}

async function finishStep(job: JobState, input: {stepId: string; stepStatus: "SUCCEEDED" | "SKIPPED" | "FAILED" | "CANCELLED"; outcome?: StepOutcome; errorCode?: string; nextStep: number;
  executionStatus: "RUNNING" | "WAITING" | "SUCCEEDED" | "FAILED" | "PAUSED" | "CANCELLED"; executionErrorCode?: string | null; jobStatus: "CLAIMED" | "QUEUED" | "SUCCEEDED" | "FAILED" | "DEAD"; runAt?: Date;
  release: boolean; final?: boolean; actionIncrement?: number; aiIncrement?: number}) {
  await raw(() => sdk.finishAutomationStep(job.dc, {organizationId: job.organizationId, jobId: job.jobId, jobToken: job.jobToken, executionId: job.executionId, stepId: input.stepId,
    stepStatus: sdk.AutomationStepStatus[input.stepStatus], resultType: input.outcome?.resultType ?? null, resultId: input.outcome?.resultId ?? null, resultSummary: input.outcome?.summary?.slice(0, 500) ?? null,
    errorCode: input.errorCode ?? null, nextStep: input.nextStep, executionStatus: sdk.AutomationExecutionStatus[input.executionStatus], executionErrorCode: input.executionErrorCode ?? null,
    jobStatus: sdk.AutomationJobStatus[input.jobStatus], runAt: (input.runAt ?? job.clock()).toISOString(), actionIncrement: input.actionIncrement ?? 0, aiIncrement: input.aiIncrement ?? 0,
    completedAt: input.final ? job.clock().toISOString() : null, durationMs: input.final ? durationOf(job) : null, releaseJob: input.release}));
}

