# EstateOS roadmap

EstateOS will serve UAE real estate agencies through a modular, multi-tenant CRM. The shell, identity, relational tenant services, company onboarding/settings/selection and first Leads module are connected. More granular sharing and operational release validation remain required before handling customer data. The application is not production-ready.

## Phase 1A — Application shell and frontend foundation

Current scope:

- Public homepage and login/sign-up interfaces, subsequently connected in Phase 1B.
- Shared workspace shell with collapsible desktop sidebar and responsive mobile navigation.
- Dashboard KPI cards, activity panel, upcoming task section, and chart placeholders with explicit empty states.
- Routes for Dashboard, Leads, Contacts, Agents, Developers, Projects, Properties, Deals, Tasks, Marketing, Communications, AI Copilot, Automation, Finance, Reports, and Settings.
- Reusable UI, loading/error/not-found states, accessible controls, and light/dark themes.
- Architecture and delivery roadmap documentation.

Phase 1A originally provided public workspace previews without private data. Phase 1B now protects those routes with real Firebase sessions. Leads now displays actual authorized SQL Connect data; other CRM navigation destinations explain their planned capabilities and unconnected status. No fabricated records or business statistics are shown.

Acceptance: local development starts at `http://localhost:3000`; implemented routes and responsive navigation work; lint, TypeScript, and production build checks pass. This does not establish production security or readiness.

## Phase 1B — Identity and tenant foundation

Implemented identity portion:

- Real Firebase Email/Password sign-up, login, logout, password reset, and email verification.
- Server-only Firebase Admin initialization and verified, expiring HttpOnly session cookies.
- Origin and CSRF checks on session mutations, revocation checks, and protected workspace rendering/API access.
- Session/request boundary tests and environment/manual testing documentation.

Implemented relational tenant foundation:

- SQL Connect/PostgreSQL `Organization`, `UserProfile`, `Membership`, `Branch`, `Invitation`, `AuditLog`, `Lead` and `Activity` models with UUID/composite keys, tenant constraints, indexes and timestamps.
- Connected [company onboarding](ONBOARDING.md), OWNER/ADMIN company settings, authorized workspace selection and company-aware shell/header. Logo uploads remain deferred.
- Explicit connector authorization, fresh active-membership checks and role hierarchy for OWNER, ADMIN, MANAGER and AGENT.
- Transactional organization/owner creation, verified company selection, invitation acceptance into pending approval, suspension/revocation and audit events.
- Server-only validated services using the generated Admin SDK with verified identity impersonation; no Prisma or second database layer.
- Local synthetic seeds, policy tests, emulator integration tests and a [migration runbook](SQL_CONNECT.md).

Remaining tenant foundation before introducing customer data:

- Live development-project validation, HTTPS deployment validation, and operational session/account lifecycle review.
- Company onboarding/settings/switching, team search/role changes/suspension and secure invitations are implemented; branch administration and complete member lifecycle interfaces remain.
- Invitation delivery, re-invitation, account merging, owner transfer, retention/deletion and complete account lifecycle workflows.
- Role and record rules covering branches, ownership, assignments, and approved sharing.
- Protected workspace pages, independently protected server operations, and secure storage rules.
- Independent audit retention/export, monitoring, restore drills, staging migration and region/data residency review.

Gate: identity alone does not establish tenant authorization. Services and connector operations check active membership and role, including company settings and switching. Leads restricts agents to assigned records; owners, administrators and managers have company-wide lead access. Branch restrictions, approved sharing and member administration UI remain future work. Cloud changes require approval; credentials remain server-side.

## Phase 1C — Leads and core daily CRM

Implemented Leads portion:

- Authorized SQL Connect list queries with contact search, status/assignee/branch/follow-up filters, matching counts and bounded pagination.
- Shared Zod create/edit validation, contact detail pages and source tracking.
- Five-stage lead status pipeline and active same-organization member assignment.
- Append-only notes, lead-specific activity timeline and one current scheduled follow-up per lead with completion/history.
- Protected cookie-based mutation routes with independent session, exact-origin, CSRF, strict bounded JSON and stale-company checks.
- Tests for cross-company reads/writes, unrelated private leads, permitted manager access, rejected assignments/statuses and actual stored-operation pagination.
- Loading, empty, missing-company, success and safe error states, without synthetic live lead records.

