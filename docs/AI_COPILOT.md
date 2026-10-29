# AI Copilot (Phase 6A)

EstateOS Copilot lets a signed-in member ask natural-language questions about their company's CRM data. Answers come from **Anthropic Claude** through the Messages API with server-side tool use. Each tool call runs as that member, with their own role and record permissions.

Phase 6A is **read-only**. The Copilot cannot create, change, assign, archive or delete records, send messages, publish listings or change settings. It writes only its own conversation history, usage records and allowance counters.

Related documents: [AI tools](AI_TOOLS.md) · [AI security and privacy](AI_SECURITY.md) · [Architecture](ARCHITECTURE.md).

## Where it lives

| Path | Purpose |
| --- | --- |
| `src/app/(workspace)/ai-copilot/page.tsx` | `/ai-copilot` page (sidebar link). `/workspace/ai-copilot` redirects here. |
| `src/app/api/ai/chat/route.ts` | `POST /api/ai/chat`: streamed chat turn (NDJSON). |
| `src/app/api/ai/conversations/…` | `GET` list and search, `GET` one conversation, `DELETE` one conversation. |
| `src/app/api/ai/status/route.ts` | `GET` configuration state, model availability and this month's usage. |
| `src/modules/ai/config.ts` | Environment parsing, limits and pricing table (pure). |
| `src/modules/ai/prompt.ts` | Version-controlled system prompt (`AI_PROMPT_VERSION`). |
| `src/modules/ai/loop.ts` | Tool-use loop (pure; the Anthropic stream is injected). |
| `src/modules/ai/tools/` | Tool schemas, executor, presenters and search helpers (pure). |
| `src/modules/ai/server/` | Anthropic client, tool handlers, persistence/quota, chat orchestration, HTTP. |
| `src/modules/ai/components/` | Chat workspace UI and safe Markdown renderer. |
| `dataconnect/connector/ai-copilot.gql` | Stored operations for conversations, usage and allowances. |

## Configuration

All settings are server-side environment variables; none use `NEXT_PUBLIC_`. See `.env.example` for the full list with defaults.

| Variable | Default | Notes |
| --- | --- | --- |
| `ESTATEOS_AI_ENABLED` | off | Must be `true`. Otherwise the page shows "turned off". |
| `ANTHROPIC_API_KEY` | none | Required. Shape-checked (`sk-ant-…`), never logged or returned. |
| `ANTHROPIC_MODEL` | `claude-sonnet-5-5` | Any Anthropic model id. Checked with the Models API (`models.retrieve`), cached for 10 minutes (1 minute after a failure). |
| `ANTHROPIC_EFFORT` | `medium` | `low`, `medium` or `high`. Sent as `output_config.effort`. |
| `ANTHROPIC_REFUSAL_FALLBACK` | `default` | Adds Anthropic's server-side refusal fallback (`fallbacks: "default"`, beta `server-side-fallback-2026-07-01`) on models that support it (Sonnet 5.5, Opus 5.5, Opus 5, Fable 5.1). `off` disables it. The fallback stays within Anthropic; usage records store the model that actually answered. |
| `AI_MONTHLY_REQUESTS_PER_ORGANIZATION` / `_PER_USER` | 2000 / 300 | Monthly allowances, per UTC calendar month. |
| `AI_REQUESTS_PER_MINUTE_PER_MEMBER` / `_PER_ORGANIZATION` | 6 / 60 | Shared rate limiter. The per-IP limit is 4× the member limit. |
| `AI_MAX_OUTPUT_TOKENS` | 8000 | `max_tokens` per model request. Includes adaptive thinking. |
| `AI_MAX_TOOL_ROUNDS` / `AI_MAX_TOOL_CALLS` | 5 / 12 | Per question. |
| `AI_REQUEST_TIMEOUT_MS` / `AI_TOOL_TIMEOUT_MS` | 120000 / 15000 | Whole-turn deadline / per-tool deadline. |
| `AI_MAX_INPUT_CHARS` / `AI_HISTORY_MESSAGES` | 4000 / 20 | Question length / stored messages replayed as context. |
| `AI_CONVERSATION_RETENTION_DAYS` | 180 | `0` keeps conversations indefinitely. |
| `AI_PRICE_INPUT_PER_MTOK` / `AI_PRICE_OUTPUT_PER_MTOK` | list price | Optional override for cost estimates. |

