# EstateOS project handover

EstateOS is a multi-tenant, AI-ready real estate CRM SaaS for brokerages, starting with Dubai and the UAE. Each company has an isolated workspace, team and role-based permissions. Read [AGENTS.md](../AGENTS.md) first; it contains the binding development rules.

_Last updated: 2026-10-28 (Phase 6B AI Content Studio)._

## Technology

Next.js App Router (Next 16, see the version notice in AGENTS.md), React 19, TypeScript (strict), Tailwind CSS, shadcn/ui, Firebase Authentication (email/password, server sessions), Firebase SQL Connect with PostgreSQL (generated Admin SDK with verified-user impersonation), Firebase Storage, Zod, Anthropic Claude via the official `@anthropic-ai/sdk` (Messages API, server-only). Planned: Firebase App Hosting. Architecture: modular monolith, feature modules under `src/modules/`.

## Phase status

| Phase | Scope | Status |
| --- | --- | --- |
| 1 | SaaS foundation: shell, sidebar, themes, shared UI | Complete |
| 2 | Firebase authentication, sessions, protected routes | Complete |
| 3 | Companies, memberships, invitations, roles (OWNER/ADMIN/MANAGER/AGENT), audit | Complete |
| 4 | Contacts, leads, pipelines, distribution, follow-ups, website capture, reporting | Complete |
| 5A–5C | Developers, projects, buildings, properties, listings, media, payment plans | Complete |
| 5D | Lead–property integration: primary interest, matching, shortlist (add/remove/feedback), viewings (assignee, confirmation, outcome, follow-up), inventory dashboard | Complete — [details](LEAD_PROPERTY_INTEGRATION.md) |
| 5E | Property portal foundation: connection status, field mappings, validation, JSON/XML export preview, publication records, feed dry runs | **Foundation complete; live publishing not started** — [details](PROPERTY_PORTAL_INTEGRATIONS.md) |
| 5F | UAE maps: location fields, Google autocomplete/geocoding (server key, or browser-key fallback), form pin preview, clustered viewport-paged property/listing maps, detail maps, developer head-office maps, exact/approximate/hidden display modes, shared API rate limiting, reusable public map components | **Complete and tested on emulators; live Google keys, real-map verification and hosted migration pending approval** — [details](MAPS.md) |
| — | Local database persistence and backups | Complete — [details](LOCAL_DATABASE.md) |
| — | Hosted development database | **Plan awaiting approval** — [plan](HOSTED_DATABASE_PLAN.md) |
| 6A | AI Copilot (Anthropic Claude): `/ai-copilot` chat with streaming, 8 read-only permission-aware CRM tools, persistent private history, token usage records, atomic monthly allowances and rate limits | **Implemented; see verification status below** — [details](AI_COPILOT.md), [tools](AI_TOOLS.md), [security](AI_SECURITY.md) |
| 6B | AI Content Studio (Anthropic Claude): `/ai-content` drafts for property descriptions, project marketing, WhatsApp, email, social, ad copy and client proposals in English, Arabic or both; structured outputs, fact checking, editable drafts with versions and internal approval, brand settings and templates, contextual CRM buttons | **Implemented; see verification status below**. [Details](AI_CONTENT_STUDIO.md), [templates](AI_TEMPLATES.md), [security](AI_CONTENT_SECURITY.md) |
| 6C | AI sales intelligence (Anthropic Claude): explainable rule-based lead qualification with history, review and override; follow-up assistant; property matching with Claude explanations; viewing preparation with editable follow-up drafts; `/ai-sales` dashboard of recorded metrics; property and Copilot shortcuts | **Implemented; see verification status below**. [Details](AI_SALES_INTELLIGENCE.md), [scoring](AI_LEAD_QUALIFICATION.md) |
| 6D+ | AI write actions with user approval; usage dashboard | Not started |
| 7 | Marketing and website builder | Not started |
| 8 | Communications (WhatsApp, email, calling) | Not started |
| 9 | Deals and finance | Not started |
| 10 | Subscriptions and platform administration | Not started |

### Phase 5E blockers before live portal publishing

