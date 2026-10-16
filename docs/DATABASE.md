# EstateOS database

Firebase SQL Connect with PostgreSQL is the only application database layer. The source schema is [schema.gql](../dataconnect/schema/schema.gql); authorized operations are in [queries.gql](../dataconnect/connector/queries.gql) and [mutations.gql](../dataconnect/connector/mutations.gql). Runtime services use the generated Admin Node SDK from server-only modules with the verified user's impersonation options.

## Models and relationships

| Model | Key | Relationships and purpose |
| --- | --- | --- |
| Organization | UUID `id` | Tenant; created by a user profile. Its slug is unique. |
| UserProfile | Firebase Authentication `uid` | Identity metadata and optional selected organization; selection grants no access. |
| Membership | `(organizationId, id)` | Optional profile binding, authoritative role and invitation/approval state. Organization/email and organization/profile pairs are unique. |
| Branch | `(organizationId, id)` | Organization branch with a unique name within its tenant. |
| Lead | `(organizationId, id)` | Contact details, status, optional branch/assignee and one optional follow-up. |
| Activity | `(organizationId, id)` | Verified actor, action, timestamp, optional lead and append-only private note. |

Organizations, memberships, branches, leads and activities use UUID identifiers. User profile identifiers remain Firebase UIDs. Tenant-owned foreign keys include `organizationId`: leads cannot reference another company's branch or membership, and activities cannot reference another company's lead. SDK UUIDs can arrive as compact hexadecimal strings; application validation normalizes them before comparing identifiers.

`createdAt` defaults to the server request time. Updates explicitly maintain `updatedAt`; activity events have a creation timestamp. Declared indexes cover membership status/profile lookup, organization branch lists, lead status/assignment/branch/follow-up filters and chronological activity retrieval. Names, contact fields, invitation digests and note text have bounded database column lengths.

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

Folder organization requires no database migration. Future schema changes require a reviewed diff, backup/recovery plan, compatible schema/connector rollout and staging verification. No deployment or cloud provisioning is part of this refactor. Follow the full [SQL Connect migration runbook](SQL_CONNECT.md#future-hosted-migration-separate-approval-required) and [Leads additive migration notes](LEADS.md#schema-and-migration).

There are no implemented task, deal, property, billing or team tables yet. A lead's converted status does not create another entity, and a follow-up does not send a notification. Organization onboarding and membership administration interfaces remain future work. See [Permissions](PERMISSIONS.md) for authorization and [Roadmap](ROADMAP.md) for future scope.
