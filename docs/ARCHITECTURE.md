# EstateOS architecture

EstateOS is planned as a multi-tenant real estate CRM for UAE agencies. Phase 1A supplies the application shell; Phase 1B adds real Firebase authentication and the SQL Connect tenant foundation. The first connected CRM module is Leads, with organization and assignment checks in both server services and stored operations. Organization onboarding interfaces, more granular sharing and operational release checks remain future work. It is not a production-ready CRM.

## Current implementation: shell, identity and tenant services

- Next.js App Router, strict TypeScript, Tailwind CSS, existing shadcn/ui primitives, and Lucide icons.
- Public homepage, login, sign-up, email verification and password-reset interfaces, plus a protected workspace with responsive navigation.
- Firebase Email/Password authentication using in-memory browser state and server-issued, expiring HttpOnly session cookies.
- Server-only Firebase Admin initialization and shared identity checks for protected rendering and API operations.
- Dashboard components use explicit empty states. KPI values and chart placeholders do not represent business records.
- Every navigation destination has an implemented interface or an explicit unconnected module page.
- Light/dark theme preference is presentation-only and uses `next-themes`.
- Shared headers, empty states, loading views, error boundaries, and a not-found view.
- SQL Connect/PostgreSQL models for organizations, user profiles, memberships, branches, leads and activities.
- Tenant-scoped, explicitly authorized queries/mutations and generated Admin SDK calls impersonating a verified Firebase session identity.
- Server-only organization creation/selection, invitation and membership administration, branch, lead and activity services with validated inputs and transactional audit events.
- Connected Leads search/filter/pagination, create/edit/detail forms, status pipeline, active-member assignment, append-only notes, follow-up and an authorized activity timeline.

`/workspace` requires a server-verified Firebase identity with a verified email. Invalid, expired and revoked sessions are rejected. Authentication alone does not establish organization membership: connected data services additionally resolve active membership and its role. Leads pages call the authorized lead, branch and active assignee services and show explicit missing-profile/company, empty and unavailable states. Other CRM modules remain unconnected. Company onboarding, membership administration interfaces, billing, AI requests and marketing/communication integrations remain unimplemented.

## Source organization

```text
src/
  app/
    (public)/page.tsx        Public homepage at /
    (auth)/
      login/                 Firebase login at /login
      signup/                Account registration at /signup
      forgot-password/       Password reset email
      verify-email/          Verification guidance and controls
    api/auth/                CSRF and verified session route handlers
    api/leads/               Session/origin/CSRF-protected lead HTTP boundary
    (workspace)/workspace/   Protected shell; retains /workspace URL prefix
      dashboard/             Dashboard composed from empty-state panels
      leads/                 Connected list/new/detail/edit lead routes
      contacts/, ...         Explicit routes for remaining module placeholders
  components/
    layout/                  Application shell and navigation
    shared/                  Headers, empty states, and reusable presentation
    ui/                      shadcn/ui primitives
  config/
    navigation.ts            Typed navigation and module route catalog
  modules/
    auth/                    Auth UI, client flows and server session policy
    organizations/server/    Validated tenant services, scope and permission rules
    leads/                   Shared Zod schemas, UI and server-only services
    ...                      Feature-specific components
  lib/
    auth/session.ts          Shared verified-session access and route protection
    firebase/                Separate browser and server-only Admin SDK setup
    ...                      Shared utilities
  dataconnect-admin-generated/ Generated server SDK, not handwritten domain code
docs/
  ARCHITECTURE.md
  AUTHENTICATION.md
  SQL_CONNECT.md
  DATABASE.md
  PERMISSIONS.md
  LEADS.md
  ROADMAP.md
dataconnect/
  schema/schema.gql          Six relational tenant models and constraints
  connector/                Authorized operations and Admin SDK generation
  seed_data.gql             Emulator fixtures, excluded from deployed connector
```

Route groups organize source files without changing URLs. Keep the top-level root layout, global error/loading views, stylesheet and application icons in `app/`. The workspace's authorization layout stays inside `(workspace)/workspace/`. Grouping routes does not provide authentication or authorization by itself.

The navigation catalog is the single source for sidebar links and module descriptions. Dashboard has its own route. Leads has explicit list/new routes and UUID detail/edit routes. Remaining planned modules render `modules/workspace/components/module-preview.tsx` using the catalog. Unknown module paths return a 404. Route-level loading/error states handle rendering transitions and failures; they do not imply a connected backend. Request-dependent Leads rendering sits inside destination-local Suspense boundaries, preserving uncached identity and instant-navigation behavior.

