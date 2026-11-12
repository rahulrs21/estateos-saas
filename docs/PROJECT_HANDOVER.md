# EstateOS project handover

EstateOS is a multi-tenant, AI-ready real estate CRM SaaS for brokerages, starting with Dubai and the UAE. Each company has an isolated workspace, team and role-based permissions. Read [AGENTS.md](../AGENTS.md) first; it contains the binding development rules.

_Last updated: 2026-11-12 (Phases 7A, 7B.1, 7C.1 Gmail and 7C.2 Microsoft 365 merged into `main` locally; email verified live in test mode; nothing pushed)._

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
| 6D | AI landing page and website builder: single-page campaigns from CRM records; Claude generation, templates, blank and duplicate; validated component registry; Elementor-style full-screen editor (drag-and-drop elements, inline text editing, Content / Style / Advanced section settings, per-device spacing and visibility, background photos, videos and colours, navigator, context menu, shortcuts) with desktop, tablet and mobile previews; 25 section types, rich templates and curated stock photos and videos labelled as illustrative; self-hosted heading and body fonts; linked CRM data; lead form connection through the existing capture path; UAE checklist; review, approval, immutable publications, rollback; public pages with SEO; pending-enquiry recovery | **Implemented; see verification status below**. [Details](AI_PAGE_BUILDER.md), [registry](PAGE_COMPONENT_REGISTRY.md), [publishing](WEBSITE_PUBLISHING.md) |
| 6E | Workflow automation and approvals: allowlisted triggers from a transactional outbox, declarative conditions, LOW/MEDIUM risk policy in code, visual editor with templates A–F and a dry-run tester, Claude workflow drafts, durable PostgreSQL engine (leases, idempotent steps, retries, dead letters, restart recovery), executor identity, approvals with revalidation and separation of duties, due-task triggers, local worker and a Cloud Scheduler design, dashboard, My tasks | **Implemented; see verification status below**. [Engine](AUTOMATION_ENGINE.md), [builder](WORKFLOW_BUILDER.md), [approvals](WORKFLOW_APPROVALS.md), [security](WORKFLOW_SECURITY.md), [operations](AUTOMATION_OPERATIONS.md) |
| 6F | Communication hub (in progress): call records with connection status separate from outcome, manual call logging and history on lead and contact pages, follow-up links, the do-not-call list, server-side UAE calling rules (TDRA approval, 09:00-18:00 marketing hours, frequency limits) and settings. No provider is connected; EstateOS places, records and transcribes no calls | **6F.1-6F.6 implemented and tested on emulators (hub pages, provider connections and lines, signed Twilio and Retell webhooks, the gated live-call path, consent-gated recording and transcript uploads with private audited access and retention, Claude call summaries with checked evidence and human-reviewed suggestions, the voice assistant in test mode only with checked replies and human handoff, meetings with links to the provider apps, call and meeting workflow triggers with templates G-I, and agent reports); 6F.7 final verification pending**. [AI call intelligence](AI_CALL_INTELLIGENCE.md), [voice assistant](AI_VOICE_ARCHITECTURE.md), [testing and simulation](COMMUNICATION_TESTING.md), [Hub](COMMUNICATION_HUB.md), [providers](TELEPHONY_PROVIDERS.md), [privacy and compliance](CALL_PRIVACY_COMPLIANCE.md) |
| 7A | Unified inbox foundation: WhatsApp, email and website conversations in `/inbox`, linked to leads and contacts; exact-identity matching; assignment, status, notes and the customer panel; channel connections (secret names only), signed WhatsApp webhooks, durable deduplicated events, receipts and private attachments; replies with server checks and approval (no self-approval unless OWNER); Claude analyses and reply drafts with checked quotes; inbox workflow triggers, `inbox.draft_reply`, `inbox.reassign` and template J; opt-outs and retention. **No provider sends**: only the developer simulator delivers, to simulated conversations | **Implemented and tested on emulators; see verification status below**. [Inbox](UNIFIED_INBOX.md), [security](INBOX_SECURITY.md), [adapters](CHANNEL_ADAPTERS.md), [WhatsApp plan](WHATSAPP_INTEGRATION_PLAN.md), [email plan](EMAIL_INTEGRATION_PLAN.md) |
| 7B.1 | WhatsApp Cloud API in test mode: live connection check (VERIFIED only when Meta confirms the number with the access token), an administrator sending switch, approved free-text and template replies, business-started conversations, SENT only from Meta's message ID, refusals as FAILED with a workflow event. Sends only to the server's test recipients (`INBOX_WHATSAPP_TEST_RECIPIENTS`) | **Built and merged into `main`; tested against a local fake Graph API, then verified live on 2026-11-09 with Meta's test number: Check connection, approved `hello_world` template sends delivered to the owner's phone, and the owner's answers received through the webhook into the same conversation**. [Plan](WHATSAPP_INTEGRATION_PLAN.md#phase-7b1-test-mode-built) |
| 7C.1 | Gmail in test mode: company and personal mailboxes connected with Google sign-in (PKCE, narrow scopes, grants encrypted in a server-only table); import every minute (history cursor, bounded backfill and resync; automated mail and, in personal mailboxes, non-customers skipped before any content is read); approved threaded replies to the server's test addresses; personal mailboxes send only for their owner | **Built and verified live in test mode** (a company Gmail connected, customer email imported and shown formatted, an approved reply delivered to a test address); merged into `main` locally. [Plan](EMAIL_INTEGRATION_PLAN.md#phase-7c1-gmail-built) |
| 7C.2 | Microsoft 365 / Outlook in test mode on the same foundation: Microsoft sign-in (PKCE, delegated mail scopes, rotated refresh tokens stored by compare-and-set); the Inbox read by received time with immutable IDs; replies through Outlook in the customer's thread to the customer only; no per-app revocation, so disconnect wipes the grant and the member is told where to remove access | **Built and verified live in test mode** (an Outlook.com mailbox connected through an Entra app registration, email imported, an approved reply delivered in the thread); merged into `main` locally. ([setup](EMAIL_INTEGRATION_PLAN.md#trying-it-with-your-own-microsoft-mailbox)) |
| 7B.2 | WhatsApp for real customers (business number, approved templates, payment, published app, media download) | Not started; needs approval and provider accounts |
| 6F+ | Organization AI usage dashboard; multi-page agency websites and custom domains | Not started |
| 7 | Marketing campaigns and advertising integrations | Not started |
| 8 | Further communications (SMS, campaigns) | Not started |
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
| `src/modules/websites/` | Landing page builder: registry, linked data, templates, checklist, AI mapping and renderer (pure), `server/` services and `components/`; public pages at `src/app/site/`, real 404s in `src/proxy.ts` |
| `src/modules/automations/` | Workflow automation: pure definition, conditions, policy, scheduling, templates and Claude mapping; `server/` engine, actions, approvals, tasks and HTTP; `components/` editor, graph, dashboard, approvals and My tasks. Worker: `scripts/automation-worker.mjs` |
| `src/modules/communications/` | Communication hub: pure call states, phone, compliance, dial-policy and metrics rules; `providers/` Twilio, Retell and placeholder adapters; `server/` calls, settings, providers, webhooks, dial, hub and HTTP; `components/` call panel and hub pages |
| `src/modules/inbox/` | Unified inbox: pure model, identity, policy, outbound, assistant and attachment rules; `adapters/` (WhatsApp Cloud, email interfaces, the developer simulator); `server/` conversations, ingestion, webhooks, connections, replies, assistant, retention, simulator and HTTP; `components/` inbox, conversation, reply panel, settings and simulator. Templated connectors: `scripts/sql-templates/` (run `node scripts/build-inbox-connector.mjs`) |
| `docs/` | Architecture, database, permissions and per-phase documents |

