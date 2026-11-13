# WhatsApp integration plan

Status: **Phase 7A built. Phase 7B.1 (test mode) built. Phase 7B.2 built: approved templates from Meta with blanks and a preview, media downloads with photo previews, and real customers once the company owner switches a channel over (on a server that allows it).** The first real-customer send needs the owner's go-ahead.
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

Receiving answers and receipts (verified with the test number on 2026-11-09, app unpublished):
- **The WhatsApp Business Account must be subscribed to your app.** Meta's dashboard can show incoming messages (through its own "WA DevX Webhook Events 1P App") while your app receives nothing. Check with `GET /{waba-id}/subscribed_apps`; subscribe once with `POST /{waba-id}/subscribed_apps` using a token of your app (for example in the Graph API Explorer). It sends no message and is undone with `DELETE`.
- **The Callback URL must reach EstateOS.** A `trycloudflare.com` quick tunnel gets a new address on every start and can drop silently, so after a restart update the Callback URL in **WhatsApp → Configuration** and verify it again. A fixed address (a named tunnel or a static ngrok domain) avoids this.
- Your answers then join the conversation, and open the 24-hour window for free-text replies.

Not in 7B.1 (all three are Phase 7B.2, below):
- **Media download.**
- **Template management.**
- **Sending to anyone other than the test recipients.**

## Phase 7B.2: templates, media and real customers (built)

### Templates from Meta

- **The account.** The channel names its **WhatsApp Business Account ID** (Inbox settings; digits, not a secret). **Check connection** confirms the phone number belongs to that account.
- **The list.** EstateOS reads the account's templates from Meta with the channel's token (`GET /{waba-id}/message_templates`), on the server only. It keeps them in memory for 5 minutes and rate-limits the requests. Only **APPROVED** templates EstateOS can send are offered.
- **What can be sent.** A text header, the body, a footer and static buttons (quick reply, phone, a plain link). Templates with an image, video or document header, a link button with a blank, or other kinds are listed as "not supported yet".
- **Choosing one.** In the reply box (**Template**, or automatically when the 24-hour window is closed) and in **Start WhatsApp conversation**:
  - the member picks from the list and fills each blank, positional `{{1}}` or named `{{first_name}}`;
  - quick fills are offered: the customer's name (never a bare number), your name and the company;
  - a WhatsApp-style preview shows exactly what the customer receives.
- **Meta's rules for blanks.** Every blank is filled, with no line breaks or tabs and at most four spaces in a row. The header stays within 60 characters and the body within 1024.
- **On the reply.** The reply holds the **rendered text** (what approvers see and the thread shows) and the filled blanks (`templateParamsJson`).
- **Before sending.** The template is read fresh from Meta. If it was paused or rejected, or changed so that it no longer renders the same text, nothing is sent and the member is asked to draft it again. Otherwise it is sent with Graph `components`.

### Media customers send

- **When.** Photos and documents are downloaded just after the webhook is answered (Meta gets its 200 at once), and on every worker tick for anything left.
- **How.**
  1. Each file is claimed (compare-and-set), so two runs never fetch it at once.
  2. Meta gives a short-lived URL (`GET /{media-id}`).
  3. The file is fetched with the token **only** from Meta's https media hosts (`*.fbsbx.com`, `*.whatsapp.net`, `*.facebook.com`, `*.fbcdn.net`), with no redirects and at most 25 MB.
  4. It is checked against Meta's sha256, then by its content.
  5. It is stored privately like any attachment.
- **Failures.**
  - **Final, and recorded:** media Meta no longer has, a file type not allowed (for example a program disguised as a PDF) or too large.
  - **Retried:** anything else, with growing waits, at most 5 times and for up to 25 days (Meta keeps media for about 30).
- **Photo previews.** A JPEG, PNG or WebP that passed the content check is shown in the chat bubble. It comes through the same authorized, audited attachment route, inline, with `nosniff`, `no-store` and a sandbox policy. Other files download only. A file not stored shows why ("downloading…", "not downloaded (file type not allowed)").

### Real customers (the owner's switch)

- **Two switches.** A channel sends to any customer only when both are on:
  - **the server allows it:** `INBOX_WHATSAPP_LIVE_SENDING=enabled`, which is off by default, so a test or development server can never message customers;
  - **the company OWNER switched the channel** to real customers in Inbox settings, after confirming that messages go to real customers and that Meta charges for template messages.
- **Who.** An administrator cannot turn it on; an OWNER or ADMIN can switch it back to test numbers at any time.
- **What turns it off.** Editing the channel, disabling it, a failed check or turning sending off all turn it off again (enforced in the database).
- **Who receives replies.** Every customer rule still applies: opt-outs and the do-not-contact list, free text only within 24 hours of the customer's last message, and approval when the company requires it. A person always clicks Send.
- **Safety limits per channel,** counted in the database:
  - 60 sends a minute;
  - template messages per day (`INBOX_WHATSAPP_DAILY_TEMPLATE_LIMIT`, default 100), as a cost guard.
- **Display.** The channel shows **Live: real customers**, and the reply box says replies go to the customer.

### Server settings (7B.2)

| Variable | Purpose |
| --- | --- |
| `INBOX_WHATSAPP_LIVE_SENDING` | `enabled` lets channels the owner switched over send to real customers. Anything else: test numbers only |
| `INBOX_WHATSAPP_DAILY_TEMPLATE_LIMIT` | Template messages per channel per day (default 100) |

### Going live with your number

1. **In Meta (WhatsApp Manager).**
   - The display name is approved.
   - A payment method is added to the WhatsApp Business Account.
   - At least one template is created and **approved**, for example a Utility template that follows up an enquiry.
2. **In EstateOS (Inbox settings).**
   1. Edit the WhatsApp channel and enter the **WhatsApp Business Account ID**.
   2. Click **Check connection**.
   3. Set `INBOX_WHATSAPP_LIVE_SENDING=enabled` in `.env.local` and restart.
   4. As the owner, click **Switch to real customers** and confirm.
3. **The first real send.** Start a conversation with your second number (the new SIM) as a "real customer", using the template. Send a photo from that phone: it shows as a preview in the inbox.

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
