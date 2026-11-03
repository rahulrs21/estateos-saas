# Workflow security (Phase 6E)

## Principles

- **Data only.** Workflows are validated JSON over allowlisted triggers, facts, operators and actions. There is no `eval`, no JavaScript, no dynamically generated SQL, and no executable text from people or from Claude.
- **Server-side risk.** Risk comes from the action registry in code. LOW actions run once the workflow is approved and active. MEDIUM actions always wait for a human decision. High-risk actions are not in the registry, so no definition can contain them:
  - external messages (WhatsApp, email, SMS) and calls;
  - campaigns;
  - publishing listings or websites;
  - deleting records;
  - financial changes.
- **Claude proposes, people decide.** Claude drafts definitions only. It cannot save, approve, activate, run, or change risk or approval needs. Its output is mapped onto the allowlists, and anything outside them is reported, not kept.
- **Server-side tenancy.** Organization IDs and roles never come from the browser. Every route resolves the company from the verified session, and a mismatched `X-EstateOS-Organization` header is refused. Every table is keyed by `(organizationId, id)` with composite foreign keys, so cross-company references cannot exist.

## Worker identity

The worker is not a super-user.

- **Bookkeeping:** events, executions, steps, jobs, leases and counters use NO_ACCESS operations through the server-only Admin SDK.
- **Side effects:** these run as the workflow's executor, the OWNER or ADMIN who activated it. `executorContext` builds the same impersonated context a signed-in request has, and before every run it re-reads the executor's membership and requires the OWNER or ADMIN role. Every existing `@auth`/`@check` rule and business service therefore applies unchanged.
- **Lost authority:** if the executor is suspended, removed or demoted, nothing runs as them. The workflow pauses (`EXECUTOR_NOT_AUTHORIZED`) and an OWNER or ADMIN must reactivate it, becoming the new executor.

## Roles

| Permission | OWNER | ADMIN | MANAGER | AGENT |
| --- | --- | --- | --- | --- |
| View their own workflows; create and edit drafts; submit; ask Claude for a draft | ✓ | ✓ | ✓ | ✓ |
| View all workflows and executions; run manual workflows | ✓ | ✓ | ✓ | |
| Approve, activate, pause, archive workflows | ✓ | ✓ | | |
| Decide `approval.request` steps | ✓ | ✓ | ✓ | |
| Decide `lead.reassign` steps | ✓ | ✓ | | |

Self-approval of a workflow by its author, and of a step requested for one's own workflow, is allowed only for OWNERs and is recorded in the audit log. Nothing grants elevated privileges automatically.

## Integrity

- **Compare-and-set:** on workflow revisions, statuses, approvals, distribution cursors and lead updates.
- **Unique keys:** per execution `(workflow, event)`, per step idempotency key, and per event deduplication key.
- **Deterministic IDs** for everything a step creates.
- **Leases and claim tokens** fence every worker write.
- **The worker endpoint** requires `AUTOMATION_WORKER_SECRET` (at least 32 characters, compared in constant time). Without it the endpoint is off (503). Its response contains counts only.
- **Errors** are stored as codes. Provider messages and stack traces are not stored or shown, and diagnostic detail is logged only outside production.

## Audit

Audit entries record:

- workflow creation, edits, submission, approval (with `selfApproved`), activation, pausing (including system pauses with a reason) and archiving;
- manual run requests;
- approval requests, decisions and results;
- work task creation and completion;
- assignments made by workflows (with the execution and approval IDs).

## Tests

| Layer | File |
| --- | --- |
| Unit | `tests/automations.test.ts`: allowlists, conditions, policy, scheduling, IDs, templates, Claude mapping and prompt-injection fixtures |
| Emulator integration | `tests/sql-connect-automations.cases.mjs` |
| Browser end-to-end | `tests/automations-e2e.browser.mjs` (`npm run test:automations:e2e`) |
