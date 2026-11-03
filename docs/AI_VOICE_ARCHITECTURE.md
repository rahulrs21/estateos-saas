# AI voice assistant architecture (Phase 6F.5)

A foundation for an AI phone assistant that answers property enquiries from approved facts and hands callers to a person. **It runs in test mode only.** Staff type what a caller says, and the assistant replies in text. No phone call is placed or answered, nothing is booked and nothing is sent.

## Status

| Part | State |
| --- | --- |
| Configuration and the test-call simulator | Implemented and tested on emulators |
| The assistant's own rules | Implemented and tested |
| Live AI phone calls | **Not available.** There is no live status in the schema or the API, and no code connects the assistant to a telephone line. |
| Live Claude replies | **Not run.** The browser tests use the invalid-key path, and the reply checks are tested with recorded fixtures. Testing with a real key uses Anthropic credit; do it only with your go-ahead. |

The assistant's own rules are:
- the AI disclosure comes first;
- a request for a person or an opt-out is handled without Claude;
- every reply is checked against the facts;
- the caller can interrupt;
- turn and time limits apply.

## Who can use it

Only **owners and administrators** can configure the assistant and run test calls. The checks run on the server, and again in the database for every operation.
- Managers are excluded: the assistant's facts come from inventory, which managers cannot read ([PERMISSIONS.md](PERMISSIONS.md)).
- Agents are excluded.

Administrators can read every test call in their company. Only the person who started a test call can continue it.

## Configuration (`/communications/voice-assistant`)

| Setting | Rule |
| --- | --- |
| Status | *Draft* or *Ready for test calls*. Test calls need *Ready*. There is no live option. |
| AI disclosure | Required, 20-400 characters. It must say the caller is speaking with an AI (for example "AI", "virtual assistant", or "ذكاء اصطناعي" in Arabic). It is spoken before anything else. |
| Greeting | Spoken after the disclosure |
| Qualification questions | Up to 8. The assistant asks them one at a time and notes the answers. |
| Handoff message | Used whenever the call goes to a person |
| Allowed projects and listings | Up to 10 of each. Only active ones are used. These are the **only** facts the assistant has. |
| Limits | Caller turns per call (2-30), minutes per call (1-30), output tokens per reply (1,000-4,000) |

Each save is versioned (compare-and-set) and audited (`VOICE_ASSISTANT_UPDATED`).

## What the assistant knows

When a test call starts, the server reads the allowed projects and listings **as the member**, through the same inventory services the CRM screens use, then keeps a fixed subset of fields:

| Record | Fields kept |
| --- | --- |
| Project | Name, developer, type, status, construction status, area-level location, handover dates, starting price, permit number, amenities, active payment plans, available unit types with reference price ranges |
| Listing | Reference, title, purpose, status, asking price, permit number, the property's type, bedrooms, bathrooms, areas, availability, area-level location, building and project |

Left out entirely:
- leads, contacts, notes, staff descriptions, street addresses, coordinates and media;
- inactive or unavailable records, which are listed for the tester as left out.

The facts are stored with the test call (`factsJson`), so a test is reproducible and shows exactly what the assistant had.

## A turn

```
caller words ──► person or opt-out? ──yes──► handoff / goodbye (no Claude)
                      │ no
                      ▼
               limits reached? ──yes──► limit message, call ends
                      │ no
                      ▼
       caller turn saved, reply marked pending
                      │
                      ▼
        Claude (structured output, facts cached)
                      │
                      ▼
   EstateOS checks the reply ──fails──► handoff message
                      │ passes
                      ▼
   reply saved, unless the turn was interrupted meanwhile
```

**Handled without Claude:**
- asking for a person (for example "speak to an agent", "موظف") hands over;
- asking not to be contacted ("stop calling", "لا تتصل") ends the call with a goodbye. In test mode no suppression is created. A live version would pass the request to staff to add it to the do-not-call list ([CALL_PRIVACY_COMPLIANCE.md](CALL_PRIVACY_COMPLIANCE.md)).

**The request to Claude** reuses the Phase 6B/6C structured-output path (`generateStructured`): the configured model, adaptive thinking, the company's AI allowance and rate limits.
- The facts are sent first and cached, so later turns reuse them.
- The caller's words are wrapped in `<caller>` and treated as untrusted. Angle brackets are removed, so a caller cannot close the wrapper.
- Usage is recorded with feature `VOICE_ASSISTANT`, content type `VOICE_TEST_TURN` and prompt version `voice-test-1`.

**Claude's answer** has a closed schema: the reply, an intent, the fact keys it used, an optional viewing request and the caller's answers to the questions. The intent is one of:
- answer;
- qualify;
- viewing request;
- handoff;
- close.

There are no actions.

**The checks** (`checkVoiceReply` in `src/modules/communications/voice.ts`). A reply is refused if it:

