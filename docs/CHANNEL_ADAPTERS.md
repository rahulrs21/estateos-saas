# Channel adapters

Phase 7A (unified inbox foundation). This document covers how EstateOS talks to messaging providers: the adapter interface, what each adapter can do today, connections, webhooks, durable events and delivery receipts.

Related documents: [UNIFIED_INBOX.md](UNIFIED_INBOX.md), [INBOX_SECURITY.md](INBOX_SECURITY.md), [WHATSAPP_INTEGRATION_PLAN.md](WHATSAPP_INTEGRATION_PLAN.md), [EMAIL_INTEGRATION_PLAN.md](EMAIL_INTEGRATION_PLAN.md).

## Summary

- Every provider implements one interface, `ChannelAdapter` (`src/modules/inbox/adapters/types.ts`), and declares a capability for each operation.
- An adapter existing never means a provider is connected. In Phase 7A no connection reaches `VERIFIED` and no real provider sends anything.
- Inbound messages from every source go through one pipeline: verify, record the event once, normalize, match the identity, store the conversation and message with their workflow events in one transaction.

## The interface

| Member | Purpose |
| --- | --- |
| `provider`, `channel`, `label` | Which provider, which inbox channel (WHATSAPP, EMAIL, WEBSITE, INTERNAL), display name |
| `capabilities` | One state per capability (below) |
| `signatureHeader` | The request header carrying the provider signature, if any |
| `verifyWebhook(request, secret)` | Checks the signature over the exact raw body. Nothing in the body is trusted before this |
| `handshake(url, verifyToken)` | The subscription check some providers make with a GET request; returns the text to echo, or null |
| `parseWebhook(request)` | Verified payload to normalized events. Bounded (at most 100 events per request). Unknown message types are kept as `UNKNOWN`, never dropped silently. Throws `WebhookPayloadError` for malformed input |

Normalized events (`NormalizedEvent`):

- `MESSAGE`: account ID, channel, provider message ID, thread ID, sender (phone or email, display name), recipient, subject, message type, text, provider timestamp, attachment references.
- `STATUS`: account ID, provider message ID, mapped delivery status, the raw provider status, timestamp, error code.

## Capability matrix

States: **SUPPORTED** (built and tested), **PLANNED** (designed for a later phase; refused now), **UNSUPPORTED** (the provider or channel has no such operation).

| Capability | WhatsApp Cloud | Gmail | Microsoft 365 | Website form | Developer simulator |
| --- | --- | --- | --- | --- | --- |
| Validate connection | SUPPORTED (7B.1) | SUPPORTED (7C.1, Google sign-in) | SUPPORTED (7C.2, Microsoft sign-in) | UNSUPPORTED | UNSUPPORTED |
| Receive events | SUPPORTED | SUPPORTED (polled every minute) | PLANNED | SUPPORTED | SUPPORTED |
| Normalize message | SUPPORTED | SUPPORTED | PLANNED | SUPPORTED | SUPPORTED |
| Sync history | UNSUPPORTED | PLANNED | PLANNED | UNSUPPORTED | UNSUPPORTED |
| Send message | SUPPORTED (7B.1; real customers from 7B.2 when the owner switches the channel) | SUPPORTED (7C.1, test addresses only) | SUPPORTED (7C.2, test addresses only) | UNSUPPORTED | SUPPORTED (simulated conversations only) |
| Delivery receipts | SUPPORTED | UNSUPPORTED (email has none) | PLANNED | UNSUPPORTED | SUPPORTED |
| Resolve provider message ID | SUPPORTED | SUPPORTED | PLANNED | UNSUPPORTED | UNSUPPORTED |
| Health check | PLANNED | PLANNED | PLANNED | UNSUPPORTED | UNSUPPORTED |
| Disconnect | PLANNED | SUPPORTED (revokes the grant) | PLANNED | UNSUPPORTED | UNSUPPORTED |

`canSend(provider)` in `adapters/index.ts` is true only for `DEVELOPMENT_SIMULATOR`. The settings page shows the matrix for each connection.

Gmail (Phase 7C.1) and Microsoft 365 (Phase 7C.2) connect with the provider's own sign-in and are polled by the worker (`server/mail-sync.ts`). They have no webhook, so `/api/inbox/webhooks/gmail/…` and `/api/inbox/webhooks/microsoft-365/…` answer 404. See [EMAIL_INTEGRATION_PLAN.md](EMAIL_INTEGRATION_PLAN.md#phase-7c2-microsoft-365--outlook-built).

## Connections

