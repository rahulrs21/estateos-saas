# EstateOS architecture

EstateOS is planned as a multi-tenant real estate CRM for UAE agencies. The shell, Firebase authentication, SQL Connect tenant services and Leads are connected. Phase 3 adds company onboarding, settings and workspace selection, preserving dashboard design and tenant authorization. Team management and secure email invitations are connected. More granular sharing and operational release checks remain future work. It is not a production-ready CRM.

## Current implementation: shell, identity and tenant services

- Next.js App Router, strict TypeScript, Tailwind CSS, existing shadcn/ui primitives, and Lucide icons.
- Public homepage, login, sign-up, email verification and password-reset interfaces, plus a protected workspace with responsive navigation.
- Firebase Email/Password authentication using in-memory browser state and server-issued, expiring HttpOnly session cookies.
- Server-only Firebase Admin initialization and shared identity checks for protected rendering and API operations.
- Dashboard components use explicit empty states. KPI values and chart placeholders do not represent business records.
- Every navigation destination has an implemented interface or an explicit unconnected module page.
- Light/dark theme preference is presentation-only and uses `next-themes`.
- Shared headers, empty states, loading views, error boundaries, and a not-found view.
- SQL Connect/PostgreSQL models for organizations, user profiles, memberships, branches, invitations, security audit logs, leads and activities.
- Tenant-scoped, explicitly authorized queries/mutations and generated Admin SDK calls impersonating a verified Firebase session identity.
- Server-only organization creation/selection, invitation and membership administration, branch, lead and activity services with validated inputs and transactional audit events.
- Connected Leads search/filter/pagination, create/edit/detail forms, status pipeline, active-member assignment, append-only notes, follow-up and an authorized activity timeline.

`/workspace` requires a verified Firebase session and active selected company membership. New users go to onboarding; existing members without a valid selection choose an authorized company. Invalid, expired and revoked sessions fail closed. Services independently recheck membership and record authorization. Branch administration UI, billing and marketing/communication integrations remain unimplemented; the read-only AI Copilot is described in the Phase 6A section. See [Onboarding](ONBOARDING.md) for the connected setup/settings flow.

## Source organization

```text
src/
  app/
    (public)/page.tsx        Public homepage at /
    (auth)/
      login/                 Firebase login at /login
      signup/                Account registration at /signup
      forgot-password/       Password reset email
      verify-email/          Verification guidance and controls
    api/auth/                CSRF and verified session route handlers
    api/leads/               Session/origin/CSRF-protected lead HTTP boundary
    api/organizations/       Protected company creation/settings/switch boundary
    api/team/, api/invitations/ Protected team writes and invitation acceptance
    (onboarding)/onboarding/company/ Verified-user setup and company chooser
    (company)/settings/company/ Company settings using the existing workspace shell
    (workspace)/workspace/   Protected shell; retains /workspace URL prefix
      dashboard/             Dashboard composed from empty-state panels
      leads/                 Connected list/new/detail/edit lead routes
      contacts/, ...         Explicit routes for remaining module placeholders
  components/
    layout/                  Application shell and navigation
    shared/                  Headers, empty states, and reusable presentation
    ui/                      shadcn/ui primitives
  config/
    navigation.ts            Typed navigation and module route catalog
  modules/
    auth/                    Auth UI, client flows and server session policy
    organizations/           Company UI/validation, tenant services, scope and permissions
    leads/                   Shared Zod schemas, UI and server-only services
    ...                      Feature-specific components
  lib/
    auth/session.ts          Shared verified-session access and route protection
    firebase/                Separate browser and server-only Admin SDK setup
    ...                      Shared utilities
  dataconnect-admin-generated/ Generated server SDK, not handwritten domain code
docs/
  ARCHITECTURE.md
  AUTHENTICATION.md
  SQL_CONNECT.md
  MULTI_TENANCY.md
  ONBOARDING.md
  TEAM.md
  DATABASE.md
  PERMISSIONS.md
  LEADS.md
  ROADMAP.md
dataconnect/
  schema/schema.gql          Relational CRM models and tenant constraints
  connector/                Authorized operations and Admin SDK generation
  seed_data.gql             Emulator fixtures, excluded from deployed connector
```

