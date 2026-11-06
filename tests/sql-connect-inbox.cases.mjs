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
  });
}
