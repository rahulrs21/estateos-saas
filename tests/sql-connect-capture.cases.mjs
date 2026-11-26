import assert from "node:assert/strict";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { before, describe, it } from "node:test";
import { fixture as f } from "./fixtures/sql-connect-fixtures.mjs";

const fields = [
  { key: "FULL_NAME", label: "Full name", enabled: true, required: true },
  { key: "EMAIL", label: "Email", enabled: true, required: false },
  { key: "PHONE", label: "Phone", enabled: true, required: false },
  { key: "MESSAGE", label: "Message", enabled: true, required: false },
];
const digest = (value) => createHash("sha256").update(value).digest("hex");
const uuid = (value) => String(value).replaceAll("-", "").toLowerCase();

export function registerCaptureCases({ sdk, run, forbidden, dc }) {
  describe("Phase 4D website lead capture and reporting", { concurrency: false }, () => {
    const suffix = randomUUID();
    let formId; let publicId; let sourceId; let disabledPublicId;

    const makeForm = async (status, name) => {
      const publicToken = randomBytes(32).toString("base64url");
      const created = await run(sdk.createLeadCaptureForm, "owner-a", {
        organizationId: f.orgA, publicId: publicToken, name: `${name}-${suffix.slice(0, 8)}`,
        status: sdk.LeadCaptureFormStatus[status], sourceName: `Website - ${name} - ${publicToken.slice(0, 8)}`,
        branchId: null, projectId: null, fields,
        consentText: "I agree that this agency may contact me about my property inquiry.",
        privacyPolicyUrl: "https://agency.example/privacy",
        successMessage: "Thank you. Your inquiry was received.",
      });
      return { id: created.form.id, publicId: publicToken, sourceId: created.source.id };
    };
    const noAccess = async (operation, variables) => (await operation(dc, variables)).data;

    before(async () => {
      const active = await makeForm("ACTIVE", "Website inquiry");
      formId = active.id; publicId = active.publicId; sourceId = active.sourceId;
      const disabled = await makeForm("DISABLED", "Disabled inquiry");
      disabledPublicId = disabled.publicId;
    });

    it("only a verified company administrator can manage tenant forms", async () => {
      await forbidden(sdk.createLeadCaptureForm, "agent-a", {
        organizationId: f.orgA, publicId: randomBytes(32).toString("base64url"), name: `Agent form-${suffix}`,
        status: sdk.LeadCaptureFormStatus.DRAFT, sourceName: `Agent website ${suffix}`, fields,
        consentText: "Consent", privacyPolicyUrl: "https://agency.example/privacy", successMessage: "Thanks",
      });
      const listed = await run(sdk.listLeadCaptureForms, "owner-a", { organizationId: f.orgA, limit: 100, offset: 0 });
      assert.ok(listed.forms.some((entry) => entry.id === formId));
      assert.ok(listed.forms.every((entry) => uuid(entry.organizationId) === uuid(f.orgA)), JSON.stringify(listed.forms.map((entry) => entry.organizationId)));
      const companyB = await run(sdk.listLeadCaptureForms, "owner-b", { organizationId: f.orgB, limit: 100, offset: 0 });
      assert.equal(companyB.forms.some((entry) => entry.id === formId), false);
      await assert.rejects(() => noAccess(sdk.resolveWebsiteLeadCaptureForm, { publicId: disabledPublicId }));
    });

    it("submits a valid inquiry atomically with contact, lead, source, consent, attribution and notification", async () => {
      const rawIdempotencyKey = randomUUID().replaceAll("-", "");
      const keyHash = digest(rawIdempotencyKey);
      const variables = {
        organizationId: f.orgA, formId, publicId, idempotencyKeyHash: keyHash,
        fullName: "Website Buyer " + suffix.slice(0, 6), email: `Buyer-${suffix}@Example.test`, phone: "+971 50 123 4567",
        normalizedEmail: `buyer-${suffix}@example.test`, normalizedPhone: "+971501234567", contactId: null, hasExistingContact: false,
        message: "Looking for a two bedroom property", propertyInterest: "Two bedroom apartment", preferredLocation: "Dubai Marina",
        propertyType: "Apartment", transactionType: sdk.TransactionType.BUY, budgetMin: 800000, budgetMax: 1200000,
        currency: "AED", bedroomPreference: "2", landingPageUrl: "https://agency.example/dubai?utm_source=referral",
        utmSource: "referral", utmMedium: "website", utmCampaign: "dubai-property", utmContent: "hero-form", utmTerm: "apartment",
        consentTextSnapshot: "I agree that this agency may contact me about my property inquiry.",
        privacyPolicyUrlSnapshot: "https://agency.example/privacy", assignedMembershipId: null,
        distributionRuleId: null, expectedCursorVersion: null, hasAutoAssignment: false, hasDistributionAttempt: false,
      };
      const created = await noAccess(sdk.submitWebsiteLeadCapture, variables);
      const lead = (await run(sdk.getLead, "owner-a", { organizationId: f.orgA, leadId: created.lead.id })).lead;
      assert.equal(lead.sourceId, sourceId);
      assert.equal(lead.contact.fullName, variables.fullName);
      assert.equal(lead.contact.email, variables.email);
      assert.equal(lead.status, "NEW");
      assert.equal(lead.propertyInterest, "Two bedroom apartment");
      const stored = (await noAccess(sdk.findWebsiteLeadCaptureSubmission, { organizationId: f.orgA, formId, idempotencyKeyHash: keyHash })).submission;
      assert.equal(stored.leadId, created.lead.id);
      assert.equal(stored.utmSource, "referral");
      assert.equal(stored.utmCampaign, "dubai-property");
      assert.equal(stored.landingPageUrl, variables.landingPageUrl);
      assert.equal(stored.consentGiven, true);
      assert.equal(stored.consentTextSnapshot, variables.consentTextSnapshot);
      assert.equal(stored.privacyPolicyUrlSnapshot, variables.privacyPolicyUrlSnapshot);
      const notifications = await run(sdk.listInAppNotifications, "owner-a", { organizationId: f.orgA, limit: 50, offset: 0 });
      assert.ok(notifications.notifications.some((item) => item.lead?.id === created.lead.id && item.type === "LEAD_UNASSIGNED"));
      // Phase 7E: the lead's attribution was written in the same transaction; the defaults apply when not given.
      const attribution = (await run(sdk.getLeadAttribution, "owner-a", { organizationId: f.orgA, leadId: created.lead.id })).attribution;
      assert.deepEqual({ channel: attribution.channel, platform: attribution.platform, campaign: attribution.utmCampaign, term: attribution.utmTerm },
        { channel: "WEBSITE_FORM", platform: "direct", campaign: "dubai-property", term: "apartment" });
      await forbidden(sdk.getLeadAttribution, "owner-b", { organizationId: f.orgB, leadId: created.lead.id });
      await forbidden(sdk.getLeadAttribution, "agent-a", { organizationId: f.orgA, leadId: created.lead.id });
      // A landing page enquiry with click IDs: channel, platform, campaign key, landing page and referrer host as given.
      const landing = await noAccess(sdk.submitWebsiteLeadCapture, { ...variables, idempotencyKeyHash: digest(randomUUID()), email: `Landing-${suffix}@Example.test`, normalizedEmail: `landing-${suffix}@example.test`, phone: null, normalizedPhone: null,
        channel: sdk.LeadChannel.LANDING_PAGE, platform: "google", campaignKey: "dubai property", landingHost: "agency.example", landingPath: "/dubai", referrerHost: "www.google.com", gclid: "Cj0KCQ_test" });
      const landed = (await run(sdk.getLeadAttribution, "owner-a", { organizationId: f.orgA, leadId: landing.lead.id })).attribution;
      assert.deepEqual({ channel: landed.channel, platform: landed.platform, key: landed.campaignKey, host: landed.landingHost, path: landed.landingPath, referrer: landed.referrerHost, gclid: landed.gclid },
        { channel: "LANDING_PAGE", platform: "google", key: "dubai property", host: "agency.example", path: "/dubai", referrer: "www.google.com", gclid: "Cj0KCQ_test" });
      // A retry with the same key cannot commit another lead; the HTTP service
      // detects the saved key first and returns an idempotent acknowledgement.
      await assert.rejects(() => noAccess(sdk.submitWebsiteLeadCapture, variables));
      const replay = (await noAccess(sdk.findWebsiteLeadCaptureSubmission, { organizationId: f.orgA, formId, idempotencyKeyHash: keyHash })).submission;
      assert.equal(replay.leadId, created.lead.id);
    });

    it("prevents cross-company form lookup/submission and rejects disabled forms", async () => {
      const wrongTenant = await noAccess(sdk.findWebsiteLeadCaptureSubmission, { organizationId: f.orgB, formId, idempotencyKeyHash: "0".repeat(64) });
      assert.equal(wrongTenant.submission, null);
      await assert.rejects(() => noAccess(sdk.submitWebsiteLeadCapture, {
        organizationId: f.orgB, formId, publicId, idempotencyKeyHash: "1".repeat(64), fullName: "Cross tenant",
        email: "cross@example.test", normalizedEmail: "cross@example.test", hasExistingContact: false,
        consentTextSnapshot: "I agree that this agency may contact me about my property inquiry.",
        privacyPolicyUrlSnapshot: "https://agency.example/privacy", currency: "AED", utmTerm: "",
        hasAutoAssignment: false, hasDistributionAttempt: false,
      }));
    });

    it("uses a persistent compare-and-set form rate window", async () => {
      const windowStart = new Date(Math.floor(Date.now() / 60_000) * 60_000).toISOString();
      for (let expected = 0; expected < 30; expected += 1) {
        const state = await noAccess(sdk.getWebsiteLeadCaptureRateWindow, { organizationId: f.orgA, formId, windowStart });
        await noAccess(sdk.consumeWebsiteLeadCaptureRateWindow, {
          organizationId: f.orgA, formId, windowStart, requestLimit: 30,
          windowExists: Boolean(state.window), observedCount: state.window?.requestCount ?? 0,
        });
      }
      const exhausted = await noAccess(sdk.getWebsiteLeadCaptureRateWindow, { organizationId: f.orgA, formId, windowStart });
      assert.equal(exhausted.window.requestCount, 30);
      await assert.rejects(() => noAccess(sdk.consumeWebsiteLeadCaptureRateWindow, {
        organizationId: f.orgA, formId, windowStart, requestLimit: 30, windowExists: true, observedCount: 30,
      }));
    });

    it("round-robins form leads and stores the assignment notification", async () => {
      await run(sdk.saveLeadDistributionSettings, "owner-a", {
        organizationId: f.orgA, ruleId: randomUUID(), hasExistingRule: false, hasCursor: false,
        expectedUpdatedAt: new Date().toISOString(), enabled: true, mode: sdk.LeadDistributionMode.ROUND_ROBIN,
        branchId: null, projectId: null, skipUnavailable: true, businessHoursEnabled: false,
        timeZone: "Asia/Dubai", businessDaysMask: 62, businessStart: "09:00", businessEnd: "18:00",
        reassignmentTimeoutMinutes: 1440, eligibleAgentIds: [f.memberAgentA],
      });
      const plan = await noAccess(sdk.getWebsiteLeadDistributionPlan, { organizationId: f.orgA });
      assert.ok(plan.rule?.cursor);
      const keyHash = digest(randomUUID());
      const created = await noAccess(sdk.submitWebsiteLeadCapture, {
        organizationId: f.orgA, formId, publicId, idempotencyKeyHash: keyHash,
        fullName: "Assigned capture " + suffix.slice(0, 6), email: `assigned-${suffix}@example.test`, normalizedEmail: `assigned-${suffix}@example.test`,
        phone: null, normalizedPhone: null, contactId: null, hasExistingContact: false, message: null,
        currency: "AED", utmTerm: "", consentTextSnapshot: "I agree that this agency may contact me about my property inquiry.",
        privacyPolicyUrlSnapshot: "https://agency.example/privacy", assignedMembershipId: plan.eligibleAgents[0].id,
        distributionRuleId: plan.rule.id, expectedCursorVersion: plan.rule.cursor.version,
        hasAutoAssignment: true, hasDistributionAttempt: true,
      });
      const lead = (await run(sdk.getLead, "owner-a", { organizationId: f.orgA, leadId: created.lead.id })).lead;
      assert.equal(uuid(lead.assignedMembershipId), uuid(f.memberAgentA));
      const inbox = await run(sdk.listInAppNotifications, "agent-a", { organizationId: f.orgA, limit: 50, offset: 0 });
      assert.ok(inbox.notifications.some((item) => item.lead?.id === created.lead.id && item.type === "LEAD_ASSIGNED"));
      const timeline = await run(sdk.getLeadCrmHistory, "owner-a", { organizationId: f.orgA, leadId: created.lead.id });
      assert.ok(timeline.assignments.some((item) => item.assignmentType === "ROUND_ROBIN"));
    });

    it("reports tenant-scoped date/source/stage metrics using real stored leads", async () => {
      const now = Date.now();
      const result = await run(sdk.getLeadAnalytics, "owner-a", {
        organizationId: f.orgA, from: new Date(now - 86_400_000).toISOString(), to: new Date(now + 86_400_000).toISOString(),
        timeZone: "Asia/Dubai", bucket: "day", sourceId, pipelineStageId: null, assignedMembershipId: null,
      });
      assert.ok(Number(result.summary?.total_leads ?? 0) >= 2);
      assert.ok(result.sources.some((row) => row.label.startsWith("Website -")));
      const otherCompany = await run(sdk.getLeadAnalytics, "owner-b", {
        organizationId: f.orgB, from: new Date(now - 86_400_000).toISOString(), to: new Date(now + 86_400_000).toISOString(),
        // Filter on Company A's uniquely created source. Company B may have
        // unrelated seeded leads, but must never see this tenant's attribution.
        timeZone: "UTC", bucket: "day", sourceId, pipelineStageId: null, assignedMembershipId: null,
      });
      assert.equal(Number(otherCompany.summary?.total_leads ?? 0), 0);
    });
  });

  // Phase 7E.3 (docs/LEAD_ATTRIBUTION_PLAN.md): the source of leads added by hand, and the Channel and Campaign filters.
  describe("Phase 7E.3 lead sources in the CRM", { concurrency: false }, () => {
    const tag = randomBytes(3).toString("hex");
    const NAME = `Spring_Open House ${tag}`, KEY = `spring open house ${tag}`;
    const created = [];
    const make = async (extra = {}) => {
      const id = (await run(sdk.createLead, "owner-a", { organizationId: f.orgA, fullName: `Source ${randomUUID().slice(0, 6)}`, assignedMembershipId: f.memberAgentA, ...extra })).lead.id;
      created.push(id);
      return id;
    };
    const sourceOf = async (id) => (await dc.executeGraphql(`query S($lead: UUID!) { leadAttributions(where: {leadId: {eq: $lead}}) { channel platform utmCampaign campaignKey } }`, { variables: { lead: id } })).data.leadAttributions;
    const list = (uid, extra = {}) => run(sdk.listLeads, uid, { organizationId: f.orgA, limit: 100, ...extra });
    const ids = (rows) => rows.map((row) => uuid(row.id));
    let tagged, plain, unrecorded, second;

    it("records a lead added by hand as MANUAL with the campaign chosen, for a new contact and an existing one", async () => {
      tagged = await make({ campaign: NAME, campaignKey: KEY });
      plain = await make();
      unrecorded = await make();
      // Stands in for a lead created before sources were recorded.
      await dc.executeGraphql(`mutation D($lead: UUID!) { leadAttribution_deleteMany(where: {leadId: {eq: $lead}}) }`, { variables: { lead: unrecorded } });
      assert.deepEqual(await sourceOf(tagged), [{ channel: "MANUAL", platform: "direct", utmCampaign: NAME, campaignKey: KEY }]);
      assert.deepEqual(await sourceOf(plain), [{ channel: "MANUAL", platform: "direct", utmCampaign: null, campaignKey: null }]);
      const contactId = (await run(sdk.getLead, "owner-a", { organizationId: f.orgA, leadId: plain })).lead.contactId;
      second = (await run(sdk.createLeadForContact, "owner-a", { organizationId: f.orgA, contactId, assignedMembershipId: f.memberAgentA, campaign: NAME, campaignKey: KEY })).lead.id;
      created.push(second);
      assert.deepEqual(await sourceOf(second), [{ channel: "MANUAL", platform: "direct", utmCampaign: NAME, campaignKey: KEY }]);
      await forbidden(sdk.createLead, "owner-a", { organizationId: f.orgA, fullName: "Too long", campaign: "x".repeat(201) });
    });

    it("filters the list by channel and campaign, and never hides leads without a source when no source filter is chosen", async () => {
      const all = await list("owner-a");
      assert.ok([tagged, plain, unrecorded].every((id) => ids(all.leads).includes(uuid(id))), "leads without a source are listed");
      const row = all.leads.find((lead) => uuid(lead.id) === uuid(tagged));
      assert.deepEqual(row.leadAttribution_on_lead, { channel: "MANUAL", platform: "direct", campaignKey: KEY, utmCampaign: NAME, metaCampaignName: null, metaAdName: null }, "each row carries its source");
      assert.equal(all.leads.find((lead) => uuid(lead.id) === uuid(unrecorded)).leadAttribution_on_lead, null);

      const manual = await list("owner-a", { channel: sdk.LeadChannel.MANUAL, sourceFiltered: true });
      assert.ok(ids(manual.leads).includes(uuid(tagged)) && ids(manual.leads).includes(uuid(plain)));
      assert.ok(!ids(manual.leads).includes(uuid(unrecorded)), "a channel filter only matches leads with that recorded channel");
      assert.equal(manual.total[0].count, manual.leads.length, "the count uses the same filter");
      const campaign = await list("owner-a", { campaignKey: KEY, sourceFiltered: true });
      assert.deepEqual(new Set(ids(campaign.leads)), new Set([uuid(tagged), uuid(second)]));
      assert.equal((await list("owner-a", { channel: sdk.LeadChannel.WEBSITE_FORM, campaignKey: KEY, sourceFiltered: true })).leads.length, 0, "both filters apply together");
      assert.equal((await list("agent-a", { campaignKey: KEY, sourceFiltered: true })).leads.length, 2, "the assigned agent sees their leads of the campaign");
      assert.equal((await list("shared-agent", { campaignKey: KEY, sourceFiltered: true })).leads.length, 0, "other agents see none");
      await forbidden(sdk.listLeads, "owner-a", { organizationId: f.orgA, limit: 10, sourceFiltered: true });
      await forbidden(sdk.listLeads, "owner-a", { organizationId: f.orgA, limit: 10, campaignKey: "x".repeat(201), sourceFiltered: true });
    });

    it("offers each member only the campaigns of the leads they may see", async () => {
      const keys = async (uid) => (await run(sdk.leadCampaignOptions, uid, { organizationId: f.orgA })).campaigns.map((row) => row.campaignKey);
      assert.ok((await keys("owner-a")).includes(KEY));
      assert.ok((await keys("agent-a")).includes(KEY), "the assigned agent");
      assert.ok(!(await keys("shared-agent")).includes(KEY), "not another agent");
      await forbidden(sdk.leadCampaignOptions, "owner-b", { organizationId: f.orgA });
      // These synthetic leads are archived so later lead counts are unchanged.
      for (const leadId of created) await run(sdk.archiveLead, "owner-a", { organizationId: f.orgA, leadId });
    });
  });

  // Phase 7E.4 (docs/LEAD_ATTRIBUTION_PLAN.md): "Where leads come from" on the reports page, and workflow facts.
  describe("Phase 7E.4 lead source reports", { concurrency: false }, () => {
    const tag = randomBytes(3).toString("hex");
    const KEY = `report launch ${tag}`, NAME = `Report_Launch ${tag}`;
    const created = [];
    const from = new Date(Date.now() - 60_000).toISOString(), to = new Date(Date.now() + 3_600_000).toISOString();
    const report = async (uid, extra = {}) => run(sdk.getLeadSourceReport, uid, { organizationId: f.orgA, from, to, ...extra });
    const channel = (data, name) => data.channels.find((row) => row.channel === name) ?? { leads: 0, qualified: 0, won: 0 };
    const counts = (row) => ({ leads: Number(row.leads), qualified: Number(row.qualified), won: Number(row.won) });
    const make = async (assignedMembershipId, extra = {}) => {
      const id = (await run(sdk.createLead, "owner-a", { organizationId: f.orgA, fullName: `Report ${randomUUID().slice(0, 6)}`, assignedMembershipId, ...extra })).lead.id;
      created.push(id);
      return id;
    };

    it("counts leads, qualified and won by channel and by campaign, with leads without a source as UNRECORDED", async () => {
      const before = await report("owner-a");
      const won = await make(f.memberAgentA, { campaign: NAME, campaignKey: KEY });
      const qualified = await make(f.memberSharedA, { campaign: NAME, campaignKey: KEY });
      const unrecorded = await make(f.memberAgentA);
      await dc.executeGraphql(`mutation D($lead: UUID!) { leadAttribution_deleteMany(where: {leadId: {eq: $lead}}) }`, { variables: { lead: unrecorded } });
      await run(sdk.changeLeadStatus, "owner-a", { organizationId: f.orgA, leadId: won, status: sdk.LeadStatus.WON });
      await run(sdk.changeLeadStatus, "owner-a", { organizationId: f.orgA, leadId: qualified, status: sdk.LeadStatus.NEGOTIATION });

      const after = await report("owner-a");
      const delta = (name) => { const a = counts(channel(after, name)), b = counts(channel(before, name)); return { leads: a.leads - b.leads, qualified: a.qualified - b.qualified, won: a.won - b.won }; };
      assert.deepEqual(delta("MANUAL"), { leads: 2, qualified: 2, won: 1 }, "won counts as qualified too");
      assert.deepEqual(delta("UNRECORDED"), { leads: 1, qualified: 0, won: 0 });
      const campaign = after.campaigns.find((row) => row.key === KEY);
      assert.deepEqual({ label: campaign.label, channel: campaign.channel, channels: Number(campaign.channels), ...counts(campaign) },
        { label: NAME, channel: "MANUAL", channels: 1, leads: 2, qualified: 2, won: 1 }, "a campaign is named by its newest name");

      // Members other than owners and admins report on their own leads only; filters narrow the same way.
      const agent = await report("agent-a");
      assert.deepEqual(counts(agent.campaigns.find((row) => row.key === KEY)), { leads: 1, qualified: 1, won: 1 }, "the agent sees only their lead");
      assert.equal((await report("shared-agent")).campaigns.find((row) => row.key === KEY)?.leads ?? 0, 1);
      assert.equal(counts((await report("owner-a", { assignedMembershipId: f.memberAgentA })).campaigns.find((row) => row.key === KEY)).leads, 1);
      await forbidden(sdk.getLeadSourceReport, "owner-b", { organizationId: f.orgA, from, to });
      await forbidden(sdk.getLeadSourceReport, "owner-a", { organizationId: f.orgA, from: to, to: from });
    });

    it("gives workflows the lead's channel, platform and campaign", async () => {
      const facts = await run(sdk.automationFacts, "owner-a", { organizationId: f.orgA, since: from, leadId: created[0], hasLead: true, hasListing: false, hasViewing: false,
        hasFollowUp: false, hasWorkTask: false, hasContact: false });
      assert.deepEqual(facts.lead.origin, { channel: "MANUAL", platform: "direct", campaignKey: KEY });
      const none = await run(sdk.automationFacts, "owner-a", { organizationId: f.orgA, since: from, leadId: created[2], hasLead: true, hasListing: false, hasViewing: false,
        hasFollowUp: false, hasWorkTask: false, hasContact: false });
      assert.equal(none.lead.origin, null, "a lead without a recorded source has none");
      // These synthetic leads are archived so later lead counts are unchanged.
      for (const leadId of created) await run(sdk.archiveLead, "owner-a", { organizationId: f.orgA, leadId });
    });
  });

  // Phase 7E.5 (docs/LEAD_ATTRIBUTION_PLAN.md): filling the sources of leads created before sources were recorded.
  describe("Phase 7E.5 filling older leads' sources", { concurrency: false }, () => {
    const gql = async (query, variables = {}) => (await dc.executeGraphql(query, { variables })).data;
    const dropSource = (lead) => gql(`mutation D($lead: UUID!) { leadAttribution_deleteMany(where: {leadId: {eq: $lead}}) }`, { lead });
    const sourceOf = async (lead) => (await gql(`query S($lead: UUID!) { leadAttributions(where: {leadId: {eq: $lead}}) { channel platform utmSource utmCampaign campaignKey metaCampaignId metaAdsetId metaAdId metaAdName metaFormId landingHost landingPath referrerHost ctwaClid } }`, { lead })).leadAttributions;
    const preview = async (uid) => Object.fromEntries((await run(sdk.leadSourceBackfillPreview, uid, { organizationId: f.orgA })).channels.map((row) => [row.channel, Number(row.leads)]));
    const created = [];
    const older = async (name) => {
      const id = (await run(sdk.createLead, "owner-a", { organizationId: f.orgA, fullName: `${name} ${randomUUID().slice(0, 6)}`, assignedMembershipId: f.memberAgentA })).lead.id;
      created.push(id);
      await dropSource(id);
      return id;
    };
    let ids = {};

    it("previews and fills each older lead's source from its own history, and never changes an existing source", async () => {
      const before = await preview("owner-a");
      const form = (await gql(`query F($org: UUID!) { leadCaptureForms(where: {organizationId: {eq: $org}}, limit: 1) { id sourceId } }`, { org: f.orgA })).leadCaptureForms[0];
      assert.ok(form, "a website form from the earlier cases");
      const submission = (lead, landingPageUrl, utm) => gql(`mutation S($org: UUID!, $form: UUID!, $source: UUID!, $lead: UUID!, $hash: String!, $url: String, $utmSource: String, $utmMedium: String, $utmCampaign: String) {
        leadCaptureSubmission_insert(data: {organizationId: $org, formId: $form, sourceId: $source, leadId: $lead, idempotencyKeyHash: $hash, landingPageUrl: $url, utmSource: $utmSource, utmMedium: $utmMedium, utmCampaign: $utmCampaign,
          consentTextSnapshot: "I agree (synthetic).", privacyPolicyUrlSnapshot: "https://agency.example.test/privacy"}) }`,
        { org: f.orgA, form: form.id, source: form.sourceId, lead, hash: digest(randomUUID()), url: landingPageUrl, utmSource: utm.source ?? null, utmMedium: utm.medium ?? null, utmCampaign: utm.campaign ?? null });

      ids.web = await older("Older website");
      await submission(ids.web, "https://agency.example.test/off-plan/?utm_source=x#top", { source: "google", medium: "cpc", campaign: "Creek_Harbour+Launch" });
      ids.page = await older("Older landing page");
      await submission(ids.page, "https://crm.example.test/site/local-agency-a/marina-launch", { source: "Instagram", campaign: "Marina Launch" });
      ids.meta = await older("Older Meta lead");
      await gql(`mutation A($org: UUID!, $lead: UUID!, $metadata: Any!) { activity_insert(data: {organizationId: $org, actorUid: "owner-a", kind: AD_LEAD_CAPTURED, leadId: $lead, targetId: $lead, metadata: $metadata}) }`,
        { org: f.orgA, lead: ids.meta, metadata: { source: "META_LEAD_ADS", campaignId: "120200000000000101", adsetId: "120200000000000102", adId: "120200000000000103", formId: "998877665544", leadgenId: "1" } });
      // A WhatsApp ad conversation that began before its lead was created, then linked to it.
      const conversation = randomUUID();
      await sdk.createInboxConversationWithMessage(dc, { organizationId: f.orgA, conversationId: conversation, channelConnectionId: null, channel: sdk.InboxChannel.WHATSAPP, externalThreadId: `thread-${randomUUID()}`,
        customerIdentity: "+447700900681", customerName: "Older ad customer", subject: null, contactId: null, leadId: null, assignedMembershipId: null, messageId: randomUUID(), externalMessageId: `wamid.${randomUUID()}`,
        messageType: sdk.InboxMessageType.TEXT, content: "Hi", senderIdentity: "+447700900681", recipientIdentity: null, providerTimestamp: null, preview: "Hi", simulated: false, optedOut: false,
        setReferral: true, adSourceId: "120200000000000555", adSourceType: "ad", adHeadline: "Older ad headline", adBody: null, adSourceHost: "fb.me", adSourcePath: "/older", adCtwaClid: "ARAolder-ctwa", adCampaignKey: "older ad headline" });
      ids.chat = await older("Older WhatsApp ad");
      await gql(`mutation L($org: UUID!, $id: UUID!, $lead: UUID!) { inboxConversation_update(key: {organizationId: $org, id: $id}, data: {leadId: $lead}) }`, { org: f.orgA, id: conversation, lead: ids.chat });
      ids.manual = await older("Older manual");
      // A conversation that began after its lead: the lead did not come from it, so it was added by hand.
      ids.linkedLater = await older("Older linked later");
      const later = randomUUID();
      await sdk.createInboxConversationWithMessage(dc, { organizationId: f.orgA, conversationId: later, channelConnectionId: null, channel: sdk.InboxChannel.WHATSAPP, externalThreadId: `thread-${randomUUID()}`,
        customerIdentity: "+447700900682", customerName: null, subject: null, contactId: null, leadId: ids.linkedLater, assignedMembershipId: null, messageId: randomUUID(), externalMessageId: `wamid.${randomUUID()}`,
        messageType: sdk.InboxMessageType.TEXT, content: "Hello", senderIdentity: "+447700900682", recipientIdentity: null, providerTimestamp: null, preview: "Hello", simulated: false, optedOut: false });
      // A lead that already has a source keeps it.
      ids.kept = (await run(sdk.createLead, "owner-a", { organizationId: f.orgA, fullName: `Kept ${randomUUID().slice(0, 6)}`, assignedMembershipId: f.memberAgentA, campaign: "Kept campaign", campaignKey: "kept campaign" })).lead.id;
      created.push(ids.kept);

      const after = await preview("owner-a");
      const delta = (channel) => (after[channel] ?? 0) - (before[channel] ?? 0);
      assert.deepEqual({ web: delta("WEBSITE_FORM"), page: delta("LANDING_PAGE"), meta: delta("META_LEAD_AD"), ad: delta("WHATSAPP_AD"), manual: delta("MANUAL") },
        { web: 1, page: 1, meta: 1, ad: 1, manual: 2 }, "the preview shows what the fill will do");
      await forbidden(sdk.leadSourceBackfillPreview, "agent-a", { organizationId: f.orgA });
      await forbidden(sdk.leadSourceBackfillPreview, "manager-a", { organizationId: f.orgA });
      await forbidden(sdk.backfillLeadSources, "agent-a", { organizationId: f.orgA });
      await forbidden(sdk.backfillLeadSources, "owner-b", { organizationId: f.orgA });

      const total = Object.values(after).reduce((sum, value) => sum + value, 0);
      const filled = await run(sdk.backfillLeadSources, "admin-a", { organizationId: f.orgA });
      assert.equal(Number(filled.filled), total, "the fill covers exactly what the preview showed");
      assert.deepEqual(await preview("owner-a"), {}, "nothing is left without a source");
      assert.equal(Number((await run(sdk.backfillLeadSources, "owner-a", { organizationId: f.orgA })).filled), 0, "running it again changes nothing");

      const none = { utmSource: null, utmCampaign: null, campaignKey: null, metaCampaignId: null, metaAdsetId: null, metaAdId: null, metaAdName: null, metaFormId: null, landingHost: null, landingPath: null, referrerHost: null, ctwaClid: null };
      assert.deepEqual(await sourceOf(ids.web), [{ ...none, channel: "WEBSITE_FORM", platform: "google", utmSource: "google", utmCampaign: "Creek_Harbour+Launch", campaignKey: "creek harbour launch",
        landingHost: "agency.example.test", landingPath: "/off-plan/" }], "the URL keeps host and path only");
      assert.deepEqual(await sourceOf(ids.page), [{ ...none, channel: "LANDING_PAGE", platform: "meta", utmSource: "Instagram", utmCampaign: "Marina Launch", campaignKey: "marina launch",
        landingHost: "crm.example.test", landingPath: "/site/local-agency-a/marina-launch" }]);
      assert.deepEqual(await sourceOf(ids.meta), [{ ...none, channel: "META_LEAD_AD", platform: "meta", campaignKey: "meta campaign 120200000000000101", metaCampaignId: "120200000000000101",
        metaAdsetId: "120200000000000102", metaAdId: "120200000000000103", metaFormId: "998877665544" }]);
      assert.deepEqual(await sourceOf(ids.chat), [{ ...none, channel: "WHATSAPP_AD", platform: "meta", campaignKey: "older ad headline", metaAdId: "120200000000000555", metaAdName: "Older ad headline",
        referrerHost: "fb.me", ctwaClid: "ARAolder-ctwa" }]);
      assert.deepEqual(await sourceOf(ids.manual), [{ ...none, channel: "MANUAL", platform: "direct" }]);
      assert.deepEqual(await sourceOf(ids.linkedLater), [{ ...none, channel: "MANUAL", platform: "direct" }]);
      assert.deepEqual(await sourceOf(ids.kept), [{ ...none, channel: "MANUAL", platform: "direct", utmCampaign: "Kept campaign", campaignKey: "kept campaign" }]);
      const audit = (await gql(`query A($org: UUID!) { auditLogs(where: {organizationId: {eq: $org}, action: {eq: LEAD_SOURCES_FILLED}}, orderBy: [{createdAt: ASC}]) { actorUid metadata } }`, { org: f.orgA })).auditLogs;
      assert.deepEqual(audit.map((row) => [row.actorUid, Number(row.metadata.filled)]), [["admin-a", total], ["owner-a", 0]], "each fill is audited");
      // The synthetic conversations are unlinked and the leads archived, so later inbox and lead counts are unchanged.
      for (const id of [conversation, later]) await gql(`mutation U($org: UUID!, $id: UUID!) { inboxConversation_update(key: {organizationId: $org, id: $id}, data: {leadId: null}) }`, { org: f.orgA, id });
      for (const leadId of created) await run(sdk.archiveLead, "owner-a", { organizationId: f.orgA, leadId });
    });
  });

  // Phase 7F.1 (docs/CAMPAIGNS_PLAN.md): campaigns, spend and cost per lead.
  describe("Phase 7F.1 campaigns and spend", { concurrency: false }, () => {
    const gql = async (query, variables = {}) => (await dc.executeGraphql(query, { variables })).data;
    const tag = randomBytes(3).toString("hex");
    const FOUND = `found in leads ${tag}`, ADDED = `spring open day ${tag}`;
    const period = { fromDate: "2026-11-01", toDate: "2026-11-10", from: "2026-10-31T20:00:00.000Z", to: "2026-11-10T20:00:00.000Z" };
    const perf = async (uid, extra = {}) => run(sdk.campaignPerformance, uid, { organizationId: f.orgA, ...period, campaignKey: null, ...extra });
    const spendOf = (data, key) => data.spend.filter((row) => row.key === key).map((row) => [row.currency, Number(row.amount_minor)]);
    const leads = [];
    let found, added;

    it("lists campaigns found in leads and added by hand, for owners, administrators and managers only", async () => {
      // A lead created inside the period, with a campaign typed by hand.
      const lead = (await run(sdk.createLead, "owner-a", { organizationId: f.orgA, fullName: `Campaign ${tag}`, assignedMembershipId: f.memberAgentA, campaign: "Found In Leads", campaignKey: FOUND })).lead.id;
      leads.push(lead);
      await gql(`mutation T($org: UUID!, $lead: UUID!) { lead_update(key: {organizationId: $org, id: $lead}, data: {createdAt: "2026-11-05T08:00:00.000Z"}) }`, { org: f.orgA, lead });
      const list = await perf("owner-a");
      found = list.campaigns.find((row) => row.key === FOUND);
      assert.deepEqual({ id: found.id, name: found.name, label: found.label, leads: Number(found.leads) }, { id: null, name: null, label: "Found In Leads", leads: 1 }, "found in leads, with no record yet");
      assert.ok((await perf("manager-a")).campaigns.some((row) => row.key === FOUND), "managers see campaigns");
      await forbidden(sdk.campaignPerformance, "agent-a", { organizationId: f.orgA, ...period, campaignKey: null });
      await forbidden(sdk.campaignPerformance, "owner-b", { organizationId: f.orgA, ...period, campaignKey: null });
      await forbidden(sdk.getCampaign, "agent-a", { organizationId: f.orgA, campaignKey: FOUND });

      added = randomUUID();
      await run(sdk.createCampaign, "owner-a", { organizationId: f.orgA, id: added, campaignKey: ADDED, name: "Spring Open Day", platform: "meta", status: sdk.CampaignStatus.ACTIVE, startsOn: "2026-11-01", endsOn: null,
        budgetMinor: "2500000", currency: "AED", hasOwner: true, ownerMembershipId: f.memberManagerA, notes: "Synthetic.", metaCampaignId: "120200000000000900", googleCampaignId: null, tiktokCampaignId: null });
      const row = (await perf("owner-a", { campaignKey: ADDED })).campaigns;
      assert.deepEqual(row.map((item) => [item.key, item.name, item.status, item.budget_minor, Number(item.leads)]), [[ADDED, "Spring Open Day", "ACTIVE", "2500000", 0]], "a campaign added before any lead");
      await assert.rejects(run(sdk.createCampaign, "admin-a", { organizationId: f.orgA, id: randomUUID(), campaignKey: ADDED, name: "Again", status: sdk.CampaignStatus.ACTIVE, currency: "AED", hasOwner: false }), "one campaign per key");
      await forbidden(sdk.createCampaign, "manager-a", { organizationId: f.orgA, id: randomUUID(), campaignKey: `m ${tag}`, name: "M", status: sdk.CampaignStatus.ACTIVE, currency: "AED", hasOwner: false });
      await assert.rejects(run(sdk.createCampaign, "owner-a", { organizationId: f.orgA, id: randomUUID(), campaignKey: `o ${tag}`, name: "O", status: sdk.CampaignStatus.ACTIVE, currency: "AED", hasOwner: true, ownerMembershipId: randomUUID() }),
        (error) => /CAMPAIGN_OWNER_INVALID|campaign_owner_fkey/.test(String(error?.message ?? error)), "the owner must be a member of the company");
      await forbidden(sdk.createCampaign, "owner-a", { organizationId: f.orgA, id: randomUUID(), campaignKey: `c ${tag}`, name: "C", status: sdk.CampaignStatus.ACTIVE, currency: "dirham", hasOwner: false });
    });

    it("counts each spend entry by its share of days in the period, never overlaps entries, and keeps currencies apart", async () => {
      const add = (uid, extra) => run(sdk.addCampaignSpend, uid, { organizationId: f.orgA, id: randomUUID(), campaignId: added, currency: "AED", note: null, ...extra });
      const month = randomUUID();
      await run(sdk.addCampaignSpend, "owner-a", { organizationId: f.orgA, id: month, campaignId: added, spentFrom: "2026-11-01", spentTo: "2026-11-30", amountMinor: "300000", currency: "AED", note: "November" });
      assert.deepEqual(spendOf(await perf("owner-a"), ADDED), [["AED", 100000]], "10 of November's 30 days");
      await assert.rejects(add("admin-a", { spentFrom: "2026-11-30", spentTo: "2026-12-05", amountMinor: "1000" }), (error) => String(error?.message ?? error).includes("CAMPAIGN_SPEND_OVERLAP"), "entries never overlap");
      await add("admin-a", { spentFrom: "2026-12-01", spentTo: "2026-12-31", amountMinor: "310000" });
      await assert.rejects(add("admin-a", { spentFrom: "2026-11-05", spentTo: "2026-11-05", amountMinor: "5000", currency: "USD" }), (error) => String(error?.message ?? error).includes("CAMPAIGN_SPEND_OVERLAP"), "another currency does not make an overlap allowed");
      await forbidden(sdk.addCampaignSpend, "manager-a", { organizationId: f.orgA, id: randomUUID(), campaignId: added, spentFrom: "2027-01-01", spentTo: "2027-01-02", amountMinor: "1", currency: "AED" });
      await forbidden(sdk.addCampaignSpend, "agent-a", { organizationId: f.orgA, id: randomUUID(), campaignId: added, spentFrom: "2027-01-01", spentTo: "2027-01-02", amountMinor: "1", currency: "AED" });
      const wide = await perf("manager-a", { fromDate: "2026-11-25", toDate: "2026-12-01", from: "2026-11-24T20:00:00.000Z", to: "2026-12-01T20:00:00.000Z" });
      assert.deepEqual(spendOf(wide, ADDED), [["AED", 70000]], "6 days of November and 1 of December");

      // Changing and removing entries: only MANUAL entries, only by owners and administrators, still never overlapping.
      await assert.rejects(run(sdk.updateCampaignSpend, "owner-a", { organizationId: f.orgA, id: month, spentFrom: "2026-11-01", spentTo: "2026-12-02", amountMinor: "300000", currency: "AED" }),
        (error) => String(error?.message ?? error).includes("CAMPAIGN_SPEND_OVERLAP"));
      await run(sdk.updateCampaignSpend, "owner-a", { organizationId: f.orgA, id: month, spentFrom: "2026-11-01", spentTo: "2026-11-10", amountMinor: "200000", currency: "AED", note: "Corrected" });
      assert.deepEqual(spendOf(await perf("owner-a"), ADDED), [["AED", 200000]]);
      await forbidden(sdk.deleteCampaignSpend, "manager-a", { organizationId: f.orgA, id: month });
      const detail = (await run(sdk.getCampaign, "manager-a", { organizationId: f.orgA, campaignKey: ADDED })).campaign;
      assert.deepEqual(detail.entries.map((entry) => [entry.spentFrom, entry.amountMinor, entry.source]), [["2026-12-01", "310000", "MANUAL"], ["2026-11-01", "200000", "MANUAL"]]);
      await run(sdk.deleteCampaignSpend, "owner-a", { organizationId: f.orgA, id: month });
      assert.deepEqual(spendOf(await perf("owner-a"), ADDED), [], "removed");
      await assert.rejects(run(sdk.deleteCampaignSpend, "owner-a", { organizationId: f.orgA, id: month }), (error) => String(error?.message ?? error).includes("CAMPAIGN_SPEND_NOT_FOUND"));
    });

    it("updates a campaign only at the revision it was read, and audits every change", async () => {
      await run(sdk.updateCampaign, "admin-a", { organizationId: f.orgA, id: added, expectedRevision: 1, name: "Spring Open Day (renamed)", platform: "meta", status: sdk.CampaignStatus.PAUSED, startsOn: "2026-11-01", endsOn: "2026-12-31",
        budgetMinor: null, currency: "AED", hasOwner: false, ownerMembershipId: null, notes: null, metaCampaignId: null, googleCampaignId: null, tiktokCampaignId: null });
      await assert.rejects(run(sdk.updateCampaign, "owner-a", { organizationId: f.orgA, id: added, expectedRevision: 1, name: "Stale", status: sdk.CampaignStatus.ACTIVE, currency: "AED", hasOwner: false }),
        (error) => String(error?.message ?? error).includes("CAMPAIGN_CHANGED"), "a stale edit is refused");
      const row = (await perf("owner-a", { campaignKey: ADDED })).campaigns[0];
      assert.deepEqual([row.key, row.name, row.status], [ADDED, "Spring Open Day (renamed)", "PAUSED"], "renaming keeps the key");
      const audit = (await gql(`query A($org: UUID!, $id: UUID!) { auditLogs(where: {organizationId: {eq: $org}, targetId: {eq: $id}, action: {in: [CAMPAIGN_CHANGED, CAMPAIGN_SPEND_CHANGED]}}) { action } }`, { org: f.orgA, id: added })).auditLogs;
      assert.ok(audit.filter((entry) => entry.action === "CAMPAIGN_CHANGED").length === 2 && audit.filter((entry) => entry.action === "CAMPAIGN_SPEND_CHANGED").length >= 4, "created, edited, and spend added, changed and removed");
      for (const leadId of leads) await run(sdk.archiveLead, "owner-a", { organizationId: f.orgA, leadId });
    });
  });

  // Phase 7F.2 (docs/CAMPAIGNS_PLAN.md): Meta ad accounts, synced spend and campaign names for leads.
  describe("Phase 7F.2 Meta ad accounts and synced spend", { concurrency: false }, () => {
    const gql = async (query, variables = {}) => (await dc.executeGraphql(query, { variables })).data;
    const server = async (operation, variables) => (await operation(dc, variables)).data;
    const rejectsWith = (promise, token) => assert.rejects(promise, (error) => String(error?.message ?? error).includes(token), token);
    const tag = String(Date.now()).slice(-9);
    const AD_ACCOUNT = `9${tag}`, META_CAMPAIGN = `12020${tag}1`, WHATSAPP_CAMPAIGN = `12020${tag}2`, WHATSAPP_AD = `12020${tag}3`, ID_ONLY_CAMPAIGN = `12020${tag}4`;
    const account = randomUUID();
    const save = (extra = {}) => server(sdk.saveMetaAdAccount, { organizationId: f.orgA, id: account, actorUid: "owner-a", adAccountId: AD_ACCOUNT, name: "E2E Ad Account", currency: "AED",
      timeZone: "Asia/Dubai", tokenCiphertext: "v1:sealed-test-value", tokenKeyId: "k1", tokenExpiresAt: null, ...extra });
    const sourceOf = async (lead) => (await gql(`query S($lead: UUID!) { leadAttributions(where: {leadId: {eq: $lead}}) { campaignKey metaCampaignId metaCampaignName metaAdsetId } }`, { lead })).leadAttributions[0];
    const leads = [];

    it("connects an ad account for owners and administrators of one company only, and lists it without its token", async () => {
      await rejectsWith(save({ actorUid: "agent-a" }), "META_ADS_CONNECT_NOT_ALLOWED");
      await rejectsWith(save({ actorUid: "manager-a" }), "META_ADS_CONNECT_NOT_ALLOWED");
      await save();
      await rejectsWith(server(sdk.saveMetaAdAccount, { organizationId: f.orgB, id: randomUUID(), actorUid: "owner-b", adAccountId: AD_ACCOUNT, name: "Taken", currency: "AED", tokenCiphertext: "v1:x", tokenKeyId: "k1" }),
        "META_AD_ACCOUNT_TAKEN");
      const overview = await server(sdk.metaAdAccountsOverview, { organizationId: f.orgA, actorUid: "admin-a" });
      assert.deepEqual(overview.accounts.map((row) => [row.adAccountId, row.status, row.firstSyncDone]), [[AD_ACCOUNT, "CONNECTED", false]]);
      assert.ok(!("tokenCiphertext" in overview.accounts[0]), "the overview never carries the token");
      assert.deepEqual((await server(sdk.metaAdAccountsOverview, { organizationId: f.orgA, actorUid: "agent-a" })).accounts, [], "agents see no ad accounts");
      assert.ok((await server(sdk.metaAdAccountsDue, { now: new Date(Date.now() + 1000).toISOString(), limit: 50 })).accounts.some((row) => uuid(row.id) === uuid(account)), "due for its first sync");
      for (const op of [sdk.metaAdAccountsOverview, sdk.saveMetaSpend, sdk.renameMetaAttributions, sdk.disconnectMetaAdAccount]) {
        await forbidden(op, "owner-a", { organizationId: f.orgA, actorUid: "owner-a", id: account, adAccountId: AD_ACCOUNT, rows: [], campaigns: [], ads: [] });
      }
    });

    it("writes a day's spend once per campaign and account, replaces it on the next sync, and never writes to another company's campaign", async () => {
      const campaign = randomUUID();
      await server(sdk.createSyncedCampaign, { organizationId: f.orgA, id: campaign, campaignKey: `meta sync ${tag}`, name: "Meta Sync", metaCampaignId: META_CAMPAIGN, currency: "AED", createdByUid: "owner-a" });
      const foreign = randomUUID();
      await server(sdk.createSyncedCampaign, { organizationId: f.orgB, id: foreign, campaignKey: `meta sync ${tag}`, name: "Company B", metaCampaignId: `9${META_CAMPAIGN}`, currency: "AED", createdByUid: "owner-b" });
      const day = (id, date, amount) => ({ id, campaign_id: campaign, day: date, amount_minor: String(amount), currency: "AED", impressions: "100", clicks: "4" });
      const [d1, d2] = [randomUUID(), randomUUID()];
      assert.equal(Number((await server(sdk.saveMetaSpend, { organizationId: f.orgA, adAccountId: AD_ACCOUNT, rows: [day(d1, "2026-11-01", 15050), day(d2, "2026-11-02", 1000),
        { ...day(randomUUID(), "2026-11-02", 999), campaign_id: foreign }] })).saved), 2, "the other company's campaign is ignored");
      await server(sdk.saveMetaSpend, { organizationId: f.orgA, adAccountId: AD_ACCOUNT, rows: [day(d2, "2026-11-02", 2500)] });
      const rows = (await gql(`query R($org: UUID!, $c: UUID!) { campaignSpends(where: {organizationId: {eq: $org}, campaignId: {eq: $c}}, orderBy: [{spentFrom: ASC}]) { source spentFrom spentTo amountMinor externalAccountId clicks } }`, { org: f.orgA, c: campaign })).campaignSpends;
      assert.deepEqual(rows.map((row) => [row.source, row.spentFrom, row.spentTo, row.amountMinor, row.externalAccountId, row.clicks]),
        [["META", "2026-11-01", "2026-11-01", "15050", AD_ACCOUNT, "4"], ["META", "2026-11-02", "2026-11-02", "2500", AD_ACCOUNT, "4"]], "a re-read day replaces the earlier amount");
      const performance = await run(sdk.campaignPerformance, "owner-a", { organizationId: f.orgA, fromDate: "2026-11-01", toDate: "2026-11-30", from: "2026-10-31T20:00:00.000Z", to: "2026-11-30T20:00:00.000Z", campaignKey: `meta sync ${tag}` });
      assert.deepEqual(performance.spend.map((row) => [row.currency, Number(row.amount_minor)]), [["AED", 17550]], "synced spend counts like any other");
      await rejectsWith(run(sdk.deleteCampaignSpend, "owner-a", { organizationId: f.orgA, id: d1 }), "CAMPAIGN_SPEND_NOT_FOUND");
    });

    it("names leads by their Meta campaign: lead ads grouped by ID, and WhatsApp ads grouped by headline", async () => {
      const idOnly = (await run(sdk.createLead, "owner-a", { organizationId: f.orgA, fullName: `ID only ${tag}`, assignedMembershipId: f.memberAgentA })).lead.id;
      const whatsapp = (await run(sdk.createLead, "owner-a", { organizationId: f.orgA, fullName: `WhatsApp ad ${tag}`, assignedMembershipId: f.memberAgentA })).lead.id;
      leads.push(idOnly, whatsapp);
      await gql(`mutation U($org: UUID!, $a: UUID!, $b: UUID!, $cid: String!, $ad: String!) {
        a: leadAttribution_updateMany(where: {organizationId: {eq: $org}, leadId: {eq: $a}}, data: {channel: META_LEAD_AD, campaignKey_expr: "'meta campaign ' + vars.cid", metaCampaignId: $cid})
        b: leadAttribution_updateMany(where: {organizationId: {eq: $org}, leadId: {eq: $b}}, data: {channel: WHATSAPP_AD, campaignKey: "marina 2 bed headline", metaAdId: $ad})
      }`, { org: f.orgA, a: idOnly, b: whatsapp, cid: ID_ONLY_CAMPAIGN, ad: WHATSAPP_AD });
      const result = await server(sdk.renameMetaAttributions, { organizationId: f.orgA,
        campaigns: [{ campaign_id: ID_ONLY_CAMPAIGN, name: "Creek Harbour Launch", key: "creek harbour launch" }],
        ads: [{ ad_id: WHATSAPP_AD, adset_id: `22${tag}`, campaign_id: WHATSAPP_CAMPAIGN, name: "Marina Campaign", key: "marina campaign" }] });
      assert.deepEqual([Number(result.campaigns), Number(result.ads)], [1, 1]);
      assert.deepEqual(await sourceOf(idOnly), { campaignKey: "creek harbour launch", metaCampaignId: ID_ONLY_CAMPAIGN, metaCampaignName: "Creek Harbour Launch", metaAdsetId: null });
      assert.deepEqual(await sourceOf(whatsapp), { campaignKey: "marina campaign", metaCampaignId: WHATSAPP_CAMPAIGN, metaCampaignName: "Marina Campaign", metaAdsetId: `22${tag}` });
      const again = await server(sdk.renameMetaAttributions, { organizationId: f.orgA, campaigns: [{ campaign_id: ID_ONLY_CAMPAIGN, name: "Renamed", key: "renamed" }],
        ads: [{ ad_id: WHATSAPP_AD, adset_id: null, campaign_id: "1", name: "Other", key: "other" }] });
      assert.deepEqual([Number(again.campaigns), Number(again.ads)], [0, 0], "leads already given a campaign are not moved again");
      assert.deepEqual(Number((await server(sdk.renameMetaAttributions, { organizationId: f.orgB, campaigns: [{ campaign_id: ID_ONLY_CAMPAIGN, name: "B", key: "b" }], ads: [] })).campaigns), 0, "only the company's own leads");
    });

    it("disconnects for owners and administrators: the token is deleted, the spend stays", async () => {
      await rejectsWith(server(sdk.disconnectMetaAdAccount, { organizationId: f.orgA, id: account, actorUid: "agent-a" }), "META_ADS_CONNECT_NOT_ALLOWED");
      await server(sdk.markMetaAdAccountSynced, { organizationId: f.orgA, id: account, status: sdk.MetaAdAccountStatus.CONNECTED, errorCode: null, nextSyncAt: new Date(Date.now() + 3_600_000).toISOString(), synced: true, firstSyncDone: true });
      assert.equal((await server(sdk.metaAdAccountSecret, { organizationId: f.orgA, id: account })).account.firstSyncDone, true);
      await server(sdk.disconnectMetaAdAccount, { organizationId: f.orgA, id: account, actorUid: "admin-a" });
      assert.equal((await server(sdk.metaAdAccountSecret, { organizationId: f.orgA, id: account })).account, null);
      assert.ok((await gql(`query R($org: UUID!, $a: String!) { campaignSpends(where: {organizationId: {eq: $org}, externalAccountId: {eq: $a}}) { id } }`, { org: f.orgA, a: AD_ACCOUNT })).campaignSpends.length >= 2, "spend already read stays");
      const audit = (await gql(`query A($org: UUID!, $id: UUID!) { auditLogs(where: {organizationId: {eq: $org}, targetId: {eq: $id}}) { action actorUid } }`, { org: f.orgA, id: account })).auditLogs;
      assert.deepEqual(audit.map((row) => row.action).sort(), ["META_AD_ACCOUNT_CONNECTED", "META_AD_ACCOUNT_DISCONNECTED"]);
      for (const leadId of leads) await run(sdk.archiveLead, "owner-a", { organizationId: f.orgA, leadId });
    });
  });
}
