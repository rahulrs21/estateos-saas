# AI sales intelligence (Phase 6C)

Helps agents and managers qualify leads, match properties, prepare viewings and catch missed follow-ups. Everything comes from the company's own CRM records, read with the member's permissions. Nothing is sent to customers, scheduled, reassigned, published or changed automatically.

Related:
- [Lead qualification rules](AI_LEAD_QUALIFICATION.md)
- [AI security](AI_SECURITY.md)
- [Copilot](AI_COPILOT.md) (6A): shared Anthropic client, quotas and tool registry
- [Content Studio](AI_CONTENT_STUDIO.md) (6B): message drafts

## Where it lives

| Path | Contents |
| --- | --- |
| `src/modules/ai/sales/scoring.ts` | Rule-based qualification (pure) |
| `src/modules/ai/sales/follow-ups.ts` | Follow-up signals (pure) |
| `src/modules/ai/sales/inputs.ts` | CRM rows to allowlisted inputs; match presentation |
| `src/modules/ai/sales/dashboard.ts` | Dashboard counts (pure) |
| `src/modules/ai/sales/analysis.ts` | Claude system prompt, structured-output schemas, post-validation |
| `src/modules/ai/sales/policy.ts` | Strict request schemas, dashboard scope |
| `src/modules/ai/sales/server/` | `service` (flows), `store` (SQL Connect), `http` (endpoints) |
| `src/modules/ai/sales/components/` | Lead panel, property actions, AI Sales dashboard |
| `src/modules/ai/structured.ts` | One structured-output Messages API request, shared with the Content Studio |
| `src/app/(workspace)/ai-sales/` | `/ai-sales` page |
| `src/app/api/ai/sales/**` | 11 API routes |
| `dataconnect/connector/ai-sales.gql` | Stored operations |

## Features

### Lead details: AI sales assistant

The panel sits below the pipeline on every lead page.

- **Lead qualification**
  - Shows the score or "Insufficient data", the priority label and the reviewed priority.
  - Lists every factor with its points and evidence, and the missing information.
  - Shows when it was evaluated and by whom, the rule version and settings hash, and the assessment history.
  - **Evaluate score** stores a rule-based assessment and uses no AI allowance. **Review priority** records an override with a reason.
- **Customer-stated qualification:** timeline and readiness, as told by the customer.
- **Suggested next actions** (rule-based, always live):

  | Signal | Trigger | Action |
  | --- | --- | --- |
  | Overdue follow-up | A pending follow-up or the lead's follow-up date has passed | WhatsApp draft; open Follow-up history |
  | Enquiry not answered | Lead is NEW, older than a day, with no recorded interaction | Introduction WhatsApp or enquiry-response email draft |
  | Viewing not confirmed | Upcoming viewing with customer confirmation pending | Viewing-confirmation WhatsApp draft |
  | Viewing outcome missing | Scheduled viewing more than 2 hours in the past and still open | Open Viewings (a person records the outcome) |
  | Post-viewing follow-up | Completed viewing in the last 7 days with no follow-up or later contact | Post-viewing WhatsApp draft |
  | Waiting for property details | Shortlisted property marked *interested* more than a day ago with no contact since | Property-recommendation WhatsApp or email draft |
  | Complete the qualification | Requirements, timeline or readiness missing | Open the relevant section |
  | No next step | No upcoming follow-up or viewing | Open Follow-up |

  Draft actions open the existing Content Studio (6B) with the lead and property pre-selected. Nothing is generated or sent until the member chooses to.
- **Analyze with Claude:** one structured request (details below). It shows:
  - a summary;
  - plain-language explanations of the factors;
  - up to five next actions;
  - recommendations among the verified matching properties, with a comparison;
  - questions to ask and a follow-up recommendation;
  - caveats.

  It is stored in `AiSalesInsight` and reloaded with the page.
- **Matching properties:** the existing matching engine's results for the member. It shows reference (linked), price, location (community, area, emirate), type, bedrooms, bathrooms, size and the match reasons, plus the criteria that could not be applied and the coverage.
- **Viewing preparation:** **Prepare viewing summary** on a recorded viewing produces a Claude brief:
  - client requirements, property highlights, questions to clarify, comparison with other shortlisted or matching properties, and watch-outs;
  - an **editable post-viewing WhatsApp draft**, fact-checked with the 6B checker, with Copy and Open-in-Content-Studio actions.

  Viewing outcomes are recorded only by a person, in Viewing appointments.

