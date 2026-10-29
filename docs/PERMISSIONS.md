# EstateOS permissions

Firebase Authentication establishes identity. An active database membership establishes organization access and role. Both are checked on the server; route groups, visible controls, cookie presence, a selected company and client-submitted roles never authorize an operation.

## Request boundaries

1. Protected rendering and operations verify an unexpired, unrevoked Firebase session with a verified email. Invalid sessions redirect protected page visitors to login; APIs reject the request.
2. Organization services resolve `UserProfile.activeOrganizationId` and verify that the current identity has an `ACTIVE` membership in that organization. Company switching independently verifies membership in the requested company.
3. Services validate input and derive identity, tenant and role from trusted data. Lead and company-settings organization headers detect stale selections; they grant no scope. Company creation accepts no client role, UID or organization assertion.
4. SQL Connect stored operations independently enforce membership, tenant, record visibility and permitted references. Generated Admin SDK calls always receive verified-user impersonation options for normal application operations.
5. Cookie-authenticated HTTP mutations require the exact configured origin, CSRF protection and validated bounded input. Internal server services must only be invoked from such protected entry points. Sensitive writes, their Activity timeline event and separate AuditLog event are transactional.

Checks occur at each operation boundary. A workspace layout check alone cannot protect an API route or a record lookup. Searches, counts, pagination and activity timelines apply the same record visibility rules as lead reads.

## Role matrix

| Capability | OWNER | ADMIN | MANAGER | AGENT |
| --- | --- | --- | --- | --- |
| Open the selected company's dashboard | Yes | Yes | Yes | Yes |
| Read organization and branches | Yes | Yes | Yes | Yes |
| Update selected company profile | Yes | Yes | No | No |
| Read/create/update leads | Organization leads | Organization leads | Assigned to self only | Assigned to self only |
| Change lead status, add notes, schedule/complete follow-up | Organization leads | Organization leads | Assigned leads only | Assigned leads only |
| Assign leads | Active same-company members or unassigned | Same | No reassignment | No reassignment |
| Create branches | Yes | Yes | No | No |
| Read organization-wide activity/member lists | Yes | Yes | No | No |
| Invite/approve/manage ADMIN membership | Yes | No | No | No |
| Invite/approve/manage MANAGER or AGENT membership | Yes | Yes | No | No |
| Change another active member's non-owner role | ADMIN / MANAGER / AGENT targets | MANAGER / AGENT targets only | No | No |
| Read invitation ledger or security audit log | Yes | Yes | No | No |
| Change own role/status or grant existing-company OWNER | No | No | No | No |

Managers and agents have assignment-based lead access. There is no team or branch membership scope to authorize broader access. A branch filter never grants access. They cannot read unrelated or unassigned leads, inspect their notes, or claim a private lead by submitting their own membership ID. Lead assignees must be active, registered members of the same organization.

The dashboard is `/workspace/dashboard`. It requires a verified session and an ACTIVE membership in the selected company, with no platform-administrator requirement. Each company uses the same dashboard interface with its own authorized context. Company settings (`/settings/company`) is a separate page and includes a Dashboard navigation link. KPI cards and charts remain explicit empty states until analytics are connected; this is a feature limitation, not a role restriction.

## Membership lifecycle

An authorized organization-creation transaction creates a new organization and its fixed `OWNER`/`ACTIVE` membership together. It cannot promote a user in an existing company. Signup creates neither a company nor a privileged membership.

Invited memberships begin as INVITED; separate Invitation rows hold a token digest and expiry in PENDING state. Acceptance requires the matching verified email, single-use token and issuer's current grant authority. It atomically marks the invitation ACCEPTED, binds the verified UID, activates membership, selects the company and records audit events. Legacy PENDING memberships still require their reviewed approval workflow. Reissue rotates a pending token; revocation invalidates it. See [Team management](TEAM.md).

