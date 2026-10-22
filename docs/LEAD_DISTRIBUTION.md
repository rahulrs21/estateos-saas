# Lead distribution

EstateOS supports manual assignment and a company-configured round-robin rule. Distribution is scoped to the active organization resolved from the verified Firebase session. The browser never supplies an organization role or authority claim.

## Eligibility and permissions

- Only active, registered `AGENT` memberships in the rule's organization can be selected as round-robin or manual-assignment targets.
- Owners and admins can manage company-wide settings and leads. A manager may reassign only a lead already within their existing authorized scope. Current manager lead visibility remains assignment-based because branch/team sharing has not been implemented.
- Agents can update their own availability, but cannot configure rules or assign leads.
- The `distributionEligible` membership field is an admin-selected routing preference. It does not grant permission to read or edit a lead.
- Branch filters use the tenant-scoped Branch relation. Project filters remain UUID values until the Projects model exists; do not treat these values as validated project access.
- Suspended, removed, unregistered or cross-company memberships are rejected. A target role cannot be elevated through assignment.

## Round robin and concurrency

The rule cursor stores a version and last-selected membership. Lead creation, assignment-history insertion, cursor increment, audit/activity writes and notifications execute in one SQL Connect transaction. The mutation compares the cursor version before advancing it. Concurrent requests using a stale version abort rather than overwriting one another. The server rereads the rule and eligible agents and retries a bounded number of times. A stable lead UUID makes retries idempotent if a previous transaction committed but its response was lost. Do not implement rotation as an in-memory or unconditional read/update/write counter.

The policy sorts eligible membership UUIDs deterministically and starts after the last persisted membership. When configured to skip unavailable agents, explicit unavailable rows are excluded unless their `unavailableUntil` has elapsed. Missing availability rows mean available. If business hours are enabled, the configured IANA timezone, weekday mask and inclusive start/exclusive end time are evaluated by the server.

If no agent is eligible, the lead is committed unassigned, the cursor does not advance, and an administrator-audience in-app notification is created. A failed cursor check creates no lead or notification; the server retries or returns a safe conflict after the configured retry bound.

## Settings and operations

Owners and admins can configure `/settings/lead-distribution`: enablement, Manual/Round Robin mode, eligible agents, optional branch/project constraints, availability handling, business days/hours/timezone and timeout minutes. The preview runs the same server-side eligibility policy without writing an assignment. Recent assignment history is displayed from the tenant-scoped SQL Connect query. Settings and successful assignment changes are audited.

The timeout is stored for a future worker and does not currently trigger automatic reassignment. No scheduler, queue service or external messaging provider is part of this phase. Agents see persistent assignment notifications in the workspace header and can mark them read. Unassigned queue notices are visible to active company owners/admins only.

## Local validation

Use `npm run sql:validate` and `npm run sql:generate` after schema or connector changes. `npm run test:dataconnect` runs the guarded local SQL Connect emulator integration suite; it checks concurrent cursor writes, retry fairness, unavailable agents, empty pools, permission boundaries, tenant isolation, history and notifications. The suite uses a local demo project/database. Do not point seed/reset scripts at hosted data. Hosted schema migration/deployment requires separate review and approval.
