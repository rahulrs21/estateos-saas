# Phase 5D: lead-to-property integration

## Data and migration

`Lead.projectId` and `Lead.propertyId` remain the primary interest references. Existing leads are preserved. A standalone property clears the primary project; choosing a project without a property clears the primary property. Project/property combinations must agree and belong to the active organization. Legacy free-text interest remains visible.

Two additive tables use `(organizationId, id)` UUID keys and composite foreign keys to Lead and Property:

- `LeadPropertyInterest`: unique organization/lead/property, SAVED, INTERESTED, NOT_INTERESTED or REMOVED status, notes and creator/editor timestamps. Removal retains the row.
- `LeadPropertyViewing`: property-specific appointment with a UTC timestamp, notes and attribution. SCHEDULED appointments can be updated or completed/cancelled. Terminal appointments are immutable. Reschedule by cancelling and scheduling another appointment.
  - `assignedMembershipId` (nullable, composite FK to Membership): the agent conducting the viewing. Required by every new schedule and update; rows created before this column existed show "no agent" until their next edit.
  - `customerConfirmation`: PENDING (default), CONFIRMED or DECLINED. Editable while SCHEDULED.
  - `outcome`: POSITIVE, NEUTRAL, NEGATIVE or NO_SHOW. Accepted only when the update sets COMPLETED.
  - `followUpId` (nullable, composite FK to LeadFollowUp): set when a completion/cancellation creates a follow-up task.

### Viewing assignees and follow-ups

The assignee must be an ACTIVE company OWNER/ADMIN, or an AGENT assigned to both the lead and the property (otherwise the agent could not see the appointment). AGENT actors may only assign themselves. On update, an unchanged existing assignee is kept without re-checking eligibility so outcomes can still be recorded after reassignment; a changed assignee, or one receiving a follow-up, must be currently eligible. The lead detail offers only eligible choices; the mutation enforces the rule independently (`VIEWING_ASSIGNEE_FORBIDDEN`).

Completing or cancelling a viewing may create one `LeadFollowUp` for the viewing assignee (title, due date within a year) in the same transaction as the viewing change. The lead's denormalized `followUpAt`/`followUpNote` keep the earliest pending follow-up, matching `ScheduleLeadFollowUp` with `replaceExisting: false`. Existing pending follow-ups are not cancelled. The follow-up appears in the lead's follow-up history and timeline (`FOLLOW_UP_SCHEDULED` activity and audit entries reference the viewing).

### Shortlist actions

Agents can add any available property within their inventory access from the shortlist's "Add property" search (reusing `/api/inventory/properties`, status AVAILABLE, 20 results), not only suggested matches. "Remove" asks for confirmation and sets REMOVED; feedback and viewing history are retained, and re-adding reactivates the same row. Duplicate rows remain impossible (unique constraint plus the `expectedUpdatedAt` check).

Each write locks the actor membership and authorized property, then conditionally updates the authorized lead. Shortlist edits and viewing changes also compare the displayed `updatedAt` value. Changes, CRM activity and audit records commit in one SQL Connect transaction. Conflicts require a reload; the database unique constraint prevents duplicate shortlist rows.

Local update steps:

1. Run `npm run sql:validate` and `npm run sql:generate`.
2. Restart `npm run dev:local` if an older emulator is running. Its schema watcher applies the additive tables and stored operations. Preserve the existing local data directory.
3. Run `npm run test:dataconnect`. It uses separate demo test ports and `.tmp/sql-connect-integration/data`. The test reset removes dependent fixture rows in foreign-key order. Never run the seed/reset command against a live workspace.
4. Restart Next.js after SDK changes if it retains an older module bundle.

Hosted environments need a reviewed compatible migration and connector rollout before the new application version. Back up hosted data and review the migration diff first. No deployment, cloud provisioning or live-data reset was performed. Existing primary references need no backfill.

