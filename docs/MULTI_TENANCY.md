# Phase 3A: multi-tenant database and authorization foundation

EstateOS uses Firebase Authentication for identity and SQL Connect/PostgreSQL for tenant authority. Phase 3A adds Invitation and AuditLog; subsequent [company onboarding](ONBOARDING.md) connects registration, settings and workspace selection. Authentication, dashboard design, Leads and Activity are preserved. Platform administration, delivery integrations and paid cloud resources are not added.

## Request and authorization flow

1. `src/lib/auth/session.ts` verifies Firebase sessions on the server, including email verification, expiry and revocation. Anonymous page visitors redirect to login; unauthorized operations fail closed.
2. `src/lib/firebase/dataconnect.ts` creates a request context from the verified UID/email. Every ordinary generated-SDK invocation receives verified-user impersonation options. Client-submitted actors, custom role claims and organization assertions grant no authority.
3. `src/modules/organizations/server/context.ts` resolves the profile's selected organization and rechecks an `ACTIVE` database membership. Selecting a company is a preference change that independently validates membership and writes audit events.
4. Server services validate strict Zod inputs and check the authoritative database role. SQL Connect repeats tenant, membership, role, ownership and reference checks through `@auth`, redacted authorization queries, `@check` and conditional updates.
5. `@transaction` couples protected writes with Activity and AuditLog events. Authorization row locks hold current actor membership stable for each write. Conditional target updates repeat the permitted role/state predicates; queries are not treated as sufficient authorization for a later unrestricted update.

No application path uses unrestricted Admin access as an end-user permission shortcut. Privileged raw GraphQL is confined to the guarded loopback test/seed harness and deliberate database-constraint probes. Future HTTP routes or Server Actions calling internal services must independently enforce origin/CSRF protections; server-only module placement is not request authentication.

## Relationships

UserProfile uses the Firebase UID as its key. Organization has a UUID, name and unique normalized slug. Membership joins profile and organization with the authoritative role/status, unique per organization/profile and organization/email. Tenant-owned primary keys are `(organizationId, id)`.

Branch belongs to Organization. Invitation references a membership through a same-organization composite foreign key, with issuer, intended email/role, unique token hash, expiry and consumption/revocation timestamps. AuditLog references its organization and verified actor, with an action, target type/UUID, safe metadata and creation time. Lead and Activity remain separate existing models. See [Database](DATABASE.md) for constraints and indexes.

## Company creation and service entry points

The server-only API is `src/modules/organizations/server/service.ts`:

| Service | Boundary |
| --- | --- |
| `upsertMyProfile({ displayName })` | Verified session; UID/email come from identity, not input. Creates no role or company. |
| `createOrganization({ name, slug, ...details })` | Verified user with a profile; company, fixed ACTIVE OWNER, selection, Activity and AuditLog commit together. |
| `registerCompany(details)`, `updateCompany(details, expectedId)` | Strict onboarding/profile validation; trusted profile initialization and authorized OWNER/ADMIN settings changes. See [Onboarding](ONBOARDING.md). |
| `listMyOrganizations()` | Lists only the verified user's active memberships. |
| `switchOrganization({ organizationId })` | Verifies active membership in the requested company before selection. |
| `getCurrentOrganization()` | Resolves trusted selected company plus current active membership. |
| `createBranch`, `listBranches` | Tenant-scoped; branch creation requires OWNER/ADMIN. |
| `inviteMembership`, `acceptInvitation`, `approveMembership` | Verified acceptance activates new memberships; approval remains for legacy PENDING records. See [Team](TEAM.md). |
| `setMembershipRole`, `setMembershipStatus` | Authoritative role/target checks; no self-administration, OWNER changes or restoration of removed members. |
| `listInvitations`, `listAuditLogs` | Tenant-scoped OWNER/ADMIN reads with bounded pagination; token digests are omitted. |

Company names accept 2–120 characters; slugs accept 3–63 lowercase ASCII letters/digits separated by single hyphens. Strict input validation rejects role, owner UID and tenant injections. The database's unique slug constraint resolves concurrent attempts. Recognized duplicate-slug failures map to fixed `409 ORGANIZATION_SLUG_TAKEN` errors without returning raw SQL or provider data.

A profile remains a prerequisite for the original company-creation service. Signup intentionally creates no database profile. The onboarding endpoint initializes a missing profile from verified identity, then invokes the atomic company transaction. Missing profile is `409 PROFILE_REQUIRED`; missing selection is `409 ORGANIZATION_REQUIRED`. See [Onboarding](ONBOARDING.md) for the protected HTTP boundary and UI.

## Invitation and membership lifecycle

The four business roles are OWNER, ADMIN, MANAGER and AGENT. Only ACTIVE membership grants company access. INVITED, SUSPENDED and REMOVED are supported; PENDING remains the explicit approval state and REVOKED remains a compatible legacy terminal state.

