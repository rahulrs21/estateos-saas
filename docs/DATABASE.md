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
