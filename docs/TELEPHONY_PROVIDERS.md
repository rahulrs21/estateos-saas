# Telephony providers (Phase 6F.2)

How EstateOS connects to calling providers, accepts their webhooks and decides when a live call may be placed. Calling rules are in [CALL_PRIVACY_COMPLIANCE.md](CALL_PRIVACY_COMPLIANCE.md); call records in [COMMUNICATION_HUB.md](COMMUNICATION_HUB.md).

## Status

- **No provider is connected and no live call has been placed.**
- Everything below was tested with synthetic, locally signed webhooks on isolated emulators:
  - the adapters;
  - webhook verification;
  - the call state handling;
  - the live-call gate in the server and the database.
- Not exercised against a real Twilio or Retell account: credential checks, starting a call and hanging up. Do that in a provider sandbox, after approval, before enabling live calling for a company.

## Adapter

`src/modules/communications/providers/` defines one `TelephonyAdapter` per provider type:

| Member | Purpose |
| --- | --- |
| `capabilities` | What EstateOS may do with it (dial, hang up, status events, recordings, transcripts, voice agent, verified webhooks) |
| `verifyWebhook` | The provider's own signature check over the raw body (and URL for Twilio) |
| `parseWebhook` | Provider payload → normalized events (`CALL_STATUS`, `RECORDING`, `TRANSCRIPT`, `ANALYSIS`), each with a unique event key |
| `verifyCredentials` | One authenticated request to the provider (started by an owner or administrator) |
| `initiateCall`, `endCall` | Click-to-call and hang-up, where supported |

| Provider | Dial | Webhooks | Use |
| --- | --- | --- | --- |
| Twilio Programmable Voice | Yes (click-to-call) | `X-Twilio-Signature` via the official `twilio` package | Agents' calls |
| Retell AI | Never | `X-Retell-Signature` via the official `retell-sdk` package | The future voice assistant only ([AI_VOICE_ARCHITECTURE.md](AI_VOICE_ARCHITECTURE.md)) |
| PBX / other approved provider | No | None | Placeholder until a specific UAE telecom or PBX is approved and its API and webhook contract are verified |

Both SDKs are server-only dependencies. They are imported only from server code and the pure adapter files, never from client components.

### Twilio

- **Webhooks:** form-encoded status callbacks signed with HMAC-SHA1 over the exact URL plus the sorted parameters (`validateRequest`). JSON bodies use the `bodySHA256` query parameter (`validateRequestWithBody`). EstateOS rebuilds the URL from `APP_ORIGIN`, never the `Host` header, so the address configured in Twilio must match `APP_ORIGIN` exactly.
- **Status mapping:**

  | Twilio status | EstateOS status |
  | --- | --- |
  | `queued`, `initiated` | INITIATED |
  | `ringing` | RINGING |
  | `in-progress` | IN_PROGRESS |
  | `completed` | COMPLETED |
  | `busy` | BUSY |
  | `failed` | FAILED |
  | `no-answer` | NO_ANSWER |
  | `canceled` | CANCELLED |

  Unknown statuses change nothing.