An authorized owner/admin reserves an INVITED membership and creates an Invitation atomically. The server generates a random 256-bit token and stores only its SHA-256 digest. A configurable server provider sends the fragment link; development can show an explicitly unsent preview. Tokens are never logged or included in audit metadata. No public recipient lookup exists. See [Team](TEAM.md).

Acceptance checks organization, digest, verified email, pending/unexpired state, eligible membership, matching role and current issuer authority. It consumes the link once and atomically activates membership, selects the company and audits acceptance. Concurrent replay cannot create a second event. Approval remains only for legacy PENDING records.

Owners may manage non-owner members. Administrators may manage only MANAGER/AGENT targets and grant those roles. Manager/agent authority cannot be self-elevated. Every owner is immutable in this phase, so the last active owner cannot be removed, suspended or demoted—even through concurrent requests. Owner transfer and removal when another owner exists require a separately reviewed workflow.

Removing a member invalidates their next tenant operation even if their Firebase session and selected-company preference remain valid. Outstanding pending invitations are revoked transactionally when the reserved membership is suspended or removed. REMOVED/REVOKED remain terminal for the exposed status operation. A separate re-invitation transaction can restore only a never-accepted revoked reservation with no bound UID or acceptance/approval markers; it restores INVITED rather than ACTIVE and requires a fresh matching-email acceptance. Previously accepted member reactivation is not implemented. Pending invitations support secure token reissue, and revoked reservations support re-invitation, with a one-minute cooldown.

Normal tenant operations use verified-user impersonation. RecordInvitationDelivery is the explicit server-only NO_ACCESS exception for independently verified provider receipts; see [Team](TEAM.md#narrow-privileged-receipt-operation). It grants no membership and accepts no actor from HTTP input.

## Migration and rollout

No hosted changes are performed by this task. The local Firebase config selects `dataconnect/connector`, retaining connector ID `example` and `COMPATIBLE` schema validation. The regenerated `dataconnect/example` movie starter is left untouched but excluded from active connector directories. Do not deploy that starter or remove the existing CRM operations.

For a future explicitly authorized staging/hosted rollout:

1. Select and record the intended Firebase project, service, location, connector and release. Verify a restorable database backup. Review the existing US-region configuration against data-residency requirements before collecting customer data.
2. Compile locally and review the generated DDL. Add Invitation and AuditLog tables, their composite foreign keys, unique constraints/indexes and new enum values. Keep UserProfile, Organization, Membership, Branch, Lead and Activity data, legacy invitation columns, and existing enum values. Do not use STRICT/force migration to drop unrelated data.
3. Review outstanding INVITED memberships before changing acceptance behavior. New acceptance requires an Invitation row and will reject a legacy membership digest alone. If preserving an invitation, explicitly backfill a matching same-company ledger row only after verifying its issuer, recipient, allowed role, valid SHA-256 digest and unexpired deadline. Resolve duplicate digests and invalid/unknown issuers rather than inventing identity metadata. No automatic hosted backfill is supplied or executed.
4. Preserve old Activity history. AuditLog records new security events after rollout. If historical audit backfill is required, separately review source completeness and map original actor/time/targets without copying private notes or inventing events. The application does not silently claim a complete historical audit archive.
5. With separate approval, apply the reviewed compatible schema migration, any reviewed data backfill and matching connector rollout before deploying the application/SDK that requires the new operations. Recompile/regenerate together; stored operation names and parameters used by existing Leads/auth flows remain compatible. Follow the detailed [SQL Connect runbook](SQL_CONNECT.md#future-hosted-migration-separate-approval-required).
6. Run staging checks with real Firebase identities and IAM: new company creation, duplicate/concurrent slugs, invitation consumption/expiry, owner protection, membership removal, cross-company reads/writes and safe errors. Verify old public sample operations are absent from the selected connector.
7. Retain added tables/columns and compatible enums during application rollback. Do not drop audit or invitation history as a UI rollback. Record release evidence, backup/recovery ownership and operational monitoring.

## Local validation and evidence

```powershell
npm.cmd run sql:validate
npm.cmd run sql:generate
npm.cmd test
npm.cmd run test:dataconnect
npm.cmd run lint
npx.cmd tsc --noEmit
npm.cmd run build
```

The SQL suite seeds a disposable loopback `demo-estateos` database. It verifies company creation and a late-audit-FK failure derived from the actual operation: the deliberately failed transaction leaves no company, owner membership, selection update, Activity or AuditLog write. The fault probe exists only in the emulator test file, never as a deployable operation or production input flag.

Tests also cover concurrent duplicate slugs, all tenant/role boundaries, unrelated private leads, invitation replay/expiry and digest redaction, removed-member access, terminal states, rejected writes without audit side effects, same-company foreign keys and concurrent last-owner change attempts. Authentication tests reject invalid, expired and revoked sessions before database access.

Company onboarding/settings/selection, team management, provider invitations and re-invitation of never-accepted revoked reservations are connected. Ownership transfer, reactivation of previously accepted removed members, granular sharing, independent audit retention, hosted IAM, monitoring, backup/restore and privacy review remain. This is not a declaration of production readiness.