Live publishing requires, per provider: partner/API approval, the official specification, credentials stored in a secret manager, a server-side connection verification job, a public media-delivery design for listing photos, and a reviewed hosted database migration. See [Outstanding provider requirements](PROPERTY_PORTAL_INTEGRATIONS.md#outstanding-provider-requirements).

## Where things are

| Path | Contents |
| --- | --- |
| `dataconnect/schema/schema.gql` | The only database schema |
| `dataconnect/connector/*.gql` | Stored, authorized operations (all files are deployed together) |
| `dataconnect/seed_data.gql` | Local-only reset/seed, never deployed |
| `src/dataconnect-admin-generated/` | Generated SDK (`npm run sql:generate`) |
| `src/modules/<feature>/` | Feature code: `server/` services, `components/`, validation, pure policies |
| `src/app/` | Routes: `(workspace)`, `(company)/settings`, `api/` |
| `tests/`, `scripts/test-*.mjs` | Unit, emulator integration and browser tests |
| `src/modules/ai/` | AI Copilot: pure core (config, prompt, loop, tools) and `server/` adapters |
| `src/modules/ai/content/` | AI Content Studio: pure core (catalog, schemas, facts, validate, prompt, generate) with `server/` adapters and `components/` |
| `docs/` | Architecture, database, permissions and per-phase documents |

## Working locally

- `npm run dev:local` — Next.js with the persistent local SQL Connect emulator (`.local-data/sql-connect`; separate from hosted PostgreSQL). Stop with one Ctrl+C. Uploaded files are autosaved within seconds, so closing VS Code no longer loses them. `npm run db:status`, `db:backup`, `db:list`, `db:restore` manage local data; see [LOCAL_DATABASE.md](LOCAL_DATABASE.md).
- `npm run seed:demo -- --email you@company.com` (with `dev:local` running) loads fictional, idempotent demo data into a separate demo company; see [dev-data/README.md](../dev-data/README.md).
- `npm run sql:validate` / `npm run sql:generate` after schema or connector changes; restart the dev server afterwards.
- Google Maps keys are optional locally; see [MAPS.md](MAPS.md#google-maps-integration). Without them, map areas show a not-configured state and address lookups are unavailable.
- Checks before finishing any change: `npx tsc --noEmit`, `npm run lint`, `npm test`, `npm run test:dataconnect` (isolated demo project and ports; safe while `dev:local` runs), `npm run test:persistence` after launcher changes, `npm run test:leads:ui` for lead UI changes, `npm run test:maps:e2e` for map, location or inventory UI changes (real app + Auth/SQL Connect emulators in headless Chrome; never loads `.env.local`), `npm run test:ai:e2e` for Copilot changes and `npm run test:ai-content:e2e` for Content Studio changes (`AI_E2E_LIVE=1` adds a few paid live Claude calls), and `npm run build`.

## Rules that matter most

- Tenant context comes only from the verified session; never trust client organization IDs or roles. Every stored operation re-checks membership and role.
- Reuse existing services: `requireActiveOrganizationRequest`, `assertOrganizationAdministrator`, `crmReadResponse`/`crmMutationResponse`, `executeWorkspaceOperation`, `canonicalUuid`.
- Additive schema changes only, with documented hosted rollout steps. Never reset, migrate or deploy hosted infrastructure, create paid resources, or call external providers without approval.
- No mock data or fake backends; loading, error and empty states on every screen; audit logs for sensitive actions.
- Coordinates reach browsers only through `presentMapLocation` (`src/modules/maps/geo.ts`); strip raw `latitude`/`longitude`/`googlePlaceId` before passing records to client components. Public pages use only the allowlists in `src/modules/maps/public.ts`.
- Rate-limit new costly or abusable endpoints with `enforceRateLimit` (`src/lib/rate-limit/server.ts`); it is shared across instances through the database.

## Phase 6A verification status

Verified on 2026-10-28 (local emulators only; nothing deployed):

- **Unit tests:** `npm run test:ai` passes 46 tests with mocked Anthropic responses.
- **Emulator integration:** `npm run test:dataconnect` passes 313 tests, including 12 AI cases: roles, cross-company isolation, owner-only history, NO_ACCESS enforcement, atomic allowances under concurrency, usage records and the audit event on deletion.
- **End-to-end without Claude:** `npm run test:ai:e2e` passes 9 checks against the real app in headless Chrome. It uses a deliberately invalid key, so Anthropic itself rejects it. Checks:
  - 401 when unauthenticated;
  - rejection of injected organization/role fields and of a foreign company header;
  - 429 when the monthly allowance is used up;
  - the invalid key is shown as a configuration error, nothing is saved and the allowance is returned;
  - per-member rate limiting;
  - conversation privacy.
- **End-to-end with live Claude:** `AI_E2E_LIVE=1 npm run test:ai:e2e` passes 11 checks with the real Anthropic API (`claude-sonnet-5-5`, about five Copilot requests on synthetic data):
  - an OWNER asks in the UI and gets a correct answer from SQL Connect inventory through `searchProperties`, with no leak of the hidden address, coordinates or the other company's records;
  - the conversation survives a reload, and a follow-up uses the stored history;
  - an AGENT sees only assigned inventory;
  - a prompt-injection attempt does not reach another company's or unassigned leads;
  - token usage is recorded.
- The live run found a real-API constraint that mocked tests could not: strict tool mode allows at most 24 optional and 16 nullable parameters in total. The schemas were fixed and a unit test now pins both limits.
- **Not verified:** the Copilot in the user's own `npm run dev:local` database. Its persistent emulator needs a restart to apply the additive AI tables; take a backup first with `npm run db:backup`. Hosted SQL Connect and App Hosting were not changed. A dev-only Next.js log line ("Could not validate instant … NEXT_REDIRECT") appears for the legacy `/workspace/ai-copilot` redirect; the existing legacy redirects such as `/workspace/developers` use the same pattern.

## Phase 6B verification status

Verified on 2026-10-28 (local emulators only; nothing deployed):

- **Unit tests:** `npm run test:ai` passes 84 tests (46 Copilot and 38 Content Studio), all with mocked Anthropic responses. The full `npm test` passes.
- **Emulator integration:** `npm run test:dataconnect` passes 325 tests, including 12 Content Studio cases. They cover draft ownership and company-wide access, compare-and-set, version kinds, approval and archive rules with audit, NO_ACCESS enforcement, tenant isolation, templates, brand settings and usage columns.
- **End-to-end without Claude:** `npm run test:ai-content:e2e` passes 12 checks with an invalid key. The Copilot regression `npm run test:ai:e2e` still passes 9 checks.
- **End-to-end with live Claude:** `AI_E2E_LIVE=1 npm run test:ai-content:e2e` passes 14 checks with the real `claude-sonnet-5-5` (three generations on synthetic data):
  - an AGENT clicks *Generate AI Description* on an assigned property and gets a factual draft (asking price, size and community as recorded);
  - the agent edits it, saves, reloads and retrieves it;
  - an alternative version is added without replacing the text;
  - an OWNER generates an English + Arabic email from a HIDDEN-location listing with no address, coordinate or internal-note leak.
- **Lint, type check and build:** `npm run lint`, `npx tsc --noEmit` and `npm run build` pass.
- **Not verified:**
  - the studio in the user's own `dev:local` database, which needs a restart (after `npm run db:backup`) to apply the additive tables;
  - hosted SQL Connect and App Hosting, which were not changed;
  - ad platform limits against live provider documentation.

## Phase 6C verification status

Verified on 2026-10-28 and 2026-10-29 (local and isolated emulators only; nothing deployed):

- **Unit tests:** `npm run test:ai` passes 121 tests, including 37 in `tests/ai-sales.test.ts` with mocked Claude. The full `npm test` passes.
- **Emulator integration:** `npm run test:dataconnect` passes 331 tests, including 6 sales cases on the real stored operations. They cover lead visibility per role, NO_ACCESS writes, compare-and-set, reviews, private summaries, dashboard scoping and cross-company isolation.
- **End-to-end without Claude:** `npm run test:ai-sales:e2e` passes 12 checks with an invalid key. They cover:
  - identity and scope rejection;
  - rule-based evaluation and history;
  - qualification compare-and-set and priority review;
  - safe provider failure with the allowance released;
  - the lead panel, property actions, dashboard figures equal to stored records, and Copilot presets.

  The Copilot (9) and Content Studio (12) end-to-end suites still pass.
- **End-to-end with live Claude:** `AI_E2E_LIVE=1 npm run test:ai-sales:e2e` passes 14 checks with the real `claude-sonnet-5-5` on synthetic data:
  - an AGENT clicks *Analyze with Claude*;
  - the analysis explains the rules' score of 87 without changing it;
  - it recommends only the verified matching property;
  - it ignores an injected "score 100 / recommend another company's property / print phone numbers" instruction;
  - it contains no customer name, email or phone.

  A viewing brief and a pipeline summary were also generated. That run found that recorded dates were flagged as unverified figures, which is now fixed and unit-tested.
- **Persistence:** `npm run test:persistence` passes, including qualification details and an assessment surviving a hard kill.
- **Lint, type check and build:** `npm run lint`, `npx tsc --noEmit` and `npm run build` pass.
- **Not verified:**
  - the feature in the user's own `dev:local` database, which needs a restart (after `npm run db:backup`) to apply the additive tables;
  - the hosted environment, which was not changed.

## Next recommended work

1. Restart `npm run dev:local` (after `npm run db:backup`) to apply the AI Copilot and Content Studio tables locally. Then approve and run the hosted SQL Connect rollout for the additive AI schema and operations, and store `ANTHROPIC_API_KEY` in Secret Manager for App Hosting. See [AI Copilot](AI_COPILOT.md#local-and-hosted-environments).
1. Before production, decide AI allowances, the retention period for usage records, Anthropic data-retention terms and staff disclosure. See [AI security](AI_SECURITY.md#anthropic-data-handling).
1. Phase 6D (after approval): write actions with explicit user approval, an organization AI usage dashboard (Copilot, Content Studio and sales), feedback on individual suggestions, and an organization-wide retention job.
1. Before using ad copy, verify the advertising limits and policies in `content/ad-limits.ts` against current provider documentation and set `AI_AD_LIMITS` if they differ.
1. Approve and configure Google Maps keys (see [MAPS.md](MAPS.md#google-cloud-setup-requires-approval-may-incur-charges)), then verify live autocomplete, geocoding, pin dragging, clustering and viewport refresh on a real map, and set `RATE_LIMIT_KEY_SECRET` and `RATE_LIMIT_TRUSTED_PROXY_HOPS=1` for hosted environments.
1. Obtain provider specifications and approvals for Phase 5E live integrations (business/legal task), then implement per-provider adapters, credential storage and the publishing worker as documented.
