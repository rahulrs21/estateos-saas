# EstateOS Leads module

The Leads module uses Firebase SQL Connect stored operations and the generated Admin Node SDK. Live pages never substitute fixture records for an unavailable database. The application is not production-ready: hosted migrations, real-project/IAM validation, operational release checks and the remaining organization workflows still need review.

## Pages and behavior

- `/workspace/leads` lists the selected organization's permitted leads, with server-side contact search, status/assignment/branch/follow-up filters and bounded pagination.
- `/workspace/leads/new` creates a lead using validated contact details, source, branch and assignment.
- `/workspace/leads/[leadId]` displays contact details, the five-stage status pipeline, assignment, follow-up and the lead's activity timeline.
- `/workspace/leads/[leadId]/edit` edits the lead's contact and reference fields. Status, assignment, notes and follow-up also have dedicated operations.

The allowed statuses are `NEW`, `CONTACTED`, `QUALIFIED`, `CONVERTED` and `LOST`. These are CRM labels; converting a lead does not create a deal or contact. Notes are append-only activity entries. A lead has one optional upcoming follow-up timestamp and note; scheduling replaces that current follow-up and completing it clears the current schedule while retaining the timeline event. No notification, calendar integration or message delivery is implied.

Loading, missing organization/profile, empty list, no matching results, success, forbidden/unavailable and provider error states are explicit. A successful mutation is displayed only after SQL Connect confirms it. Database outages and missing configuration produce recoverable errors, never dummy lead data.

## Authorization and request boundaries

Every protected page requires a verified Firebase session. Every data request independently resolves the profile's selected organization and checks current `ACTIVE` database membership. A submitted organization identifier can be used only as a consistency check against that server context; it never grants scope. Membership roles and record ownership come from the database, not hidden form fields, local storage or Firebase custom role claims.

| Operation | OWNER / ADMIN / MANAGER | AGENT |
| --- | --- | --- |
| List and read leads | All leads in the selected organization | Leads assigned to their own active membership |
| Create leads | May select an active membership or leave unassigned | Must be assigned to themselves |
| Edit contact details, status, notes or follow-up | Permitted organization leads | Their own assigned leads |
| Change assignment | Active memberships in the same organization, or unassigned | Dedicated assignment operation unavailable; contact edits must preserve their own assignment |
| Read activity | A permitted lead's timeline | Their own permitted lead's timeline |

The existing schema has no team entity or approved sharing model. A manager's permitted team is therefore the organization; managers have organization-wide lead access. Branch filters organize records and do not restrict managerial access. An unassigned lead is private from agents. There is no implicit sharing through an old assignment or an activity record.

SQL Connect checks the verified identity, active membership, tenant key, existing lead access, role and active same-tenant references independently of the UI. All new operations carry explicit authorization. Mutation transactions lock the authorizing membership and affected lead, validate references and write their audit event atomically. A failed authorization, invalid assignment or invalid status must leave both the record and timeline unchanged. Notes and follow-up text are private CRM data; do not copy them to diagnostic logs or generic audit metadata.

Cookie-authenticated HTTP mutations require the configured exact application origin, the existing CSRF cookie/header pair, JSON content type, a bounded request body and strict Zod input validation. Provider failures are mapped to safe application errors. The generated Admin SDK is imported only by server modules, and ordinary operations always use verified-session impersonation.

## Schema and migration

This module extends the existing six-table schema. It does not add a second ORM or database:

- Nullable `Lead.followUpAt` and `Lead.followUpNote` columns preserve existing lead rows without fabricated values.
- Nullable `Activity.note` stores bounded user-authored lead notes separately from audit metadata.
- Additional `ActivityKind` values identify status, assignment, note and follow-up events.
- Lead follow-up and filtering indexes are declared in `schema.gql` and compiled by SQL Connect.
- Tenant composite keys and foreign keys remain the source of relationship isolation.

Local validation and generated code must move together:

```powershell
npm.cmd run sql:validate
npm.cmd run sql:generate
npm.cmd test
npm.cmd run test:dataconnect
npm.cmd run lint
npx.cmd tsc --noEmit
npm.cmd run build
```

