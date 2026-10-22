# EstateOS Leads CRM

The Leads interface uses the existing verified Firebase session, selected company membership and SQL Connect operations. Pages never substitute demonstration records when the database is unavailable. The dashboard, authentication and company/team modules retain their existing design and responsibilities.

## Routes and views

- `/leads` is the primary Leads route. It provides authorized KPI counts, search, status/agent/source/priority/date filters, sorting, bounded server pagination and List/Kanban views.
- `/leads/[leadId]` displays the customer, property requirements, assignment, pipeline, activity/notes and follow-up history. The AI lead score is explicitly unavailable and disabled.
- Create and edit actions open responsive dialogs using the same validated editor as the direct `/leads/new` and `/leads/[leadId]/edit` routes.
- Existing `/workspace/leads` links remain compatible with the primary routes.

The editor captures name, phone/email, source, project or property interest, location, property/transaction type, budget/currency, bedrooms, priority and permitted assignment. Creation also accepts initial notes and a next follow-up. A project/property interest is descriptive text; this phase does not create future property/project records or pretend to provide those integrations.

Filters, sorting, view and pagination are represented in the URL. Applying filters starts at the first page, and pagination preserves the selected view. KPIs count all accessible active leads independently of list filters; Won includes legacy Converted records. Sorting supports newest/oldest creation, most recently updated, name in either direction and next follow-up. Date range inputs are inclusive UTC calendar days (`YYYY-MM-DD`), including the entire end date.

Empty results, first-use empty states, loading skeletons, invalid inputs, unavailable records and provider failures have separate feedback. Successful writes appear only after the server confirms them. Possible duplicate contacts and ambiguous phone formats produce warnings without automatic merging.

Kanban displays the current server-paginated result page and labels that boundary explicitly; column counts are not presented as whole-company totals. Columns come from the company's configured pipeline stages. Legacy leads without a stage are kept visible rather than assigned fabricated history. Permitted open leads can move within their own pipeline using drag-and-drop or a labeled stage selector. Stage writes use the existing transaction and history operations. An optimistic card movement is rolled back after a server rejection. Won/Lost and legacy Converted leads remain terminal under the current backend policy. Reloading the view reads the persisted database state.

Timestamps are stored as UTC. User-entered follow-up dates and displayed timestamps use Dubai time (UTC+4). Follow-ups are independent records with Pending/Completed/Cancelled history; the lead's next-follow-up field is a projection of the earliest pending item. Completing a follow-up retains its historical record. Scheduling does not send email, calendar or push reminders.

## Authorization

Every UI route verifies the Firebase session and resolves the selected organization on the server. Every API request independently checks the current database membership and permitted record. The consistency header sent by the browser cannot select an unauthorized organization or grant a role.

| Capability | OWNER / ADMIN | MANAGER / AGENT |
| --- | --- | --- |
| List, search, KPI counts and read details | Permitted company-wide records | Own assigned records |
| Create leads | Assign an active company member or leave unassigned | Assigned to the acting member |
| Edit, add notes, change open pipeline stage and schedule follow-ups | Permitted company records | Own assigned records, subject to contact sharing restrictions |
| Change assignment or archive | Permitted company records | Unavailable |
| Read another company's lead/contact/history | Denied | Denied |

There is no verified team/branch sharing relationship yet, so managers do not receive invented access to unrelated leads. A previous assignment, activity entry or contact creator does not retain access after the lead is reassigned. Editing a contact shared with a lead outside the actor's scope is restricted by the connector. Hidden UI controls are a convenience; the SQL Connect authorization checks and server policies enforce the boundary.

Mutation requests retain exact-origin checks, CSRF protection, bounded JSON, strict Zod validation and the stale-company guard. Ordinary generated Admin SDK calls use the verified user's impersonated identity. Sensitive changes, assignment/stage histories and audit events remain atomic where defined by the Phase 4A operations. The UI cannot write arbitrary activity kinds, actor IDs or privileged roles.