Route groups organize source files without changing URLs. Keep the top-level root layout, global error/loading views, stylesheet and application icons in `app/`. The workspace's authorization layout stays inside `(workspace)/workspace/`. Grouping routes does not provide authentication or authorization by itself.

The navigation catalog is the single source for sidebar links and module descriptions. Dashboard has its own route. Leads has explicit list/new routes and UUID detail/edit routes. Remaining planned modules render `modules/workspace/components/module-preview.tsx` using the catalog. Unknown module paths return a 404. Route-level loading/error states handle rendering transitions and failures; they do not imply a connected backend. Request-dependent Leads rendering sits inside destination-local Suspense boundaries, preserving uncached identity and instant-navigation behavior.

Modules own their UI, types, validation and server services. Shared Firebase infrastructure stays in `lib/firebase`, and verified session access in `lib/auth/session.ts`; authentication policy and organization permission rules stay with their owning modules. Add shared `lib/permissions`, `lib/validation` or `types` files when there is code to share. Agent/property domain modules will be introduced when their functionality is implemented; their current navigation destinations remain explicit placeholders. Do not create parallel implementations or empty module scaffolding just to match a proposed tree.

The SQL Connect directory is named `connector`, while connector ID `example` preserves existing SDK/service identity. Company onboarding adds nullable company fields and an authorized update operation; no hosted resources are changed. See [Database](DATABASE.md), [Permissions](PERMISSIONS.md) and [Onboarding](ONBOARDING.md).

## Target architecture

Begin with a modular monolith. Keep domain behavior in feature modules rather than page components. Introduce each layer only when its feature is implemented:

```text
modules/<module>/
  components/                Feature UI and view models
  validation/                Schemas for untrusted input
  server/
    service.ts               Business rules and authorized use cases
    repository.ts            Organization-scoped data access
  tests/                     Business rules and permission coverage
```

App Router pages and server actions/route handlers should coordinate requests. Validation accepts only documented inputs. Services enforce business rules and permissions. Repositories own database queries and receive a verified organization scope. Client components are reserved for interaction; credentials and protected data access remain in server-only modules. Avoid browser imports of privileged modules.

Firebase Authentication is connected when valid development-project configuration is supplied. Firebase SQL Connect with PostgreSQL now supplies the first relational models and server services; Firebase Storage and Firebase App Hosting remain planned. The Phase 6A AI Copilot, the Phase 6B AI Content Studio and Phase 6C sales intelligence use Anthropic Claude (Messages API, official TypeScript SDK) from server-only code; no other AI provider is used. Cloud provisioning or deployment requires separate approval.

## Implemented identity boundary

Browser Firebase credentials are held in memory. A recently authenticated, verified password account exchanges an ID token for a five-day HttpOnly session. The Admin SDK verifies sessions, including revocation, in server-only code. Session mutations require an exact configured origin and CSRF cookie/header pair; production uses HTTPS and `__Host-` cookies. Logout clears the local cookie and revokes the user's Firebase sessions across devices.

Protected rendering and the session API use a common server identity helper. Checks at the workspace layout and page/component boundary avoid treating client navigation state or a shared layout alone as authorization. Missing provider configuration fails closed. No default admin, client-supplied role, or mock authenticated identity exists.

Request-time session checks render inside local `Suspense` boundaries in the shared module view, dashboard, workspace redirect, and workspace not-found view. The layout's boundary handles initial shell rendering; destination-level boundaries handle navigation between siblings below that persistent layout. Their fallbacks contain only deterministic skeleton UI. Session verification remains uncached across requests; do not add `use cache` to authentication checks or disable instant-navigation validation to hide a missing boundary.

See [Authentication](AUTHENTICATION.md) for environment setup, endpoint behavior, cookie policy, manual checks, and the current limitations.

## Tenant scope and permissions

