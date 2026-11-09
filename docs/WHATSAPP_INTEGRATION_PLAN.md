# WhatsApp integration plan

Status: **Phase 7A built. Phase 7B.1 (test mode) built: connection check, approved sending and templates, to the server's test recipients only.** Going live with real customers (7B.2) needs a business number, approved templates, a payment method and approval.
EstateOS integrates with WhatsApp only through Meta's official WhatsApp Business Platform (Cloud API). It does not and will not use WhatsApp Web scraping, unofficial automation libraries or personal WhatsApp sessions.

Related: [CHANNEL_ADAPTERS.md](CHANNEL_ADAPTERS.md), [INBOX_SECURITY.md](INBOX_SECURITY.md), [UNIFIED_INBOX.md](UNIFIED_INBOX.md).

## What Phase 7A delivers

| Area | State | Where |
| --- | --- | --- |
| Webhook signature verification (`X-Hub-Signature-256`: HMAC-SHA256 of the exact body with the app secret, constant-time comparison) | Built, unit and end-to-end tested with per-run test secrets | `src/modules/inbox/adapters/whatsapp.ts` |
| Subscription handshake (`hub.mode=subscribe`, `hub.verify_token`, `hub.challenge`) | Built and tested | same |
| Normalization of incoming messages (text, image, document, audio, video, sticker, template, button, interactive; unknown types kept as UNKNOWN) and status receipts (sent, delivered, read, failed; others kept raw) | Built and tested | same |
| Account check (`metadata.phone_number_id` must be the connection's account) | Built and tested | `server/webhooks.ts` |
| Durable, deduplicated events with worker retries | Built and tested | `server/webhooks.ts` |
| Identity matching by exact number, conversation threading per customer number | Built and tested | `server/ingest.ts` |
| Opt-out keyword detection (STOP and Arabic equivalents) | Built: flags the conversation and, for real customers, adds the number to the do-not-contact list in the same transaction (7A.6) | `policy.ts`, `inbox-ingest.gql` |
| 24-hour customer service window rule | Built and enforced: a free-form reply outside the window fails the reply checks (7A.5) | `policy.ts` (`serviceWindow`), `outbound.ts` |
| Reply drafts, checks and approval (author cannot self-approve unless OWNER) | Built (7A.5); approved WhatsApp replies are **not sent** ("Sending is disabled until this provider is connected") | [UNIFIED_INBOX.md](UNIFIED_INBOX.md#outbound) |
| Connection records (phone number ID, secret name) on the settings page | Built; never VERIFIED, sending always off | `/inbox/settings` |
| Sending messages, template sending, media download, connection check | **Not built** (Phase 7B) | — |

No Meta account, app, phone number or token was created, purchased or used in Phase 7A.

## Phase 7B.1: test mode (built)

What it adds:
- **Check connection.** An OWNER or ADMIN presses **Check connection** in Inbox settings, and EstateOS asks Meta for the phone number with the access token: `GET /{version}/{phone-number-id}?fields=id,display_phone_number,verified_name,quality_rating`.
  - Only when Meta returns the same phone number ID does the channel become **VERIFIED**, with Meta's name and number shown.
  - A failure marks it **ERROR** and turns sending off.
  - This is a read-only request that sends nothing.
- **Sending switch.** An OWNER or ADMIN can turn sending on, only for a VERIFIED channel, and only on a server with test recipients configured. Editing the channel undoes both verification and sending.
- **Sending.** Approved replies are sent with `POST /{version}/{phone-number-id}/messages`, either as free text inside the 24-hour window or as an approved **template** (`name:language`, for example `hello_world:en_US`).
  - The database queues a real reply only on a VERIFIED connection with sending on.
  - The server adds the rule that the recipient must be one of the **test recipients**.
  - **SENT** comes only from Meta's response with a message ID (`wamid…`), which delivery receipts then match.
  - A refusal makes the reply FAILED, with Meta's code and the `inbox.message.failed` workflow event.
  - On a timeout or network error, EstateOS marks the reply FAILED and says it may or may not have been delivered. Nothing is retried automatically, so a message is never sent twice.
- **Business-started conversations.** **Start WhatsApp conversation** on `/inbox` (owners and administrators) creates the conversation with a test recipient, plus a template reply draft. The draft is checked and approved like any reply. When the customer answers, the answer joins the same conversation and opens the 24-hour window.

Server settings, all in the server environment and never in EstateOS fields:

| Variable | Purpose |
| --- | --- |
| `INBOX_WHATSAPP_ACCESS_TOKEN` (any `INBOX_…` name, entered on the channel as **Access token secret name**) | The Meta access token. Temporary tokens expire after about 24 hours; a system-user token is the long-term option |
| `INBOX_WHATSAPP_TEST_RECIPIENTS` | Comma-separated E.164 numbers (up to 10) EstateOS may send to. **Empty means no live sending at all** |
| `INBOX_WHATSAPP_GRAPH_VERSION` | Optional; default `v27.0` |
| `INBOX_WHATSAPP_GRAPH_BASE` | Tests only: a local fake Graph API (`http://127.0.0.1:PORT`, refused in production) |

Trying it with the Meta test number:
1. Put the token in `.env.local` as `INBOX_WHATSAPP_ACCESS_TOKEN=…` and your own number as `INBOX_WHATSAPP_TEST_RECIPIENTS=+9715…`, then restart `npm run dev:local`.
2. In Meta's **API Setup**, add that number as a recipient.
3. In **Inbox settings → your WhatsApp channel → Edit**, set **Access token secret name** to `INBOX_WHATSAPP_ACCESS_TOKEN`.
4. Click **Check connection**, then **Turn sending on**.
5. In `/inbox`, click **Start WhatsApp conversation**, enter your number and the template `hello_world` / `en_US`.
6. Check the draft and request approval. Another owner, administrator or manager approves it.
7. Click **Send on WhatsApp**.

Meta may charge for template messages (its receipts show `billable`), so check your WhatsApp billing first.

Not in 7B.1:
- **Receipts and customer answers** arrive only when Meta delivers webhooks to EstateOS, which for real traffic needs the app published.
- **Media download.**
- **Template management.**
- **Sending to anyone other than the test recipients.**

## Phase 7B: what is needed to go live

Business prerequisites (the company, not EstateOS engineering):

1. A Meta Business portfolio, verified by Meta.
2. A WhatsApp Business Account and a phone number registered to it. The number cannot be in use on the WhatsApp or WhatsApp Business app at the same time.
3. Display name approval.
4. Message templates for any conversation EstateOS starts or continues after the 24-hour window, submitted to and approved by Meta.
5. A decision on costs: Meta charges per its current pricing for business-initiated and template messages. Confirm the current rate card before enabling sending. **Enabling sending needs explicit approval.**

Engineering work:

1. **Credentials.** A system-user access token with only the WhatsApp permissions needed, stored in Secret Manager. The app secret (for signatures), the webhook verify token and the access token are separate secrets. Connections hold only their names: `credentialReference`, `<name>_VERIFY_TOKEN` and `accessTokenReference` (added in 7B.1).
2. **Connection check.** Built in 7B.1: a server-side read of the phone number with the token, started by an OWNER or ADMIN and recorded through a server-only operation. Only then is a connection VERIFIED.
3. **Sending.** Built in 7B.1 (`server/whatsapp-cloud.ts`). Going live means replacing the test-recipient rule with production sending, after approval. `POST /{phone-number-id}/messages`: free-form text only inside the 24-hour window after the customer's last message; otherwise an approved template. Store the returned message ID (`wamid…`) on the message; mark it SENT only from that acknowledgement. Delivery and read receipts already work through the webhook.
4. **Media.** Incoming media arrives as a media ID. Download with the token (media URL lookup, then an authenticated download), check by content and size, store privately, and set `storagePath`. Attachments are already modelled for this.
5. **Opt-out.** Already built: STOP messages add the number to the do-not-contact list, and the reply checks refuse suppressed numbers. The live sender must call the same checks.
6. **Tests.** Meta's test phone number and test webhooks in a non-production app; never real customers.

## Setting up the webhook (when Phase 7B is approved)

1. In **Inbox settings**, add a WhatsApp channel with the phone number ID and a secret name, for example `INBOX_WHATSAPP_APP_SECRET`.
2. Store the app secret under that name, and a random verify token under `INBOX_WHATSAPP_APP_SECRET_VERIFY_TOKEN`, in the server environment or Secret Manager. Never paste either into EstateOS.
3. Give Meta the webhook address shown on the settings page and the verify token. Subscribe the app to the `messages` field.
4. Confirm a test message appears in the inbox and the event shows as processed.

## Testing without Meta

- Unit: `tests/inbox-adapters.test.ts` signs payloads with a test secret.
- End to end: `npm run test:inbox:e2e` starts an isolated server with a per-run test secret and posts signed, unsigned, tampered, wrong-account and duplicate payloads to the real route.
- Developer simulator (`/dev/communication-tests`, local emulators only): fictional senders (+44 7700 900xxx) through the same event pipeline.