Modules own their UI, types, validation and server services. Shared Firebase infrastructure stays in `lib/firebase`, and verified session access in `lib/auth/session.ts`; authentication policy and organization permission rules stay with their owning modules. Add shared `lib/permissions`, `lib/validation` or `types` files when there is code to share. Agent/property domain modules will be introduced when their functionality is implemented; their current navigation destinations remain explicit placeholders. Do not create parallel implementations or empty module scaffolding just to match a proposed tree.

The SQL Connect directory is named `connector`, while its configured connector ID remains `example` to preserve existing SDK and service identity. This organization refactor changes no database schema, operation authorization or hosted resources. See [Database](DATABASE.md) for the data model and [Permissions](PERMISSIONS.md) for access rules.

## Target architecture

Begin with a modular monolith. Keep domain behavior in feature modules rather than page components. Introduce each layer only when its feature is implemented:

```text
modules/<module>/
  components/                Feature UI and view models
  validation/                Schemas for untrusted input
  server/
    service.ts               Business rules and authorized use cases
    repository.ts            Organization-scoped data access
  tests/                     Business rules and permission coverage
```

App Router pages and server actions/route handlers should coordinate requests. Validation accepts only documented inputs. Services enforce business rules and permissions. Repositories own database queries and receive a verified organization scope. Client components are reserved for interaction; credentials and protected data access remain in server-only modules. Avoid browser imports of privileged modules.

Firebase Authentication is connected when valid development-project configuration is supplied. Firebase SQL Connect with PostgreSQL now supplies the first relational models and server services; Firebase Storage and Firebase App Hosting remain planned. OpenAI is reserved for a later Copilot phase. Cloud provisioning or deployment requires separate approval.

## Implemented identity boundary

Browser Firebase credentials are held in memory. A recently authenticated, verified password account exchanges an ID token for a five-day HttpOnly session. The Admin SDK verifies sessions, including revocation, in server-only code. Session mutations require an exact configured origin and CSRF cookie/header pair; production uses HTTPS and `__Host-` cookies. Logout clears the local cookie and revokes the user's Firebase sessions across devices.

Protected rendering and the session API use a common server identity helper. Checks at the workspace layout and page/component boundary avoid treating client navigation state or a shared layout alone as authorization. Missing provider configuration fails closed. No default admin, client-supplied role, or mock authenticated identity exists.

Request-time session checks render inside local `Suspense` boundaries in the shared module view, dashboard, workspace redirect, and workspace not-found view. The layout's boundary handles initial shell rendering; destination-level boundaries handle navigation between siblings below that persistent layout. Their fallbacks contain only deterministic skeleton UI. Session verification remains uncached across requests; do not add `use cache` to authentication checks or disable instant-navigation validation to hide a missing boundary.

See [Authentication](AUTHENTICATION.md) for environment setup, endpoint behavior, cookie policy, manual checks, and the current limitations.

## Tenant scope and permissions

Verified Firebase identity is the first boundary. The organization service boundary resolves the selected organization and active membership from trusted data, checks membership status, and derives the actor and organization context. A requested organization switch must pass an active-membership check; the selected profile field is a preference, not a grant. Every subsequent data operation rechecks active membership. Never accept client-provided roles or organization IDs as authority.

Use one common authorization mechanism across protected pages, server actions, route handlers, background jobs, and data access. Check capabilities at the operation boundary and enforce record visibility in queries, including reads, updates, deletes, search, counts, reports, storage access, and exports. A layout guard alone is insufficient to secure a directly invoked mutation or API endpoint. Authorization should default to deny.

Roles are `OWNER`, `ADMIN`, `MANAGER` and `AGENT`. A dedicated transaction creates a new organization and fixed active owner together. Existing-organization ownership cannot be self-assigned. Owners may administer non-owner memberships; administrators may manage only managers and agents. Self role/status edits and owner changes are unavailable. Invitation acceptance requires the matching verified email, unexpired single-use token, and a later authorized approval before access begins. See [SQL Connect](SQL_CONNECT.md) for the permission matrix, lifecycle and test runbook.

