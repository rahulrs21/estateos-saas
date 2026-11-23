import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { before, describe, it } from "node:test";
import { fixture as f } from "./fixtures/sql-connect-fixtures.mjs";

// Phase 7D: Meta Lead Ads in the database (docs/META_LEAD_ADS_PLAN.md). Synthetic IDs and people only.
const uuid = (value) => String(value).replaceAll("-", "").toLowerCase();
const digits = () => String(Date.now()) + String(Math.floor(Math.random() * 1e6)).padStart(6, "0");

export function registerLeadAdsCases({ sdk, run, forbidden, dc }) {
  describe("Phase 7D Meta Lead Ads", { concurrency: false }, () => {
    const noAccess = async (operation, variables) => (await operation(dc, variables)).data;
    const pageA = digits();
    const connectionA = randomUUID();
    const metaFormId = digits();
    let formId;

    const record = (organizationId, connectionId, pageId, leadgenId) => noAccess(sdk.recordMetaLeadEvent, {
      organizationId, connectionId, pageId, leadgenId, metaFormId, adId: digits(), adGroupId: null, metaCreatedAt: new Date().toISOString(), origin: "WEBHOOK",
    });
    const capture = (variables) => noAccess(sdk.captureMetaLeadAd, {
      connectionId: connectionA, formId, organizationId: f.orgA, fullName: "Meta Buyer", email: `meta-${randomUUID().slice(0, 8)}@example.test`, phone: null,
      normalizedEmail: null, normalizedPhone: null, contactId: null, hasExistingContact: false, currency: "AED",
      metadata: {schemaVersion: 1, source: "META_LEAD_ADS", answers: [{key: "what_is_your_budget?", label: "What is your budget?", value: "AED 2M"}]},
      assignedMembershipId: null, distributionRuleId: null, expectedCursorVersion: null, hasAutoAssignment: false, hasDistributionAttempt: false, ...variables,
    });

    before(async () => {
      await noAccess(sdk.createMetaLeadConnection, {organizationId: f.orgA, id: connectionA, actorUid: "owner-a", pageId: pageA, pageName: "Synthetic Test Page", tokenCiphertext: "sealed-test-value", tokenKeyId: "k1"});
      await noAccess(sdk.registerMetaLeadForm, {organizationId: f.orgA, connectionId: connectionA, metaFormId, name: "Synthetic form", sourceName: `Meta - Synthetic form - ${metaFormId.slice(-6)}`,
        questions: [{key: "what_is_your_budget?", label: "What is your budget?", type: "CUSTOM"}], existingSourceId: null, hasExistingSource: false});
      formId = (await noAccess(sdk.findMetaLeadForm, {organizationId: f.orgA, metaFormId})).form.id;
    });

    it("only an owner or administrator can connect a Page, and a Page can belong to one company only", async () => {
      await assert.rejects(() => noAccess(sdk.createMetaLeadConnection, {organizationId: f.orgA, id: randomUUID(), actorUid: "agent-a", pageId: digits(), pageName: "Agent page", tokenCiphertext: "x", tokenKeyId: "k1"}));
      await assert.rejects(() => noAccess(sdk.createMetaLeadConnection, {organizationId: f.orgB, id: randomUUID(), actorUid: "owner-a", pageId: digits(), pageName: "Wrong company", tokenCiphertext: "x", tokenKeyId: "k1"}), "owner-a is not a member of company B");
      await assert.rejects(() => noAccess(sdk.createMetaLeadConnection, {organizationId: f.orgB, id: randomUUID(), actorUid: "owner-b", pageId: pageA, pageName: "Same page", tokenCiphertext: "x", tokenKeyId: "k1"}), "the Page is company A's");
      const found = await noAccess(sdk.metaLeadConnectionForPage, {pageId: pageA});
      assert.equal(found.connections.length, 1);
      assert.equal(uuid(found.connections[0].organizationId), uuid(f.orgA));
    });

    it("members can never call the server-only Meta operations or read the encrypted token", async () => {
      await forbidden(sdk.metaLeadConnectionSecret, "owner-a", {organizationId: f.orgA, id: connectionA});
      await forbidden(sdk.metaLeadConnectionForPage, "owner-a", {pageId: pageA});
      await forbidden(sdk.createMetaLeadConnection, "owner-a", {organizationId: f.orgA, id: randomUUID(), actorUid: "owner-a", pageId: digits(), pageName: "Direct", tokenCiphertext: "x", tokenKeyId: "k1"});
      await forbidden(sdk.captureMetaLeadAd, "owner-a", {organizationId: f.orgA, eventId: randomUUID(), connectionId: connectionA, formId, fullName: "Direct", email: "d@example.test", hasExistingContact: false, currency: "AED", metadata: {}, hasAutoAssignment: false, hasDistributionAttempt: false});
    });

    it("a form registers once with its own Meta lead source", async () => {
      const found = await noAccess(sdk.findMetaLeadForm, {organizationId: f.orgA, metaFormId});
      assert.ok(found.form.enabled);
      assert.ok(found.source);
      assert.equal(uuid(found.form.sourceId), uuid(found.source.id));
      await assert.rejects(() => noAccess(sdk.registerMetaLeadForm, {organizationId: f.orgA, connectionId: connectionA, metaFormId, name: "Again", sourceName: "Meta - Again", questions: null, existingSourceId: null, hasExistingSource: false}));
      // Company B cannot register a form on company A's connection.
      await assert.rejects(() => noAccess(sdk.registerMetaLeadForm, {organizationId: f.orgB, connectionId: connectionA, metaFormId: digits(), name: "Other", sourceName: "Meta - Other", questions: null, existingSourceId: null, hasExistingSource: false}));
    });

    it("each Meta lead is recorded once, and only for the company that connected the Page", async () => {
      const leadgenId = digits();
      const first = await record(f.orgA, connectionA, pageA, leadgenId);
      assert.ok(first.event.id);
      await assert.rejects(() => record(f.orgA, connectionA, pageA, leadgenId), "a repeat of the same lead");
      await assert.rejects(() => record(f.orgB, connectionA, pageA, digits()), "another company with A's connection");
      await assert.rejects(() => record(f.orgA, connectionA, digits(), digits()), "a Page that is not the connection's");
      await assert.rejects(() => noAccess(sdk.recordMetaLeadEvent, {organizationId: f.orgA, connectionId: connectionA, pageId: pageA, leadgenId: "not-digits", origin: "WEBHOOK"}));
      await assert.rejects(() => noAccess(sdk.recordMetaLeadEvent, {organizationId: f.orgA, connectionId: connectionA, pageId: pageA, leadgenId: digits(), origin: "BROWSER"}));
    });

    it("a lead is created atomically with its contact, activity answers and audit, and the event is processed exactly once", async () => {
      const event = (await record(f.orgA, connectionA, pageA, digits())).event;
      const created = await capture({eventId: event.id, preferredLocation: "Dubai Marina", budgetMax: 2_000_000});
      const lead = await run(sdk.getLead, "owner-a", {organizationId: f.orgA, leadId: created.lead.id});
      assert.equal(lead.lead.source, "Meta Lead Ads");
      assert.equal(lead.lead.preferredLocation, "Dubai Marina");
      assert.equal(lead.lead.status, "NEW");
      const context = await noAccess(sdk.metaLeadEventContext, {organizationId: f.orgA, eventId: event.id});
      assert.equal(context.event.status, "PROCESSED");
      assert.equal(uuid(context.event.leadId), uuid(created.lead.id));
      // The same event can never create a second lead, and a processed event is never changed again.
      await assert.rejects(() => capture({eventId: event.id}));
      await noAccess(sdk.setMetaLeadEventOutcome, {organizationId: f.orgA, id: event.id, status: "FAILED", errorCode: "LATE", nextAttemptAt: null});
      assert.equal((await noAccess(sdk.metaLeadEventContext, {organizationId: f.orgA, eventId: event.id})).event.status, "PROCESSED");
      // Company B cannot see the lead.
      await forbidden(sdk.getLead, "owner-b", {organizationId: f.orgB, leadId: created.lead.id});
    });

    it("a capture never crosses companies and needs an enabled form and a way to reach the person", async () => {
      const event = (await record(f.orgA, connectionA, pageA, digits())).event;
      await assert.rejects(() => capture({eventId: event.id, organizationId: f.orgB}), "company B with company A's event, form and connection");
      await assert.rejects(() => capture({eventId: event.id, email: null, phone: null}), "no email and no phone");
      await assert.rejects(() => capture({eventId: event.id, formId: randomUUID()}), "an unknown form");
      // Still unprocessed after the refusals, so it can be imported.
      assert.equal((await noAccess(sdk.metaLeadEventContext, {organizationId: f.orgA, eventId: event.id})).event.status, "RECEIVED");
    });

    it("failed events come back for a retry when their time has come", async () => {
      const event = (await record(f.orgA, connectionA, pageA, digits())).event;
      await noAccess(sdk.setMetaLeadEventOutcome, {organizationId: f.orgA, id: event.id, status: "FAILED", errorCode: "META_UNREACHABLE", nextAttemptAt: new Date(Date.now() - 1000).toISOString()});
      const pending = await noAccess(sdk.pendingMetaLeadEvents, {now: new Date().toISOString(), staleBefore: new Date(Date.now() - 120_000).toISOString(), limit: 100});
      assert.ok(pending.events.some(row => uuid(row.id) === uuid(event.id)));
      const context = await noAccess(sdk.metaLeadEventContext, {organizationId: f.orgA, eventId: event.id});
      assert.equal(context.event.attempts, 1);
      // A failed event can still be imported.
      const created = await capture({eventId: event.id});
      assert.ok(created.lead.id);
    });
  });
}
