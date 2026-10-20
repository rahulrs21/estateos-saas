# Team management and secure invitations

Phase 3 adds `/settings/team`, `/settings/team/invitations` and `/invite/accept`. It reuses Firebase sessions, company selection, CSRF protection, generated SQL Connect SDKs and the existing workspace design. No new Leads or property functionality is implemented.

## Authorization

Only ACTIVE organization OWNER/ADMIN members may list/search the team and invitations. Owners may invite or manage ADMIN, MANAGER and AGENT members. Administrators may invite/manage only MANAGER and AGENT targets. All self role/status edits and all OWNER edits are rejected; protecting every owner is the current stricter implementation of last-owner safety. There is no platform-admin grant or custom-claim authorization shortcut.

Settings reads and writes resolve the company on the server. The HTTP organization header detects stale forms after switching; it is not authority. Mutations independently require a verified session, exact origin, CSRF token, bounded JSON and strict Zod inputs. SQL Connect repeats organization, membership, role and target predicates with authorization locks and transactions.

Team search/count/pagination run in the database with identical tenant predicates. Search treats %, _ and backslash literally. Pages contain 25 rows, with bounded offsets. Registered members are listed separately from unaccepted membership reservations.

## Invitation lifecycle

1. An authorized administrator submits email and an allowed organization role. The server generates a 256-bit random base64url token; only its SHA-256 digest is stored. Organization/email and organization/user uniqueness prevent duplicate reservations and memberships, including concurrent requests.
2. A transaction reserves an INVITED membership, creates a PENDING Invitation and records Activity/AuditLog events. Raw secrets never enter audit metadata or database rows.
3. The email link is `/invite/accept#organizationId=...&membershipId=...&token=...`. The fragment is handled by the browser and is not sent in HTTP URLs or referrers. No public invitation-lookup endpoint exposes recipients or company details.
4. Guests can log in, sign up, reset passwords and resend verification from the invitation screen using the existing Firebase flow. Registration still requires email verification. After verification, return to the original invitation tab/link and log in there. Ordinary `/login` also detects pending invitations for the verified email when the user has no active company and routes to `/invite/accept`. The recipient sees company/role/expiry information and can paste the complete original link. No company registration is required. The original link is needed across devices; no raw-token browser storage is added.
5. Acceptance is an explicit CSRF-protected POST, never a GET or automatic mount action. The backend derives UID/email and the initial display name from the verified session. Firebase signup alone does not create a SQL profile. Invited users do not need to create a company or visit onboarding first.
6. AcceptInvitation checks the recipient's verified email, token digest, expiry, PENDING invitation, unbound INVITED membership, matching stored role and the issuer's current grant authority. It locks issuer authorization and conditionally consumes the invitation.
7. The same transaction upserts the recipient's profile once, preserving an existing display name, binds the verified UID, changes membership to ACTIVE, records issuer approval/time, selects the company and appends Activity/AuditLog. The profile is initialized before recipient foreign keys are written. Invalid acceptance leaves no new profile or selected company; later failures roll back every write. The user enters their authorized dashboard immediately. Concurrent replay, revocation and duplicate-user failures cannot leave partial activation.
8. Revocation invalidates the pending link and moves its reservation to REMOVED. Reissue of an unaccepted PENDING invitation rotates its digest/expiry and issuer, invalidating the previous link. Reissue is limited to once per minute per invitation, and can refresh an expired pending link.
9. **Re-invite** renews a REVOKED invitation only when it was never accepted and the reserved membership is REMOVED, has no bound UID, and has no acceptance/approval markers. The role must still match across the invitation and reservation. The current OWNER (or ADMIN for MANAGER/AGENT) is reauthorized before a new token/expiry is generated. ReinviteRevokedInvitation atomically restores PENDING/INVITED, replaces the digest with a different value, resets delivery status and issuer, and appends INVITATION_REISSUED activity/audit events with `previousStatus: REVOKED`. The same invitation and reservation IDs are retained; prior revocation audit events are not deleted. Membership stays unbound and cannot access company data until the matching verified email accepts the new link.

