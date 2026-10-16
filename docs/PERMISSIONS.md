# EstateOS permissions

Firebase Authentication establishes identity. An active database membership establishes organization access and role. Both are checked on the server; route groups, visible controls, cookie presence, a selected company and client-submitted roles never authorize an operation.

## Request boundaries

1. Protected rendering and operations verify an unexpired, unrevoked Firebase session with a verified email. Invalid sessions redirect protected page visitors to login; APIs reject the request.
2. Organization services resolve `UserProfile.activeOrganizationId` and verify that the current identity has an `ACTIVE` membership in that organization. Company switching independently verifies membership in the requested company.
3. Services validate input and derive identity, tenant and role from trusted data. The lead mutation organization header only detects stale company selections; it grants no scope.
4. SQL Connect stored operations independently enforce membership, tenant, record visibility and permitted references. Generated Admin SDK calls always receive verified-user impersonation options for normal application operations.
5. Cookie-authenticated mutations require the exact configured origin, CSRF protection and validated bounded input. Sensitive writes and their activity events are transactional.

Checks occur at each operation boundary. A workspace layout check alone cannot protect an API route or a record lookup. Searches, counts, pagination and activity timelines apply the same record visibility rules as lead reads.

## Role matrix

| Capability | OWNER | ADMIN | MANAGER | AGENT |
| --- | --- | --- | --- | --- |
| Read organization and branches | Yes | Yes | Yes | Yes |
| Read/create/update organization leads | Yes | Yes | Yes | Assigned to self only |
| Change lead status, add notes, schedule/complete follow-up | Organization leads | Organization leads | Organization leads | Assigned leads only |
| Assign leads | Active same-company members or unassigned | Same | Same | Dedicated assignment unavailable; edits preserve self-assignment |
| Create branches | Yes | Yes | No | No |
| Read organization-wide activity/member lists | Yes | Yes | No | No |
| Invite/approve/manage ADMIN membership | Yes | No | No | No |
| Invite/approve/manage MANAGER or AGENT membership | Yes | Yes | No | No |
| Change own role/status or grant existing-company OWNER | No | No | No | No |

Managers currently have organization-wide lead access because there is no team-sharing model. Branch filtering does not restrict managerial access. Agents cannot read unrelated or unassigned leads, inspect their notes, or claim a private lead by submitting their own membership ID. Lead assignees must be active, registered members of the same organization.

## Membership lifecycle

An authorized organization-creation transaction creates a new organization and its fixed `OWNER`/`ACTIVE` membership together. It cannot promote a user in an existing company. Signup creates neither a company nor a privileged membership.

Invitations begin as `INVITED`. Acceptance requires the matching verified email and a valid single-use expiring token, then binds the profile and changes status to `PENDING`. Authorized approval is required for `ACTIVE` access. `INVITED`, `PENDING`, `SUSPENDED` and `REVOKED` memberships grant no organization data access. Self-administration, owner changes and granting an equal/higher role are unavailable through membership administration.

## Code and verification

- `src/modules/auth/server/`: session, origin, cookie and CSRF policies.
- `src/lib/auth/session.ts`: reusable verified-session lookup and protected-page guard.
- `src/modules/organizations/server/context.ts`: trusted organization/membership resolution.
- `src/modules/organizations/server/permission-policy.ts`: role and assignment business rules.
- `dataconnect/connector/`: explicit operation authorization and tenant predicates.
- `tests/auth-*.test.ts`, `tests/tenancy-*.test.ts`, `tests/leads-*.test.ts` and `tests/sql-connect.integration.test.mjs`: session, role, validation and database boundary coverage.

Run `npm.cmd test` and `npm.cmd run test:dataconnect`. The local emulator suite covers cross-company access, unrelated private leads, manager access, invalid references/statuses, non-active memberships and audit behavior. Hosted IAM, real-project staging checks, more granular sharing and operational release controls remain outstanding. This structure does not make the application production-ready.