Verified Firebase identity is the first boundary. The organization service boundary resolves the selected organization and active membership from trusted data, checks membership status, and derives the actor and organization context. A requested organization switch must pass an active-membership check; the selected profile field is a preference, not a grant. Every subsequent data operation rechecks active membership. Never accept client-provided roles or organization IDs as authority.

Use one common authorization mechanism across protected pages, server actions, route handlers, background jobs, and data access. Check capabilities at the operation boundary and enforce record visibility in queries, including reads, updates, deletes, search, counts, reports, storage access, and exports. A layout guard alone is insufficient to secure a directly invoked mutation or API endpoint. Authorization should default to deny.

Roles are `OWNER`, `ADMIN`, `MANAGER` and `AGENT`. A dedicated transaction creates a new organization and fixed active owner together. Existing-organization ownership cannot be self-assigned. Owners may administer non-owner memberships; administrators may manage only managers and agents. Self role/status edits and owner changes are unavailable. Invitation acceptance requires the matching verified email, unexpired single-use token, and current issuer authority. New acceptance activates and selects the company atomically; legacy PENDING records retain their approval workflow. See [SQL Connect](SQL_CONNECT.md) for the permission matrix, lifecycle and test runbook.

Current lead permissions grant organization-wide access to active owners and administrators. Active agents and managers can create/read/update only leads assigned to themselves; no team or branch membership ACL exists yet. The connector repeats this restriction for direct operation calls. Branch visibility and approved sharing remain future work; assigning a branch does not establish a branch ACL. Platform administration requires a separately verified privileged context, not a client flag.

Tenant-owned primary keys include organization plus UUID. Composite branch, assignee, invitation and lead foreign keys reuse that organization identifier to reject cross-tenant relationships in PostgreSQL. Queries and mutations require explicit authorization; sensitive checks are redacted. Transactional writes use server timestamps and append their `Activity` timeline and separate `AuditLog` events atomically. The generated SDK is called with verified identity impersonation for normal service operations; raw unrestricted GraphQL remains confined to loopback fixtures/constraint tests. RecordInvitationDelivery is a separate NO_ACCESS stored operation called only by server delivery code with independently checked actor/tenant/issuer/digest binding; clients cannot write delivery receipts. See [Team](TEAM.md).

## Connected Leads boundary

Leads pages obtain private records through the shared server service, never through a browser Admin SDK or a dummy-data fallback. Search, filters, counts and pagination run in SQL Connect with the same tenant and record restrictions. The UI uses shared Zod schemas for useful feedback; the server validates again before every generated-SDK call. Status and assignment operations inspect the existing lead so changing a request's assignee cannot claim a private record.

Cookie-authenticated HTTP writes independently verify the session and exact configured origin/CSRF pair. They accept at most 16 KiB of JSON object data, enforce strict schemas and compare `x-estateos-organization` against the server-resolved selection to reject a stale form after company switching. That header is a consistency guard and cannot establish tenant scope. Reads and writes are uncached across private request contexts; responses do not expose raw provider details.

Lead notes are append-only `Activity.note` values, returned only by a lead-specific authorized timeline. Generic audit metadata contains safe identifiers/state transitions. `Lead.followUpAt` and `followUpNote` retain the next-pending summary for the existing editor; Phase 4A stores independent follow-up records and schedules/completes them with transactional audit events. This creates no reminders, background jobs or external calendar calls. See [Leads](LEADS.md) for behavior, permission tests and additive migration steps.

## Data and security boundaries

- Include organization scope in tenant-owned entities and validate tenant consistency for relationships.
- Do not fetch records globally and filter them in the browser. Apply authorization before returning data.
- Use validated, bounded input for writes, pagination, search, filters, uploads, and exports.
- Protect sessions and mutation endpoints using the controls appropriate to the chosen session mechanism, including revocation and request-forgery protections.
- Keep privileged provider tokens and service credentials server-side; never expose secrets in `NEXT_PUBLIC_*` values or source control. Firebase web configuration is public project identification, not an Admin credential.
- Authorize file access and upload metadata against organization membership and record access.
- Record sensitive changes in audit logs with actor, organization, action, target, timestamp, and safe metadata; do not log secrets.
- Use explicit per-organization cache keys and invalidation. Do not share cached private data across tenants.
- Define retention, deletion, consent, and UAE-relevant compliance requirements before collecting customer data.

