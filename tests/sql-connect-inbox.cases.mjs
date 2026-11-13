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
      await rejectsWith(run(sdk.saveInboxSettings, "agent-a", {organizationId: f.orgA, expectedRevision: 0, approvalRequired: false, retentionDays: 365, unansweredMinutes: 60, aiEnabled: false}), "INBOX_ADMIN_REQUIRED");
      await forbidden(sdk.saveInboxSettings, "owner-a", {organizationId: f.orgA, expectedRevision: 0, approvalRequired: true, retentionDays: 5, unansweredMinutes: 60, aiEnabled: false});
      await run(sdk.saveInboxSettings, "owner-a", {organizationId: f.orgA, expectedRevision: 0, approvalRequired: true, retentionDays: 365, unansweredMinutes: 60, aiEnabled: false});
      await rejectsWith(run(sdk.saveInboxSettings, "admin-a", {organizationId: f.orgA, expectedRevision: 0, approvalRequired: false, retentionDays: 365, unansweredMinutes: 60, aiEnabled: false}), "INBOX_SETTINGS_CHANGED");
      const {settings} = await run(sdk.getInboxSettings, "agent-a", {organizationId: f.orgA});
      assert.equal(settings.revision, 1);
      assert.equal(settings.retentionDays, 365);
      assert.equal((await run(sdk.getInboxSettings, "owner-b", {organizationId: f.orgB})).settings, null, "another company has its own (absent) settings");
    });

    // --- 7A.4: channel connections, durable events, receipts, attachments ---------------------
    const ACCOUNT = `1000000${Date.now()}`.slice(0, 15);
    let connectionId;
    const connection = async () => (await run(sdk.listChannelConnections, "owner-a", {organizationId: f.orgA})).connections.find(row => key(row.id) === key(connectionId));

    it("keeps channel connections to administrators, one company per provider account, never verified or sending", async () => {
      const input = {organizationId: f.orgA, provider: sdk.ChannelProvider.WHATSAPP_CLOUD, displayName: "Test WhatsApp", externalAccountReference: ACCOUNT, credentialReference: "INBOX_TEST_WA_SECRET"};
      await assert.rejects(run(sdk.createChannelConnection, "agent-a", {...input, id: randomUUID()}), "agents cannot add channels");
      await assert.rejects(run(sdk.createChannelConnection, "manager-a", {...input, id: randomUUID()}), "managers cannot add channels");
      await forbidden(sdk.createChannelConnection, "owner-a", {...input, id: randomUUID(), provider: sdk.ChannelProvider.DEVELOPMENT_SIMULATOR});
      await forbidden(sdk.createChannelConnection, "owner-a", {...input, id: randomUUID(), credentialReference: "EAAG-a-pasted-token"});
      await forbidden(sdk.listChannelConnections, "owner-b", {organizationId: f.orgA});
      connectionId = randomUUID();
      await run(sdk.createChannelConnection, "owner-a", {...input, id: connectionId});
      let row = await connection();
      assert.equal(row.connectionStatus, "CONFIGURED", "configured is as far as Phase 7A goes");
      assert.equal(row.sendingEnabled, false);
      await assert.rejects(run(sdk.createChannelConnection, "owner-b", {...input, organizationId: f.orgB, id: randomUUID()}), "another company cannot claim the same provider account");

      await rejectsWith(run(sdk.updateChannelConnection, "admin-a", {organizationId: f.orgA, id: connectionId, expectedRevision: row.revision + 1, displayName: "Stale", externalAccountReference: ACCOUNT, credentialReference: "INBOX_TEST_WA_SECRET"}), "CHANNEL_CONNECTION_CHANGED");
      await run(sdk.setChannelConnectionEnabled, "admin-a", {organizationId: f.orgA, id: connectionId, expectedRevision: row.revision, enabled: false});
      row = await connection();
      await run(sdk.updateChannelConnection, "admin-a", {organizationId: f.orgA, id: connectionId, expectedRevision: row.revision, displayName: "Sales WhatsApp", externalAccountReference: ACCOUNT, credentialReference: "INBOX_TEST_WA_SECRET"});
      row = await connection();
      assert.equal(row.connectionStatus, "DISABLED", "editing a disabled channel keeps it disabled");
      await run(sdk.setChannelConnectionEnabled, "admin-a", {organizationId: f.orgA, id: connectionId, expectedRevision: row.revision, enabled: true});
      assert.equal((await connection()).connectionStatus, "CONFIGURED");

      const simulator = randomUUID();
      await server(sdk.createInboxSimulatorChannel, {organizationId: f.orgA, id: simulator, actorUid: "owner-a"});
      await rejectsWith(run(sdk.updateChannelConnection, "owner-a", {organizationId: f.orgA, id: simulator, expectedRevision: 1, displayName: "Renamed", externalAccountReference: "1234567", credentialReference: "INBOX_TEST_WA_SECRET"}), "CHANNEL_CONNECTION_CHANGED");
      await rejectsWith(run(sdk.setChannelConnectionEnabled, "owner-a", {organizationId: f.orgA, id: simulator, expectedRevision: 1, enabled: false}), "CHANNEL_CONNECTION_CHANGED");

      const lookup = await server(sdk.inboxWebhookConnection, {id: connectionId});
      assert.equal(key(lookup.connections[0].organizationId), key(f.orgA), "the webhook company comes from the connection row");
      await forbidden(sdk.inboxWebhookConnection, "owner-a", {id: connectionId});
    });

    it("records each event once, retries failures by compare-and-set, and applies receipts forward only", async () => {
      const event = {organizationId: f.orgA, hasConnection: true, channelConnectionId: connectionId, kind: "STATUS", payloadDigest: "0".repeat(64), normalizedJson: "{\"test\":true}", simulated: false};
      const eventId = randomUUID(), dedupKey = `status:${randomUUID()}`;
      await server(sdk.recordInboxEvent, {...event, id: eventId, dedupKey});
      await assert.rejects(server(sdk.recordInboxEvent, {...event, id: randomUUID(), dedupKey}), "a replayed event is refused by its key");
      await forbidden(sdk.recordInboxEvent, "owner-a", {...event, id: randomUUID(), dedupKey: `status:${randomUUID()}`});
      assert.ok((await connection()).lastEventAt, "the connection shows when it last had a verified event");

      const past = new Date(Date.now() - 60_000).toISOString();
      await server(sdk.failInboxEvent, {organizationId: f.orgA, id: eventId, expectedAttempts: 0, errorCode: "TEST", nextAttemptAt: past});
      const stale = await server(sdk.failInboxEvent, {organizationId: f.orgA, id: eventId, expectedAttempts: 0, errorCode: "TEST", nextAttemptAt: past});
      assert.equal(stale.inboxEvent_update, null, "a second worker with the old attempt count changes nothing");
      const pending = async () => (await server(sdk.pendingInboxEvents, {now: new Date().toISOString(), staleBefore: new Date(Date.now() - 120_000).toISOString(), limit: 100})).events.map(row => key(row.id));
      assert.ok((await pending()).includes(key(eventId)));
      await server(sdk.completeInboxEvent, {organizationId: f.orgA, id: eventId, status: sdk.InboxEventStatus.PROCESSED, errorCode: "UNMATCHED"});
      assert.ok(!(await pending()).includes(key(eventId)));
      const stored = (await dc.executeGraphql(`query S($org: UUID!, $id: UUID!) { inboxEvent(key: {organizationId: $org, id: $id}) { status attempts normalizedJson processedAt } }`, {variables: {org: f.orgA, id: eventId}})).data.inboxEvent;
      assert.equal(stored.status, "PROCESSED");
      assert.equal(stored.normalizedJson, null, "the normalized copy is removed once applied");

      // An outbound message as the Phase 7A.5 pipeline will store it (test setup only).
      const outbound = randomUUID();
      await dc.executeGraphql(`mutation O($org: UUID!, $id: UUID!, $conversation: UUID!, $connection: UUID!) { inboxMessage_insert(data: {organizationId: $org, id: $id, conversationId: $conversation,
        channelConnectionId: $connection, externalMessageId: "wamid.outbound-test", direction: OUTBOUND, messageType: TEXT, content: "Synthetic reply", deliveryStatus: SENT}) }`,
        {variables: {org: f.orgA, id: outbound, conversation: linked, connection: connectionId}});
      const found = (await server(sdk.inboxMessageByExternalId, {organizationId: f.orgA, channelConnectionId: connectionId, externalMessageId: "wamid.outbound-test"})).messages[0];
      assert.equal(found.deliveryStatus, "SENT");
      const apply = (expectedStatus, deliveryStatus, emitFailed = false, id = outbound) => server(sdk.applyInboxDeliveryStatus, {organizationId: f.orgA, id, conversationId: linked,
        expectedStatus, deliveryStatus, raw: deliveryStatus.toLowerCase(), providerTimestamp: null, emitFailed, simulated: false});
      await apply(sdk.InboxDeliveryStatus.SENT, sdk.InboxDeliveryStatus.DELIVERED);
      await rejectsWith(apply(sdk.InboxDeliveryStatus.SENT, sdk.InboxDeliveryStatus.READ), "INBOX_DELIVERY_CHANGED");
      await apply(sdk.InboxDeliveryStatus.DELIVERED, sdk.InboxDeliveryStatus.FAILED, true);
      assert.ok((await events(linked)).includes("inbox.message.failed"), "a failure is a workflow event in the same transaction");
      const inbound = (await run(sdk.listInboxMessages, "agent-a", {organizationId: f.orgA, conversationId: linked, limit: 30})).messages.find(row => row.direction === "INBOUND");
      await rejectsWith(apply(sdk.InboxDeliveryStatus.RECEIVED, sdk.InboxDeliveryStatus.READ, false, inbound.id), "INBOX_DELIVERY_CHANGED");
      await forbidden(sdk.applyInboxDeliveryStatus, "owner-a", {organizationId: f.orgA, id: outbound, conversationId: linked, expectedStatus: sdk.InboxDeliveryStatus.FAILED, deliveryStatus: sdk.InboxDeliveryStatus.READ, emitFailed: false, simulated: false});
    });

    it("opens attachments only for members who see the conversation, when stored and not blocked, and audits each access", async () => {
      const messages = (await run(sdk.listInboxMessages, "agent-a", {organizationId: f.orgA, conversationId: linked, limit: 30})).messages;
      const messageId = messages.find(row => row.direction === "INBOUND").id;
      const attachment = {organizationId: f.orgA, messageId, conversationId: linked, fileName: "brochure.pdf", mimeType: "application/pdf", sizeBytes: 1200, providerMediaId: null, scanStatus: sdk.InboxAttachmentScan.NOT_SCANNED};
      await rejectsWith(server(sdk.createInboxAttachment, {...attachment, id: randomUUID(), conversationId: unknown, storagePath: null}), "INBOX_MESSAGE_NOT_FOUND");
      const stored = randomUUID(), remote = randomUUID(), blocked = randomUUID();
      await server(sdk.createInboxAttachment, {...attachment, id: stored, storagePath: `organizations/${f.orgA}/inbox/attachments/${stored}.pdf`});
      await server(sdk.createInboxAttachment, {...attachment, id: remote, storagePath: null, providerMediaId: "MEDIA-TEST", sizeBytes: 0});
      await server(sdk.createInboxAttachment, {...attachment, id: blocked, storagePath: `organizations/${f.orgA}/inbox/attachments/${blocked}.pdf`, scanStatus: sdk.InboxAttachmentScan.BLOCKED});
      await forbidden(sdk.createInboxAttachment, "owner-a", {...attachment, id: randomUUID(), storagePath: null});

      const opened = await run(sdk.openInboxAttachment, "agent-a", {organizationId: f.orgA, conversationId: linked, id: stored});
      assert.equal(opened.file.attachment.storagePath, `organizations/${f.orgA}/inbox/attachments/${stored}.pdf`);
      const audits = (await dc.executeGraphql(`query A($org: UUID!, $id: UUID!) { auditLogs(where: {organizationId: {eq: $org}, targetId: {eq: $id}, action: {eq: INBOX_ATTACHMENT_ACCESSED}}) { actorUid } }`, {variables: {org: f.orgA, id: linked}})).data.auditLogs;
      assert.equal(audits.length, 1, "the access is audited");
      await rejectsWith(run(sdk.openInboxAttachment, "shared-agent", {organizationId: f.orgA, conversationId: linked, id: stored}), "INBOX_ATTACHMENT_NOT_FOUND");
      await rejectsWith(run(sdk.openInboxAttachment, "agent-a", {organizationId: f.orgA, conversationId: unknown, id: stored}), "INBOX_ATTACHMENT_NOT_FOUND");
      await forbidden(sdk.openInboxAttachment, "owner-b", {organizationId: f.orgA, conversationId: linked, id: stored});
      await rejectsWith(run(sdk.openInboxAttachment, "agent-a", {organizationId: f.orgA, conversationId: linked, id: remote}), "INBOX_ATTACHMENT_UNAVAILABLE");
      await rejectsWith(run(sdk.openInboxAttachment, "owner-a", {organizationId: f.orgA, conversationId: linked, id: blocked}), "INBOX_ATTACHMENT_UNAVAILABLE");
      const listed = (await run(sdk.listInboxMessages, "agent-a", {organizationId: f.orgA, conversationId: linked, limit: 30})).messages.find(row => key(row.id) === key(messageId));
      assert.equal(listed.attachments.length, 3);
    });

    // --- 7A.5: replies, approval, simulator-only delivery, assistant insights, workflows -------
    const reply = async (uid, conversationId, id) => (await run(sdk.listInboxReplies, uid, {organizationId: f.orgA, conversationId})).conversation.jobs.find(job => key(job.id) === key(id));
    const draft = async (uid, conversationId, content = "Thank you, the two-bedroom is still available. When would you like to view it?") => {
      const id = randomUUID();
      await run(sdk.createInboxReplyDraft, uid, {organizationId: f.orgA, id, conversationId, content});
      return id;
    };
    /** Draft → checked → waiting for approval, as the given member. */
    const pending = async (uid, conversationId) => {
      const id = await draft(uid, conversationId);
      await run(sdk.recordInboxReplyCheck, uid, {organizationId: f.orgA, id, expectedRevision: 1, valid: true, validationJson: "{\"valid\":true}"});
      await run(sdk.submitInboxReply, uid, {organizationId: f.orgA, id, expectedRevision: 2, approvalRequired: true, notificationId: randomUUID()});
      return id;
    };
    const decide = (uid, id, revision, approve, note = null) => run(sdk.decideInboxReply, uid, {organizationId: f.orgA, id, expectedRevision: revision, approve, note});
    let simulated, approvedReal;

    it("drafts, checks and approves replies on visible conversations, with separation of duties", async () => {
      const id = await draft("agent-a", linked);
      await rejectsWith(run(sdk.createInboxReplyDraft, "shared-agent", {organizationId: f.orgA, id: randomUUID(), conversationId: linked, content: "x"}), "INBOX_CONVERSATION_NOT_FOUND");
      await forbidden(sdk.createInboxReplyDraft, "owner-b", {organizationId: f.orgA, id: randomUUID(), conversationId: linked, content: "x"});
      await rejectsWith(run(sdk.listInboxReplies, "shared-agent", {organizationId: f.orgA, conversationId: linked}), "INBOX_CONVERSATION_NOT_FOUND");
      let job = await reply("agent-a", linked, id);
      assert.equal(job.stage, "DRAFT");
      assert.equal(job.source, "AGENT");
      assert.equal(job.lastEditedByUid, "agent-a");

      await rejectsWith(run(sdk.submitInboxReply, "agent-a", {organizationId: f.orgA, id, expectedRevision: 1, approvalRequired: true, notificationId: randomUUID()}), "INBOX_REPLY_CHANGED");
      await run(sdk.recordInboxReplyCheck, "agent-a", {organizationId: f.orgA, id, expectedRevision: 1, valid: false, validationJson: "{\"valid\":false}"});
      assert.equal((await reply("agent-a", linked, id)).stage, "DRAFT", "a failed check keeps the draft");
      await run(sdk.recordInboxReplyCheck, "agent-a", {organizationId: f.orgA, id, expectedRevision: 2, valid: true, validationJson: "{\"valid\":true}"});
      await rejectsWith(run(sdk.submitInboxReply, "agent-a", {organizationId: f.orgA, id, expectedRevision: 3, approvalRequired: false, notificationId: randomUUID()}), "INBOX_SETTINGS_CHANGED");
      await run(sdk.submitInboxReply, "agent-a", {organizationId: f.orgA, id, expectedRevision: 3, approvalRequired: true, notificationId: randomUUID()});
      job = await reply("agent-a", linked, id);
      assert.equal(job.stage, "PENDING_APPROVAL");
      assert.ok(job.approvalRequestedAt);

      await rejectsWith(decide("agent-a", id, 4, true), "INBOX_APPROVER_REQUIRED");
      await rejectsWith(decide("manager-a", id, 4, true), "INBOX_REPLY_CHANGED", "a manager cannot approve a conversation they cannot see");
      await forbidden(sdk.decideInboxReply, "admin-a", {organizationId: f.orgA, id, expectedRevision: 4, approve: false, note: null});
      await decide("admin-a", id, 4, true);
      job = await reply("agent-a", linked, id);
      assert.equal(job.stage, "APPROVED");
      assert.equal(job.approvedByUid, "admin-a");
      assert.equal(job.selfApproved, false);
      await rejectsWith(run(sdk.updateInboxReplyDraft, "agent-a", {organizationId: f.orgA, id, expectedRevision: 5, content: "Changed after approval", versionsJson: "[]"}), "INBOX_REPLY_CHANGED");
      approvedReal = id;

      // Authors and last editors cannot approve their own reply; an owner can, recorded as a self-approval.
      const own = await pending("admin-a", linked);
      await rejectsWith(decide("admin-a", own, 3, true), "INBOX_SELF_APPROVAL");
      const edited = await draft("agent-a", linked);
      await run(sdk.updateInboxReplyDraft, "admin-a", {organizationId: f.orgA, id: edited, expectedRevision: 1, content: "Edited by the administrator", versionsJson: "[{\"content\":\"x\"}]"});
      const afterEdit = await reply("admin-a", linked, edited);
      assert.equal(afterEdit.lastEditedByUid, "admin-a");
      assert.equal(afterEdit.edited, true);
      await run(sdk.recordInboxReplyCheck, "admin-a", {organizationId: f.orgA, id: edited, expectedRevision: 2, valid: true, validationJson: "{}"});
      await run(sdk.submitInboxReply, "admin-a", {organizationId: f.orgA, id: edited, expectedRevision: 3, approvalRequired: true, notificationId: randomUUID()});
      await rejectsWith(decide("admin-a", edited, 4, true), "INBOX_SELF_APPROVAL");
      await decide("admin-a", edited, 4, false, "Please add the viewing time.");
      const returned = await reply("agent-a", linked, edited);
      assert.equal(returned.stage, "DRAFT", "a rejected reply returns to its author");
      assert.equal(returned.approvalNote, "Please add the viewing time.");
      const owners = await pending("owner-a", linked);
      await decide("owner-a", owners, 3, true);
      assert.equal((await reply("owner-a", linked, owners)).selfApproved, true);

      await rejectsWith(run(sdk.cancelInboxReply, "shared-agent", {organizationId: f.orgA, id: own, expectedRevision: 3}), "INBOX_REPLY_CHANGED");
      await rejectsWith(run(sdk.cancelInboxReply, "agent-a", {organizationId: f.orgA, id: own, expectedRevision: 3}), "INBOX_REPLY_FORBIDDEN", "an agent cannot cancel someone else's reply");
      await run(sdk.cancelInboxReply, "admin-a", {organizationId: f.orgA, id: own, expectedRevision: 3});
      assert.equal((await reply("admin-a", linked, own)).stage, "CANCELLED");
      const audits = (await dc.executeGraphql(`query A($org: UUID!, $id: UUID!) { auditLogs(where: {organizationId: {eq: $org}, targetId: {eq: $id}, action: {eq: INBOX_OUTBOUND_CHANGED}}) { actorUid } }`, {variables: {org: f.orgA, id}})).data.auditLogs;
      assert.ok(audits.length >= 3, "drafting, submission and the decision are audited");
    });

    it("queues only simulated conversations on the developer simulator, and marks SENT only on acknowledgement", async () => {
      const queue = (id, conversationId, connection, content, revision) => server(sdk.queueInboxReply, {organizationId: f.orgA, id, expectedRevision: revision, conversationId, channelConnectionId: connection,
        content, actorUid: "agent-a", messageId: randomUUID(), pendingExternalId: `pending:${id}`, recipientIdentity: PHONE, preview: content.slice(0, 50)});
      const real = await reply("agent-a", linked, approvedReal);
      await rejectsWith(queue(approvedReal, linked, connectionId, real.content, real.revision), "INBOX_SENDING_DISABLED");
      await forbidden(sdk.queueInboxReply, "owner-a", {organizationId: f.orgA, id: approvedReal, expectedRevision: real.revision, conversationId: linked, channelConnectionId: connectionId, content: real.content,
        actorUid: "owner-a", messageId: randomUUID(), pendingExternalId: "x", recipientIdentity: PHONE, preview: "x"});

      const simulator = key((await server(sdk.inboxSimulatorChannel, {organizationId: f.orgA, actorUid: "owner-a"})).connections[0].id);
      simulated = randomUUID();
      await create({conversationId: simulated, channelConnectionId: simulator, customerIdentity: "+447700900613", senderIdentity: "+447700900613", assignedMembershipId: f.memberAgentA, simulated: true});
      const id = await pending("agent-a", simulated);
      await decide("admin-a", id, 3, true);
      const job = await reply("agent-a", simulated, id);
      await rejectsWith(queue(id, simulated, simulator, "Different text", job.revision), "INBOX_REPLY_CHANGED", "only the approved text can be queued");
      const messageId = randomUUID();
      await server(sdk.queueInboxReply, {organizationId: f.orgA, id, expectedRevision: job.revision, conversationId: simulated, channelConnectionId: simulator, content: job.content,
        actorUid: "agent-a", messageId, pendingExternalId: `pending:${id}`, recipientIdentity: "+447700900613", preview: "Thank you"});
      const queued = await reply("agent-a", simulated, id);
      assert.equal(queued.stage, "QUEUED", "queueing is not sending");
      let outbound = (await run(sdk.listInboxMessages, "agent-a", {organizationId: f.orgA, conversationId: simulated, limit: 5})).messages.find(row => key(row.id) === key(messageId));
      assert.equal(outbound.deliveryStatus, "QUEUED");
      assert.equal(outbound.direction, "OUTBOUND");
      await rejectsWith(queue(id, simulated, simulator, job.content, job.revision), "INBOX_REPLY_CHANGED", "a reply is queued once");

      await forbidden(sdk.acknowledgeInboxReply, "owner-a", {organizationId: f.orgA, id, conversationId: simulated, messageId, providerMessageId: "simwamid.x", actorUid: "owner-a"});
      await server(sdk.acknowledgeInboxReply, {organizationId: f.orgA, id, conversationId: simulated, messageId, providerMessageId: `simwamid.${id}`, actorUid: "agent-a"});
      assert.equal((await reply("agent-a", simulated, id)).stage, "SENT");
      outbound = (await server(sdk.inboxMessageByExternalId, {organizationId: f.orgA, channelConnectionId: simulator, externalMessageId: `simwamid.${id}`})).messages[0];
      assert.equal(outbound.deliveryStatus, "SENT", "receipts find the message by the provider's ID");
      await rejectsWith(server(sdk.acknowledgeInboxReply, {organizationId: f.orgA, id, conversationId: simulated, messageId, providerMessageId: "simwamid.again", actorUid: "agent-a"}), "INBOX_REPLY_CHANGED");

      const failing = await pending("agent-a", simulated);
      await decide("admin-a", failing, 3, true);
      const failingJob = await reply("agent-a", simulated, failing);
      const failedMessage = randomUUID();
      await server(sdk.queueInboxReply, {organizationId: f.orgA, id: failing, expectedRevision: failingJob.revision, conversationId: simulated, channelConnectionId: simulator, content: failingJob.content,
        actorUid: "agent-a", messageId: failedMessage, pendingExternalId: `pending:${failing}`, recipientIdentity: "+447700900613", preview: "x"});
      await server(sdk.failInboxReply, {organizationId: f.orgA, id: failing, conversationId: simulated, messageId: failedMessage, reason: "Refused by the test adapter", actorUid: "agent-a"});
      const failed = await reply("agent-a", simulated, failing);
      assert.equal(failed.stage, "FAILED");
      assert.equal(failed.failureReason, "Refused by the test adapter");
      assert.ok((await events(simulated)).includes("inbox.message.failed"));

      // An opted-out customer cannot be sent to, even on the simulator.
      const stop = randomUUID();
      await create({conversationId: stop, channelConnectionId: simulator, customerIdentity: "+447700900614", senderIdentity: "+447700900614", assignedMembershipId: f.memberAgentA, simulated: true, optedOut: true, content: "STOP"});
      const blocked = await pending("agent-a", stop);
      await decide("admin-a", blocked, 3, true);
      const blockedJob = await reply("agent-a", stop, blocked);
      await rejectsWith(queue(blocked, stop, simulator, blockedJob.content, blockedJob.revision), "INBOX_SENDING_DISABLED");
    });

    it("stores Claude insights and drafts only through the server, visible like their conversation", async () => {
      const insight = {organizationId: f.orgA, conversationId: linked, actorUid: "agent-a", insightJson: "{\"summary\":\"Synthetic\"}", unverifiedCount: 1, coveredUntil: null,
        model: "test-model", promptVersion: "inbox-assistant-1", source: "CLAUDE"};
      const id = randomUUID(), draftJobId = randomUUID();
      await forbidden(sdk.saveInboxAiInsight, "agent-a", {...insight, id, hasDraft: false, draftJobId: null, draftContent: ""});
      await rejectsWith(server(sdk.saveInboxAiInsight, {...insight, id: randomUUID(), actorUid: "owner-b", hasDraft: false, draftJobId: null, draftContent: ""}), "ACTIVE_MEMBERSHIP_REQUIRED");
      await server(sdk.saveInboxAiInsight, {...insight, id, hasDraft: true, draftJobId, draftContent: "Thank you for your message."});
      await assert.rejects(server(sdk.saveInboxAiInsight, {...insight, id, hasDraft: false, draftJobId: null, draftContent: ""}), "a repeated workflow step finds the same insight");
      const view = (await run(sdk.listInboxReplies, "agent-a", {organizationId: f.orgA, conversationId: linked})).conversation;
      assert.equal(key(view.insights[0].id), key(id));
      const job = view.jobs.find(row => key(row.id) === key(draftJobId));
      assert.equal(job.stage, "DRAFT", "Claude's reply is only a draft");
      assert.equal(job.source, "CLAUDE");
      assert.equal(job.edited, false);
      await rejectsWith(run(sdk.listInboxReplies, "shared-agent", {organizationId: f.orgA, conversationId: linked}), "INBOX_CONVERSATION_NOT_FOUND");
      const facts = await server(sdk.inboxReplyFacts, {organizationId: f.orgA, id: draftJobId});
      assert.equal(key(facts.insight[0].id), key(id), "the server finds the analysis behind a draft");
      assert.equal(facts.job.conversation.channel, "WHATSAPP");
      await forbidden(sdk.inboxReplyFacts, "owner-a", {organizationId: f.orgA, id: draftJobId});
      const restrictions = await server(sdk.inboxContactRestrictions, {organizationId: f.orgA, identity: PHONE});
      assert.equal(restrictions.emails.length, 0);
    });

    it("gives workflows conversation facts and unanswered candidates, and guards approved reassignments", async () => {
      const {conversation} = await run(sdk.automationFacts, "owner-a", {organizationId: f.orgA, since: new Date(0).toISOString(), hasLead: false, hasListing: false, hasViewing: false, hasFollowUp: false,
        hasWorkTask: false, hasContact: false, conversationId: simulated, hasConversation: true});
      assert.equal(conversation.simulated, true);
      assert.equal(key(conversation.assignedMembershipId), key(f.memberAgentA));
      const window = await server(sdk.unansweredInboxCandidates, {organizationId: f.orgA, from: new Date(Date.now() - 3_600_000).toISOString(), to: new Date(Date.now() + 1000).toISOString(), limit: 50});
      const row = window.conversations.find(item => key(item.id) === key(simulated));
      assert.ok(row && row.lastOutboundAt && Date.parse(row.lastOutboundAt) >= Date.parse(row.lastInboundAt), "the sent reply answered it, so the server skips it");
      assert.equal((await server(sdk.inboxUnansweredMinutes, {organizationId: f.orgA})).settings.unansweredMinutes, 60);
      await forbidden(sdk.unansweredInboxCandidates, "owner-a", {organizationId: f.orgA, from: new Date(0).toISOString(), to: new Date().toISOString(), limit: 5});

      const reassign = {organizationId: f.orgA, conversationId: simulated, expectedMembershipId: f.memberAgentA, toMembershipId: f.memberSharedA, approvalId: randomUUID(), executionId: randomUUID(),
        historyId: randomUUID(), eventId: randomUUID(), originalEventId: randomUUID(), originWorkflowId: randomUUID(), chainDepth: 1};
      await rejectsWith(run(sdk.automationReassignConversation, "agent-a", reassign), "EXECUTOR_NOT_AUTHORIZED");
      await rejectsWith(run(sdk.automationReassignConversation, "owner-a", reassign), "AUTOMATION_APPROVAL_CHANGED", "nothing moves without an approved approval");
      await rejectsWith(run(sdk.automationReassignConversation, "owner-a", {...reassign, expectedMembershipId: f.memberSharedA}), "AUTOMATION_TARGET_CHANGED");
      const state = (await server(sdk.automationConversationState, {organizationId: f.orgA, id: simulated})).conversation;
      assert.equal(key(state.assignedMembershipId), key(f.memberAgentA), "the conversation is unchanged");
    });

    // --- 7A.6: opt-outs and retention ----------------------------------------------------------
    it("puts a real customer's STOP on the do-not-contact list in the same transaction, once, and re-activates it on a repeat", async () => {
      const optOutId = randomUUID();
      const stop = (conversationId, identity, extra) => server(sdk.appendInboxMessage, {organizationId: f.orgA, conversationId, channelConnectionId: null, messageId: randomUUID(), externalMessageId: `wamid.stop-${randomUUID()}`,
        messageType: sdk.InboxMessageType.TEXT, content: "STOP", senderIdentity: identity, recipientIdentity: null, providerTimestamp: null, preview: "STOP", simulated: false, optedOut: true,
        optOutId, optOutIdentity: identity, ...extra});
      const numbers = async () => (await dc.executeGraphql(`query S($org: UUID!, $n: String!) { communicationSuppressions(where: {organizationId: {eq: $org}, normalizedNumber: {eq: $n}}) { id scope reason source createdByUid withdrawnAt } }`,
        {variables: {org: f.orgA, n: PHONE}})).data.communicationSuppressions;
      await stop(linked, PHONE, {suppressNumber: true});
      let rows = await numbers();
      assert.equal(rows.length, 1);
      assert.deepEqual({scope: rows[0].scope, reason: rows[0].reason, source: rows[0].source, createdByUid: rows[0].createdByUid ?? null}, {scope: "ALL", reason: "OPT_OUT", source: "INBOX_OPT_OUT", createdByUid: null}, "the customer opted out themselves");
      assert.equal((await run(sdk.getInboxConversation, "agent-a", {organizationId: f.orgA, id: linked})).conversation.optedOut, true);
      assert.equal((await server(sdk.inboxContactRestrictions, {organizationId: f.orgA, identity: PHONE})).numbers.length, 1, "replies to this number are refused");
      await dc.executeGraphql(`mutation W($org: UUID!, $id: UUID!) { communicationSuppression_update(key: {organizationId: $org, id: $id}, data: {withdrawnAt_expr: "request.time", withdrawalReason: "Test withdrawal"}) }`, {variables: {org: f.orgA, id: rows[0].id}});
      await stop(linked, PHONE, {suppressNumber: true});
      rows = await numbers();
      assert.equal(rows.length, 1, "a repeated STOP reuses the same entry");
      assert.equal(rows[0].withdrawnAt ?? null, null, "and makes it active again");
      assert.equal((await server(sdk.inboxContactRestrictions, {organizationId: f.orgB, identity: PHONE})).numbers.length, 0, "another company's list is separate");

      const mail = randomUUID(), address = "optout.customer@example.test";
      await create({conversationId: mail, channel: sdk.InboxChannel.EMAIL, customerIdentity: address, senderIdentity: address, content: "Hello"});
      await stop(mail, address, {suppressEmail: true, content: "unsubscribe", optOutId: randomUUID()});
      assert.equal((await server(sdk.inboxContactRestrictions, {organizationId: f.orgA, identity: address})).emails.length, 1, "email opt-outs go to the inbox email list");
      await forbidden(sdk.appendInboxMessage, "owner-a", {organizationId: f.orgA, conversationId: mail, channelConnectionId: null, messageId: randomUUID(), externalMessageId: "x", messageType: sdk.InboxMessageType.TEXT,
        simulated: false, optedOut: true, suppressEmail: true, optOutId: randomUUID(), optOutIdentity: address});
    });

    it("removes message content past retention for one company, keeping a record that each message existed", async () => {
      const old = new Date(Date.now() - 40 * 86_400_000).toISOString(), before = new Date(Date.now() - 30 * 86_400_000).toISOString();
      const conversation = randomUUID(), oldMessage = randomUUID(), newMessage = randomUUID(), file = randomUUID(), insight = randomUUID();
      await create({conversationId: conversation, customerIdentity: "+447700900615", senderIdentity: "+447700900615", messageId: newMessage, content: "Recent message"});
      await dc.executeGraphql(`mutation O($org: UUID!, $c: UUID!, $m: UUID!, $f: UUID!, $i: UUID!, $at: Timestamp!, $path: String!) {
        inboxMessage_insert(data: {organizationId: $org, id: $m, conversationId: $c, externalMessageId: "wamid.old-retention", direction: INBOUND, messageType: DOCUMENT, content: "Old private text", deliveryStatus: RECEIVED, createdAt: $at})
        inboxAttachment_insert(data: {organizationId: $org, id: $f, messageId: $m, conversationId: $c, fileName: "old.pdf", mimeType: "application/pdf", sizeBytes: 10, storagePath: $path, scanStatus: NOT_SCANNED})
        inboxAiInsight_insert(data: {organizationId: $org, id: $i, conversationId: $c, insightJson: "{}", model: "test", promptVersion: "x", source: "CLAUDE", createdByUid: "owner-a", createdAt: $at}) }`,
        {variables: {org: f.orgA, c: conversation, m: oldMessage, f: file, i: insight, at: old, path: `organizations/${f.orgA}/inbox/attachments/${file}.pdf`}});
      const rules = (await sdk.inboxRetentionRules(dc)).data.rules;
      assert.ok(rules.some(row => key(row.organizationId) === key(f.orgA) && row.retentionDays === 365), "companies with their own rules are listed");
      await forbidden(sdk.inboxRetentionRules, "owner-a", undefined);
      const candidates = (await server(sdk.inboxRetentionCandidates, {organizationId: f.orgA, before, limit: 100})).messages;
      const found = candidates.find(row => key(row.id) === key(oldMessage));
      assert.ok(found && found.attachments[0].storagePath.endsWith(`${file}.pdf`));
      assert.ok(!candidates.some(row => key(row.id) === key(newMessage)), "recent messages are not candidates");
      assert.ok(!(await server(sdk.inboxRetentionCandidates, {excluded: [f.orgA], before, limit: 100})).messages.some(row => key(row.id) === key(oldMessage)), "the default pass skips companies with their own rules");
      await forbidden(sdk.applyInboxRetention, "owner-a", {organizationId: f.orgA, ids: [oldMessage], before});
      await server(sdk.applyInboxRetention, {organizationId: f.orgB, ids: [oldMessage], before});
      const read = async () => (await dc.executeGraphql(`query R($org: UUID!, $m: UUID!, $n: UUID!, $f: UUID!, $i: UUID!) { old: inboxMessage(key: {organizationId: $org, id: $m}) {content contentRedactedAt}
        recent: inboxMessage(key: {organizationId: $org, id: $n}) {content contentRedactedAt} file: inboxAttachment(key: {organizationId: $org, id: $f}) {storagePath deletedAt} insight: inboxAiInsight(key: {organizationId: $org, id: $i}) {id} }`,
        {variables: {org: f.orgA, m: oldMessage, n: newMessage, f: file, i: insight}})).data;
      assert.equal((await read()).old.content, "Old private text", "another company's pass changes nothing here");
      const applied = await server(sdk.applyInboxRetention, {organizationId: f.orgA, ids: [oldMessage, newMessage], before});
      assert.equal(applied.messages, 1, "only the message past retention");
      const after = await read();
      assert.equal(after.old.content, null);
      assert.ok(after.old.contentRedactedAt, "the message itself remains, marked as removed");
      assert.equal(after.recent.content, "Recent message");
      assert.equal(after.file.storagePath, null);
      assert.ok(after.file.deletedAt);
      assert.equal(after.insight, null, "old Claude analyses are deleted");
      assert.equal((await server(sdk.applyInboxRetention, {organizationId: f.orgA, ids: [oldMessage], before})).messages, 0, "a repeated pass changes nothing");
    });

    // --- 7B.1: verified WhatsApp connections, sending switch, business-started conversations, live queueing ---
    it("verifies a WhatsApp connection and turns sending on only through server operations, and undoes both when it is edited", async () => {
      let row = await connection();
      assert.equal(row.connectionStatus, "CONFIGURED");
      const checked = (extra = {}) => server(sdk.markChannelConnectionChecked, {organizationId: f.orgA, id: connectionId, expectedRevision: row.revision, actorUid: "owner-a", verified: true,
        verifiedName: "Fictional Realty", verifiedDisplayNumber: "+44 7700 900001", errorCode: null, ...extra});
      await forbidden(sdk.markChannelConnectionChecked, "owner-a", {organizationId: f.orgA, id: connectionId, expectedRevision: row.revision, actorUid: "owner-a", verified: true});
      await rejectsWith(checked({actorUid: "agent-a"}), "INBOX_ADMIN_REQUIRED");
      await rejectsWith(server(sdk.setChannelConnectionSending, {organizationId: f.orgA, id: connectionId, expectedRevision: row.revision, actorUid: "owner-a", enabled: true}), "CHANNEL_CONNECTION_CHANGED");
      await checked();
      row = await connection();
      assert.equal(row.connectionStatus, "VERIFIED");
      assert.ok(row.verifiedAt);
      assert.equal(row.verifiedName, "Fictional Realty");
      assert.equal(row.sendingEnabled, false, "verifying does not turn sending on");
      await rejectsWith(checked({expectedRevision: row.revision - 1}), "CHANNEL_CONNECTION_CHANGED");
      await rejectsWith(server(sdk.setChannelConnectionSending, {organizationId: f.orgA, id: connectionId, expectedRevision: row.revision, actorUid: "manager-a", enabled: true}), "INBOX_ADMIN_REQUIRED");
      await forbidden(sdk.setChannelConnectionSending, "owner-a", {organizationId: f.orgA, id: connectionId, expectedRevision: row.revision, actorUid: "owner-a", enabled: true});
      await server(sdk.setChannelConnectionSending, {organizationId: f.orgA, id: connectionId, expectedRevision: row.revision, actorUid: "owner-a", enabled: true});
      row = await connection();
      assert.equal(row.sendingEnabled, true);
      const check = await server(sdk.channelConnectionForCheck, {organizationId: f.orgA, id: connectionId, actorUid: "owner-a"});
      assert.equal(check.connection.credentialReference, "INBOX_TEST_WA_SECRET");
      await rejectsWith(server(sdk.channelConnectionForCheck, {organizationId: f.orgA, id: connectionId, actorUid: "agent-a"}), "INBOX_ADMIN_REQUIRED");
      assert.equal((await server(sdk.channelConnectionForCheck, {organizationId: f.orgB, id: connectionId, actorUid: "owner-b"})).connection, null, "another company cannot read it");
    });

    let started;
    it("starts business conversations and queues real replies only on a verified connection with sending on", async () => {
      const identity = "+447700900616";
      const start = (actorUid, id = randomUUID()) => server(sdk.startWhatsAppConversation, {organizationId: f.orgA, id, channelConnectionId: connectionId, actorUid, customerIdentity: identity,
        externalThreadId: `wa:${identity}`, contactId: null, leadId: null});
      await rejectsWith(start("agent-a"), "INBOX_ADMIN_REQUIRED");
      started = randomUUID();
      await start("owner-a", started);
      const conversation = (await run(sdk.getInboxConversation, "owner-a", {organizationId: f.orgA, id: started})).conversation;
      assert.equal(conversation.lastInboundAt ?? null, null, "the customer has not written: only a template can be sent");
      assert.equal(key(conversation.assignedMembershipId), key(f.memberOwnerA), "it belongs to the member who started it");
      await assert.rejects(start("owner-a"), "one conversation per customer thread");

      await forbidden(sdk.createInboxReplyDraft, "owner-a", {organizationId: f.orgA, id: randomUUID(), conversationId: started, content: "x", templateName: "Not A Template"});
      const approved = async templateName => {
        const id = randomUUID();
        await run(sdk.createInboxReplyDraft, "owner-a", {organizationId: f.orgA, id, conversationId: started, content: 'WhatsApp template "hello_world" (en_US)', templateName});
        await run(sdk.recordInboxReplyCheck, "owner-a", {organizationId: f.orgA, id, expectedRevision: 1, valid: true, validationJson: "{}"});
        await run(sdk.submitInboxReply, "owner-a", {organizationId: f.orgA, id, expectedRevision: 2, approvalRequired: true, notificationId: randomUUID()});
        await decide("admin-a", id, 3, true);
        return {id, job: await reply("owner-a", started, id)};
      };
      const queue = (id, job, messageId, extra = {}) => server(sdk.queueInboxReply, {organizationId: f.orgA, id, expectedRevision: job.revision, conversationId: started, channelConnectionId: connectionId,
        content: job.content, actorUid: "owner-a", messageId, pendingExternalId: `pending:${id}`, recipientIdentity: identity, preview: "template", simulated: false, template: true, ...extra});
      const first = await approved("hello_world:en_US");
      assert.equal(first.job.templateName, "hello_world:en_US");
      await rejectsWith(queue(first.id, first.job, randomUUID(), {simulated: true}), "INBOX_SENDING_DISABLED", "a real conversation is not queued as simulated");
      const messageId = randomUUID();
      await queue(first.id, first.job, messageId);
      let message = (await run(sdk.listInboxMessages, "owner-a", {organizationId: f.orgA, conversationId: started, limit: 5})).messages.find(item => key(item.id) === key(messageId));
      assert.equal(message.deliveryStatus, "QUEUED");
      assert.equal(message.messageType, "TEMPLATE");
      assert.equal(message.simulated, false);
      await server(sdk.acknowledgeInboxReply, {organizationId: f.orgA, id: first.id, conversationId: started, messageId, providerMessageId: "wamid.E2E-LIVE-1", actorUid: "owner-a"});
      assert.equal((await reply("owner-a", started, first.id)).stage, "SENT");
      assert.equal((await server(sdk.inboxMessageByExternalId, {organizationId: f.orgA, channelConnectionId: connectionId, externalMessageId: "wamid.E2E-LIVE-1"})).messages[0].deliveryStatus, "SENT", "Meta's receipts will find it");

      const refused = await approved("hello_world:en_US");
      const refusedMessage = randomUUID();
      await queue(refused.id, refused.job, refusedMessage);
      await server(sdk.failInboxReply, {organizationId: f.orgA, id: refused.id, conversationId: started, messageId: refusedMessage, reason: "Meta refused it (131026): undeliverable", actorUid: "owner-a", simulated: false});
      assert.equal((await reply("owner-a", started, refused.id)).stage, "FAILED");
      const failed = (await dc.executeGraphql(`query E($org: UUID!, $id: UUID!) { automationEvents(where: {organizationId: {eq: $org}, targetId: {eq: $id}, triggerType: {eq: "inbox.message.failed"}}) { origin } }`, {variables: {org: f.orgA, id: started}})).data.automationEvents;
      assert.deepEqual(failed.map(row => row.origin), ["PROVIDER"]);

      // Editing the channel undoes verification and sending: nothing more can be queued until it is checked again.
      const later = await approved("hello_world:en_US");
      let row = await connection();
      await run(sdk.updateChannelConnection, "owner-a", {organizationId: f.orgA, id: connectionId, expectedRevision: row.revision, displayName: "Sales WhatsApp", externalAccountReference: ACCOUNT,
        credentialReference: "INBOX_TEST_WA_SECRET", accessTokenReference: "INBOX_TEST_WA_TOKEN"});
      row = await connection();
      assert.deepEqual({status: row.connectionStatus, sending: row.sendingEnabled, verifiedAt: row.verifiedAt ?? null, token: row.accessTokenReference}, {status: "CONFIGURED", sending: false, verifiedAt: null, token: "INBOX_TEST_WA_TOKEN"});
      await rejectsWith(queue(later.id, later.job, randomUUID()), "INBOX_SENDING_DISABLED");
      await rejectsWith(server(sdk.startWhatsAppConversation, {organizationId: f.orgA, id: randomUUID(), channelConnectionId: connectionId, actorUid: "owner-a", customerIdentity: "+447700900617",
        externalThreadId: "wa:+447700900617", contactId: null, leadId: null}), "INBOX_SENDING_DISABLED");
      await forbidden(sdk.createChannelConnection, "owner-a", {organizationId: f.orgA, id: randomUUID(), provider: sdk.ChannelProvider.WHATSAPP_CLOUD, displayName: "Pasted token", externalAccountReference: "12345678",
        credentialReference: "INBOX_X_SECRET", accessTokenReference: "EAAG-a-pasted-token"});

      // A failed check marks the channel ERROR with sending off.
      await server(sdk.markChannelConnectionChecked, {organizationId: f.orgA, id: connectionId, expectedRevision: row.revision, actorUid: "admin-a", verified: false, errorCode: "190"});
      row = await connection();
      assert.deepEqual({status: row.connectionStatus, sending: row.sendingEnabled}, {status: "ERROR", sending: false});
    });

    // --- 7B.2: the WhatsApp Business Account, real customers (OWNER only) and template values ---
    it("stores the WhatsApp Business Account, lets only an OWNER switch a channel to real customers, and turns that off with any change", async () => {
      let row = await connection();
      const update = (extra = {}) => run(sdk.updateChannelConnection, "owner-a", {organizationId: f.orgA, id: connectionId, expectedRevision: row.revision, displayName: "Sales WhatsApp", externalAccountReference: ACCOUNT,
        credentialReference: "INBOX_TEST_WA_SECRET", accessTokenReference: "INBOX_TEST_WA_TOKEN", businessAccountReference: "1800453871250567", ...extra});
      await forbidden(sdk.updateChannelConnection, "owner-a", {organizationId: f.orgA, id: connectionId, expectedRevision: row.revision, displayName: "Sales WhatsApp", externalAccountReference: ACCOUNT,
        credentialReference: "INBOX_TEST_WA_SECRET", accessTokenReference: "INBOX_TEST_WA_TOKEN", businessAccountReference: "not-digits"});
      await update();
      row = await connection();
      assert.equal(row.businessAccountReference, "1800453871250567");
      const verify = async () => {
        row = await connection();
        await server(sdk.markChannelConnectionChecked, {organizationId: f.orgA, id: connectionId, expectedRevision: row.revision, actorUid: "owner-a", verified: true, verifiedName: "Fictional Realty", verifiedDisplayNumber: null, errorCode: null});
        row = await connection();
        await server(sdk.setChannelConnectionSending, {organizationId: f.orgA, id: connectionId, expectedRevision: row.revision, actorUid: "owner-a", enabled: true});
        row = await connection();
      };
      const live = (actorUid, enabled) => server(sdk.setChannelConnectionLiveSending, {organizationId: f.orgA, id: connectionId, expectedRevision: row.revision, actorUid, enabled});
      await rejectsWith(live("owner-a", true), "CHANNEL_CONNECTION_CHANGED", "not before it is verified with sending on");
      await verify();
      assert.equal(row.liveSending, false, "verifying and sending on never reach real customers by themselves");
      await forbidden(sdk.setChannelConnectionLiveSending, "owner-a", {organizationId: f.orgA, id: connectionId, expectedRevision: row.revision, actorUid: "owner-a", enabled: true});
      await rejectsWith(live("admin-a", true), "INBOX_OWNER_REQUIRED", "an administrator cannot switch to real customers");
      await rejectsWith(live("manager-a", true), "INBOX_OWNER_REQUIRED");
      await rejectsWith(live("owner-b", true), "INBOX_OWNER_REQUIRED", "nor another company's owner");
      await live("owner-a", true);
      row = await connection();
      assert.deepEqual({live: row.liveSending, by: row.liveSendingBy?.displayName ?? null, at: Boolean(row.liveSendingAt)}, {live: true, by: row.liveSendingBy?.displayName ?? null, at: true});
      assert.ok(row.liveSendingBy, "who switched it is recorded");
      const audit = (await dc.executeGraphql(`query A($org: UUID!, $id: UUID!) { auditLogs(where: {organizationId: {eq: $org}, targetId: {eq: $id}}, orderBy: [{createdAt: DESC}], limit: 1) { metadata } }`,
        {variables: {org: f.orgA, id: connectionId}})).data.auditLogs;
      assert.match(JSON.stringify(audit), /LIVE_SENDING_ON/);
      // An administrator may turn it off (for safety).
      await live("admin-a", false);
      row = await connection();
      assert.equal(row.liveSending, false);
      // Sending off, an edit, disabling or a failed check each turn it off again.
      const resets = [
        async () => server(sdk.setChannelConnectionSending, {organizationId: f.orgA, id: connectionId, expectedRevision: row.revision, actorUid: "admin-a", enabled: false}),
        async () => update(),
        async () => server(sdk.markChannelConnectionChecked, {organizationId: f.orgA, id: connectionId, expectedRevision: row.revision, actorUid: "admin-a", verified: false, errorCode: "190"}),
        async () => run(sdk.setChannelConnectionEnabled, "owner-a", {organizationId: f.orgA, id: connectionId, expectedRevision: row.revision, enabled: false}),
      ];
      for (const reset of resets) {
        row = await connection();
        if (row.connectionStatus === "DISABLED") { await run(sdk.setChannelConnectionEnabled, "owner-a", {organizationId: f.orgA, id: connectionId, expectedRevision: row.revision, enabled: true}); }
        await verify();
        await live("owner-a", true);
        row = await connection();
        assert.equal(row.liveSending, true);
        await reset();
        row = await connection();
        assert.equal(row.liveSending, false, "any change turns real customers off");
      }
      row = await connection();
      if (row.connectionStatus === "DISABLED") await run(sdk.setChannelConnectionEnabled, "owner-a", {organizationId: f.orgA, id: connectionId, expectedRevision: row.revision, enabled: true});
      // The server reads the channel for templates; never for another company.
      const forTemplates = await server(sdk.whatsAppTemplateConnection, {organizationId: f.orgA, id: connectionId});
      assert.equal(forTemplates.connection.businessAccountReference, "1800453871250567");
      assert.equal((await server(sdk.whatsAppTemplateConnection, {organizationId: f.orgB, id: connectionId})).connection, null);
      await forbidden(sdk.whatsAppTemplateConnection, "owner-a", {organizationId: f.orgA, id: connectionId});
    });

    it("downloads each WhatsApp file once at a time (compare-and-set), stops after a final failure, and never touches a stored file", async () => {
      const conversationId = randomUUID(), messageId = randomUUID();
      await create({conversationId, messageId, channelConnectionId: connectionId, messageType: sdk.InboxMessageType.IMAGE, content: null, preview: "Photo"});
      const attachment = (name, mediaId) => {
        const id = randomUUID();
        return server(sdk.createInboxAttachment, {organizationId: f.orgA, id, messageId, conversationId, fileName: name, mimeType: "image/jpeg", sizeBytes: 0, storagePath: null, providerMediaId: mediaId,
          scanStatus: sdk.InboxAttachmentScan.NOT_SCANNED}).then(() => id);
      };
      const photo = await attachment("villa.jpg", `MEDIA-${randomUUID().slice(0, 8)}`);
      const disguised = await attachment("invoice.jpg", `MEDIA-${randomUUID().slice(0, 8)}`);
      const now = new Date().toISOString(), since = new Date(Date.now() - 86_400_000).toISOString();
      const pending = async () => (await server(sdk.pendingInboxMedia, {now: new Date(Date.now() + 1000).toISOString(), since, limit: 100})).attachments.map(item => key(item.id));
      await forbidden(sdk.pendingInboxMedia, "owner-a", {now, since, limit: 5});
      assert.ok((await pending()).includes(key(photo)), "a received WhatsApp file is due for download");
      const row = (await server(sdk.pendingInboxMedia, {now: new Date(Date.now() + 1000).toISOString(), since, limit: 100})).attachments.find(item => key(item.id) === key(photo));
      assert.equal(row.message.conversation.channelConnection.accessTokenReference, "INBOX_TEST_WA_TOKEN", "with the channel's token secret name (read on the server)");
      const claim = (id, expectedAttempts, minutes = 1) => server(sdk.claimInboxMediaFetch, {organizationId: f.orgA, id, expectedAttempts, nextAttemptAt: new Date(Date.now() + minutes * 60_000).toISOString()});
      await forbidden(sdk.claimInboxMediaFetch, "owner-a", {organizationId: f.orgA, id: photo, expectedAttempts: 0, nextAttemptAt: now});
      await claim(photo, 0);
      await rejectsWith(claim(photo, 0), "INBOX_MEDIA_BUSY", "a second worker cannot take the same file");
      assert.equal((await pending()).includes(key(photo)), false, "a claimed file waits until its next try");
      await server(sdk.storeInboxMedia, {organizationId: f.orgA, id: photo, storagePath: `organizations/${f.orgA}/inbox/attachments/${photo}.jpg`, mimeType: "image/jpeg", sizeBytes: 2048, fileName: "villa.jpg"});
      const stored = (await run(sdk.listInboxMessages, "owner-a", {organizationId: f.orgA, conversationId, limit: 5})).messages[0].attachments.find(item => key(item.id) === key(photo));
      assert.deepEqual({size: stored.sizeBytes, path: Boolean(stored.storagePath), error: stored.mediaError ?? null}, {size: 2048, path: true, error: null});
      await rejectsWith(claim(photo, 1), "INBOX_MEDIA_BUSY", "a stored file is never fetched again");
      await server(sdk.failInboxMedia, {organizationId: f.orgA, id: photo, error: "TYPE_NOT_ALLOWED", final: true});
      assert.equal((await run(sdk.listInboxMessages, "owner-a", {organizationId: f.orgA, conversationId, limit: 5})).messages[0].attachments.find(item => key(item.id) === key(photo)).mediaError ?? null, null, "nor marked failed");
      // A final failure records why and ends the tries; a passing one only records why.
      await claim(disguised, 0, -1);
      await server(sdk.failInboxMedia, {organizationId: f.orgA, id: disguised, error: "META_131052", final: false});
      assert.ok((await pending()).includes(key(disguised)), "a passing failure is tried again when due");
      await server(sdk.failInboxMedia, {organizationId: f.orgA, id: disguised, error: "TYPE_NOT_ALLOWED", final: true});
      assert.equal((await pending()).includes(key(disguised)), false, "a final failure is never tried again");
      const failed = (await run(sdk.listInboxMessages, "owner-a", {organizationId: f.orgA, conversationId, limit: 5})).messages[0].attachments.find(item => key(item.id) === key(disguised));
      assert.deepEqual({error: failed.mediaError, attempts: failed.mediaFetchAttempts, path: failed.storagePath ?? null}, {error: "TYPE_NOT_ALLOWED", attempts: 99, path: null});
      await forbidden(sdk.storeInboxMedia, "owner-a", {organizationId: f.orgA, id: disguised, storagePath: "x", mimeType: "image/jpeg", sizeBytes: 1, fileName: "x"});
    });

    it("deletes only replies that were never sent, for their author or an approver, and saves Claude's reply from the message box once, as Claude's", async () => {
      const conversationId = randomUUID();
      await create({conversationId, assignedMembershipId: f.memberAgentA});
      const draft = async (uid, content) => {
        const id = randomUUID();
        await run(sdk.createInboxReplyDraft, uid, {organizationId: f.orgA, id, conversationId, content});
        return id;
      };
      const remove = (uid, id, expectedRevision = 1) => run(sdk.deleteInboxReply, uid, {organizationId: f.orgA, id, expectedRevision});
      const agentDraft = await draft("agent-a", "Thank you, I will call you this afternoon.");
      const adminDraft = await draft("admin-a", "We have two options for you.");
      await rejectsWith(remove("agent-a", adminDraft), "INBOX_REPLY_FORBIDDEN", "an agent deletes only their own replies");
      await rejectsWith(remove("shared-agent", agentDraft), "INBOX_REPLY_CHANGED", "nobody who cannot see the conversation");
      await rejectsWith(remove("owner-b", agentDraft), "", "nor another company");
      await rejectsWith(remove("agent-a", agentDraft, 2), "INBOX_REPLY_CHANGED", "a stale revision is refused");
      await remove("agent-a", agentDraft);
      await remove("admin-a", adminDraft);
      assert.equal((await run(sdk.listInboxReplies, "admin-a", {organizationId: f.orgA, conversationId})).conversation.jobs.length, 0, "both are gone");
      const sentDraft = await draft("admin-a", "Already on its way.");
      await dc.executeGraphql(`mutation S($org: UUID!, $id: UUID!) { outboundMessageJob_update(key: {organizationId: $org, id: $id}, data: {stage: SENT}) }`, {variables: {org: f.orgA, id: sentDraft}});
      await rejectsWith(remove("owner-a", sentDraft), "INBOX_REPLY_CHANGED", "a sent reply is the record of what the customer received");

      // Claude's reply, taken into the message box: saved once, as Claude's, edited or not.
      const insightId = randomUUID();
      await dc.executeGraphql(`mutation I($org: UUID!, $id: UUID!, $conversation: UUID!, $json: String!) { inboxAiInsight_insert(data: {organizationId: $org, id: $id, conversationId: $conversation, insightJson: $json,
        model: "test", promptVersion: "inbox-assistant-1", source: "CLAUDE", createdByUid: "agent-a"}) }`, {variables: {org: f.orgA, id: insightId, conversation: conversationId, json: JSON.stringify({reply: "Hello, the villa is available."})}});
      const fromBox = (jobId, content, edited) => server(sdk.createClaudeReplyFromInsight, {organizationId: f.orgA, insightId, conversationId, jobId, actorUid: "agent-a", content, edited});
      await forbidden(sdk.createClaudeReplyFromInsight, "agent-a", {organizationId: f.orgA, insightId, conversationId, jobId: randomUUID(), actorUid: "agent-a", content: "x", edited: false});
      await rejectsWith(server(sdk.createClaudeReplyFromInsight, {organizationId: f.orgB, insightId, conversationId, jobId: randomUUID(), actorUid: "owner-b", content: "x", edited: false}), "INBOX_INSIGHT_USED", "not from another company");
      const jobId = randomUUID();
      await fromBox(jobId, "Hello, the villa is available. Shall we book a viewing?", true);
      const job = await reply("agent-a", conversationId, jobId);
      assert.deepEqual({source: job.source, edited: job.edited, stage: job.stage, author: job.createdByUid}, {source: "CLAUDE", edited: true, stage: "DRAFT", author: "agent-a"});
      assert.equal(key((await server(sdk.inboxInsightDraft, {organizationId: f.orgA, conversationId, id: insightId})).insight.draftJobId), key(jobId), "the analysis now points at its draft");
      await rejectsWith(fromBox(randomUUID(), "Again", false), "INBOX_INSIGHT_USED", "one draft per analysis");
    });

    it("keeps a template reply's filled blanks with its rendered text, and only with a template", async () => {
      const id = randomUUID();
      await forbidden(sdk.createInboxReplyDraft, "owner-a", {organizationId: f.orgA, id: randomUUID(), conversationId: started, content: "Hi Layla", templateParamsJson: "{\"BODY:1\":\"Layla\"}"});
      await forbidden(sdk.createInboxReplyDraft, "owner-a", {organizationId: f.orgA, id: randomUUID(), conversationId: started, content: "Hi", templateName: "viewing_followup:en_US", templateParamsJson: "x".repeat(4001)});
      await run(sdk.createInboxReplyDraft, "owner-a", {organizationId: f.orgA, id, conversationId: started, content: "Hi Layla, would Tuesday suit you?", templateName: "viewing_followup:en_US",
        templateParamsJson: "{\"BODY:1\":\"Layla\",\"BODY:2\":\"Tuesday\"}"});
      const job = await reply("owner-a", started, id);
      assert.deepEqual({name: job.templateName, values: JSON.parse(job.templateParamsJson), content: job.content},
        {name: "viewing_followup:en_US", values: {"BODY:1": "Layla", "BODY:2": "Tuesday"}, content: "Hi Layla, would Tuesday suit you?"});
      const facts = (await server(sdk.inboxReplyFacts, {organizationId: f.orgA, id})).job;
      assert.equal(facts.templateParamsJson, job.templateParamsJson, "the server reads them back to send");
    });

    // --- 7C.1: mailboxes connected through OAuth (company and personal) ---
    const mailboxSave = (extra = {}) => server(sdk.saveMailboxConnection, {organizationId: f.orgA, id: randomUUID(), actorUid: "owner-a", provider: sdk.ChannelProvider.GMAIL, personal: false, ownerMembershipId: null,
      existing: false, displayName: "Sales mailbox", mailbox: `sales.${randomUUID().slice(0, 8)}@agency.example.test`, tokenCiphertext: "v1:sealed-test-value", tokenKeyId: "k1", scopes: "gmail.readonly gmail.send", historyId: "1000", ...extra});
    const mailboxRow = async (id, uid = "owner-a") => (await server(sdk.mailboxForAction, {organizationId: f.orgA, id, actorUid: uid})).mailbox;
    let companyMailbox, companyAddress, personalMailbox;
    it("connects company mailboxes for owners and administrators and personal mailboxes for their owner only; one company per mailbox", async () => {
      await forbidden(sdk.saveMailboxConnection, "owner-a", {organizationId: f.orgA, id: randomUUID(), actorUid: "owner-a", provider: sdk.ChannelProvider.GMAIL, personal: false, existing: false,
        displayName: "x", mailbox: "x@agency.example.test", tokenCiphertext: "x", tokenKeyId: "k1", scopes: "x", historyId: "1"});
      await forbidden(sdk.mailboxesOverview, "owner-a", {organizationId: f.orgA, actorUid: "owner-a"});
      await forbidden(sdk.mailboxForAction, "owner-a", {organizationId: f.orgA, id: randomUUID(), actorUid: "owner-a"});
      await rejectsWith(mailboxSave({actorUid: "agent-a"}), "INBOX_MAILBOX_NOT_ALLOWED");
      await rejectsWith(mailboxSave({actorUid: "manager-a"}), "INBOX_MAILBOX_NOT_ALLOWED");
      await rejectsWith(mailboxSave({organizationId: f.orgB, actorUid: "owner-a"}), "INBOX_MAILBOX_NOT_ALLOWED", "a member of another company cannot connect here");
      companyMailbox = randomUUID();
      companyAddress = `sales.${randomUUID().slice(0, 8)}@agency.example.test`;
      await mailboxSave({id: companyMailbox, mailbox: companyAddress, actorUid: "admin-a"});
      let row = await mailboxRow(companyMailbox);
      assert.deepEqual({status: row.connectionStatus, sending: row.sendingEnabled, owner: row.ownerMembershipId ?? null, token: row.account.tokenCiphertext, cursor: row.account.historyId, state: row.account.syncState},
        {status: "VERIFIED", sending: false, owner: null, token: "v1:sealed-test-value", cursor: "1000", state: "ACTIVE"});
      await assert.rejects(mailboxSave({organizationId: f.orgB, actorUid: "owner-b", mailbox: companyAddress}), "the same mailbox cannot be connected to another company");

      await rejectsWith(mailboxSave({actorUid: "agent-a", personal: true, ownerMembershipId: f.memberManagerA}), "INBOX_MAILBOX_NOT_ALLOWED", "nobody connects a mailbox as someone else");
      personalMailbox = randomUUID();
      await mailboxSave({id: personalMailbox, actorUid: "agent-a", personal: true, ownerMembershipId: f.memberAgentA, displayName: "Agent's Gmail", mailbox: "agent.a@gmail.example.test"});
      row = await mailboxRow(personalMailbox);
      assert.equal(key(row.ownerMembershipId), key(f.memberAgentA));
      assert.equal(row.ownerMembership.userProfileUid, "agent-a");
      // Reconnecting a personal mailbox is the owner's alone, and keeps it personal.
      await rejectsWith(mailboxSave({id: personalMailbox, existing: true, actorUid: "manager-a", personal: true, ownerMembershipId: f.memberManagerA, mailbox: "agent.a@gmail.example.test"}), "INBOX_MAILBOX_CHANGED");
      await rejectsWith(mailboxSave({id: personalMailbox, existing: true, actorUid: "owner-a", personal: false, mailbox: "agent.a@gmail.example.test"}), "INBOX_MAILBOX_CHANGED", "a personal mailbox cannot be taken over as a company one");
      await mailboxSave({id: personalMailbox, existing: true, actorUid: "agent-a", personal: true, ownerMembershipId: f.memberAgentA, mailbox: "agent.a@gmail.example.test", tokenCiphertext: "v1:new-grant", historyId: "1000"});
      assert.equal((await mailboxRow(personalMailbox)).account.tokenCiphertext, "v1:new-grant");

      const overview = await server(sdk.mailboxesOverview, {organizationId: f.orgA, actorUid: "agent-a"});
      assert.ok(overview.mailboxes.some(item => key(item.id) === key(personalMailbox)));
      assert.equal(JSON.stringify(overview).includes("v1:"), false, "the overview never carries the grant");
      const channels = (await run(sdk.listChannelConnections, "owner-a", {organizationId: f.orgA})).connections;
      assert.equal(channels.some(item => key(item.id) === key(personalMailbox)), false, "personal mailboxes are not company channels");
      const company = channels.find(item => key(item.id) === key(companyMailbox));
      await rejectsWith(run(sdk.updateChannelConnection, "owner-a", {organizationId: f.orgA, id: companyMailbox, expectedRevision: company.revision, displayName: "Renamed", externalAccountReference: companyAddress, credentialReference: null}),
        "CHANNEL_CONNECTION_CHANGED", "an OAuth mailbox is never edited through the manual channel form");
    });

    it("turns mailbox sending on only for its manager, off for administrators too, and disconnects by wiping the grant", async () => {
      let row = await mailboxRow(personalMailbox);
      const sending = (id, uid, enabled, revision) => server(sdk.setMailboxSending, {organizationId: f.orgA, id, actorUid: uid, expectedRevision: revision, enabled});
      await rejectsWith(sending(personalMailbox, "owner-a", true, row.revision), "INBOX_MAILBOX_CHANGED", "not even the owner of the company may send as an agent");
      await sending(personalMailbox, "agent-a", true, row.revision);
      row = await mailboxRow(personalMailbox);
      assert.equal(row.sendingEnabled, true);
      await rejectsWith(sending(personalMailbox, "manager-a", false, row.revision), "INBOX_MAILBOX_CHANGED");
      await sending(personalMailbox, "admin-a", false, row.revision);
      row = await mailboxRow(personalMailbox);
      assert.equal(row.sendingEnabled, false);
      let company = await mailboxRow(companyMailbox);
      await rejectsWith(sending(companyMailbox, "manager-a", true, company.revision), "INBOX_MAILBOX_CHANGED");
      await rejectsWith(sending(companyMailbox, "agent-a", true, company.revision), "INBOX_MAILBOX_CHANGED");
      await sending(companyMailbox, "owner-a", true, company.revision);
      company = await mailboxRow(companyMailbox);
      assert.equal(company.sendingEnabled, true);

      const disconnect = (id, uid, revision) => server(sdk.disconnectMailbox, {organizationId: f.orgA, id, actorUid: uid, expectedRevision: revision});
      await rejectsWith(disconnect(personalMailbox, "manager-a", row.revision), "INBOX_MAILBOX_CHANGED");
      await rejectsWith(disconnect(personalMailbox, "owner-b", row.revision), "INBOX_MAILBOX_CHANGED");
      await rejectsWith(disconnect(personalMailbox, "agent-a", row.revision - 1), "INBOX_MAILBOX_CHANGED", "a stale revision is refused");
      await disconnect(personalMailbox, "admin-a", row.revision);
      row = await mailboxRow(personalMailbox);
      assert.deepEqual({status: row.connectionStatus, sending: row.sendingEnabled, token: row.account.tokenCiphertext ?? null, keyId: row.account.tokenKeyId ?? null, state: row.account.syncState},
        {status: "DISABLED", sending: false, token: null, keyId: null, state: "DISCONNECTED"});
      await rejectsWith(sending(personalMailbox, "agent-a", true, row.revision), "INBOX_MAILBOX_CHANGED", "a disconnected mailbox cannot send");
      await disconnect(companyMailbox, "owner-a", company.revision);
      assert.equal((await mailboxRow(companyMailbox)).sendingEnabled, false);
      // Reconnecting later reuses the same connection (its conversations stay linked).
      await mailboxSave({id: personalMailbox, existing: true, actorUid: "agent-a", personal: true, ownerMembershipId: f.memberAgentA, mailbox: "agent.a@gmail.example.test", tokenCiphertext: "v1:third", historyId: "1200"});
      row = await mailboxRow(personalMailbox);
      assert.deepEqual({status: row.connectionStatus, sending: row.sendingEnabled, token: row.account.tokenCiphertext, state: row.account.syncState}, {status: "VERIFIED", sending: false, token: "v1:third", state: "ACTIVE"});
    });

    it("syncs each mailbox under one lease at a time; a refused grant needs a reconnect, and a departed owner's mailbox is retired", async () => {
      const now = () => new Date().toISOString();
      const later = minutes => new Date(Date.now() + minutes * 60_000).toISOString();
      await forbidden(sdk.dueMailboxes, "owner-a", {now: now(), limit: 5});
      const due = (await server(sdk.dueMailboxes, {now: later(1), limit: 50})).accounts;
      assert.ok(due.some(item => key(item.id) === key(personalMailbox)), "a connected mailbox is due straight away");
      assert.equal(due.some(item => key(item.id) === key(companyMailbox)), false, "a disconnected mailbox is never synced");
      const leaseA = randomUUID(), leaseB = randomUUID();
      const claim = lease => server(sdk.claimMailboxSync, {organizationId: f.orgA, id: personalMailbox, leaseId: lease, now: now(), leaseUntil: later(4)});
      await claim(leaseA);
      await rejectsWith(claim(leaseB), "INBOX_MAILBOX_BUSY", "a second worker cannot take a mailbox being synced");
      assert.equal((await server(sdk.dueMailboxes, {now: later(1), limit: 50})).accounts.some(item => key(item.id) === key(personalMailbox)), false);
      await rejectsWith(server(sdk.finishMailboxSync, {organizationId: f.orgA, id: personalMailbox, leaseId: leaseB, historyId: "9999", backfilled: true, nextSyncAt: later(1), imported: false}),
        "INBOX_MAILBOX_BUSY", "only the lease holder finishes");
      await server(sdk.finishMailboxSync, {organizationId: f.orgA, id: personalMailbox, leaseId: leaseA, historyId: "1300", backfilled: true, nextSyncAt: later(1), imported: true});
      let row = await mailboxRow(personalMailbox);
      assert.deepEqual({cursor: row.account.historyId, state: row.account.syncState}, {cursor: "1300", state: "ACTIVE"});
      // "Check now": the owner or an administrator; nobody else.
      await rejectsWith(server(sdk.requestMailboxSync, {organizationId: f.orgA, id: personalMailbox, actorUid: "manager-a"}), "INBOX_MAILBOX_CHANGED");
      await server(sdk.requestMailboxSync, {organizationId: f.orgA, id: personalMailbox, actorUid: "agent-a"});
      assert.ok((await server(sdk.mailboxSyncRow, {organizationId: f.orgA, id: personalMailbox})).account.nextSyncAt <= now());

      // A refused grant: retried no more until reconnected, and sending is off.
      const leaseC = randomUUID();
      await claim(leaseC);
      await server(sdk.failMailboxSync, {organizationId: f.orgA, id: personalMailbox, leaseId: leaseC, errorCode: "GOOGLE_invalid_grant", nextSyncAt: later(1), needsReconnect: true});
      row = await mailboxRow(personalMailbox);
      assert.deepEqual({status: row.connectionStatus, sending: row.sendingEnabled, state: row.account.syncState}, {status: "ERROR", sending: false, state: "NEEDS_RECONNECT"});
      assert.equal((await server(sdk.dueMailboxes, {now: later(10), limit: 50})).accounts.some(item => key(item.id) === key(personalMailbox)), false);
      await rejectsWith(server(sdk.retireMailbox, {organizationId: f.orgA, id: personalMailbox}), "INBOX_MAILBOX_CHANGED", "an active owner's mailbox is never retired");

      // A personal mailbox of a member who is no longer active: retired, its grant wiped.
      const departed = randomUUID();
      await dc.executeGraphql(`mutation M($org: UUID!, $id: UUID!, $owner: UUID!) { channelConnection_insert(data: {organizationId: $org, id: $id, provider: GMAIL, displayName: "Former agent", externalAccountReference: "former.agent@gmail.example.test",
        connectionStatus: VERIFIED, ownerMembershipId: $owner, createdByUid: "owner-a"}) inboxMailboxAccount_insert(data: {organizationId: $org, id: $id, channelConnectionId: $id, tokenCiphertext: "v1:former", tokenKeyId: "k1", nextSyncAt_expr: "request.time"}) }`,
        {variables: {org: f.orgA, id: departed, owner: f.memberSuspendedA}});
      await server(sdk.retireMailbox, {organizationId: f.orgA, id: departed});
      const retired = (await server(sdk.mailboxSyncRow, {organizationId: f.orgA, id: departed})).account;
      assert.deepEqual({token: retired.tokenCiphertext ?? null, state: retired.syncState, status: retired.channelConnection.connectionStatus}, {token: null, state: "DISCONNECTED", status: "DISABLED"});
    });

    it("queues email replies only on a connected mailbox with sending on, and from a personal mailbox only for its owner", async () => {
      const mailbox = randomUUID();
      await mailboxSave({id: mailbox, mailbox: `queue.${randomUUID().slice(0, 8)}@agency.example.test`});
      const personal = randomUUID();
      // A second agent's personal mailbox (the fixture's shared agent), so the owner rule can be checked against agent-a.
      await mailboxSave({id: personal, actorUid: "shared-agent", personal: true, ownerMembershipId: f.memberSharedA, mailbox: `shared.agent.${randomUUID().slice(0, 6)}@gmail.example.test`});
      const emailConversation = async connectionId => {
        const conversationId = randomUUID();
        await create({conversationId, channelConnectionId: connectionId, channel: sdk.InboxChannel.EMAIL, customerIdentity: "email.customer@example.test", senderIdentity: "email.customer@example.test",
          externalThreadId: `gmail:${randomUUID()}`, externalMessageId: `gmail-${randomUUID()}`, assignedMembershipId: f.memberAgentA, content: "Is the villa available?", preview: "Is the villa available?"});
        return conversationId;
      };
      const approvedOn = async (conversationId, author = "agent-a") => {
        const id = randomUUID();
        await run(sdk.createInboxReplyDraft, author, {organizationId: f.orgA, id, conversationId, content: "Yes, it is. Shall we book a viewing?"});
        await run(sdk.recordInboxReplyCheck, author, {organizationId: f.orgA, id, expectedRevision: 1, valid: true, validationJson: "{}"});
        await run(sdk.submitInboxReply, author, {organizationId: f.orgA, id, expectedRevision: 2, approvalRequired: true, notificationId: randomUUID()});
        await decide("admin-a", id, 3, true);
        return {id, job: await reply("owner-a", conversationId, id)};
      };
      const queue = (conversationId, connectionId, approved, actorUid) => server(sdk.queueInboxReply, {organizationId: f.orgA, id: approved.id, expectedRevision: approved.job.revision, conversationId, channelConnectionId: connectionId,
        content: approved.job.content, actorUid, messageId: randomUUID(), pendingExternalId: `pending:${approved.id}`, recipientIdentity: "email.customer@example.test", preview: "Yes", simulated: false, template: false});

      const companyThread = await emailConversation(mailbox);
      const first = await approvedOn(companyThread);
      await rejectsWith(queue(companyThread, mailbox, first, "agent-a"), "INBOX_SENDING_DISABLED", "sending is off until turned on");
      const row = await mailboxRow(mailbox);
      await server(sdk.setMailboxSending, {organizationId: f.orgA, id: mailbox, actorUid: "owner-a", expectedRevision: row.revision, enabled: true});
      await queue(companyThread, mailbox, first, "agent-a");
      assert.equal((await reply("owner-a", companyThread, first.id)).stage, "QUEUED", "any member who may see the conversation sends from a company mailbox");

      const personalThread = await emailConversation(personal);
      const personalRow = await mailboxRow(personal, "shared-agent");
      await server(sdk.setMailboxSending, {organizationId: f.orgA, id: personal, actorUid: "shared-agent", expectedRevision: personalRow.revision, enabled: true});
      const second = await approvedOn(personalThread);
      await rejectsWith(queue(personalThread, personal, second, "agent-a"), "INBOX_SENDING_DISABLED", "nobody sends from someone else's personal mailbox");
      await rejectsWith(queue(personalThread, personal, second, "owner-a"), "INBOX_SENDING_DISABLED", "not even the company owner");
      await queue(personalThread, personal, second, "shared-agent");
      assert.equal((await reply("owner-a", personalThread, second.id)).stage, "QUEUED");
    });

    it("keeps an email's cleaned HTML for members who may see the conversation, written only by the server and cleared by retention", async () => {
      const conversationId = randomUUID(), messageId = randomUUID();
      await create({conversationId, messageId, channel: sdk.InboxChannel.EMAIL, customerIdentity: "html.customer@example.test", senderIdentity: "html.customer@example.test",
        externalThreadId: `gmail:${randomUUID()}`, externalMessageId: `gmail-${randomUUID()}`, assignedMembershipId: f.memberAgentA, content: "Order #1", preview: "Order #1"});
      const html = (uid, extra = {}) => run(sdk.getInboxMessageHtml, uid, {organizationId: f.orgA, conversationId, id: messageId, ...extra});
      let seen = await html("agent-a");
      assert.equal(seen.message.contentHtmlBytes ?? null, null, "not looked up yet");
      await forbidden(sdk.setInboxMessageHtml, "owner-a", {organizationId: f.orgA, id: messageId, html: "<p>x</p>", bytes: 8});
      await server(sdk.setInboxMessageHtml, {organizationId: f.orgA, id: messageId, html: "<p>Order <b>#1</b></p>", bytes: 21});
      seen = await html("agent-a");
      assert.deepEqual({html: seen.message.contentHtml, bytes: seen.message.contentHtmlBytes}, {html: "<p>Order <b>#1</b></p>", bytes: 21});
      assert.equal((await list("agent-a", {})).conversations.length >= 1, true);
      await rejectsWith(html("manager-a"), "INBOX_CONVERSATION_NOT_FOUND", "a member who may not see the conversation never gets its HTML");
      await rejectsWith(run(sdk.getInboxMessageHtml, "owner-b", {organizationId: f.orgA, conversationId, id: messageId}), "INBOX_CONVERSATION_NOT_FOUND");
      // Retention removes the formatted version with the text.
      await server(sdk.applyInboxRetention, {organizationId: f.orgA, ids: [messageId], before: new Date(Date.now() + 60_000).toISOString()});
      seen = await html("owner-a");
      assert.deepEqual({html: seen.message.contentHtml ?? null, removed: Boolean(seen.message.contentRedactedAt)}, {html: null, removed: true});
      await server(sdk.setInboxMessageHtml, {organizationId: f.orgA, id: messageId, html: "<p>back</p>", bytes: 11});
      assert.equal((await html("owner-a")).message.contentHtml ?? null, null, "removed content is never written back");
    });

    // --- 7C.2: Microsoft 365 / Outlook mailboxes ---
    it("Microsoft 365 mailboxes follow the mailbox rules; a rotated grant replaces only the exact one read; imports are recognised per mailbox", async () => {
      const id = randomUUID(), address = `outlook.${randomUUID().slice(0, 8)}@agency.example.test`;
      await rejectsWith(mailboxSave({id, mailbox: address, provider: sdk.ChannelProvider.MICROSOFT_365, actorUid: "agent-a"}), "INBOX_MAILBOX_NOT_ALLOWED", "only owners and administrators connect company mailboxes");
      await mailboxSave({id, mailbox: address, provider: sdk.ChannelProvider.MICROSOFT_365, scopes: "mail.read mail.send user.read", historyId: "2026-11-12T09:00:00Z", tokenCiphertext: "v1:outlook-one"});
      let row = await mailboxRow(id);
      assert.deepEqual({provider: row.provider, status: row.connectionStatus, sending: row.sendingEnabled, cursor: row.account.historyId},
        {provider: "MICROSOFT_365", status: "VERIFIED", sending: false, cursor: "2026-11-12T09:00:00Z"});
      assert.ok((await server(sdk.mailboxesOverview, {organizationId: f.orgA, actorUid: "owner-a"})).mailboxes.some(item => key(item.id) === key(id)), "listed with the mailboxes");
      // Never a manual channel: it cannot be created or edited through the channel form.
      await rejectsWith(run(sdk.createChannelConnection, "owner-a", {organizationId: f.orgA, id: randomUUID(), provider: sdk.ChannelProvider.MICROSOFT_365, displayName: "Manual mailbox", externalAccountReference: "manual@agency.example.test", credentialReference: "INBOX_E2E_MAILBOX"}), "");
      const listed = (await run(sdk.listChannelConnections, "owner-a", {organizationId: f.orgA})).connections.find(item => key(item.id) === key(id));
      await rejectsWith(run(sdk.updateChannelConnection, "owner-a", {organizationId: f.orgA, id, expectedRevision: listed.revision, displayName: "Renamed", externalAccountReference: address, credentialReference: null}),
        "CHANNEL_CONNECTION_CHANGED", "an OAuth mailbox is never edited through the manual channel form");

      // Microsoft hands back a new refresh token as it is used: stored only over the exact grant that was read.
      const rotate = (previousCiphertext, tokenCiphertext) => server(sdk.updateMailboxToken, {organizationId: f.orgA, id, previousCiphertext, tokenCiphertext, tokenKeyId: "k1"});
      await forbidden(sdk.updateMailboxToken, "owner-a", {organizationId: f.orgA, id, previousCiphertext: "v1:outlook-one", tokenCiphertext: "v1:browser", tokenKeyId: "k1"});
      await rotate("v1:stale", "v1:late");
      assert.equal((await mailboxRow(id)).account.tokenCiphertext, "v1:outlook-one", "a refresh based on an older grant (for example before a reconnect) changes nothing");
      await rotate("v1:outlook-one", "v1:outlook-two");
      assert.equal((await mailboxRow(id)).account.tokenCiphertext, "v1:outlook-two");
      await server(sdk.updateMailboxToken, {organizationId: f.orgB, id, previousCiphertext: "v1:outlook-two", tokenCiphertext: "v1:other-company", tokenKeyId: "k1"});
      assert.equal((await mailboxRow(id)).account.tokenCiphertext, "v1:outlook-two", "scoped to its company");

      // Imported messages are recognised per mailbox (so a sync does not fetch them again).
      const conversationId = randomUUID(), graphId = `AAkALg-${randomUUID()}`;
      await create({conversationId, channelConnectionId: id, channel: sdk.InboxChannel.EMAIL, customerIdentity: "outlook.customer@example.test", senderIdentity: "outlook.customer@example.test",
        externalThreadId: `m365:${randomUUID()}`, externalMessageId: graphId, assignedMembershipId: f.memberAgentA, content: "Hello from Outlook", preview: "Hello from Outlook"});
      await forbidden(sdk.knownMailboxMessages, "owner-a", {organizationId: f.orgA, channelConnectionId: id, externalMessageIds: [graphId]});
      const known = await server(sdk.knownMailboxMessages, {organizationId: f.orgA, channelConnectionId: id, externalMessageIds: [graphId, "AAkALg-not-imported"]});
      assert.deepEqual(known.messages.map(item => item.externalMessageId), [graphId]);
      assert.deepEqual((await server(sdk.knownMailboxMessages, {organizationId: f.orgA, channelConnectionId: companyMailbox, externalMessageIds: [graphId]})).messages, [], "another mailbox's messages are not this one's");
      assert.deepEqual((await server(sdk.knownMailboxMessages, {organizationId: f.orgB, channelConnectionId: id, externalMessageIds: [graphId]})).messages, [], "nor another company's");

      // Replies queue only once sending is on, like Gmail.
      const draft = randomUUID();
      await run(sdk.createInboxReplyDraft, "agent-a", {organizationId: f.orgA, id: draft, conversationId, content: "Thank you, the villa is available."});
      await run(sdk.recordInboxReplyCheck, "agent-a", {organizationId: f.orgA, id: draft, expectedRevision: 1, valid: true, validationJson: "{}"});
      await run(sdk.submitInboxReply, "agent-a", {organizationId: f.orgA, id: draft, expectedRevision: 2, approvalRequired: true, notificationId: randomUUID()});
      await decide("admin-a", draft, 3, true);
      const job = await reply("owner-a", conversationId, draft);
      const queue = () => server(sdk.queueInboxReply, {organizationId: f.orgA, id: draft, expectedRevision: job.revision, conversationId, channelConnectionId: id, content: job.content, actorUid: "agent-a",
        messageId: randomUUID(), pendingExternalId: `pending:${draft}`, recipientIdentity: "outlook.customer@example.test", preview: "Thank you", simulated: false, template: false});
      await rejectsWith(queue(), "INBOX_SENDING_DISABLED", "sending is off until turned on");
      row = await mailboxRow(id);
      await server(sdk.setMailboxSending, {organizationId: f.orgA, id, actorUid: "owner-a", expectedRevision: row.revision, enabled: true});
      await queue();
      assert.equal((await reply("owner-a", conversationId, draft)).stage, "QUEUED");

      // Disconnecting wipes the grant, and a late refresh cannot bring it back.
      row = await mailboxRow(id);
      await server(sdk.disconnectMailbox, {organizationId: f.orgA, id, actorUid: "owner-a", expectedRevision: row.revision});
      await rotate("v1:outlook-two", "v1:after-disconnect");
      row = await mailboxRow(id);
      assert.deepEqual({token: row.account.tokenCiphertext ?? null, state: row.account.syncState, sending: row.sendingEnabled}, {token: null, state: "DISCONNECTED", sending: false});
    });
  });
}
