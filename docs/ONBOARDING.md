# Company onboarding and workspace selection

Phase 3 connects the existing tenant backend to the EstateOS UI without changing Firebase authentication or redesigning the dashboard.

## Routes and behavior

- `/onboarding/company`: verified-session workspace entry. A user with an active selected company returns to their dashboard. A member with no valid selection sees their authorized workspace choices. A recipient without an active company who has pending invitations goes to `/invite/accept`. Other users choose **Join your team** or **Start your own company**; registration fields are not shown automatically after sign-in.
- `/onboarding/company?new=1`: explicitly create an additional, separate company. This flag changes the UI only; it grants no permissions.
- `/settings/company`: current company profile and workspace selector. All active members may read the profile; only OWNER/ADMIN may save changes.
- `/workspace/settings`: compatibility redirect to company settings.
- `/workspace/dashboard`: existing dashboard design with the current company's name. Analytics still show empty states.
- `/invite/accept`: shows only invitations matching the signed-in user's verified email, including when no SQL profile exists. Opening or pasting the complete invitation link and explicitly accepting it is still required. Pending invitations are not workspace access.

The sidebar includes workspace selection and the header identifies the selected company. Company switching and creation perform a full document navigation to the dashboard, discarding the previous company's router cache and client form state. The selected company is stored as a user preference in PostgreSQL, shared across that user's sessions. Another tab's existing forms may become stale; settings and lead writes reject a mismatching organization header. Reload those tabs before continuing.

Every company uses the same WorkspaceShell and Dashboard components. The sidebar starts expanded for a newly selected company and remains mounted during viewport changes. Desktop CSS and the mobile media-query hook use the same 768 CSS-pixel boundary; browser font preferences must not put the sidebar into conflicting CSS/JavaScript modes. Below that boundary navigation opens in a mobile drawer. Collapsing the desktop sidebar is a presentation preference, not a role or organization permission. Company names, account identity and authorized records are the context-specific differences.

The header toggle and the collapsed sidebar's expand button both restore full navigation. Toggle updates use the latest queued state, including rapid clicks, and blocked preference cookies do not disable navigation. Buttons expose their current expanded state and the navigation they control.

The global stylesheet explicitly scans `src` using Tailwind's stylesheet-relative `source("../")` setting. This ensures responsive display utilities are generated for the sidebar regardless of the process working directory or development launcher. See [Tailwind source detection](https://tailwindcss.com/docs/detecting-classes-in-source-files#setting-your-base-path).

Run `npm run test:sidebar` for isolated browser regression checks. It tests the real shell in installed Chrome and Edge using temporary profiles, two synthetic UI company contexts, desktop/mobile and fractional viewport widths, pointer and keyboard controls, rapid toggles and blocked preference cookies. The fixture imports the application's stylesheet without adding its own source scan. Set `ESTATEOS_TEST_APP_URL` to `http://127.0.0.1:3000` while the app is running to test a snapshot of the CSS actually served by its public homepage instead. This also detects missing generated responsive styles, even when state updates and button events work. Set `ESTATEOS_TEST_BROWSER` to a Chromium executable to select another compatible browser. The loopback fixture never signs in, creates memberships or calls Firebase; authentication and organization authorization remain covered by the separate suites. Temporary servers and profiles are removed after the checks.

Ordinary login must work for invited agents as well as agency founders. Workspace resolution checks active memberships first, then uses the verified-email GetMyPendingInvitations operation when none exist. Only invitation metadata (company name, invited role, expiry and invitation identifier) is returned; no token or digest is recoverable. A stale/incorrect preference cannot manufacture membership. Database discovery failures display an error/setup state rather than being treated as an empty invitation list.

## Company information

Registration requires a company name, unique normalized slug, UAE emirate, contact phone, company email and company-size range. The same strict Zod schema validates client feedback and server inputs. Roles, identities, tenant IDs, membership states and logo URLs cannot be submitted as company fields.

Organization has nullable `emirate`, `contactPhone`, `companyEmail` and `companySize` columns for additive compatibility with existing companies. Legacy records remain accessible without forced onboarding; owners/admins can complete them in settings. Stored-operation creation retains optional metadata for compatibility with existing connector consumers, while the onboarding HTTP endpoint requires all form fields.

Logo uploads are deferred. There is no upload endpoint, arbitrary remote logo URL, Storage provisioning or unverified file access.

## Trusted write flow

`POST /api/organizations` verifies the HttpOnly Firebase session, exact configured origin and CSRF token, then reads bounded JSON (16 KiB maximum). Missing profiles are created from the verified user's UID, email and display name; request JSON cannot choose identity. Profile initialization grants no membership.