An authorized OWNER/ADMIN may re-invite a revoked recipient only if the reservation was never accepted and remains unbound/REMOVED. ADMIN cannot re-invite ADMIN roles. Re-invitation restores INVITED/PENDING with a new token, expiry and audit event; it grants no immediate workspace access and cannot reactivate a previously accepted member. The recipient must verify the matching email and accept the new link. The old link stays invalid, the role is preserved, and revocation audit history is retained.

`INVITED`, `PENDING`, `SUSPENDED`, `REMOVED` and legacy `REVOKED` memberships grant no organization access. A stale selected company never preserves access after removal. Removed/revoked memberships cannot be reactivated with the status operation. Self-administration, owner changes and granting an equal/higher role are unavailable. Role checks are repeated in conditional database updates, protecting against concurrent target-role changes.

Every owner is protected from removal, suspension and demotion in this phase. This stricter policy prevents last-owner loss without a count/check race; it deliberately does not implement transfers, owner promotion, owner removal when another owner exists, or company deletion. No platform-administrator claim bypasses these rules.

Team mutations include strict role, tenant and stale-company checks. Raw tokens are delivered by the configured server provider or shown once in an explicitly unsent development preview. Delivery acknowledgements do not mean inbox delivery.

RecordInvitationDelivery is the deliberate privileged exception to ordinary SDK impersonation. Its NO_ACCESS policy denies client calls, while its transaction rechecks an active administrator and binds the verified server actor, tenant, issuer and digest. It records provider outcomes only and cannot grant membership. See [the receipt boundary](TEAM.md#narrow-privileged-receipt-operation).

## Code and verification

- `src/modules/auth/server/`: session, origin, cookie and CSRF policies.
- `src/lib/auth/session.ts`: reusable verified-session lookup and protected-page guard.
- `src/modules/organizations/server/context.ts`: trusted organization/membership resolution.
- `src/modules/organizations/server/permission-policy.ts`: role and assignment business rules.
- `dataconnect/connector/`: explicit operation authorization and tenant predicates.
- `tests/auth-*.test.ts`, `tests/tenancy-*.test.ts`, `tests/leads-*.test.ts` and `tests/sql-connect.integration.test.mjs`: session, role, validation and database boundary coverage.

Run `npm.cmd test` and `npm.cmd run test:dataconnect`. Tests cover cross-company access, private leads, role escalation/self-promotion, removed/non-active memberships, invitation expiry/replay, target/reference constraints, concurrent slug creation, late transactional rollback and last-owner protection. Existing auth tests cover invalid, expired and revoked sessions before tenant resolution. See [Multi-tenancy](MULTI_TENANCY.md) for service entry points, migration prerequisites and remaining limits. Hosted IAM and operational release checks remain outstanding; this is not a production-ready claim.


## Phase 4A record rules

OWNER/ADMIN may manage all leads in their active company and assign only active, registered same-company memberships. MANAGER and AGENT have only self-assigned lead access because no verified team/branch membership relationships exist. Branch labels and client role claims grant no additional scope. Assignment pickers for these roles contain only their own active membership, and dedicated reassignment is denied. Archiving requires OWNER/ADMIN.

### Lead distribution and notifications

OWNER/ADMIN may view and change company-wide distribution settings, choose eligible active AGENT memberships, preview a rule, and inspect assignment history. MANAGER may manually reassign only a lead already visible to them, and only to an active registered AGENT in the same company. AGENTs cannot assign, reassign or configure company rules. An active AGENT may update only their own availability. No manager gains team-wide visibility from the distribution configuration.

Automatic assignment uses only the selected active, registered, same-company AGENT pool. Inactive, suspended, removed, unregistered and cross-company memberships are excluded or rejected in both the server service and SQL Connect mutation. The candidate flag does not authorize access. Rule settings and all successful assignment changes write audit/history records in the same mutation transaction. A version-checked cursor serializes round-robin mutations; stale writes fail and the server retries with a fresh plan.

Member notifications are readable/markable only by their active recipient membership. Administrator-audience queue notifications are visible only to active OWNER/ADMIN members of that same organization. Every read/write query includes the organization key; notification IDs and client-supplied roles do not grant authority. There are no email, SMS or WhatsApp notifications. A configured reassignment timeout is not acted on until a separately secured scheduler/worker exists.

Contact discovery, exact duplicate candidates and counts are subject to the same organization boundary. Administrators see company contacts; other active members see contacts linked to their authorized leads, or their own still-unlinked contacts. Contact creation confers no access to another person's leads. The Contact update API is administrator-only. The existing lead editor can change a linked contact only when the connector's contact-edit predicate permits it (an administrator, or a member authorized for every linked lead); it cannot modify a shared private contact by editing one assigned lead. Lead notes stay in the authorized lead timeline, separate from shared Contact notes.

A follow-up assignee must have an active registered membership and lead access (the current assignee or an organization administrator). Ordinary follow-up, stage and activity writes repeat lead authorization. Archived records/history remain readable within that same scope; subsequent ordinary writes are denied. Won/Lost cannot be reopened by normal stage or legacy status operations. Invalid/foreign pipeline, stage, source, contact, branch and membership references fail without partial success.

All new application SDK calls include verified-user impersonation. New stored operations use explicit verified-email/password authentication, active membership lookups/locks, redacted authorization fields and transactional checks. Ordinary users cannot author audit kinds/actors/timestamps or assignment history, choose a generated lead number, change archivedBy, write delivery receipts or hard-delete leads. Contact normalization columns are computed by the trusted server, with normalized email derived inside the connector. Duplicate warnings do not merge records or override authorization.

Phase 4A integration coverage includes real PostgreSQL contact/lead linkage, foreign-company rejection, private agent and manager records, shared contacts, duplicate discovery, invalid memberships/stages, archive restrictions, history, follow-up completion/replay, FK failure, concurrent lead-number generation and aggregate rollback. These tests complement the existing expired/revoked-session and membership lifecycle suites; hosted IAM, migration, recovery and operational release checks remain separate requirements.

## Phase 4D capture and reporting boundaries

Only an authenticated active OWNER/ADMIN can create, list, or edit a company's capture forms. Every normal form-management read/write uses the verified organization context and impersonated SQL Connect SDK; company IDs and roles in requests are consistency hints only. Form/source/branch/project references are checked in the tenant-scoped transaction. A public form ID reveals only the enabled form's public fields, consent copy, policy URL and success copy; it does not expose organization, source, lead, contact, member or database identifiers.

The public HTTP handler imposes a 16 KiB JSON limit, validates input against the form's saved Zod field configuration, requires consent, rejects a hidden honeypot and submissions completed before the minimum form dwell time, and applies a persistent compare-and-set limit of 30 requests per form per UTC minute. The limit is per form and does not replace edge/WAF bot protection or a distributed abuse-management service. Rate-window records older than five minutes are pruned during successful counter mutations. Idempotency keys are hashed before storage and the SQL transaction rechecks active form status, tenant, source and assignment eligibility. Public connector operations use `@auth(level: NO_ACCESS)` and are callable only from the narrow server-only Firebase Admin path; no unrestricted public SQL operation is exposed. Normal CRM operations remain impersonated and organization-scoped.

The public transaction attributes the lead to the form's trusted `LeadSource`, snapshots consent and policy text/URL, stores sanitized untrusted UTM/landing-page values, links only an exact unambiguous contact match, and invokes the existing distribution rules. Notification and audit writes share the transaction. Form creators are used as the actor where the existing schema requires a UserProfile actor; public submitters do not get user accounts or membership. Errors reveal no tenant records. Analytics repeat organization, role and private-lead predicates in SQL; OWNER/ADMIN can filter company-wide, while MANAGER/AGENT are intentionally limited to their own assigned leads until a verified team/branch scope exists. See [Lead capture](LEAD_CAPTURE.md).
# CRM contact access

Contact list and detail reads use the verified active organization context and
tenant-scoped SQL Connect queries. Company owners and administrators can create
and edit company contacts. The same role check is enforced in the server service
and in the `CreateContact` / `UpdateContact` SQL Connect operations. Agents and
managers can read contacts linked to leads they are authorized to access, but
cannot create or edit shared contact records. Duplicate detection is company
scoped and warns without merging records.

## Property inventory access

Inventory requests use the existing Firebase session and trusted active-company resolver. The server derives UID, organization and membership, passes verified-user impersonation options to the generated SQL Connect Admin SDK, and checks organization consistency on writes. Every stored inventory operation independently verifies an active membership and the role needed for that operation; SQL Connect transactions include the Activity and AuditLog event. Browser inputs cannot choose a tenant, actor, creator, updater or role.

| Role | Inventory reads | Inventory writes |
| --- | --- | --- |
| OWNER, ADMIN | Company-scoped developers, projects, phases, buildings, properties, listings, floor plans, amenities, features and payment plans. | Create, update and soft-archive catalog/inventory resources; manage amenities and typed attributes; attach/detach amenities; manage listing assignments and payment plans. Listing assignees must be active AGENT memberships in this company. |
| AGENT | Company developer/project reference catalog; properties assigned to the agent's active membership; listings assigned to the agent's active membership. | Create/update only listings explicitly assigned to their own membership, limited to draft and pending review. No property, plan, amenity or feature administration. |
| MANAGER | Denied inventory access for now. | Denied inventory writes for now. |

MANAGER inventory access is intentionally denied because the current schema has no verified branch/team inventory scope. A branch or project ID supplied by the browser would not establish that scope. Add manager access only after a trusted scope relationship and query predicates are implemented. This denial does not change the existing Leads permission model.

All references are tenant-bound: project-to-developer, phase/building-to-project, building-to-phase, property-to-project/building, listing-to-property/assignee, floor-plan-to-project/building, plan-to-project, feature-to-property and amenity joins. Composite foreign keys reject cross-company references in PostgreSQL, while stored operations verify active referenced rows and membership status. Listing reads are explicitly split into owner/admin company queries and agent self-assignment queries. Missing rows do not disclose another tenant's record. There are no public inventory operations, platform-admin bypass, client-side Admin SDK or NO_ACCESS raw query escape hatch. See DATABASE.md for model and migration details.

The `/developers` and `/projects` pages reuse the protected workspace shell. Their controls reflect the membership role resolved by the server: OWNER/ADMIN can create, update and archive; AGENT can read; MANAGER sees the existing scope-denied state. Every mutation still passes through the server service and SQL Connect authorization, so hiding an editor is only a UI convenience. Project audit events are selected by both the authenticated organization and project target. Developer archiving is rejected in the same SQL Connect transaction while any active project remains linked.

## Phase 5C property and listing access

Property and listing routes resolve the active company and membership server-side. Owners and administrators manage organization inventory. Managers remain denied because the application has no verified branch/team inventory scope. Agents can view only properties assigned to their active membership and listings assigned to them; an assignment ID in a request cannot grant access because connector queries independently bind it to the authenticated UID and active membership. Agents may prepare their assigned listings as drafts or pending review; approval and activation are administrative actions.

Media reads pass through a Node.js server route. That route verifies the session and active organization, fetches metadata using a verified-user SQL Connect request, and downloads only the stored object path. Agents can retrieve media attached to a property assigned to their membership. Project and floor-plan uploads remain available to inventory administrators until an explicit agent scope exists. Firebase Storage browser rules deny all reads and writes, so callers cannot substitute a company ID or write directly to an organization path.

The upload route enforces origin/CSRF, active session/membership, a 20 MiB limit, allowed MIME type and file signature before creating metadata and storing bytes. It generates paths from the trusted organization and authorized parent record plus a random identifier; it does not use caller-supplied paths. Media state changes are limited to pending-to-active/deleted and active-to-deleting-to-deleted. Cover changes are transactional and only accept image property photos. Permit fields are references only and do not imply regulatory verification or approval.

## Phase 5D: lead-property access

OWNER/ADMIN may connect records in their active company. AGENT must independently have assignment access to both the lead and property, and to listings used for matching prices. Shortlists/viewings grant no additional access. All connector reads repeat the lead and property predicates; writes also recheck availability and use transaction guards. MANAGER inventory scope remains unavailable until a verified scope is implemented. Dashboard aggregates use the same inventory/agent assignment boundary. See [lead-property access and limits](LEAD_PROPERTY_INTEGRATION.md).

## Phase 5E: property portal access

Portal settings, field mappings, export previews, validation records and feed dry runs require an active OWNER/ADMIN membership in the active company, checked in the service and again in every stored operation. Agents and managers have no portal access. Administrators may record only `NOT_CONFIGURED`, `PENDING_APPROVAL` or `DISABLED`; `CONNECTED`/`ERROR` are reserved for future server-side verification. Validation results are recomputed on the server. Exports exclude internal property notes, ownership/mandate references, unit numbers, member emails, brochures and documents. See [Property portal integrations](PROPERTY_PORTAL_INTEGRATIONS.md#access-and-security).

## Phase 5F: map access

Map views and detail maps reuse the inventory read scope: OWNER/ADMIN see company records, AGENT only assigned properties and listings, MANAGER none. Every viewer sees locations as the record's `mapDisplayMode` allows (exact, ~1 km approximate, or hidden); only OWNER/ADMIN also receive stored exact coordinates. HIDDEN rows are excluded from map-pin queries and raw coordinates are stripped server-side. Address lookups (`/api/maps/{autocomplete,place,geocode,reverse-geocode}`, which call Google with a server-only key) require an active OWNER/ADMIN membership in the company named by the request header, plus CSRF and session checks. `GET /api/maps/pins` uses the session's company and role only; viewport bounds are snapped outward to the approximate grid so they cannot narrow an approximate location. Lookups and pin reads are rate limited per member, per trusted client IP and (lookups) per company through the shared database-backed limiter; see [Rate limiting](MAPS.md#rate-limiting). Developer head offices are editable by OWNER/ADMIN and visible exactly to OWNER/ADMIN/AGENT. Public map components accept only sanitized, explicitly published listings and are separate from CRM authorization; see [Public client-facing maps](MAPS.md#public-client-facing-maps). See [UAE map integration](MAPS.md#display-modes-and-privacy).

## Phase 6B: AI Content Studio access

Content drafts are private to the member who generated them. OWNER and ADMIN also manage company-wide content: they view, edit, archive and delete any draft in the company, and they alone approve drafts (internal approval only). MANAGER and AGENT work with their own drafts. The server passes the caller's uid as the draft scope for non-administrators, and each stored operation's membership `@check` re-verifies it, so a client cannot widen its scope.

Generation re-reads every source record through the existing services as the member, independently of draft ownership:

- AGENT: assigned leads and inventory, plus projects and developers.
- MANAGER: no inventory, so only lead-based WhatsApp and email drafts.
- OWNER and ADMIN: company records.

Brand settings and templates are readable by every member and changeable by OWNER and ADMIN only. No new role was added. See [AI content security](AI_CONTENT_SECURITY.md).

## Phase 6C: AI sales intelligence access

| Role | Lead intelligence | Inventory-based features | Dashboard scope | Priority review |
| --- | --- | --- | --- | --- |
| OWNER, ADMIN | All company leads | Matching, viewing briefs, property actions | Company, one agent or one branch | Any lead |
| MANAGER | Leads assigned to them | Not available (no inventory scope) | Their own leads | Their own leads |
| AGENT | Leads assigned to them | Their assigned inventory | Their own leads | Their own leads |

- **Enforcement:** the lead rule is enforced in every stored operation (`ai-sales.gql`).
- **Server-only writes:** assessments and AI insights are NO_ACCESS.
- **Pipeline summaries:** visible only to the member who generated them.

See [AI sales intelligence](AI_SALES_INTELLIGENCE.md).
