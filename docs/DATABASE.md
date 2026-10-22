# EstateOS database

Firebase SQL Connect with PostgreSQL is the only application database layer. The source schema is [schema.gql](../dataconnect/schema/schema.gql); authorized operations are in [queries.gql](../dataconnect/connector/queries.gql) and [mutations.gql](../dataconnect/connector/mutations.gql). Normal runtime services use verified-user impersonation through the generated Admin Node SDK. The narrow NO_ACCESS delivery-receipt operation checks the verified server actor and invitation binding independently; see [Team](TEAM.md).

## Models and relationships

| Model | Key | Relationships and purpose |
| --- | --- | --- |
| Organization | UUID `id` | Tenant; created by a user profile, with unique slug and nullable emirate, phone, company email and size for legacy compatibility. Onboarding requires complete details. |
| UserProfile | Firebase Authentication `uid` | Identity metadata and optional selected organization; selection grants no access. |
| Membership | `(organizationId, id)` | Optional profile binding, authoritative role and invitation/approval state. Organization/email and organization/profile pairs are unique. |
| Invitation | `(organizationId, id)` | Same-company membership reservation, unique token digest, intended email/role, issuer, expiry and consumption/revocation state. One invitation ledger row per membership in this phase. |
| Branch | `(organizationId, id)` | Organization branch with a unique name within its tenant. |
| Lead | `(organizationId, id)` | Contact details, status, optional branch/assignee and one optional follow-up. |
| Activity | `(organizationId, id)` | Verified actor, action, timestamp, optional lead and append-only private note. |
| AuditLog | `(organizationId, id)` | Separate security event with verified actor, action, target type/UUID, timestamp and safe metadata. |

Organizations, memberships, invitations, branches, leads, activities and audit events use UUID identifiers. User profile identifiers remain Firebase UIDs. Tenant-owned foreign keys include `organizationId`: leads cannot reference another company's branch or membership, activities cannot reference another company's lead, and invitations cannot reference another company's membership. SDK UUIDs can arrive as compact hexadecimal strings; application validation normalizes them before comparing identifiers.

`createdAt` defaults to server request time. Updates explicitly maintain `updatedAt`; append-only Activity and AuditLog rows have creation timestamps. Indexes cover membership status/profile lookup, organization branches, lead filters, invitation organization/status and email/expiry lookups, and audit organization/actor/target chronology. Names, contact fields, invitation digests and note text have bounded column lengths. Organization slugs, membership organization/email and organization/user pairs, and invitation digests have unique constraints.

Invitation tokens are 256-bit server-generated secrets. Only SHA-256 hashes are stored; list operations omit them. Links keep the secret in a browser fragment. Matching verified recipients consume a valid PENDING invitation and activate/select its reserved membership atomically. The issuer must still hold grant authority. Expiry uses server time, with configurable 1–168-hour issuance. Legacy PENDING memberships retain their separate approval workflow.