Remaining daily CRM scope:

- Lead deduplication, imports/exports, bulk distribution and a reviewed sharing/team model.
- Contacts and relationship management for buyers, sellers, landlords, tenants, and partners.
- Agent and branch administration backed by verified memberships.
- Tasks, viewings, reminders, and in-app notifications.
- Initial dashboard metrics and activity derived from real, authorized records.
- Tests for assignment rules, state transitions, cross-tenant access, and sensitive audit events.

Gate: no fabricated activity or placeholder business statistics may be presented as live metrics. Define metric semantics before reporting.

## Phase 2 — Portfolio and transactions

- Developer profiles, relationship contacts, and project associations.
- Project details, locations, delivery milestones, payment-plan metadata, and supporting documents.
- Property inventory, sale/rent listings, availability, media, and permission-controlled file storage.
- Deals, offers, pipeline milestones, transaction documents, and approval workflows.
- Related record consistency, ownership controls, validation, and audit trails.

## Phase 3 — Communication and operational workflows

- WhatsApp, email, calling, and video integrations with authorized provider connections.
- Conversation histories linked to accessible contacts, leads, and deals.
- Communication preferences, consent, templates, and delivery status.
- Notifications with user preferences and delivery controls.
- Automation triggers, rules, scoped execution, retries, failure visibility, and run history.

Gate: provider credentials, consent policies, webhook verification, tenant routing, rate limits, and auditability must be defined before any external communication or automated action.

## Phase 4 — Marketing, websites, and distribution

- Agency websites, domain configuration, landing page builder, and reviewed publishing.
- Property portal feeds, listing validation, synchronization, and publishing status.
- Marketing campaigns, lead source attribution, and advertising integrations.
- Asset organization, channel permissions, reporting, and reliable integration monitoring.

These capabilities are intentionally outside Phase 1. Publishing and externally visible actions require explicit authorization and appropriate safeguards.

## Phase 5 — Finance and reporting

- Deal financial records and agent/team commission rules.
- Approval workflows, payout tracking, reconciliation, and financial exports.
- Agency, branch, team, pipeline, conversion, and source reporting.
- Scoped dashboards, documented calculations, and controlled exports.
- Business rule tests for financial calculations, permissions, and reporting consistency.

## Phase 6 — AI CRM Copilot

- Permission-aware record retrieval and summaries using Anthropic Claude (read-only foundation delivered in Phase 6A; see [AI Copilot](AI_COPILOT.md)).
- Editable, fact-checked marketing and sales drafts from CRM records (delivered in Phase 6B; see [AI Content Studio](AI_CONTENT_STUDIO.md)). Sending, publishing and campaign creation remain later phases.
- Explainable rule-based lead qualification, follow-up assistant, viewing preparation and an AI Sales dashboard (delivered in Phase 6C; see [AI sales intelligence](AI_SALES_INTELLIGENCE.md)).
- Assisted follow-up drafts, suggested next steps, and useful CRM explanations.
- User review for consequential actions and server-enforced tool permissions.
- Tenant-safe retrieval, prompt-injection defenses, privacy controls, evaluations, usage limits, auditability, and cost monitoring.

AI access must obey the same server authorization rules as every other operation. Credentials and model calls remain server-side. This phase is not an authorization shortcut or part of the initial foundation.

## Phase 7 — Subscriptions and platform administration

- Subscription plans, entitlements, usage controls, and billing integration.
- Secure onboarding, account lifecycle, and tenant administration.
- Separately authorized platform administration and audited support access.
- Operational monitoring, backups, recovery exercises, and incident response.

Billing and paid infrastructure changes require separate approval and are excluded from Phase 1A.

## Release gates across every phase

- Keep UI, input validation, business rules, and data access separate.
- Enforce tenant and record permissions on the server for every protected operation.
- Include loading, empty, success, and error states appropriate to real feature behavior.
- Add business rule and permission tests when implementing those rules.
- Pass lint, strict TypeScript checks, production build, and feature-specific validation.
- Review accessibility and responsive behavior in light and dark themes.
- Assess privacy, integration reliability, audit events, secrets management, and operational readiness.
- Do not describe a release as production-ready until its actual security and operational requirements are met.
