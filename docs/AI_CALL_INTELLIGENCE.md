# AI call intelligence (Phase 6F.4)

Claude summaries of calls, built on the Anthropic integration of Phases 6A-6C. They are drafts for the agent: each point quotes the call, EstateOS checks every quote, and nothing changes customer records or sends a message without a person.

## Status

- Implemented and tested on emulators.
- **Live Claude summaries have not been run.** The browser tests use the invalid-key path: Anthropic refuses the request, nothing is stored and the usage is recorded. Review and suggestions are tested with a stored synthetic summary.
- Run `AI_E2E_LIVE=1`-style checks only with your go-ahead, because they use Anthropic credit.

## When a summary can be made

All of these are required, checked on the server and again in the database (`CreateCallAiSummary` is server-only):

- The company enabled **Claude call summaries** in Calling settings. Off by default.
- The call was answered.
- The member is the call's agent, or an owner or administrator.
- There is a source:
  - **the transcript**: one added under the call's consent evidence ([recordings and transcripts](CALL_PRIVACY_COMPLIANCE.md#recording-transcripts-and-consent));
  - or **the agent's notes**.

  Claude never hears audio.
- The company's AI allowance and the rate limits (`ai.calls.*`, like the sales assistant) allow it.

## What is sent to Claude

| Step | Detail |
| --- | --- |
| Source lines | Transcript segments become `T1, T2…` and note lines `N1, N2…`, each with a speaker role and time |
| Redaction | Phone numbers, emails and long digit runs are removed. Speaker names become *Agent*, *Customer* or *Speaker 1, 2…* (`minimizePersonalData`, `sourceLines`). No customer name, number or CRM record is sent. |
| Untrusted data | The source is wrapped in `<call_source>`. The system prompt treats it as untrusted data, so instructions inside it (for example "send a WhatsApp") are ignored. |
| Request | One structured-output request (`generateStructured`, adaptive thinking, the configured model). Usage is recorded as feature `CALL_AI`, prompt version `call-summary-1`. |

## What comes back, and how it is checked

The schema (`src/modules/communications/intelligence.ts`) allows only these sections:
- reason for the call;
- requirements;
- locations and projects;
- budget;
- preferences;
- questions;
- agreements;
- next steps;
- up to six suggestions;
- overall confidence;
- limitations.

Every item is marked STATED (said on the call) or INFERRED (Claude's interpretation), has a confidence, and quotes its evidence with a line reference. Unknown fields and suggestion kinds are rejected.

EstateOS then checks each quote against the line it cites, ignoring case, punctuation and Arabic diacritics:

| Result | Shown as |
| --- | --- |
| Quote found | The quote, with its transcript time |
| Quote not found | **Not found in the source**, low confidence |
| STATED with no verified quote | Downgraded to **Claude's inference** |
| A budget without a verified quote containing an amount | Dropped (never estimated) |
| Any unsupported point | Overall confidence lowered from high to medium |

Transcripts can contain recognition errors, and the panel says so.

## Review and suggestions

- A summary is a **draft** until the agent marks it reviewed or dismisses it. Each happens once and is audited.
- Suggestion kinds: follow up, prepare a proposal draft, schedule a viewing, clarify the budget, share a payment plan, discuss an alternative property. Each is accepted or dismissed once, by the call's agent or an owner or administrator:

  | Suggestion | Accepting it |
  | --- | --- |
  | Follow up, clarify budget, share payment plan, alternative property | The member picks a time; a normal lead follow-up is scheduled with the existing `ScheduleLeadFollowUp` operation (existing follow-ups stay). The suggestion is claimed first, so a double click cannot schedule twice. |
  | Proposal draft | Opens Content Studio (client proposal) for the lead; the member chooses the property and generates a draft there. Nothing is sent. |
  | Schedule a viewing | Opens the lead's viewing form |

- **Customer facts are never updated from a summary.** Requirements and budgets stay on the summary for the agent to copy into the lead if they agree.
- The call page links to the lead's AI sales review (Phase 6C) for a fresh rule-based assessment.

## Privacy

- **Visibility:** summaries are visible only to members who may read the call; other companies and members without access get not-found.
- **Erasure:** a summary made from a transcript is erased (content cleared, marked deleted) in the same transaction when that transcript is deleted, its consent is withdrawn, or it reaches the retention date.
- **No raw output stored:** only the checked summary is kept.

## Costs

Each summary is one Claude request, counted in the company's monthly AI allowance and recorded in `AiUsageRecord` with its estimated cost (feature `CALL_AI`). If Claude is never reached (for example a connection failure), the allowance is returned.

## Testing

| Command | Covers |
| --- | --- |
| `npm run test:communications` | Redaction; speaker roles; the untrusted wrapper. A recorded fixture with a fabricated quote, a guessed budget and a quote from the wrong line. Injected action kinds and extra fields rejected. |
| `npm run test:dataconnect` | Server-only creation, gated by the switch, the member and the transcript; suggestions tied to their summary; once-only review and decisions; access; erasure with the transcript |
| `npm run test:communications:e2e` | The switch; the invalid-key failure storing nothing and recording usage; the panel's evidence badges; accepting a follow-up exactly once; marking reviewed; the lead unchanged; managers' and other companies' denials |