Current lead permissions grant organization-wide access to active owners, administrators and managers. Active agents can create/read/update only leads assigned to themselves. The connector repeats this restriction for direct operation calls. Branch visibility and approved sharing remain future work; assigning a branch does not establish a branch ACL. Platform administration requires a separately verified privileged context, not a client flag.

Tenant-owned primary keys include organization plus UUID. Composite branch, assignee and lead foreign keys reuse that organization identifier to reject cross-tenant relationships in PostgreSQL. Queries and mutations require explicit authorization; sensitive checks are redacted. Transactional writes use server timestamps and write their `Activity` audit event atomically. The generated SDK is called with verified identity impersonation for normal service operations; unrestricted Admin execution is reserved for loopback-only fixture setup.

## Connected Leads boundary

Leads pages obtain private records through the shared server service, never through a browser Admin SDK or a dummy-data fallback. Search, filters, counts and pagination run in SQL Connect with the same tenant and record restrictions. The UI uses shared Zod schemas for useful feedback; the server validates again before every generated-SDK call. Status and assignment operations inspect the existing lead so changing a request's assignee cannot claim a private record.

Cookie-authenticated HTTP writes independently verify the session and exact configured origin/CSRF pair. They accept at most 16 KiB of JSON object data, enforce strict schemas and compare `x-estateos-organization` against the server-resolved selection to reject a stale form after company switching. That header is a consistency guard and cannot establish tenant scope. Reads and writes are uncached across private request contexts; responses do not expose raw provider details.

Lead notes are append-only `Activity.note` values, returned only by a lead-specific authorized timeline. Generic audit metadata contains safe identifiers/state transitions. Nullable `Lead.followUpAt` and `followUpNote` represent one upcoming follow-up, and dedicated transactional operations schedule/complete it with audit events. This creates no reminders, background jobs or external calendar calls. See [Leads](LEADS.md) for behavior, permission tests and additive migration steps.

## Data and security boundaries

- Include organization scope in tenant-owned entities and validate tenant consistency for relationships.
- Do not fetch records globally and filter them in the browser. Apply authorization before returning data.
- Use validated, bounded input for writes, pagination, search, filters, uploads, and exports.
- Protect sessions and mutation endpoints using the controls appropriate to the chosen session mechanism, including revocation and request-forgery protections.
- Keep privileged provider tokens and service credentials server-side; never expose secrets in `NEXT_PUBLIC_*` values or source control. Firebase web configuration is public project identification, not an Admin credential.
- Authorize file access and upload metadata against organization membership and record access.
- Record sensitive changes in audit logs with actor, organization, action, target, timestamp, and safe metadata; do not log secrets.
- Use explicit per-organization cache keys and invalidation. Do not share cached private data across tenants.
- Define retention, deletion, consent, and UAE-relevant compliance requirements before collecting customer data.

## Frontend principles

Prefer accessible semantic controls, visible focus indicators, labeled fields, and sufficient contrast. Support keyboard navigation, desktop sidebar collapse, mobile navigation, and narrow screens. Use restrained transitions and honor reduced-motion preferences. Theme persistence and sidebar state are convenience preferences, not session or security state.

Each feature must distinguish loading, empty, error, and populated states. A missing CRM backend is shown as not connected, not as fabricated success. Authentication forms transmit credentials only to the configured Firebase provider and exchange ID tokens with same-origin session handlers; they display real loading and failure states.

## Validation strategy

Run `npm test`, `npm run lint`, `npx tsc --noEmit`, and `npm run build`. Authentication boundary tests cover session/request policy without real cloud credentials; live provider behavior needs the development-project checks in [Authentication](AUTHENTICATION.md). Verify public routes, protected-route redirects, workspace destinations, 404 behavior, mobile navigation, keyboard controls, and both themes.

Tenant/Leads policy tests and SQL Connect emulator integration tests cover membership states, role restrictions, owner bootstrap, invitation boundaries, cross-tenant reads/writes, relationship constraints, private agent leads, permitted manager access, assignment/status rejection, note/follow-up/timeline authorization and real query pagination. Lead request tests cover strict inputs, stale-company guards and bounded streamed JSON. Run the integration suite separately as documented in [SQL Connect](SQL_CONNECT.md); authentication unit tests alone do not establish tenant isolation. Deployment readiness additionally requires staging integration, accessibility, HTTPS session, data migration, monitoring, recovery, privacy and operational checks.
