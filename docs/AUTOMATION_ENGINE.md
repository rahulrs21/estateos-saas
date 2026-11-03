# Workflow automation engine (Phase 6E)

Approved workflows react to CRM events and run allowlisted internal actions: assignments, tasks, in-app notifications, notes, Claude drafts and approval steps. This document covers the definition format, events, the durable engine and its guarantees. See also [Workflow builder](WORKFLOW_BUILDER.md), [Approvals](WORKFLOW_APPROVALS.md), [Security](WORKFLOW_SECURITY.md) and [Operations](AUTOMATION_OPERATIONS.md).

Code: `src/modules/automations/` (pure: `definition.ts`, `conditions.ts`, `policy.ts`, `scheduling.ts`, `ids.ts`, `templates.ts`, `describe.ts`, `ai.ts`; server: `server/engine.ts`, `server/actions.ts`, `server/facts.ts`, `server/data.ts`). Schema: `dataconnect/schema/automation.gql`. Operations: `dataconnect/connector/automations.gql`, `approvals.gql`, `tasks.gql`.

## Workflow schema

A definition is versioned JSON (`schemaVersion: 1`), validated by `workflowDefinitionSchema` on every save, on every Claude proposal and again when the engine loads it. Nothing in it is executable: there are no expressions, selectors, URLs, scripts or SQL.

| Field | Meaning |
| --- | --- |
| `trigger` | One of the allowlisted triggers below |
| `conditions` | Optional AND/OR groups of `{field, operator, value}`, up to 3 levels; fields are the trigger's facts, operators depend on the fact's type |
| `steps` | 1–24 actions, each with a unique `id`, typed arguments and an optional `when` condition rechecked with fresh data when the step is reached |
| `timeZone` | IANA timezone (default `Asia/Dubai`) for schedules, business and quiet hours; stored times are UTC |
| `schedule` | Only for `workflow.scheduled`: once, daily or weekly |
| `businessHours`, `quietHours` | Side-effect steps wait for an allowed time |

Limits (`LIMITS` in `definition.ts`): 24 steps, condition depth 3, chain depth 3, 3 Claude steps per workflow, delays up to 30 days, executions expire after 90 days, 3 attempts per step, 1,000 executions and 50 Claude steps per company per UTC day, 10 steps per tick per execution, 120-second leases, 50 active and 200 total workflows per company.

Text fields (task titles, messages, notes, reasons, instructions) are plain text: no `<` or `>`, no links, and only the placeholders `{{lead.fullName}}`, `{{lead.status}}`, `{{listing.title}}`, `{{workflow.name}}` and `{{task.title}}`, filled from records read at run time.

## Triggers

| Trigger | Emitted by | Target |
| --- | --- | --- |
| `lead.created` | `CreateLead`, `CreateLeadForContact`, website capture | Lead |
| `lead.assigned` | `AssignLead`, creation with an assignee, automatic distribution, workflow assignment | Lead |
| `lead.unassigned` | `UnassignLead` | Lead |
| `lead.status_changed` | `ChangeLeadStatus` (payload: previous and new status) | Lead |
| `lead.followup_due` | Worker scan of pending follow-ups | Follow-up and its lead |
| `contact.created` | `CreateContact` | Contact |
| `viewing.scheduled` | `ScheduleLeadPropertyViewing` | Viewing and its lead |
| `viewing.completed` | `UpdateLeadPropertyViewing` when completed | Viewing and its lead |
| `listing.created`, `listing.status_changed` | `CreatePropertyListing`, `SetPropertyListingStatus` | Listing |
| `website_form.submitted` | Website capture | Lead |
| `task.created`, `task.completed` | Follow-ups and work tasks, including those workflows create | Task |
| `task.overdue` | Worker scan of pending follow-ups and work tasks | Task |
| `call.started` | `StartLeadCall`, `CreateIncomingProviderCall` (6F.6) | Call and its lead |
| `call.completed`, `call.failed`, `call.missed` | `LogLeadCall`, `LogContactCall`, `ApplyProviderCallStatus` when a call ends: answered, failed, or an incoming call nobody answered. One per call (`call:<id>:final`); an unanswered outgoing attempt writes none | Call and its lead |
| `call.summary_ready` | `CreateCallAiSummary` (with the lineage when a workflow made it) | Call and its lead |
| `meeting.scheduled`, `meeting.completed` | `CreateMeeting`, `CompleteMeeting` | Meeting and its lead |
| `workflow.manual` | "Run now" (optionally for one lead) | Lead or none |
| `workflow.scheduled` | Worker scheduler | None |

## Events (transactional outbox)

CRM mutations insert an `AutomationEvent` in the same `@transaction` as the change (marked `# Phase 6E outbox` in the connector files), so a failed or rolled-back operation never produces an event. Events carry their origin (`CRM`, `WEBSITE`, `WORKFLOW`, `SCHEDULE`, `MANUAL`, or `PROVIDER` for signed provider webhooks), actor, a small payload, and for workflow-created events the original event, parent execution, originating workflow and chain depth. Scanned and scheduled events have a unique `deduplicationKey` (for example `lead.followup_due:<id>:<dueAt>`), so they fire once.

### Time-based triggers

Inside its company lease the worker scans, at most once a minute and only while an active workflow uses `lead.followup_due` or `task.overdue`, for pending tasks that became due since the last scan. Tasks already due before the workflow was activated, or more than a day ago, are not picked up. Each event key includes the due time, so a rescheduled task can fire again but a repeated scan cannot.

## Execution