## Frontend principles

Prefer accessible semantic controls, visible focus indicators, labeled fields, and sufficient contrast. Support keyboard navigation, desktop sidebar collapse, mobile navigation, and narrow screens. Use restrained transitions and honor reduced-motion preferences. Theme persistence and sidebar state are convenience preferences, not session or security state.

Each feature must distinguish loading, empty, error, and populated states. A missing CRM backend is shown as not connected, not as fabricated success. Authentication forms transmit credentials only to the configured Firebase provider and exchange ID tokens with same-origin session handlers; they display real loading and failure states.

## Validation strategy

Run `npm test`, `npm run lint`, `npx tsc --noEmit`, and `npm run build`. Authentication boundary tests cover session/request policy without real cloud credentials; live provider behavior needs the development-project checks in [Authentication](AUTHENTICATION.md). Verify public routes, protected-route redirects, workspace destinations, 404 behavior, mobile navigation, keyboard controls, and both themes.

Tenant/Leads policy tests and SQL Connect emulator integration tests cover membership states, role restrictions, owner bootstrap, invitation boundaries, cross-tenant reads/writes, relationship constraints, private agent leads, permitted manager access, assignment/status rejection, note/follow-up/timeline authorization and real query pagination. Lead request tests cover strict inputs, stale-company guards and bounded streamed JSON. Run the integration suite separately as documented in [SQL Connect](SQL_CONNECT.md); authentication unit tests alone do not establish tenant isolation. Deployment readiness additionally requires staging integration, accessibility, HTTPS session, data migration, monitoring, recovery, privacy and operational checks.


## Phase 4A backend extension

The existing modular monolith and dashboard/authentication are retained. SQL Connect schema and stored operations define the new contact/pipeline/lead aggregate. src/modules/leads/crm-validation.ts and normalization.ts own shared strict inputs and conservative normalization; server/crm-service.ts handles contacts, metadata, stage changes, history, multiple follow-ups and archives. Existing server/service.ts preserves lead editor/create/status/assignment entry points. src/modules/leads/server/api-query.ts converts bounded URL filters before the same server-side query runs.

Contact email normalization preserves the mailbox local part, plus tags and dots while normalizing the domain. A separate connector-derived normalizedEmail supplies case-insensitive possible-match detection without modifying or merging uncertain identities. Explicit international/00-prefixed numbers and recognizable UAE national forms normalize to E.164 format. Ambiguous local numbers are retained and return a warning; this is not number reachability or full international numbering-plan validation. Candidate duplicates are returned with successful creation and can be queried first; the existing lead form displays duplicate/phone warnings alongside its success message. Matching is company/record scoped, exact email/phone based and limited to 25 candidates. No fuzzy-name matching or automatic merge occurs.

| HTTP boundary | Behavior |
| --- | --- |
| GET/POST /api/contacts | Search/paginate visible contacts; create a contact and return possibleDuplicates/warnings. |
| GET/PATCH /api/contacts/:contactId | Read a permitted contact; administrator full-record update and duplicate warning. |
| GET /api/contacts/duplicates | Exact candidate discovery by email, phone or alternatePhone, within permitted records. |
| GET/POST /api/leads/configuration | Read active pipelines/stages/sources; initialize only the fixed default metadata if missing. |
| GET/POST /api/leads | List/filter/search or create a lead using contactId, or atomically create a contact from legacy fullName/email/phone fields. |
| GET/PATCH /api/leads/:leadId | Existing detail and full-record editor, extended with rich CRM fields and canonical contact data. |
| POST /api/leads/:leadId/stage | Move using pipelineStageId after pipeline and state checks. |
| GET/POST /api/leads/:leadId/activities | Authorized history; add a description as a fixed note activity, never a caller-selected audit event. |
| GET/POST /api/leads/:leadId/follow-ups | Read bounded CRM history; create an independent follow-up using title, dueAt and optional assignedUserId. |
| POST /api/leads/:leadId/follow-ups/:followUpId/complete | Complete that pending record once and recompute the next-due summary. |
| POST /api/leads/:leadId/archive | Archive an active lead, preserve history and cancel pending follow-ups. |

