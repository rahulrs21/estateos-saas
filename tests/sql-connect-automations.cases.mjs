import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { describe, it } from "node:test";
import { fixture as f } from "./fixtures/sql-connect-fixtures.mjs";

/**
 * Phase 6E automation storage against the SQL Connect emulator with the real
 * stored operations: outbox events written atomically with CRM changes,
 * workflow roles and compare-and-set transitions, immutable versions, manual
 * runs, company leases, unique executions, daily limits, job claims and
 * fencing, idempotent side effects and tenant isolation. Calls without a uid
 * use the Admin identity (the worker); everything else impersonates a member.
 * Company A: owner-a, admin-a, manager-a, agent-a. Company B: owner-b.
 */
export function registerAutomationCases({sdk, run, forbidden, dc}) {
  describe("Phase 6E automation", {concurrency: false}, () => {
    const key = value => String(value).replaceAll("-", "").toLowerCase();
    const server = async (operation, variables) => (await operation(dc, variables)).data;
    const rejectsWith = (promise, token) => assert.rejects(promise, error => String(error?.message ?? error).includes(token), token);
    const hash = text => createHash("sha256").update(text).digest("hex");
    const definition = (name, trigger = "lead.created") => JSON.stringify({schemaVersion: 1, name, description: "", trigger, conditions: null,
      steps: [{id: "note", type: "lead.activity", when: null, note: "Synthetic test note"}], timeZone: "Asia/Dubai", schedule: null, businessHours: null, quietHours: null, errorPolicy: "RETRY_THEN_FAIL"});
    const create = async (uid, name, trigger = "lead.created") => {
      const id = randomUUID();
      const json = definition(name, trigger);
      await run(sdk.createAutomationWorkflow, uid, {organizationId: f.orgA, id, versionId: randomUUID(), name, description: "", triggerType: trigger, definitionJson: json, definitionHash: hash(json), hasApprovalSteps: false, timeZone: "Asia/Dubai"});
      return id;
    };
    const get = async (uid, id, createdByUid) => (await run(sdk.getAutomationWorkflow, uid, {organizationId: f.orgA, id, ...(createdByUid ? {createdByUid} : {})}));
    const activate = async (uid, id) => {
      let {workflow} = await get(uid, id);
      await run(sdk.submitAutomationWorkflow, uid, {organizationId: f.orgA, id, expectedRevision: workflow.revision});
      ({workflow} = await get(uid, id));
      await run(sdk.approveAutomationWorkflow, uid, {organizationId: f.orgA, id, expectedRevision: workflow.revision, versionNumber: workflow.currentVersionNumber});
      ({workflow} = await get(uid, id));
      await run(sdk.activateAutomationWorkflow, uid, {organizationId: f.orgA, id, expectedRevision: workflow.revision, nextRunAt: null});
      return (await get(uid, id)).workflow;
    };
    const events = async targetId => (await server(sdk.listAutomationEventsForTarget, {organizationId: f.orgA, targetId})).events;

    it("writes outbox events in the same transaction as the CRM change, and none when the change fails", async () => {
      const lead = (await run(sdk.createLead, "owner-a", {organizationId: f.orgA, fullName: `Automation lead ${randomUUID().slice(0, 8)}`})).lead.id;
      const created = await events(lead);
      assert.ok(created.some(event => event.triggerType === "lead.created" && event.origin === "CRM" && event.status === "PENDING" && event.actorUid === "owner-a"), JSON.stringify(created));
      await run(sdk.changeLeadStatus, "owner-a", {organizationId: f.orgA, leadId: lead, status: sdk.LeadStatus.CONTACTED});
      const changed = (await events(lead)).find(event => event.triggerType === "lead.status_changed");
      assert.equal(changed.payload.previousStatus, "NEW");
      assert.equal(changed.payload.status, "CONTACTED");
      const before = (await events(lead)).length;
      await forbidden(sdk.changeLeadStatus, "owner-b", {organizationId: f.orgA, leadId: lead, status: sdk.LeadStatus.QUALIFIED});
      await forbidden(sdk.changeLeadStatus, "agent-a", {organizationId: f.orgA, leadId: lead, status: sdk.LeadStatus.QUALIFIED});
      assert.equal((await events(lead)).length, before, "a failed or forbidden change leaves no event");
    });

    it("lets every member draft, keeps agents to their own workflows and isolates companies", async () => {
      const own = await create("agent-a", "Agent draft");
      assert.equal((await get("agent-a", own, "agent-a")).workflow.status, "DRAFT");
      await forbidden(sdk.getAutomationWorkflow, "agent-a", {organizationId: f.orgA, id: own}, undefined);
      const listed = await run(sdk.listAutomationWorkflows, "manager-a", {organizationId: f.orgA, limit: 200, offset: 0});
      assert.ok(listed.workflows.some(workflow => key(workflow.id) === key(own)), "managers see the company's workflows");
      await forbidden(sdk.listAutomationWorkflows, "owner-b", {organizationId: f.orgA, limit: 10, offset: 0});
      const ownerWorkflow = await create("owner-a", "Owner workflow");
      const agentView = await run(sdk.listAutomationWorkflows, "agent-a", {organizationId: f.orgA, createdByUid: "agent-a", limit: 200, offset: 0});
      assert.ok(!agentView.workflows.some(workflow => key(workflow.id) === key(ownerWorkflow)), "agents see only their own");
      await rejectsWith(run(sdk.createAutomationWorkflow, "owner-b", {organizationId: f.orgA, id: randomUUID(), versionId: randomUUID(), name: "Intruder", description: "", triggerType: "lead.created",
        definitionJson: definition("Intruder"), definitionHash: hash("x"), hasApprovalSteps: false, timeZone: "Asia/Dubai"}), "AUTOMATION_PERMISSION_DENIED");
    });

    it("enforces review, approval and activation by role, with compare-and-set revisions", async () => {
      const id = await create("agent-a", "Agent workflow for review");
      let {workflow} = await get("agent-a", id, "agent-a");
      await rejectsWith(run(sdk.activateAutomationWorkflow, "owner-a", {organizationId: f.orgA, id, expectedRevision: workflow.revision, nextRunAt: null}), "AUTOMATION_TRANSITION_DENIED");
      await run(sdk.submitAutomationWorkflow, "agent-a", {organizationId: f.orgA, id, expectedRevision: workflow.revision});
      await rejectsWith(run(sdk.submitAutomationWorkflow, "agent-a", {organizationId: f.orgA, id, expectedRevision: workflow.revision}), "AUTOMATION_TRANSITION_DENIED");
      ({workflow} = await get("owner-a", id));
      assert.equal(workflow.status, "IN_REVIEW");
      for (const uid of ["agent-a", "manager-a", "owner-b"]) {
        await rejectsWith(run(sdk.approveAutomationWorkflow, uid, {organizationId: f.orgA, id, expectedRevision: workflow.revision, versionNumber: 1}), "AUTOMATION_APPROVER_REQUIRED");
      }
      await rejectsWith(run(sdk.approveAutomationWorkflow, "admin-a", {organizationId: f.orgA, id, expectedRevision: workflow.revision, versionNumber: 2}), "AUTOMATION_TRANSITION_DENIED");
      await run(sdk.approveAutomationWorkflow, "admin-a", {organizationId: f.orgA, id, expectedRevision: workflow.revision, versionNumber: 1});
      ({workflow} = await get("owner-a", id));
      assert.equal(workflow.status, "APPROVED");
      assert.equal(workflow.approvedVersionNumber, 1);
      assert.equal(workflow.approvedByUid, "admin-a");
      await rejectsWith(run(sdk.activateAutomationWorkflow, "manager-a", {organizationId: f.orgA, id, expectedRevision: workflow.revision, nextRunAt: null}), "AUTOMATION_APPROVER_REQUIRED");
      await run(sdk.activateAutomationWorkflow, "owner-a", {organizationId: f.orgA, id, expectedRevision: workflow.revision, nextRunAt: null});
      ({workflow} = await get("owner-a", id));
      assert.equal(workflow.status, "ACTIVE");
      assert.equal(workflow.executorUid, "owner-a", "the activating member is the executor");
      // Editing an active workflow makes version 2 a draft: no approval, no executor, not running.
      await rejectsWith(run(sdk.saveAutomationWorkflow, "agent-a", {organizationId: f.orgA, id, versionId: randomUUID(), expectedRevision: workflow.revision, versionNumber: 2, name: "Edited",
        description: "", triggerType: "lead.created", definitionJson: definition("Edited"), definitionHash: hash("e"), hasApprovalSteps: false, timeZone: "Asia/Dubai"}), "AUTOMATION_PERMISSION_DENIED");
      await run(sdk.saveAutomationWorkflow, "admin-a", {organizationId: f.orgA, id, versionId: randomUUID(), expectedRevision: workflow.revision, versionNumber: 2, name: "Edited",
        description: "", triggerType: "lead.created", definitionJson: definition("Edited"), definitionHash: hash("e"), hasApprovalSteps: false, timeZone: "Asia/Dubai"});
      const edited = await get("owner-a", id);
      assert.equal(edited.workflow.status, "DRAFT");
      assert.equal(edited.workflow.approvedVersionNumber, null);
      assert.equal(edited.workflow.executorUid, null);
      assert.deepEqual(edited.versions.map(version => version.versionNumber), [2, 1], "versions are kept");
      await rejectsWith(run(sdk.saveAutomationWorkflow, "admin-a", {organizationId: f.orgA, id, versionId: randomUUID(), expectedRevision: workflow.revision, versionNumber: 3, name: "Stale",
        description: "", triggerType: "lead.created", definitionJson: definition("Stale"), definitionHash: hash("s"), hasApprovalSteps: false, timeZone: "Asia/Dubai"}), "AUTOMATION_CHANGED_RELOAD");
    });

    it("queues manual runs only for active manual workflows, once per request, for leads of the company", async () => {
      const manual = await activate("owner-a", await create("owner-a", "Manual workflow", "workflow.manual"));
      const eventId = randomUUID();
      await run(sdk.queueManualAutomationRun, "manager-a", {organizationId: f.orgA, workflowId: manual.id, eventId, leadId: f.leadA, hasLead: true});
      await assert.rejects(run(sdk.queueManualAutomationRun, "manager-a", {organizationId: f.orgA, workflowId: manual.id, eventId, leadId: f.leadA, hasLead: true}), "the same request is not queued twice");
      await rejectsWith(run(sdk.queueManualAutomationRun, "agent-a", {organizationId: f.orgA, workflowId: manual.id, eventId: randomUUID(), leadId: null, hasLead: false}), "AUTOMATION_PERMISSION_DENIED");
      await rejectsWith(run(sdk.queueManualAutomationRun, "owner-a", {organizationId: f.orgA, workflowId: manual.id, eventId: randomUUID(), leadId: f.leadB, hasLead: true}), "LEAD_NOT_FOUND");
      const automatic = await activate("owner-a", await create("owner-a", "Not manual"));
      await rejectsWith(run(sdk.queueManualAutomationRun, "owner-a", {organizationId: f.orgA, workflowId: automatic.id, eventId: randomUUID(), leadId: null, hasLead: false}), "AUTOMATION_NOT_RUNNABLE");
      const queued = (await events(f.leadA)).find(event => key(event.id) === key(eventId));
      assert.equal(queued.origin, "MANUAL");
    });

    it("leases each company to one worker, starts each workflow once per event within the daily limit, and fences jobs", async () => {
      await server(sdk.ensureAutomationOrgState, {organizationId: f.orgA}).catch(() => undefined);
      const now = () => new Date().toISOString();
      const lease = new Date(Date.now() + 60_000).toISOString();
      const token = randomUUID();
      await server(sdk.claimAutomationOrganization, {organizationId: f.orgA, claimToken: token, now: now(), leaseUntil: lease});
      await rejectsWith(server(sdk.claimAutomationOrganization, {organizationId: f.orgA, claimToken: randomUUID(), now: now(), leaseUntil: lease}), "AUTOMATION_ORGANIZATION_BUSY");
      const workflow = await activate("owner-a", await create("owner-a", "Worker workflow"));
      const lead = (await run(sdk.createLead, "owner-a", {organizationId: f.orgA, fullName: `Worker lead ${randomUUID().slice(0, 8)}`})).lead.id;
      const event = (await events(lead)).find(row => row.triggerType === "lead.created");
      const start = (overrides = {}) => server(sdk.startAutomationExecution, {organizationId: f.orgA, claimToken: token, executionId: randomUUID(), jobId: randomUUID(), workflowId: workflow.id,
        workflowVersionId: workflow.approvedVersionId, eventId: event.id, triggerType: "lead.created", targetType: "LEAD", targetId: lead, leadId: lead, chainDepth: 0, executorUid: "owner-a",
        periodKey: "2099-01-01", dailyLimit: 1000, ...overrides});
      await rejectsWith(start({claimToken: randomUUID()}), "AUTOMATION_DAILY_LIMIT");
      await rejectsWith(start({executorUid: "manager-a"}), "AUTOMATION_NOT_RUNNABLE");
      const executionId = randomUUID(), jobId = randomUUID();
      await start({executionId, jobId});
      await assert.rejects(start(), "one execution per workflow and event");
      // The daily counter resets per period and stops at the limit.
      const other = (await run(sdk.createLead, "owner-a", {organizationId: f.orgA, fullName: `Limit lead ${randomUUID().slice(0, 8)}`})).lead.id;
      const otherEvent = (await events(other)).find(row => row.triggerType === "lead.created");
      await rejectsWith(start({eventId: otherEvent.id, periodKey: "2099-01-01", dailyLimit: 1}), "AUTOMATION_DAILY_LIMIT");
      // Jobs: one claim at a time; a stale token cannot write.
      const jobToken = randomUUID();
      await server(sdk.claimAutomationJob, {organizationId: f.orgA, id: jobId, jobToken, now: now(), leaseUntil: lease});
      await rejectsWith(server(sdk.claimAutomationJob, {organizationId: f.orgA, id: jobId, jobToken: randomUUID(), now: now(), leaseUntil: lease}), "AUTOMATION_JOB_TAKEN");
      const step = {organizationId: f.orgA, jobId, id: randomUUID(), executionId, position: 0, actionId: "note", actionType: "lead.activity", actionSnapshot: "{}", idempotencyKey: `${key(executionId)}:0`};
      await rejectsWith(server(sdk.recordAutomationStep, {...step, jobToken: randomUUID()}), "AUTOMATION_LEASE_LOST");
      await server(sdk.recordAutomationStep, {...step, jobToken});
      await assert.rejects(server(sdk.recordAutomationStep, {...step, jobToken, id: randomUUID()}), "one step per position and idempotency key");
      await server(sdk.finishAutomationStep, {organizationId: f.orgA, jobId, jobToken, executionId, stepId: step.id, stepStatus: sdk.AutomationStepStatus.SUCCEEDED, resultType: null, resultId: null,
        resultSummary: "done", errorCode: null, nextStep: 1, executionStatus: sdk.AutomationExecutionStatus.SUCCEEDED, executionErrorCode: null, jobStatus: sdk.AutomationJobStatus.SUCCEEDED,
        runAt: now(), actionIncrement: 1, aiIncrement: 0, completedAt: now(), durationMs: 5, releaseJob: true});
      await rejectsWith(server(sdk.retryAutomationStep, {organizationId: f.orgA, jobId, jobToken, id: step.id}), "AUTOMATION_LEASE_LOST");
      const execution = await run(sdk.getAutomationExecution, "manager-a", {organizationId: f.orgA, id: executionId});
      assert.equal(execution.execution.status, "SUCCEEDED");
      assert.equal(execution.steps[0].status, "SUCCEEDED");
      await forbidden(sdk.getAutomationExecution, "agent-a", {organizationId: f.orgA, id: executionId});
      await forbidden(sdk.getAutomationExecution, "owner-b", {organizationId: f.orgA, id: executionId});
      await server(sdk.releaseAutomationOrganization, {organizationId: f.orgA, claimToken: token});
      await server(sdk.claimAutomationOrganization, {organizationId: f.orgA, claimToken: randomUUID(), now: now(), leaseUntil: new Date(Date.now() - 1000).toISOString()});
    });

    it("side effects run with the executor's role, once per deterministic ID, inside the company", async () => {
      const id = randomUUID();
      const variables = {organizationId: f.orgA, id, leadId: f.leadA, title: "Automation follow-up", dueAt: new Date(Date.now() + 3_600_000).toISOString(), eventId: randomUUID(),
        originalEventId: randomUUID(), parentExecutionId: randomUUID(), originWorkflowId: randomUUID(), chainDepth: 1};
      await rejectsWith(run(sdk.automationCreateLeadFollowUp, "agent-a", variables), "EXECUTOR_NOT_AUTHORIZED");
      await rejectsWith(run(sdk.automationCreateLeadFollowUp, "owner-b", variables), "EXECUTOR_NOT_AUTHORIZED");
      await run(sdk.automationCreateLeadFollowUp, "owner-a", variables);
      await assert.rejects(run(sdk.automationCreateLeadFollowUp, "owner-a", {...variables, eventId: randomUUID()}), "the same follow-up ID cannot be created twice");
      const followUpEvents = await events(id);
      assert.equal(followUpEvents.length, 1);
      assert.equal(followUpEvents[0].origin, "WORKFLOW");
      assert.equal(followUpEvents[0].chainDepth, 1, "events created by workflows are one level deeper");
      await rejectsWith(run(sdk.automationNotify, "owner-a", {organizationId: f.orgA, id: randomUUID(), audience: sdk.NotificationAudience.MEMBER, recipientMembershipId: randomUUID(), leadId: null, title: "t", body: "b"}), "AUTOMATION_RECIPIENT_INVALID");
      await run(sdk.automationNotify, "manager-a", {organizationId: f.orgA, id: randomUUID(), audience: sdk.NotificationAudience.MEMBER, recipientMembershipId: f.memberAgentA, leadId: null, title: "t", body: "b"});
      await rejectsWith(run(sdk.automationAddLeadNote, "owner-a", {organizationId: f.orgA, id: randomUUID(), leadId: f.leadB, note: "cross-company", executionId: randomUUID()}), "LEAD_NOT_FOUND");
      const task = {organizationId: f.orgA, id: randomUUID(), title: "Review", dueAt: new Date().toISOString(), assignedMembershipId: null, listingId: null, leadId: null, eventId: randomUUID(),
        originalEventId: randomUUID(), parentExecutionId: randomUUID(), originWorkflowId: randomUUID(), chainDepth: 1};
      await run(sdk.automationCreateWorkTask, "owner-a", task);
      await rejectsWith(run(sdk.automationCreateWorkTask, "owner-a", {...task, id: randomUUID(), eventId: randomUUID(), assignedMembershipId: f.memberSuspendedA}), "AUTOMATION_TARGET_INVALID");
    });

    it("shows work tasks to their assignee and the team queue to managers, and completes each once inside the company", async () => {
      const base = {organizationId: f.orgA, title: "Synthetic work task", dueAt: new Date(Date.now() + 3_600_000).toISOString(), listingId: null, leadId: null,
        originalEventId: randomUUID(), parentExecutionId: randomUUID(), originWorkflowId: randomUUID(), chainDepth: 1};
      const mine = randomUUID(), queue = randomUUID();
      await run(sdk.automationCreateWorkTask, "owner-a", {...base, id: mine, eventId: randomUUID(), assignedMembershipId: f.memberAgentA});
      await run(sdk.automationCreateWorkTask, "owner-a", {...base, id: queue, eventId: randomUUID(), assignedMembershipId: null});
      const listed = async uid => (await run(sdk.listMyTasks, uid, {organizationId: f.orgA, limit: 100})).workTasks.map(row => key(row.id));
      assert.ok((await listed("agent-a")).includes(key(mine)));
      assert.ok(!(await listed("agent-a")).includes(key(queue)), "agents do not see the team queue");
      assert.ok((await listed("manager-a")).includes(key(queue)), "managers see the team queue");
      assert.ok(!(await listed("manager-a")).includes(key(mine)), "other members' tasks are not listed");
      await forbidden(sdk.listMyTasks, "owner-b", {organizationId: f.orgA, limit: 100});
      await rejectsWith(run(sdk.completeWorkTask, "agent-a", {organizationId: f.orgA, id: queue}), "WORK_TASK_NOT_FOUND");
      await rejectsWith(run(sdk.completeWorkTask, "owner-b", {organizationId: f.orgA, id: mine}), "ACTIVE_MEMBERSHIP_REQUIRED");
      await run(sdk.completeWorkTask, "agent-a", {organizationId: f.orgA, id: mine});
      await rejectsWith(run(sdk.completeWorkTask, "agent-a", {organizationId: f.orgA, id: mine}), "WORK_TASK_NOT_FOUND");
      await run(sdk.completeWorkTask, "manager-a", {organizationId: f.orgA, id: queue});
      const completed = (await events(mine)).filter(event => event.triggerType === "task.completed");
      assert.equal(completed.length, 1, "completion emits task.completed once");
      assert.equal(completed[0].payload.kind, "WORK_TASK");
    });
  });
}
