# AI Content Studio (Phase 6B)

The Content Studio at `/ai-content` drafts UAE real estate marketing and sales content from the company's own CRM records using Anthropic Claude. Every draft is saved for the member to edit. Nothing is sent, published or changed in the CRM.

Related: [templates and branding](AI_TEMPLATES.md), [security and fact checking](AI_CONTENT_SECURITY.md), [Copilot](AI_COPILOT.md) (Phase 6A, shares the Anthropic integration and allowances).

## Where it lives

| Path | Contents |
| --- | --- |
| `src/modules/ai/content/catalog.ts` | Content types, purposes, editable fields, languages, tones, audiences, source rules |
| `src/modules/ai/content/schemas.ts` | Structured-output JSON schemas and matching Zod schemas, built from the catalog |
| `src/modules/ai/content/facts.ts` | Allowlist presenters that build the verified fact sheet and approved branding |
| `src/modules/ai/content/validate.ts` | Deterministic fact check of generated and edited text |
| `src/modules/ai/content/prompt.ts` | System prompt (`CONTENT_PROMPT_VERSION`), facts block, task block |
| `src/modules/ai/content/generate.ts` | One structured-output Messages API request, streamed, then Zod-validated |
| `src/modules/ai/content/ad-limits.ts` | Advertising platform limits (configurable) |
| `src/modules/ai/content/policy.ts` | Request schemas, editorial status rules |
| `src/modules/ai/content/server/` | `sources` (permission-checked record reads), `store` (SQL Connect), `generate` (streamed endpoints), `http` (draft, brand, template and picker endpoints) |
| `src/modules/ai/content/components/` | Studio, draft editor and previews, record picker, settings, contextual link |
| `src/app/(workspace)/ai-content/` | Studio page |
| `src/app/(company)/settings/ai-content/` | Brand settings and templates |
| `src/app/api/ai/content/**` | API routes |
| `dataconnect/connector/ai-content.gql` | Stored operations |

Everything outside `server/` and `components/` is pure and unit-tested.

## Content types

| Type | Purposes | Output fields | Sources |
| --- | --- | --- | --- |
| Property description | Listing description | title, short and detailed description, key highlights, amenities, location, call to action | a listing or a property |
| Project marketing | Project marketing pack | introduction, developer overview, highlights, property types, payment plan overview, handover, brochure-ready text, launch announcement | a project (its developer, active payment plans and visible available units are read too) |
| WhatsApp draft | new lead introduction, property recommendation, follow-up after enquiry, viewing confirmation, viewing reminder, post-viewing follow-up, project launch, re-engagement | short, professional and friendly versions | a lead (most purposes), a listing/property (recommendation) or a project (launch); other sources optional |
| Email draft | enquiry response, property recommendation, viewing confirmation, follow-up, project launch, client proposal email | subject, preview text, body, call to action | as for WhatsApp |
| Social media | property announcement, project update | Instagram, Facebook, LinkedIn, reel script, announcement, hashtags | a listing/property, or a project |
| Advertising copy | Meta, Google Search, TikTok, LinkedIn | variants of primary text, headlines, descriptions, call to action | a listing, property or project |
| Client proposal | client property proposal | introduction, comparison, one entry per listing (reference, summary, price and specifications, location, advantages), next steps | 1–5 listings, optional lead |

WhatsApp drafts are one-to-one message drafts, not Meta-approved WhatsApp Business templates. Brochure-ready text is text only; no PDF is generated (no PDF module exists).

## Generation flow

1. **Request.** `POST /api/ai/content/generate` (new draft) or `POST /api/ai/content/drafts/{id}/generate` with `mode: REGENERATE | ALTERNATIVE`.
2. **Checks before streaming**, in order:
   - origin and CSRF, verified session, AI configuration;
   - active organization from the session, plus the `X-EstateOS-Organization` header;
   - strict body schema and source rules for the purpose, then role (managers cannot use inventory types);
   - per-member, per-IP and per-company rate limits (`ai.content.*`);
   - the optional template;
   - **every source record re-read through the CRM services as the member**;
   - branding, and finally the shared monthly allowance.

   Failures return JSON errors; nothing reaches Claude.
3. **Prompt.** The cached system prompt; then the facts block (verified CRM facts plus approved branding, a cache breakpoint so regenerations reuse it); then company template, user style instructions, the current draft (alternatives only) and the task.
4. **Claude.** One `client.beta.messages.stream` request with:
   - `output_config.format` (JSON schema for the type and language) and `output_config.effort`;
   - adaptive thinking;
   - no tools;
   - the server-side refusal fallback where the model supports it.

   The browser receives NDJSON progress (`start`, `stage`, `progress`, then `done` or `error`), never text, facts or provider detail.
5. **Validation.**
   - Refusals, truncation, invalid JSON or a Zod failure are errors; nothing partial is saved.
   - An all-empty draft is an error.
   - Otherwise `validate.ts` runs its deterministic checks and the model's `missingInformation` and `claimsToReview` lists are merged in.
6. **Save.** In one transaction, a NO_ACCESS operation writes:
   - the draft with version 1 and an audit event (new drafts);
   - or a regenerated version that replaces the current content (regenerate);
   - or an alternative version that leaves the current content alone (alternative).
7. **Usage.** One `AiUsageRecord` row with `feature = CONTENT`, the content type, tokens, cost estimate and prompt version. The allowance is released if Claude was never reached.

## Draft workflow

- **Statuses** are editorial only:
  - `DRAFT`, `IN_REVIEW`, `APPROVED` ("approved internally") and `ARCHIVED`;
  - only owners and administrators approve;
  - saving an edit to an approved draft returns it to `DRAFT`;
  - archived drafts are read-only until restored to `DRAFT`.