`runAutomationTick()` (`server/engine.ts`) handles a bounded batch per company:

1. **Company lease.** `ClaimAutomationOrganization` sets a claim token and a 120-second lease on `AutomationOrgState`; one tick per company at a time. Event routing and scanning are fenced by that token.
2. **Schedules.** Due `workflow.scheduled` workflows become events; the next run time is set with compare-and-set so each run fires once.
3. **Scan.** As above.
4. **Routing.** For each pending event, the matching active workflows (same trigger, executor set, approved version loaded) are checked:
   - against chain depth;
   - against their own lineage (a workflow never runs on an event its own execution created);
   - for manual events, against the requested workflow;
   - against their start conditions, using facts read as the executor.

   `StartAutomationExecution` then inserts the execution and its job, unique per `(workflow, event)`, within the daily limit.
5. **Jobs.** Each due job is claimed with its own token and lease (`ClaimAutomationJob`). Its steps run in order as the workflow's executor:
   - **Before each step:** business and quiet hours are checked, then fresh facts are loaded and the step's `when` condition is evaluated.
   - **Recording:** every step is recorded with a unique idempotency key, and every bookkeeping write checks the job's claim token (fencing).
   - **Ending a run:** a delay re-queues the job for later. An approval step parks it (see [Approvals](WORKFLOW_APPROVALS.md)). The last step ends the execution.

### Status flows

- **Workflow:** `DRAFT → IN_REVIEW → APPROVED → ACTIVE ⇄ PAUSED → ARCHIVED` (also back to `DRAFT` from review or approved). Saving creates a new version; an active workflow keeps running its approved version until the new one is approved.
- **Execution:** `QUEUED → RUNNING → (WAITING | APPROVAL_REQUIRED)* → SUCCEEDED | SKIPPED | FAILED | CANCELLED | PAUSED`.
- **Job:** `QUEUED → CLAIMED → QUEUED | SUCCEEDED | FAILED | DEAD | CANCELLED`.

### Idempotency, retries and dead letters

- Every created record (follow-up, work task, notification, note, event, approval, execution, job, step) has a deterministic ID (`stableUuid`: SHA-256 of a namespace and inputs, laid out as a UUID). A repeated step after a crash finds its earlier result, and the database reports the duplicate (`already-exists` or a unique-constraint error), which the engine treats as done.
- A step that throws is retried after 1, 5 and 15 minutes, up to 3 attempts. After that, the execution fails and the job is `DEAD` (the dead letter, listed in execution history with its error code).
- Permanent failures skip retries and fail at once. These include:
  - a missing record;
  - an executor without authority;
  - an invalid target;
  - Claude configuration, credential, model, billing or rejected-request errors.
- A crashed worker's claimed job is reclaimed when its lease expires. Every side effect is idempotent, so continuing never duplicates anything.
- Waiting executions are rows with a `runAt`; nothing waits in memory or in a browser.

### Loop prevention

- **Chain depth:** events created by workflows carry `chainDepth`; routing skips events at depth 3 or more (`CHAIN_DEPTH_LIMIT`).
- **No self-triggering:** a workflow never runs on an event its own execution created.
- **No events from these actions:** notifications and notes emit no events.
- **Daily caps:** per company, on executions and on Claude steps.

## Actions

| Action | Risk | Implementation |
| --- | --- | --- |
| `task.create` | LOW | A `LeadFollowUp` for lead targets (assigned to the lead's agent), otherwise a `WorkTask` for the record's agent or the team queue |
| `viewing.followup` | LOW | A follow-up on the viewing's lead |
| `notification.create` | LOW | In-app notification to the assigned agent, each manager, or the owners and administrators. Never email or messages |
| `lead.distribute` | LOW | The company's approved round-robin rule through `planNewLeadAssignment`, with cursor compare-and-set; unassigned leads only |
| `lead.activity` | LOW | An internal note of its own kind (it never counts as client contact) |
| `ai.draft` | LOW | An editable WhatsApp or email draft in Content Studio (`generateWorkflowDraft`), never sent |
| `ai.sales_review` | LOW | The existing AI sales analysis (`analyzeLead`), saved as an internal insight |
| `call.summarize` | LOW | A Claude call summary (6F.4) as the executor, from the transcript or else the agent's notes. Skipped with a reason when Claude call analysis is off, the call was not answered, there is nothing to summarise, or the executor is not an owner or administrator (or the call's agent). Not allowed in a `call.summary_ready` workflow |
| `delay`, `end`, `pause` | LOW | Engine control; `pause` pauses the workflow for review |
| `approval.request` | LOW | Waits for an authorized decision to continue |
| `lead.reassign` | MEDIUM | Always waits for approval of the exact change, then applies it with expected-state checks |

High-risk actions are not in the registry, so no definition can contain them. These include:

- sending WhatsApp messages, emails or SMS, or placing calls;
- launching campaigns;
- publishing listings or websites;
- deleting records;
- changing prices;
- financial transactions.

## Claude steps

Claude steps reuse the existing services; there is no other Anthropic client:

- `ai.draft` calls `generateWorkflowDraft`, extracted from Content Studio's streaming endpoint as `produceDraft`.
- `ai.sales_review` calls `analyzeLead`, extracted from the AI Sales endpoint.

They run as the executor, reading sources with the executor's permissions and using the executor's and the company's monthly allowance (`reserveQuota`). Usage records use the existing features (`CONTENT`, `SALES`).

Before a Claude step, `ReserveAutomationAiCall` counts it against the company's daily workflow limit (50). When the limit is reached, the step is skipped with a reason and the workflow continues.
