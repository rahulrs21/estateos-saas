import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";
import { fixture as f } from "./fixtures/sql-connect-fixtures.mjs";

/**
 * Phase 6F communication storage against the SQL Connect emulator with the
 * real stored operations: manual call logging with record-level access, the
 * number-on-record check, suppressions written in the same transaction as a
 * do-not-call outcome, idempotent call IDs, compare-and-set edits, settings
 * bounds (UAE marketing hours, TDRA reference, recording notice) and tenant
 * isolation. Synthetic, fictional numbers only. Calls without a uid use the
 * Admin identity (server-only operations).
 * Company A: owner-a, admin-a, manager-a, agent-a, shared-agent. Company B: owner-b.
 */
/** As the server does (finalCallTrigger): a call log writes its workflow event when answered, failed or incoming. */
const emitFor = vars => vars.callStatus === "COMPLETED" || vars.callStatus === "FAILED" || vars.direction === "INBOUND";
const withCallEvents = generated => ({...generated,
  logLeadCall: (dc, vars, options) => generated.logLeadCall(dc, {emitEvent: emitFor(vars), ...vars}, options),
  logContactCall: (dc, vars, options) => generated.logContactCall(dc, {emitEvent: emitFor(vars), ...vars}, options)});

export function registerCommunicationCases({sdk: generated, run, forbidden, dc}) {
  const sdk = withCallEvents(generated);
  describe("Phase 6F communications", {concurrency: false}, () => {
    const key = value => String(value).replaceAll("-", "").toLowerCase();
    const server = async (operation, variables) => (await operation(dc, variables)).data;
    const rejectsWith = (promise, token) => assert.rejects(promise, error => String(error?.message ?? error).includes(token), token);
    const minutesAgo = minutes => new Date(Date.now() - minutes * 60_000).toISOString();
    let sequence = 0;
    const uniqueNumber = () => `+97150${String(Date.now() % 100000).padStart(5, "0")}${String(sequence++ % 100).padStart(2, "0")}`;

    /** A lead with a contact and a number on record, assigned to agent-a. */
    const leadWithNumber = async (number = uniqueNumber()) => {
      const created = await run(sdk.createLead, "owner-a", {organizationId: f.orgA, fullName: `Call test ${randomUUID().slice(0, 8)}`, phone: number, normalizedPhone: number, assignedMembershipId: f.memberAgentA});
      const {lead} = await run(sdk.getLead, "owner-a", {organizationId: f.orgA, leadId: created.lead.id});
      return {leadId: lead.id, contactId: lead.contactId, number};
    };
    const callVars = (leadId, number, extra = {}) => ({
      organizationId: f.orgA, id: randomUUID(), leadId, direction: sdk.CallDirection.OUTBOUND, callType: sdk.CallType.FOLLOW_UP, callStatus: sdk.CallStatus.COMPLETED,
      outcome: sdk.CallOutcome.INTERESTED, startedAt: minutesAgo(5), durationSeconds: 125, notes: "Synthetic call notes", counterpartyNumber: number,
      followUpRequired: false, hasViewing: false, viewingId: null, suppress: false, suppressionId: randomUUID(), ...extra,
    });

    it("lets the assigned agent log a call and keeps it to members who may see the lead", async () => {
      const {leadId, contactId, number} = await leadWithNumber();
      const vars = callVars(leadId, number);
      await run(sdk.logLeadCall, "agent-a", vars);
      const listed = await run(sdk.listLeadCalls, "agent-a", {organizationId: f.orgA, leadId, limit: 20, offset: 0});
      assert.equal(listed.calls.length, 1);
      const call = listed.calls[0];
      assert.equal(key(call.id), key(vars.id));
      assert.equal(call.source, "MANUAL");
      assert.equal(call.callStatus, "COMPLETED");
      assert.equal(call.durationSeconds, 125);
      assert.ok(call.answeredAt, "an answered manual call records when it was answered");
      assert.equal(key(call.agentMembershipId), key(f.memberAgentA));
      assert.equal(listed.total[0].count, 1);
      assert.equal(listed.lastAnswered.length, 1);
      const {call: detail} = await run(sdk.getCallRecord, "agent-a", {organizationId: f.orgA, id: vars.id});
      assert.equal(key(detail.contactId), key(contactId), "the call is linked to the lead's contact");
      assert.equal(detail.endedAt.slice(0, 16), new Date(Date.parse(vars.startedAt) + 125_000).toISOString().slice(0, 16));
      const viaContact = await run(sdk.listContactCalls, "agent-a", {organizationId: f.orgA, contactId, limit: 20, offset: 0});
      assert.ok(viaContact.calls.some(item => key(item.id) === key(vars.id)), "the contact's history includes calls on its leads");
      const owner = await run(sdk.getCallRecord, "owner-a", {organizationId: f.orgA, id: vars.id});
      assert.equal(owner.call.notes, "Synthetic call notes");

      await forbidden(sdk.getCallRecord, "shared-agent", {organizationId: f.orgA, id: vars.id});
      await forbidden(sdk.getCallRecord, "manager-a", {organizationId: f.orgA, id: vars.id});
      await forbidden(sdk.getCallRecord, "owner-b", {organizationId: f.orgA, id: vars.id});
      await forbidden(sdk.listLeadCalls, "manager-a", {organizationId: f.orgA, leadId, limit: 20, offset: 0});
      await forbidden(sdk.listLeadCalls, "owner-b", {organizationId: f.orgA, leadId, limit: 20, offset: 0});
      await forbidden(sdk.logLeadCall, "shared-agent", callVars(leadId, number));
      await forbidden(sdk.logLeadCall, "owner-b", callVars(leadId, number));
      await forbidden(sdk.logLeadCall, "suspended-user", callVars(leadId, number));
      // A guessed ID in another company's request scope finds nothing.
      await forbidden(sdk.getCallRecord, "owner-b", {organizationId: f.orgB, id: vars.id});
      const {activities} = await run(sdk.listLeadActivities, "agent-a", {organizationId: f.orgA, leadId, limit: 20, offset: 0});
      const logged = activities.find(item => item.kind === "CALL_LOGGED");
      assert.ok(logged, "the lead timeline records the call");
      assert.equal(logged.metadata.callStatus, "COMPLETED");
      assert.equal(logged.note ?? null, null, "call notes stay on the call record, not duplicated into the timeline");
    });

    it("refuses numbers that are not on record, outcomes for unanswered calls and calls in the future", async () => {
      const {leadId, number} = await leadWithNumber();
      await rejectsWith(run(sdk.logLeadCall, "agent-a", callVars(leadId, "+971509999999")), "CALL_NUMBER_NOT_ON_RECORD");
      await forbidden(sdk.logLeadCall, "agent-a", callVars(leadId, number, {callStatus: sdk.CallStatus.NO_ANSWER, durationSeconds: 0}));
      await forbidden(sdk.logLeadCall, "agent-a", callVars(leadId, number, {callStatus: sdk.CallStatus.NO_ANSWER, outcome: null, durationSeconds: 30}));
      await forbidden(sdk.logLeadCall, "agent-a", callVars(leadId, number, {callStatus: sdk.CallStatus.RINGING, outcome: null, durationSeconds: 0}));
      await forbidden(sdk.logLeadCall, "agent-a", callVars(leadId, number, {startedAt: new Date(Date.now() + 3_600_000).toISOString()}));
      await forbidden(sdk.logLeadCall, "agent-a", callVars(leadId, number, {startedAt: new Date(Date.now() - 40 * 86_400_000).toISOString()}));
      await run(sdk.logLeadCall, "agent-a", callVars(leadId, number, {callStatus: sdk.CallStatus.NO_ANSWER, outcome: null, durationSeconds: 0}));
      const listed = await run(sdk.listLeadCalls, "agent-a", {organizationId: f.orgA, leadId, limit: 20, offset: 0});
      assert.equal(listed.calls.length, 1);
      assert.equal(listed.calls[0].answeredAt ?? null, null, "an unanswered call has no answer time");
      assert.equal(listed.lastAnswered.length, 0, "a dial attempt is not contact");
    });

    it("adds the suppression in the same transaction as a do-not-call outcome, and only then", async () => {
      const {leadId, number} = await leadWithNumber();
      await forbidden(sdk.logLeadCall, "agent-a", callVars(leadId, number, {outcome: sdk.CallOutcome.DO_NOT_CALL_REQUESTED, suppress: false}));
      await forbidden(sdk.logLeadCall, "agent-a", callVars(leadId, number, {suppress: true}));
      let facts = await server(sdk.callComplianceFacts, {organizationId: f.orgA, number, since: minutesAgo(60 * 24)});
      assert.equal(facts.suppressions.length, 0, "a refused log leaves no suppression");
      const vars = callVars(leadId, number, {outcome: sdk.CallOutcome.DO_NOT_CALL_REQUESTED, suppress: true});
      await run(sdk.logLeadCall, "agent-a", vars);
      facts = await server(sdk.callComplianceFacts, {organizationId: f.orgA, number, since: minutesAgo(60 * 24)});
      assert.equal(facts.suppressions.length, 1);
      assert.equal(facts.suppressions[0].scope, "ALL");
      assert.equal(facts.suppressions[0].reason, "OPT_OUT");
      assert.equal(facts.calls.length, 1, "compliance facts include the company's calls to the number");
      const other = await server(sdk.callComplianceFacts, {organizationId: f.orgB, number, since: minutesAgo(60 * 24)});
      assert.equal(other.suppressions.length + other.calls.length, 0, "another company's facts are separate");

      await forbidden(sdk.listCommunicationSuppressions, "agent-a", {organizationId: f.orgA, limit: 10, offset: 0});
      await forbidden(sdk.listCommunicationSuppressions, "owner-b", {organizationId: f.orgA, limit: 10, offset: 0});
      const listed = await run(sdk.listCommunicationSuppressions, "admin-a", {organizationId: f.orgA, limit: 200, offset: 0});
      const suppression = listed.active.find(item => item.normalizedNumber === number);
      assert.equal(suppression.source, "CALL_OUTCOME");
      await forbidden(sdk.withdrawCommunicationSuppression, "agent-a", {organizationId: f.orgA, id: suppression.id, reason: "Customer asked again"});
      await run(sdk.withdrawCommunicationSuppression, "admin-a", {organizationId: f.orgA, id: suppression.id, reason: "Customer asked to be called again"});
      await rejectsWith(run(sdk.withdrawCommunicationSuppression, "admin-a", {organizationId: f.orgA, id: suppression.id, reason: "Twice"}), "COMMUNICATION_SUPPRESSION_NOT_FOUND");
      facts = await server(sdk.callComplianceFacts, {organizationId: f.orgA, number, since: minutesAgo(60 * 24)});
      assert.equal(facts.suppressions.length, 0, "a withdrawn suppression no longer applies");
      const after = await run(sdk.listCommunicationSuppressions, "owner-a", {organizationId: f.orgA, limit: 200, offset: 0});
      assert.ok(after.withdrawn.some(item => key(item.id) === key(suppression.id)), "withdrawn rows are kept as evidence");

      await run(sdk.addCommunicationSuppression, "owner-a", {organizationId: f.orgA, id: randomUUID(), normalizedNumber: number, scope: sdk.CommunicationSuppressionScope.MARKETING, reason: sdk.CommunicationSuppressionReason.DNCR_LISTED, note: null});
      await forbidden(sdk.addCommunicationSuppression, "agent-a", {organizationId: f.orgA, id: randomUUID(), normalizedNumber: number, scope: sdk.CommunicationSuppressionScope.ALL, reason: sdk.CommunicationSuppressionReason.OTHER, note: null});
      await forbidden(sdk.addCommunicationSuppression, "owner-a", {organizationId: f.orgA, id: randomUUID(), normalizedNumber: "0501234567", scope: sdk.CommunicationSuppressionScope.ALL, reason: sdk.CommunicationSuppressionReason.OTHER, note: null});
      const dncr = (await run(sdk.listCommunicationSuppressions, "owner-a", {organizationId: f.orgA, limit: 200, offset: 0})).active.find(item => item.normalizedNumber === number);
      assert.equal(dncr.source, "DNCR_CHECK");
    });

    it("never logs the same call twice", async () => {
      const {leadId, number} = await leadWithNumber();
      const vars = callVars(leadId, number);
      await run(sdk.logLeadCall, "agent-a", vars);
      await assert.rejects(run(sdk.logLeadCall, "agent-a", vars), "the same call ID is refused");
      const listed = await run(sdk.listLeadCalls, "agent-a", {organizationId: f.orgA, leadId, limit: 20, offset: 0});
      assert.equal(listed.calls.length, 1);
    });

    it("lets the call's agent or an administrator edit outcome and notes with compare-and-set", async () => {
      const {leadId, number} = await leadWithNumber();
      const vars = callVars(leadId, number, {outcome: null});
      await run(sdk.logLeadCall, "agent-a", vars);
      const update = (uid, extra = {}) => run(sdk.updateCallRecord, uid, {organizationId: f.orgA, id: vars.id, expectedRevision: 1, outcome: sdk.CallOutcome.CALLBACK_REQUESTED, notes: "Updated notes", followUpRequired: true, suppress: false, suppressionId: randomUUID(), ...extra});
      await rejectsWith(update("shared-agent"), "CALL_CHANGED_OR_FORBIDDEN");
      await forbidden(sdk.updateCallRecord, "owner-b", {organizationId: f.orgA, id: vars.id, expectedRevision: 1, outcome: null, notes: null, followUpRequired: false, suppress: false, suppressionId: randomUUID()});
      await update("agent-a");
      await rejectsWith(update("agent-a"), "CALL_CHANGED_OR_FORBIDDEN");
      let {call} = await run(sdk.getCallRecord, "agent-a", {organizationId: f.orgA, id: vars.id});
      assert.equal(call.revision, 2);
      assert.equal(call.outcome, "CALLBACK_REQUESTED");
      assert.equal(call.followUpRequired, true);
      // A new do-not-call outcome must add the suppression in the same update.
      await rejectsWith(update("admin-a", {expectedRevision: 2, outcome: sdk.CallOutcome.DO_NOT_CALL_REQUESTED, suppress: false}), "CALL_CHANGED_OR_FORBIDDEN");
      await update("admin-a", {expectedRevision: 2, outcome: sdk.CallOutcome.DO_NOT_CALL_REQUESTED, suppress: true});
      ({call} = await run(sdk.getCallRecord, "owner-a", {organizationId: f.orgA, id: vars.id}));
      assert.equal(call.outcome, "DO_NOT_CALL_REQUESTED");
      const facts = await server(sdk.callComplianceFacts, {organizationId: f.orgA, number, since: minutesAgo(60)});
      assert.equal(facts.suppressions.length, 1);

      const unanswered = callVars(leadId, number, {callStatus: sdk.CallStatus.BUSY, outcome: null, durationSeconds: 0});
      await run(sdk.logLeadCall, "agent-a", unanswered);
      await rejectsWith(run(sdk.updateCallRecord, "agent-a", {organizationId: f.orgA, id: unanswered.id, expectedRevision: 1, outcome: sdk.CallOutcome.INTERESTED, notes: null, followUpRequired: false, suppress: false, suppressionId: randomUUID()}), "CALL_CHANGED_OR_FORBIDDEN");
    });

    it("links a follow-up from the same lead only", async () => {
      const {leadId, number} = await leadWithNumber();
      const other = await leadWithNumber();
      const vars = callVars(leadId, number);
      await run(sdk.logLeadCall, "agent-a", vars);
      const followUpAt = new Date(Date.now() + 86_400_000).toISOString();
      const own = await run(sdk.scheduleLeadFollowUp, "agent-a", {organizationId: f.orgA, leadId, followUpAt, title: "Follow up after call", replaceExisting: false});
      const foreign = await run(sdk.scheduleLeadFollowUp, "agent-a", {organizationId: f.orgA, leadId: other.leadId, followUpAt, title: "Other lead", replaceExisting: false});
      await rejectsWith(run(sdk.linkCallFollowUp, "agent-a", {organizationId: f.orgA, id: vars.id, followUpId: foreign.followUp.id}), "CALL_FOLLOW_UP_NOT_FOUND");
      await forbidden(sdk.linkCallFollowUp, "shared-agent", {organizationId: f.orgA, id: vars.id, followUpId: own.followUp.id});
      await run(sdk.linkCallFollowUp, "agent-a", {organizationId: f.orgA, id: vars.id, followUpId: own.followUp.id});
      const {call} = await run(sdk.getCallRecord, "agent-a", {organizationId: f.orgA, id: vars.id});
      assert.equal(key(call.followUp.id), key(own.followUp.id));
      assert.equal(call.followUpRequired, true);
    });

    it("logs calls on contacts the member may access", async () => {
      const {contactId, number} = await leadWithNumber();
      const vars = {organizationId: f.orgA, id: randomUUID(), contactId, direction: sdk.CallDirection.INBOUND, callType: sdk.CallType.INBOUND_ENQUIRY, callStatus: sdk.CallStatus.COMPLETED,
        outcome: null, startedAt: minutesAgo(3), durationSeconds: 40, notes: null, counterpartyNumber: number, followUpRequired: false, suppress: false, suppressionId: randomUUID()};
      await run(sdk.logContactCall, "agent-a", vars);
      await forbidden(sdk.logContactCall, "shared-agent", {...vars, id: randomUUID()});
      await forbidden(sdk.logContactCall, "owner-b", {...vars, id: randomUUID()});
      await rejectsWith(run(sdk.logContactCall, "agent-a", {...vars, id: randomUUID(), counterpartyNumber: "+971508888888"}), "CALL_NUMBER_NOT_ON_RECORD");
      const {call} = await run(sdk.getCallRecord, "agent-a", {organizationId: f.orgA, id: vars.id});
      assert.equal(call.callerNumber, number, "an incoming call records the customer as the caller");
      assert.equal(call.recipientNumber ?? null, null);
      await forbidden(sdk.listContactCalls, "shared-agent", {organizationId: f.orgA, contactId, limit: 20, offset: 0});
    });

    it("keeps settings to owners and administrators, within the legal marketing bounds", async () => {
      const settings = (extra = {}) => ({organizationId: f.orgA, timeZone: "Asia/Dubai", callingWindowStart: "08:00", callingWindowEnd: "21:00", maxCallsPerContactPerDay: 3,
        telemarketingEnabled: false, telemarketingApprovalReference: null, marketingWindowStart: "09:00", marketingWindowEnd: "18:00", marketingMaxCallsPerDay: 1, marketingMaxUnansweredPerWeek: 2,
        allowedCallingCodes: "971", maxConcurrentLiveCalls: 5, maxLiveCallsPerAgentPerDay: 60, recordingEnabled: false, recordingNoticeText: null, recordingLegalBasis: null, retentionDays: 90, aiAnalysisEnabled: false, ...extra});
      const read = await run(sdk.getCommunicationSettings, "agent-a", {organizationId: f.orgA});
      assert.equal(read.settings ?? null, null, "no settings yet: the defaults apply");
      await forbidden(sdk.getCommunicationSettings, "owner-b", {organizationId: f.orgA});
      await rejectsWith(run(sdk.createCommunicationSettings, "agent-a", settings()), "COMMUNICATION_ADMIN_REQUIRED");
      await rejectsWith(run(sdk.createCommunicationSettings, "manager-a", settings()), "COMMUNICATION_ADMIN_REQUIRED");
      await forbidden(sdk.createCommunicationSettings, "owner-b", settings());
      await forbidden(sdk.createCommunicationSettings, "admin-a", settings({telemarketingEnabled: true}));
      await forbidden(sdk.createCommunicationSettings, "admin-a", settings({marketingWindowEnd: "19:00"}));
      await forbidden(sdk.createCommunicationSettings, "admin-a", settings({marketingWindowStart: "08:30"}));
      await forbidden(sdk.createCommunicationSettings, "admin-a", settings({marketingMaxCallsPerDay: 2}));
      await forbidden(sdk.createCommunicationSettings, "admin-a", settings({marketingMaxUnansweredPerWeek: 3}));
      await forbidden(sdk.createCommunicationSettings, "admin-a", settings({recordingEnabled: true, recordingNoticeText: "Too short"}));
      await forbidden(sdk.createCommunicationSettings, "admin-a", settings({callingWindowStart: "22:00"}));
      await run(sdk.createCommunicationSettings, "admin-a", settings({telemarketingEnabled: true, telemarketingApprovalReference: "TDRA-TEST-0001"}));
      await assert.rejects(run(sdk.createCommunicationSettings, "owner-a", settings()), "the first save happens once");
      let current = (await run(sdk.getCommunicationSettings, "agent-a", {organizationId: f.orgA})).settings;
      assert.equal(current.telemarketingEnabled, true);
      assert.equal(current.revision, 1);
      assert.equal(current.liveCallingAttestedAt ?? null, null, "saving settings never attests live calling");
      const {organizationId, ...values} = settings({recordingEnabled: true, recordingNoticeText: "This call is recorded for quality and training purposes.", recordingLegalBasis: "Customer consent"});
      await rejectsWith(run(sdk.updateCommunicationSettings, "owner-a", {organizationId, expectedRevision: 2, ...values}), "COMMUNICATION_SETTINGS_CHANGED");
      await run(sdk.updateCommunicationSettings, "owner-a", {organizationId, expectedRevision: 1, ...values});
      current = (await run(sdk.getCommunicationSettings, "owner-a", {organizationId: f.orgA})).settings;
      assert.equal(current.revision, 2);
      assert.equal(current.recordingEnabled, true);
      assert.equal(current.telemarketingEnabled, false);
      const facts = await server(sdk.callComplianceFacts, {organizationId: f.orgA, number: "+971500000000", since: minutesAgo(10)});
      assert.equal(facts.settings.revision, 2, "the server reads the saved rules");
    });
  });

  describe("Phase 6F.2 providers, lines, webhooks and live-call gate", {concurrency: false}, () => {
    const key = value => String(value).replaceAll("-", "").toLowerCase();
    const server = async (operation, variables) => (await operation(dc, variables)).data;
    const rejectsWith = (promise, token) => assert.rejects(promise, error => String(error?.message ?? error).includes(token), token);
    const ACCOUNT = "AC" + "b".repeat(32);
    const providers = async uid => run(sdk.listCommunicationProviders, uid, {organizationId: f.orgA});
    const connectionRow = async id => (await providers("owner-a")).connections.find(row => key(row.id) === key(id));
    const lineRow = async id => (await providers("owner-a")).lines.find(row => key(row.id) === key(id));
    let connectionId, lineId;

    it("keeps provider connections to owners and administrators, stores only a secret name and resets verification on change", async () => {
      await rejectsWith(run(sdk.listCommunicationProviders, "agent-a", {organizationId: f.orgA}), "COMMUNICATION_ADMIN_REQUIRED");
      await rejectsWith(run(sdk.listCommunicationProviders, "manager-a", {organizationId: f.orgA}), "COMMUNICATION_ADMIN_REQUIRED");
      await forbidden(sdk.listCommunicationProviders, "owner-b", {organizationId: f.orgA});
      const create = (uid, extra = {}) => run(sdk.createCommunicationProvider, uid, {organizationId: f.orgA, id: randomUUID(), providerType: sdk.CommunicationProviderType.TWILIO, displayName: "Test Twilio", secretRef: "COMMS_TEST_TWILIO_TOKEN", externalAccountId: ACCOUNT, ...extra});
      await rejectsWith(create("agent-a"), "COMMUNICATION_ADMIN_REQUIRED");
      await forbidden(sdk.createCommunicationProvider, "owner-b", {organizationId: f.orgA, id: randomUUID(), providerType: sdk.CommunicationProviderType.TWILIO, displayName: "Intruder", secretRef: null, externalAccountId: null});
      for (const secretRef of ["ANTHROPIC_API_KEY", "COMMS_", "comms_lower", "COMMS_X;Y"]) await forbidden(sdk.createCommunicationProvider, "admin-a", {organizationId: f.orgA, id: randomUUID(), providerType: sdk.CommunicationProviderType.TWILIO, displayName: "Bad secret name", secretRef, externalAccountId: null});
      const incomplete = randomUUID();
      await run(sdk.createCommunicationProvider, "admin-a", {organizationId: f.orgA, id: incomplete, providerType: sdk.CommunicationProviderType.PBX, displayName: "Future PBX", secretRef: null, externalAccountId: null});
      assert.equal((await connectionRow(incomplete)).connectionStatus, "NOT_CONFIGURED");
      connectionId = randomUUID();
      await run(sdk.createCommunicationProvider, "admin-a", {organizationId: f.orgA, id: connectionId, providerType: sdk.CommunicationProviderType.TWILIO, displayName: "Test Twilio", secretRef: "COMMS_TEST_TWILIO_TOKEN", externalAccountId: ACCOUNT});
      let row = await connectionRow(connectionId);
      assert.equal(row.connectionStatus, "CONFIGURED", "saved details are not verified");
      // Only the server can record a verification; a member calling the operation directly is refused.
      await forbidden(sdk.recordCommunicationProviderVerification, "owner-a", {organizationId: f.orgA, id: connectionId, expectedRevision: row.revision, actorUid: "owner-a", verified: true, note: "self-verified"});
      await rejectsWith(server(sdk.recordCommunicationProviderVerification, {organizationId: f.orgA, id: connectionId, expectedRevision: row.revision, actorUid: "agent-a", verified: true, note: "x"}), "COMMUNICATION_ADMIN_REQUIRED");
      await server(sdk.recordCommunicationProviderVerification, {organizationId: f.orgA, id: connectionId, expectedRevision: row.revision, actorUid: "admin-a", verified: true, note: "Synthetic verification"});
      row = await connectionRow(connectionId);
      assert.equal(row.connectionStatus, "VERIFIED");
      await run(sdk.updateCommunicationProvider, "owner-a", {organizationId: f.orgA, id: connectionId, expectedRevision: row.revision, displayName: "Renamed", secretRef: "COMMS_TEST_TWILIO_TOKEN", externalAccountId: ACCOUNT});
      row = await connectionRow(connectionId);
      assert.equal(row.connectionStatus, "CONFIGURED", "any change needs a new verification");
      assert.equal(row.verifiedAt ?? null, null);
      await rejectsWith(run(sdk.updateCommunicationProvider, "owner-a", {organizationId: f.orgA, id: connectionId, expectedRevision: row.revision - 1, displayName: "Stale", secretRef: null, externalAccountId: null}), "COMMUNICATION_PROVIDER_CHANGED");
      await run(sdk.setCommunicationProviderEnabled, "owner-a", {organizationId: f.orgA, id: connectionId, expectedRevision: row.revision, enabled: false});
      row = await connectionRow(connectionId);
      assert.equal(row.connectionStatus, "DISABLED");
      await rejectsWith(server(sdk.recordCommunicationProviderVerification, {organizationId: f.orgA, id: connectionId, expectedRevision: row.revision, actorUid: "admin-a", verified: true, note: "x"}), "COMMUNICATION_PROVIDER_CHANGED");
      await run(sdk.setCommunicationProviderEnabled, "owner-a", {organizationId: f.orgA, id: connectionId, expectedRevision: row.revision, enabled: true});
      row = await connectionRow(connectionId);
      assert.equal(row.connectionStatus, "CONFIGURED");
      const found = (await server(sdk.providerConnectionForWebhook, {id: connectionId})).connections[0];
      assert.equal(key(found.organizationId), key(f.orgA), "the webhook lookup takes the company from the connection");
      await forbidden(sdk.providerConnectionForWebhook, "owner-a", {id: connectionId});
    });

    it("activates a line only when it is registered to the company and assigned to an active member", async () => {
      const number = `+97143${String(Date.now() % 1_000_000).padStart(6, "0")}`;
      lineId = randomUUID();
      const create = (uid, extra = {}) => run(sdk.createCommunicationPhoneLine, uid, {organizationId: f.orgA, id: lineId, providerConnectionId: connectionId, phoneNumber: number, displayName: "Sales line",
        hasAssignee: true, assignedMembershipId: f.memberAgentA, forwardToNumber: "+971509990000", linePurpose: sdk.PhoneLinePurpose.SALES, ...extra});
      await rejectsWith(create("agent-a"), "COMMUNICATION_ADMIN_REQUIRED");
      await rejectsWith(create("owner-a", {assignedMembershipId: f.memberSuspendedA}), "PHONE_LINE_INVALID");
      await forbidden(sdk.createCommunicationPhoneLine, "owner-a", {organizationId: f.orgA, id: randomUUID(), providerConnectionId: connectionId, phoneNumber: "0501234567", displayName: null, hasAssignee: false, assignedMembershipId: null, forwardToNumber: null, linePurpose: sdk.PhoneLinePurpose.SALES});
      await create("owner-a");
      await assert.rejects(create("owner-a", {id: randomUUID()}), "a company number is added once");
      let line = await lineRow(lineId);
      assert.equal(line.status, "PENDING");
      await rejectsWith(run(sdk.setPhoneLineActive, "owner-a", {organizationId: f.orgA, id: lineId, expectedRevision: line.revision, active: true}), "PHONE_LINE_NOT_READY");
      await rejectsWith(run(sdk.confirmPhoneLineRegistration, "agent-a", {organizationId: f.orgA, id: lineId, expectedRevision: line.revision}), "COMMUNICATION_ADMIN_REQUIRED");
      await run(sdk.confirmPhoneLineRegistration, "admin-a", {organizationId: f.orgA, id: lineId, expectedRevision: line.revision});
      line = await lineRow(lineId);
      await run(sdk.setPhoneLineActive, "owner-a", {organizationId: f.orgA, id: lineId, expectedRevision: line.revision, active: true});
      line = await lineRow(lineId);
      assert.equal(line.status, "ACTIVE");
      await rejectsWith(run(sdk.updateCommunicationPhoneLine, "owner-a", {organizationId: f.orgA, id: lineId, expectedRevision: line.revision, displayName: null, hasAssignee: false, assignedMembershipId: null, forwardToNumber: null, linePurpose: sdk.PhoneLinePurpose.SALES}), "PHONE_LINE_INVALID");
    });

    it("lets only an owner or administrator confirm live calling, after the rules are saved", async () => {
      await rejectsWith(run(sdk.attestLiveCalling, "agent-a", {organizationId: f.orgA, version: "2026-11-03"}), "COMMUNICATION_ADMIN_REQUIRED");
      await rejectsWith(run(sdk.attestLiveCalling, "owner-b", {organizationId: f.orgB, version: "2026-11-03"}), "COMMUNICATION_SETTINGS_REQUIRED");
      await forbidden(sdk.attestLiveCalling, "owner-a", {organizationId: f.orgA, version: "not-a-date"});
      await run(sdk.attestLiveCalling, "admin-a", {organizationId: f.orgA, version: "2026-11-03"});
      const {settings} = await run(sdk.getCommunicationSettings, "agent-a", {organizationId: f.orgA});
      assert.ok(settings.liveCallingAttestedAt);
      assert.equal(settings.liveCallingAttestationVersion, "2026-11-03");
    });

    it("lets the database refuse a live call unless the provider, line, attestation, lead and number all check out", async () => {
      const number = `+97150${String(Date.now() % 10_000_000).padStart(7, "0")}`;
      const created = await run(sdk.createLead, "owner-a", {organizationId: f.orgA, fullName: `Live call ${randomUUID().slice(0, 6)}`, phone: number, normalizedPhone: number, assignedMembershipId: f.memberAgentA});
      const leadId = created.lead.id;
      const start = (uid, extra = {}) => run(sdk.startLeadCall, uid, {organizationId: f.orgA, id: randomUUID(), leadId, phoneLineId: lineId, callType: sdk.CallType.FOLLOW_UP, counterpartyNumber: number, attestationVersion: "2026-11-03", ...extra});
      await rejectsWith(start("agent-a"), "LIVE_CALL_LINE_UNAVAILABLE");
      const row = await connectionRow(connectionId);
      await server(sdk.recordCommunicationProviderVerification, {organizationId: f.orgA, id: connectionId, expectedRevision: row.revision, actorUid: "owner-a", verified: true, note: "Synthetic"});
      await rejectsWith(start("agent-a", {attestationVersion: "2020-01-01"}), "LIVE_CALLING_NOT_ATTESTED");
      await rejectsWith(start("agent-a", {counterpartyNumber: "+971500000999"}), "CALL_NUMBER_NOT_ON_RECORD");
      await rejectsWith(start("shared-agent"), "LEAD_NOT_FOUND_OR_FORBIDDEN");
      await rejectsWith(start("owner-a"), "LIVE_CALL_LINE_UNAVAILABLE");
      await forbidden(sdk.startLeadCall, "agent-a", {organizationId: f.orgA, id: randomUUID(), leadId, phoneLineId: lineId, callType: sdk.CallType.INBOUND_ENQUIRY, counterpartyNumber: number, attestationVersion: "2026-11-03"});
      const id = randomUUID();
      await start("agent-a", {id});
      const {call} = await run(sdk.getCallRecord, "agent-a", {organizationId: f.orgA, id});
      assert.equal(call.source, "PROVIDER");
      assert.equal(call.callStatus, "INITIATED");
      assert.equal(key(call.phoneLineId), key(lineId));
      const facts = await server(sdk.dialFacts, {organizationId: f.orgA, agentMembershipId: f.memberAgentA, activeSince: new Date(Date.now() - 3_600_000).toISOString(), daySince: new Date(Date.now() - 3_600_000).toISOString()});
      assert.equal(facts.activeAgent[0].count, 1, "the started call counts as the agent's active call");
      // The provider's call ID is set once; status moves forward with compare-and-set only.
      await server(sdk.setProviderCallId, {organizationId: f.orgA, id, providerCallId: "CA" + "c".repeat(32)});
      await rejectsWith(server(sdk.setProviderCallId, {organizationId: f.orgA, id, providerCallId: "CA" + "d".repeat(32)}), "CALL_STATUS_CHANGED");
      await rejectsWith(server(sdk.applyProviderCallStatus, {organizationId: f.orgA, id, expectedStatus: sdk.CallStatus.RINGING, callStatus: sdk.CallStatus.IN_PROGRESS, answeredAt: null, endedAt: null, durationSeconds: null}), "CALL_STATUS_CHANGED");
      const answeredAt = new Date().toISOString();
      await server(sdk.applyProviderCallStatus, {organizationId: f.orgA, id, expectedStatus: sdk.CallStatus.INITIATED, callStatus: sdk.CallStatus.IN_PROGRESS, answeredAt, endedAt: null, durationSeconds: null});
      await server(sdk.applyProviderCallStatus, {organizationId: f.orgA, id, expectedStatus: sdk.CallStatus.IN_PROGRESS, callStatus: sdk.CallStatus.COMPLETED, answeredAt: null, endedAt: new Date().toISOString(), durationSeconds: 42});
      const after = (await run(sdk.getCallRecord, "agent-a", {organizationId: f.orgA, id})).call;
      assert.equal(after.callStatus, "COMPLETED");
      assert.equal(after.answeredAt.slice(0, 19), answeredAt.slice(0, 19), "a later event keeps the answer time");
      assert.equal(after.durationSeconds, 42);
      await forbidden(sdk.applyProviderCallStatus, "owner-a", {organizationId: f.orgA, id, expectedStatus: sdk.CallStatus.COMPLETED, callStatus: sdk.CallStatus.FAILED, answeredAt: null, endedAt: null, durationSeconds: null});
    });

    it("records each provider event once and creates incoming calls only on active lines", async () => {
      const eventKey = `CA${"e".repeat(32)}:ringing`;
      const record = id => server(sdk.recordCallProviderEvent, {organizationId: f.orgA, id, providerConnectionId: connectionId, eventKey, eventType: "CALL_STATUS", providerCallId: "CA" + "e".repeat(32), callStatus: sdk.CallStatus.RINGING, occurredAt: new Date().toISOString()});
      await record(randomUUID());
      await assert.rejects(record(randomUUID()), "a repeated delivery is refused by the unique key");
      await forbidden(sdk.recordCallProviderEvent, "owner-a", {organizationId: f.orgA, id: randomUUID(), providerConnectionId: connectionId, eventKey: "other", eventType: "CALL_STATUS", providerCallId: null, callStatus: null, occurredAt: null});
      const line = await lineRow(lineId);
      const resolved = await server(sdk.resolveProviderCall, {organizationId: f.orgA, providerConnectionId: connectionId, providerCallId: "CA" + "f".repeat(32), lineNumber: line.phoneNumber, customerNumber: "+971500000123"});
      assert.equal(resolved.calls.length, 0);
      assert.equal(key(resolved.lines[0].assignedMembershipId), key(f.memberAgentA));
      const id = randomUUID();
      await server(sdk.createIncomingProviderCall, {organizationId: f.orgA, id, providerConnectionId: connectionId, providerCallId: "CA" + "f".repeat(32), phoneLineId: lineId, agentMembershipId: f.memberAgentA, actorUid: "agent-a",
        callStatus: sdk.CallStatus.INITIATED, callerNumber: "+971500000123", recipientNumber: line.phoneNumber, counterpartyNumber: "+971500000123", contactId: null, leadId: null, startedAt: new Date().toISOString()});
      await assert.rejects(server(sdk.createIncomingProviderCall, {organizationId: f.orgA, id: randomUUID(), providerConnectionId: connectionId, providerCallId: "CA" + "f".repeat(32), phoneLineId: lineId, agentMembershipId: f.memberAgentA, actorUid: "agent-a",
        callStatus: sdk.CallStatus.INITIATED, callerNumber: null, recipientNumber: line.phoneNumber, counterpartyNumber: null, contactId: null, leadId: null, startedAt: new Date().toISOString()}), "one record per provider call");
      const {call} = await run(sdk.getCallRecord, "agent-a", {organizationId: f.orgA, id});
      assert.equal(call.direction, "INBOUND");
      await forbidden(sdk.getCallRecord, "shared-agent", {organizationId: f.orgA, id});
    });

    it("lists only the calls each member may read, with filters, and the dashboard follows the same rules", async () => {
      const owner = await run(sdk.listCalls, "owner-a", {organizationId: f.orgA, limit: 100, offset: 0});
      const agent = await run(sdk.listCalls, "agent-a", {organizationId: f.orgA, limit: 100, offset: 0});
      const manager = await run(sdk.listCalls, "manager-a", {organizationId: f.orgA, limit: 100, offset: 0});
      assert.ok(owner.total[0].count >= agent.total[0].count && agent.total[0].count > 0);
      assert.equal(manager.total[0].count, 0, "a manager without leads or calls sees none");
      assert.ok(owner.agents.length > 0, "owners get the agent filter");
      assert.equal(agent.agents.length, 0, "agents do not get other members' names");
      const inbound = await run(sdk.listCalls, "owner-a", {organizationId: f.orgA, limit: 100, offset: 0, direction: sdk.CallDirection.INBOUND});
      assert.ok(inbound.calls.length > 0 && inbound.calls.every(call => call.direction === "INBOUND"));
      const providerOnly = await run(sdk.listCalls, "owner-a", {organizationId: f.orgA, limit: 100, offset: 0, source: sdk.CallSource.PROVIDER});
      assert.ok(providerOnly.calls.every(call => call.source === "PROVIDER"));
      await forbidden(sdk.listCalls, "owner-b", {organizationId: f.orgA, limit: 10, offset: 0});
      const now = new Date();
      const dashboard = await run(sdk.communicationDashboard, "agent-a", {organizationId: f.orgA, since: new Date(now.getTime() - 30 * 86_400_000).toISOString(), now: now.toISOString(), until: new Date(now.getTime() + 7 * 86_400_000).toISOString()});
      assert.equal(dashboard.calls.length, Math.min(agent.total[0].count, 1000));
      await forbidden(sdk.communicationDashboard, "owner-b", {organizationId: f.orgA, since: now.toISOString(), now: now.toISOString(), until: now.toISOString()});
    });
  });

  describe("Phase 6F.3 consent, recordings and transcripts", {concurrency: false}, () => {
    const key = value => String(value).replaceAll("-", "").toLowerCase();
    const server = async (operation, variables) => (await operation(dc, variables)).data;
    const rejectsWith = (promise, token) => assert.rejects(promise, error => String(error?.message ?? error).includes(token), token);
    let callId, unansweredId, consentId;

    it("records consent only for answered calls, by the call's agent or an administrator, while recording is enabled", async () => {
      const number = `+97150${String(Date.now() % 10_000_000).padStart(7, "0")}`;
      const created = await run(sdk.createLead, "owner-a", {organizationId: f.orgA, fullName: `Recorded call ${randomUUID().slice(0, 6)}`, phone: number, normalizedPhone: number, assignedMembershipId: f.memberAgentA});
      const base = {organizationId: f.orgA, leadId: created.lead.id, direction: sdk.CallDirection.OUTBOUND, callType: sdk.CallType.FOLLOW_UP, outcome: null, startedAt: new Date(Date.now() - 600_000).toISOString(),
        notes: null, counterpartyNumber: number, followUpRequired: false, hasViewing: false, viewingId: null, suppress: false, suppressionId: randomUUID()};
      callId = randomUUID(); unansweredId = randomUUID();
      await run(sdk.logLeadCall, "agent-a", {...base, id: callId, callStatus: sdk.CallStatus.COMPLETED, durationSeconds: 300});
      await run(sdk.logLeadCall, "agent-a", {...base, id: unansweredId, callStatus: sdk.CallStatus.NO_ANSWER, durationSeconds: 0});
      const consent = (uid, extra = {}) => run(sdk.recordCallConsent, uid, {organizationId: f.orgA, id: randomUUID(), callId, status: sdk.CallConsentStatus.GIVEN, method: "VERBAL_ON_CALL", note: null, ...extra});
      await rejectsWith(consent("agent-a", {callId: unansweredId}), "CALL_CHANGED_OR_FORBIDDEN");
      await rejectsWith(consent("shared-agent"), "CALL_CHANGED_OR_FORBIDDEN");
      await rejectsWith(consent("manager-a"), "CALL_CHANGED_OR_FORBIDDEN");
      await forbidden(sdk.recordCallConsent, "owner-b", {organizationId: f.orgA, id: randomUUID(), callId, status: sdk.CallConsentStatus.GIVEN, method: "VERBAL_ON_CALL", note: null});
      await forbidden(sdk.recordCallConsent, "agent-a", {organizationId: f.orgA, id: randomUUID(), callId, status: sdk.CallConsentStatus.WITHDRAWN, method: "VERBAL_ON_CALL", note: null});
      await forbidden(sdk.recordCallConsent, "agent-a", {organizationId: f.orgA, id: randomUUID(), callId, status: sdk.CallConsentStatus.GIVEN, method: "GUESSED", note: null});
      consentId = randomUUID();
      await consent("agent-a", {id: consentId});
      const media = await run(sdk.getCallMedia, "agent-a", {organizationId: f.orgA, callId});
      const row = media.consents.find(item => key(item.id) === key(consentId));
      assert.equal(row.status, "GIVEN");
      assert.ok(row.noticeText.length >= 20 && row.legalBasis.length >= 5, "the company's notice and legal basis are copied into the evidence");
      await forbidden(sdk.getCallMedia, "shared-agent", {organizationId: f.orgA, callId});
    });

    it("lets only the server create recordings and transcripts, for the right call, consent and member", async () => {
      const recording = (extra = {}) => ({organizationId: f.orgA, id: randomUUID(), callId, consentEvidenceId: consentId, actorUid: "agent-a", source: "UPLOAD",
        storagePath: `organizations/${f.orgA}/communications/calls/${callId}/recordings/x.wav`, contentType: "audio/wav", byteSize: 1000, durationSeconds: 60, recordedAt: new Date().toISOString(), ...extra});
      await forbidden(sdk.createCallRecording, "agent-a", recording());
      await rejectsWith(server(sdk.createCallRecording, recording({actorUid: "manager-a"})), "CALL_CHANGED_OR_FORBIDDEN");
      await rejectsWith(server(sdk.createCallRecording, recording({callId: unansweredId})), "CALL_CHANGED_OR_FORBIDDEN");
      const otherConsent = randomUUID();
      await rejectsWith(server(sdk.createCallRecording, recording({consentEvidenceId: otherConsent})), "CALL_CONSENT_REQUIRED");
      const stored = recording();
      await server(sdk.createCallRecording, stored);
      const transcriptId = randomUUID();
      await server(sdk.createCallTranscript, {organizationId: f.orgA, id: transcriptId, callId, consentEvidenceId: consentId, actorUid: "admin-a", source: sdk.TranscriptSource.UPLOAD, sourceName: "Synthetic service",
        language: "en", transcriptReference: `organizations/${f.orgA}/communications/calls/${callId}/transcripts/t.json`, segmentCount: 3, hasTimestamps: true, generatedAt: new Date().toISOString()});
      const media = await run(sdk.getCallMedia, "owner-a", {organizationId: f.orgA, callId});
      assert.equal(media.recordings.length, 1);
      assert.equal(media.transcripts.length, 1);
      assert.ok(Date.parse(media.recordings[0].retentionUntil) > Date.now() + 80 * 86_400_000, "retention follows the company setting");
      assert.equal((await run(sdk.getCallRecordingFile, "agent-a", {organizationId: f.orgA, id: stored.id})).recording.storagePath, stored.storagePath);
      await rejectsWith(run(sdk.getCallRecordingFile, "shared-agent", {organizationId: f.orgA, id: stored.id}), "CALL_MEDIA_NOT_FOUND");
      await rejectsWith(run(sdk.getCallRecordingFile, "manager-a", {organizationId: f.orgA, id: stored.id}), "CALL_MEDIA_NOT_FOUND");
      await forbidden(sdk.getCallRecordingFile, "owner-b", {organizationId: f.orgA, id: stored.id});
      await forbidden(sdk.getCallTranscriptFile, "owner-b", {organizationId: f.orgA, id: transcriptId});
      await forbidden(sdk.recordCallMediaAccess, "agent-a", {organizationId: f.orgA, actorUid: "agent-a", targetType: sdk.AuditTargetType.CALL_RECORDING, targetId: stored.id});
    });

    it("deletes a consent's recordings and transcripts when it is withdrawn, and keeps the withdrawn evidence", async () => {
      await rejectsWith(run(sdk.withdrawCallConsent, "shared-agent", {organizationId: f.orgA, id: consentId, note: "Not mine"}), "CALL_CONSENT_NOT_FOUND");
      await run(sdk.withdrawCallConsent, "agent-a", {organizationId: f.orgA, id: consentId, note: "Customer asked to delete the recording"});
      const media = await run(sdk.getCallMedia, "owner-a", {organizationId: f.orgA, callId});
      assert.equal(media.recordings.length + media.transcripts.length, 0);
      assert.equal(media.consents.find(item => key(item.id) === key(consentId)).status, "WITHDRAWN");
      await rejectsWith(run(sdk.withdrawCallConsent, "agent-a", {organizationId: f.orgA, id: consentId, note: "Twice"}), "CALL_CONSENT_NOT_FOUND");
      await rejectsWith(server(sdk.createCallRecording, {organizationId: f.orgA, id: randomUUID(), callId, consentEvidenceId: consentId, actorUid: "agent-a", source: "UPLOAD", storagePath: "x", contentType: "audio/wav", byteSize: 1, durationSeconds: 1, recordedAt: new Date().toISOString()}), "CALL_CONSENT_REQUIRED");
      const due = await server(sdk.callMediaToRemove, {now: new Date().toISOString(), limit: 100});
      assert.ok(due.deletedRecordings.some(item => key(item.organizationId) === key(f.orgA)), "the server is told which files to remove");
    });

    it("lets only owners and administrators delete, and expires media after the retention date", async () => {
      const consent = randomUUID();
      await run(sdk.recordCallConsent, "admin-a", {organizationId: f.orgA, id: consent, callId, status: sdk.CallConsentStatus.NOTICE_GIVEN, method: "ANNOUNCEMENT", note: null});
      const first = randomUUID(), second = randomUUID();
      for (const id of [first, second]) await server(sdk.createCallRecording, {organizationId: f.orgA, id, callId, consentEvidenceId: consent, actorUid: "admin-a", source: "UPLOAD",
        storagePath: `organizations/${f.orgA}/communications/calls/${callId}/recordings/${id}.wav`, contentType: "audio/wav", byteSize: 1, durationSeconds: 30, recordedAt: new Date().toISOString()});
      await rejectsWith(run(sdk.deleteCallRecording, "agent-a", {organizationId: f.orgA, id: first}), "COMMUNICATION_ADMIN_REQUIRED");
      await run(sdk.deleteCallRecording, "owner-a", {organizationId: f.orgA, id: first});
      await rejectsWith(run(sdk.deleteCallRecording, "owner-a", {organizationId: f.orgA, id: first}), "CALL_MEDIA_NOT_FOUND");
      await rejectsWith(server(sdk.expireCallRecording, {organizationId: f.orgA, id: second}), "CALL_MEDIA_NOT_FOUND");
      await dc.executeGraphql(`mutation Past($org: UUID!, $id: UUID!) { callRecording_update(key: {organizationId: $org, id: $id}, data: {retentionUntil_expr: "request.time - duration('60s')"}) }`, {variables: {org: f.orgA, id: second}});
      const due = await server(sdk.callMediaToRemove, {now: new Date().toISOString(), limit: 100});
      assert.ok(due.expiredRecordings.some(item => key(item.id) === key(second)));
      await server(sdk.expireCallRecording, {organizationId: f.orgA, id: second});
      const files = await server(sdk.deletedCallMediaFile, {organizationId: f.orgA, id: second});
      assert.equal(files.recording.status, "DELETED");
      await server(sdk.markCallMediaFileDeleted, {organizationId: f.orgA, recordingId: second, transcriptId: null, isRecording: true});
      const after = await server(sdk.callMediaToRemove, {now: new Date().toISOString(), limit: 100});
      assert.ok(!after.deletedRecordings.some(item => key(item.id) === key(second)), "a removed file is not removed again");
    });
  });

  describe("Phase 6F.4 Claude call summaries", {concurrency: false}, () => {
    const server = async (operation, variables) => (await operation(dc, variables)).data;
    const rejectsWith = (promise, token) => assert.rejects(promise, error => String(error?.message ?? error).includes(token), token);
    const summaryJson = JSON.stringify({reasonForCall: null, requirements: [], locations: [], budget: null, preferences: [], questions: [], agreements: [], nextSteps: [], suggestions: [], overallConfidence: "LOW", limitations: "Synthetic", unverifiedCount: 0});
    let callId, transcriptId, otherCallId;
    const create = (extra = {}) => server(sdk.createCallAiSummary, {organizationId: f.orgA, id: randomUUID(), callId, actorUid: "agent-a", sourceKind: "NOTES", hasTranscript: false, transcriptId: null,
      summaryJson, overallConfidence: "LOW", unverifiedCount: 0, model: "claude-test", promptVersion: "call-summary-1", ...extra});

    it("stores summaries only from the server, when the company enabled Claude analysis, for the call's agent or an administrator", async () => {
      const number = `+97150${String(Date.now() % 10_000_000).padStart(7, "0")}`;
      const created = await run(sdk.createLead, "owner-a", {organizationId: f.orgA, fullName: `Summarised call ${randomUUID().slice(0, 6)}`, phone: number, normalizedPhone: number, assignedMembershipId: f.memberAgentA});
      const base = {organizationId: f.orgA, leadId: created.lead.id, direction: sdk.CallDirection.OUTBOUND, callType: sdk.CallType.FOLLOW_UP, callStatus: sdk.CallStatus.COMPLETED, outcome: null,
        startedAt: new Date(Date.now() - 600_000).toISOString(), durationSeconds: 120, notes: "Synthetic notes", counterpartyNumber: number, followUpRequired: false, hasViewing: false, viewingId: null, suppress: false, suppressionId: randomUUID()};
      callId = randomUUID(); otherCallId = randomUUID();
      await run(sdk.logLeadCall, "agent-a", {...base, id: callId});
      await run(sdk.logLeadCall, "agent-a", {...base, id: otherCallId});
      await rejectsWith(create(), "CALL_AI_NOT_AVAILABLE");
      const {settings} = await run(sdk.getCommunicationSettings, "owner-a", {organizationId: f.orgA});
      await run(sdk.updateCommunicationSettings, "owner-a", {organizationId: f.orgA, expectedRevision: settings.revision, timeZone: settings.timeZone, callingWindowStart: settings.callingWindowStart, callingWindowEnd: settings.callingWindowEnd,
        maxCallsPerContactPerDay: settings.maxCallsPerContactPerDay, telemarketingEnabled: false, telemarketingApprovalReference: null, marketingWindowStart: "09:00", marketingWindowEnd: "18:00", marketingMaxCallsPerDay: 1, marketingMaxUnansweredPerWeek: 2,
        allowedCallingCodes: "971", maxConcurrentLiveCalls: 5, maxLiveCallsPerAgentPerDay: 60, recordingEnabled: true, recordingNoticeText: settings.recordingNoticeText, recordingLegalBasis: settings.recordingLegalBasis, retentionDays: 90, aiAnalysisEnabled: true});
      await forbidden(sdk.createCallAiSummary, "agent-a", {organizationId: f.orgA, id: randomUUID(), callId, actorUid: "agent-a", sourceKind: "NOTES", hasTranscript: false, transcriptId: null, summaryJson, overallConfidence: "LOW", unverifiedCount: 0, model: "x", promptVersion: "x"});
      await rejectsWith(create({actorUid: "shared-agent"}), "CALL_AI_NOT_AVAILABLE");
      await rejectsWith(create({actorUid: "manager-a"}), "CALL_AI_NOT_AVAILABLE");
      // A transcript of another call cannot be the source.
      const consent = randomUUID();
      await run(sdk.recordCallConsent, "agent-a", {organizationId: f.orgA, id: consent, callId: otherCallId, status: sdk.CallConsentStatus.GIVEN, method: "VERBAL_ON_CALL", note: null});
      transcriptId = randomUUID();
      await server(sdk.createCallTranscript, {organizationId: f.orgA, id: transcriptId, callId: otherCallId, consentEvidenceId: consent, actorUid: "agent-a", source: sdk.TranscriptSource.UPLOAD, sourceName: "Synthetic",
        language: "en", transcriptReference: `organizations/${f.orgA}/communications/calls/${otherCallId}/transcripts/t.json`, segmentCount: 2, hasTimestamps: true, generatedAt: new Date().toISOString()});
      await rejectsWith(create({sourceKind: "TRANSCRIPT", hasTranscript: true, transcriptId}), "CALL_AI_NOT_AVAILABLE");
      const id = randomUUID();
      await create({id});
      await server(sdk.createCallAiSuggestion, {organizationId: f.orgA, id: randomUUID(), summaryId: id, callId, kind: "FOLLOW_UP", title: "Call back", detail: "Synthetic", basis: "STATED", confidence: "HIGH", verified: true});
      await rejectsWith(server(sdk.createCallAiSuggestion, {organizationId: f.orgA, id: randomUUID(), summaryId: id, callId: otherCallId, kind: "FOLLOW_UP", title: "x", detail: "x", basis: "STATED", confidence: "HIGH", verified: true}), "CALL_AI_SUMMARY_CHANGED");
      const listed = await run(sdk.listCallSummaries, "agent-a", {organizationId: f.orgA, callId});
      assert.equal(listed.summaries.length, 1);
      assert.equal(listed.summaries[0].suggestions.length, 1);
      assert.equal(listed.settings.aiAnalysisEnabled, true);
      await forbidden(sdk.listCallSummaries, "shared-agent", {organizationId: f.orgA, callId});
      await forbidden(sdk.listCallSummaries, "owner-b", {organizationId: f.orgA, callId});
    });

    it("lets the call's agent or an administrator review a summary and decide each suggestion once", async () => {
      const {summaries} = await run(sdk.listCallSummaries, "owner-a", {organizationId: f.orgA, callId});
      const summary = summaries[0], suggestion = summary.suggestions[0];
      await rejectsWith(run(sdk.reviewCallAiSummary, "shared-agent", {organizationId: f.orgA, id: summary.id, status: sdk.CallSummaryStatus.REVIEWED}), "CALL_AI_SUMMARY_CHANGED");
      await forbidden(sdk.reviewCallAiSummary, "agent-a", {organizationId: f.orgA, id: summary.id, status: sdk.CallSummaryStatus.DRAFT});
      await run(sdk.reviewCallAiSummary, "agent-a", {organizationId: f.orgA, id: summary.id, status: sdk.CallSummaryStatus.REVIEWED});
      await rejectsWith(run(sdk.reviewCallAiSummary, "owner-a", {organizationId: f.orgA, id: summary.id, status: sdk.CallSummaryStatus.DISMISSED}), "CALL_AI_SUMMARY_CHANGED");
      await rejectsWith(run(sdk.decideCallAiSuggestion, "shared-agent", {organizationId: f.orgA, id: suggestion.id, status: sdk.CallSuggestionStatus.ACCEPTED, resultType: "FOLLOW_UP", resultId: null}), "CALL_AI_SUGGESTION_DECIDED");
      await forbidden(sdk.decideCallAiSuggestion, "agent-a", {organizationId: f.orgA, id: suggestion.id, status: sdk.CallSuggestionStatus.ACCEPTED, resultType: "SEND_WHATSAPP", resultId: null});
      await run(sdk.decideCallAiSuggestion, "agent-a", {organizationId: f.orgA, id: suggestion.id, status: sdk.CallSuggestionStatus.ACCEPTED, resultType: "FOLLOW_UP", resultId: null});
      await rejectsWith(run(sdk.decideCallAiSuggestion, "agent-a", {organizationId: f.orgA, id: suggestion.id, status: sdk.CallSuggestionStatus.DISMISSED, resultType: null, resultId: null}), "CALL_AI_SUGGESTION_DECIDED");
      const after = (await run(sdk.listCallSummaries, "agent-a", {organizationId: f.orgA, callId})).summaries[0];
      assert.equal(after.status, "REVIEWED");
      assert.equal(after.suggestions[0].status, "ACCEPTED");
    });

    it("clears summaries made from a transcript when the transcript is deleted", async () => {
      const id = randomUUID();
      await server(sdk.createCallAiSummary, {organizationId: f.orgA, id, callId: otherCallId, actorUid: "agent-a", sourceKind: "TRANSCRIPT", hasTranscript: true, transcriptId,
        summaryJson, overallConfidence: "LOW", unverifiedCount: 0, model: "claude-test", promptVersion: "call-summary-1"});
      assert.equal((await run(sdk.listCallSummaries, "agent-a", {organizationId: f.orgA, callId: otherCallId})).summaries.length, 1);
      await run(sdk.deleteCallTranscript, "admin-a", {organizationId: f.orgA, id: transcriptId});
      assert.equal((await run(sdk.listCallSummaries, "agent-a", {organizationId: f.orgA, callId: otherCallId})).summaries.length, 0, "the derived summary is gone with its transcript");
      const stored = (await dc.executeGraphql(`query S($org: UUID!, $id: UUID!) { callAiSummary(key: {organizationId: $org, id: $id}) { summaryJson deletedAt } }`, {variables: {org: f.orgA, id}})).data.callAiSummary;
      assert.equal(stored.summaryJson, "{}", "its content is erased, not just hidden");
      assert.ok(stored.deletedAt);
    });
  });

  describe("Phase 6F.5 voice assistant test mode", {concurrency: false}, () => {
    const server = async (operation, variables) => (await operation(dc, variables)).data;
    const rejectsWith = (promise, token) => assert.rejects(promise, error => String(error?.message ?? error).includes(token), token);
    const config = (extra = {}) => ({organizationId: f.orgA, status: sdk.VoiceAssistantStatus.DRAFT, assistantName: "Synthetic Assistant", disclosureText: "You are speaking with an AI virtual assistant, not a person.",
      greeting: "How can I help?", questionsJson: "[]", handoffMessage: "A colleague will call you back.", projectIdsJson: "[]", listingIdsJson: "[]", maxTurns: 6, maxSessionMinutes: 5, maxReplyTokens: 2000, ...extra});
    const turns = JSON.stringify([{id: "t1", role: "ASSISTANT", kind: "DISCLOSURE", text: "AI disclosure", at: new Date().toISOString()}]);
    const sessionId = randomUUID();
    const save = (extra = {}) => server(sdk.saveVoiceTestSession, {organizationId: f.orgA, id: sessionId, actorUid: "owner-a", expectedRevision: 1, status: sdk.VoiceTestSessionStatus.ACTIVE,
      turnsJson: turns, callerTurns: 1, pendingTurnId: randomUUID(), pendingSince: new Date().toISOString(), handoffReason: null, viewingRequestJson: null, endedAt: null, inputTokens: 0, outputTokens: 0, ...extra});

    it("lets only owners and administrators configure the assistant, and requires an AI disclosure", async () => {
      await forbidden(sdk.getVoiceAssistant, "manager-a", {organizationId: f.orgA});
      await forbidden(sdk.getVoiceAssistant, "agent-a", {organizationId: f.orgA});
      await forbidden(sdk.getVoiceAssistant, "owner-b", {organizationId: f.orgA});
      await forbidden(sdk.createVoiceAssistantConfig, "agent-a", config());
      await forbidden(sdk.createVoiceAssistantConfig, "owner-a", config({disclosureText: "Hello and thank you for calling our agency today."}));
      await forbidden(sdk.createVoiceAssistantConfig, "owner-a", config({maxTurns: 99}));
      await run(sdk.createVoiceAssistantConfig, "owner-a", config());
      await assert.rejects(run(sdk.createVoiceAssistantConfig, "admin-a", config()), "one configuration per company");
      await run(sdk.updateVoiceAssistantConfig, "admin-a", {...config({status: sdk.VoiceAssistantStatus.TEST_ONLY}), expectedRevision: 1});
      await rejectsWith(run(sdk.updateVoiceAssistantConfig, "owner-a", {...config(), expectedRevision: 1}), "VOICE_ASSISTANT_CHANGED");
      const {config: stored} = await run(sdk.getVoiceAssistant, "owner-a", {organizationId: f.orgA});
      assert.equal(stored.revision, 2);
      assert.equal(stored.status, "TEST_ONLY");
      const {voiceAssistantConfig} = await run(sdk.getVoiceAssistant, "owner-b", {organizationId: f.orgB}).then(data => ({voiceAssistantConfig: data.config}));
      assert.equal(voiceAssistantConfig, null, "another company sees only its own (absent) configuration");
    });

    it("writes test sessions only from the server, for the member who started them, with compare-and-set", async () => {
      await forbidden(sdk.startVoiceTestSession, "owner-a", {organizationId: f.orgA, id: randomUUID(), actorUid: "owner-a", configRevision: 2, factsJson: "{}", turnsJson: turns});
      await rejectsWith(server(sdk.startVoiceTestSession, {organizationId: f.orgA, id: randomUUID(), actorUid: "agent-a", configRevision: 2, factsJson: "{}", turnsJson: turns}), "VOICE_ASSISTANT_ADMIN_REQUIRED");
      await rejectsWith(server(sdk.startVoiceTestSession, {organizationId: f.orgA, id: randomUUID(), actorUid: "owner-a", configRevision: 1, factsJson: "{}", turnsJson: turns}), "VOICE_ASSISTANT_NOT_READY");
      await rejectsWith(server(sdk.startVoiceTestSession, {organizationId: f.orgB, id: randomUUID(), actorUid: "owner-a", configRevision: 2, factsJson: "{}", turnsJson: turns}), "VOICE_ASSISTANT_ADMIN_REQUIRED");
      await server(sdk.startVoiceTestSession, {organizationId: f.orgA, id: sessionId, actorUid: "owner-a", configRevision: 2, factsJson: "{}", turnsJson: turns});

      await forbidden(sdk.saveVoiceTestSession, "owner-a", {organizationId: f.orgA, id: sessionId, actorUid: "owner-a", expectedRevision: 1, status: sdk.VoiceTestSessionStatus.ACTIVE, turnsJson: "[]", callerTurns: 0, inputTokens: 0, outputTokens: 0});
      await rejectsWith(save({actorUid: "admin-a"}), "VOICE_TEST_SESSION_CHANGED");
      await save({inputTokens: 120, outputTokens: 30});
      await rejectsWith(save(), "VOICE_TEST_SESSION_CHANGED");
      await save({expectedRevision: 2, status: sdk.VoiceTestSessionStatus.HANDED_OFF, pendingTurnId: null, pendingSince: null, handoffReason: "CALLER_ASKED_FOR_PERSON", endedAt: new Date().toISOString(), inputTokens: 10, outputTokens: 5});
      await rejectsWith(save({expectedRevision: 3}), "VOICE_TEST_SESSION_CHANGED");

      const {session} = await run(sdk.getVoiceTestSession, "admin-a", {organizationId: f.orgA, id: sessionId});
      assert.equal(session.status, "HANDED_OFF");
      assert.equal(session.revision, 3);
      assert.equal(session.inputTokens, 130);
      assert.equal(session.outputTokens, 35);
      assert.equal(session.pendingTurnId, null);
      assert.ok(session.endedAt);
      await forbidden(sdk.getVoiceTestSession, "manager-a", {organizationId: f.orgA, id: sessionId});
      await forbidden(sdk.getVoiceTestSession, "owner-b", {organizationId: f.orgA, id: sessionId});
      assert.equal((await run(sdk.getVoiceTestSession, "owner-b", {organizationId: f.orgB, id: sessionId})).session, null);
      const {sessions} = await run(sdk.getVoiceAssistant, "owner-a", {organizationId: f.orgA});
      assert.ok(sessions.some(item => item.id.replaceAll("-", "") === sessionId.replaceAll("-", "")));
    });
  });

  describe("Phase 6F.6 workflow events, meetings and reports", {concurrency: false}, () => {
    const key = value => String(value).replaceAll("-", "").toLowerCase();
    const server = async (operation, variables) => (await operation(dc, variables)).data;
    const rejectsWith = (promise, token) => assert.rejects(promise, error => String(error?.message ?? error).includes(token), token);
    const events = async targetId => (await dc.executeGraphql(`query E($org: UUID!, $target: UUID!) { automationEvents(where: {organizationId: {eq: $org}, targetId: {eq: $target}}) { triggerType targetType origin deduplicationKey payload } }`,
      {variables: {org: f.orgA, target: targetId}})).data.automationEvents;
    let leadId, number, meetingId;
    const callVars = extra => ({organizationId: f.orgA, id: randomUUID(), leadId, direction: sdk.CallDirection.OUTBOUND, callType: sdk.CallType.FOLLOW_UP, callStatus: sdk.CallStatus.COMPLETED, outcome: null,
      startedAt: new Date(Date.now() - 300_000).toISOString(), durationSeconds: 60, notes: null, counterpartyNumber: number, followUpRequired: false, hasViewing: false, viewingId: null, suppress: false, suppressionId: randomUUID(), ...extra});
    const meetingVars = extra => ({organizationId: f.orgA, id: randomUUID(), hasLead: true, leadId, hasContact: false, contactId: null, title: "Synthetic consultation", provider: sdk.MeetingProvider.GOOGLE_MEET,
      meetingUrl: "https://meet.google.com/abc-defg-hij", location: null, startsAt: new Date(Date.now() + 86_400_000).toISOString(), endsAt: new Date(Date.now() + 86_400_000 + 1_800_000).toISOString(), agenda: null, ...extra});

    it("writes one workflow event per finished call in the same transaction; unanswered outgoing attempts write none", async () => {
      number = `+97150${String(Date.now() % 10_000_000).padStart(7, "0")}`;
      const created = await run(sdk.createLead, "owner-a", {organizationId: f.orgA, fullName: `Workflow call ${randomUUID().slice(0, 6)}`, phone: number, normalizedPhone: number, assignedMembershipId: f.memberAgentA});
      leadId = created.lead.id;
      const answered = callVars();
      await run(sdk.logLeadCall, "agent-a", answered);
      const [event] = await events(answered.id);
      assert.equal(event.triggerType, "call.completed");
      assert.equal(event.targetType, "CALL");
      assert.equal(event.origin, "CRM");
      assert.equal(key(event.payload.leadId), key(leadId));
      const attempt = callVars({callStatus: sdk.CallStatus.NO_ANSWER, durationSeconds: 0});
      await run(sdk.logLeadCall, "agent-a", attempt);
      assert.equal((await events(attempt.id)).length, 0, "an unanswered outgoing attempt starts nothing");
      const missed = callVars({direction: sdk.CallDirection.INBOUND, callType: sdk.CallType.INBOUND_ENQUIRY, callStatus: sdk.CallStatus.NO_ANSWER, durationSeconds: 0});
      await run(sdk.logLeadCall, "agent-a", missed);
      assert.equal((await events(missed.id))[0].triggerType, "call.missed");
      await forbidden(generated.logLeadCall, "agent-a", {...callVars(), emitEvent: false}, undefined);
      await forbidden(generated.logLeadCall, "agent-a", {...callVars({callStatus: sdk.CallStatus.NO_ANSWER, durationSeconds: 0}), emitEvent: true});

      const facts = await run(sdk.automationFacts, "owner-a", {organizationId: f.orgA, since: new Date(Date.now() - 3_600_000).toISOString(), leadId, hasLead: true, hasListing: false, hasViewing: false,
        hasFollowUp: false, hasWorkTask: false, hasContact: false, callId: answered.id, hasCall: true});
      assert.equal(facts.call.callStatus, "COMPLETED");
      assert.equal(key(facts.call.agentMembershipId), key(f.memberAgentA));
      assert.equal(facts.answeredCalls.length, 1, "an answered call counts as contact with the lead");

      // A stored Claude summary writes call.summary_ready in the same transaction; one made by a workflow step carries its lineage.
      const summaryJson = JSON.stringify({suggestions: []});
      const fromMember = randomUUID(), fromWorkflow = randomUUID(), workflowId = randomUUID(), executionId = randomUUID(), originalEventId = randomUUID();
      const summary = (id, extra = {}) => server(sdk.createCallAiSummary, {organizationId: f.orgA, id, callId: answered.id, actorUid: "agent-a", sourceKind: "NOTES", hasTranscript: false, transcriptId: null,
        summaryJson, overallConfidence: "LOW", unverifiedCount: 0, model: "synthetic", promptVersion: "call-summary-1", ...extra});
      await summary(fromMember);
      await summary(fromWorkflow, {originalEventId, parentExecutionId: executionId, originWorkflowId: workflowId, chainDepth: 1});
      const ready = (await events(answered.id)).filter(row => row.triggerType === "call.summary_ready");
      assert.equal(ready.length, 2);
      assert.deepEqual(ready.map(row => row.origin).sort(), ["CRM", "WORKFLOW"]);
      const lineage = (await dc.executeGraphql(`query L($org: UUID!, $workflow: UUID!) { automationEvents(where: {organizationId: {eq: $org}, originWorkflowId: {eq: $workflow}}) { chainDepth originWorkflowId triggerType } }`,
        {variables: {org: f.orgA, workflow: workflowId}})).data.automationEvents[0];
      assert.equal(lineage.triggerType, "call.summary_ready");
      assert.equal(lineage.chainDepth, 1);
      assert.equal(key(lineage.originWorkflowId), key(workflowId), "loop prevention sees which workflow made the summary");
    });

    it("schedules meetings for accessible leads only, with the link rules, and writes meeting.scheduled", async () => {
      await rejectsWith(run(sdk.createMeeting, "shared-agent", meetingVars()), "MEETING_TARGET_NOT_FOUND");
      await forbidden(sdk.createMeeting, "owner-b", meetingVars());
      await forbidden(sdk.createMeeting, "agent-a", meetingVars({provider: sdk.MeetingProvider.ZOOM, meetingUrl: null}));
      await forbidden(sdk.createMeeting, "agent-a", meetingVars({provider: sdk.MeetingProvider.IN_PERSON}));
      await forbidden(sdk.createMeeting, "agent-a", meetingVars({meetingUrl: "http://meet.google.com/abc"}));
      await forbidden(sdk.createMeeting, "agent-a", meetingVars({endsAt: new Date(Date.now() + 86_400_000 - 60_000).toISOString()}));
      await forbidden(sdk.createMeeting, "agent-a", meetingVars({hasContact: true, contactId: randomUUID()}));
      const vars = meetingVars();
      meetingId = vars.id;
      await run(sdk.createMeeting, "agent-a", vars);
      assert.equal((await events(meetingId))[0].triggerType, "meeting.scheduled");
      const {meeting} = await run(sdk.getMeeting, "agent-a", {organizationId: f.orgA, id: meetingId});
      assert.equal(key(meeting.organizerMembershipId), key(f.memberAgentA));
      assert.ok(meeting.contactId, "the lead's contact is linked");
      await forbidden(sdk.getMeeting, "owner-b", {organizationId: f.orgA, id: meetingId});
      assert.equal((await run(sdk.getMeeting, "manager-a", {organizationId: f.orgA, id: meetingId})).meeting, null, "a manager without the lead does not see it");
      await rejectsWith(run(sdk.addMeetingAttendee, "agent-a", {organizationId: f.orgA, id: randomUUID(), meetingId, membershipId: f.memberSuspendedA}), "MEETING_ATTENDEE_INVALID");
      await rejectsWith(run(sdk.addMeetingAttendee, "shared-agent", {organizationId: f.orgA, id: randomUUID(), meetingId, membershipId: f.memberSharedA}), "MEETING_CHANGED");
      await run(sdk.addMeetingAttendee, "agent-a", {organizationId: f.orgA, id: randomUUID(), meetingId, membershipId: f.memberManagerA});
      assert.ok((await run(sdk.getMeeting, "manager-a", {organizationId: f.orgA, id: meetingId})).meeting, "an invited colleague sees it");
      const listed = await run(sdk.listMeetings, "manager-a", {organizationId: f.orgA, limit: 25, offset: 0});
      assert.ok(listed.meetings.some(row => key(row.id) === key(meetingId)));
      await rejectsWith(run(sdk.updateMeeting, "manager-a", {organizationId: f.orgA, id: meetingId, expectedRevision: 1, title: "Changed", provider: sdk.MeetingProvider.IN_PERSON, meetingUrl: null, location: "Office",
        startsAt: vars.startsAt, endsAt: vars.endsAt, agenda: null, notes: null}), "MEETING_CHANGED");
    });

    it("completes a meeting once with notes and the event; stores summaries only from the server for the organizer or an administrator", async () => {
      await rejectsWith(run(sdk.completeMeeting, "agent-a", {organizationId: f.orgA, id: meetingId, expectedRevision: 1, leadId: f.leadA, hasLead: true, notes: "x"}), "MEETING_CHANGED");
      await run(sdk.completeMeeting, "agent-a", {organizationId: f.orgA, id: meetingId, expectedRevision: 1, leadId, hasLead: true, notes: "Customer wants a two-bedroom unit."});
      await rejectsWith(run(sdk.completeMeeting, "agent-a", {organizationId: f.orgA, id: meetingId, expectedRevision: 2, leadId, hasLead: true, notes: null}), "MEETING_CHANGED");
      assert.deepEqual((await events(meetingId)).map(row => row.triggerType).sort(), ["meeting.completed", "meeting.scheduled"]);
      const summary = JSON.stringify({suggestions: []});
      await forbidden(sdk.saveMeetingSummary, "agent-a", {organizationId: f.orgA, id: meetingId, actorUid: "agent-a", expectedRevision: 2, summaryJson: summary, model: "synthetic"});
      await rejectsWith(server(sdk.saveMeetingSummary, {organizationId: f.orgA, id: meetingId, actorUid: "manager-a", expectedRevision: 2, summaryJson: summary, model: "synthetic"}), "MEETING_CHANGED");
      await server(sdk.saveMeetingSummary, {organizationId: f.orgA, id: meetingId, actorUid: "agent-a", expectedRevision: 2, summaryJson: summary, model: "synthetic"});
      await run(sdk.decideMeetingSuggestion, "agent-a", {organizationId: f.orgA, id: meetingId, expectedRevision: 3, suggestionDecisionsJson: "{\"0\":{\"status\":\"DISMISSED\"}}"});
      await rejectsWith(run(sdk.decideMeetingSuggestion, "agent-a", {organizationId: f.orgA, id: meetingId, expectedRevision: 3, suggestionDecisionsJson: "{}"}), "MEETING_CHANGED");
      await rejectsWith(run(sdk.decideMeetingSuggestion, "manager-a", {organizationId: f.orgA, id: meetingId, expectedRevision: 4, suggestionDecisionsJson: "{}"}), "MEETING_CHANGED");
    });

    it("reports company-wide figures to owners and administrators and only their own to everyone else", async () => {
      const range = {from: new Date(Date.now() - 86_400_000).toISOString(), to: new Date(Date.now() + 2 * 86_400_000).toISOString()};
      const owner = await run(sdk.communicationReport, "owner-a", {organizationId: f.orgA, ...range});
      assert.ok(owner.calls.length >= 3 && owner.agents.length > 0);
      assert.equal((await run(sdk.communicationReport, "owner-a", {organizationId: f.orgA, ...range, agentMembershipId: null})).calls.length, 0, "an explicit null filter matches nothing, so the server omits it");
      const agent = await run(sdk.communicationReport, "agent-a", {organizationId: f.orgA, ...range});
      assert.ok(agent.calls.every(row => key(row.agentMembershipId) === key(f.memberAgentA)));
      assert.equal(agent.agents.length, 0, "the agent list is for administrators");
      const manager = await run(sdk.communicationReport, "manager-a", {organizationId: f.orgA, ...range, agentMembershipId: f.memberAgentA});
      assert.equal(manager.calls.length, 0, "naming another agent shows nothing that is not the manager's own");
      assert.equal(manager.meetings.length, 0);
      await forbidden(sdk.communicationReport, "owner-b", {organizationId: f.orgA, ...range});
      await forbidden(sdk.communicationReport, "owner-a", {organizationId: f.orgA, from: range.from, to: new Date(Date.now() + 100 * 86_400_000).toISOString()});
    });
  });

  describe("Developer communication simulator (server-only operations)", {concurrency: false}, () => {
    const key = value => String(value).replaceAll("-", "").toLowerCase();
    const server = async (operation, variables) => (await operation(dc, variables)).data;
    const rejectsWith = (promise, token) => assert.rejects(promise, error => String(error?.message ?? error).includes(token), token);
    let simLead, realLead, simCall;
    const start = (extra = {}) => server(sdk.createSimulatedCall, {organizationId: f.orgA, id: randomUUID(), actorUid: "owner-a", leadId: simLead, direction: sdk.CallDirection.INBOUND,
      callType: sdk.CallType.INBOUND_ENQUIRY, counterpartyNumber: null, startedAt: new Date(Date.now() - 60_000).toISOString(), ...extra});
    const apply = extra => server(sdk.applySimulatedCallStatus, {organizationId: f.orgA, id: simCall, actorUid: "owner-a", expectedStatus: sdk.CallStatus.INITIATED, callStatus: sdk.CallStatus.RINGING,
      answeredAt: null, endedAt: null, durationSeconds: null, outcome: null, emitFinal: false, finalTrigger: "call.completed", ...extra});

    it("runs only for owners and administrators, only on registered fictional leads, and never as a member operation", async () => {
      simLead = (await run(sdk.createLead, "owner-a", {organizationId: f.orgA, fullName: "[SIM] Test customer DB", phone: "+447700900321", normalizedPhone: "+447700900321", source: "EstateOS simulator"})).lead.id;
      realLead = (await run(sdk.createLead, "owner-a", {organizationId: f.orgA, fullName: `Real customer ${randomUUID().slice(0, 6)}`})).lead.id;
      await forbidden(sdk.registerSimulationLead, "owner-a", {organizationId: f.orgA, id: randomUUID(), actorUid: "owner-a", leadId: simLead, label: "x"});
      await rejectsWith(server(sdk.registerSimulationLead, {organizationId: f.orgA, id: randomUUID(), actorUid: "agent-a", leadId: simLead, label: "x"}), "SIMULATION_ADMIN_REQUIRED");
      await rejectsWith(server(sdk.registerSimulationLead, {organizationId: f.orgB, id: randomUUID(), actorUid: "owner-a", leadId: simLead, label: "x"}), "SIMULATION_ADMIN_REQUIRED");
      await server(sdk.registerSimulationLead, {organizationId: f.orgA, id: randomUUID(), actorUid: "owner-a", leadId: simLead, label: "Simulator lead DB"});
      await rejectsWith(start({leadId: realLead}), "SIMULATION_LEAD_REQUIRED");
      await rejectsWith(start({actorUid: "manager-a"}), "SIMULATION_ADMIN_REQUIRED");
      await forbidden(sdk.createSimulatedCall, "owner-a", {organizationId: f.orgA, id: randomUUID(), actorUid: "owner-a", leadId: simLead, direction: sdk.CallDirection.INBOUND, callType: sdk.CallType.INBOUND_ENQUIRY, counterpartyNumber: null, startedAt: new Date().toISOString()});
      simCall = randomUUID();
      await start({id: simCall});
      const {call} = await run(sdk.getCallRecord, "owner-a", {organizationId: f.orgA, id: simCall});
      assert.equal(call.source, "SIMULATED");
      assert.equal(key(call.agentMembershipId), key(f.memberOwnerA));
    });

    it("applies statuses with compare-and-set and the call's one final event, on simulated calls only", async () => {
      await apply({});
      await rejectsWith(apply({}), "CALL_STATUS_CHANGED");
      await apply({expectedStatus: sdk.CallStatus.RINGING, callStatus: sdk.CallStatus.NO_ANSWER, endedAt: new Date().toISOString(), durationSeconds: 0, emitFinal: true, finalTrigger: "call.missed"});
      const events = (await dc.executeGraphql(`query E($org: UUID!, $id: UUID!) { automationEvents(where: {organizationId: {eq: $org}, targetId: {eq: $id}}) { triggerType origin } }`, {variables: {org: f.orgA, id: simCall}})).data.automationEvents;
      assert.deepEqual(events.map(row => `${row.triggerType}/${row.origin}`).sort(), ["call.missed/SIMULATOR", "call.started/SIMULATOR"]);
      const manual = randomUUID();
      await run(sdk.logLeadCall, "owner-a", {organizationId: f.orgA, id: manual, leadId: realLead, direction: sdk.CallDirection.OUTBOUND, callType: sdk.CallType.FOLLOW_UP, callStatus: sdk.CallStatus.NO_ANSWER,
        outcome: null, startedAt: new Date(Date.now() - 60_000).toISOString(), durationSeconds: 0, notes: null, counterpartyNumber: null, followUpRequired: false, hasViewing: false, viewingId: null, suppress: false, suppressionId: randomUUID()});
      await rejectsWith(apply({id: manual, expectedStatus: sdk.CallStatus.NO_ANSWER, callStatus: sdk.CallStatus.COMPLETED}), "CALL_NOT_FOUND");
    });

    it("reset removes only simulated calls and simulator meetings, and archives only registered leads", async () => {
      const realCalls = async () => (await run(sdk.listLeadCalls, "owner-a", {organizationId: f.orgA, leadId: realLead, limit: 20, offset: 0})).calls.length;
      const before = await realCalls();
      await rejectsWith(server(sdk.resetCommunicationSimulation, {organizationId: f.orgA, actorUid: "agent-a"}), "SIMULATION_ADMIN_REQUIRED");
      const result = await server(sdk.resetCommunicationSimulation, {organizationId: f.orgA, actorUid: "owner-a"});
      assert.ok(result.calls >= 1 && result.leads >= 1, JSON.stringify(result));
      assert.equal(await realCalls(), before, "real calls are untouched");
      const leads = (await dc.executeGraphql(`query L($org: UUID!, $sim: UUID!, $real: UUID!) { sim: lead(key: {organizationId: $org, id: $sim}) { archivedAt } real: lead(key: {organizationId: $org, id: $real}) { archivedAt } }`,
        {variables: {org: f.orgA, sim: simLead, real: realLead}})).data;
      assert.ok(leads.sim.archivedAt, "the fictional lead is archived, its history kept");
      assert.equal(leads.real.archivedAt, null, "real leads are untouched");
      assert.equal((await dc.executeGraphql(`query C($org: UUID!) { callRecords(where: {organizationId: {eq: $org}, source: {eq: SIMULATED}}) { id } }`, {variables: {org: f.orgA}})).data.callRecords.length, 0);
      const state = await server(sdk.communicationSimulationState, {organizationId: f.orgA, actorUid: "owner-a"});
      assert.equal(state.records.length, 0);
      await rejectsWith(server(sdk.communicationSimulationState, {organizationId: f.orgA, actorUid: "owner-b"}), "SIMULATION_ADMIN_REQUIRED");
    });
  });
}
