# Workflow approvals (Phase 6E)

Some workflow steps wait for a person:

- `lead.reassign` is MEDIUM risk and always waits for approval of the exact change.
- `approval.request` waits for approval to continue.

The rules are enforced in the database operations (`dataconnect/connector/approvals.gql`) and in `server/approvals.ts`, and explained in the UI (`/approvals`).

## Lifecycle

1. **Request.** When the engine reaches the step (and its condition holds), it works out the exact change. For a reassignment that is the lead, its current agent and the proposed agent: the named agent, or the next agent by the approved distribution rule.
2. **Record.** `RequestAutomationApproval` records, in one transaction fenced by the job's claim:
   - the approval: a snapshot of the change, its SHA-256 hash, and a hash of the lead's assignment and status;
   - the waiting step and execution;
   - the job, parked until the approval expires (15 minutes to 7 days; default 24 hours);
   - an in-app notification to owners and administrators;
   - an audit entry.
3. **Decide.** `DecideAutomationApproval` is a single compare-and-set: only one decision can ever win. It checks, in the same transaction:
   - the approver is an active OWNER, ADMIN or MANAGER, and reassignments (`lead.reassign`, `inbox.reassign`) need OWNER or ADMIN;
   - **separation of duties:** the workflow's executor, on whose behalf the step was requested, cannot approve it unless they are an OWNER (so a single-owner company can operate), in which case the audit log records `selfApproved: true`;
   - the approval is still pending and unexpired;
   - the approver saw the stored snapshot (its hash is sent with the decision);
   - the lead's state, read by the server just before, still matches the request.

   The decision then wakes the job.
4. **Stale target.** If the lead changed before the decision (for example a person reassigned it), the server closes the approval (`EXPIRED`, `TARGET_CHANGED`) and tells the approver. The worker then requests a fresh approval for the lead's current state, at most 3 rounds.
5. **Apply.** On approval, the worker applies exactly the approved change as the executor. `AutomationReassignLead` checks again that:
   - the lead still has the agent it had at request time;
   - the approved agent is still an active agent;
   - the approval is still `APPROVED` for this lead and agent.

   It then marks the approval `EXECUTED` in the same transaction and records assignment history, activity, audit and a notification to the new agent. If the lead changed in between, nothing is applied and the step fails with `AUTOMATION_TARGET_CHANGED`.
   Conversation reassignments (`inbox.reassign`, 7A.5) follow the same steps. The state hash covers the conversation's assignee and status, and `AutomationReassignConversation` checks the conversation's current assignee and the approval before moving only the conversation. The linked lead keeps its agent.
6. **Reject or expire.** A rejection (reason required) or an expiry ends the execution as `CANCELLED` (`APPROVAL_REJECTED` or `APPROVAL_EXPIRED`) without changing anything.

Approval statuses: `PENDING`, `APPROVED`, `REJECTED`, `EXPIRED`, `CANCELLED`, `EXECUTED`. `resultStatus` and `resultErrorCode` record what happened afterwards.

## UI

`/approvals` has pending and history tabs. Each card shows:

- the action, its risk, the workflow and version, the triggering event and when it was requested;
- the lead, and the proposed change (from → to);
- the reason and the expiry;
- once decided: the decision, the approver and the result.

Approve and reject are offered only when the member may decide; the server checks again. The navigation shows the number of approvals the member can decide.

## Who sees what

| Role | List | Decide |
| --- | --- | --- |
| OWNER, ADMIN | All approvals | All, except an ADMIN's own requests |
| MANAGER | `approval.request` steps only | `approval.request` steps |
| AGENT | No | No |

Another company's approvals are never listed or decidable: every operation is scoped to the server-resolved company.