- **Editing** saves a new `EDITED` version. "Use this version" restores any earlier version as a new `RESTORED` version. Regenerate and alternative add `REGENERATED` and `ALTERNATIVE` versions. Every save is a compare-and-set on `revision`, so a stale or concurrent save returns 409 rather than overwriting.
- **History:** search by title, filter by status, paginate. Owners and administrators can switch to "Whole company".
- **Deleting** removes the draft and its versions and writes an audit event. Archive instead if it may be needed.
- **Persistence:** the selected draft is in the URL (`/ai-content?draft=…`), so a reload restores it. The editor warns before leaving with unsaved edits.

## Contextual actions

- **Property:** Generate AI Description.
- **Project:** Generate Project Marketing Content.
- **Lead:** Generate WhatsApp Follow-up and Generate Email Draft.
- **Listing:** Generate Advertising Copy.

These are links to `/ai-content?type=…&<record>Id=…`. The studio asks `GET /api/ai/content/sources?kind=…&id=…` whether the member can use the record before showing it as selected, and the generate endpoint re-reads it again. Opening the page never generates.

## Languages

English, Arabic, and English + Arabic.

- Bilingual drafts hold both versions, written from the same facts in one request.
- Arabic is shown and edited right-to-left (`dir="rtl" lang="ar"`).
- Validation normalises Arabic-Indic digits and checks Arabic claim wording.

## Usage and cost controls

- **Shared allowance:** generations use the same monthly allowance as the Copilot (`AI_MONTHLY_REQUESTS_PER_USER`, `AI_MONTHLY_REQUESTS_PER_ORGANIZATION`).
- **Rate limits:** the same per-minute numbers apply, under separate `ai.content.*` buckets.
- **Length:** the Short, Standard and Long options are passed to Claude.
- **Request size:**
  - facts are bounded allowlists (descriptions ≤1,500 characters, at most 30 amenities, 25 features, 5 payment plans and 300 units summarised into groups);
  - output is capped by `AI_CONTENT_MAX_OUTPUT_TOKENS`.
- **Prompt caching** (Anthropic, exact-prefix, per API account): the static system prompt and each draft's facts block. EstateOS itself keeps no cache of facts or drafts. Facts are re-read with the member's permissions on every generation, so nothing is ever shared across members or companies.

| Variable | Default | Purpose |
| --- | --- | --- |
| `AI_CONTENT_MAX_OUTPUT_TOKENS` | 16000 | Output cap per generation (2048–64000) |
| `AI_CONTENT_REQUEST_TIMEOUT_MS` | 180000 | Per-generation timeout |
| `AI_CONTENT_MAX_INSTRUCTIONS_CHARS` | 1500 | Style instruction limit |
| `AI_AD_LIMITS` | (unset) | JSON overrides for ad text limits, see [templates](AI_TEMPLATES.md#advertising-limits) |

All other settings (`ANTHROPIC_*`, allowances, rate limits, pricing) are shared with the Copilot.

## Database changes

Additive only:

- **Tables:** `AiBrandProfile`, `AiContentTemplate`, `AiContentDraft` and `AiContentVersion`.
- **Enums:** `AiContentType`, `AiContentLanguage`, `AiContentDraftStatus` and `AiContentVersionKind`.
- **Enum values:** three `AuditTargetType` values and five `ActivityKind` values.
- **Columns:** nullable `feature` and `contentType` on `AiUsageRecord`.

Notes:

- Drafts store source record IDs as plain identifiers (no foreign keys), so they never block archiving or deleting CRM records. Versions use a composite tenant-scoped foreign key to their draft.
- Nothing existing was altered or reset.
- The hosted rollout follows the same approved process as Phase 6A ([AI Copilot](AI_COPILOT.md#local-and-hosted-environments)), and has not been done.

## Tests

| Command | Coverage |
| --- | --- |
| `npm run test:ai` | Includes `tests/ai-content.test.ts` (38 tests, **mocked** Claude): each content type, missing data, unsupported claims, English/Arabic, editing rules, status rules, regeneration, identity fields, ID validation, provider failures, schema rules |
| `npm run test:dataconnect` | `tests/sql-connect-ai-content.cases.mjs` (12 cases): draft ownership and company-wide access, compare-and-set, version kinds, approval and archive rules with audit, regenerate and alternative, NO_ACCESS enforcement, tenant isolation, deletion, search, templates, brand settings, usage columns |
| `npm run test:ai-content:e2e` | Real app in headless Chrome on isolated emulators, with an invalid key (free). `AI_E2E_LIVE=1` adds three real Claude generations on synthetic data |

Results are recorded in [Project handover](PROJECT_HANDOVER.md#phase-6b-verification-status).

## Known limitations

- **Fact checking is heuristic.** It flags figures, contacts and risky wording that are not in the facts. It cannot prove that creative wording is accurate, and a figure that appears anywhere in the facts counts as verified even if it is used in the wrong place. People must review drafts.
- **Manager scope:** managers have no inventory scope in EstateOS, so they can use only lead-based WhatsApp and email drafts. There is no team model, so managers manage only their own drafts.
- **Lead context is deliberately minimal:**
  - Included: first name (optional), what the customer is looking for, and viewing and shortlist references.
  - Excluded: budget, contact details, notes and source.

  Drafts that need those details use placeholders.
- **No agent contact details:** EstateOS stores none for agents, so drafts use only company-approved contacts.
- **Unverified ad limits:** advertising limits are reference values that were not re-verified against live provider documentation during this phase.
- **No exports:** no PDF, image or landing-page output. No publishing, sending or campaign creation (later phases).
- **Usage reporting:** there is no usage dashboard UI yet. Usage is in `AiUsageRecord` and the `ai.content` log events.
