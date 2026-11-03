# Communication hub (Phase 6F)

Calls with customers, recorded against leads and contacts, with the rules that apply to them. Compliance rules are in [CALL_PRIVACY_COMPLIANCE.md](CALL_PRIVACY_COMPLIANCE.md).

## Status

| Sub-phase | Scope | Status |
| --- | --- | --- |
| 6F.1 | Call records, manual call logging, the lead and contact call panel, settings and the do-not-call list (API) | Implemented and tested on emulators |
| 6F.2 | Hub pages, provider connections and lines, signed webhooks, gated live dialling | Implemented and tested on emulators; no provider connected ([providers](TELEPHONY_PROVIDERS.md)) |
| 6F.3 | Consent evidence, uploaded recordings and transcripts, private storage, audited access, retention | Implemented and tested on emulators ([privacy](CALL_PRIVACY_COMPLIANCE.md#recording-transcripts-and-consent)) |
| 6F.4 | Claude call summaries and suggestions | Not started |
| 6F.5 | Voice assistant configuration and test-mode simulator | Not started |
| 6F.6 | Meetings, workflow triggers, reports | Not started |

**No calling provider is connected, and EstateOS places no calls.** The Call button stays disabled and lists the reasons until a verified provider, an active registered line and an owner's or administrator's confirmation are all in place ([live calling](TELEPHONY_PROVIDERS.md#live-calling)). Agents log calls they make or take through the company's approved phone service.

## Calls

A `CallRecord` is EstateOS's own record of one call. Two facts are kept separate:

- **Connection status** (`callStatus`): what happened on the line. `COMPLETED` means the customer answered; `NO_ANSWER`, `BUSY`, `FAILED` and `CANCELLED` mean they did not. `INITIATED`, `RINGING` and `IN_PROGRESS` are only for provider calls in progress.
- **Outcome** (`outcome`): what the agent recorded about the conversation, such as interested, asked for a viewing or asked not to be called. An outcome can only be recorded for an answered call; the database refuses one on an unanswered call.

Derived facts (`src/modules/communications/call-state.ts`):

| Fact | Meaning |
| --- | --- |
| Answered | The connection status says the customer picked up |
| Missed | An incoming call that ended unanswered (an unanswered outgoing call is an attempt) |
| Conversation | Answered, with an outcome other than wrong number |

A dial attempt is never counted as a conversation. "Last answered call" on the lead uses answered calls only.

Other fields:
- `source`: `MANUAL` (logged by the agent) or `PROVIDER` (later, from signed provider events). Manual calls show "Logged manually" everywhere.
- `callType`: `SERVICE` (the customer asked for it), `FOLLOW_UP` (on the customer's own enquiry), `MARKETING` (unsolicited; telemarketing rules apply) or `INBOUND_ENQUIRY`.
- `counterpartyNumber`: the customer's number in E.164, always one of the numbers on the lead's contact (or the lead's own phone for older leads without a contact).

### Call states

`transition()` decides whether an incoming status changes a call. Calls only move forward (initiated, ringing, in progress, final); a final status never changes; a late or repeated status is ignored. An answered call can end only as completed or failed (dropped). Provider webhooks (6F.2) use this so retries and out-of-order deliveries cannot corrupt a call.

## Hub

`/communications` (navigation: Communications; `/workspace/communications` redirects there):

- **Overview** (`/communications`): the last 30 days of calls the member may read, with:
  - outgoing attempts, answered, missed incoming, conversations and the average answered call;
  - recent, missed and lead calls;
  - calls that need a follow-up that was not scheduled;
  - recorded outcomes;
  - pending follow-ups and scheduled viewings in the next 7 days;
  - calls by agent (owners and administrators).

  Only stored records are counted; with more than 1,000 calls in the period the page says the figures cover the latest 1,000.
- **Calls** (`/communications/calls`): filter by direction, status, outcome, how the call was recorded, dates (Dubai) and, for owners and administrators, agent; 25 per page.
- **Call page** (`/communications/calls/[id]`):
  - customer, agent, purpose and timings;
  - the company line and provider;
  - notes, follow-up and related viewing;
  - the calling-rule warnings that applied when the call was made;
  - the provider's signed events, with what each changed;
  - edit, and hang up for a provider call in progress.
- **Settings** (`/communications/settings`):
  - calling rules (read-only for managers and agents);
  - for owners and administrators: live-calling conditions and the confirmation statement, provider connections, company lines and the do-not-call list.

### Metrics

`src/modules/communications/metrics.ts` keeps these apart:

| Metric | Definition |
| --- | --- |
| Outgoing attempts | Finished outgoing calls |
| Answered | Outgoing calls the customer picked up (connection status only) |
| Missed | Incoming calls nobody answered |
| Conversations | Answered calls, in either direction, with an outcome recorded (wrong numbers excluded) |
| Outcomes | Counted for answered calls only |
| Average answered call | Talk time of answered calls; labelled as not a quality measure |

Calls still ringing are counted separately. Per-agent figures are counts only.

## Manual call logging

The **Log a call** dialog on the lead and contact pages records:
- direction, purpose, what happened, the number used (from the numbers on record);
- the start time (Dubai), the duration for answered calls, the outcome and notes;
- an optional related viewing (lead only) and a follow-up.

Rules:
- Calls can be logged up to 30 days after they happened, never in the future.
- Every form submission carries a `requestId`. The call ID is derived from the company, the member and that ID, so a repeated submission returns the existing call ("already logged") instead of creating a second one.
- A follow-up is scheduled through the existing `ScheduleLeadFollowUp` operation as the member (with `replaceExisting: false`, so other pending follow-ups stay), then linked to the call. If scheduling fails, the call is still saved and the agent is told.
- **Compliance rules never block a manual log**: the call already happened, and blocking would only stop agents recording it. The server evaluates the rules (with every agent's calls to the number) and returns warnings, which the panel shows.
- An outcome of *asked not to be called*, *wrong number* or *rejected the offer* adds the number to the do-not-call list in the same database transaction.

Logging writes a `CALL_LOGGED` lead activity (without the notes, which stay on the call) and an audit entry. Editing the outcome, notes or follow-up flag is a compare-and-set update by the call's agent or an owner or administrator; the connection status is never edited.

## Lead and contact pages

`CallPanel` (`src/modules/communications/components/call-panel.tsx`) shows:
- the numbers on record, with *Do not call* or *No marketing calls* badges;
- the disabled Call button and the reason;
- the last answered call and the number of calls;
- the company's calling hours and whether marketing calls are enabled;
- the call history (newest first, 20 per page) with outcome, duration, agent, notes, linked follow-up and related viewing;
- compliance warnings for the call just logged.

The contact page lists calls on the contact and on its leads that the member may read.

## API

All routes use the verified session; the company is resolved on the server. Mutations also need same-origin, the CSRF token and an `X-EstateOS-Organization` header matching the session's company (`src/modules/communications/server/http.ts`).

| Route | Method | Purpose |
| --- | --- | --- |
| `/api/communications/leads/[leadId]/calls` | GET | Lead call panel data (`?offset=`) |
| `/api/communications/contacts/[contactId]/calls` | GET | Contact call panel data |
| `/api/communications/calls` | POST | Log a call |
| `/api/communications/calls/[callId]` | GET, PUT | Call detail; edit outcome, notes, follow-up flag |
| `/api/communications/settings` | GET, PUT | Rules (all members read; owners and administrators change) |
| `/api/communications/suppressions` | GET, POST | Do-not-call list (owners and administrators) |
| `/api/communications/suppressions/[id]/withdraw` | POST | Withdraw with a reason |
| `/api/communications/calls` | GET | Call list with filters (`direction`, `callStatus`, `outcome`, `source`, `agent`, `from`, `to`, `offset`) |
| `/api/communications/calls/dial` | POST | Start a live call on a lead (refused with reasons unless every condition holds) |
| `/api/communications/calls/[callId]/end` | POST | Hang up a provider call in progress |
| `/api/communications/dashboard` | GET | Overview data |
| `/api/communications/providers`, `/providers/[id]`, `/providers/[id]/enabled`, `/providers/[id]/verify` | GET, POST, PUT | Provider connections (owners and administrators) |
| `/api/communications/lines`, `/lines/[id]`, `/lines/[id]/registration`, `/lines/[id]/active` | POST, PUT | Company lines (owners and administrators) |
| `/api/communications/attestation`, `/attestation/revoke` | POST | The live-calling confirmation (owners and administrators) |
| `/api/communications/webhooks/[provider]/[connectionId]` | POST | Signed provider webhooks; no session ([details](TELEPHONY_PROVIDERS.md#webhooks)) |
| `/api/communications/calls/[callId]/media` | GET | Consent evidence, recordings and transcripts of a call |
| `/api/communications/calls/[callId]/consents`, `/consents/[id]/withdraw` | POST | Record or withdraw notice and consent |
| `/api/communications/calls/[callId]/recordings` | POST | Upload a recording (raw WAV or MP3 body; `X-Consent-Evidence`) |
| `/api/communications/calls/[callId]/transcripts` | POST | Upload a transcript (WebVTT, SRT or text) |
| `/api/communications/recordings/[id]/content`, `/transcripts/[id]/content` | GET | Private, audited file access |
| `/api/communications/recordings/[id]/delete`, `/transcripts/[id]/delete` | POST | Delete (owners and administrators) |

## Security

| Area | OWNER / ADMIN | MANAGER | AGENT |
| --- | --- | --- | --- |
| Log a call | Any active lead or contact of the company | Leads assigned to them; contacts they may access | Same as MANAGER |
| Read calls | Company-wide | Calls they handled and calls on leads assigned to them | Same as MANAGER |
| Edit a call | Any call | Calls they handled | Same as MANAGER |
| Settings and do-not-call list | Change | Read the rules only | Read the rules only |

MANAGER access is assignment-based like the rest of the CRM, because EstateOS has no verified team or branch membership yet ([PERMISSIONS.md](PERMISSIONS.md)). Company-wide manager access needs a team-membership module first.

Every member operation runs as the signed-in member (impersonated), and the database re-checks:
- active membership;
- lead or contact access;
- that the number is on record (`CALL_NUMBER_NOT_ON_RECORD`);
- that a related viewing or follow-up belongs to the same lead;
- that an outcome is only on an answered call;
- the suppression a do-not-call outcome requires.

Guessed IDs from another company or outside the member's access return not-found. The one server-only operation, `CallComplianceFacts`, receives the company from the session and returns timestamps and statuses only (no notes or names).

## Data model

`dataconnect/schema/communications.gql`: `CommunicationSettings` (one per company), `CommunicationSuppression`, `CallRecord`, and since 6F.2 `CommunicationProviderConnection`, `CommunicationPhoneLine` and `CallProviderEvent` (plus the provider connection, provider call ID and line on `CallRecord`, unique per provider call). Every row is keyed by company with composite tenant foreign keys. Operations are in `dataconnect/connector/communications.gql` and `communication-providers.gql`.

Shared enums gained values at the end only (`ActivityKind`: `CALL_LOGGED`, `CALL_UPDATED`, `COMMUNICATION_SETTINGS_UPDATED`, `COMMUNICATION_SUPPRESSION_CHANGED`; `AuditTargetType`: `CALL`, `COMMUNICATION_SETTINGS`, `COMMUNICATION_SUPPRESSION`). SQL Connect cannot reorder enum values ([LOCAL_DATABASE.md](LOCAL_DATABASE.md#what-caused-data-loss-before), item 8).

**Hosted rollout** (needs approval, not done): deploy the additive schema and the `communications.gql` operations with the usual reviewed SQL Connect rollout.

### SQL Connect behaviour to keep in mind

- A `@check` on a field skipped by `@include(if: false)` is denied ("no invocation"). Put such checks on an enclosing `query` block that always runs (see `viewingCheck` in `LogLeadCall`).
- `_expr` values of a field skipped by `@include` are still evaluated, so they must not produce null for non-null columns (see the suppression insert).

## Testing

| Command | What it covers |
| --- | --- |
| `npm run test:communications` | Call states, numbers and destination rules, suppressing outcomes, every compliance rule including timezones and frequency limits, metrics, provider signatures and the live-call blockers (16 tests) |
| `npm run test:dataconnect` | The stored operations: record-level access, number on record, atomic suppressions, idempotent IDs, compare-and-set edits, follow-up links, contact calls, settings bounds and tenant isolation; providers, lines, the live-call gate, webhook operations and hub access (14 cases) |
| `npm run test:communications:e2e` | The real app in a browser: the panel, logging from the lead with a follow-up, persistence after reload, duplicates, warnings, opt-out, edits, manager, cross-company and forged-header denials, the contact page and the do-not-call list; provider settings, signed and refused webhooks, refused live calls and the hub pages (15 checks) |

All data is synthetic; no real number is called.