The local validator explicitly acknowledges the toolkit's `MISSING_JOIN_TABLE_KEY` advisory for `LeadPropertyViewing` only. A viewing is an appointment with its own organization/id key, allowing repeat visits to the same property; changing it to a unique lead/property join would lose that behavior. All other diagnostics still fail validation, and tenant foreign keys are unchanged. Integration tests verify repeat appointments preserve history.

## Access

HTTP endpoints reuse verified Firebase sessions, active organization resolution and exact-origin/CSRF protections. Browser organization headers are consistency checks only. Generated Admin SDK operations always use verified-user impersonation so stored authorization applies; see [Firebase's Admin SDK documentation](https://firebase.google.com/docs/sql-connect/admin-sdk).

OWNER/ADMIN manage their company records. An AGENT needs both the lead and property assigned to their active membership. Matching prices also require the listing assignment. Relationships never grant access; reassigned or otherwise inaccessible properties disappear from that user's relationship views. Cross-company references are blocked by checks and composite foreign keys. The existing inventory module has no verified MANAGER scope, so those users receive an explicit unavailable panel. Archived leads cannot acquire links or appointments. Availability is rechecked on saves and scheduling.

## Matching rules

`src/modules/leads/property-matching.ts` evaluates authorized, non-archived AVAILABLE properties with ACTIVE listings. It makes no AI or external calls.

- A primary project narrows suggestions to that project.
- Every normalized location word must appear in the emirate, community, area or project name. There is no fuzzy location inference or geocoding.
- Property type matches exactly after normalization. Bedrooms support Studio, a number or a minimum such as `3+`; unsupported text yields no match.
- BUY/INVEST use SALE listings; RENT uses rentals. Currencies must agree; no exchange rate is inferred.
- Budgets are inclusive and compared in integer minor units. Rental budgets mean annual rent: MONTHLY prices are multiplied by 12, YEARLY prices are unchanged, fees are excluded, unknown periods are excluded.
- Unspecified requirements impose no restriction. Every match explains its criteria. Multiple eligible listings are ordered by comparable price, then listing ID.

Inventory is reviewed in stable pages of 100, up to the existing 10,000-offset limit. The UI states the number of candidates reviewed and offers the next inventory page. Zero matches on a page does not imply zero matches across the company. Each property's first 100 authorized active listings are considered. Shortlist/viewing history currently shows the latest 100 entries, and primary searches return up to 50 records per type. These bounds are disclosed in the interface; indexed matching and extended history pagination remain future work.

## Dashboard definitions

All values are current database aggregates within the user's scope. Total properties includes every non-archived property, including DRAFT/INACTIVE; available and reserved totals restrict that set by inventory status. Active listings counts non-archived ACTIVE listings, which may include multiple listings per property. Properties by project groups all non-archived properties (null means standalone). Listings by agent groups all non-archived listing statuses (null means unassigned).

Breakdowns show the first 20 groups with a disclosure when more exist; totals remain exact across all groups. Agents see assignment-scoped figures; OWNER/ADMIN see company figures. Empty results display zero and database failures display an error. Existing lead/deal placeholders retain their explicit unconnected states.

## Verification and limits

Unit tests cover matching criteria, budget boundaries, annual rent, bedrooms, unsupported input and authority injection. SQL integration tests use real isolated PostgreSQL records to verify links, clearing references, multiple saved properties, stale edits, availability, permissions, cross-company rejection, persisted appointments, terminal states, dashboard aggregates and timeline events.

Manual flow: create an AVAILABLE property with an ACTIVE listing in the lead's currency. Assign both to the agent handling the lead. Save matching lead requirements, open its details, save a suggestion, mark it Interested and schedule a future Dubai-time viewing with an assignee and customer confirmation. Refresh, complete the viewing with an outcome and a follow-up task, confirm the follow-up appears in the lead's history, and inspect dashboard counts. Check that another agent or second-company owner cannot read that lead or its relationships.

Scheduling is an internal record: it does not reserve inventory, check calendar conflicts, send external invitations or change the lead pipeline automatically.