### Property details: Sales assistant

- **Find matching leads:** reverse matching over up to 500 active leads the member can see, using the same rules. Rule-based; no AI allowance used.
- **Prepare viewing summary:** viewings of this property (last 14 and next 60 days) for leads the member can see, each with **Prepare with Claude**.

### AI Sales dashboard (`/ai-sales`)

- **Recorded CRM metrics**, marked "Actual records":
  - open, qualified, won and lost leads, and leads created in the last 7 days;
  - overdue follow-ups and leads with no upcoming follow-up;
  - viewings awaiting confirmation, upcoming viewings and outcomes not recorded;
  - unassigned open leads (owners and administrators, company scope);
  - leads with matching inventory, for the 20 most recently updated open leads;
  - pipeline by stage, with stale counts (no update for 14+ days) and median days since update;
  - interactions per day for 14 days;
  - leads by rule-based priority (latest assessment per open lead in the last 90 days, after reviews) and leads not yet assessed.
- **Scope:** owners and administrators choose the whole company, one agent or one branch. Everyone else always sees the leads assigned to them; the server enforces this whatever the request asks.
- **AI-generated insights:** **Summarize with Claude** writes a headline, observations, suggested focus and data limitations from the recorded metrics only. Every number in it is checked against the metrics (including recorded dates); any other figure is shown as unverified. Summaries are private to the member who generated them.
- **Manager shortcuts:**
  - *Summarize team pipeline*
  - *Review overdue follow-ups*
  - *Identify unassigned leads* (owners and administrators)

  Each opens the Copilot (6A) with a fixed question **pre-filled, not sent**. Only these three presets exist.
- No forecasts or conversion probabilities are shown. There is not yet enough historical outcome data to validate them.

### Copilot tool

The 6A registry gains one read-only tool, `getLeadQualification`. It runs the same rules live without storing anything, and returns factors, missing information, the latest stored assessment and review, and follow-up suggestions. It returns no contact details or note text.

## Claude requests

All sales requests use the shared `generateStructured` (`src/modules/ai/structured.ts`), which the Content Studio also uses:
- one Messages API request with `output_config.format` (closed JSON schema), streamed;
- adaptive thinking;
- **no tools**;
- the cached system prompt and facts block;
- the refusal fallback where supported.

The output is validated with Zod; a refusal, truncation or invalid shape is an error, never a partial result.

**Order of checks for each request:**
1. Origin, CSRF, session and the company header.
2. The strict body schema.
3. AI configuration and per-minute rate limits (`ai.sales.*`).
4. Every record re-read as the member.
5. A stored assessment, then the shared monthly allowance.

The allowance is released when Claude was never reached. One `AiUsageRecord` row is written with `feature = SALES` and the request kind (`LEAD_ANALYSIS`, `VIEWING_BRIEF` or `PIPELINE_SUMMARY`) in `contentType`, plus an `ai.sales` log line.

**Post-validation:**
- property recommendations must name one of the verified matching properties (others are removed and counted);
- factor explanations must name a real factor;
- the viewing draft is fact-checked for unverified figures, contacts and sensitive claims;
- pipeline summaries are checked for figures not in the metrics.

| Setting | Use |
| --- | --- |
| `ANTHROPIC_*`, `AI_MONTHLY_REQUESTS_*`, `AI_REQUESTS_PER_MINUTE_*`, `AI_MAX_OUTPUT_TOKENS` (capped at 8000 here), `AI_REQUEST_TIMEOUT_MS` | Shared with the Copilot |
| `AI_LEAD_SCORING` | Optional scoring overrides; see [lead qualification](AI_LEAD_QUALIFICATION.md#configuration) |

Rule-based scoring, suggestions, matching and dashboard metrics work even when Claude is not configured.

## Data sent to Claude

**Included:**

- **Lead analysis:**
  - the stage, transaction type and days since the enquiry;
  - the recorded requirements (location, type, bedrooms, budget);
  - the customer-stated timeline and readiness;
  - the rule-based assessment;
  - follow-up signal titles, follow-up due dates and statuses;
  - recent activity types and times;
  - viewing and shortlist references and statuses;
  - up to 10 verified matching properties (reference, project, type, bedrooms, bathrooms, size, emirate, community and area, listing title and price, match reasons).

  The lead's free-text property interest is sent separately as `<untrusted_customer_text>`.
- **Viewing brief:** the viewing's time, status, confirmation and outcome; the 6B allowlisted property and lead facts (`loadFacts`, re-read with permissions, without the customer's first name); missing information; and up to 6 other shortlisted or matching properties.
- **Pipeline summary:** the scope label and the dashboard metrics only (counts, dates, statuses). No lead names.