Invitation also records deliveryStatus (NOT_SENT/PREVIEW/ACCEPTED/FAILED) and nullable deliveryUpdatedAt. ACCEPTED delivery status means provider acknowledgement; Invitation.status separately tracks whether a recipient has accepted. Reissue rotates pending hashes and resets delivery status. Creation, acceptance, revocation, reissue and delivery receipts append scoped AuditLog records. See [Team migration](TEAM.md#local-tests-and-migration).

Re-invite is limited to a REVOKED invitation whose REMOVED reservation has never been accepted or bound to a UID. The transaction preserves row IDs and role, rotates the digest, resets delivery state and restores PENDING/INVITED, retaining prior revocation audit events. Acceptance of the new link is still required for ACTIVE membership. Re-inviting previously accepted removed members is outside this workflow. No deletion or new schema migration is needed for this operation.

Membership states are `ACTIVE`, `INVITED`, `SUSPENDED` and `REMOVED`, plus retained compatibility states `PENDING` (approval required) and `REVOKED` (legacy terminal removal). Only `ACTIVE` grants access. Owner changes are unavailable; this phase protects every owner, including the last active owner, rather than introducing an ownership-transfer workflow.

Security-sensitive organization and lead operations append AuditLog and preserve the existing Activity timeline in the same transaction. AuditLog contains no invitation tokens, digests, lead-note text or follow-up-note text. Its target is an organization-scoped polymorphic type/UUID pair, not an unrestricted lookup API. Product operations cannot edit or delete audit rows. Infrastructure administrators retain database capabilities; this is not an immutable external compliance archive.

## Code ownership

- `src/modules/organizations/server/` owns profile, organization, membership, branch and tenant context services.
- `src/modules/leads/` owns lead validation, UI, HTTP policy and server services.
- `src/lib/firebase/dataconnect.ts` creates verified SDK request context and sanitizes provider errors.
- `src/dataconnect-admin-generated/` is compiler output. Regenerate it rather than editing generated files.

The connector folder name is `connector`; `connectorId: example` intentionally retains the existing service identity. Renaming this local folder does not rename a hosted connector or change relational data.

## Validation and migrations

From the repository root:

```powershell
npm.cmd run sql:validate
npm.cmd run sql:generate
npm.cmd run test:dataconnect
```

The integration suite uses a disposable local `demo-estateos` emulator and synthetic fixtures. `dataconnect/seed_data.gql` stays outside the deployable connector directory. Seed/reset commands must never target a hosted database or become live application fallback data.

Phase 3A adds Invitation and AuditLog tables, their constraints/indexes and new enum values. Existing tables and legacy membership invitation columns remain. New acceptance requires a dedicated Invitation row; a legacy membership digest alone no longer authorizes acceptance. Outstanding invitations therefore need an explicitly reviewed backfill before the new acceptance operation is deployed. Historical Activity rows are preserved and are not silently represented as new AuditLog history.

No hosted migration or provisioning was performed. Follow the [Phase 3A migration steps](MULTI_TENANCY.md#migration-and-rollout) and the full [SQL Connect runbook](SQL_CONNECT.md#future-hosted-migration-separate-approval-required). `COMPATIBLE` validation is selected for the CRM connector. The regenerated movie example folder is not an active connector.

The onboarding extension adds nullable company fields, Emirate/CompanySize enums and ORGANIZATION_UPDATED events. Existing companies remain accessible without forced registration. See [Onboarding](ONBOARDING.md) for additive migration and manual checks.

Task, deal, property, billing and team-sharing tables remain future work. Current team management uses Membership and Invitation; no second identity layer is added. A converted lead does not create another entity, and a follow-up sends no notification. See [Permissions](PERMISSIONS.md) and [Roadmap](ROADMAP.md).


## Phase 4A: contact and lead aggregate

The existing Lead and Activity tables are extended; no second database or identity layer is introduced. Six additional tables bring the model count to fourteen: Contact, Pipeline, PipelineStage, LeadSource, LeadAssignmentHistory and LeadFollowUp. Activity remains the LeadActivity timeline, using kind/note for activityType/description and actorUid for the authenticated actor.

| Model | Relationships and integrity |
| --- | --- |
| Contact | Organization + UUID key, many leads per contact, normalized email and phone indexes; duplicate contact details are deliberately not unique. |
| Lead | Existing organization + UUID key; contact/source/pipeline references; organization + leadNumber uniqueness; composite stage FK includes pipelineId. |
| Pipeline | Tenant-scoped name and defaultKey uniqueness; exactly one fixed default reservation is created by supported operations. |
| PipelineStage | Organization + pipelineId + UUID key; name and position unique inside a pipeline; OPEN/WON/LOST classification. |
| LeadSource | Organization + UUID key; tenant-scoped name and sourceType/externalSourceId uniqueness. |
| LeadAssignmentHistory | Tenant-scoped lead and previous/new Membership references, verified assignedBy UID, assignment type and UTC timestamp. |
| LeadFollowUp | Tenant-scoped lead and assigned Membership references; title, UTC due date, PENDING/COMPLETED/CANCELLED state and completion timestamp. |

Every tenant-to-tenant FK reuses organizationId. assignedMembershipId is the existing assignedAgentId relationship; follow-up assignedUserId is a Membership UUID, not an unverified Firebase UID. PipelineStage references also reuse pipelineId, rejecting references to a different pipeline inside the same company.

Lead now includes propertyInterest, preferredLocation, propertyType, BUY/RENT/INVEST transactionType, priority, bedroomPreference, currency (default AED), budget bounds and archive metadata. Budgets use PostgreSQL numeric(16,2); server validation bounds them to nonnegative values up to one trillion and rejects more than two fractional digits or an inverted range. USD or another accepted three-letter currency remains unchanged when an old editor omits it; there is no currency conversion. projectId/propertyId are reserved nullable UUID columns, without foreign keys to nonexistent modules; ordinary inputs reject non-null values.

leadNumber is a SQL Connect server-generated UUID with tenant-scoped uniqueness, not a sequential count or MAX+1 number. It is independent of the row ID and remains safe under concurrent creation. Old contact/status/source/assignment/follow-up columns remain for compatibility. Canonical Contact values are used in current view models; old inline contact fields remain legacy snapshots. Contact administration synchronizes those snapshots transactionally.

New companies receive their default pipeline, eight stages and Manual source inside CreateOrganization's existing owner/bootstrap transaction. Stage names are New, Contacted, Qualified, Viewing Scheduled, Viewing Completed, Negotiation, Won and Lost. Stable configuration UUIDs are intentionally reused under different composite organization keys. InitializeLeadPipeline can install only this fixed configuration for an active member's organization; it cannot customize, replace or grant privileges. The service checks before initialization and handles a concurrent initializer through database uniqueness. Existing-company lead creation initializes this configuration when necessary.

Stage changes select an active pipeline and a stage in that same company/pipeline. Open leads may move between open or terminal stages; Won/Lost are terminal and cannot be reopened through ordinary writes. A no-op terminal update is permitted. Legacy CONVERTED maps to the Won stage and remains supported for existing records. Activity stores previousStageId/newStageId and the pipeline for a durable stage history. Assignment history and audit events commit with lead updates. Lead compare-and-set predicates detect intervening updates and fail the whole transaction. Follow-up assignees must be active and able to access the lead; reassignment transfers pending work, and archiving cancels it.

### Phase 4A migration and rollout (not performed on hosted data)

1. Back up and verify restore of the target database; review the current schema diff and generated SDK. Keep the existing connector ID and all company, identity, membership and lead keys. Do not reset a live database or run emulator seed operations against it.
2. Review the additive migration: six new tables, enum additions, nullable Lead/Activity relationships, scalar defaults, numeric budget columns, indexes and composite FK/unique constraints. New relationship columns intentionally remain nullable for legacy rows; do not add NOT NULL until a reviewed backfill has completed.
3. Deploy the reviewed schema and stored operations together with the matching generated SDK/application in an approved release window. This task does not deploy, provision infrastructure or authorize that release.
4. Initialize fixed pipeline metadata for each existing company through the authorized setup operation. Record actual lead migration separately from metadata initialization.
5. Backfill each legacy lead in a reviewed maintenance transaction: create a distinct Contact from its existing contact fields (never merge by an uncertain email/phone match), normalize known numbers, preserve ambiguous input, link the contact, map its status to the company's stage, retain its assignment/branch/source text and assign a unique leadNumber if missing. Use the existing Manual source only when the original source is unknown or unmapped. Preserve original creation timestamps. Do not invent historical stage/assignment changes; record a clearly identified migration audit event. Bulk migration code must be scoped explicitly to one organization and checked against the FK constraints before release.
6. Verify per-company row counts, orphan checks, key uniqueness, contact links, stage/status mappings and budgets. Only then consider a separately reviewed constraint-hardening migration. A reviewed application rollback must retain compatibility columns and new data; do not drop new tables to roll back an application.
7. Run npm run sql:validate, npm run sql:generate, npm test, npm run test:dataconnect, npm run lint, npx tsc --noEmit and npm run build. The integration database uses separate demo ports/data, not the application's existing local companies.

Legacy leads remain readable/editable through compatibility fields before the contact backfill. New aggregate creation always creates or validates a Contact and a valid stage. No automatic migration, uncertain-contact merge or fabricated history runs during a read.

## Phase 4C: lead distribution

The lead aggregate adds four tenant-owned tables: `LeadDistributionRule`, `AgentAvailability`, `DistributionCursor` and `InAppNotification`. `LeadAssignmentHistory` is reused and now records an optional rule reference and reason. Membership has a `distributionEligible` flag; it is only a candidate-selection preference and never grants workspace or lead access. The data model contains one `DEFAULT` rule per organization today; `ruleKey` leaves room for a future priority ruleset.

| Model | Scope and purpose |
| --- | --- |
| LeadDistributionRule | Per-company mode, enablement, optional branch/project filters, unavailable-agent policy, IANA time zone, business-day mask, hours and reassignment-timeout setting. Branch uses a tenant FK; project remains an unvalidated scalar until its module exists. |
| AgentAvailability | One row per organization + membership; only active registered AGENT memberships can be targets. Missing availability means AVAILABLE. |
| DistributionCursor | One persistent version and last-selected membership per organization + rule; the composite key prevents cross-company cursor reuse. |
| InAppNotification | Tenant-scoped member or administrator audience, optional membership/lead links, read time and actor. Assignment outcomes are stored here; no email/SMS/WhatsApp delivery is performed. |

Round robin is not a client-side read-then-write counter. Each lead-create transaction compares the supplied cursor version, increments that version and inserts the lead, assignment history, audit/activity and notification rows atomically. A stale version aborts the whole transaction; the server rereads the rule, chooses from the new cursor, and retries a bounded number of times. A transaction that exhausts retries fails safely without creating a duplicate lead, using its stable lead UUID to detect a prior committed response. Concurrent create behavior is covered by the local Data Connect emulator integration test. This relies on SQL Connect transaction checks plus a conditional cursor update; do not replace it with an unconditional cursor write.

The chosen pool is active, registered, same-company AGENT memberships selected by the owner/admin rule. Branch/project filters are applied to both the lead and rule configuration. If configured to skip unavailable agents, explicit UNAVAILABLE entries are removed unless their `unavailableUntil` has passed. Optional business-hour policy uses the configured IANA zone and weekdays mask. When the pool is empty, a lead remains unassigned, does not advance the cursor, and creates an administrator-audience in-app notification. Manual assignment likewise requires an active target in the same company; role checks are repeated in stored operations.

The timeout field is configuration only at this phase. There is no scheduled worker to reassign stale leads, nor branch/team management to widen MANAGER visibility. Managers can reassign only a lead they can already access; owners/admins can manage company-wide records. Lead notifications are persistent in-app items only. No external notification or background queue provider is configured.

### Phase 4C migration and rollout (not performed on hosted data)

1. Back up and review the target database and generated SDK. Add the four tables, enum values, Membership preference field and LeadAssignmentHistory rule/reason columns using a reviewed additive migration. Existing assignments/history remain intact.
2. Deploy schema and connector operations together in an approved release. Existing organizations have no enabled rule and retain manual assignment until an owner/admin explicitly saves settings. No production deploy or paid-resource change was performed here.
3. Review whether agents should be eligible, then enable a rule and choose the active agent set from `/settings/lead-distribution`. Confirm branch/project values refer to the same company and preview the selected agent before enabling Round Robin.
4. Verify assigned/unassigned notifications, history rows and cursor versions. Never reset the cursor or delete history to recover from a request error; retry through the server path, which uses compare-and-set and stable lead IDs.
5. Run local schema validation, SDK generation, unit tests and the isolated emulator suite before release. Emulator seeding/reset is local-only and must not be pointed at hosted data.

## Phase 4D website lead capture and reporting

`LeadCaptureForm` belongs to an Organization and its `LeadSource`; each form has a cryptographically random public identifier, configurable field definitions, consent wording, a privacy-policy URL, optional company branch/project scope, lifecycle status and timestamps. Public IDs are unique and are identifiers, not database credentials. `LeadCaptureSubmission` stores a tenant/form-scoped SHA-256 idempotency-key digest, created lead, consent timestamp and the form's consent/privacy snapshots, plus sanitized landing-page and UTM attribution. Raw idempotency keys are never persisted. `LeadCaptureRateWindow` is a form-scoped, minute-bucketed compare-and-set counter. Foreign keys include organizationId, so a form cannot point to another company's source, branch or project.

Website capture creates/associates a Contact and Lead, records website attribution, lead activity, assignment history when applicable, AuditLog, and in-app notifications within the SQL Connect mutation transaction. Exact normalized email/phone matches are associated only when they identify one contact; zero or ambiguous matches create a distinct contact. Multiple leads may refer to one contact. Website source rows are created with their form. The capture endpoint accepts no organization ID; its active form configuration determines the tenant, source, consent notice, policy URL and optional assignment scope.

`LeadAnalytics` is computed from stored Leads, sources, stages, memberships and follow-ups, not from client-side counts. `from` and `to` are inclusive local calendar dates in the requested IANA timezone; the query converts them to a half-open UTC interval. The maximum range is 366 days. Volume buckets are day, week, or month. Company-wide counts are available only to OWNER/ADMIN; other current roles see only their own assigned leads because no verified team/branch reporting scope exists. The lead-to-won numerator and denominator both use leads created during the selected range: Won-stage leads divided by visible, non-archived leads. Overdue follow-ups count currently pending work due before now within the same visible organization/lead scope; they are not bounded by the lead-created date range.

Apply and review this schema/operation change using the existing SQL Connect migration rollout procedure. It has only been validated/generated and tested against the local emulator; no hosted migration or deployment has occurred. See [Lead capture](LEAD_CAPTURE.md) for the public endpoint threat boundaries, rate limits, setup and operational limitations.
