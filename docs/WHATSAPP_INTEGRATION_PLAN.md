# WhatsApp integration plan

Status: **Phase 7A (foundation) built; live connection is Phase 7B and needs approval.**
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
| Opt-out keyword detection (STOP and Arabic equivalents) flags the conversation | Built; adding the number to the do-not-contact list is Phase 7A.6 | `policy.ts` |
| 24-hour customer service window rule | Built and enforced: a free-form reply outside the window fails the reply checks (7A.5) | `policy.ts` (`serviceWindow`), `outbound.ts` |
| Reply drafts, checks and approval (author cannot self-approve unless OWNER) | Built (7A.5); approved WhatsApp replies are **not sent** ("Sending is disabled until this provider is connected") | [UNIFIED_INBOX.md](UNIFIED_INBOX.md#outbound) |
| Connection records (phone number ID, secret name) on the settings page | Built; never VERIFIED, sending always off | `/inbox/settings` |
| Sending messages, template sending, media download, connection check | **Not built** (Phase 7B) | — |

No Meta account, app, phone number or token was created, purchased or used in Phase 7A.

## Phase 7B: what is needed to go live

Business prerequisites (the company, not EstateOS engineering):

1. A Meta Business portfolio, verified by Meta.
2. A WhatsApp Business Account and a phone number registered to it. The number cannot be in use on the WhatsApp or WhatsApp Business app at the same time.
3. Display name approval.
4. Message templates for any conversation EstateOS starts or continues after the 24-hour window, submitted to and approved by Meta.
5. A decision on costs: Meta charges per its current pricing for business-initiated and template messages. Confirm the current rate card before enabling sending. **Enabling sending needs explicit approval.**

Engineering work:

1. **Credentials.** A system user access token with only the WhatsApp permissions needed, stored in Secret Manager. The app secret (for signatures) and the webhook verify token are separate secrets. Connections hold only their names (`INBOX_…`, verify token at `<name>_VERIFY_TOKEN`). The token needs a separate reference; add a field rather than overloading `credentialReference`.
2. **Connection check.** A server-side call reading the phone number's details with the token, started by an OWNER or ADMIN, recorded through a server-only operation (as Phase 6F does for calling providers). Only then can a connection become VERIFIED.
3. **Sending.** Implement `send` on the WhatsApp adapter and allow it in `canSend` and in `QueueInboxReply` only after approval. `POST /{phone-number-id}/messages`: free-form text only inside the 24-hour window after the customer's last message; otherwise an approved template. Store the returned message ID (`wamid…`) on the message; mark it SENT only from that acknowledgement. Delivery and read receipts already work through the webhook.
4. **Media.** Incoming media arrives as a media ID. Download with the token (media URL lookup, then an authenticated download), check by content and size, store privately, and set `storagePath`. Attachments are already modelled for this.
5. **Opt-out.** STOP messages add the number to the do-not-contact list (Phase 7A.6 builds the list integration); sending refuses suppressed numbers.
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
