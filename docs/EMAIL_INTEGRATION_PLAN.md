# Email integration plan

Status: **Phase 7C.1 (Gmail) built in test mode: company and personal mailboxes connect with Google sign-in, mail is imported every minute, and approved replies are sent only to the server's test addresses.** Microsoft 365 is Phase 7C.2.
EstateOS never asks for, accepts or stores mailbox passwords. Mailboxes are connected with OAuth through the provider's consent screen.

Related: [CHANNEL_ADAPTERS.md](CHANNEL_ADAPTERS.md), [INBOX_SECURITY.md](INBOX_SECURITY.md), [UNIFIED_INBOX.md](UNIFIED_INBOX.md).

## What Phase 7A delivers

- Adapters registered for `GMAIL` and `MICROSOFT_365` with every capability **PLANNED**. They verify nothing and accept no events: their webhook routes answer 404.
- Connection records on **Inbox settings** (mailbox address, secret name). They never reach VERIFIED and cannot send. The settings form says plainly not to enter a mailbox password; the secret-name field accepts only `INBOX_…` names, so a pasted password is refused.
- The inbox model already holds email: subject, sender and recipient addresses, plain-text content (messages are always rendered as text, never as HTML; converting incoming email HTML to text is part of the 7C connector), attachments, threads, and email opt-outs (`InboxEmailOptOut`).
- Email conversations can be simulated end to end (`/dev/communication-tests`, fictional `@example.test` senders).

## Phase 7C.1: Gmail (built)

### Connecting

- **Who.** An OWNER or ADMIN connects **company mailboxes** (for example sales@). Any member connects their own **personal mailbox**, one each. Both are in **Inbox settings → Email mailboxes**.
- **How.** **Connect** opens Google's own consent screen. EstateOS never asks for, sees or stores a password.
  - The request uses PKCE (S256), an offline grant, and only `gmail.readonly` and `gmail.send`.
  - The address Google proves (`users.getProfile`) is the one connected; nothing typed is trusted.
  - Each mailbox can be connected once across EstateOS (one company only).
- **The return.** The session cookie is SameSite=strict, so the browser does not send it back from Google.
  - The callback trusts only a sealed, single-use, 10-minute state cookie, whose state must equal the one Google returns.
  - The server checks the membership again before saving.
  - The callback page then navigates to Inbox settings from EstateOS itself.
- **Storage.** The refresh token is sealed with AES-256-GCM and bound to its company and connection (`vault.ts`, key `INBOX_TOKEN_ENCRYPTION_KEY`).
  - It is kept in `InboxMailboxAccount`, which only server-only operations can read.
  - Access tokens live in server memory only.
  - Missing permissions, a refused save or another company's mailbox revoke the new grant at Google straight away.
- **Disconnect.** The owner of a personal mailbox, or an OWNER or ADMIN, disconnects. The grant is revoked at Google and wiped, and imported conversations stay.
- **Leaving.** A personal mailbox whose owner is no longer an active member is retired by the worker: no more imports, and the grant is revoked and wiped.

### Sync

- **When.** The worker tick checks each mailbox about once a minute, under a lease. There is no Pub/Sub and no public webhook (the Gmail webhook route answers 404). **Check now** in settings checks at once.
- **What is read.**
  - Gmail history for messages added to INBOX, from the stored cursor.
  - On the first sync, the last 3 days (bounded).
  - When the cursor has expired, the last day (bounded), then a fresh cursor.
- **Two-step judgement.** Each message is first judged by its headers alone. These are skipped before any content is fetched, and leave no record at all:
  - spam, trash and drafts, and the Promotions, Social, Updates and Forums categories;
  - mailing lists (`List-Unsubscribe`, `List-Id`), bulk precedence, auto-submitted mail, bounces and no-reply senders;
  - EstateOS's own sends.
- **Personal mailboxes import only CRM customers.** That means a thread already in EstateOS, or a sender who matches exactly one contact.
  - Such conversations are assigned to the mailbox owner; the lead keeps its own agent.
  - Private mail never enters EstateOS, not even as an event record.
- **Accepted messages** go through the same durable, deduplicated event pipeline as webhooks:
  - plain text (text/plain preferred; HTML converted on the server; quoted history and signatures cut; at most 8000 characters);
  - the RFC Message-ID kept for replies;
  - attachments checked by content and stored privately. A file whose content is not allowed is listed but never stored or served.
- **Failures.** A grant withdrawn at Google marks the mailbox **Reconnect needed** and turns sending off. Other failures are retried with growing delays. The cursor advances only after every message is recorded.

### Sending (test mode)

- **Requirements.** A reply is emailed only when all of these hold:
  - it is approved;
  - the mailbox is connected with sending on;
  - the customer's address is one of the server's test addresses (`INBOX_EMAIL_TEST_RECIPIENTS`).
