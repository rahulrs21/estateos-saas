# Email integration plan

Status: **Gmail (Phase 7C.1) and Microsoft 365 / Outlook (Phase 7C.2) built in test mode: company and personal mailboxes connect with the provider's own sign-in, mail is imported every minute, and approved replies are sent only to the server's test addresses.**
EstateOS never asks for, accepts or stores mailbox passwords. Mailboxes are connected with OAuth through the provider's consent screen.

Related: [CHANNEL_ADAPTERS.md](CHANNEL_ADAPTERS.md), [INBOX_SECURITY.md](INBOX_SECURITY.md), [UNIFIED_INBOX.md](UNIFIED_INBOX.md).

## What Phase 7A delivers

- Adapters registered for `GMAIL` and `MICROSOFT_365` with every capability **PLANNED** (both are built since 7C.1 and 7C.2; they are polled, so they still have no webhook route).
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
  - the formatted (HTML) version, cleaned and shown like a mail client in a sandboxed frame, with remote images only on request ([INBOX_SECURITY.md](INBOX_SECURITY.md#safe-rendering));
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
- composing a new email from a lead.

## Phase 7C.2: Microsoft 365 / Outlook (built)

Microsoft 365 uses the same foundation as Gmail: the same mailbox kinds and permissions, state cookie, vault, lease, two-step judgement, personal-mailbox rule, event pipeline, cleaned HTML, test addresses and approval. Work and school mailboxes (Microsoft 365, Exchange Online) and personal Outlook.com accounts both work. What differs:

### Connecting

- **Sign-in.** **Connect company Microsoft 365** or **Connect my Outlook** opens Microsoft's own sign-in (Microsoft identity platform v2, tenant `common` unless `INBOX_MICROSOFT_TENANT` says otherwise).
  - The request uses PKCE (S256), a query return, `prompt=select_account`, and only these delegated permissions: `Mail.Read`, `Mail.Send`, `User.Read` (to learn the address) and `offline_access` (lasting access).
  - Both reading and sending must be granted, or nothing is stored.
  - The address Microsoft proves (`/me`: the primary address, or the sign-in name of a personal account) is the one connected.
- **Refusals** keep Microsoft's AADSTS number. For example AADSTS65001 means the organisation requires an administrator's consent before members can connect.
- **Rotating refresh tokens.** Microsoft hands back a new refresh token as the old one is used. EstateOS seals the new one and stores it only over the exact grant it read (compare-and-set, `UpdateMailboxToken`), so a mailbox disconnected or reconnected meanwhile is never overwritten.
- **No per-app revocation.** Microsoft offers no endpoint for an app to withdraw its own delegated grant. Disconnecting therefore wipes the stored grant and stops all use. The member is told to remove EstateOS at myapps.microsoft.com (work or school) or account.live.com/consent/Manage (personal) to withdraw Microsoft's permission as well. The same applies to a retired mailbox and to refused sign-ins.

### Sync

- **What is read.** The Inbox folder by received time, oldest first: on the first sync the last 3 days, afterwards from the newest message already read, never more than 3 days back. Junk and Sent Items are never read.
- **Already imported** messages at the boundary are recognised per mailbox (`KnownMailboxMessages`) and not fetched again.
- **Immutable IDs.** Every mail call asks for immutable IDs (`Prefer: IdType="ImmutableId"`), so a message keeps its ID if it is moved to another folder.
- **The same two-step judgement.** Internet headers first (drafts, mailing lists, bulk, auto-submitted, bounces, robots, the mailbox itself); mail inside one organisation has no internet headers, so Graph's own sender is used.
- **The text** is Graph's `uniqueBody` (the new part only), converted to text on the server with quoted history cut. The full HTML body is cleaned and kept for the sandboxed frame.
- **Attachments.** File attachments only (not attached emails or links), checked by content and stored privately, as for Gmail.
- **Failures.** A refused grant (`invalid_grant`, `InvalidAuthenticationToken`, 401) marks the mailbox **Reconnect needed** with sending off.

### Sending (test mode)

- **The same requirements** as Gmail: approved, sending on, a test address, and a personal mailbox only for its owner (the database guard covers both providers).
- **How.**
  1. Outlook prepares the reply to the customer's newest email (`createReply`), quoting the original in its thread.
  2. EstateOS sets exactly one recipient, the customer. It never uses the original's Reply-To, copies or blind copies.
  3. It puts the approved text, escaped, above the quote.
  4. It sends the reply.
- **Results.** Microsoft answers 202 with no body. The reply keeps its immutable ID in Sent Items, and that ID is the provider message ID for SENT. A refusal fails the reply with Microsoft's code and deletes the unsent draft. After a timeout the draft is left alone (it may have been sent), and the member is told to check Sent Items.
- **Not imported back.** Only the Inbox is read, so EstateOS's own replies (in Sent Items) never come back as customer mail.

### Server settings

| Variable | Purpose |
| --- | --- |
| `INBOX_MICROSOFT_CLIENT_ID` | The app registration's Application (client) ID |
| `INBOX_MICROSOFT_CLIENT_SECRET` | A client secret's **value** (not its ID). Secrets expire; renew before the date shown in Entra |
| `INBOX_MICROSOFT_TENANT` | Optional. `common` by default (work, school and personal accounts); `organizations`, `consumers`, or one directory's ID or domain to restrict |
| `INBOX_MICROSOFT_OAUTH_BASE`, `INBOX_MICROSOFT_API_BASE` | Tests only: a local fake Microsoft (refused in production) |

`INBOX_TOKEN_ENCRYPTION_KEY` and `INBOX_EMAIL_TEST_RECIPIENTS` are shared with Gmail.

### Trying it with your own Microsoft mailbox

1. **App registration.** Sign in to the Microsoft Entra admin center (entra.microsoft.com) with an account that has a directory: any Microsoft 365 business account, or a free Azure account. Go to **App registrations → New registration**.
   - **Name:** for example EstateOS (development).
   - **Supported account types:** accounts in any organizational directory **and personal Microsoft accounts**.
   - **Redirect URI:** platform **Web**, `http://localhost:3000/api/inbox/oauth/microsoft/callback`.
2. **Client ID.** On the app's **Overview**, copy the **Application (client) ID**.
3. **Client secret.** Under **Certificates & secrets → New client secret**, create one and copy its **Value** straight away (it is shown once).
4. **Permissions.** Under **API permissions → Add a permission → Microsoft Graph → Delegated permissions**, add `Mail.Read`, `Mail.Send` and `offline_access` (`User.Read` is already there). Your own sign-in grants them; an organisation may require an administrator to **Grant admin consent**.
5. **Server settings.** In `.env.local`, add `INBOX_MICROSOFT_CLIENT_ID` and `INBOX_MICROSOFT_CLIENT_SECRET`, then restart `npm run dev:local`.
6. **Connect.** In **Inbox settings → Email mailboxes**, click **Connect company Microsoft 365** (or **Connect my Outlook**, if you have no personal mailbox yet) and sign in. Microsoft may show the app as unverified.
7. **Import, then reply,** as with Gmail: email the mailbox from another address, then turn sending on and send an approved reply to a test address.

Going live needs publisher verification (a verified Microsoft Partner Network account), and organisations may still require administrator consent.

Not in 7C.2: Graph change notifications (push), shared mailboxes, and application permissions (all mailboxes of an organisation).

## Phase 7C design

### Gmail (Google Workspace): as first designed (7C.1 above is what was built)

- OAuth 2.0 with the narrowest scopes that support reading and sending (for example `gmail.readonly` plus `gmail.send`, or `gmail.modify` only if labels are needed). Workspace administrators may need to approve the app.
- Refresh tokens are encrypted and stored in Secret Manager (or an envelope-encrypted store); the connection keeps only a reference.
- Change notifications: `users.watch` to a Cloud Pub/Sub topic; the push subscription calls EstateOS with an OIDC token whose audience and service account are verified. Watches expire and are renewed by the worker.
- Sync: `users.history.list` from the stored `historyId`; on a gap, a bounded resync. Each Gmail message ID is a provider message ID (deduplicated like WhatsApp).
- Sending: `users.messages.send` with RFC 2822 content, threaded with `In-Reply-To` and `References`.

### Microsoft 365 (Outlook): as first designed (7C.2 above is what was built: polling by received time instead of subscriptions, and reply instead of sendMail)

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