**Never sent:**
- customer names, emails or phone numbers;
- nationality or preferred language;
- lead source, notes or follow-up titles;
- member emails;
- street addresses, coordinates or place IDs;
- internal property notes or ownership and mandate references;
- other companies' data.

## Database (additive)

| Table | Purpose |
| --- | --- |
| `LeadQualificationDetails` | Customer-stated timeline and readiness (one per lead, compare-and-set, activity and audit) |
| `LeadQualificationAssessment` | Append-only rule-based assessments with version, settings hash and full factor JSON |
| `LeadPriorityReview` | Human reviews with reason, linked to the reviewed assessment |
| `AiSalesInsight` | Validated Claude output (lead analyses, viewing briefs, pipeline summaries) |

**Enums:** `LeadTimeline`, `LeadReadiness`, `AiLeadPriority` and `AiSalesInsightKind`.

**Enum values:** `LEAD_QUALIFICATION` and `AI_LEAD_PRIORITY_REVIEW` (audit targets); `LEAD_QUALIFICATION_UPDATED` and `AI_LEAD_PRIORITY_REVIEWED` (activity and audit).

**Additive changes to existing queries:**
- `ListLeads` also returns `projectId`;
- `ListLeadPropertyCandidates` also returns `bathrooms builtUpArea areaUnit`.

**Notes:**
- The new tables reference `Lead` with foreign keys, so a lead that has sales data cannot be hard-deleted. EstateOS only archives leads, so this has no effect in the app. The local test reset (`seed_data.gql`) clears these tables first.
- No hosted migration was performed.

## Tests

| Command | Coverage |
| --- | --- |
| `npm run test:ai` | `tests/ai-sales.test.ts` (37 tests, mocked Claude): score calculations and worked examples, factors and reproducibility, missing data and closed leads, versioning and settings validation, reviews, matching and unavailable inventory, every follow-up signal, viewing schema and fact check, request policy and scopes, provider failures, closed schemas, quotas, prompt injection, data mapping and dashboard counts |
| `npm run test:dataconnect` | `tests/sql-connect-ai-sales.cases.mjs` (6 cases, real stored operations): qualification compare-and-set, activity and audit; NO_ACCESS assessments and insights; lead visibility for agents, managers, owners and administrators; reviews; private summaries; dashboard scoping; cross-company isolation |
| `npm run test:ai-sales:e2e` | Real app in headless Chrome on isolated emulators: 12 checks with an invalid key (free). `AI_E2E_LIVE=1` adds live Claude analysis, viewing brief and pipeline summary on synthetic data |
| `npm run test:persistence` | Includes qualification details and an assessment surviving a hard kill |

Results are recorded in [Project handover](PROJECT_HANDOVER.md#phase-6c-verification-status).

## Limitations

- **Scoring and fact checking are heuristic.** Claude's wording is reviewed by people; only numbers, contacts and property references are checked automatically.
- **Matching is capped.** Matching reviews the first 100 candidate properties per lead, and reverse matching the first 500 leads. Coverage is shown.
- **Dashboard read limits:** it loads up to 1,000 leads, 1,000 assessments, 1,000 viewings and 2,000 activities, and says when a list was cut.
- **"Team" means a branch** (lead branch) or a single agent. EstateOS has no team model, and managers see only their own leads, as elsewhere in the CRM.
- **Viewing outcomes and follow-up completion** remain manual by design.
- **Suggestion feedback:** there is no feedback on individual suggestions yet. Reviews cover priorities only.
- **Hosted rollout** of the additive schema follows the same approval process as 6A and 6B, and has not been done.