A `ChannelConnection` row is a company's account with a provider. Managed at **Inbox → Inbox settings** (`/inbox/settings`) by OWNERs and ADMINs; the database checks the role again in every operation.

| Field | Meaning |
| --- | --- |
| `provider` | WHATSAPP_CLOUD here; GMAIL and MICROSOFT_365 mailboxes are created only by signing in (Phases 7C.1 and 7C.2); the simulator connection only by developer tools |
| `externalAccountReference` | The provider account, for example the WhatsApp phone number ID. Unique across EstateOS: one account belongs to one company |
| `credentialReference` | The **name** of a server secret, matching `^INBOX_[A-Z0-9_]{3,56}$`. Never the value |
| `connectionStatus` | NOT_CONFIGURED, CONFIGURED, VERIFIED, DISABLED, ERROR. Phase 7A stops at CONFIGURED |
| `sendingEnabled` | Always false for real providers; every update writes false again |
| `lastEventAt` | When the last verified webhook event arrived. Not proof that the connection works |

Rules:

- A connection is CONFIGURED when it has both an account and a secret name, otherwise NOT_CONFIGURED. Editing a disabled connection keeps it disabled.
- No operation available to members can set VERIFIED or enable sending. For WhatsApp (7B.1), only the server-only live check with Meta sets VERIFIED, and only a server-only operation, for an OWNER or ADMIN on a VERIFIED channel, turns sending on. Editing or disabling the channel undoes both. Email needs the live checks of Phase 7C.
- The settings page shows whether the named secret is set on the server, never its value. For WhatsApp it also shows the verify-token secret name (`<credentialReference>_VERIFY_TOKEN`) and the webhook address to give Meta.
- Account format is checked against the stored provider (WhatsApp: digits; email providers: a mailbox address), never a provider named in the request.

### Connecting WhatsApp without server secret names (Nov 2026)

Company owners don't handle server secrets. For a WhatsApp channel, the form asks only for these, each with where-to-find-it help:

| Field | Notes |
| --- | --- |
| **Name** | |
| **Phone number ID** | |
| **Access token** | A password field |
| **WhatsApp Business Account ID** | Optional; needed only for templates |

**Meta app secret.** It belongs to EstateOS: one Meta app for every company.
- Left empty, the channel uses the platform's `INBOX_WHATSAPP_APP_SECRET` and its `_VERIFY_TOKEN` (`PLATFORM_APP_SECRET` in `src/modules/inbox/server/channel-credentials.ts`).
- The database rules are unchanged, because the server fills in that name.
- Staff can name another secret under **Advanced**.

**Access token.** It belongs to the company.
- **Save.** The owner or administrator pastes it once. The server checks its format, and that it has an encryption key, before anything is saved.
- **Encryption.** It's sealed with the token vault (`src/modules/inbox/vault.ts`; AES-256-GCM, bound to the company and the connection) and stored in `ChannelCredential` by `SaveChannelAccessToken`. That mutation is OWNER or ADMIN only and checked by the database. Saving resets the channel to CONFIGURED, so it must be checked with Meta again.
- **Reading it back.** No member query returns it: `ChannelAccessToken` is NO_ACCESS. The settings page shows only "Access token saved".
- **Lookup order.** `channelAccessToken()` uses the saved token first, otherwise the server secret named by `accessTokenReference` (Advanced, for staff-managed channels). Check connection, sending, templates and media download all use it.
- **If unreadable.** When the key changes and the token can no longer be decrypted, the channel asks for the token again. Nothing about the token is logged.

### Embedded Signup: one-click "Connect WhatsApp"

**Inbox settings → Connect WhatsApp** (OWNER or ADMIN). The owner names the channel, chooses a 6-digit PIN, and clicks **Continue with Facebook**.