Invalid values make the Copilot report "not configured". The specific problem is logged as `ai.config` and never shown to the browser. There is no mock mode and no fallback to another AI provider.

### Model selection

The default is **Claude Sonnet 5.5** (`claude-sonnet-5-5`), as specified for this phase. To change models, set `ANTHROPIC_MODEL`, for example `claude-opus-5-5` for harder analysis at higher cost or `claude-haiku-5-5` for lowest cost. Things to know when changing it:

- Requests use adaptive thinking (`thinking: {type: "adaptive"}`) with the default `display: "omitted"`, so reasoning is never shown or stored.
- Tool schemas use strict mode, which caps optional (24) and nullable (16) parameters across all tools. See [AI tools](AI_TOOLS.md#rules-common-to-every-tool).
- Forced tool choice is not used, because current models reject `tool_choice` `any`/`tool`. The loop uses `auto`, and `none` on the final round.
- Cost estimates use the built-in list price for known models, or the price override.

## Request lifecycle

1. The browser fetches a CSRF token, then `POST /api/ai/chat` with `{message, conversationId?}`, the `X-CSRF-Token` header and the `X-EstateOS-Organization` stale-form guard. No other body fields are accepted.
2. Before any streaming, the server checks, in order:
   - exact origin and CSRF;
   - the verified Firebase session;
   - JSON body of at most 16 KiB;
   - AI configuration;
   - organization and active membership resolved from the session (`requireActiveOrganizationRequest`);
   - the stale-organization guard;
   - message validation;
   - rate limits (member, IP, company);
   - conversation ownership, loading the last `AI_HISTORY_MESSAGES` messages;
   - reservation of the monthly allowance (member, then company).
3. The response is an NDJSON stream of `start`, `text`, `tool` (progress labels only), then `done` or `error` events (`src/modules/ai/protocol.ts`).
4. `runCopilotTurn` runs the tool-use cycle. See [Tool-use lifecycle](#tool-use-lifecycle).
5. **Success:** the user message and the full answer are saved together in one transaction. A new conversation is created only at this point, titled from the first question. **Failure, stop, refusal or truncation:** nothing is saved, and the UI marks any partial text as not saved, with a Retry button where appropriate.
6. The server always writes an `AiUsageRecord` with provider-reported tokens, plus one `AiToolExecution` row per tool call, and logs a safe `ai.chat` line. If no model response arrived, the allowance reservation is released.

The Anthropic Messages API is stateless. Context is rebuilt on every turn from stored history: user and assistant **text only**, as alternating turns starting with a user turn and capped at about 60,000 characters. Tool inputs and results are never stored, so later turns query the CRM again.

## Tool-use lifecycle

`src/modules/ai/loop.ts` implements Anthropic's manual tool-use loop with streaming:

1. Call `client.beta.messages.stream()` with:
   - the cached static system prompt, then a per-request context block (company, role, Dubai date and time);
   - eight strict tools;
   - `tool_choice: auto`;
   - adaptive thinking and the configured effort;
   - the conversation so far.
2. Forward `text` deltas to the browser, then `finalMessage()`.
3. Check `stop_reason`:
   - `refusal` → failed (`AI_REFUSED`);
   - `max_tokens` or `model_context_window_exceeded` → failed (`AI_RESPONSE_INCOMPLETE`); truncated tool input is never executed;
   - `pause_turn` → continue;
   - no `tool_use` blocks → finished.
4. Append the assistant content **unchanged**, thinking blocks included.
5. Validate and execute every `tool_use` block on the server, in parallel, up to `AI_MAX_TOOL_CALLS`. Return **all** `tool_result` blocks, matched by `tool_use_id`, in a single user message. Failures use `is_error: true`.
6. Repeat up to `AI_MAX_TOOL_ROUNDS`. The final allowed call uses `tool_choice: none`, so Claude has to answer with what it has.

## Conversation history and retention

- Tables: `AiConversation` (owner, title, `messageCount`, timestamps) and `AiMessage` (role, content, sequence). See [Database](#database-changes).
- Conversations are private to the member who created them, within one organization. Owners and administrators cannot read other members' Copilot history. Every read and delete re-checks active membership and ownership in the stored operation.
- Saving is compare-and-set on `messageCount`. Two concurrent answers in the same conversation cannot interleave; the second gets a "conversation changed" error.
- Deleting removes the conversation and its messages and writes an `AI_CONVERSATION_DELETED` audit event.
- Retention: when a member opens their conversation list, their own conversations older than `AI_CONVERSATION_RETENTION_DAYS` are purged. No background job exists yet, so a member who never returns keeps old conversations until an organization-wide purge job is added (see limitations).

## Usage, allowances and cost control

- **Token usage:** `input_tokens`, `output_tokens`, `cache_read_input_tokens` and `cache_creation_input_tokens` from every model response, summed per turn. These are stored in `AiUsageRecord` with the served model, prompt version, status, error code, model request count, tool call count, duration and estimated USD cost. The estimate is not an invoice.
- **Monthly allowances:** each request reserves one slot against the member's and the company's monthly allowance. `ReserveAiRequest` is a single conditional `INSERT … ON CONFLICT DO UPDATE … WHERE request_count < limit`. Concurrent requests on any number of instances can therefore never exceed the limit; the integration test fires 20 concurrent reservations against a limit of 5. Exceeding an allowance returns `429 AI_QUOTA_EXCEEDED` with `Retry-After` set to the next month.
- **Rate limits:** the shared database-backed limiter (`enforceRateLimit`). Scopes are `ai.chat.member`, `ai.chat.ip` and `ai.chat.company`, each per minute.
- **Bounds:** `max_tokens`, tool rounds, tool calls, a per-tool timeout, the whole-turn timeout (abort signal), question length, history length, tool result size (40,000 characters) and query page sizes (at most 3 × 100 rows scanned per search).
- **Prompt caching:** the system prompt and tools are byte-stable, with `cache_control` on the static block. Cached reads appear as `cacheReadInputTokens`.
- No paid infrastructure is provisioned. Counters reuse the existing SQL Connect database.

## Supported questions

The Copilot answers from these tools; see [AI tools](AI_TOOLS.md) for details.

- Inventory: "Find 2-bedroom apartments in Dubai Marina under AED 2.5 million", "Which properties are available in JVC?", "Find villas around Dubai Hills Estate", "Show rental apartments in Business Bay under AED 120,000 a year".
- Property detail and comparison: "Compare EST-1042, EST-1043 and EST-1050".
- Projects: "Show projects in Sharjah", "Show available projects in Business Bay handing over before 2028", "What payment plans does Bay Tower have?".
- Leads: "Summarize today's lead follow-ups", "Show my overdue high-priority leads", "Which unassigned leads want to rent in JVC?" (owners and administrators see unassigned leads).
- Matching: "Find properties matching Ahmed's requirements" (uses the existing Phase 5D matching engine).
- Statistics: "Summarize my sales activities", "How many qualified leads do we have?".
- Drafting: "Draft a follow-up message for this lead". This is text only and is not saved to the CRM.

## Database changes

Additive only, in `dataconnect/schema/schema.gql`:

- new enums `AiMessageRole`, `AiRequestStatus` and `AiToolExecutionStatus`;
- new tables `AiConversation`, `AiMessage`, `AiUsageRecord`, `AiToolExecution` and `AiUsageCounter`;
- new enum values `AuditTargetType.AI_CONVERSATION` and `ActivityKind.AI_CONVERSATION_DELETED`.

Existing tables and operations are unchanged. All new tables are keyed by `(organization, …)`, and `AiToolExecution → AiUsageRecord` and `AiMessage → AiConversation` use composite tenant-scoped foreign keys, so cross-company references are rejected by PostgreSQL.

## Local and hosted environments

- **Local:** add the variables to `.env.local` and run `npm run dev:local`, which starts the persistent SQL Connect emulator. The emulator applies the additive schema at startup. Restart after changing `.env.local` or the schema, and back up first with `npm run db:backup`.
- **Switching models or keys:** change `ANTHROPIC_MODEL` or `ANTHROPIC_API_KEY` and restart. The status endpoint re-checks the model.
- **Hosted (Firebase App Hosting), requires approval before doing it:**
  1. Store the key in Cloud Secret Manager, for example `firebase apphosting:secrets:set ANTHROPIC_API_KEY`, and reference it as a secret in `apphosting.yaml`. Set the non-secret variables as plain `env` values.
  2. Deploy the SQL Connect schema and connector update, which adds the new tables and operations, after reviewing the migration diff, as described in [HOSTED_DATABASE_PLAN.md](HOSTED_DATABASE_PLAN.md).
  3. Set `RATE_LIMIT_KEY_SECRET` and `RATE_LIMIT_TRUSTED_PROXY_HOPS=1`.
  4. Review the Anthropic workspace spend limits and data-retention settings (see [AI security](AI_SECURITY.md#anthropic-data-handling)).

  None of this has been done. Hosted Cloud SQL was not modified.

## Tests

- `npm run test:ai`: 46 unit tests using **mocked** Anthropic responses. They cover configuration, error mapping (invalid key, rate limit, billing, model unavailable, timeout), the full tool-use loop (matching `tool_use_id`s, parallel calls, unchanged assistant content, limits, refusal and truncation, cancellation), unknown and invalid tool rejection, prompt-injection handling, strict schema compatibility and strict-mode parameter limits, data minimisation and hidden coordinates, the read-only guard, request policy and Markdown link safety.
- `npm run test:dataconnect`: emulator integration cases in `tests/sql-connect-ai.cases.mjs`. They cover per-role access, rejection of anonymous, unverified and non-member access, persistence and ordering, compare-and-set conflicts, owner-only privacy within a company, cross-company isolation, NO_ACCESS enforcement, deletion with audit, retention purge, search, atomic allowances under concurrency, and usage and tool rows with composite foreign keys.
- `npm run test:ai:e2e`: the real app in headless Chrome on isolated emulators with a deliberately invalid key (free). `AI_E2E_LIVE=1 npm run test:ai:e2e` adds about five real Claude requests using the key from `.env.local`, passed only to the isolated server. Results are in [Project handover](PROJECT_HANDOVER.md#phase-6a-verification-status).

## Known limitations

- **Text location matching only.** No distance or radius search and no travel times. Coordinates are never sent to Claude. "Around Dubai Hills" matches location text and common abbreviations.
- **Partial results are reported, not hidden.** Inventory filters in the existing stored queries are exact-match. When a filter has to be applied in memory (word-level location matching, minimum bedrooms, project or developer name, rent periods, lead budgets or sources), the tool scans at most 300 records and reports `complete: false` if more exist. The prompt tells Claude to say so.
- **Listing searches only cover what the stored queries expose.** Sale/rent searches use active listings, which carry no area text or inventory status. Property-unit searches report the property's *reference* price, not a listing price.
- **Some tools are unavailable to managers.** Managers have no inventory scope (existing rule), so inventory and matching tools return "not permitted" for them; lead and dashboard tools still work.
- **No organization-wide retention job.** Purging runs per member when they open their history. Organization administrators cannot view or export members' Copilot history, and there is no usage dashboard UI yet; usage is in the database and logs.
- **Each tool call re-verifies the session.** This adds latency but keeps authorization identical to the CRM screens.
- **Write actions are out of scope**, as are WhatsApp/email sending, advertising and portal publishing. These are planned for later phases with explicit approval steps.