The existing CreateOrganization transaction writes company details, a fixed ACTIVE OWNER membership, selected-company preference, Activity and AuditLog together. No role is accepted from the form. A failed company transaction creates no partial company, membership or successful audit event. A separately initialized identity profile may remain after failure. Duplicate slugs return a safe 409 response.

`PATCH /api/organizations/current` derives the company from trusted selection, checks the request's organization consistency header, verifies an active OWNER/ADMIN membership and validates company fields. UpdateOrganization repeats authorization in SQL Connect, locks the actor membership, applies scoped changes and appends Activity/AuditLog atomically. Contact data is excluded from audit metadata.

`POST /api/organizations/switch` takes only an organization UUID selector. SwitchOrganization independently checks active membership before changing the preference and recording audit events. The supplied ID or custom role claims never authorize access.

All normal SDK calls include verified-user impersonation. API responses are private/no-store and sanitize provider errors. The app uses Next.js Cache Components, which requires Node.js; it does not use unsupported runtime segment exports or cache private membership checks across requests. Database failures display retry/error states and do not masquerade as a new user with no memberships.

## Migration and local verification

No hosted schema migration or deployment is performed by this implementation.

1. Follow [Multi-tenancy rollout](MULTI_TENANCY.md#migration-and-rollout), including existing Phase 3A invitation backfill prerequisites.
2. Review compatible DDL for nullable Organization columns, the GraphQL Emirate/CompanySize enums and ORGANIZATION_UPDATED activity value with their generated SQL representation. Keep existing company data, slugs and memberships. No filler company records are created.
3. Compile and regenerate the SDK with `npm run sql:validate` and `npm run sql:generate`.
4. Run `npm test`, `npm run test:dataconnect`, `npm run lint`, `npx tsc --noEmit` and `npm run build`.
5. After separate approval, apply the reviewed additive migration and matching stored operations before releasing the app/SDK. This work does not deploy or provision resources.

The local integration suite uses a disposable loopback demo database and synthetic fixtures only. It tests new company fields/OWNER bootstrap, legacy nullable records, authorized settings changes, rejected role/tenant/verification attempts, duplicate-slug rollback, safe switching and bounded membership pagination. Unit tests cover strict validation, onboarding decisions, stale selection, excluded memberships, bounded JSON and origin/CSRF checks. Existing auth tests cover invalid, expired and revoked sessions.

## Manual checks

If the database setup page appears after login, stop the current development
server and run `npm run dev:local`, keep the terminal open, then revisit
`/workspace/dashboard`. This runs real local SQL Connect without seed company
records. Firebase login remains connected as configured. For a hosted database,
complete the separately reviewed schema/connector rollout instead.

1. Start the configured development app and SQL Connect backend (local emulator instructions are in [SQL Connect](SQL_CONNECT.md)). A verified Firebase login and working SQL Connect configuration are required. No dummy company fallback exists.
2. Sign up, verify email and log in with a user who has no memberships or invitations. Opening the workspace should offer joining a team or starting a company. Select **Start your own company** to open registration. Submit invalid fields and confirm accessible field messages; submit valid fields and confirm the company dashboard, name and OWNER membership.
3. Refresh and sign in again. The company dashboard should open without repeating registration.
4. Open company settings, change company details and save. Verify the company name updates in the header. Reusing another company's slug must fail without partial changes.
5. Use “Create another company,” then switch between companies from settings or the sidebar. Confirm each dashboard name and Leads list belong to the selected company. A lead detail URL belonging to another company must remain inaccessible.
6. With a second account that has an authorized ACTIVE AGENT/MANAGER membership, confirm settings are read-only and a direct settings mutation is rejected. Use the authorized Team/Invitations settings to arrange this test; see [Team](TEAM.md).
7. In another tab, leave a settings or lead form open, switch company in the first tab, and try saving the old form. It should fail with a reload message.
8. Log out. Opening onboarding, settings or workspace pages must redirect to login; company API mutations without a session return 401. Verify keyboard navigation, mobile sidebar, both themes, and loading/error states.
9. Invite a new email as AGENT, register/verify that account, then log in through `/login` rather than the invitation page. It should land on `/invite/accept`, showing the invitation without asking for company details. Open or paste the full private link and accept. The company dashboard should open with AGENT membership; sign out/in again and confirm it remains accessible. A different verified email must not discover that invitation or access the company.

The recipient-discovery operation and generated SDK must be available together. Local emulator users can restart `npm run dev:local`; hosted users need the separately approved stored-operation rollout, including GetMyPendingInvitations. This routing change adds no schema columns and does not backfill, activate or promote legacy memberships. Invited users should not create their own company to bypass invitation problems.

Team settings and configurable invitation delivery are connected. Hosted IAM, restore/monitoring checks, independent audit retention, owner transfer and complete member lifecycle controls remain release work. This is not a production-readiness declaration.
