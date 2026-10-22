# Website lead capture and analytics

Phase 4D adds a website form integration to the existing lead CRM. PostgreSQL through Firebase SQL Connect remains the only persistent data layer. No hosted schema migration, deployment, paid service provisioning, advertising API or AI integration was performed.

## Form setup

An active company OWNER or ADMIN can open **Settings → Website lead forms** (`/settings/lead-forms`), create or edit a form, configure fields, choose a branch/project scope when available, and set the consent text and HTTPS privacy-policy URL. New forms start as drafts. Copy the public URL or generated iframe snippet after activating a form. The public form is served from `/forms/{publicId}` and can be embedded on a site with the supplied snippet. The page does not expose company or CRM records. The public identifier is random and should be treated as a revocable URL capability; changing the form to Disabled immediately blocks lookup and submissions.

The current form field keys are full name, email, phone, message, property interest, preferred location, property type, transaction type, budget bounds and bedroom preference. Full name and at least one contact method are required by the saved form configuration. Consent is always required for an active form and the configured privacy-policy URL must be HTTPS. Uploads and logos are not included.

## Submission and security boundary

`GET` and `POST /api/public/lead-forms/{publicId}` are the public endpoints. The caller cannot select an organization, source, membership or role. The random public ID resolves the active stored form; its tenant, website source, policy notice and branch/project constraints are revalidated within the transactional submission. Responses contain only acceptance, duplicate status and the configured generic success message.

The server limits JSON bodies to 16 KiB, applies strict Zod validation against saved fields, requires the consent boolean, rejects a hidden honeypot and elapsed time under 900 ms, and enforces 30 requests per form per UTC minute with a database compare-and-set counter. Old rate buckets are pruned as new requests arrive. The limiter is per form and is a baseline; it is not a WAF, CAPTCHA, or globally coordinated anti-bot service. Add edge-level controls before high-traffic public release. Attribution values are untrusted: UTM fields are bounded and control characters removed; landing URLs are accepted only as HTTP(S), have credentials/query/hash removed, and are stored as attribution rather than trusted navigation.

The browser sends a random idempotency key. Only its SHA-256 digest is stored, uniquely scoped to form and organization. A committed retry is acknowledged without creating another lead. The `NO_ACCESS` SQL Connect operations deny client calls and are invoked only from server-only Firebase Admin code. Normal form-management and reporting operations use authenticated Firebase session and organization impersonation. There is no public connector route with general lead access.

A submission associates an exact normalized email/phone match only if exactly one company contact matches; ambiguous matches create a new contact rather than guessing. It creates a lead, links the trusted form source, stores consent/policy snapshots and sanitized attribution, applies the existing round-robin distribution rule when eligible, and records activity, audit, assignment history, and notifications in the same SQL Connect transaction. Multiple leads per contact are supported. If a form's company has no active default pipeline/stage, source inconsistency, or eligible selected agent/cursor becomes stale, the transaction fails without a partial lead.

## Reports

Open `/workspace/reports` inside a selected company workspace. Filters include inclusive local calendar dates, timezone, day/week/month volume buckets, source, stage and agent. SQL receives a half-open UTC timestamp interval derived from the selected IANA timezone; date ranges are limited to 366 days. The default range is the most recent 30 local dates. Dashboard counts and charts use database aggregates.

Total leads, source/stage/agent counts and volume count non-archived leads created in the selected date interval and matching selected source/stage/agent filters. Won conversion is won-stage leads created in that interval divided by all visible non-archived leads created in that interval. Overdue follow-ups mean currently pending follow-ups with due time before now on visible non-archived leads; the count uses the same tenant/visibility and source/stage/agent filters but is not restricted by lead creation date. OWNER/ADMIN may view the company scope. MANAGER and AGENT are limited to their own assigned leads until the product has verified team/branch reporting scope; the UI labels this scope.

## Local validation and rollout

For local development, use the existing local SQL Connect emulator flow documented in `SQL_CONNECT.md`. Validate connector operations and regenerate SDKs with the repository's `sql:validate` and `sql:generate` scripts, then run the automated unit and emulator suites. Emulator seed/reset data is local-only. Do not point seed scripts or emulator tools at hosted customer data.

Before an approved hosted release, review the additive schema/operation migration, take and verify a database backup, review organization/tenant constraints and indexes, deploy the matching SQL Connect connector and application SDK together, then smoke-test draft, active, disabled, duplicate/retry, rate-limit, attribution, assignment, consent and report behavior with a dedicated test organization. Set the app's correct public origin and require a valid company HTTPS privacy URL. No migration or deployment is included in this phase.

## Current limits

- Rate protection is a database form/minute counter plus honeypot and minimum dwell time; there is no CAPTCHA, provider reputation scoring, email/phone verification, WAF policy, or global IP/device throttling.
- Rate counter cleanup is opportunistic on subsequent submissions; a quiet form can retain old buckets until traffic resumes.
- Public data is retained with CRM data according to the existing company retention policy; there is no self-service contact erasure/retention workflow in this phase.
- Duplicate detection is exact after normalization and does not merge contacts.
- Reports use existing lead/source/stage/membership/follow-up data. There are no external ad attribution APIs, property listing analytics, AI insights or team hierarchy access.
- Iframe embedding is same-origin with EstateOS-hosted form delivery; custom domains, cross-origin customization/CSP allowlists, custom CSS and third-party script SDK are not included.
- Consent text and privacy-policy URL are snapshotted as evidence; legal sufficiency and organization privacy compliance remain the agency's responsibility.
