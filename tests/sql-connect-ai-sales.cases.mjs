import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { before, describe, it } from "node:test";

/**
 * Phase 6C sales intelligence storage against the SQL Connect emulator with
 * the real stored operations: lead visibility for every read and member write,
 * server-only (NO_ACCESS) assessments and insights, compare-and-set on
 * qualification details, priority reviews, dashboard scoping and tenant
 * isolation. Calls without a uid use the Admin identity, as the web server
 * does for NO_ACCESS operations; everything else impersonates a member.
 */
export function registerAiSalesCases({sdk, run, forbidden, dc}) {
  describe("Phase 6C AI sales intelligence", {concurrency: false}, () => {
    const suffix = randomUUID();
    const owner = `sales-owner-${suffix}`, admin = `sales-admin-${suffix}`, agent = `sales-agent-${suffix}`, agent2 = `sales-agent2-${suffix}`,
      manager = `sales-manager-${suffix}`, ownerB = `sales-owner-b-${suffix}`;
    const members = {};
    let org, orgB, agentLead, agent2Lead, managerLead, unassignedLead, leadB;
    const key = value => value.replaceAll("-", "").toLowerCase();
    const server = async (operation, variables) => (await operation(dc, variables)).data;
    const assessmentVars = (leadId, extra = {}) => ({organizationId: org, id: randomUUID(), leadId, evaluatedByUid: owner, ruleVersion: "lq-1", configHash: "abcdef12",
      score: 72, priority: sdk.AiLeadPriority.HIGH, sufficientData: true, result: JSON.stringify({schemaVersion: 1, factors: []}), ...extra});
    const insightVars = (extra = {}) => ({organizationId: org, id: randomUUID(), kind: sdk.AiSalesInsightKind.LEAD_ANALYSIS, content: JSON.stringify({schemaVersion: 1}),
      model: "claude-sonnet-5-5", promptVersion: "6c.1", createdByUid: owner, ...extra});

    before(async () => {
      for (const uid of [owner, admin, agent, agent2, manager, ownerB]) await run(sdk.upsertMyProfile, uid, {displayName: "Sales integration"});
      org = (await run(sdk.createOrganization, owner, {name: "Sales company A", slug: `sales-a-${suffix}`})).organization.id;
      orgB = (await run(sdk.createOrganization, ownerB, {name: "Sales company B", slug: `sales-b-${suffix}`})).organization.id;
      for (const [uid, role] of [[admin, "ADMIN"], [agent, "AGENT"], [agent2, "AGENT"], [manager, "MANAGER"]]) {
        members[uid] = randomUUID();
        await dc.executeGraphql(`mutation SalesMember($org: UUID!, $uid: String!, $id: UUID!, $email: String!) { membership_insert(data: {organizationId: $org, id: $id, userProfileUid: $uid, email: $email, role: ${role}, status: ACTIVE}) }`,
          {variables: {org, uid, id: members[uid], email: `${uid}@example.test`}});
      }
      agentLead = (await run(sdk.createLead, owner, {organizationId: org, fullName: "Synthetic Lead A", assignedMembershipId: members[agent], budgetMax: 2000000})).lead.id;
      agent2Lead = (await run(sdk.createLead, owner, {organizationId: org, fullName: "Synthetic Lead B", assignedMembershipId: members[agent2]})).lead.id;
      managerLead = (await run(sdk.createLead, manager, {organizationId: org, fullName: "Synthetic Lead M", assignedMembershipId: members[manager]})).lead.id;
      unassignedLead = (await run(sdk.createLead, owner, {organizationId: org, fullName: "Synthetic Lead U"})).lead.id;
      leadB = (await run(sdk.createLead, ownerB, {organizationId: orgB, fullName: "Synthetic Lead Other Company"})).lead.id;
    });

    it("records customer-stated qualification only for leads the member may work on, with compare-and-set, activity and audit", async () => {
      await run(sdk.createLeadQualificationDetails, agent, {organizationId: org, leadId: agentLead, timeline: sdk.LeadTimeline.WITHIN_3_MONTHS, readiness: null});
      await assert.rejects(run(sdk.createLeadQualificationDetails, agent, {organizationId: org, leadId: agentLead, timeline: null, readiness: null}), "a second create is rejected");
      for (const uid of [agent2, manager]) await forbidden(sdk.createLeadQualificationDetails, uid, {organizationId: org, leadId: unassignedLead, timeline: null, readiness: null});
      await forbidden(sdk.updateLeadQualificationDetails, agent2, {organizationId: org, leadId: agentLead, expectedRevision: 1, nextRevision: 2, timeline: null, readiness: null});
      await forbidden(sdk.createLeadQualificationDetails, ownerB, {organizationId: org, leadId: unassignedLead, timeline: null, readiness: null});

      const update = (uid, expectedRevision) => run(sdk.updateLeadQualificationDetails, uid, {organizationId: org, leadId: agentLead, expectedRevision, nextRevision: expectedRevision + 1,
        timeline: sdk.LeadTimeline.IMMEDIATE, readiness: sdk.LeadReadiness.READY_TO_PROCEED});
      const results = await Promise.allSettled([update(owner, 1), update(agent, 1)]);
      assert.equal(results.filter(result => result.status === "fulfilled").length, 1, "one of two concurrent saves wins");
      await assert.rejects(update(agent, 1), "a stale revision is rejected");
      await forbidden(sdk.updateLeadQualificationDetails, agent, {organizationId: org, leadId: agentLead, expectedRevision: 2, nextRevision: 4, timeline: null, readiness: null});

      const view = await run(sdk.getLeadSalesIntelligence, agent, {organizationId: org, leadId: agentLead});
      assert.equal(view.details.timeline, "IMMEDIATE");
      assert.equal(view.details.revision, 2);
      const activity = await run(sdk.listLeadActivities, agent, {organizationId: org, leadId: agentLead, limit: 50, offset: 0});
      assert.ok(activity.activities.filter(row => row.kind === "LEAD_QUALIFICATION_UPDATED").length >= 2);
      const lead = await run(sdk.getLead, owner, {organizationId: org, leadId: agentLead});
      assert.equal(lead.lead.fullName, "Synthetic Lead A", "the lead record itself is not changed");
    });

    it("stores assessments and AI insights only through server-only operations", async () => {
      for (const uid of [owner, admin, agent]) {
        await forbidden(sdk.recordLeadQualificationAssessment, uid, assessmentVars(agentLead, {evaluatedByUid: uid}));
        await forbidden(sdk.recordAiSalesInsight, uid, insightVars({leadId: agentLead, createdByUid: uid}));
      }
      const assessment = assessmentVars(agentLead);
      await server(sdk.recordLeadQualificationAssessment, assessment);
      await server(sdk.recordLeadQualificationAssessment, assessmentVars(agentLead, {score: null, priority: sdk.AiLeadPriority.INSUFFICIENT_DATA, sufficientData: false}));
      const view = await run(sdk.getLeadSalesIntelligence, agent, {organizationId: org, leadId: agentLead});
      assert.equal(view.assessments.length, 2, "history keeps every assessment");
      assert.equal(view.assessments[0].ruleVersion, "lq-1");
      assert.ok(view.assessments.some(row => key(row.id) === key(assessment.id) && row.score === 72));
    });

    it("keeps lead intelligence visible only to the assigned member and to owners and administrators", async () => {
      await server(sdk.recordLeadQualificationAssessment, assessmentVars(agent2Lead));
      const insight = insightVars({leadId: agent2Lead});
      await server(sdk.recordAiSalesInsight, insight);
      for (const uid of [owner, admin, agent2]) {
        const view = await run(sdk.getLeadSalesIntelligence, uid, {organizationId: org, leadId: agent2Lead});
        assert.equal(view.assessments.length, 1, uid);
        assert.ok((await run(sdk.getAiSalesInsight, uid, {organizationId: org, id: insight.id})).insight, uid);
      }
      for (const uid of [agent, manager]) {
        await forbidden(sdk.getLeadSalesIntelligence, uid, {organizationId: org, leadId: agent2Lead});
        assert.equal((await run(sdk.getAiSalesInsight, uid, {organizationId: org, id: insight.id})).insight, null, `${uid} cannot read another member's lead insight`);
      }
      await forbidden(sdk.getLeadSalesIntelligence, ownerB, {organizationId: org, leadId: agent2Lead});
      await forbidden(sdk.getAiSalesInsight, ownerB, {organizationId: org, id: insight.id});
      await forbidden(sdk.getLeadSalesIntelligence, owner, {organizationId: orgB, leadId: leadB});
      assert.equal((await run(sdk.getAiSalesInsight, ownerB, {organizationId: orgB, id: insight.id})).insight, null, "an id from another company finds nothing");
    });

    it("records priority reviews with a reason against the stored suggestion, without changing the lead or the assessment", async () => {
      const assessment = assessmentVars(agentLead, {priority: sdk.AiLeadPriority.MEDIUM, score: 55});
      await server(sdk.recordLeadQualificationAssessment, assessment);
      const review = {organizationId: org, leadId: agentLead, assessmentId: assessment.id, suggestedPriority: sdk.AiLeadPriority.MEDIUM, reviewedPriority: sdk.AiLeadPriority.HIGH,
        reason: "Customer confirmed by phone they are ready to make an offer."};
      await assert.rejects(run(sdk.recordLeadPriorityReview, agent, {...review, reason: "too short"}));
      await assert.rejects(run(sdk.recordLeadPriorityReview, agent, {...review, reviewedPriority: sdk.AiLeadPriority.INSUFFICIENT_DATA}));
      await assert.rejects(run(sdk.recordLeadPriorityReview, agent, {...review, suggestedPriority: sdk.AiLeadPriority.LOW}), "the suggestion must match the stored assessment");
      await assert.rejects(run(sdk.recordLeadPriorityReview, agent, {...review, leadId: agent2Lead}), "an assessment of another lead cannot be reviewed");
      for (const uid of [agent2, manager, ownerB]) await forbidden(sdk.recordLeadPriorityReview, uid, review);
      await run(sdk.recordLeadPriorityReview, agent, review);
      await run(sdk.recordLeadPriorityReview, owner, {...review, reviewedPriority: sdk.AiLeadPriority.LOW, reason: "Owner review after a call with the customer."});
      const view = await run(sdk.getLeadSalesIntelligence, agent, {organizationId: org, leadId: agentLead});
      assert.equal(view.reviews.length, 2);
      assert.equal(view.reviews[0].reviewedPriority, "LOW");
      assert.equal(view.assessments.find(row => key(row.id) === key(assessment.id)).priority, "MEDIUM", "the assessment is unchanged");
    });

    it("keeps pipeline summaries private to the member who generated them", async () => {
      const mine = insightVars({kind: sdk.AiSalesInsightKind.PIPELINE_SUMMARY, createdByUid: admin});
      await server(sdk.recordAiSalesInsight, mine);
      assert.ok((await run(sdk.getAiSalesInsight, admin, {organizationId: org, id: mine.id})).insight);
      assert.equal((await run(sdk.getAiSalesInsight, owner, {organizationId: org, id: mine.id})).insight, null);
      assert.ok((await run(sdk.listMyAiSalesSummaries, admin, {organizationId: org})).insights.some(row => key(row.id) === key(mine.id)));
      assert.equal((await run(sdk.listMyAiSalesSummaries, owner, {organizationId: org})).insights.some(row => key(row.id) === key(mine.id)), false);
    });

    it("scopes dashboard reads to the member's visible leads and their company", async () => {
      await server(sdk.recordLeadQualificationAssessment, assessmentVars(managerLead));
      await server(sdk.recordLeadQualificationAssessment, assessmentVars(unassignedLead));
      const since = new Date(Date.now() - 86_400_000).toISOString();
      const leadsIn = rows => new Set(rows.map(row => key(row.leadId)));
      const ownerView = leadsIn((await run(sdk.listAiSalesAssessments, owner, {organizationId: org, since})).assessments);
      for (const lead of [agentLead, agent2Lead, managerLead, unassignedLead]) assert.ok(ownerView.has(key(lead)));
      const agentView = leadsIn((await run(sdk.listAiSalesAssessments, agent, {organizationId: org, since})).assessments);
      assert.deepEqual([...agentView], [key(agentLead)]);
      const managerView = leadsIn((await run(sdk.listAiSalesAssessments, manager, {organizationId: org, since})).assessments);
      assert.deepEqual([...managerView], [key(managerLead)]);
      const agentActivity = (await run(sdk.listAiSalesActivity, agent, {organizationId: org, since})).activities;
      assert.ok(agentActivity.length > 0 && agentActivity.every(row => key(row.leadId) === key(agentLead)));
      const viewings = await run(sdk.listAiSalesViewings, agent, {organizationId: org, from: since, to: new Date(Date.now() + 86_400_000).toISOString()});
      assert.ok(viewings.viewings.every(row => key(row.leadId) === key(agentLead)));
      for (const operation of [sdk.listAiSalesAssessments, sdk.listAiSalesActivity]) await forbidden(operation, ownerB, {organizationId: org, since});
      assert.equal((await run(sdk.listAiSalesAssessments, ownerB, {organizationId: orgB, since})).assessments.length, 0);
      await forbidden(sdk.listAiSalesAssessments, agent, {organizationId: org, since, limit: 5000});
    });
  });
}
