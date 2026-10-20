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
| Read/create/update organization leads | Yes | Yes | Yes | Assigned to self only |
| Change lead status, add notes, schedule/complete follow-up | Organization leads | Organization leads | Organization leads | Assigned leads only |
| Assign leads | Active same-company members or unassigned | Same | Same | Dedicated assignment unavailable; edits preserve self-assignment |
| Create branches | Yes | Yes | No | No |
| Read organization-wide activity/member lists | Yes | Yes | No | No |
| Invite/approve/manage ADMIN membership | Yes | No | No | No |
| Invite/approve/manage MANAGER or AGENT membership | Yes | Yes | No | No |
| Change another active member's non-owner role | ADMIN / MANAGER / AGENT targets | MANAGER / AGENT targets only | No | No |
| Read invitation ledger or security audit log | Yes | Yes | No | No |
| Change own role/status or grant existing-company OWNER | No | No | No | No |

Managers currently have organization-wide lead access because there is no team-sharing model. Branch filtering does not restrict managerial access. Agents cannot read unrelated or unassigned leads, inspect their notes, or claim a private lead by submitting their own membership ID. Lead assignees must be active, registered members of the same organization.

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