| Check | What it catches |
| --- | --- |
| Unsupported number | Any number not found in the facts, the configuration or the caller's own words. "1.2 million", "1.2M" and Arabic digits are understood. |
| Spelled-out amount | Words like "about one million" that cannot be checked |
| Availability | Availability or handover claims without a cited approved record |
| Unknown record | A fact key that is not in the facts |
| Sensitive topic | Investment returns, yields, mortgages or financing, visas, legal matters, discounts or negotiation |
| Contact details | Links and email addresses |
| Booking claim | Saying a viewing is booked or confirmed |

A refused reply is replaced by the handoff message, and the tester sees why.

**Outcomes for other replies:**

| Case | What the caller hears |
| --- | --- |
| A viewing request whose only fault is claiming a booking | The standard wording: noted, *nothing has been booked yet* |
| A viewing request without problems | Claude's reply. The request is stored on the test call with status REQUESTED; it is never booked and never touches the viewing calendar. |
| Claude fails (refusal, timeout, invalid key, cut-off reply) | The handoff message. The reason "Claude could not answer" is shown to the tester. |

## Interruptions, limits and state

- **Interruptions.** Each caller turn has an ID chosen by the browser. While Claude answers, the session is marked with that pending turn, and the tester's **Interrupt** button:
  1. aborts the request, which stops Claude;
  2. calls `POST …/sessions/{id}/interrupt`.

  Whichever is recorded first wins. The reply is saved only by a compare-and-set that requires the turn to still be pending, so an interrupted reply is never saved and an interruption is recorded once. A pending reply that is lost (for example after a server restart) stops blocking the call after two minutes.
- **Limits.**
  - Reaching the turn limit, the time limit, or a stored transcript of more than 32,000 characters ends the call with the handoff message (status *Limit reached*).
  - Ended calls accept nothing more.
- **Server-only writes.** Test sessions are written only by the server (`StartVoiceTestSession` and `SaveVoiceTestSession` are `NO_ACCESS` operations that re-check the member and the configuration's revision), so a member cannot store an assistant turn that EstateOS did not check. Starting a test is audited (`VOICE_ASSISTANT_TEST_STARTED`).

| Session status | Meaning |
| --- | --- |
| In progress | Accepting caller turns |
| Handed to a person | The caller asked, the facts did not cover the question, or Claude was unavailable |
| Ended | The caller said goodbye, opted out, or the tester ended it |
| Limit reached | Turn or time limit |

## API

| Method and path | Purpose |
| --- | --- |
| `GET /api/communications/voice-assistant` | Configuration, recent test calls, active projects and listings to choose from |
| `PUT /api/communications/voice-assistant` | Save the configuration (`expectedRevision` 0 creates it) |
| `POST /api/communications/voice-assistant/sessions` | Start a test call |
| `GET /api/communications/voice-assistant/sessions/{id}` | The transcript, status and facts |
| `POST …/sessions/{id}/turns` | `{utterance, turnId, expectedRevision}` |
| `POST …/sessions/{id}/interrupt` | `{turnId}` |
| `POST …/sessions/{id}/end` | End the test call |

Mutations need the CSRF token and the company header, like the rest of the hub ([COMMUNICATION_HUB.md](COMMUNICATION_HUB.md)).

## Future live adapter (not implemented)

A live assistant would run through a voice provider, not a new VoIP or WebRTC service. Retell AI's custom-LLM integration is the expected route:
- Retell handles telephony, speech recognition and speech synthesis;
- it opens a WebSocket to the application for each call and sends the transcript as the caller speaks;
- the application answers with the text to speak.

EstateOS would reuse everything above per turn: the disclosure, the caller intents, the fact sheet, the checks, the handoff and the limits.

It is not built because:
- Next.js route handlers cannot host a long-lived WebSocket, so it needs a separate small service;
- Retell's custom-LLM protocol must be verified against Retell's documentation;
- it needs:
  - a verified provider connection and a company line with the *Voice assistant* purpose ([TELEPHONY_PROVIDERS.md](TELEPHONY_PROVIDERS.md));
  - an inbound-only first scope;
  - recording and consent decisions;
  - legal review of AI calling in the UAE;
  - **your explicit approval**.

Outbound AI calling, and autonomous marketing calls in particular, are out of scope.

## Testing

| Command | Covers |
| --- | --- |
| `npm run test:communications` (`tests/voice-assistant.test.ts`) | Disclosure rule (English and Arabic); no live status; person and opt-out detection; number reading; recorded replies with invented prices, spelled amounts, unsupported availability, unknown records, sensitive topics, links and booking claims; fallback and viewing outcomes; interruption before and after the reply; lost pending replies; turn and time limits; the untrusted caller wrapper; the closed schema |
| `npm run test:dataconnect` | Owner and administrator only; disclosure and limits enforced in the database; one configuration per company with compare-and-set; server-only session writes; readiness and revision checks; only the starter continues a call; ended calls frozen; token totals; tenant isolation |
| `npm run test:communications:e2e` | Manager and agent denial (API and navigation); configuring through the page; the disclosure first; handoff on request without Claude; the invalid-key fallback with usage recorded; interrupting a pending reply once; ended calls; another company and another tester denied |