Existing singular follow-up, notes, status and assignment routes remain compatible. The singular scheduling route replaces pending work as the old UI expects; plural follow-ups add independent records. Lead.followUpAt is now the next-pending-date projection rather than the only follow-up store. Activity is reused for LeadActivity, including structured stage history; the security AuditLog stays separate and excludes free-form contact/note text.

API list filters include search, status, branchId, assignedMembershipId, contactId, pipelineId, pipelineStageId, sourceId, priority, transactionType, followUp (ALL/OVERDUE/UPCOMING) and archive (ACTIVE/ARCHIVED/ALL). Use limit/offset (1..100 and 0..10000) or page/pageSize (10/25/50); mixed or unknown inputs are rejected. Counts use the identical tenant/record/filter predicates. Every write needs the existing exact-origin/CSRF pair and x-estateos-organization consistency header; that selector cannot grant tenant access. The helper rejects URL/body identifier conflicts and bounds JSON to 16 KiB. Optional rich fields omitted by the legacy editor are preserved; contact/reference fields keep the documented full-record semantics. Stage/contact/pipeline identifiers are validated again in SQL Connect.

This phase is a backend extension. Dedicated Contacts UI, rich lead forms/kanban, pipeline configuration UI/CRUD, custom sharing/team ACLs, cursor pagination/full-text search tuning, fuzzy duplicate review/merge, reminders, external-source imports and future project/property integration remain follow-up work. The current lead UI still works and recognizes all added statuses. No Meta Ads, WhatsApp, AI, listing, property portal or notification integration is introduced. See DATABASE.md for the reviewed legacy-data backfill prerequisites; schema nullability is additive compatibility, not permission to create unlinked new CRM leads.

