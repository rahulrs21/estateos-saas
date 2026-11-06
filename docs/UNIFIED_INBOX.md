# Unified inbox

Status: **Phase 7A in progress.** 7A.1–7A.5 are built. This document covers replies, approval, the Claude assistant and inbox workflows (7A.5). The overview, access, matching, ingestion, simulator and API sections are completed in 7A.6.

Related: [CHANNEL_ADAPTERS.md](CHANNEL_ADAPTERS.md), [WHATSAPP_INTEGRATION_PLAN.md](WHATSAPP_INTEGRATION_PLAN.md), [EMAIL_INTEGRATION_PLAN.md](EMAIL_INTEGRATION_PLAN.md), [WORKFLOW_APPROVALS.md](WORKFLOW_APPROVALS.md), [AI_SECURITY.md](AI_SECURITY.md).

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
