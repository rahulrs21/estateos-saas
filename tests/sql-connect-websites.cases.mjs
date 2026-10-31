import assert from "node:assert/strict";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { before, describe, it } from "node:test";
import { fixture as f } from "./fixtures/sql-connect-fixtures.mjs";

/**
 * Phase 6D website builder storage against the SQL Connect emulator with the
 * real stored operations: page roles and agent-draft permission, compare-and-
 * set versions, review and approval, server-only publication with approved
 * versions, superseding and live-slug protection, public reads of ACTIVE
 * publications only, lead form binding, enquiry links, pending enquiries and
 * tenant isolation. Calls without a uid use the Admin identity, as the web
 * server does for NO_ACCESS operations; everything else impersonates a member.
 * Company A (local-agency-a): owner-a, admin-a, manager-a, agent-a. Company B: owner-b.
 */
export function registerWebsiteCases({sdk, run, forbidden, dc}) {
  describe("Phase 6D website builder", {concurrency: false}, () => {
    const suffix = randomUUID().slice(0, 8);
    const key = value => String(value).replaceAll("-", "").toLowerCase();
    const server = async (operation, variables) => (await operation(dc, variables)).data;
    const pageData = headline => JSON.stringify({schemaVersion: 1, theme: {style: "CONTEMPORARY", accent: "TEAL", font: "SANS", scale: "COMFORTABLE", radius: "ROUND"},
      sections: [{id: "hero-main", type: "HERO", visible: true, devices: {desktop: true, tablet: true, mobile: true}, layout: {spacing: "NORMAL", background: "DEFAULT", align: "START"}, variant: "split",
        props: {eyebrow: "", headline, subheadline: "", primaryCta: {label: "Enquire", action: "ENQUIRE"}, secondaryCta: null, image: null, showPrice: true, showLocation: true}}]});
    const websiteId = randomUUID();
    let websiteRevision = 1;
    const pages = {};
    const createPage = (uid, name, slug = `${name}-${suffix}`) => {
      const id = randomUUID();
      return run(sdk.createWebsitePage, uid, {organizationId: f.orgA, id, websiteId, title: `${name} page`, slug, description: null, sourceProjectId: null, sourcePropertyId: null,
        sourceListingId: null, seoTitle: null, seoDescription: null, designStyle: "CONTEMPORARY", kind: sdk.PageVersionKind.CREATED, structuredPageData: pageData(name), validation: null}).then(() => id);
    };
    const page = async (uid, id, createdByUid) => (await run(sdk.getWebsitePage, uid, {organizationId: f.orgA, id, ...(createdByUid ? {createdByUid} : {})})).page;
    const save = (uid, id, revision, versionNumber, extra = {}) => run(sdk.saveWebsitePageVersion, uid, {organizationId: f.orgA, id, expectedRevision: revision, nextRevision: revision + 1, versionNumber,
      kind: sdk.PageVersionKind.EDITED, title: "Edited", slug: extra.slug ?? `edited-${versionNumber}-${key(id).slice(0, 8)}`, description: null, seoTitle: null, seoDescription: null, designStyle: "CONTEMPORARY",
      structuredPageData: pageData(`v${versionNumber}`), validation: null, ...extra});
    const setAgentDrafts = async allow => {
      await run(sdk.updateWebsiteSettings, "admin-a", {organizationId: f.orgA, id: websiteId, name: "Agency A website", designSettings: "{}", allowAgentDrafts: allow, expectedRevision: websiteRevision, nextRevision: websiteRevision + 1});
      websiteRevision += 1;
    };
    const publish = (actorUid, pageId, versionNumber, versionId, revision, pageSlug, extra = {}) => server(sdk.publishWebsitePage, {
      organizationId: f.orgA, pageId, actorUid, publicationId: randomUUID(), versionId, versionNumber, pageSlug, expectedRevision: revision, nextRevision: revision + 1,
      currentVersionNumber: versionNumber, status: sdk.WebsitePageStatus.PUBLISHED,
      snapshot: JSON.stringify({schemaVersion: 1, title: pageSlug}), sourceFingerprint: "f".repeat(64), checklist: "{}", ...extra,
    });
    const versionId = async (uid, pageId, versionNumber) => (await run(sdk.getPageVersion, uid, {organizationId: f.orgA, pageId, versionNumber})).version.id;

    before(async () => {
      await server(sdk.createDefaultWebsite, {organizationId: f.orgA, id: websiteId, actorUid: "owner-a", name: "Agency A website", slug: `main-${suffix}`, designSettings: "{}"});
      await assert.rejects(server(sdk.createDefaultWebsite, {organizationId: f.orgA, id: randomUUID(), actorUid: "owner-b", name: "Intruder", slug: `x-${suffix}`, designSettings: "{}"}), "a member of another company cannot create a site here");
    });

    it("lets owners, administrators and managers create pages, agents only when allowed, and nobody from another company", async () => {
      pages.owner = await createPage("owner-a", "owner");
      pages.manager = await createPage("manager-a", "manager");
      await forbidden(sdk.createWebsitePage, "agent-a", {organizationId: f.orgA, id: randomUUID(), websiteId, title: "Agent", slug: `agent-x-${suffix}`, designStyle: "CONTEMPORARY", kind: sdk.PageVersionKind.CREATED, structuredPageData: pageData("a")});
      await forbidden(sdk.createWebsitePage, "owner-b", {organizationId: f.orgA, id: randomUUID(), websiteId, title: "B", slug: `b-${suffix}`, designStyle: "CONTEMPORARY", kind: sdk.PageVersionKind.CREATED, structuredPageData: pageData("b")});
      await forbidden(sdk.updateWebsiteSettings, "manager-a", {organizationId: f.orgA, id: websiteId, name: "Manager", designSettings: "{}", allowAgentDrafts: true, expectedRevision: websiteRevision, nextRevision: websiteRevision + 1});
      await setAgentDrafts(true);
      pages.agent = await createPage("agent-a", "agent");
      await assert.rejects(createPage("owner-a", "dup", `owner-${suffix}`), "page slugs are unique per company");

      const all = await run(sdk.listWebsitePages, "owner-a", {organizationId: f.orgA, statuses: [sdk.WebsitePageStatus.DRAFT], limit: 100, offset: 0});
      for (const id of Object.values(pages)) assert.ok(all.pages.some(row => key(row.id) === key(id)));
      const managerView = await run(sdk.listWebsitePages, "manager-a", {organizationId: f.orgA, statuses: [sdk.WebsitePageStatus.DRAFT], limit: 100, offset: 0});
      assert.ok(managerView.pages.length >= 3, "managers review company pages");
      const agentView = await run(sdk.listWebsitePages, "agent-a", {organizationId: f.orgA, createdByUid: "agent-a", statuses: [sdk.WebsitePageStatus.DRAFT], limit: 100, offset: 0});
      assert.deepEqual(agentView.pages.map(row => key(row.id)), [key(pages.agent)], "agents see only their own pages");
      await forbidden(sdk.listWebsitePages, "agent-a", {organizationId: f.orgA, statuses: [sdk.WebsitePageStatus.DRAFT], limit: 100, offset: 0});
      await forbidden(sdk.listWebsitePages, "owner-b", {organizationId: f.orgA, statuses: [sdk.WebsitePageStatus.DRAFT], limit: 100, offset: 0});
      assert.equal(await page("agent-a", pages.owner, "agent-a"), null, "an agent cannot open someone else's page");
      assert.equal((await run(sdk.listWebsitePages, "owner-b", {organizationId: f.orgB, statuses: [sdk.WebsitePageStatus.DRAFT], limit: 100, offset: 0})).pages.length, 0, "company B sees none of company A's pages");
    });

    it("saves edits as new versions with compare-and-set; members edit only their own pages; agents only while allowed", async () => {
      await save("manager-a", pages.manager, 1, 2, {createdByUid: "manager-a"});
      await forbidden(sdk.saveWebsitePageVersion, "manager-a", {organizationId: f.orgA, id: pages.owner, expectedRevision: 1, nextRevision: 2, versionNumber: 2, kind: sdk.PageVersionKind.EDITED,
        title: "x", slug: `m-${suffix}`, designStyle: "CONTEMPORARY", structuredPageData: pageData("x")});
      await assert.rejects(save("manager-a", pages.owner, 1, 2, {createdByUid: "manager-a"}), "a manager cannot edit another member's page");
      const results = await Promise.allSettled([save("owner-a", pages.owner, 1, 2), save("admin-a", pages.owner, 1, 2)]);
      assert.equal(results.filter(result => result.status === "fulfilled").length, 1, "one of two concurrent saves wins");
      await assert.rejects(save("owner-a", pages.owner, 1, 3), "a stale revision is rejected");
      const stored = await page("owner-a", pages.owner);
      assert.equal(stored.currentVersionNumber, 2);
      assert.equal(stored.versionCount, 2);
      const versions = (await run(sdk.getWebsitePage, "owner-a", {organizationId: f.orgA, id: pages.owner})).versions;
      assert.deepEqual(versions.map(row => row.versionNumber), [2, 1], "versions are append-only history");
      const first = await run(sdk.getPageVersion, "owner-a", {organizationId: f.orgA, pageId: pages.owner, versionNumber: 1});
      assert.match(first.version.structuredPageData, /"owner"/, "version 1 is unchanged");

      await save("agent-a", pages.agent, 1, 2, {createdByUid: "agent-a"});
      await setAgentDrafts(false);
      await assert.rejects(save("agent-a", pages.agent, 2, 3, {createdByUid: "agent-a"}), "agents cannot edit once agent drafts are switched off");
      await setAgentDrafts(true);
    });

    it("runs review: submit, managers return with a note, only owners and administrators approve, approval pins the version", async () => {
      const revision = async () => (await page("owner-a", pages.manager)).revision;
      await run(sdk.submitWebsitePageForReview, "manager-a", {organizationId: f.orgA, id: pages.manager, createdByUid: "manager-a", expectedRevision: await revision(), nextRevision: (await revision()) + 1});
      for (const uid of ["manager-a", "agent-a", "owner-b"]) await forbidden(sdk.approveWebsitePage, uid, {organizationId: f.orgA, id: pages.manager, versionNumber: 2, expectedRevision: await revision(), nextRevision: (await revision()) + 1});
      await forbidden(sdk.rejectWebsitePage, "agent-a", {organizationId: f.orgA, id: pages.manager, note: "No", expectedRevision: await revision(), nextRevision: (await revision()) + 1});
      await run(sdk.rejectWebsitePage, "manager-a", {organizationId: f.orgA, id: pages.manager, note: "Please add the payment plan.", expectedRevision: await revision(), nextRevision: (await revision()) + 1});
      let stored = await page("owner-a", pages.manager);
      assert.equal(stored.status, "DRAFT");
      assert.equal(stored.reviewNote, "Please add the payment plan.");
      await run(sdk.submitWebsitePageForReview, "manager-a", {organizationId: f.orgA, id: pages.manager, createdByUid: "manager-a", expectedRevision: stored.revision, nextRevision: stored.revision + 1});
      await assert.rejects(run(sdk.approveWebsitePage, "admin-a", {organizationId: f.orgA, id: pages.manager, versionNumber: 1, expectedRevision: stored.revision + 1, nextRevision: stored.revision + 2}), "only the version under review can be approved");
      await run(sdk.approveWebsitePage, "admin-a", {organizationId: f.orgA, id: pages.manager, versionNumber: 2, expectedRevision: stored.revision + 1, nextRevision: stored.revision + 2});
      stored = await page("owner-a", pages.manager);
      assert.equal(stored.status, "APPROVED");
      assert.equal(stored.approvedVersionNumber, 2);
      const versions = (await run(sdk.getWebsitePage, "owner-a", {organizationId: f.orgA, id: pages.manager})).versions;
      assert.ok(versions.find(row => row.versionNumber === 2).approvedAt);
      assert.equal(versions.find(row => row.versionNumber === 1).approvedAt ?? null, null);
    });

    it("publishes only approved versions through the server, supersedes earlier publications and keeps live pages stable", async () => {
      const slug = (await page("owner-a", pages.manager)).slug;
      const v2 = await versionId("owner-a", pages.manager, 2);
      const v1 = await versionId("owner-a", pages.manager, 1);
      let revision = (await page("owner-a", pages.manager)).revision;
      const variables = {organizationId: f.orgA, pageId: pages.manager, actorUid: "owner-a", publicationId: randomUUID(), versionId: v2, versionNumber: 2, pageSlug: slug,
        expectedRevision: revision, nextRevision: revision + 1, currentVersionNumber: 2, status: sdk.WebsitePageStatus.PUBLISHED, snapshot: "{}", sourceFingerprint: "f".repeat(64), checklist: "{}"};
      for (const uid of ["owner-a", "admin-a"]) await forbidden(sdk.publishWebsitePage, uid, variables);
      for (const actor of ["manager-a", "agent-a", "owner-b"]) await assert.rejects(publish(actor, pages.manager, 2, v2, revision, slug), `${actor} cannot publish`);
      await assert.rejects(publish("owner-a", pages.manager, 1, v1, revision, slug), "an unapproved version cannot be published");
      await assert.rejects(publish("owner-a", pages.manager, 2, v2, revision, `${slug}-other`), "the publication slug must be the page's slug");

      await publish("owner-a", pages.manager, 2, v2, revision, slug, {snapshot: JSON.stringify({schemaVersion: 1, title: "first"})});
      revision += 1;
      let live = await server(sdk.resolvePublishedPage, {companySlug: "local-agency-a", pageSlug: slug});
      assert.equal(live.publications.length, 1);
      assert.match(live.publications[0].snapshot, /first/);
      assert.equal((await server(sdk.resolvePublishedPage, {companySlug: "local-agency-b", pageSlug: slug})).publications.length, 0, "another company's slug does not resolve it");
      assert.equal((await server(sdk.resolvePublishedPage, {companySlug: "local-agency-a", pageSlug: `${slug}-nope`})).publications.length, 0);

      await publish("owner-a", pages.manager, 2, v2, revision, slug, {snapshot: JSON.stringify({schemaVersion: 1, title: "second"})});
      revision += 1;
      const history = (await run(sdk.getWebsitePage, "owner-a", {organizationId: f.orgA, id: pages.manager})).publications;
      assert.equal(history.filter(row => row.status === "ACTIVE").length, 1, "only one live publication per page");
      assert.equal(history.filter(row => row.status === "SUPERSEDED").length, 1);
      live = await server(sdk.resolvePublishedPage, {companySlug: "local-agency-a", pageSlug: slug});
      assert.match(live.publications[0].snapshot, /second/);

      // Editing the draft (including its slug) never changes the live page.
      await save("manager-a", pages.manager, revision, 3, {createdByUid: "manager-a", slug: `${slug}-renamed`});
      revision += 1;
      const stored = await page("owner-a", pages.manager);
      assert.equal(stored.status, "DRAFT");
      assert.ok(stored.livePublicationId, "the publication stays live while the draft changes");
      live = await server(sdk.resolvePublishedPage, {companySlug: "local-agency-a", pageSlug: slug});
      assert.match(live.publications[0].snapshot, /second/, "the live snapshot is unchanged");

      // Another page cannot go live on an address that is still live.
      await save("owner-a", pages.owner, 2, 3, {slug});
      const ownerRevision = (await page("owner-a", pages.owner)).revision;
      await run(sdk.submitWebsitePageForReview, "owner-a", {organizationId: f.orgA, id: pages.owner, expectedRevision: ownerRevision, nextRevision: ownerRevision + 1});
      await run(sdk.approveWebsitePage, "owner-a", {organizationId: f.orgA, id: pages.owner, versionNumber: 3, expectedRevision: ownerRevision + 1, nextRevision: ownerRevision + 2});
      await assert.rejects(publish("owner-a", pages.owner, 3, await versionId("owner-a", pages.owner, 3), ownerRevision + 2, slug), "another page is still live on this address");

      await forbidden(sdk.unpublishWebsitePage, "manager-a", {organizationId: f.orgA, id: pages.manager, publicationId: stored.livePublicationId, expectedRevision: revision, nextRevision: revision + 1});
      await assert.rejects(run(sdk.archiveWebsitePage, "manager-a", {organizationId: f.orgA, id: pages.manager, createdByUid: "manager-a", expectedRevision: revision, nextRevision: revision + 1}), "a live page cannot be archived");
      await run(sdk.unpublishWebsitePage, "owner-a", {organizationId: f.orgA, id: pages.manager, publicationId: stored.livePublicationId, expectedRevision: revision, nextRevision: revision + 1});
      assert.equal((await server(sdk.resolvePublishedPage, {companySlug: "local-agency-a", pageSlug: slug})).publications.length, 0, "unpublished pages are no longer public");
      assert.equal((await server(sdk.getPublishedPageAsset, {publicationId: stored.livePublicationId})).publication, null, "media of unpublished pages are no longer served");
      const sitemap = await server(sdk.listPublishedPagesForSitemap, {limit: 5000});
      assert.ok(!sitemap.publications.some(row => row.pageSlug === slug), "the sitemap lists live pages only");
      await run(sdk.archiveWebsitePage, "manager-a", {organizationId: f.orgA, id: pages.manager, createdByUid: "manager-a", expectedRevision: revision + 1, nextRevision: revision + 2});
      assert.equal((await page("owner-a", pages.manager)).status, "ARCHIVED");
    });

    it("binds only same-company lead forms (owners and administrators) and records page enquiries and pending enquiries", async () => {
      const publicId = randomBytes(32).toString("base64url");
      const consentText = "I agree that this agency may contact me about this property.";
      const form = (await run(sdk.createLeadCaptureForm, "owner-a", {organizationId: f.orgA, publicId, name: `Landing form ${suffix}`, status: sdk.LeadCaptureFormStatus.ACTIVE,
        sourceName: `Website - Landing ${suffix}`, branchId: null, projectId: null, consentText, privacyPolicyUrl: "https://agency.example/privacy", successMessage: "Thanks",
        fields: [{key: "FULL_NAME", label: "Name", enabled: true, required: true}, {key: "EMAIL", label: "Email", enabled: true, required: false}]})).form.id;
      const formB = (await run(sdk.createLeadCaptureForm, "owner-b", {organizationId: f.orgB, publicId: randomBytes(32).toString("base64url"), name: `B form ${suffix}`, status: sdk.LeadCaptureFormStatus.ACTIVE,
        sourceName: `Website - B ${suffix}`, branchId: null, projectId: null, consentText, privacyPolicyUrl: "https://agency.example/privacy", successMessage: "Thanks",
        fields: [{key: "FULL_NAME", label: "Name", enabled: true, required: true}, {key: "EMAIL", label: "Email", enabled: true, required: false}]})).form.id;
      for (const uid of ["manager-a", "agent-a", "owner-b"]) await forbidden(sdk.setPageLeadFormBinding, uid, {organizationId: f.orgA, pageId: pages.owner, formId: form});
      await assert.rejects(run(sdk.setPageLeadFormBinding, "owner-a", {organizationId: f.orgA, pageId: pages.owner, formId: formB}), "another company's form cannot be connected");
      await run(sdk.setPageLeadFormBinding, "admin-a", {organizationId: f.orgA, pageId: pages.owner, formId: form});
      const bound = await server(sdk.getPublishedPageForm, {organizationId: f.orgA, pageId: pages.owner});
      assert.equal(key(bound.binding.formId), key(form));
      assert.equal((await server(sdk.getPublishedPageForm, {organizationId: f.orgB, pageId: pages.owner})).binding, null);

      const idempotencyKeyHash = createHash("sha256").update(randomUUID()).digest("hex");
      const lead = (await server(sdk.submitWebsiteLeadCapture, {
        organizationId: f.orgA, formId: form, publicId, idempotencyKeyHash, fullName: "Landing Visitor", email: `visitor-${suffix}@example.test`, phone: null,
        normalizedEmail: `visitor-${suffix}@example.test`, normalizedPhone: null, contactId: null, hasExistingContact: false, message: null, propertyInterest: "Landing page: Owner page",
        preferredLocation: null, propertyType: null, budgetMin: null, budgetMax: null, currency: "AED", bedroomPreference: null,
        landingPageUrl: `http://localhost/site/local-agency-a/owner-${suffix}`, utmSource: "instagram", utmMedium: "paid", utmCampaign: "launch", utmContent: null, utmTerm: "",
        consentTextSnapshot: consentText, privacyPolicyUrlSnapshot: "https://agency.example/privacy", assignedMembershipId: null, distributionRuleId: null, expectedCursorVersion: null,
        hasAutoAssignment: false, hasDistributionAttempt: false,
      })).lead.id;
      for (const uid of ["owner-a", "admin-a"]) await forbidden(sdk.recordWebsitePageEnquiry, uid, {organizationId: f.orgA, pageId: pages.owner, formId: form, leadId: lead});
      await server(sdk.recordWebsitePageEnquiry, {organizationId: f.orgA, pageId: pages.owner, publicationId: null, formId: form, leadId: lead, utmSource: "instagram", utmMedium: "paid", utmCampaign: "launch"});
      await assert.rejects(server(sdk.recordWebsitePageEnquiry, {organizationId: f.orgB, pageId: pages.owner, formId: form, leadId: lead}), "a page of another company cannot be linked");
      const enquiries = await run(sdk.listWebsitePageEnquiries, "owner-a", {organizationId: f.orgA, pageId: pages.owner, limit: 50});
      assert.equal(enquiries.total[0].count, 1);
      assert.equal(enquiries.enquiries[0].lead.fullName, "Landing Visitor");
      assert.equal(enquiries.enquiries[0].utmCampaign, "launch");
      for (const uid of ["manager-a", "agent-a", "owner-b"]) await forbidden(sdk.listWebsitePageEnquiries, uid, {organizationId: f.orgA, pageId: pages.owner, limit: 50});
      assert.equal((await run(sdk.getWebsitePage, "owner-a", {organizationId: f.orgA, id: pages.owner})).enquiries[0].count, 1);

      const pendingHash = createHash("sha256").update(randomUUID()).digest("hex");
      for (const uid of ["owner-a", "agent-a"]) await forbidden(sdk.recordPendingWebsiteEnquiry, uid, {organizationId: f.orgA, formId: form, idempotencyKeyHash: pendingHash, payload: "{}", errorCode: "X"});
      await server(sdk.recordPendingWebsiteEnquiry, {organizationId: f.orgA, pageId: pages.owner, publicationId: null, formId: form, idempotencyKeyHash: pendingHash, payload: JSON.stringify({fullName: "Kept Visitor"}), errorCode: "ACTIVE_PIPELINE_UNAVAILABLE"});
      await assert.rejects(server(sdk.recordPendingWebsiteEnquiry, {organizationId: f.orgA, formId: form, idempotencyKeyHash: pendingHash, payload: "{}", errorCode: "X"}), "one pending row per submission key");
      assert.equal((await server(sdk.findPendingWebsiteEnquiry, {organizationId: f.orgA, formId: form, idempotencyKeyHash: pendingHash})).pending.status, "PENDING");
      const pending = await run(sdk.listPendingWebsiteEnquiries, "admin-a", {organizationId: f.orgA, limit: 50});
      const row = pending.pending.find(item => item.idempotencyKeyHash === pendingHash);
      assert.ok(row);
      for (const uid of ["manager-a", "agent-a", "owner-b"]) await forbidden(sdk.listPendingWebsiteEnquiries, uid, {organizationId: f.orgA, limit: 50});
      await assert.rejects(server(sdk.markPendingWebsiteEnquiryRecovered, {organizationId: f.orgA, id: row.id, actorUid: "agent-a", leadId: lead}), "only owners and administrators recover enquiries");
      await forbidden(sdk.dismissPendingWebsiteEnquiry, "manager-a", {organizationId: f.orgA, id: row.id});
      await server(sdk.markPendingWebsiteEnquiryRecovered, {organizationId: f.orgA, id: row.id, actorUid: "admin-a", leadId: lead});
      await assert.rejects(run(sdk.dismissPendingWebsiteEnquiry, "owner-a", {organizationId: f.orgA, id: row.id}), "a recovered enquiry cannot be dismissed");
    });

    it("keeps public and server-only operations closed to members and scoped to one company", async () => {
      for (const uid of ["owner-a", "agent-a", null]) {
        await forbidden(sdk.resolvePublishedPage, uid, {companySlug: "local-agency-a", pageSlug: "anything"});
        await forbidden(sdk.listPublishedPagesForSitemap, uid, {limit: 10});
        await forbidden(sdk.createGeneratedWebsitePage, uid, {organizationId: f.orgA, id: randomUUID(), actorUid: "owner-a", websiteId, title: "x", slug: `g-${suffix}`, designStyle: "CONTEMPORARY", structuredPageData: pageData("g"), model: "m"});
      }
      await forbidden(sdk.getWebsiteLeadCaptureFormById, "owner-a", {organizationId: f.orgA, formId: randomUUID()});
      const generated = randomUUID();
      await server(sdk.createGeneratedWebsitePage, {organizationId: f.orgA, id: generated, actorUid: "agent-a", websiteId, title: "Generated", slug: `generated-${suffix}`, designStyle: "PREMIUM_DARK", structuredPageData: pageData("g"), model: "claude-test"});
      const stored = await run(sdk.getPageVersion, "agent-a", {organizationId: f.orgA, pageId: generated, versionNumber: 1, createdByUid: "agent-a"});
      assert.equal(stored.version.kind, "GENERATED");
      assert.equal(stored.version.model, "claude-test");
      await assert.rejects(server(sdk.createGeneratedWebsitePage, {organizationId: f.orgA, id: randomUUID(), actorUid: "owner-b", websiteId, title: "B", slug: `gb-${suffix}`, designStyle: "PREMIUM_DARK", structuredPageData: pageData("g"), model: "m"}), "the actor must be a member of the company");
      const eligibility = await server(sdk.checkPublishedSourcesEligibility, {organizationId: f.orgB, listingIds: [randomUUID()], projectIds: [randomUUID()], propertyIds: []});
      assert.deepEqual([eligibility.listings.length, eligibility.projects.length], [0, 0]);
      const media = await run(sdk.listProjectWebsiteMedia, "owner-a", {organizationId: f.orgA, projectId: randomUUID(), includeProjectFiles: true, limit: 10});
      assert.deepEqual(media.projectMedia, []);
      await forbidden(sdk.listProjectWebsiteMedia, "agent-a", {organizationId: f.orgA, projectId: randomUUID(), includeProjectFiles: true, limit: 10});
      await forbidden(sdk.listProjectWebsiteMedia, "manager-a", {organizationId: f.orgA, projectId: randomUUID(), includeProjectFiles: false, limit: 10});
    });

    it("lets owners and administrators manage agent cards and lists; any member reads only active agents", async () => {
      const agents = await run(sdk.listWebsiteAgents, "admin-a", {organizationId: f.orgA});
      assert.ok(agents.agents.some(agent => key(agent.id) === key(f.memberAgentA)));
      assert.ok(agents.agents.every(agent => key(agent.id) !== key(f.memberSuspendedA)), "suspended members are not offered");
      for (const actor of ["manager-a", "agent-a", "owner-b"]) await forbidden(sdk.listWebsiteAgents, actor, {organizationId: f.orgA});
      await run(sdk.updateWebsiteAgentCard, "owner-a", {organizationId: f.orgA, membershipId: f.memberAgentA, websiteTitle: "Consultant", websitePhone: "+971 50 555 0199", websiteWhatsapp: null});
      for (const actor of ["manager-a", "agent-a", "owner-b"]) await assert.rejects(run(sdk.updateWebsiteAgentCard, actor, {organizationId: f.orgA, membershipId: f.memberAgentA, websiteTitle: "Hacked", websitePhone: null, websiteWhatsapp: null}), `${actor} cannot edit agent cards`);
      await assert.rejects(run(sdk.updateWebsiteAgentCard, "owner-a", {organizationId: f.orgA, membershipId: f.memberSuspendedA, websiteTitle: "X", websitePhone: null, websiteWhatsapp: null}), "only active members");
      const read = await run(sdk.getWebsiteAgent, "manager-a", {organizationId: f.orgA, membershipId: f.memberAgentA});
      assert.equal(read.agent.websiteTitle, "Consultant");
      assert.equal(read.agent.websitePhone, "+971 50 555 0199");
      assert.equal((await run(sdk.getWebsiteAgent, "manager-a", {organizationId: f.orgA, membershipId: f.memberSuspendedA})).agent, null, "inactive members are never shown");
      await forbidden(sdk.getWebsiteAgent, "owner-b", {organizationId: f.orgA, membershipId: f.memberAgentA});
    });

    it("creates website media only on the server, lists it per company and lets the uploader or an administrator archive it", async () => {
      const access = await run(sdk.getWebsiteMediaAccess, "manager-a", {organizationId: f.orgA});
      assert.equal(access.member.role, "MANAGER");
      assert.equal(key(access.website.id), key(websiteId));
      const id = randomUUID();
      const storagePath = `organizations/${f.orgA}/websites/media/${id}.png`;
      const media = {organizationId: f.orgA, id, websiteId, fileName: "lobby.png", contentType: "image/png", byteSize: 1000, width: 1600, height: 900, alt: "", storagePath, actorUid: "manager-a"};
      await assert.rejects(run(sdk.createWebsiteMedia, "manager-a", media), "members cannot create media records (and so cannot choose a storage path)");
      await server(sdk.createWebsiteMedia, media);
      let listed = await run(sdk.listWebsiteMedia, "agent-a", {organizationId: f.orgA, limit: 60, offset: 0});
      assert.ok(!listed.media.some(row => key(row.id) === key(id)), "a pending upload is not listed");
      await server(sdk.setWebsiteMediaUploadStatus, {organizationId: f.orgA, id, status: sdk.WebsiteMediaStatus.ACTIVE, actorUid: "manager-a"});
      await assert.rejects(server(sdk.setWebsiteMediaUploadStatus, {organizationId: f.orgA, id, status: sdk.WebsiteMediaStatus.ACTIVE, actorUid: "manager-a"}), "only pending uploads are activated");
      listed = await run(sdk.listWebsiteMedia, "agent-a", {organizationId: f.orgA, limit: 60, offset: 0});
      assert.ok(listed.media.some(row => key(row.id) === key(id)));
      await forbidden(sdk.listWebsiteMedia, "owner-b", {organizationId: f.orgA, limit: 60, offset: 0});
      const byIds = await run(sdk.getWebsiteMediaByIds, "agent-a", {organizationId: f.orgA, ids: [id]});
      assert.equal(byIds.media[0].storagePath, storagePath);
      await forbidden(sdk.getWebsiteMediaByIds, "owner-b", {organizationId: f.orgA, ids: [id]});
      await assert.rejects(run(sdk.updateWebsiteMediaAlt, "agent-a", {organizationId: f.orgA, id, alt: "Not mine"}), "agents cannot edit others' uploads");
      await run(sdk.updateWebsiteMediaAlt, "manager-a", {organizationId: f.orgA, id, alt: "Lobby at dusk"});
      await assert.rejects(run(sdk.archiveWebsiteMedia, "owner-b", {organizationId: f.orgA, id}), "another company cannot archive");
      await run(sdk.archiveWebsiteMedia, "admin-a", {organizationId: f.orgA, id});
      listed = await run(sdk.listWebsiteMedia, "manager-a", {organizationId: f.orgA, limit: 60, offset: 0});
      assert.ok(!listed.media.some(row => key(row.id) === key(id)), "archived uploads leave the library");
      const archived = await run(sdk.getWebsiteMediaByIds, "manager-a", {organizationId: f.orgA, ids: [id]});
      assert.equal(archived.media[0].status, "ARCHIVED", "pages already using it can still be published");
    });

    it("keeps saved sections per company; authors or administrators delete them", async () => {
      const section = JSON.stringify({id: "faq-saved", type: "FAQ"});
      const id = randomUUID();
      await run(sdk.createWebsiteSectionTemplate, "manager-a", {organizationId: f.orgA, id, name: "Common questions", category: "General", sectionType: "FAQ", sectionData: section});
      await forbidden(sdk.createWebsiteSectionTemplate, "owner-b", {organizationId: f.orgA, id: randomUUID(), name: "B", category: "General", sectionType: "FAQ", sectionData: section});
      const listed = await run(sdk.listWebsiteSectionTemplates, "agent-a", {organizationId: f.orgA});
      assert.ok(listed.templates.some(row => key(row.id) === key(id)));
      await forbidden(sdk.listWebsiteSectionTemplates, "owner-b", {organizationId: f.orgA});
      await assert.rejects(run(sdk.deleteWebsiteSectionTemplate, "agent-a", {organizationId: f.orgA, id}), "only the author or an administrator deletes");
      await run(sdk.deleteWebsiteSectionTemplate, "manager-a", {organizationId: f.orgA, id});
      assert.ok(!(await run(sdk.listWebsiteSectionTemplates, "owner-a", {organizationId: f.orgA})).templates.some(row => key(row.id) === key(id)));
    });
  });
}