- **Who turns sending on.** An OWNER or ADMIN for a company mailbox; only the owner for a personal mailbox. Anyone may turn sending off.
- **Personal mailboxes send only for their owner.** Others can draft and approve; the owner sends. The database enforces this too (`QueueInboxReply`).
- **The message.** Plain text in UTF-8, in the customer's Gmail thread, with:
  - "Re:" and the subject;
  - `In-Reply-To` and `References`;
  - an `X-EstateOS-Message` header, so the next sync never imports it back.

  Header values are stripped of line breaks.
- **Results.** SENT comes only from Gmail's returned message ID. A refusal fails the reply with Google's reason. A timeout says it may or may not have been sent. Nothing is retried automatically.

### Server settings

| Variable | Purpose |
| --- | --- |
| `INBOX_GOOGLE_CLIENT_ID`, `INBOX_GOOGLE_CLIENT_SECRET` | The Google OAuth client (Web application) |
| `INBOX_TOKEN_ENCRYPTION_KEY` | 32 random bytes in base64, for sealing grants and the sign-in state. Without it nothing can be connected. Changing it makes every mailbox reconnect |
| `INBOX_EMAIL_TEST_RECIPIENTS` | Comma-separated addresses EstateOS may email (up to 20). **Empty means no email is sent** |
| `INBOX_GOOGLE_OAUTH_BASE`, `INBOX_GOOGLE_API_BASE` | Tests only: a local fake Google (refused in production) |

### Trying it with your own Gmail

1. **Google Cloud project.** In Google Cloud Console, use your project (or create one), and enable the **Gmail API**.
2. **Consent screen.** Under **Google Auth Platform → Branding/Audience**, choose External, keep it in **Testing**, and add your Gmail address as a **test user**.
3. **OAuth client.** Under **Clients**, create an OAuth client of type **Web application** with the authorized redirect URI `http://localhost:3000/api/inbox/oauth/google/callback`.
4. **Server settings.** In `.env.local`, add `INBOX_GOOGLE_CLIENT_ID`, `INBOX_GOOGLE_CLIENT_SECRET`, `INBOX_TOKEN_ENCRYPTION_KEY` (for example from `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`) and `INBOX_EMAIL_TEST_RECIPIENTS` (an address you own). Restart `npm run dev:local`, with `AUTOMATION_WORKER_SECRET` set so the worker runs.
5. **Connect.** In **Inbox settings → Email mailboxes**, click **Connect my Gmail** (or **Connect company Gmail**) and sign in. Google warns that the app is unverified, because it is in Testing.
6. **Import.** Send the mailbox an email from another address (for a personal mailbox, an address that is a contact in EstateOS). It appears in `/inbox` within a minute, or at once with **Check now**.
7. **Reply.** Turn sending on, then draft, check, approve and **Send by email** to a test address.

In Testing mode Google expires refresh tokens after 7 days, so you will be asked to reconnect. Going live needs Google's verification of these restricted scopes (including a security assessment), a published consent screen, and approval.

Not in 7C.1:
- bounce detection;
- read receipts (email has none, so SENT is final);
- importing mail sent directly from Gmail;
- composing a new email from a lead;
- Microsoft 365 (7C.2).

## Phase 7C design

### Gmail (Google Workspace): as first designed (7C.1 above is what was built)

- OAuth 2.0 with the narrowest scopes that support reading and sending (for example `gmail.readonly` plus `gmail.send`, or `gmail.modify` only if labels are needed). Workspace administrators may need to approve the app.
- Refresh tokens are encrypted and stored in Secret Manager (or an envelope-encrypted store); the connection keeps only a reference.
- Change notifications: `users.watch` to a Cloud Pub/Sub topic; the push subscription calls EstateOS with an OIDC token whose audience and service account are verified. Watches expire and are renewed by the worker.
- Sync: `users.history.list` from the stored `historyId`; on a gap, a bounded resync. Each Gmail message ID is a provider message ID (deduplicated like WhatsApp).
- Sending: `users.messages.send` with RFC 2822 content, threaded with `In-Reply-To` and `References`.

### Microsoft 365 (Outlook)

- OAuth 2.0 through Microsoft Entra ID with delegated `Mail.Read` and `Mail.Send` (or application permissions restricted by an application access policy to named mailboxes).
- Change notifications: Microsoft Graph subscriptions on the mailbox; the `validationToken` handshake is echoed; every notification's `clientState` is compared in constant time with the per-subscription secret. Subscriptions expire and are renewed by the worker.
- Sync: delta queries on the inbox folder.
- Sending: `sendMail` or reply, keeping the conversation ID.

### Common rules

- Incoming HTML is converted to plain text on the server; links are shown as text with their domain; remote images are never loaded.
- Attachments are downloaded on the server, checked by content and size, and stored privately (as described in [INBOX_SECURITY.md](INBOX_SECURITY.md#attachments)).
- Threading: provider thread or conversation ID, falling back to the normalized subject and sender.
- Unsubscribe requests and replies that only say "unsubscribe" add the address to `InboxEmailOptOut`; sending refuses opted-out addresses.
- Live sending needs explicit approval, the outbound approval pipeline (7A.5) and tests against test mailboxes only.
