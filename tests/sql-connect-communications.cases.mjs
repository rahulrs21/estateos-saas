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
export function registerCommunicationCases({sdk, run, forbidden, dc}) {
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
}