**Behavior change:** new acceptance no longer enters the legacy PENDING membership approval step. The old ApproveMembership operation remains only for existing PENDING records; there is no automatic bulk activation/backfill. Roll out the matching stored operation, SDK and UI together.

Expired/revoked/reused links and wrong addresses produce a generic safe error without disclosing the intended recipient. Suspended/demoted issuers cannot activate old invitations. OWNER invitations are unavailable, and a mismatched stored invitation/member role cannot escalate privileges.

Owners can invite multiple distinct email addresses while earlier invitations remain pending. The exact-email GetTeamMembershipByEmail query includes unbound INVITED reservations, requires active OWNER/ADMIN authority and scopes every result to that company. A duplicate pending email returns HTTP 409 with Reissue guidance; a revoked reservation gives Re-invite guidance. Neither creates a second reservation or silently replaces an existing token. Database uniqueness remains the final guard against concurrent creation. Previously accepted/active/suspended/removed members produce a separate membership conflict and cannot be restored through this workflow.

## Email configuration

The built-in server provider is Resend's [send-email API](https://resend.com/docs/api-reference/emails/send-email), accessed with native fetch; no additional dependency is installed.

Set server-only environment variables in a secure environment:

```dotenv
INVITATION_EMAIL_PROVIDER=resend
RESEND_API_KEY=your-server-only-provider-key
INVITATION_EMAIL_FROM=team@your-verified-domain.example
INVITATION_TTL_HOURS=168
```

Use a verified sender/domain configured with your provider. Disable click tracking/link rewriting for invitation emails so the original fragment link is preserved. Validate delivery in staging with your intended email clients. No email is sent by installation, builds or automated tests.

TTL is an integer from 1 to 168 hours, default 168. Both server configuration and the stored mutation enforce the seven-day maximum. Sender/key/origin configuration is checked before creating a production invitation. Credentials never use NEXT_PUBLIC prefixes.

When the provider is unset in development, creation returns a private on-screen preview explicitly labelled **No email was sent**. Only the authorized inviter receives that preview, once; it is not persisted or logged. Production and unspecified/test environments fail closed without a configured provider.

A provider acknowledgement is labelled **accepted for delivery**, not delivered to an inbox. Timeouts, rejections or malformed responses report delivery not confirmed. The invitation stays pending, and the administrator can fix configuration then reissue a new link after the cooldown.

Delivery status is persisted as NOT_SENT, PREVIEW, ACCEPTED or FAILED, with a separate receipt timestamp. Reissue and Re-invite reset it to NOT_SENT. None of these values alter invitation validity or membership authority.

### Narrow privileged receipt operation

All normal organization/team/acceptance operations use verified-user impersonation. The deliberate exception is RecordInvitationDelivery, declared `@auth(level: NO_ACCESS)` so Firebase user SDK calls cannot forge provider receipts. It is called only inside the server-only send workflow after session/role checks.

Its actor UID/company come from that verified server context, not request JSON. The transaction independently locks an ACTIVE OWNER/ADMIN membership and matches the invitation's issuing UID, tenant, reserved membership and current digest before recording a receipt and AuditLog event. It grants no membership/role and exposes no generic audit-write endpoint. It must not be reused as an unrestricted Admin shortcut.

Email sending and PostgreSQL cannot commit atomically together. Creation/reissue is audited before delivery; an accepted external email followed by a database outage/revocation/reissue can prevent the later receipt write. The UI preserves the actual provider outcome with a refresh warning, and a structured server event records the receipt failure without email addresses, URLs, tokens or provider errors. Durable outbox/reconciliation, independent audit retention and inbox-delivery webhooks remain future work.

## Local tests and migration

Run:

```powershell
npm.cmd run sql:validate
npm.cmd run sql:generate
npm.cmd test
npm.cmd run test:dataconnect
npm.cmd run lint
npx.cmd tsc --noEmit
npm.cmd run build
```

For local UI use `npm run dev:local`. No company fixtures are automatically seeded. Unit tests inject provider responses and do not send email. Emulator tests cover tenant/role restrictions, search/count, duplicates, ACTIVE acceptance, replay, expiry, reissue/revocation races, issuer demotion, protected owners and client-forged delivery receipts. Regression tests also start with a new verified identity with no SQL profile, accept concurrently, verify immediate company access and foreign-company denial, preserve existing profile names and verify full rollback for invalid invitations or duplicate UID membership. Tests run in the isolated emulator database, not the local UI database.

