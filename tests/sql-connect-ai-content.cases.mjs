import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { before, describe, it } from "node:test";

/**
 * Phase 6B AI Content Studio storage: draft ownership, company-wide access
 * for owners and administrators, editorial status, version history,
 * optimistic concurrency, templates, brand settings and tenant isolation,
 * against the SQL Connect emulator with the real stored operations. Calls
 * without a uid use the Admin identity, as the web server does for NO_ACCESS
 * operations; everything else impersonates a member.
 */
export function registerAiContentCases({sdk, run, forbidden, dc}) {
  describe("Phase 6B AI Content Studio drafts, templates and branding", {concurrency: false}, () => {
    const suffix = randomUUID();
    const owner = `content-owner-${suffix}`, admin = `content-admin-${suffix}`, agent = `content-agent-${suffix}`, agent2 = `content-agent2-${suffix}`,
      manager = `content-manager-${suffix}`, ownerB = `content-owner-b-${suffix}`;
    let org, orgB;
    const key = value => value.replaceAll("-", "").toLowerCase();
    const server = async (operation, variables) => (await operation(dc, variables)).data;
    const content = text => JSON.stringify({schemaVersion: 1, content: {en: {subject: text, previewText: "", body: `Body ${text}`, callToAction: ""}}});
    const validation = JSON.stringify({schemaVersion: 1, generatedAt: null, factsReadAt: null, model: "claude-sonnet-5-5", sources: [], warnings: [], missingInformation: [], claimsToReview: [], editedAfterGeneration: false, factIndex: {numbers: [], contacts: [], supportedTerms: []}});
    const settings = JSON.stringify({schemaVersion: 1, selection: {}, useLeadFirstName: false, length: "STANDARD"});
    const ACTIVE = ["DRAFT", "IN_REVIEW", "APPROVED"];

    async function createDraft(actorUid, organizationId = org, title = `Draft by ${actorUid}`) {
      const id = randomUUID();
      await server(sdk.createAiContentDraft, {organizationId, id, actorUid, contentType: "EMAIL", purpose: "FOLLOW_UP", title, language: "EN", tone: "PROFESSIONAL", audience: "BUYERS",
        sourceRefs: settings, contentData: content("v1"), validation, model: "claude-sonnet-5-5", generatedAt: new Date().toISOString()});
      return id;
    }

    const save = (uid, id, createdByUid, expectedRevision, extra = {}) => run(sdk.saveAiContentDraft, uid, {organizationId: org, id, createdByUid, expectedRevision, nextRevision: expectedRevision + 1,
      versionNumber: expectedRevision + 1, kind: "EDITED", status: "DRAFT", title: "Edited", contentData: content(`edit ${expectedRevision}`), validation, ...extra});

    before(async () => {
      for (const uid of [owner, admin, agent, agent2, manager, ownerB]) await run(sdk.upsertMyProfile, uid, {displayName: "Content integration"});
      org = (await run(sdk.createOrganization, owner, {name: "Content company A", slug: `content-a-${suffix}`})).organization.id;
      orgB = (await run(sdk.createOrganization, ownerB, {name: "Content company B", slug: `content-b-${suffix}`})).organization.id;
      for (const [uid, role] of [[admin, "ADMIN"], [agent, "AGENT"], [agent2, "AGENT"], [manager, "MANAGER"]]) {
        await dc.executeGraphql(`mutation ContentMember($org: UUID!, $uid: String!, $id: UUID!, $email: String!) { membership_insert(data: {organizationId: $org, id: $id, userProfileUid: $uid, email: $email, role: ${role}, status: ACTIVE}) }`,
          {variables: {org, uid, id: randomUUID(), email: `${uid}@example.test`}});
      }
    });

    it("keeps drafts private to their creator, with company-wide access for owners and administrators", async () => {
      const id = await createDraft(agent);
      const mine = await run(sdk.listAiContentDrafts, agent, {organizationId: org, createdByUid: agent, statuses: ACTIVE});
      assert.ok(mine.drafts.some(row => key(row.id) === key(id)));
      assert.ok(mine.drafts.every(row => row.createdByUid === agent));
      const loaded = await run(sdk.getAiContentDraft, agent, {organizationId: org, id, createdByUid: agent});
      assert.equal(loaded.draft.title, `Draft by ${agent}`);
      assert.deepEqual(loaded.versions.map(row => [row.versionNumber, row.kind]), [[1, "GENERATED"]]);

      for (const uid of [agent2, manager]) {
        assert.equal((await run(sdk.getAiContentDraft, uid, {organizationId: org, id, createdByUid: uid})).draft, null, `${uid} cannot read another member's draft`);
        await forbidden(sdk.getAiContentDraft, uid, {organizationId: org, id}, undefined);
        await forbidden(sdk.getAiContentDraft, uid, {organizationId: org, id, createdByUid: agent});
        await forbidden(sdk.listAiContentDrafts, uid, {organizationId: org, statuses: ACTIVE});
      }
      for (const uid of [owner, admin]) {
        assert.ok((await run(sdk.getAiContentDraft, uid, {organizationId: org, id})).draft, `${uid} manages company content`);
        const company = await run(sdk.listAiContentDrafts, uid, {organizationId: org, statuses: ACTIVE});
        assert.ok(company.drafts.some(row => key(row.id) === key(id)));
      }
    });

    it("saves edits as new versions with a compare-and-set on the revision", async () => {
      const id = await createDraft(agent);
      const results = await Promise.allSettled([save(agent, id, agent, 1), save(agent, id, agent, 1)]);
      assert.equal(results.filter(result => result.status === "fulfilled").length, 1, "one of two concurrent saves wins");
      await assert.rejects(save(agent, id, agent, 1), "a stale revision is rejected");
      await save(agent, id, agent, 2, {kind: "RESTORED", contentData: content("v1")});
      const loaded = await run(sdk.getAiContentDraft, agent, {organizationId: org, id, createdByUid: agent});
      assert.equal(loaded.draft.revision, 3);
      assert.equal(loaded.draft.versionCount, 3);
      assert.deepEqual(loaded.versions.map(row => [row.versionNumber, row.kind]), [[3, "RESTORED"], [2, "EDITED"], [1, "GENERATED"]]);
      const first = await run(sdk.getAiContentVersion, agent, {organizationId: org, draftId: id, versionNumber: 1, createdByUid: agent});
      assert.equal(JSON.parse(first.version.contentData).content.en.subject, "v1");
      assert.equal((await run(sdk.getAiContentVersion, agent2, {organizationId: org, draftId: id, versionNumber: 1, createdByUid: agent2})).version, null);
    });

    it("lets members edit only their own drafts and never forge generated versions or approval through an edit", async () => {
      const id = await createDraft(agent);
      await assert.rejects(save(agent2, id, agent2, 1), "another agent's edit matches no draft");
      await forbidden(sdk.saveAiContentDraft, agent2, {organizationId: org, id, createdByUid: agent, expectedRevision: 1, nextRevision: 2, versionNumber: 2, kind: "EDITED", status: "DRAFT", title: "x", contentData: content("x"), validation});
      await forbidden(sdk.saveAiContentDraft, agent, {organizationId: org, id, createdByUid: agent, expectedRevision: 1, nextRevision: 2, versionNumber: 2, kind: "GENERATED", status: "DRAFT", title: "x", contentData: content("x"), validation});
      await forbidden(sdk.saveAiContentDraft, agent, {organizationId: org, id, createdByUid: agent, expectedRevision: 1, nextRevision: 2, versionNumber: 2, kind: "EDITED", status: "APPROVED", title: "x", contentData: content("x"), validation});
      await save(admin, id, undefined, 1);
      assert.equal((await run(sdk.getAiContentDraft, agent, {organizationId: org, id, createdByUid: agent})).draft.revision, 2, "an administrator can edit company content");
    });

    it("allows internal approval only for owners and administrators, audits status changes and freezes archived drafts", async () => {
      const id = await createDraft(agent);
      await run(sdk.setAiContentDraftStatus, agent, {organizationId: org, id, createdByUid: agent, expectedRevision: 1, nextRevision: 2, status: "IN_REVIEW"});
      await forbidden(sdk.setAiContentDraftStatus, agent, {organizationId: org, id, createdByUid: agent, expectedRevision: 2, nextRevision: 3, status: "APPROVED"});
      await forbidden(sdk.setAiContentDraftStatus, manager, {organizationId: org, id, expectedRevision: 2, nextRevision: 3, status: "APPROVED"});
      await run(sdk.setAiContentDraftStatus, admin, {organizationId: org, id, expectedRevision: 2, nextRevision: 3, status: "APPROVED"});
      await run(sdk.setAiContentDraftStatus, agent, {organizationId: org, id, createdByUid: agent, expectedRevision: 3, nextRevision: 4, status: "ARCHIVED"});
      await assert.rejects(save(agent, id, agent, 4), "archived drafts cannot be edited");
      const archived = await run(sdk.listAiContentDrafts, agent, {organizationId: org, createdByUid: agent, statuses: ["ARCHIVED"]});
      assert.ok(archived.drafts.some(row => key(row.id) === key(id)));
      const audits = (await dc.executeGraphql(`query ContentAudit($org: UUID!, $target: UUID!) { auditLogs(where: {organizationId: {eq: $org}, targetId: {eq: $target}}, orderBy: [{createdAt: ASC}]) { action targetType actorUid metadata } }`, {variables: {org, target: id}})).data.auditLogs;
      assert.deepEqual(audits.map(row => [row.action, row.targetType, row.actorUid, row.metadata?.status ?? null]), [
        ["AI_CONTENT_DRAFT_CREATED", "AI_CONTENT_DRAFT", agent, null],
        ["AI_CONTENT_DRAFT_STATUS_CHANGED", "AI_CONTENT_DRAFT", agent, "IN_REVIEW"],
        ["AI_CONTENT_DRAFT_STATUS_CHANGED", "AI_CONTENT_DRAFT", admin, "APPROVED"],
        ["AI_CONTENT_DRAFT_STATUS_CHANGED", "AI_CONTENT_DRAFT", agent, "ARCHIVED"],
      ]);
    });

    it("regenerates (replacing content) and adds alternatives (keeping content) through server-only operations", async () => {
      const id = await createDraft(agent);
      const generatedAt = new Date().toISOString();
      await server(sdk.regenerateAiContentDraft, {organizationId: org, id, actorUid: agent, createdByUid: agent, expectedRevision: 1, nextRevision: 2, versionNumber: 2,
        title: "Regenerated", sourceRefs: settings, contentData: content("v2"), validation, model: "claude-sonnet-5-5", generatedAt});
      await server(sdk.addAiContentAlternative, {organizationId: org, id, actorUid: agent, createdByUid: agent, expectedRevision: 2, nextRevision: 3, versionNumber: 3,
        title: "Alternative", contentData: content("alt"), validation, model: "claude-sonnet-5-5", generatedAt});
      const loaded = await run(sdk.getAiContentDraft, agent, {organizationId: org, id, createdByUid: agent});
      assert.equal(JSON.parse(loaded.draft.contentData).content.en.subject, "v2", "an alternative does not replace the current content");
      assert.deepEqual(loaded.versions.map(row => row.kind), ["ALTERNATIVE", "REGENERATED", "GENERATED"]);
      await assert.rejects(server(sdk.regenerateAiContentDraft, {organizationId: org, id, actorUid: agent2, createdByUid: agent2, expectedRevision: 3, nextRevision: 4, versionNumber: 4,
        title: "x", sourceRefs: settings, contentData: content("x"), validation, model: "m", generatedAt}), "another agent cannot regenerate the draft");
      await assert.rejects(server(sdk.regenerateAiContentDraft, {organizationId: org, id, actorUid: agent2, createdByUid: agent, expectedRevision: 3, nextRevision: 4, versionNumber: 4,
        title: "x", sourceRefs: settings, contentData: content("x"), validation, model: "m", generatedAt}), "a member cannot act on another member's draft by naming its creator");
    });

    it("server-only operations cannot be called with a member identity", async () => {
      const id = randomUUID();
      const common = {organizationId: org, id, actorUid: owner, title: "forged", contentData: content("forged"), validation, model: "m", generatedAt: new Date().toISOString()};
      await forbidden(sdk.createAiContentDraft, owner, {...common, contentType: "EMAIL", purpose: "FOLLOW_UP", language: "EN", tone: "PROFESSIONAL", audience: "BUYERS", sourceRefs: settings});
      await forbidden(sdk.regenerateAiContentDraft, owner, {...common, expectedRevision: 1, nextRevision: 2, versionNumber: 2, sourceRefs: settings});
      await forbidden(sdk.addAiContentAlternative, owner, {...common, expectedRevision: 1, nextRevision: 2, versionNumber: 2});
    });

    it("isolates companies", async () => {
      const id = await createDraft(owner);
      await forbidden(sdk.getAiContentDraft, ownerB, {organizationId: org, id});
      assert.equal((await run(sdk.getAiContentDraft, ownerB, {organizationId: orgB, id})).draft, null);
      await forbidden(sdk.listAiContentDrafts, ownerB, {organizationId: org, statuses: ACTIVE});
      const listB = await run(sdk.listAiContentDrafts, ownerB, {organizationId: orgB, statuses: ACTIVE});
      assert.ok(listB.drafts.every(row => key(row.id) !== key(id)));
      await forbidden(sdk.deleteAiContentDraft, ownerB, {organizationId: org, id});
      await assert.rejects(createDraft(ownerB, org), "a non-member cannot be given a draft in company A");
      await assert.rejects(server(sdk.regenerateAiContentDraft, {organizationId: orgB, id, actorUid: ownerB, expectedRevision: 1, nextRevision: 2, versionNumber: 2,
        title: "x", sourceRefs: settings, contentData: content("x"), validation, model: "m", generatedAt: new Date().toISOString()}), "a draft is addressed only within its own company");
    });

    it("deletes a draft with its versions, writes an audit event and refuses other members", async () => {
      const id = await createDraft(agent);
      await save(agent, id, agent, 1);
      await forbidden(sdk.deleteAiContentDraft, agent2, {organizationId: org, id, createdByUid: agent2});
      await forbidden(sdk.deleteAiContentDraft, agent2, {organizationId: org, id, createdByUid: agent});
      await run(sdk.deleteAiContentDraft, agent, {organizationId: org, id, createdByUid: agent});
      assert.equal((await run(sdk.getAiContentDraft, owner, {organizationId: org, id})).draft, null);
      const versions = (await dc.executeGraphql(`query ContentVersions($org: UUID!, $id: UUID!) { aiContentVersions(where: {organizationId: {eq: $org}, draftId: {eq: $id}}) { id } }`, {variables: {org, id}})).data.aiContentVersions;
      assert.deepEqual(versions, []);
      const audits = (await dc.executeGraphql(`query ContentDeleted($org: UUID!, $target: UUID!) { auditLogs(where: {organizationId: {eq: $org}, targetId: {eq: $target}, action: {eq: AI_CONTENT_DRAFT_DELETED}}) { actorUid } }`, {variables: {org, target: id}})).data.auditLogs;
      assert.deepEqual(audits.map(row => row.actorUid), [agent]);
    });

    it("searches and filters drafts by title, status and content type", async () => {
      await createDraft(admin, org, "Marina Heights launch email");
      const found = await run(sdk.listAiContentDrafts, admin, {organizationId: org, createdByUid: admin, statuses: ACTIVE, contentType: "EMAIL", search: "%marina heights%"});
      assert.deepEqual(found.drafts.map(row => row.title), ["Marina Heights launch email"]);
      const none = await run(sdk.listAiContentDrafts, admin, {organizationId: org, createdByUid: admin, statuses: ACTIVE, contentType: "ADVERTISING", search: "%marina heights%"});
      assert.deepEqual(none.drafts, []);
    });

    it("lets only administrators manage templates; members see active templates of their own company", async () => {
      const input = {organizationId: org, name: "Follow-up style", contentType: "WHATSAPP_MESSAGE", purpose: "ENQUIRY_FOLLOW_UP", instructions: "Under 60 words.", isActive: true};
      await forbidden(sdk.createAiContentTemplate, agent, input);
      await forbidden(sdk.createAiContentTemplate, manager, input);
      const id = (await run(sdk.createAiContentTemplate, admin, input)).template.id;
      const inactive = (await run(sdk.createAiContentTemplate, owner, {...input, name: "Old style", isActive: false})).template.id;
      const visible = await run(sdk.listAiContentTemplates, agent, {organizationId: org, isActive: true});
      assert.ok(visible.templates.some(row => key(row.id) === key(id)));
      assert.ok(visible.templates.every(row => key(row.id) !== key(inactive)));
      await forbidden(sdk.listAiContentTemplates, agent, {organizationId: org});
      assert.equal((await run(sdk.listAiContentTemplates, admin, {organizationId: org})).templates.length, 2);
      assert.ok((await run(sdk.getAiContentTemplate, agent, {organizationId: org, id})).template);
      assert.equal((await run(sdk.getAiContentTemplate, agent, {organizationId: org, id: inactive})).template, null);
      await forbidden(sdk.listAiContentTemplates, ownerB, {organizationId: org, isActive: true});
      assert.equal((await run(sdk.getAiContentTemplate, ownerB, {organizationId: orgB, id})).template, null);

      const update = {...input, id, expectedRevision: 1, nextRevision: 2, name: "Follow-up style v2"};
      await forbidden(sdk.updateAiContentTemplate, agent, update);
      await run(sdk.updateAiContentTemplate, admin, update);
      await assert.rejects(run(sdk.updateAiContentTemplate, admin, update), "a stale template revision is rejected");
      await forbidden(sdk.deleteAiContentTemplate, agent, {organizationId: org, id});
      await run(sdk.deleteAiContentTemplate, admin, {organizationId: org, id});
      assert.equal((await run(sdk.getAiContentTemplate, agent, {organizationId: org, id})).template, null);
    });

    it("lets only administrators change brand settings, with a compare-and-set, and keeps them per company", async () => {
      const input = {organizationId: org, preferredLanguage: "EN_AR", useCompanyPhone: true, useCompanyEmail: false, tagline: "Homes, honestly", whatsappNumber: "+971 50 111 2222"};
      await forbidden(sdk.createAiBrandProfile, agent, input);
      await run(sdk.createAiBrandProfile, owner, input);
      await assert.rejects(run(sdk.createAiBrandProfile, admin, input), "a second profile cannot be created");
      const read = await run(sdk.getAiBrandProfile, agent, {organizationId: org});
      assert.equal(read.profile.tagline, "Homes, honestly");
      assert.equal(read.profile.revision, 1);
      assert.equal(read.organization.name, "Content company A");
      await forbidden(sdk.updateAiBrandProfile, agent, {...input, expectedRevision: 1, nextRevision: 2});
      await run(sdk.updateAiBrandProfile, admin, {...input, expectedRevision: 1, nextRevision: 2, tagline: "New tagline"});
      await assert.rejects(run(sdk.updateAiBrandProfile, admin, {...input, expectedRevision: 1, nextRevision: 2}), "a stale brand revision is rejected");
      await forbidden(sdk.getAiBrandProfile, ownerB, {organizationId: org});
      assert.equal((await run(sdk.getAiBrandProfile, ownerB, {organizationId: orgB})).profile, null);
      const audits = (await dc.executeGraphql(`query BrandAudit($org: UUID!) { auditLogs(where: {organizationId: {eq: $org}, action: {eq: AI_BRAND_PROFILE_UPDATED}}) { actorUid } }`, {variables: {org}})).data.auditLogs;
      assert.deepEqual(audits.map(row => row.actorUid).sort(), [admin, owner].sort());
    });

    it("records content generations in the shared usage table with feature and content type", async () => {
      const id = randomUUID();
      await server(sdk.recordAiUsage, {organizationId: org, id, userUid: agent, model: "claude-sonnet-5-5", promptVersion: "6b.1", status: "SUCCEEDED", inputTokens: 1200, outputTokens: 400,
        cacheReadInputTokens: 900, cacheCreationInputTokens: 0, estimatedCostUsd: 0.0066, modelRequests: 1, toolCalls: 0, durationMs: 5000, feature: "CONTENT", contentType: "EMAIL"});
      const row = (await dc.executeGraphql(`query ContentUsage($org: UUID!, $id: UUID!) { aiUsageRecord(key: {organizationId: $org, id: $id}) { feature contentType outputTokens promptVersion } }`, {variables: {org, id}})).data.aiUsageRecord;
      assert.deepEqual(row, {feature: "CONTENT", contentType: "EMAIL", outputTokens: 400, promptVersion: "6b.1"});
    });
  });
}