**In the browser** (`src/modules/inbox/components/connect-whatsapp.tsx`):
- Meta's SDK loads when the dialog opens, so the click opens Meta's popup directly.
- The popup reports the chosen number with window messages. They are accepted **only from https `facebook.com` or its subdomains** (`src/modules/inbox/embedded-signup.ts`; Meta's own sample would also accept `evilfacebook.com`).
- A **WhatsApp Business app** number (coexistence) is refused, because it switches off features on the phone.

**On the server** (`src/modules/inbox/server/embedded-signup.ts`):
1. **Swap the code.** The one-time code is valid for about 30 seconds. The server swaps it for the company's business token with EstateOS's app secret. The token never reaches the browser.
2. **Confirm the number** belongs to the account.
3. **Create the channel** with the token **encrypted**, through the same path as a pasted token.
4. **Route the webhooks.** `POST /{waba}/subscribed_apps` is called with `override_callback_uri` set to **this channel's own webhook address**, so each company's messages reach its own channel.
5. **Register the number** with the owner's PIN.
6. **Check the connection.**

Every step is logged by name and result code only. Sending stays off until an administrator turns it on.

**Server settings:**

| Setting | Kind |
| --- | --- |
| `INBOX_META_APP_ID` | Public |
| `INBOX_META_EMBEDDED_SIGNUP_CONFIG_ID` | Public |
| `INBOX_WHATSAPP_APP_SECRET` and `INBOX_WHATSAPP_APP_SECRET_VERIFY_TOKEN` | Secrets |
| `INBOX_TOKEN_ENCRYPTION_KEY` | Secret |

Without them, the button is disabled. Staff see which names are missing, never values.

**Meta setup (owner):**
1. **Configuration.** Facebook Login for Business → Configurations → create one from the **WhatsApp Embedded Signup** template. Its ID is `INBOX_META_EMBEDDED_SIGNUP_CONFIG_ID`.
2. **Domains and OAuth settings.** Add the site to **Allowed domains** and **Valid OAuth redirect URIs**, and turn on:
   - client OAuth;
   - web OAuth;
   - enforce HTTPS;
   - embedded browser OAuth;
   - strict mode;
   - login with the JavaScript SDK.
3. **Webhooks.** Subscribe the app to the `account_update` webhook.

**Who can use it.** Until App Review approves `whatsapp_business_management` and `whatsapp_business_messaging`, only the app's own admins and developers can complete the flow. **Version 4** is used (`extras: {setup: {}}`), because v5 turns on Business-app onboarding by default.

## Webhooks

Route: `GET|POST /api/inbox/webhooks/{provider}/{connectionId}`, where `{provider}` is `whatsapp`, `gmail` or `microsoft-365`. No session: the provider's signature authenticates the request. Implementation: `src/modules/inbox/server/webhooks.ts`.

POST, in order:

1. Find the connection by the ID in the URL. The company comes from this row only. Unknown, mismatched provider, NOT_CONFIGURED or DISABLED connections, and adapters that cannot receive events, give **404**.
2. Rate limits per connection and per IP: **429**.
3. Read the raw body with a 256 KB cap: **413**.
4. Read the named secret on the server. Missing: **503** (logged as `inbox.webhook.secret_missing`).
5. Verify the signature over the exact raw body: **401**.
6. Parse and normalize. Malformed: **400**.
7. Every event's account must equal the connection's account: **403**.
8. Record and apply each event (below). A database failure while recording gives **500**, so the provider delivers again.
9. **200** with an empty body.

GET is the subscription handshake (WhatsApp: `hub.mode`, `hub.verify_token`, `hub.challenge`). The challenge is echoed only for the right token and only if it is plain text (**403** otherwise).

Responses never explain a refusal beyond the status code. Logs carry the connection ID and reason, never payload content.

## Durable events

Each verified event is written to `InboxEvent` before it is applied:

- `dedupKey` is unique per company: `message:` or `status:` plus a SHA-256 of the connection ID and the provider message ID (and, for receipts, the raw status). A provider retry or a replayed request is refused by this key and not applied again.
- `payloadDigest` is a SHA-256 of the raw body. The raw body itself is never stored.
- `normalizedJson` keeps the normalized event (bounded to 12,000 characters) only until it is applied, so the worker can retry it. It is cleared when the event is PROCESSED, DUPLICATE or DEAD.

Statuses: RECEIVED → PROCESSED | DUPLICATE | FAILED → (retry) … → DEAD.

- A failed application is retried by the worker tick (`POST /api/internal/automations/tick`, `retryInboxEvents`) after 1, 5, 15 and 60 minutes. The fifth failed attempt leaves the event DEAD with its error code. A failure update is compare-and-set on the attempt count, so two workers cannot both count the same attempt.
- An event still RECEIVED two minutes after it arrived (the request was interrupted) is picked up by the same worker.
- Applying twice is safe: message IDs are stable (`stableUuid` of company, connection and provider message ID) and messages are unique per connection and provider message ID.
- The developer simulator uses the same path (`receiveEvent`) on its own connection, so its duplicates behave exactly like provider retries.

## Ingestion

`ingestInbound` (`server/ingest.ts`) is shared by webhooks, the simulator and (inside its own transaction) the website form:

1. Identity: the sender's normalized phone (WhatsApp) or email address.
2. An existing conversation on the same connection and thread: append the message, reopen the conversation, count it unread.
3. Otherwise match the identity: exactly one contact with that exact phone or email links the conversation to the contact and its most recent open lead, and assigns it like the lead. Zero or several matches leave it unlinked ("Needs matching"). Names are never used.
4. The conversation, message and 6E workflow events (`inbox.conversation.created`, `inbox.message.received`) are written in one transaction.

## Delivery receipts

`STATUS` events update outbound messages forward only (`deliveryTransition` in `policy.ts`):

- QUEUED → SENT → DELIVERED → READ; a skipped step is fine; late or repeated receipts change nothing.
- FAILED only from QUEUED or SENT, and it is final.
- Receipts never change inbound messages or drafts.
- An unrecognised provider status keeps the current status and stores the raw text (`providerStatusRaw`, 40 characters) for diagnosis.
- A receipt for a message EstateOS did not send (for example from the provider's own app) is recorded as PROCESSED with result `UNMATCHED` and changes nothing.
- The update is compare-and-set on the current status, retried once if another receipt won. A failure writes the `inbox.message.failed` workflow event in the same transaction.

A message is never SENT because it was queued: SENT, DELIVERED and READ come only from provider acknowledgements and receipts.

## Sending

Adapters that can send implement `send(request)`, which returns the provider's acknowledgement: `{accepted: true, providerMessageId}` or `{accepted: false, reason}`.

- **The developer simulator** implements it. It refuses any conversation that is not simulated and answers with a `simwamid.…` ID; nothing leaves EstateOS.
- **WhatsApp Cloud (Phase 7B.1)** sends through the server-only `server/whatsapp-cloud.ts`, never through the shared adapter. It needs a VERIFIED connection (a live check with Meta), sending turned on by an administrator, and a recipient on the server's test list (`INBOX_WHATSAPP_TEST_RECIPIENTS`), unless the company owner switched the channel to real customers on a server that allows it (Phase 7B.2). See [WHATSAPP_INTEGRATION_PLAN.md](WHATSAPP_INTEGRATION_PLAN.md#phase-7b2-templates-media-and-real-customers-built).
- **The database adds its own guard.** `QueueInboxReply` (`inbox-delivery.gql`) queues only approved replies on conversations that are not opted out, and only on either a `DEVELOPMENT_SIMULATOR` connection (simulated conversations) or a VERIFIED `WHATSAPP_CLOUD` connection with sending on (real conversations).
- **Outcome.**
  - Acknowledged: the reply becomes SENT under the provider's ID, which receipts match on.
  - Refused: it becomes FAILED, with the `inbox.message.failed` event.
- The approval pipeline in front of sending is described in [UNIFIED_INBOX.md](UNIFIED_INBOX.md#outbound).
- **Gmail (Phase 7C.1) and Microsoft 365 (Phase 7C.2)** send through the server-only `server/google.ts` and `server/microsoft.ts`, never the shared adapter. They need a connected mailbox with sending on, a recipient on the server's test list (`INBOX_EMAIL_TEST_RECIPIENTS`) and, for a personal mailbox, the owner as sender. Real customers (email beyond test addresses, and WhatsApp 7B.2) need approval.

## Attachments

Provider attachments arrive as references (`providerMediaId`) with `storagePath` empty: downloading provider media needs a live connector (Phase 7B). They are listed as "not downloaded" and cannot be opened. Files EstateOS stores itself (the simulator today) follow the rules in [INBOX_SECURITY.md](INBOX_SECURITY.md#attachments).

## Adding a provider

1. Implement `ChannelAdapter` in `src/modules/inbox/adapters/<provider>.ts`, with honest capability states.
2. Register it in `ADAPTERS` and, if it receives webhooks, in `WEBHOOK_SLUGS`.
3. Add unit tests for signatures (valid, wrong secret, tampered, missing), handshake and payload normalization, including unknown types and bounds.
4. Keep `canSend` false until live sending has been built, tested against the provider's test environment and approved.

## Tests

- Unit: `tests/inbox-adapters.test.ts` (signatures, handshake, normalization, refusals, capability matrix, receipts, retries, attachment checks).
- Emulator: `tests/sql-connect-inbox.cases.mjs` (connections, event deduplication and retry compare-and-set, receipts, attachment access).
- End to end: `tests/inbox-e2e.browser.mjs` (`npm run test:inbox:e2e`): the settings page, signed webhooks with a per-run test secret, refusals, duplicates, the worker retry, disabled channels and protected downloads.
