# Email integration plan

Status: **interfaces only in Phase 7A; live Gmail and Microsoft 365 connectors are Phase 7C and need approval.**
EstateOS never asks for, accepts or stores mailbox passwords. Mailboxes are connected with OAuth through the provider's consent screen.

Related: [CHANNEL_ADAPTERS.md](CHANNEL_ADAPTERS.md), [INBOX_SECURITY.md](INBOX_SECURITY.md), [UNIFIED_INBOX.md](UNIFIED_INBOX.md).

## What Phase 7A delivers

- Adapters registered for `GMAIL` and `MICROSOFT_365` with every capability **PLANNED**. They verify nothing and accept no events: their webhook routes answer 404.
- Connection records on **Inbox settings** (mailbox address, secret name). They never reach VERIFIED and cannot send. The settings form says plainly not to enter a mailbox password; the secret-name field accepts only `INBOX_…` names, so a pasted password is refused.
- The inbox model already holds email: subject, sender and recipient addresses, plain-text content (messages are always rendered as text, never as HTML; converting incoming email HTML to text is part of the 7C connector), attachments, threads, and email opt-outs (`InboxEmailOptOut`).
- Email conversations can be simulated end to end (`/dev/communication-tests`, fictional `@example.test` senders).

## Phase 7C design

### Gmail (Google Workspace)

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
