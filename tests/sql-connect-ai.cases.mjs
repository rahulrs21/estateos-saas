import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { before, describe, it } from "node:test";

/**
 * Phase 6A AI Copilot storage, ownership, tenant isolation and allowances,
 * exercised against the SQL Connect emulator with real stored operations.
 * Calls without a uid use the Admin identity exactly as the web server does
 * for the NO_ACCESS operations; everything else impersonates a member.
 */
export function registerAiCases({sdk, run, forbidden, dc}) {
  describe("Phase 6A AI Copilot conversations, usage and allowances", {concurrency: false}, () => {
    const suffix = randomUUID();
    const owner = `ai-owner-${suffix}`, admin = `ai-admin-${suffix}`, agent = `ai-agent-${suffix}`, manager = `ai-manager-${suffix}`, ownerB = `ai-owner-b-${suffix}`;
    let org, orgB;
    const key = value => value.replaceAll("-", "").toLowerCase();
    const server = async (operation, variables) => (await operation(dc, variables)).data;

    async function createConversation(uid, organizationId = org, conversationId = randomUUID()) {
      await server(sdk.createAiConversationWithExchange, {organizationId, conversationId, ownerUid: uid, title: `Question from ${uid}`,
        userContent: "Find 2 bedroom apartments in Dubai Marina", assistantContent: "No matching apartments were found in your inventory."});
      return conversationId;
    }

    before(async () => {
      for (const uid of [owner, admin, agent, manager, ownerB]) await run(sdk.upsertMyProfile, uid, {displayName: "AI integration"});
      org = (await run(sdk.createOrganization, owner, {name: "AI company A", slug: `ai-a-${suffix}`})).organization.id;
      orgB = (await run(sdk.createOrganization, ownerB, {name: "AI company B", slug: `ai-b-${suffix}`})).organization.id;
      // Fixture setup only: the harness refuses non-demo projects and non-loopback hosts.
      for (const [uid, role] of [[admin, "ADMIN"], [agent, "AGENT"], [manager, "MANAGER"]]) {
        await dc.executeGraphql(`mutation AiMember($org: UUID!, $uid: String!, $id: UUID!, $email: String!) { membership_insert(data: {organizationId: $org, id: $id, userProfileUid: $uid, email: $email, role: ${role}, status: ACTIVE}) }`,
          {variables: {org, uid, id: randomUUID(), email: `${uid}@example.test`}});
      }
    });

    it("lets every active role use its own Copilot history", async () => {
      for (const uid of [owner, admin, manager, agent]) {
        const conversationId = await createConversation(uid);
        const list = await run(sdk.listMyAiConversations, uid, {organizationId: org});
        assert.ok(list.conversations.some(item => key(item.id) === key(conversationId)), `${uid} sees their conversation`);
        assert.ok(list.conversations.every(item => item.title === `Question from ${uid}`), `${uid} sees only their own conversations`);
      }
    });

    it("rejects anonymous, unverified and non-member access", async () => {
      await forbidden(sdk.listMyAiConversations, null, {organizationId: org});
      await forbidden(sdk.listMyAiConversations, owner, {organizationId: org}, {email_verified: false});
      await forbidden(sdk.listMyAiConversations, ownerB, {organizationId: org});
      await forbidden(sdk.listMyAiConversations, "outsider", {organizationId: org});
    });

    it("persists exchanges in order and rebuilds them after a reload", async () => {
      const conversationId = await createConversation(owner);
      await server(sdk.appendAiExchange, {organizationId: org, conversationId, ownerUid: owner, expectedMessageCount: 2, nextMessageCount: 4,
        userSequence: 3, assistantSequence: 4, userContent: "And in JVC?", assistantContent: "Two units in JVC are available."});
      const loaded = await run(sdk.getMyAiConversation, owner, {organizationId: org, conversationId});
      assert.equal(loaded.conversation.messageCount, 4);
      const ordered = [...loaded.messages].reverse();
      assert.deepEqual(ordered.map(item => [item.sequence, item.role]), [[1, "USER"], [2, "ASSISTANT"], [3, "USER"], [4, "ASSISTANT"]]);
      assert.equal(ordered[3].content, "Two units in JVC are available.");
    });

    it("rejects a concurrent or stale append instead of interleaving messages", async () => {
      const conversationId = await createConversation(owner);
      const append = () => server(sdk.appendAiExchange, {organizationId: org, conversationId, ownerUid: owner, expectedMessageCount: 2, nextMessageCount: 4,
        userSequence: 3, assistantSequence: 4, userContent: "q", assistantContent: "a"});
      const results = await Promise.allSettled([append(), append()]);
      assert.equal(results.filter(result => result.status === "fulfilled").length, 1);
      await assert.rejects(append());
    });

    it("keeps conversations private to their owner inside the same company", async () => {
      const conversationId = await createConversation(owner);
      for (const uid of [admin, agent, manager]) {
        const loaded = await run(sdk.getMyAiConversation, uid, {organizationId: org, conversationId});
        assert.equal(loaded.conversation, null, `${uid} cannot read the owner's conversation`);
        assert.deepEqual(loaded.messages, []);
        await forbidden(sdk.deleteMyAiConversation, uid, {organizationId: org, conversationId});
      }
      await assert.rejects(server(sdk.appendAiExchange, {organizationId: org, conversationId, ownerUid: agent, expectedMessageCount: 2, nextMessageCount: 4,
        userSequence: 3, assistantSequence: 4, userContent: "q", assistantContent: "a"}), "an exchange cannot be appended under another member");
    });

    it("isolates companies: company B cannot read, delete or write company A history", async () => {
      const conversationId = await createConversation(owner);
      await forbidden(sdk.getMyAiConversation, ownerB, {organizationId: org, conversationId});
      const fromB = await run(sdk.getMyAiConversation, ownerB, {organizationId: orgB, conversationId});
      assert.equal(fromB.conversation, null);
      await forbidden(sdk.deleteMyAiConversation, ownerB, {organizationId: orgB, conversationId});
      await assert.rejects(createConversation(ownerB, org), "a non-member cannot be given a conversation in company A");
      const listB = await run(sdk.listMyAiConversations, ownerB, {organizationId: orgB});
      assert.ok(listB.conversations.every(item => !item.title.includes(owner)));
    });

    it("server-only operations cannot be called with a member identity", async () => {
      const conversationId = randomUUID();
      await forbidden(sdk.createAiConversationWithExchange, owner, {organizationId: org, conversationId, ownerUid: owner, title: "t", userContent: "q", assistantContent: "forged"});
      await forbidden(sdk.appendAiExchange, owner, {organizationId: org, conversationId, ownerUid: owner, expectedMessageCount: 0, nextMessageCount: 2, userSequence: 1, assistantSequence: 2, userContent: "q", assistantContent: "a"});
      await forbidden(sdk.recordAiUsage, owner, {organizationId: org, id: randomUUID(), userUid: owner, model: "claude-sonnet-5-5", promptVersion: "6a.1", status: sdk.AiRequestStatus.SUCCEEDED,
        inputTokens: 0, outputTokens: 0, cacheReadInputTokens: 0, cacheCreationInputTokens: 0, modelRequests: 0, toolCalls: 0, durationMs: 0});
      await forbidden(sdk.reserveAiRequest, owner, {organizationId: org, periodKey: "2026-10", subjectKey: "organization", limit: 1_000_000});
      await forbidden(sdk.releaseAiRequest, owner, {organizationId: org, periodKey: "2026-10", subjectKey: "organization"});
      await forbidden(sdk.getAiUsageCounters, owner, {organizationId: org, periodKey: "2026-10", userKey: `user:${owner}`});
    });

    it("deletes a conversation with its messages and writes an audit event", async () => {
      const conversationId = await createConversation(owner);
      await run(sdk.deleteMyAiConversation, owner, {organizationId: org, conversationId});
      const loaded = await run(sdk.getMyAiConversation, owner, {organizationId: org, conversationId});
      assert.equal(loaded.conversation, null);
      assert.deepEqual(loaded.messages, []);
      const audits = (await dc.executeGraphql(`query AiAudit($org: UUID!, $target: UUID!) { auditLogs(where: {organizationId: {eq: $org}, targetId: {eq: $target}}) { action targetType actorUid } }`, {variables: {org, target: conversationId}})).data.auditLogs;
      assert.deepEqual(audits.map(row => [row.action, row.targetType, row.actorUid]), [["AI_CONVERSATION_DELETED", "AI_CONVERSATION", owner]]);
      await forbidden(sdk.deleteMyAiConversation, owner, {organizationId: org, conversationId});
    });

    it("applies the retention purge only to the caller's own expired conversations", async () => {
      const mine = await createConversation(admin);
      const theirs = await createConversation(agent);
      await run(sdk.purgeMyExpiredAiConversations, admin, {organizationId: org, before: new Date(Date.now() + 60_000).toISOString()});
      assert.equal((await run(sdk.getMyAiConversation, admin, {organizationId: org, conversationId: mine})).conversation, null);
      assert.ok((await run(sdk.getMyAiConversation, agent, {organizationId: org, conversationId: theirs})).conversation);
    });

    it("searches conversation titles", async () => {
      const conversationId = randomUUID();
      await server(sdk.createAiConversationWithExchange, {organizationId: org, conversationId, ownerUid: owner, title: "Villas around Dubai Hills Estate", userContent: "q", assistantContent: "a"});
      const found = await run(sdk.listMyAiConversations, owner, {organizationId: org, search: "%dubai hills%"});
      assert.deepEqual(found.conversations.map(item => key(item.id)), [key(conversationId)]);
    });

    it("never lets concurrent reservations exceed a monthly allowance", async () => {
      const periodKey = `t${suffix.slice(0, 6)}`;
      const subjectKey = `user:${owner}`;
      const results = await Promise.all(Array.from({length: 20}, () => server(sdk.reserveAiRequest, {organizationId: org, periodKey, subjectKey, limit: 5})));
      assert.equal(results.filter(result => result.counter).length, 5, "exactly the allowance is reserved");
      let counters = await server(sdk.getAiUsageCounters, {organizationId: org, periodKey, userKey: subjectKey});
      assert.equal(counters.user.requestCount, 5);
      assert.equal(counters.organization, null);
      await server(sdk.releaseAiRequest, {organizationId: org, periodKey, subjectKey});
      counters = await server(sdk.getAiUsageCounters, {organizationId: org, periodKey, userKey: subjectKey});
      assert.equal(counters.user.requestCount, 4);
      assert.ok((await server(sdk.reserveAiRequest, {organizationId: org, periodKey, subjectKey, limit: 5})).counter, "a released slot can be reused");
      assert.equal((await server(sdk.reserveAiRequest, {organizationId: org, periodKey, subjectKey, limit: 5})).counter, null);
      for (let index = 0; index < 8; index += 1) await server(sdk.releaseAiRequest, {organizationId: org, periodKey, subjectKey});
      counters = await server(sdk.getAiUsageCounters, {organizationId: org, periodKey, userKey: subjectKey});
      assert.equal(counters.user.requestCount, 0, "releases never go below zero");
    });

    it("records provider token usage and tool executions without content", async () => {
      const id = randomUUID();
      await server(sdk.recordAiUsage, {organizationId: org, id, userUid: owner, conversationId: null, model: "claude-sonnet-5-5", promptVersion: "6a.1",
        status: sdk.AiRequestStatus.SUCCEEDED, errorCode: null, inputTokens: 1830, outputTokens: 245, cacheReadInputTokens: 1200, cacheCreationInputTokens: 0,
        estimatedCostUsd: 0.006, modelRequests: 2, toolCalls: 1, durationMs: 4100});
      await server(sdk.recordAiToolExecution, {organizationId: org, usageRecordId: id, toolName: "searchProperties", status: sdk.AiToolExecutionStatus.SUCCEEDED, errorCode: null, resultCount: 0, durationMs: 120});
      const stored = (await dc.executeGraphql(`query AiUsage($org: UUID!, $id: UUID!) { aiUsageRecord(key: {organizationId: $org, id: $id}) { userUid model inputTokens outputTokens cacheReadInputTokens toolCalls status
        aiToolExecutions_on_usageRecord { toolName status resultCount } } }`, {variables: {org, id}})).data.aiUsageRecord;
      assert.deepEqual([stored.userUid, stored.model, stored.inputTokens, stored.outputTokens, stored.cacheReadInputTokens, stored.toolCalls, stored.status],
        [owner, "claude-sonnet-5-5", 1830, 245, 1200, 1, "SUCCEEDED"]);
      assert.deepEqual(stored.aiToolExecutions_on_usageRecord.map(row => [row.toolName, row.status, row.resultCount]), [["searchProperties", "SUCCEEDED", 0]]);
      await assert.rejects(server(sdk.recordAiToolExecution, {organizationId: orgB, usageRecordId: id, toolName: "searchLeads", status: sdk.AiToolExecutionStatus.SUCCEEDED, errorCode: null, resultCount: 0, durationMs: 1}),
        "a tool execution cannot reference another company's usage record");
    });
  });
}