Implementation follows the current Firebase guides for [schema relationships](https://firebase.google.com/docs/sql-connect/schemas-guide), [authorized operations, transactions and checks/redaction](https://firebase.google.com/docs/sql-connect/authorization-and-security), and verified-user Admin SDK impersonation. Local validation and generated SDKs use the installed official SQL Connect toolkit, without a second ORM or hand-edited generated schema.

## Phase 4B Leads interface

The primary routes are `/leads`, `/leads/new`, `/leads/[leadId]` and `/leads/[leadId]/edit`, with compatibility for existing `/workspace/leads` links. Server page loaders resolve the current authorized organization and return serializable records, membership-scoped KPI counts, configuration choices and bounded pagination. List filters and sorting run in SQL Connect rather than filtering a client-side copy of company data. KPI counts cover accessible active records independently of the chosen list filters, including legacy Converted records in Won. Date-range filters represent inclusive UTC calendar days.

The existing feature module supplies the reusable editor dialog, detail/timeline/follow-up components, responsive table and pipeline board. List and Kanban views share URL-backed filters and server pagination; the board explicitly identifies that it shows the current result page. Pipeline columns use configured company stages. Native drag-and-drop has an accessible stage-selector alternative, and optimistic moves roll back after failed stored-operation requests. Terminal stages and cross-pipeline transitions remain subject to the server/database rules.

The editor shares Zod validation with the server and uses the existing secure `leadRequest` helper. Initial notes and a follow-up are included in the lead-creation transaction, preventing partial success. Assignment controls follow trusted workspace capabilities; hiding controls never replaces authorization. The detail uses canonical contact fields, property requirements, real notes and independent follow-up history. The AI score is disabled. No advertising, messaging, reminder or property integration is introduced.

`scripts/test-leads-ui.mjs` mounts the real components in an isolated loopback Next.js fixture and drives Chrome/Edge with a clean browser profile. Synthetic records and controlled responses exist only in that temporary test process; it neither loads environment credentials nor adds a fake-auth route to the application. These tests establish component interaction, validation, errors, responsive dialogs and optimistic rollback. Real database writes, scope, cross-company denial and persistence are independently checked by the SQL Connect emulator suite. See [LEADS.md](LEADS.md) for commands, acceptance steps and rollout limitations.

## Phase 4C lead distribution

Lead assignment remains within the existing leads module. `src/modules/leads/distribution` contains Zod validation, eligibility/round-robin policy, the server service, settings UI, availability controls and in-app notification UI. API routes use the current authenticated organization context and secure write helper. SQL Connect mutations remain the transaction boundary for creating a lead, updating a distribution cursor, recording assignment/audit/activity, and inserting notifications.

The persistent cursor uses a monotonically increasing version checked and incremented in the lead-creation transaction. A stale concurrent request aborts before a partial lead is committed. The server retries with fresh eligibility/cursor data using a stable lead UUID, so a lost response does not create a second lead. Manual reassignments also compare the current assignment and update timestamp, preventing stale overwrites. See [Lead distribution](LEAD_DISTRIBUTION.md) for eligibility, settings and operational limitations.

## Phase 4D website capture and analytics

`src/modules/lead-capture` owns capture validation, the company form manager, public form UI, privileged server adapter and report aggregation adapter. `/settings/lead-forms` manages draft/active/disabled forms; `/forms/[publicId]` is the embeddable public surface; `/api/public/lead-forms/[publicId]` is the deliberately narrow submission boundary. `/workspace/reports` uses SQL Connect aggregate queries with validated local calendar filters. Capture is not a second database layer: SQL Connect/PostgreSQL remains the source of truth, with one transactional operation creating contact/lead/attribution/consent/activity/assignment/audit/notification records.

Ordinary company operations use authenticated user impersonation. Public form lookup, rate counter, exact candidate lookup and transactional submission are `NO_ACCESS` operations invoked only through server-only Firebase Admin SDK code after validating the random public ID and request. The server resolves organization/source/consent from stored active form configuration, never from caller fields. The API accepts no organization ID and never returns saved CRM records. Reporting data is server loaded and subject to the same active organization and lead visibility policy as CRM reads. See [Lead capture](LEAD_CAPTURE.md) for data flow, public abuse controls, reporting definitions, rollout and limitations.

## Phase 5A property inventory foundation

src/modules/inventory/validation.ts owns strict Zod inputs and bounded filters. src/modules/inventory/server/service.ts derives the active organization from the verified session, enforces write roles and listing assignment rules, and calls the generated SQL Connect Admin SDK only with existing verified-user impersonation request options. Route handlers under /api/inventory reuse the CRM HTTP wrapper for session, CSRF/origin, organization-consistency, bounded JSON and safe errors. No inventory data path runs in the browser or falls back to fixtures.

SQL Connect/PostgreSQL remains the only inventory persistence layer. Tenant-composite foreign keys bind developers, projects, phases, buildings, properties, listings, floor plans, payment plans, amenities and features to their organization. Physical Property rows are independent of PropertyListing advertisement rows; a standalone property requires no developer/project/building. Lead project/property references now use nullable same-tenant foreign keys. Available project units are derived from current property rows. Financial values are integer minor units and payment plan percentages are basis points.

Every catalog/inventory write and its audit/activity entries is a stored @transaction operation. The generated Admin SDK is invoked with the verified Firebase identity impersonated, not unrestricted Admin access. Inventory queries and mutations repeat organization membership predicates; Manager is denied until a verified branch/team inventory scope exists. Agents can read the developer/project reference catalog, but property details and listings require assignment to their active membership. Payment-plan creation is an intentionally staged inactive workflow: each installment/counter/audit write is atomic, and activation performs the final exact-percentage check. See DATABASE.md and PERMISSIONS.md for migration and role boundaries.

## Phase 5B developer and project management UI

The canonical inventory pages are `/developers` and `/projects`; their nested layouts reuse the protected WorkspaceShell. Legacy `/workspace/developers` and `/workspace/projects` destinations redirect to the canonical pages. Server-rendered list/detail pages use `src/modules/inventory/server/views.ts` and the existing tenant-aware service; create/edit forms call the protected `/api/inventory` routes with the same-origin CSRF helper. OWNER/ADMIN receive write controls, AGENT can read the company catalog, and MANAGER access stays denied until a trusted branch/team scope exists. The UI never chooses its organization or role from browser form values.

Project details load recorded phases, buildings, units, floor plans, payment plans, amenities, and project audit events. Project unit counts come from live non-archived Property rows, separate from the project's declared planned-unit count. Developer archive is a soft archive and its SQL Connect transaction rejects a developer that still has active projects. Marketing highlights use the existing `marketingDescription`; amenities use the existing project-amenity relation. Project brochure URLs are saved as references on Project; file upload and a general project document library are not configured. The Documents tab reports stored brochure, permit, and floor-plan media references and otherwise shows an explicit empty state. No external portal or storage integration was added. The query and schema changes require the matching connector operation rollout; no hosted deployment was performed.

## Phase 5C property inventory and marketing listings

`/properties` and `/listings` are server-rendered under the existing protected workspace shell. The inventory module keeps property CRUD, listing workflows, tenant-aware Data Connect access, media authorization and reusable form/list/detail components together. Property status transitions and listing status transitions are validated in the service and again in conditional SQL Connect mutations. Physical property rows and marketing listings are separate; `ACTIVE` is an internal listing status and does not publish to a portal.

The five-step property editor persists the property first, then applies amenity links, custom text features and private file uploads. A related-write or upload failure is reported separately because those operations are not one cross-service transaction; successful property data is retained and can be retried. Payment plans use transactional installment operations and remain inactive until their percentages reconcile. Floor plans can be linked to a project and optionally a building/property.

Firebase Storage is private. `storage.rules` denies all client reads and writes because Storage Rules cannot verify SQL Connect memberships. Authenticated Node.js routes authorize with the Firebase session and tenant-scoped SQL Connect operations, write bounded validated bytes with the Admin SDK, and serve content with private/no-store headers. `FIREBASE_STORAGE_BUCKET` is server-only; `npm run dev:local` supplies a demo-only bucket and starts the Storage emulator. Upload lifecycle status supports best-effort upload cleanup and retrying a deletion left in `DELETING`; there is not yet a scheduled cleanup worker for abandoned metadata/blob rows.

The property/listing schema, connector operations and generated SDK must ship together after an approved hosted migration. This implementation was not deployed. External portal feeds/publishing, permit verification, project-wide managed brochure/document uploads, branch-scoped manager access and scheduled media cleanup remain future work. See [Property inventory](PROPERTY_INVENTORY.md) for setup, storage lifecycle, migration and manual checks.

## Phase 5D: lead-to-property integration

The lead detail route streams a property workspace through a separate Suspense boundary. `src/modules/leads/server/property-service.ts` uses generated SQL Connect operations and the existing session/company/CSRF helpers. A pure matching module explains rule-based suggestions; shortlist, viewing and primary-reference operations recheck both lead and inventory access. The dashboard streams exact inventory aggregates from `GetInventoryDashboardMetrics`. See [Lead-property integration](LEAD_PROPERTY_INTEGRATION.md) for rules, query limits and migration steps.

## Phase 6A: AI Copilot (Anthropic Claude)

`src/modules/ai` adds a read-only Copilot at `/ai-copilot`. Its design:

- **Pure core:** `config`, `prompt`, `loop`, `tools/*`, `policy`, `protocol` and `markdown` have no I/O and are unit-tested with mocked Anthropic responses.
- **Server adapters:** `server/anthropic` is the only Anthropic client, and the only place that reads the API key and checks the model. `server/tools` holds the tool handlers, `server/store` handles persistence, allowances and usage, `server/chat` orchestrates a turn and `server/http` holds the conversation and status routes.
- **Request handling:** `POST /api/ai/chat` checks origin, CSRF, session, organization membership, input, rate limits, conversation ownership and the monthly allowance before streaming. It then runs Anthropic's manual tool-use loop with streaming (`client.beta.messages.stream` plus `finalMessage()`) and streams NDJSON events to the browser.
- **Tools:** each tool calls an existing read service (`listInventory`, `getInventoryRecord`, `listLeads`, `getLead`, `getLeadPropertyData`) or a read-only stored query. Organization, role, assignee and map-privacy rules are therefore identical to the CRM screens, and are re-derived from the session on every call.
- **Storage:** `AiConversation`/`AiMessage` (owner-private history), `AiUsageRecord`/`AiToolExecution` (token and tool metrics, no content) and `AiUsageCounter` (atomic monthly allowances). All are additive and tenant-keyed. Member reads and deletes run with impersonation. Exchange, usage and counter writes are NO_ACCESS operations run by the server after it has verified the session, following the existing rate-limit and invitation-delivery pattern.

See [AI Copilot](AI_COPILOT.md), [AI tools](AI_TOOLS.md) and [AI security](AI_SECURITY.md).

## Phase 6B: AI Content Studio

`src/modules/ai/content` adds the Content Studio at `/ai-content`. It reuses the Phase 6A Anthropic client, configuration, error mapping, monthly allowances, rate limiter and `AiUsageRecord`; there is no second AI backend.

- **Pure core:**
  - `catalog` defines content types and their fields;
  - `schemas` holds structured-output JSON and Zod schemas generated from the catalog;
  - `facts` builds the allowlist fact sheet;
  - `validate` runs the deterministic fact check;
  - `prompt`, `generate`, `policy` and `ad-limits` complete the core.

  All are unit-tested with mocked Claude.
- **Server adapters:**
  - `server/sources` re-reads every selected record through `getInventoryRecord`, `listInventory`, `getLead` and `getLeadPropertyData` as the member;
  - `server/store` holds the SQL Connect operations;
  - `server/generate` holds the streamed generation endpoints;
  - `server/http` holds the draft, brand, template and picker endpoints.
- **Generation:** one `client.beta.messages.stream` request with `output_config.format` (structured outputs), adaptive thinking and no tools. The response is validated with Zod and checked against the facts before the draft is saved. The browser receives NDJSON progress only.
- **Storage:** `AiContentDraft` and `AiContentVersion` hold editable drafts with history and a compare-and-set `revision`. `AiBrandProfile` holds approved branding and reuses `Organization` contact fields through approval flags. `AiContentTemplate` holds company style templates.
  - Generated writes are NO_ACCESS operations.
  - Edits, status changes and deletes are member operations whose `@check` re-verifies draft scope: own drafts, or company-wide for owners and administrators.
  - Draft source IDs have no foreign keys, so CRM records can still be archived or deleted.
- **CRM integration:** property, project, listing and lead pages link to the studio with the record pre-selected. The ID is re-authorized before use, and nothing is generated automatically.

See [AI Content Studio](AI_CONTENT_STUDIO.md), [templates and branding](AI_TEMPLATES.md) and [content security](AI_CONTENT_SECURITY.md).

## Phase 6C: AI sales intelligence

`src/modules/ai/sales` adds rule-based lead qualification, follow-up signals and dashboard counts. These are pure modules, unit-tested without I/O. It also adds Claude explanations through the shared `src/modules/ai/structured.ts` request, which the Content Studio now also uses, so there is one structured-output implementation.

- **Data access:** server code reuses the lead, property-matching, inventory and Content Studio fact services as the member.
- **Storage:** results are stored in separate AI tables, never on the lead.
- **Copilot:** gains one read-only tool, `getLeadQualification`.

See [AI sales intelligence](AI_SALES_INTELLIGENCE.md) and [lead qualification](AI_LEAD_QUALIFICATION.md).