## Validation and test commands

Run from the project directory:

```powershell
npm.cmd run lint
npx.cmd tsc --noEmit
npm.cmd test
npm.cmd run sql:validate
npm.cmd run test:dataconnect
node scripts/test-leads-ui.mjs
npm.cmd run build
```

The unit/policy suite verifies strict inputs, authority-field rejection, dates, budgets, references, request boundaries and organization/assignment permissions. SQL Connect integration tests use the actual generated SDK against a disposable loopback `demo-estateos` PostgreSQL emulator. They cover company isolation, private assignment scope, invalid references/stage changes, real filters/pagination, notes and follow-up persistence, assignment/history and transactional rollback. These tests refuse remote/non-demo database targets. Do not run fixture reset commands against a database whose records must be preserved.

The browser suite opens Chrome/Edge in a new isolated profile and mounts the real Leads components in a temporary loopback Next.js app. Its synthetic records and controlled HTTP responses exist only in that test process. It checks real form interaction and validation, rich-field request payloads, server-error feedback, detail/edit/note rendering, pagination/filter navigation, optimistic Kanban rollback and mobile/dialog behavior. It neither imports production authentication handlers nor claims to test a real Firebase login. Actual authorization and database persistence are established by the SQL emulator suite, with live project authentication requiring the separate checks in [AUTHENTICATION.md](AUTHENTICATION.md). Set `ESTATEOS_TEST_BROWSER` to a Chromium executable when it is outside the standard Chrome/Edge paths.

## Manual acceptance

Use a Firebase development project with the existing browser/server authentication configuration and an explicitly selected SQL Connect development target. Prepare verified development users through the existing company and invitation workflows; signup alone never grants an elevated role.

1. Sign in as the owner, open `/leads`, and confirm the company name and honest empty state or actual lead counts. Create a lead with property requirements, an initial note and a future follow-up. Open its detail and reload to verify persistence.
2. Edit the lead, add another note, change an open stage and permitted assignment, then schedule and complete a follow-up. Check the timeline/history after reload. No reminder delivery or AI score should be claimed.
3. Combine name/email/phone search with source, priority, agent, status and date filters. Change sorting and page size, move between pages, and switch List/Kanban. Verify the URL preserves the requested view and the board explains its page boundary.
4. Move a card with drag-and-drop and the keyboard-accessible stage selector. Reload to verify persistence. Disconnect the development backend and retry a move/save; expect a visible error and card rollback without fabricated success.
5. Repeat as an agent/manager and a user from a second company. Direct foreign detail/API URLs must be denied. An agent must not see another agent's private lead, contact, notes, totals or follow-ups, or gain assignment privileges by editing a browser request. Revoking membership must prevent the next request.
6. Sign out and revisit list/new/detail/edit routes. Expect login redirects for pages and 401 from protected APIs. Check keyboard focus, dialog Escape/focus return, mobile width, dark/light themes, empty filters and unavailable records.

## Rollout and remaining limits

This UI phase does not deploy or change paid infrastructure. Apply the reviewed Phase 4A schema/connector migration and any legacy contact/stage backfill before releasing the matching application; see [DATABASE.md](DATABASE.md) and [SQL_CONNECT.md](SQL_CONNECT.md). Existing nullable legacy references are compatibility measures, not permission for new unlinked records. Never edit generated implicit GraphQL files by hand.

Pipeline customization, explicit team sharing, bulk imports/distribution, fuzzy duplicate merge, attachments, reminder delivery, external advertising/messaging/property integrations and AI scores remain separate work. Search is bounded SQL substring matching and pagination is offset-based, with a maximum offset of 10,000. Choice lists are bounded; larger companies need searchable choice controls. Hosted IAM, staging, accessibility, HTTPS/session, data residency, backup/restore, privacy and monitoring review remain release requirements; this implementation is not a declaration of production readiness.
