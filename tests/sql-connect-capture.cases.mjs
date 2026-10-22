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
}

