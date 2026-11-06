# Unified inbox

Status: **Phase 7A complete (foundation).** WhatsApp, email and website conversations live in one inbox at `/inbox`, linked to the CRM. They come with replies that need approval, a Claude assistant and workflow triggers.

No real provider is connected and nothing is sent outside EstateOS:
- WhatsApp sending is Phase 7B;
- Gmail and Microsoft 365 are Phase 7C;
- both need approval.

Related:
- [INBOX_SECURITY.md](INBOX_SECURITY.md): permissions, privacy, retention and opt-out;
- [CHANNEL_ADAPTERS.md](CHANNEL_ADAPTERS.md): providers, webhooks, durable events and receipts;
- [WHATSAPP_INTEGRATION_PLAN.md](WHATSAPP_INTEGRATION_PLAN.md) and [EMAIL_INTEGRATION_PLAN.md](EMAIL_INTEGRATION_PLAN.md);
- [WORKFLOW_APPROVALS.md](WORKFLOW_APPROVALS.md) and [AI_SECURITY.md](AI_SECURITY.md).

## Database

The schema is in `dataconnect/schema/inbox.gql`. All tables are additive and keyed by company, with composite foreign keys. The enums are append-only.

| Table | Holds |
| --- | --- |
| `ChannelConnection` | A company's provider account: provider, external account ID (unique per provider), the secret's name, status (never VERIFIED in 7A), and whether sending is enabled (true only for the developer simulator) |
| `InboxSettings` | Approval required (default on), retention days (730), unanswered minutes (120) and whether Claude may analyse conversations (default off) |
| `InboxConversation` | One customer identity on one channel thread. Holds the linked contact and lead, assignee, status, priority, unread count, last inbound and outbound times, preview, opted-out and simulated flags, and a revision for compare-and-set |
| `InboxMessage` | Direction, sender and recipient, type, plain-text content (removed by retention), delivery status, the raw provider status, and the simulated flag. Unique per connection and provider message ID |
| `InboxAttachment` | A private file (or a provider reference not yet downloaded), with its type, size and scan status |
| `InboxAssignmentHistory`, `InboxNote` | Who assigned whom and why; private team notes |
| `InboxEvent` | Each verified provider event, recorded once (dedup key) before it is applied, with retries |
| `OutboundMessageJob` | A reply from draft to delivery (see [Outbound](#outbound)) |
| `InboxAiInsight` | A checked Claude analysis |
| `InboxEmailOptOut` | Email addresses that opted out (WhatsApp numbers use the 6F `CommunicationSuppression` list) |

Indexes cover the list orders (company and last message; assignee; status), lead, contact and identity lookups, message history by conversation, events due a retry, and the retention scan. The hosted database is unchanged; rolling these tables out there needs approval.

## Interface

- **`/inbox`** has three columns. They collapse to one on mobile, with a back button.
  - **Left:** channel filters, search, and the views (All, Unread, Assigned to me, Unassigned, Needs matching, Open, Pending, Resolved) with counts.
  - **Middle:** the conversation list (25 per page, cursor "Load more").
  - **Main:**
    - the conversation: header controls for status, priority, assignee and the customer link;
    - message history (30 per page, "Load earlier"), with delivery badges, attachments and SIMULATED labels;
    - the reply panel and the Claude assistant;
    - internal notes;
    - the customer panel: the lead and contact, follow-ups, viewings, property interests, calls, recent activity, and the customer's other conversations.
- **Refresh.** There is no real-time push. The list refreshes every 30 seconds while visible, when the tab becomes visible, and on demand; the inbox badge updates with it.
- **`/inbox/settings`** (owners and administrators): the inbox rules and the channel connections with their capability matrix and webhook addresses.
- **States.** Every screen has loading, error and empty states. No conversation is ever invented.

## Access

OWNERs and ADMINs see every conversation. MANAGERs see their own and the unassigned triage queue. AGENTs see conversations assigned to them or linked to their leads. The rule is enforced inside every database operation; see [INBOX_SECURITY.md](INBOX_SECURITY.md#visibility).

## Matching

A sender is linked automatically only by an exact normalized phone number (E.164) or email address on **exactly one** contact. When that contact has exactly one active lead, the conversation joins that lead and goes to the lead's agent; the lead itself is not changed.

Zero or several matches leave the conversation in **Needs matching**. A member then links it by hand to a lead or contact they can access, and is told whether the sender's number or email is on that record. The link is audited. Names never decide a match.

## Ingestion

Every inbound message goes through `ingestInbound` (`src/modules/inbox/server/ingest.ts`), whether from a verified webhook, the developer simulator or the website form. It:
1. finds or creates the conversation (unique per connection and thread);
2. inserts the message, with a stable ID per provider message, so a retried delivery is a duplicate;
3. writes the workflow events in the same transaction.

A message that consists only of an opt-out keyword flags the conversation and, for real customers, adds them to the do-not-contact list ([INBOX_SECURITY.md](INBOX_SECURITY.md#opt-out)).

Website enquiries are written inside the lead-capture transaction itself. Each creates a WEBSITE conversation linked to the new lead and contact, with the visitor's message. Older submissions are not backfilled.

## Simulator

`/dev/communication-tests` has an inbox section, available only with developer tools on (local emulators or a demo project, never production) and only to owners and administrators. It sends WhatsApp and email messages through the real pipeline on the company's `DEVELOPMENT_SIMULATOR` connection:
- from the simulator's fictional leads (`+44 7700 900xxx`, `@example.test`) or from unknown fictional senders;
- optionally with a small attachment;
- optionally replaying an earlier delivery, to show duplicate handling.

It also sends website enquiries through the real public form. Simulated records are labelled SIMULATED, hidden from the inbox unless included, and removed by **Reset**, which never touches real records. Simulated replies can be sent and given receipts ([Outbound](#outbound)).

## API

All routes are under `/api/inbox`. Reads need a verified session; changes also need same-origin, the CSRF token and the matching company header.

| Route | Methods |
| --- | --- |
| `/conversations`, `/counts`, `/assignees`, `/settings` | GET (settings also PUT, owners and administrators) |
| `/conversations/{id}` and `/messages`, `/customer` | GET |
| `/conversations/{id}/assign`, `/state`, `/link`, `/notes`, `/read` | POST |
| `/conversations/{id}/attachments/{attachmentId}` | GET (download, audited) |
| `/conversations/{id}/replies` | GET, POST; `/replies/{replyId}` PUT (edit); `/replies/{replyId}/{check\|submit\|decide\|cancel\|send}` POST |
| `/conversations/{id}/assistant` | POST (Claude analysis); `/assistant/apply` POST (reviewed requirements to the lead) |
| `/connections`, `/connections/{id}`, `/connections/{id}/enabled` | Owners and administrators |
| `/webhooks/{provider}/{connectionId}` | GET handshake, POST events (signature-verified, no session) |

Developer tools: `/api/dev/communication-tests/inbox` (state) and `/inbound`, `/website`, `/receipt`. These answer 404 unless developer tools are enabled.

## Local testing

| Command | Covers |
| --- | --- |
| `npm run test:inbox` | Unit: identity, policy, adapters and signatures, attachments, outbound rules, the assistant's checks, the workflow registry, retention |
| `npm run test:dataconnect` | Emulator: visibility for every role, tenant isolation, ingestion and duplicates, events and receipts, attachments, replies and approval, simulator-only delivery, insights, workflows, opt-outs, retention |
| `npm run test:inbox:e2e` | The real app in a headless browser on isolated emulators. `AI_E2E_LIVE=1` adds the live Claude checks (two paid calls) |
| `npm run test:persistence` | Conversations, messages, replies and analyses survive hard kills of `dev:local` |

To try it by hand:
1. Run `npm run dev:local`.
2. Open `/dev/communication-tests` as an owner, create a fictional lead and send a WhatsApp message from it.
3. Open the conversation in `/inbox`.
4. Write a reply, check it and request approval.
5. Approve it as another owner, administrator or manager.
6. Send it with **Send (simulator)**, then simulate its receipts.

Turn on Claude in Inbox settings to use the assistant (it needs `ANTHROPIC_API_KEY` in `.env.local` and uses the company's AI allowance).

## Known limitations

- **No live provider.**
  - WhatsApp webhooks are verified (and were tested against Meta's dashboard test event), but there is no sending, template messaging or media download.
  - Gmail and Microsoft 365 are interfaces only.
  - Connections never reach VERIFIED.
- **Templates.** WhatsApp replies outside the 24-hour window need approved templates, which are Phase 7B. Until then, such replies fail the checks.
- **No malware scanner** is connected (`NOT_SCANNED`).
- **No real-time push**, only the controlled refresh.
- **Email opt-outs** have no withdrawal page.
- **Managers** see assigned and unassigned conversations, not a team's (there is no team model, as in 6F).
- **Notifications.** The "reply waiting for approval" notification goes to owners and administrators; managers see waiting replies in the conversations they can open.
- **Matched listings** come from the lead's recorded requirements. Requirements found in the conversation help only after a member applies them to the lead.
- **Retention** clears message text but keeps internal notes and audit logs.

## Outbound

A reply is an `OutboundMessageJob`. Its stages are:

`DRAFT → VALIDATED → PENDING_APPROVAL → APPROVED → QUEUED → SENT | FAILED`, plus `CANCELLED`.

- **Every move is compare-and-set** on the job's revision (`dataconnect/connector/inbox-outbound.gql`). Two people acting at once cannot both win.
- **Who can work on replies.** Any member who can see the conversation can draft, edit, check and submit (the conversation visibility rule is repeated in every operation).
- **Editing** is allowed in `DRAFT`, `VALIDATED` and `PENDING_APPROVAL`. It returns the reply to `DRAFT`, withdraws an approval request, keeps up to 10 earlier versions and records the editor (`lastEditedBy`, `edited`). Approved text is frozen.
- **Approval.**
  - The company setting **Outbound messages need approval** is on by default. When it is on, a checked reply waits for an OWNER, ADMIN or MANAGER who can see the conversation.
  - Neither the author nor the last editor may approve it, unless they are the OWNER. The OWNER's approval is then recorded as `selfApproved`, so a single-owner company can operate.
  - Rejecting needs a reason. It returns the reply to `DRAFT` with the approver's note.
  - When the setting is off, submitting approves the reply directly. The database compares the server's value with the stored setting.
- **Cancelling.** The author, the last editor, or an OWNER, ADMIN or MANAGER can cancel a reply until it is queued.
- **Sending** is a server-only operation (`dataconnect/connector/inbox-delivery.gql`):
  - `QueueInboxReply` inserts the outbound message as `QUEUED`. It does so only when the reply is `APPROVED`, the content is exactly the approved text, and the conversation is **simulated**, not opted out, and on the company's **DEVELOPMENT_SIMULATOR** connection with sending enabled. No real provider connection meets this condition, so nothing can reach a real number or address in Phase 7A.
  - The adapter is then asked to deliver. Its acknowledgement (`AcknowledgeInboxReply`) is the only way to `SENT`, and it stores the provider message ID (`simwamid.…` for the simulator) that receipts match on.
  - A refusal (`FailInboxReply`) makes the reply and message `FAILED` and writes the `inbox.message.failed` workflow event in the same transaction.
- **Receipts** (delivered, read, failed) come through the normal event pipeline. For the simulator, owners and administrators press *Simulate delivered / read / failed* on a sent simulated reply. They move forward only; see [CHANNEL_ADAPTERS.md](CHANNEL_ADAPTERS.md#delivery-receipts).
- **The Send button** appears only with developer tools enabled, on a simulated conversation, for an approved reply. Real WhatsApp and email conversations show "Sending is disabled until this provider is connected and approved (Phase 7B/7C)". Their replies can still be drafted, checked and approved.

Every stage change is audited (`INBOX_OUTBOUND_CHANGED`) with the event, conversation and, for decisions, the approver's role and whether it was a self-approval.

### Validation

`validateOutbound` (`src/modules/inbox/outbound.ts`) runs on the server from the stored reply and conversation, never from the browser. It runs when a member checks a reply, again before submission, before approval and before sending.

| Problem | Blocks approval | Rule |
| --- | --- | --- |
| `EMPTY`, `TOO_LONG` | Yes | 1–4000 characters |
| `PLACEHOLDER` | Yes | Leftover `{{…}}` or `[agent name]`-style text, or `[number removed]` |
| `LINK_SCHEME` | Yes | `javascript:`, `data:` or `vbscript:` links |
| `OPTED_OUT` | Yes | The customer sent an opt-out keyword on this conversation |
| `SUPPRESSED` | Yes | An active do-not-contact entry: the Phase 6F number list (scope ALL) or an inbox email opt-out |
| `WINDOW_CLOSED` | Yes | WhatsApp: a free-form reply only within 24 hours of the customer's last message. Otherwise an approved template is needed (Phase 7B) |
| `UNSUPPORTED_NUMBERS` | Yes | An unedited Claude draft contains numbers that are not in the conversation, the lead's record or the matched listings. Once a person edits the draft, the text is theirs |
| `NO_CHANNEL` | No (blocks sending) | Website enquiries have no reply channel yet |
| `SENDING_DISABLED` | No (blocks sending) | The conversation's channel cannot deliver in Phase 7A |

The stored result (`validationJson`) explains the problems in the UI. The final check before sending does not trust it; it runs the rules again.

## Assistant

When an OWNER or ADMIN turns on **Let Claude analyse conversations** in Inbox settings (off by default), any member who can see a conversation can ask Claude to analyse it.

- **What Claude reads:**
  - the newest 40 text messages, numbered `M1…`, with phone numbers, emails and long digit runs removed (`minimizePersonalData`);
  - the linked lead's recorded requirements, when the member can open the lead;
  - up to five listings from the existing lead–property matching (`getLeadPropertyData`: available inventory, active listings, the lead's requirements, the member's inventory scope).
  All of this is wrapped as untrusted data (`<conversation>`, `<lead_record>`, `<listings>`). The prompt tells Claude to ignore any instruction inside it. A customer message cannot close the block.
- **One request.** It uses the existing Anthropic client, structured outputs and adaptive thinking (`generateStructured`) and the company's AI allowance (`reserveQuota`). Usage is recorded with feature `INBOX_AI`, and there are per-member, per-IP and per-company rate limits. There is no second AI integration.
- **Output** (a deliberately flat schema, `ASSISTANT_JSON`):
  - a summary;
  - points marked `QUESTION`, `REQUIREMENT` or `NEXT_STEP`, each with a quote and a message reference;
  - requirement fields: property type, location, bedrooms, minimum and maximum budget, buy, rent or invest;
  - listing references;
  - a reply draft;
  - limitations.
- **Checks** (`checkInsight` in `src/modules/inbox/assistant.ts`):
  - a quote must appear in the message it names; otherwise the point is shown as unverified, and a "stated" point becomes an inference;
  - a budget needs a quoted number, otherwise it is dropped;
  - only listings EstateOS supplied are kept;
  - numbers in the draft that no source contains are listed as warnings and block approval of the unedited draft;
  - contact details in the draft are removed.
- **Storage.** The checked analysis is stored as an `InboxAiInsight`. Its reply becomes an `OutboundMessageJob` in `DRAFT` (source `CLAUDE`), never sent. Both are written by a server-only operation and audited (`INBOX_AI_GENERATED`). A failed Claude request stores nothing, apart from the usage record.
- **Requirements** appear under "Review before saving to the lead", each showing the lead's current value, the proposed value and the customer's words.
  - Only verified, stated requirements that differ from the lead are offered.
  - A member ticks the ones to apply. The server takes them from the latest analysis only and applies them through the normal lead update, with its permissions, validation and activity.
  - Nothing else on the lead changes, including its assignment.

## Workflows

Inbox events are 6E workflow triggers on the target type `CONVERSATION`:

- `inbox.message.received`
- `inbox.conversation.created`
- `inbox.conversation.assigned`
- `inbox.conversation.resolved`
- `inbox.message.failed`
- `inbox.conversation.unanswered`. The worker scan emits this once per customer message that has waited longer than the company's **Unanswered after** time with no later reply. It uses the same scan windows as overdue tasks.

Conditions can use the lead facts (when the conversation is linked) and these conversation facts:

- channel, status and priority;
- assignee;
- linked, opted out and unanswered;
- the customer's last message time.

Message text, names and numbers are never facts.

| Action | Risk | Behaviour |
| --- | --- | --- |
| `notification.create`, `task.create` | LOW | As for other targets. Tasks go to the linked lead (follow-up) or the conversation's assignee (work task) |
| `inbox.draft_reply` | LOW (Claude) | The assistant as the workflow's executor: an analysis and a reply DRAFT, never sent. Skipped when Claude is off for the inbox. A repeated step reuses its stored analysis |
| `inbox.reassign` | MEDIUM | Waits for an OWNER or ADMIN to approve the exact change (to a chosen member, or to the linked lead's agent), then `AutomationReassignConversation` applies it with expected-state checks. Only the conversation moves; the lead's assignment never does |

**Template J** (Unanswered inbox conversation) notifies the assignee and the managers, then creates a reply task. It sends nothing to the customer.
