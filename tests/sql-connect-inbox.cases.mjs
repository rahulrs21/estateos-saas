import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";
import { fixture as f } from "./fixtures/sql-connect-fixtures.mjs";

/**
 * Phase 7A inbox storage against the SQL Connect emulator: server-only
 * ingestion with workflow events in the same transaction, duplicate messages,
 * identity matching, the visibility rule for every role, assignment with
 * history, linking without touching the lead's assignment, status, notes,
 * read marks, settings and tenant isolation. Fictional identities only.
 * Company A: owner-a, admin-a, manager-a, agent-a, shared-agent. Company B: owner-b.
 */
export function registerInboxCases({sdk, run, forbidden, dc}) {
  describe("Phase 7A unified inbox", {concurrency: false}, () => {
    const key = value => String(value).replaceAll("-", "").toLowerCase();
    const server = async (operation, variables) => (await operation(dc, variables)).data;
    const rejectsWith = (promise, token) => assert.rejects(promise, error => String(error?.message ?? error).includes(token), token);
    const events = async targetId => (await dc.executeGraphql(`query E($org: UUID!, $id: UUID!) { automationEvents(where: {organizationId: {eq: $org}, targetId: {eq: $id}}) { triggerType origin } }`,
      {variables: {org: f.orgA, id: targetId}})).data.automationEvents.map(row => row.triggerType).sort();
    const list = (uid, extra = {}) => run(sdk.listInboxConversations, uid, {organizationId: f.orgA, limit: 25, ...extra});
    const PHONE = "+447700900611", EMAIL = "inbox.customer@example.test";
    let leadId, contactId, linked, unknown, revision;
    const create = extra => server(sdk.createInboxConversationWithMessage, {organizationId: f.orgA, conversationId: randomUUID(), channelConnectionId: null, channel: sdk.InboxChannel.WHATSAPP,
      externalThreadId: `thread-${randomUUID()}`, customerIdentity: PHONE, customerName: "Fictional customer", subject: null, contactId: null, leadId: null, assignedMembershipId: null,
      messageId: randomUUID(), externalMessageId: `wamid.${randomUUID()}`, messageType: sdk.InboxMessageType.TEXT, content: "Hello, is the two-bedroom still available?", senderIdentity: PHONE,
      recipientIdentity: null, providerTimestamp: null, preview: "Hello, is the two-bedroom still available?", simulated: false, optedOut: false, ...extra});

    it("matches senders only by exact identity, and stores the conversation, message and workflow events together", async () => {
      const created = await run(sdk.createLead, "owner-a", {organizationId: f.orgA, fullName: `Inbox customer ${randomUUID().slice(0, 6)}`, phone: PHONE, normalizedPhone: PHONE, email: EMAIL, assignedMembershipId: f.memberAgentA});
      leadId = created.lead.id;
      contactId = (await run(sdk.getLead, "owner-a", {organizationId: f.orgA, leadId})).lead.contactId;
      const match = await server(sdk.matchInboxIdentity, {organizationId: f.orgA, hasPhone: true, phone: PHONE, hasEmail: true, email: EMAIL});
      assert.equal(match.byPhone.length, 1);
      assert.equal(key(match.byEmail[0].id), key(contactId));
      assert.equal((await server(sdk.matchInboxIdentity, {organizationId: f.orgB, hasPhone: true, phone: PHONE, hasEmail: false, email: null})).byPhone.length, 0, "another company's contacts are never matched");
      await forbidden(sdk.matchInboxIdentity, "owner-a", {organizationId: f.orgA, hasPhone: true, phone: PHONE, hasEmail: false, email: null});
      await forbidden(sdk.createInboxConversationWithMessage, "owner-a", {organizationId: f.orgA, conversationId: randomUUID(), channel: sdk.InboxChannel.WHATSAPP, externalThreadId: "x", customerIdentity: PHONE,
        messageId: randomUUID(), externalMessageId: "x", messageType: sdk.InboxMessageType.TEXT, simulated: false, optedOut: false});

      linked = randomUUID();
      const messageId = randomUUID();
      await create({conversationId: linked, contactId, leadId, assignedMembershipId: f.memberAgentA, messageId, externalMessageId: "wamid.first"});
      assert.deepEqual(await events(linked), ["inbox.conversation.created", "inbox.message.received"]);
      await assert.rejects(create({conversationId: randomUUID(), messageId, externalMessageId: "wamid.other"}), "the same message ID is refused");
      await server(sdk.appendInboxMessage, {organizationId: f.orgA, conversationId: linked, channelConnectionId: null, messageId: randomUUID(), externalMessageId: "wamid.second",
        messageType: sdk.InboxMessageType.TEXT, content: "Also, what is the payment plan?", senderIdentity: PHONE, recipientIdentity: null, providerTimestamp: null, preview: "Also, what is the payment plan?", simulated: false, optedOut: false});
      const conversation = (await run(sdk.getInboxConversation, "agent-a", {organizationId: f.orgA, id: linked})).conversation;
      assert.equal(conversation.unreadCount, 2);
      assert.equal(conversation.lastMessagePreview, "Also, what is the payment plan?");
      revision = conversation.revision;
      unknown = randomUUID();
      await create({conversationId: unknown, customerIdentity: "+447700900612", senderIdentity: "+447700900612"});
    });

    it("shows each member only the conversations they may see", async () => {
      const ids = async uid => (await list(uid)).conversations.map(row => key(row.id));
      assert.ok((await ids("owner-a")).includes(key(linked)) && (await ids("owner-a")).includes(key(unknown)));
      assert.ok((await ids("admin-a")).includes(key(unknown)));
      const agent = await ids("agent-a");
      assert.ok(agent.includes(key(linked)), "the assignee sees it");
      assert.ok(!agent.includes(key(unknown)), "agents never see the unassigned queue");
      const manager = await ids("manager-a");
      assert.ok(manager.includes(key(unknown)), "managers triage unassigned conversations");
      assert.ok(!manager.includes(key(linked)), "but not other agents' conversations");
      assert.ok(!(await ids("shared-agent")).includes(key(linked)));
      await forbidden(sdk.listInboxConversations, "owner-b", {organizationId: f.orgA, limit: 25});
      await forbidden(sdk.getInboxConversation, "owner-b", {organizationId: f.orgA, id: linked});
      assert.equal((await run(sdk.getInboxConversation, "shared-agent", {organizationId: f.orgA, id: linked})).conversation, null, "a guessed ID is not found");
      await rejectsWith(run(sdk.listInboxMessages, "shared-agent", {organizationId: f.orgA, conversationId: linked, limit: 30}), "INBOX_CONVERSATION_NOT_FOUND");
      const messages = (await run(sdk.listInboxMessages, "agent-a", {organizationId: f.orgA, conversationId: linked, limit: 1})).messages;
      assert.equal(messages[0].content, "Also, what is the payment plan?", "newest first");
      const older = (await run(sdk.listInboxMessages, "agent-a", {organizationId: f.orgA, conversationId: linked, limit: 1, cursorAt: messages[0].createdAt, seenIds: [messages[0].id]})).messages;
      assert.equal(older[0].content, "Hello, is the two-bedroom still available?", "the cursor reaches the earlier message");
      const filtered = await list("owner-a", {needsMatching: true});
      assert.ok(filtered.conversations.some(row => key(row.id) === key(unknown)) && !filtered.conversations.some(row => key(row.id) === key(linked)));
      const searched = await list("owner-a", {search: "%payment plan%"});
      assert.ok(searched.conversations.some(row => key(row.id) === key(linked)));
      const counts = await run(sdk.inboxCounts, "agent-a", {organizationId: f.orgA});
      assert.ok(counts.unread[0].count >= 1 && counts.mine[0].count >= 1);
      assert.equal(counts.unassigned[0].count, 0, "an agent's counts include only what they may see");
    });

    it("assigns with history, a notification and the workflow event; agents may only take conversations for themselves", async () => {
      await rejectsWith(run(sdk.assignInboxConversation, "agent-a", {organizationId: f.orgA, id: linked, expectedRevision: revision, hasTarget: true, toMembershipId: f.memberSharedA, reason: null,
        historyId: randomUUID(), notify: true, notificationId: randomUUID()}), "INBOX_ASSIGNMENT_FORBIDDEN");
      await rejectsWith(run(sdk.assignInboxConversation, "manager-a", {organizationId: f.orgA, id: unknown, expectedRevision: 1, hasTarget: true, toMembershipId: f.memberSuspendedA, reason: null,
        historyId: randomUUID(), notify: true, notificationId: randomUUID()}), "INBOX_ASSIGNEE_INVALID");
      await run(sdk.assignInboxConversation, "manager-a", {organizationId: f.orgA, id: unknown, expectedRevision: 1, hasTarget: true, toMembershipId: f.memberAgentA, reason: "Arabic speaker",
        historyId: randomUUID(), notify: true, notificationId: randomUUID()});
      await rejectsWith(run(sdk.assignInboxConversation, "manager-a", {organizationId: f.orgA, id: unknown, expectedRevision: 1, hasTarget: false, toMembershipId: null, reason: null,
        historyId: randomUUID(), notify: false, notificationId: randomUUID()}), "INBOX_CONVERSATION_CHANGED");
      const assigned = (await run(sdk.getInboxConversation, "agent-a", {organizationId: f.orgA, id: unknown})).conversation;
      assert.ok(assigned, "the new assignee sees it");
      assert.equal(assigned.assignments.length, 1);
      assert.equal(assigned.assignments[0].reason, "Arabic speaker");
      assert.ok((await events(unknown)).includes("inbox.conversation.assigned"));
      // An agent may take a conversation they can see for themselves.
      await run(sdk.assignInboxConversation, "agent-a", {organizationId: f.orgA, id: unknown, expectedRevision: assigned.revision, hasTarget: true, toMembershipId: f.memberAgentA, reason: null,
        historyId: randomUUID(), notify: false, notificationId: randomUUID()});
    });

    it("links only to permitted records, never changes the lead's assignment, and records status, notes and read marks", async () => {
      const otherLead = (await run(sdk.createLead, "owner-a", {organizationId: f.orgA, fullName: `Other lead ${randomUUID().slice(0, 6)}`, assignedMembershipId: f.memberSharedA})).lead.id;
      const current = (await run(sdk.getInboxConversation, "agent-a", {organizationId: f.orgA, id: unknown})).conversation;
      await rejectsWith(run(sdk.linkInboxConversation, "agent-a", {organizationId: f.orgA, id: unknown, expectedRevision: current.revision, hasLead: true, leadId: otherLead, hasContact: false, contactId: null, identityMatches: false}), "INBOX_LINK_TARGET_NOT_FOUND");
      await run(sdk.linkInboxConversation, "owner-a", {organizationId: f.orgA, id: unknown, expectedRevision: current.revision, hasLead: true, leadId: otherLead, hasContact: false, contactId: null, identityMatches: false});
      const lead = (await run(sdk.getLead, "owner-a", {organizationId: f.orgA, leadId: otherLead})).lead;
      assert.equal(key(lead.assignedMembershipId), key(f.memberSharedA), "linking never reassigns the lead");
      const afterLink = (await run(sdk.getInboxConversation, "agent-a", {organizationId: f.orgA, id: unknown})).conversation;
      assert.equal(key(afterLink.leadId), key(otherLead));
      assert.ok(afterLink.contactId, "the lead's contact is linked too");
      assert.ok((await run(sdk.getInboxConversation, "shared-agent", {organizationId: f.orgA, id: unknown})).conversation, "the lead's agent now sees the conversation");
      await run(sdk.archiveLead, "owner-a", {organizationId: f.orgA, leadId: otherLead}); // keeps the shared agent without active leads for the CRM cases

      await forbidden(sdk.setInboxConversationState, "agent-a", {organizationId: f.orgA, id: linked, expectedRevision: revision, status: sdk.InboxConversationStatus.RESOLVED, priority: sdk.InboxPriority.HIGH, emitResolved: false});
      await run(sdk.setInboxConversationState, "agent-a", {organizationId: f.orgA, id: linked, expectedRevision: revision, status: sdk.InboxConversationStatus.RESOLVED, priority: sdk.InboxPriority.HIGH, emitResolved: true});
      assert.ok((await events(linked)).includes("inbox.conversation.resolved"));
      await rejectsWith(run(sdk.setInboxConversationState, "agent-a", {organizationId: f.orgA, id: linked, expectedRevision: revision, status: sdk.InboxConversationStatus.OPEN, priority: sdk.InboxPriority.NORMAL, emitResolved: false}), "INBOX_CONVERSATION_CHANGED");
      await run(sdk.addInboxNote, "agent-a", {organizationId: f.orgA, id: randomUUID(), conversationId: linked, body: "Prefers WhatsApp after 6 pm (synthetic)."});
      await rejectsWith(run(sdk.addInboxNote, "shared-agent", {organizationId: f.orgA, id: randomUUID(), conversationId: linked, body: "x"}), "INBOX_CONVERSATION_NOT_FOUND");
      await run(sdk.markInboxConversationRead, "agent-a", {organizationId: f.orgA, id: linked});
      const done = (await run(sdk.getInboxConversation, "agent-a", {organizationId: f.orgA, id: linked})).conversation;
      assert.equal(done.status, "RESOLVED");
      assert.equal(done.unreadCount, 0);
      assert.equal(done.notes.length, 1);
      // A new inbound message reopens it.
      await server(sdk.appendInboxMessage, {organizationId: f.orgA, conversationId: linked, channelConnectionId: null, messageId: randomUUID(), externalMessageId: "wamid.third",
        messageType: sdk.InboxMessageType.TEXT, content: "One more question", senderIdentity: PHONE, recipientIdentity: null, providerTimestamp: null, preview: "One more question", simulated: false, optedOut: false});
      assert.equal((await run(sdk.getInboxConversation, "agent-a", {organizationId: f.orgA, id: linked})).conversation.status, "OPEN");
    });

    it("keeps inbox settings to owners and administrators with compare-and-set", async () => {
      await rejectsWith(run(sdk.saveInboxSettings, "agent-a", {organizationId: f.orgA, expectedRevision: 0, approvalRequired: false, retentionDays: 365, unansweredMinutes: 60}), "INBOX_ADMIN_REQUIRED");
      await forbidden(sdk.saveInboxSettings, "owner-a", {organizationId: f.orgA, expectedRevision: 0, approvalRequired: true, retentionDays: 5, unansweredMinutes: 60});
      await run(sdk.saveInboxSettings, "owner-a", {organizationId: f.orgA, expectedRevision: 0, approvalRequired: true, retentionDays: 365, unansweredMinutes: 60});
      await rejectsWith(run(sdk.saveInboxSettings, "admin-a", {organizationId: f.orgA, expectedRevision: 0, approvalRequired: false, retentionDays: 365, unansweredMinutes: 60}), "INBOX_SETTINGS_CHANGED");
      const {settings} = await run(sdk.getInboxSettings, "agent-a", {organizationId: f.orgA});
      assert.equal(settings.revision, 1);
      assert.equal(settings.retentionDays, 365);
      assert.equal((await run(sdk.getInboxSettings, "owner-b", {organizationId: f.orgB})).settings, null, "another company has its own (absent) settings");
    });
  });
}
