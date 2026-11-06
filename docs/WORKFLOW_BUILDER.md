# Workflow builder (Phase 6E)

Members build workflows visually, from a template, from blank, or from a Claude proposal. Every route below re-checks the session and company on the server. See [Engine](AUTOMATION_ENGINE.md) for the definition format.

## Pages

| Route | Purpose |
| --- | --- |
| `/automations` | Dashboard: workflows, executions and average duration from stored data (last 30 days), most-triggered workflows, the workflow list with a status filter, and execution history with filters (workflow, status, agent, date, trigger) and step details |
| `/automations/new` | Describe it to Claude, start from templates A–F, or start blank. Nothing is saved until the editor saves a draft |
| `/automations/[id]` | The read-only graph, status actions allowed for the member's role, versions, a dry-run tester, "Run now" for manual workflows and the workflow's execution history |
| `/automations/[id]/edit` | The visual editor. Saving creates a new draft version |
| `/approvals` | Pending and decided approvals ([details](WORKFLOW_APPROVALS.md)) |
| `/workspace/tasks` | My tasks: open follow-ups and work tasks, plus the team queue for managers |

## Editor

- **Graph:** a vertical graph (`TRIGGER → CONDITION → ACTION → DELAY → …`) built from the existing UI components. Branches are per-step conditions, so the flow stays linear; React Flow was not needed.
- **Selecting:** each node is a button; selecting one opens its settings beside the graph.
- **Settings by node:**
  - the trigger: name, description, timezone, schedule, business and quiet hours;
  - the start conditions;
  - a step's typed fields and its "Only when" condition.
- **Editing steps:** add, delete and reorder steps with the buttons on each step, or with Alt+↑ and Alt+↓ while a step has focus.
- **Validation:** the same Zod schema as the server validates the definition live. Problems are listed above the graph, steps with problems are outlined, and "Save draft" stays disabled until it is valid. The server validates again and also checks that reassignment targets are active agents of the company.
- **Dry-run tester:** evaluates the definition against synthetic facts with the engine's own condition and hours functions. It touches no database and has no side effects; it shows which steps would run, be skipped, or wait for allowed hours.
- **Phones:** a read-only graph; editing needs a tablet or computer.

## Templates

Templates live in `templates.ts`. Each is an ordinary definition with safe defaults and no external action; using one creates a draft in the member's company.

| Key | Template | Trigger | Steps |
| --- | --- | --- | --- |
| A | New lead assignment | `lead.created` | Distribute with the approved rule → notify the agent → first-call follow-up |
| B | Uncontacted lead escalation | `lead.assigned` | Wait 4 hours → notify managers only if the lead is active, uncontacted and has no completed follow-up |
| C | Viewing follow-up | `viewing.completed` | Follow-up → editable WhatsApp draft (Claude, never sent) |
| D | New property listing | `listing.created` | Notify managers → review task in the team queue |
| E | Overdue follow-ups | `lead.followup_due` (pending) | Remind the agent → wait a day → notify managers if still open; quiet hours 21:00–08:00 |
| F | AI sales review | `workflow.manual` | AI sales analysis → note on the lead |
| G | Missed call follow-up | `call.missed` | Call-back follow-up due in 30 minutes → notify the agent |
| H | Summarise answered calls | `call.completed` | Wait 30 minutes for notes → Claude call summary (needs Claude call analysis and an owner or administrator as executor) |
| I | Meeting follow-up | `meeting.completed` | Follow-up for the next day |
| J | Unanswered inbox conversation | `inbox.conversation.unanswered` (unanswered, not opted out) | Notify the assignee → notify managers → reply task for the assignee (nothing is sent to the customer) |

## Claude workflow drafts

`POST /api/automations/generate` (`server/generate.ts`, `ai.ts`) turns a plain-language description into a proposal for the editor.

**Pipeline:**
1. Role check: every role can draft.
2. Input validation: 10–2,000 characters.
3. Rate limits per member, IP and company.
4. The monthly AI allowance (`reserveQuota`).
5. One structured-output request through the shared `generateStructured`.
6. Mapping onto the allowlists.
7. One `AiUsageRecord` with feature `AUTOMATION`.

**What Claude sees:** the catalog of triggers, facts, operators, actions and placeholders, and the description wrapped as `<staff_request>` (data, not instructions). Claude receives no CRM records.

**How the proposal is handled:**
- Unknown actions, conditions on unavailable facts, wrongly typed values and the parts of the request Claude could not fulfil are listed to the member. They are never silently kept.
- Links, contact details, markup and unknown placeholders are removed from text, and the removal is reported.
- Risk and approval needs come from the registry; Claude's text has no effect on them.
- The proposal opens in the editor. It is not saved, approved or activated; saving it creates an ordinary draft.

## API

| Method and path | Who |
| --- | --- |
| `GET /api/automations` | All roles (agents see only their own workflows) |
| `POST /api/automations` | All roles (draft) |
| `GET`, `PUT /api/automations/{id}` | As above; editing per the permissions returned |
| `POST /api/automations/{id}/transition` | `submit`, `return`, `approve`, `activate`, `pause`, `archive` with `expectedRevision` |
| `POST /api/automations/{id}/run` | OWNER, ADMIN, MANAGER; idempotent per `requestId` |
| `POST /api/automations/generate` | All roles; uses the AI allowance |
| `GET /api/automations/executions`, `/executions/{id}`, `/metrics` | OWNER, ADMIN, MANAGER |
| `GET /api/approvals`, `POST /api/approvals/{id}/decide` | OWNER, ADMIN, MANAGER ([rules](WORKFLOW_APPROVALS.md)) |
| `GET /api/tasks`, `POST /api/tasks/work/{id}/complete` | All roles (own tasks; managers also the team queue) |
| `POST /api/internal/automations/tick` | The worker only ([operations](AUTOMATION_OPERATIONS.md)) |

Mutations need same-origin, the CSRF token and an `X-EstateOS-Organization` header matching the server-resolved company. A mismatched header returns `409 ORGANIZATION_CHANGED`.

## Tasks

Lead follow-ups keep using `LeadFollowUp`, shown in lead detail as before. Work tasks for other records (for example a listing review) use the new `WorkTask` table. Completing either emits `task.completed`.