## Working locally

- `npm run dev:local` — Next.js with the persistent local SQL Connect emulator (`.local-data/sql-connect`; separate from hosted PostgreSQL). Stop with one Ctrl+C. Uploaded files are autosaved within seconds, so closing VS Code no longer loses them. `npm run db:status`, `db:backup`, `db:list`, `db:restore` manage local data; see [LOCAL_DATABASE.md](LOCAL_DATABASE.md).
- `npm run seed:demo -- --email you@company.com` (with `dev:local` running) loads fictional, idempotent demo data into a separate demo company; see [dev-data/README.md](../dev-data/README.md).
- `npm run sql:validate` / `npm run sql:generate` after schema or connector changes; restart the dev server afterwards.
- Workflow automation runs locally when `AUTOMATION_WORKER_SECRET` (32+ random characters) is in `.env.local`: `dev:local` then starts the worker. See [AUTOMATION_OPERATIONS.md](AUTOMATION_OPERATIONS.md#local-worker). `npm run test:automations:e2e` for automation changes, `npm run test:communications:e2e` for communication changes.
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
- **Design upgrade screenshots** (desktop, mobile and editor) are written to `.tmp/ai-e2e/screens/` by the browser test.
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

## Phase 6D verification status

Verified on 2026-10-29 (local and isolated emulators only; nothing deployed or published outside them):

- **Unit tests:** `npm run test:websites` passes 32 tests (backward compatibility of pages saved before the design upgrade, stock media and colour validation, CRM-only key facts, rich templates with CRM or stock photos, generated navigation bar and video hero, plain-text inline editing, registry and HTML/script rejection, templates, Claude output mapping, fact check, linked data and map privacy, internal-field exclusion, missing images, permits and the UAE checklist, live eligibility, outdated-data detection, rendering, request schemas, slugs, snapshots). The full `npm test` passes.
- **Emulator integration:** `npm run test:dataconnect` passes 337 tests, including 6 website cases on the real stored operations:
  - roles and the agent-draft switch;
  - compare-and-set and append-only versions;
  - review, approval and server-only publishing;
  - superseding and live-slug protection;
  - public reads of live pages only, and the sitemap;
  - same-company lead form binding, enquiry links and pending enquiries;
  - cross-company isolation.
- **End-to-end without Claude:** `npm run test:websites:e2e` passes 16 checks with an invalid key. They cover the full owner flow:
  - create from an authorized project;
  - the CRM cover photo, stock photos and a stock video in the editor;
  - edit the headline inline on the canvas (real keyboard input), reorder from the section toolbar and save;
  - mobile preview;
  - connect a lead form, approve, and publish after the checklist and attestations;
  - the public page without login;
  - a mobile enquiry that becomes a lead with page attribution, visible in Leads;
  - a server restart.

  They also cover role and tenant rejections, HTML and stale-revision rejection, and a Claude failure that creates nothing and returns the allowance. Public page checks: no coordinate, address, note, storage path or cross-company leak; real 404s for wrong slugs and drafts; outdated CRM data flagged rather than republished; offline on an expired permit; and unpublish removing the page, images and sitemap entry.
- **Persistence:** `npm run test:persistence` passes, including a published page, its approved version and a page enquiry surviving a hard kill.
- **Lint, type check and build:** `npm run lint`, `npx tsc --noEmit` and `npm run build` pass.
- **Regressions:** the Copilot (9), Content Studio (12), sales intelligence (12) and maps (29) browser suites still pass.
- **Fixed during testing:**
  - Website lead capture failed for forms without a transaction-type field (the default), because `null` overrode the column default. This affected Phase 4 hosted forms too.
  - The local reset exceeded PostgreSQL's 100-argument limit.
  - Republishing an approved version after editing the draft was refused.
  - Public pages returned 200 with a not-found body for unknown addresses; `src/proxy.ts` now returns 404.
  - The public media route rejected SQL Connect's 32-character IDs.
  - Design upgrade: the editor showed no compliance disclaimer when the footer's own disclaimer was empty; it now shows the brand disclaimer, as public pages do.
- **Not verified:**
  - live Claude page generation (`AI_E2E_LIVE=1 npm run test:websites:e2e` was not run, to avoid API cost without your go-ahead);
  - the builder in your own `dev:local` database, which needs a restart (after `npm run db:backup`) to apply the additive tables;
  - hosted SQL Connect, App Hosting and real Google Maps keys, none of which were changed;
  - drag and drop with a real mouse (the browser test uses the toolbar and keyboard-equivalent controls, so dragging is not exercised by any test).

## Phase 6D editor upgrade (2026-10-30)

**What was added** (details in [AI page builder](AI_PAGE_BUILDER.md#editor) and the [registry](PAGE_COMPONENT_REGISTRY.md)):
- **Lead form and contacts in the editor:** connect or create a lead form from the enquiry form section; a `CONTACT` section with approved company contacts, office address and hours, and an optional agent card (consent attestation on publish).
- **Website media library:** upload JPEG, PNG or WebP (10 MB, signature-checked, rate-limited) from the computer; images are stored by ID and served publicly only through a live publication's allowlist.
- **Locations on any page:** a pin set on the page, exact or approximate; approximate pins are generalized before publishing.
- **Custom sections:** rows, columns and 14 widgets, drag and drop into columns, and saved sections shared within the company.
- **Per-element styling:** click a heading, eyebrow, paragraph, button, image or group to set its typography, colours, alignment, radius, width, opacity, spacing, position and device visibility (`style.elementStyles`). Widgets have the same typography controls.
- **Publish fixes in place:** checklist items name their fix. Brand contacts and disclaimer are approved under the item, a lead form is connected under it, page and section items jump to the right panel, and CRM items open the record in a new tab, followed by **Re-check**.
- **Polish:** global button shape, 75 % zoom, a shortcut sheet.
- **Form panels and the new project showcase template:** the hero split form keeps the theme colours over photo, video and dark backgrounds and can be styled (background, text, button colour, radius); the enquiry form section and form widget too. A new default template, "New project showcase", follows the usual new-project page order with the form in the hero.

- **Columns everywhere (Elementor-style):**
  - **Rows:** editable column widths, up to 6 columns, phone and tablet behaviour (stack, side by side, reverse) and container styling.
  - **Nesting and new sections:** inner sections, and a structure picker when adding a section.
  - **Widgets:** dropped inside any built-in section, and placed widgets dragged between columns and sections.
  - **Navigation bar:** logo, chosen menu links, phone, menu position and a phone menu.
  - **Galleries:** a full-screen photo viewer.
  - **On phones and tablets:** the editor uses a drawer and a bottom action bar.

**Schema:** additive only. New tables `WebsiteMedia` and `WebsiteSectionTemplate`, brand office fields, agent-card fields on `Membership`, and new audit enum values (see [database](DATABASE.md)). Element styles live in the page JSON, which needs no schema change. Older pages validate unchanged.

**Verified locally:**
- `npm run test:websites` passes 64 tests.
- `npm run test:dataconnect` passes 340 tests.
- `npm run test:websites:e2e` passes 17 checks, including:
  - an upload from disk;
  - a custom section saved to the library;
  - a headline styled and moved on its own;
  - a lead form connected from the checklist.
- Lint, the type check and the build pass. Persistence and the Copilot (9), Content Studio (12), sales (12) and maps (29) browser suites still pass.

**Not verified:**
- live Claude generation;
- the hosted rollout;
- your `dev:local` database, which needs `npm run db:backup` and then a restart of `npm run dev:local` to apply the additive tables;
- dragging with a real mouse.

## Phase 6E verification status

Verified on 2026-11-02 (local and isolated emulators only; nothing deployed, no hosted schema changed, no paid service enabled). Design and rules: [engine](AUTOMATION_ENGINE.md), [builder](WORKFLOW_BUILDER.md), [approvals](WORKFLOW_APPROVALS.md), [security](WORKFLOW_SECURITY.md), [operations](AUTOMATION_OPERATIONS.md).

- **Unit tests:** `npm run test:automations` passes 16 tests:
  - allowlists and rejections (unknown triggers, actions and facts, external actions);
  - conditions, the risk policy and role matrix;
  - scheduling, timezones, business and quiet hours;
  - deterministic IDs and templates A–F;
  - Claude output mapping, including prompt-injection fixtures (external sends, links, phone numbers and emails, risk changes, the AI-step limit).

  The full `npm test` passes (504 tests in 11 suites).
- **Emulator integration:** `npm run test:dataconnect` passes 347 tests, including the automation cases:
  - roles and tenant isolation;
  - compare-and-set on workflow status;
  - unique keys for events, executions and steps;
  - single-claim jobs and approvals;
  - outbox atomicity;
  - My tasks isolation.
- **End-to-end with the worker running:** `npm run test:automations:e2e` passes 25 checks:
  - unauthenticated access and wrong worker secrets refused; server-side validation;
  - the owner lifecycle (create, submit, approve, activate);
  - cross-company and agent denials, including a forged organization header;
  - lead events written in the CRM transaction and processed exactly once over repeated ticks;
  - a hard server restart mid-delay, with the job finishing once from PostgreSQL;
  - "Run now" idempotent per request ID;
  - a rejected CRM write leaving no event; paused workflows starting nothing;
  - the workflow pausing when the activating admin is demoted;
  - dashboard metrics from stored executions;
  - Claude drafting failing safely with an invalid key, recording `AUTOMATION` usage and saving nothing;
  - the UI: templates A–F, the editor, a phone read-only graph, and My tasks with `task.completed`;
  - follow-up-due scans firing once;
  - a Claude sales-review step failing once without retries;
  - parallel ticks and loop prevention;
  - the daily Claude-step cap;
  - reassignment approvals: exact from/to, foreign targets refused, approval applied once, separation of duties, simultaneous decisions claimed once, stale-target re-request, rejection, expiry, and the `/approvals` page.
- **Persistence:** `npm run test:persistence` passes, including an active workflow and a pending `lead.created` event surviving hard kills.
- **Lint, type check and build:** `npm run lint`, `npx tsc --noEmit` and `npm run build` pass.
- **Regressions:** the Copilot (9), Content Studio (12), sales intelligence (12), websites (17) and maps (29) browser suites still pass.
- **Fixed during testing:**
  - unique-constraint violations from SQL Connect were not recognized as duplicates;
  - IDs without hyphens were refused;
  - Claude steps read leads through the request instead of the executor;
  - deciding an expired approval returned a generic conflict instead of `AUTOMATION_APPROVAL_EXPIRED`;
  - emulator starts failing with "Failed to make request to …/emulator/configure", because the larger schema made the binary slower to listen than the CLI waits (fixed with a startup-wait preload; see [LOCAL_DATABASE.md](LOCAL_DATABASE.md#what-caused-data-loss-before), item 6);
  - the local `dev:local` database failing to migrate because of an earlier unfinished draft schema (fixed with append-only enums and a guarded one-time repair; item 8 of the same section).
- **Local `dev:local` database:** repaired and migrated on 2026-11-02; queries and lead assignment work again.
- **Re-run on 2026-11-02 after the startup fixes:** lint, tsc, build, `npm test` (504), `test:dataconnect` (347), `test:automations:e2e` (25) and `test:persistence` all pass.
- **Not verified:**
  - live Claude workflow drafting and Claude steps (only the invalid-key path was run, to avoid API cost without your go-ahead);
  - the hosted Cloud Scheduler adapter (documented, not provisioned);
  - the hosted rollout of the additive schema and operations;
  - clicking through trigger and condition changes in the visual editor (the editor has them; the browser test covers templates, reordering, adding steps and saving);
  - waiting out real delays, expiries and due times: the tests move stored timestamps into the past instead.

## Phase 7A verification status

Verified on 2026-11-06 on branch `feature/unified-inbox` (commits 7A.1 a78745e to 7A.6). Local and isolated emulators only: nothing was deployed, the hosted database is unchanged, and no paid service or provider account was created or used by EstateOS.

- **Unit tests:** `npm test` passes 571 tests. The inbox suites (`npm run test:inbox`) cover:
  - identity matching and policy;
  - WhatsApp signatures and normalization;
  - attachment sniffing and outbound stages;
  - approval separation and the reply checks;
  - the simulator adapter;
  - the assistant's checks (quotes, budgets, listings, invented numbers, removed contact details);
  - the workflow registry and template J;
  - retention.
- **Emulator integration:** `npm run test:dataconnect` passes 391 tests, including the inbox cases:
  - visibility for every role and tenant isolation;
  - transactional ingestion with workflow events, and duplicates;
  - channel connections (one company per account);
  - durable events and forward-only receipts;
  - attachment access with audit;
  - replies, approval and self-approval rules;
  - delivery limited to simulated conversations, SENT only on acknowledgement;
  - insights, workflow facts and guarded reassignments;
  - opt-outs and retention.
- **Browser (`npm run test:inbox:e2e`):** 23 checks on the real app with real sessions, covering every scenario in the Phase 7A brief:
  - agent, owner, manager and cross-company access, with the views, search, pagination and safe text;
  - website enquiries and the simulator;
  - signed webhooks, including bad signatures, the wrong account and duplicates;
  - worker retries and private attachments;
  - Claude failing safely;
  - the draft → check → approval by another member → simulator send → receipts flow;
  - real channels never sending;
  - the 24-hour window and opt-outs;
  - requirements applied to the lead through the lead update;
  - template J creating one task;
  - an approved `inbox.reassign` leaving the lead untouched;
  - STOP adding the number to the do-not-contact list once;
  - retention removing text and files.
- **Live Claude:** `AI_E2E_LIVE=1 npm run test:inbox:e2e` passed with two real calls (approved; model claude-sonnet-5-5). They checked the summary, the open question, the requirements with verified quotes and a draft-only reply. An instruction embedded in a customer message was ignored.
- **Persistence:** `npm run test:persistence` passes, with a conversation, its message, a reply draft, an analysis and their workflow events surviving hard kills.
- **Lint, type check, build** pass. The automations (25) and communications (38) browser suites still pass.
- **Not verified:**
  - **A real customer message from Meta.** The webhook was verified against Meta's dashboard: the handshake, and the dashboard test event refused as expected because Meta's sample uses a placeholder phone number ID. (Verified live in Phase 7B.1 with the test number: real answers arrive with the app unpublished once the WhatsApp Business Account is subscribed to the app.)
  - **Any sending, template or media download through a provider.**
  - **Live email to real customers** (Gmail and Microsoft 365 send only to test addresses: Phases 7C.1 and 7C.2).
  - **Malware scanning**: no scanner is connected.
  - **The hosted rollout** of the inbox schema and operations.

## Next recommended work

1. Inbox: restart `npm run dev:local` (after `npm run db:backup`) to apply the Phase 7A tables and operations locally. Then decide on Phase 7B (WhatsApp sending and templates):
   - a verified Meta Business portfolio;
   - a dedicated number not on the WhatsApp app;
   - approved templates;
   - the per-message pricing;
   - a system-user token in Secret Manager.

   See [WHATSAPP_INTEGRATION_PLAN.md](WHATSAPP_INTEGRATION_PLAN.md#phase-7b-what-is-needed-to-go-live).
1. Restart `npm run dev:local` (after `npm run db:backup`) to apply the AI Copilot and Content Studio tables locally. Then approve and run the hosted SQL Connect rollout for the additive AI schema and operations, and store `ANTHROPIC_API_KEY` in Secret Manager for App Hosting. See [AI Copilot](AI_COPILOT.md#local-and-hosted-environments).
1. Before production, decide AI allowances, the retention period for usage records, Anthropic data-retention terms and staff disclosure. See [AI security](AI_SECURITY.md#anthropic-data-handling).
1. Before the first real landing page goes live: have the agency's compliance owner review the [UAE advertising considerations](WEBSITE_PUBLISHING.md#uae-advertising-considerations), approve the hosted rollout of the additive website schema and operations, and set `APP_ORIGIN` to the public origin.
1. Automation rollout: add `AUTOMATION_WORKER_SECRET` to `.env.local` and restart `npm run dev:local` (after `npm run db:backup`). For hosted environments, approve the additive schema and connector deploy and the [Cloud Scheduler adapter](AUTOMATION_OPERATIONS.md#hosted-cloud-scheduler-adapter-design-only-not-provisioned), ideally with OIDC verification instead of the shared secret.
1. Phase 6F candidates (after approval): an organization AI usage dashboard (Copilot, Content Studio, sales, pages and automation), feedback on individual suggestions, an organization-wide retention job for usage records and automation history, and external workflow actions (WhatsApp, email) behind the existing approval controls once provider integrations exist. Multi-page agency websites and custom domains follow the [documented adapter](WEBSITE_PUBLISHING.md#custom-domains-future-adapter).
1. Before using ad copy, verify the advertising limits and policies in `content/ad-limits.ts` against current provider documentation and set `AI_AD_LIMITS` if they differ.
1. Approve and configure Google Maps keys (see [MAPS.md](MAPS.md#google-cloud-setup-requires-approval-may-incur-charges)), then verify live autocomplete, geocoding, pin dragging, clustering and viewport refresh on a real map, and set `RATE_LIMIT_KEY_SECRET` and `RATE_LIMIT_TRUSTED_PROXY_HOPS=1` for hosted environments.
1. Obtain provider specifications and approvals for Phase 5E live integrations (business/legal task), then implement per-provider adapters, credential storage and the publishing worker as documented.