The emulator suite seeds only a disposable loopback `demo-estateos` database. Its synthetic contacts are test fixtures, not application fallback data. It refuses production mode, remote hosts and non-demo project IDs. Do not run seed/reset commands against hosted resources or while preserving emulator data.

No hosted migration or deployment is performed as part of this module. Before a future authorized deployment, follow the backup, reviewed diff, `COMPATIBLE` migration, matching connector/SDK rollout and staging checks in [SQL Connect](SQL_CONNECT.md#future-hosted-migration-separate-approval-required). Verify the proposed DDL adds nullable follow-up/note fields and declared indexes without dropping populated tables or columns. Review enum changes with the generated PostgreSQL schema. Existing rows need no contact-data backfill. Deploy the schema/connector before the matching server application; keep older operations compatible for any application instances still running. A database backup remains necessary even for additive changes. Rollback the application/connector only while keeping the added nullable columns compatible; do not drop notes or follow-up history to roll back UI code.

## Automated and manual acceptance

Unit tests cover strict validation, rejected client authority fields, UUID references, enumerated statuses, bounded filters/pagination, notes and follow-up dates. Emulator integration tests invoke the actual generated SDK with impersonated synthetic identities and verify:

- Organization A cannot read, modify, assign, annotate or schedule Organization B's leads or inspect their timeline.
- Agents cannot access another agent's lead or an unassigned private lead, even by submitting their own membership ID to claim it.
- Managers can access permitted organization leads and their timelines without receiving administrator membership capabilities.
- Pending, suspended, revoked and foreign-organization assignees are rejected, as are nonexistent branches and unknown statuses.
- Search, filters, stable pagination and totals operate on authorized database records.
- Successful note, pipeline, assignment and follow-up writes persist and emit the correct verified actor's activity; rejected writes do not emit success events.

For browser testing, use a Firebase development project with valid browser and server configuration and a reviewed SQL Connect development target. Prepare verified development identities with active memberships using the existing authorized organization/invitation services. Signing up alone does not create a profile, company or elevated role. The local test fixture UIDs do not automatically create Firebase Authentication accounts, and must never become default application administrators.

1. Sign in with a verified member and open `/workspace/leads`. Confirm the active organization, loading state, empty state and configuration errors are honest.
2. Create a lead, then search by name/email/phone and combine status, assignee, branch and follow-up filters. Move between pages and clear filters; confirm totals and page contents match persisted records.
3. Open the detail and edit pages directly. Change contact details, status and permitted assignment; reload and verify persistence and timeline events. Check labels, keyboard focus, light/dark themes and narrow/mobile screens.
4. Add a note, schedule a future follow-up, replace it, then complete it. Confirm the current schedule clears and the historical events remain. Invalid text/date submissions must show errors without a success message.
5. Repeat with an agent, manager and member of a separate company. Try direct foreign lead URLs and API requests; an agent must not see another member's private contact details, notes or follow-up. Revoking membership must prevent the next request despite an existing session or selected company.
6. Sign out and revisit list, new, detail and edit URLs. Confirm protected rendering redirects to login and unauthenticated operations fail. Missing origin/CSRF and invalid JSON/body inputs must be rejected by mutation endpoints.
7. Disconnect the development emulator/service and retry a read/write. Confirm the UI reports an error and does not fabricate leads, activity or a successful save.

## Remaining limits

Organization onboarding, invitation delivery, branch/member administration and complete company lifecycle interfaces remain separate work. More granular team/branch sharing, deduplication/import/export, bulk distribution, attachments, deletion/retention, independent audit archival, reminders and notifications are not part of this module. Search is a bounded, case-insensitive SQL substring match and does not provide fuzzy/full-text ranking. Pagination is bounded and offset-based; large datasets require a separately reviewed cursor/search strategy. Branch and active-assignee choices currently show the first 100 matching records; an existing lead's current assignee is retained for display if outside that page. This does not make an inactive assignee valid: a manager must choose an active assignee or unassign before saving that reference. Larger organizations need paginated searchable choice controls. Concurrent edits can conflict and should be retried after refreshing the record. Hosted IAM, regional data residency, monitoring, backup/restore and privacy checks remain release requirements.