Re-invitation tests cover fresh-link-only acceptance, cooldown and TTL limits, role and tenant restrictions, concurrent renewal, retained revocation audit history, delivery reset, duplicate-digest rollback and rejection of previously accepted/removed memberships. The HTTP boundary takes only membershipId; recipient, role, issuer and company are resolved from trusted server/database context. No test sends a real email.

Before a separately authorized hosted rollout:

1. Follow the backup/project/region/compatible-migration runbook in [SQL Connect](SQL_CONNECT.md) and existing [tenant migration prerequisites](MULTI_TENANCY.md#migration-and-rollout).
2. Review additive DDL for Invitation deliveryStatus/default NOT_SENT and nullable deliveryUpdatedAt, plus new delivery/reissue/revocation action enum values. Preserve old hashes, memberships and audit history; do not invent historical email receipts.
3. Review the changed AcceptInvitation semantics (including atomic profile initialization and optional displayName), GetMyPendingInvitations (verified-email recipient discovery), GetTeamMembershipByEmail, ListTeamMembers, RevokeInvitation, ReissueInvitation, ReinviteRevokedInvitation and NO_ACCESS RecordInvitationDelivery operations. ListInvitations now includes reservation state for eligible Re-invite controls. Redeploy matching operations and generated SDK together after approval. The profile, recipient-discovery and re-invitation fixes require operation updates only; they add no tables, columns or enum values. Local emulator operations reload from source; restart `npm run dev:local` to ensure the Next.js process also uses the regenerated SDK.
4. Keep legacy PENDING memberships non-active until explicitly reviewed through the authorized legacy workflow. Never bulk-promote existing records to satisfy the new UX.
5. Configure server provider secrets and a verified sender; exercise real Firebase users and staging IAM, including the deliberately privileged receipt operation. Check spam handling and link-fragment preservation.
6. Do not drop delivery/audit columns during application rollback. An older UI that still expects post-acceptance approval is incompatible with the new acceptance behavior; review rollback operations together.

No hosted deployment, paid resource provisioning or real email sending was performed by this implementation.

## Manual checks and remaining limits

Invite a second verified account as AGENT from company settings. In development, copy the preview to a separate browser profile; sign up/verify if needed, return to that link, sign in and accept. Confirm immediate company access and replay rejection. Try a wrong email, expired link, revoked link and the previous link after reissue. Confirm an ADMIN cannot issue/manage ADMIN memberships and an AGENT cannot access team administration. Switch companies with an old settings tab open and confirm stale mutations fail.

Also log in through the ordinary login page with a new invited account that has no SQL profile. It should reach invitation acceptance, not company registration. A verified recipient can discover only their own invitations and cannot access company records until acceptance. An expired pending invitation remains visible with its expiry so the recipient can request a new link; revoked and accepted invitations are excluded. If no invitation matches, the workspace entry offers joining a team or explicitly creating a separate company rather than automatically displaying registration fields.

Test configured provider acknowledgement/failure using development/staging credentials only. A pending row does not imply email delivery; read its explicit delivery status.

For an email already shown as PENDING, use **Reissue** on that row (after the one-minute cooldown), copy/open the newly generated link, and discard the previous link. The invited account signs up and verifies email if necessary, then signs in through the invitation link and clicks **Accept invitation**. It must not create its own company to work around a missing profile. The owner may create other invitations immediately, without waiting for this acceptance.

For a never-accepted email shown as REVOKED, use **Re-invite** on that row after one minute from the last change. A configured provider receives the new link; otherwise development shows an explicit unsent preview. Send/share only the new link with the recipient. The revoked link remains unusable. Do not delete the Firebase user or database reservation to resend an invitation. Re-invite keeps the existing role; manage role changes after acceptance through the authorized team controls.

Reactivation of previously accepted members, ownership transfer, bulk invites, granular branch/team policies, global distributed email quotas, durable delivery reconciliation and compliance audit archival are not implemented. Existing Leads and property screens are preserved. This milestone is not a production-readiness declaration.