- **Click-to-call:**
  1. Twilio calls the agent's own phone (the line's forwarding number) from the company line.
  2. The answered call runs TwiML (built with the SDK's `VoiceResponse`) that `<Dial>`s the customer's number on record, with the company line as caller ID.
  3. The customer leg's status callbacks carry `ParentCallSid`, so both legs map to the one EstateOS call. The customer's leg decides the call's status.
  4. If the agent's leg ends before the customer is dialled, the call ends as CANCELLED.
- **Incoming calls:**
  - Status callbacks for calls to an ACTIVE company line create an incoming call record for the line's assigned member.
  - The caller is linked to a contact when exactly one contact has that number, and to its lead when the contact has exactly one active lead.
  - Routing an incoming call (the number's Voice URL returning TwiML) is **not implemented**. Configure the number's routing in Twilio until it is, and point only its status callback to EstateOS.
- **UAE numbers:** Twilio's UAE regulatory page lists only toll-free (+971 800) numbers. Whether a Twilio setup is usable for a UAE brokerage needs the provider and legal review in [CALL_PRIVACY_COMPLIANCE.md](CALL_PRIVACY_COMPLIANCE.md#needs-legal-review).

### Retell

- **Webhooks:** `X-Retell-Signature: v=<ms>,d=<hex>`, an HMAC-SHA256 of the raw body plus the timestamp, keyed with a Retell API key that has webhook access. The SDK's `verify` also rejects timestamps more than five minutes away, which stops replays.
- **Events:**
  - `call_started` → IN_PROGRESS.
  - `call_ended` → mapped from `disconnection_reason`:
    - `dial_no_answer`, `voicemail_reached`, `user_declined` → NO_ANSWER;
    - `dial_busy` → BUSY;
    - dialling and telephony errors → FAILED;
    - otherwise COMPLETED.
  - `call_analyzed` and `transcript_updated` are kept as received events for 6F.3 and 6F.4.
  - Web calls are ignored.
- **Calls:** EstateOS never starts Retell calls (`initiateCall` refuses).

## Connections and secrets

An owner or administrator adds a connection on `/communications/settings`:
- the provider;
- a name;
- the provider's non-secret account identifier (Twilio Account SID, Retell agent ID);
- the **name** of the server secret holding the credential.

| Rule | Detail |
| --- | --- |
| No credentials in the database | Secret names must match `COMMS_[A-Z0-9_]{3,60}`, and the server reads no other environment variable. A pasted credential is refused as a name. |
| Secrets stay server-side | Locally in `.env.local`; when hosted, in Secret Manager mapped to the same name. The browser sees only whether the secret is set. |
| Connection status | NOT_CONFIGURED (details missing) → CONFIGURED (saved, not verified) → VERIFIED or ERROR (after **Check connection**) → DISABLED |
| Re-verification | Any change to the details, or enabling again, returns the connection to unverified |
| Recording a check | Only the server can record a check result (`RecordCommunicationProviderVerification` is server-only and re-checks the requester's role) |
| Limits | Checks are rate-limited (5 a minute per company). Up to 10 connections per company. |

## Company lines

A line is a company number on a connection:
- a purpose (sales, service, marketing, voice assistant);
- an assigned member;
- the member's own phone, which click-to-call rings first.

It becomes ACTIVE only after an owner or administrator confirms the number is registered to the company's commercial licence, and while it is assigned to an active member. Changing the number or the connection means disabling the line and adding a new one.

## Webhooks

`POST /api/communications/webhooks/{twilio|retell}/{connectionId}`, with no session. The settings page shows each connection's exact address. In order:

1. **Rate limits:** 600 a minute per connection, 1,200 per client IP. Bodies over 64 KB are refused.
2. **Connection lookup:** by the ID in the URL. The company always comes from the connection row. Unknown, disabled or incomplete connections, or a provider in the URL that differs from the connection's, get 404.
3. **Signature:** checked with that connection's own secret. A missing or wrong signature gets 401.
4. **Payload:** a malformed payload gets 400. Every event's provider account must equal the connection's account identifier, otherwise 403.
5. **Recording:** each event is stored once, keyed by the connection and the event key. A retried or replayed delivery hits the unique key and changes nothing.
6. **Status change:** applied through the call state machine with compare-and-set: the call moves only forward, and final states never change. Late, repeated or invalid statuses are kept as events with their result (`FINAL`, `OUT_OF_ORDER`, `NOT_ALLOWED`, `NO_CHANGE`) and shown on the call page.

Server errors return 500, so the provider retries; the event key stops a retry being applied twice. No payload is stored or logged, only the normalized fields.

## Live calling

The Call button on a lead works only when **all** of these hold. The server checks them (`dial-policy.ts`) and the database checks them again (`StartLeadCall`):

| Condition | Checked by |
| --- | --- |
| The agent's line is on a VERIFIED connection whose provider can dial | Server and database |
| The connection's secret is set on the server | Server |
| `APP_ORIGIN` is a public `https://` address (for status callbacks) | Server |
| An owner or administrator confirmed the current version of the live-calling statement (provider and UAE operating arrangements; see `LIVE_CALLING_ATTESTATION`) | Server and database |
| The agent has an ACTIVE line, registered to the company, assigned to them, with a forwarding number | Server and database |
| Capacity: under the company's simultaneous-call limit, no other call in progress for the agent, under their daily limit | Server |
| No calling-rule issue for the number and purpose (opt-outs, hours, marketing rules, frequency) | Server |
| The lead is the agent's to call and the number is on the lead's contact | Database |

Flow:
1. Every check passes.
2. The call record is created as INITIATED (with the activity and audit entries).
3. The provider starts the call.
4. The provider's call ID is saved once.

If the provider refuses, the call is marked FAILED and the agent is told nothing was dialled.

**Hang up:** the call's agent, or an owner or administrator, can end a provider call in progress where the provider supports it (Twilio). The provider's signed status event then records the end.

Refusals list every reason, for example:
- "No calling provider is connected and verified for your company."
- "An owner or administrator has not confirmed the provider and UAE operating arrangements."

**Live calls start from leads only**, so each call is recorded against a lead. Contacts show the reason.

## Setting up a provider (after approval)

1. Choose the provider and get the UAE review in [CALL_PRIVACY_COMPLIANCE.md](CALL_PRIVACY_COMPLIANCE.md#needs-legal-review) done.
2. Create the account and numbers with the provider. Confirm the numbers are registered to the company's licence.
3. Store the credential as a secret named `COMMS_…`, in Secret Manager for hosted environments.
4. Set `APP_ORIGIN` to the public `https://` address.
5. On `/communications/settings`, add the connection (secret **name** and account identifier), then **Check connection**.
6. In the provider console, set the status callback (Twilio) or webhook (Retell) to the address shown for the connection.
7. Add lines, confirm registration, assign members and their forwarding numbers, and activate.
8. An owner or administrator confirms the live-calling statement.
9. Test in the provider's sandbox with company numbers before agents use it.

## Testing

| Command | Covers |
| --- | --- |
| `npm run test:communications` | Twilio signatures made with the SDK's own helper:<br>• forged, missing, other-token, other-URL, tampered and duplicate-parameter requests;<br>• JSON `bodySHA256`.<br>Twilio leg mapping. Retell signatures from the SDK:<br>• tampering, other keys, a replay older than 5 minutes;<br>• the disconnection mapping.<br>PBX placeholders. Secret-name rules. Every live-call blocker. |
| `npm run test:dataconnect` | Admin-only connections and lines; secret-name rules; verification by the server only; reset on change; disabled stays disabled; line activation rules; attestation; the database's live-call gate; set-once provider call IDs; compare-and-set status; once-only events; incoming call creation; hub access |
| `npm run test:communications:e2e` | The settings page; a pasted credential refused; the credential never in the browser; checking without a server secret; line activation. Signed Twilio webhooks:<br>• the incoming call linked to the lead;<br>• retries and late events;<br>• forged, unsigned, wrong-key, wrong-account, unknown and PBX deliveries.<br>Live calling refused with reasons; agents' read-only rules; the dashboard, list and call page. |

The webhook tests sign requests locally with a per-run test secret given only to the isolated test server. Nothing contacts Twilio or Retell.
