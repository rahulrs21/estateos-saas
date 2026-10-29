import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { before, describe, it } from "node:test";

export function registerLeadPropertyCases({sdk, run, forbidden, dc}) {
  describe("Phase 5D lead-property integration", {concurrency: false}, () => {
    const suffix = randomUUID();
    const owner = `property-owner-${suffix}`, ownerB = `property-owner-b-${suffix}`, agent = `property-agent-${suffix}`, agent2 = `property-agent2-${suffix}`, manager = `property-manager-${suffix}`;
    const memberAgent = randomUUID(), memberAgent2 = randomUUID(), memberManager = randomUUID();
    let org, orgB, ownerMember, ownerMemberB, project, projectB, p1, p2, otherProperty, reserved, foreign, lead, otherLead, foreignLead, viewing;
    const key = value => value.replaceAll("-", "").toLowerCase();
    const context = () => run(sdk.getLeadPropertyContext, owner, {organizationId: org, leadId: lead});
    const interest = async propertyId => (await context()).shortlist.find(row => key(row.propertyId) === key(propertyId));
    const createProperty = async (propertyReference, extras = {}, company = org, uid = owner) => (await run(sdk.createProperty, uid, {
      organizationId: company, propertyReference: `${propertyReference}-${suffix}`, propertyType: sdk.PropertyType.APARTMENT,
      marketType: sdk.MarketType.SECONDARY, bedrooms: 2, emirate: sdk.Emirate.DUBAI, community: "Dubai Marina",
      areaUnit: sdk.AreaUnit.SQFT, occupancyStatus: sdk.OccupancyStatus.VACANT, inventoryStatus: sdk.InventoryStatus.AVAILABLE, ...extras,
    })).property.id;
    const createListing = async (propertyId, assignedMembershipId, ref) => run(sdk.createPropertyListing, owner, {
      organizationId: org, propertyId, assignedMembershipId, listingReference: `${ref}-${suffix}`, listingPurpose: sdk.ListingPurpose.SALE,
      marketType: sdk.MarketType.SECONDARY, title: "Local matching apartment", askingPriceMinor: "100000000", currency: "AED",
      listingStatus: sdk.ListingStatus.ACTIVE, publicationStatus: sdk.ListingPublicationStatus.NOT_PUBLISHED,
    });
    before(async () => {
      for (const uid of [owner, ownerB, agent, agent2, manager]) await run(sdk.upsertMyProfile, uid, {displayName: "Local property integration"});
      const createdA = await run(sdk.createOrganization, owner, {name: "Property integration A", slug: `property-a-${suffix}`});
      const createdB = await run(sdk.createOrganization, ownerB, {name: "Property integration B", slug: `property-b-${suffix}`});
      org = createdA.organization.id; ownerMember = createdA.ownerMembership.id;
      orgB = createdB.organization.id; ownerMemberB = createdB.ownerMembership.id;
      // Fixture setup only: the harness refuses non-demo projects and non-loopback hosts.
      await dc.executeGraphql(`mutation SetupPropertyMembers($org:UUID!,$a:String!,$b:String!,$m:String!,$ma:UUID!,$mb:UUID!,$mm:UUID!){ membership_insertMany(data:[
        {organizationId:$org,id:$ma,userProfileUid:$a,email:"agent@example.test",role:AGENT,status:ACTIVE},
        {organizationId:$org,id:$mb,userProfileUid:$b,email:"agent2@example.test",role:AGENT,status:ACTIVE},
        {organizationId:$org,id:$mm,userProfileUid:$m,email:"manager@example.test",role:MANAGER,status:ACTIVE}]) }`, {variables:{org,a:agent,b:agent2,m:manager,ma:memberAgent,mb:memberAgent2,mm:memberManager}});
      const dev = (await run(sdk.createDeveloper, owner, {organizationId: org, name: "Local developer", slug: `developer-${suffix}`, country:"AE",status:sdk.DeveloperStatus.ACTIVE})).developer.id;
      const devB = (await run(sdk.createDeveloper, ownerB, {organizationId: orgB, name: "Foreign developer", slug: `developer-b-${suffix}`, country:"AE",status:sdk.DeveloperStatus.ACTIVE})).developer.id;
      const projectInput = {projectName:"Integration project",projectCode:`P-${suffix}`,projectType:sdk.ProjectType.RESIDENTIAL,country:"AE",constructionStatus:sdk.ConstructionStatus.COMPLETED,projectStatus:sdk.ProjectStatus.ACTIVE,currency:"AED"};
      project = (await run(sdk.createProject, owner, {organizationId:org,developerId:dev,...projectInput})).project.id;
      projectB = (await run(sdk.createProject, ownerB, {organizationId:orgB,developerId:devB,...projectInput})).project.id;
      p1 = await createProperty("P1", {projectId:project,assignedMembershipId:memberAgent});
      p2 = await createProperty("P2", {projectId:project,assignedMembershipId:memberAgent});
      reserved = await createProperty("RESERVED", {inventoryStatus:sdk.InventoryStatus.RESERVED});
      otherProperty = await createProperty("OTHER", {assignedMembershipId:memberAgent2});
      foreign = await createProperty("FOREIGN", {projectId:projectB}, orgB, ownerB);
      await createListing(p1, memberAgent, "L1"); await createListing(p2, memberAgent, "L2");
      await createListing(p1, memberAgent2, "PRIVATE"); await createListing(otherProperty, memberAgent2, "OTHER");
      lead = (await run(sdk.createLead, owner, {organizationId:org,fullName:"Property lead",assignedMembershipId:memberAgent})).lead.id;
      otherLead = (await run(sdk.createLead, owner, {organizationId:org,fullName:"Private lead",assignedMembershipId:memberAgent2})).lead.id;
      foreignLead = (await run(sdk.createLead, ownerB, {organizationId:orgB,fullName:"Foreign lead"})).lead.id;
    });
    it("links existing primary project/property fields and preserves the original lead", async () => {
      await run(sdk.setLeadPrimaryInterest, owner, {organizationId:org,leadId:lead,projectId:project,propertyId:p1});
      const result = await context();
      assert.equal(key(result.primaryProject.id), key(project)); assert.equal(key(result.primaryProperty.id),key(p1));
      assert.equal((await run(sdk.getLead,owner,{organizationId:org,leadId:lead})).lead.fullName,"Property lead");
      await run(sdk.setLeadPrimaryInterest,owner,{organizationId:org,leadId:lead,projectId:null,propertyId:null});
      assert.equal((await context()).primaryProperty,null);
    });
    it("saves multiple properties, enforces uniqueness and persists customer interest", async () => {
      for (const propertyId of [p1,p2]) await run(sdk.saveLeadPropertyInterest,agent,{organizationId:org,leadId:lead,propertyId,status:sdk.LeadPropertyInterestStatus.SAVED});
      assert.equal((await context()).shortlist.length,2);
      await forbidden(sdk.saveLeadPropertyInterest,agent,{organizationId:org,leadId:lead,propertyId:p1,status:sdk.LeadPropertyInterestStatus.SAVED});
      const current=await interest(p1);
      await run(sdk.saveLeadPropertyInterest,agent,{organizationId:org,leadId:lead,propertyId:p1,status:sdk.LeadPropertyInterestStatus.INTERESTED,notes:"Customer prefers the view",expectedUpdatedAt:current.updatedAt});
      assert.equal((await interest(p1)).notes,"Customer prefers the view");
      await forbidden(sdk.saveLeadPropertyInterest,agent,{organizationId:org,leadId:lead,propertyId:p1,status:sdk.LeadPropertyInterestStatus.REMOVED,expectedUpdatedAt:current.updatedAt});
    });
    it("filters unavailable properties and protects other agents' listing prices", async () => {
      const ownerRows=await run(sdk.listLeadPropertyCandidates,owner,{organizationId:org,leadId:lead,limit:100,offset:0});
      assert.equal(ownerRows.properties.length,3); assert.ok(!ownerRows.properties.some(row=>key(row.id)===key(reserved)));
      const agentRows=await run(sdk.listLeadPropertyCandidates,agent,{organizationId:org,leadId:lead,limit:100,offset:0});
      assert.equal(agentRows.properties.length,2);
      assert.equal(agentRows.properties.find(row=>key(row.id)===key(p1)).propertyListings_on_property.length,1);
      const page1=await run(sdk.listLeadPropertyCandidates,agent,{organizationId:org,leadId:lead,limit:1,offset:0});
      const page2=await run(sdk.listLeadPropertyCandidates,agent,{organizationId:org,leadId:lead,limit:1,offset:1});
      assert.notEqual(page1.properties[0].id,page2.properties[0].id); assert.equal(page1.total[0]._count,2);
      await forbidden(sdk.saveLeadPropertyInterest,owner,{organizationId:org,leadId:lead,propertyId:reserved,status:sdk.LeadPropertyInterestStatus.SAVED});
    });
    it("denies unrelated leads, unrelated properties, unverified identity and unconfigured manager scope", async () => {
      for (const operation of [sdk.getLeadPropertyContext,sdk.listLeadPropertyCandidates]) {
        await forbidden(operation,agent,{organizationId:org,leadId:otherLead});
        await forbidden(operation,manager,{organizationId:org,leadId:lead});
        await forbidden(operation,null,{organizationId:org,leadId:lead});
        await forbidden(operation,agent,{organizationId:org,leadId:lead},{email_verified:false});
      }
      await forbidden(sdk.saveLeadPropertyInterest,agent,{organizationId:org,leadId:otherLead,propertyId:p1,status:sdk.LeadPropertyInterestStatus.SAVED});
      await forbidden(sdk.saveLeadPropertyInterest,agent,{organizationId:org,leadId:lead,propertyId:otherProperty,status:sdk.LeadPropertyInterestStatus.SAVED});
    });
    it("rejects cross-company primary references and shortlist writes without partial changes", async () => {
      for (const input of [{projectId:projectB,propertyId:null},{projectId:project,propertyId:foreign}]) await forbidden(sdk.setLeadPrimaryInterest,owner,{organizationId:org,leadId:lead,...input});
      await forbidden(sdk.saveLeadPropertyInterest,owner,{organizationId:org,leadId:lead,propertyId:foreign,status:sdk.LeadPropertyInterestStatus.SAVED});
      await forbidden(sdk.getLeadPropertyContext,owner,{organizationId:orgB,leadId:foreignLead});
      await forbidden(sdk.getLeadPropertyContext,ownerB,{organizationId:orgB,leadId:lead});
      assert.equal((await context()).shortlist.length,2); assert.equal((await context()).primaryProperty,null);
    });
    it("persists viewings and notes, rejects stale changes and terminal reopening", async () => {
      const scheduledAt=new Date(Date.now()+86400000).toISOString();
      viewing=(await run(sdk.scheduleLeadPropertyViewing,agent,{organizationId:org,leadId:lead,propertyId:p1,scheduledAt,notes:"Meet at reception",assignedMembershipId:memberAgent})).viewing.id;
      const row=(await context()).viewings.find(row=>key(row.id)===key(viewing));
      assert.equal(Date.parse(row.scheduledAt),Date.parse(scheduledAt)); assert.equal(row.viewingNotes,"Meet at reception");
      assert.equal(key(row.assignedMembershipId),key(memberAgent)); assert.equal(row.customerConfirmation,"PENDING"); assert.equal(row.outcome,null);
      await forbidden(sdk.updateLeadPropertyViewing,agent2,{organizationId:org,leadId:lead,viewingId:viewing,status:sdk.LeadPropertyViewingStatus.CANCELLED,expectedUpdatedAt:row.updatedAt,assignedMembershipId:memberAgent2,customerConfirmation:sdk.LeadPropertyViewingConfirmation.PENDING});
      await run(sdk.updateLeadPropertyViewing,agent,{organizationId:org,leadId:lead,viewingId:viewing,status:sdk.LeadPropertyViewingStatus.COMPLETED,notes:"Customer viewed the unit",expectedUpdatedAt:row.updatedAt,assignedMembershipId:memberAgent,customerConfirmation:sdk.LeadPropertyViewingConfirmation.CONFIRMED});
      const updated=(await context()).viewings[0]; assert.equal(updated.status,"COMPLETED"); assert.equal(updated.viewingNotes,"Customer viewed the unit");
      await forbidden(sdk.updateLeadPropertyViewing,agent,{organizationId:org,leadId:lead,viewingId:viewing,status:sdk.LeadPropertyViewingStatus.SCHEDULED,expectedUpdatedAt:updated.updatedAt,assignedMembershipId:memberAgent,customerConfirmation:sdk.LeadPropertyViewingConfirmation.PENDING});
      await forbidden(sdk.scheduleLeadPropertyViewing,owner,{organizationId:org,leadId:lead,propertyId:reserved,scheduledAt,assignedMembershipId:ownerMember});
      await forbidden(sdk.scheduleLeadPropertyViewing,owner,{organizationId:org,leadId:lead,propertyId:p1,scheduledAt:new Date(Date.now()-1000).toISOString(),assignedMembershipId:ownerMember});
    });
    it("allows another appointment for the same lead and property without overwriting history", async () => {
      const result = await run(sdk.scheduleLeadPropertyViewing, agent, {organizationId:org,leadId:lead,propertyId:p1,scheduledAt:new Date(Date.now()+2*86400000).toISOString(),notes:"Second viewing",assignedMembershipId:memberAgent});
      assert.notEqual(key(result.viewing.id), key(viewing));
      const rows = (await context()).viewings;
      assert.equal(rows.length, 2);
      assert.equal(rows.find(row=>key(row.id)===key(viewing)).status, "COMPLETED");
      assert.equal(rows.find(row=>key(row.id)===key(result.viewing.id)).viewingNotes, "Second viewing");
    });
    it("enforces viewing assignee rules for agents, administrators and other companies", async () => {
      const at = new Date(Date.now()+3*86400000).toISOString();
      const schedule = (uid, assignedMembershipId) => run(sdk.scheduleLeadPropertyViewing, uid, {organizationId:org,leadId:lead,propertyId:p2,scheduledAt:at,assignedMembershipId});
      const before = (await context()).viewings.length;
      await assert.rejects(() => schedule(agent, memberAgent2));
      await assert.rejects(() => schedule(agent, ownerMember));
      await assert.rejects(() => schedule(owner, memberAgent2));
      await assert.rejects(() => schedule(owner, memberManager));
      await assert.rejects(() => schedule(owner, ownerMemberB));
      await assert.rejects(() => schedule(owner, randomUUID()));
      assert.equal((await context()).viewings.length, before);
      const choices = (await context()).viewingAssignees.map(row => key(row.id)).sort();
      assert.deepEqual(choices, [key(memberAgent), key(ownerMember)].sort());
      const agentChoices = (await run(sdk.getLeadPropertyContext, agent, {organizationId:org,leadId:lead})).viewingAssignees;
      assert.deepEqual(agentChoices.map(row => key(row.id)), [key(memberAgent)]);
      const byOwner = (await schedule(owner, ownerMember)).viewing.id;
      const confirmed = (await run(sdk.scheduleLeadPropertyViewing, agent, {organizationId:org,leadId:lead,propertyId:p2,scheduledAt:at,assignedMembershipId:memberAgent,customerConfirmation:sdk.LeadPropertyViewingConfirmation.CONFIRMED})).viewing.id;
      const rows = (await context()).viewings;
      assert.equal(key(rows.find(row=>key(row.id)===key(byOwner)).assignedMembershipId), key(ownerMember));
      assert.equal(rows.find(row=>key(row.id)===key(confirmed)).customerConfirmation, "CONFIRMED");
      // The agent holding both the lead and the property sees the appointment assigned to them.
      const agentRows = (await run(sdk.getLeadPropertyContext, agent, {organizationId:org,leadId:lead})).viewings;
      assert.ok(agentRows.some(row=>key(row.id)===key(confirmed)));
    });
    it("updates confirmation and reassignment while scheduled, keeping an unchanged assignee", async () => {
      const target = (await context()).viewings.find(row => row.status === "SCHEDULED" && key(row.propertyId) === key(p2) && key(row.assignedMembershipId) === key(ownerMember));
      const update = (uid, extras) => run(sdk.updateLeadPropertyViewing, uid, {organizationId:org,leadId:lead,viewingId:target.id,status:sdk.LeadPropertyViewingStatus.SCHEDULED,expectedUpdatedAt:target.updatedAt,assignedMembershipId:ownerMember,customerConfirmation:sdk.LeadPropertyViewingConfirmation.DECLINED,...extras});
      await assert.rejects(() => update(owner, {assignedMembershipId:memberAgent2}));
      await assert.rejects(() => update(owner, {outcome:sdk.LeadPropertyViewingOutcome.POSITIVE}));
      await assert.rejects(() => update(owner, {hasFollowUp:true,followUpAt:new Date(Date.now()+86400000).toISOString(),followUpTitle:"Too early"}));
      await assert.rejects(() => update(ownerB, {organizationId:orgB}));
      await update(owner, {});
      let row = (await context()).viewings.find(item => key(item.id) === key(target.id));
      assert.equal(row.customerConfirmation, "DECLINED"); assert.equal(row.status, "SCHEDULED");
      await run(sdk.updateLeadPropertyViewing, owner, {organizationId:org,leadId:lead,viewingId:target.id,status:sdk.LeadPropertyViewingStatus.CANCELLED,expectedUpdatedAt:row.updatedAt,assignedMembershipId:memberAgent,customerConfirmation:sdk.LeadPropertyViewingConfirmation.DECLINED});
      row = (await context()).viewings.find(item => key(item.id) === key(target.id));
      assert.equal(row.status, "CANCELLED"); assert.equal(key(row.assignedMembershipId), key(memberAgent)); assert.equal(row.followUp, null);
    });
    it("records a completed outcome and creates a linked follow-up for the assignee in one transaction", async () => {
      const target = (await context()).viewings.find(row => row.status === "SCHEDULED" && key(row.propertyId) === key(p2) && row.customerConfirmation === "CONFIRMED");
      const dueAt = new Date(Date.now()+5*86400000).toISOString();
      const leadBefore = (await run(sdk.getLead, owner, {organizationId:org,leadId:lead})).lead;
      const complete = extras => run(sdk.updateLeadPropertyViewing, agent, {organizationId:org,leadId:lead,viewingId:target.id,status:sdk.LeadPropertyViewingStatus.COMPLETED,expectedUpdatedAt:target.updatedAt,assignedMembershipId:memberAgent,customerConfirmation:sdk.LeadPropertyViewingConfirmation.CONFIRMED,outcome:sdk.LeadPropertyViewingOutcome.POSITIVE,notes:"Liked the layout",...extras});
      await assert.rejects(() => complete({hasFollowUp:true,followUpAt:dueAt}));
      await assert.rejects(() => complete({hasFollowUp:true,followUpAt:new Date(Date.now()-1000).toISOString(),followUpTitle:"Past"}));
      assert.equal((await context()).viewings.find(row => key(row.id) === key(target.id)).status, "SCHEDULED");
      await complete({hasFollowUp:true,followUpAt:dueAt,followUpTitle:"Send the offer"});
      const row = (await context()).viewings.find(item => key(item.id) === key(target.id));
      assert.equal(row.status, "COMPLETED"); assert.equal(row.outcome, "POSITIVE"); assert.equal(row.viewingNotes, "Liked the layout");
      assert.equal(row.followUp.title, "Send the offer"); assert.equal(row.followUp.status, "PENDING"); assert.equal(Date.parse(row.followUp.dueAt), Date.parse(dueAt));
      const followUps = (await run(sdk.listLeadFollowUps, owner, {organizationId:org,leadId:lead,limit:10,offset:0})).followUps;
      const created = followUps.find(item => key(item.id) === key(row.followUp.id));
      assert.equal(key(created.assignedUserId), key(memberAgent));
      const leadAfter = (await run(sdk.getLead, owner, {organizationId:org,leadId:lead})).lead;
      const expected = leadBefore.followUpAt && Date.parse(leadBefore.followUpAt) < Date.parse(dueAt) ? Date.parse(leadBefore.followUpAt) : Date.parse(dueAt);
      assert.equal(Date.parse(leadAfter.followUpAt), expected);
      await assert.rejects(() => complete({}));
    });
    it("removes an interest while retaining viewing history", async () => {
      const current=await interest(p1);
      await run(sdk.saveLeadPropertyInterest,agent,{organizationId:org,leadId:lead,propertyId:p1,status:sdk.LeadPropertyInterestStatus.REMOVED,expectedUpdatedAt:current.updatedAt});
      assert.equal((await interest(p1)).status,"REMOVED"); assert.equal((await context()).viewings.filter(row=>key(row.propertyId)===key(p1)).length,2);
      await forbidden(sdk.scheduleLeadPropertyViewing,agent,{organizationId:org,leadId:lead,propertyId:p1,scheduledAt:new Date(Date.now()+86400000).toISOString(),assignedMembershipId:memberAgent});
    });
    it("reports exact scoped inventory totals and groups from saved rows", async () => {
      const metrics=await run(sdk.getInventoryDashboardMetrics,owner,{organizationId:org});
      assert.equal(metrics.totalProperties[0].count,4); assert.equal(metrics.availableProperties[0].count,3);
      assert.equal(metrics.reservedProperties[0].count,1); assert.equal(metrics.activeListings[0].count,4);
      assert.equal(metrics.propertiesByProject.reduce((sum,row)=>sum+row.count,0),4);
      assert.equal(metrics.propertiesByProject.find(row=>row.projectId&&key(row.projectId)===key(project)).count,2);
      assert.equal(metrics.listingsByAgent.find(row=>key(row.assignedMembershipId)===key(memberAgent)).count,2);
      const scoped=await run(sdk.getInventoryDashboardMetrics,agent,{organizationId:org});
      assert.equal(scoped.totalProperties[0].count,2); assert.equal(scoped.activeListings[0].count,2);
      await forbidden(sdk.getInventoryDashboardMetrics,agent,{organizationId:orgB});
      await forbidden(sdk.getInventoryDashboardMetrics,manager,{organizationId:org});
    });
    it("records lead timeline events for shortlist and viewing writes", async () => {
      const data=await run(sdk.listLeadActivities,owner,{organizationId:org,leadId:lead,limit:100,offset:0});
      for (const kind of ["LEAD_PROPERTY_INTEREST_CHANGED","LEAD_PRIMARY_INTEREST_CHANGED","LEAD_PROPERTY_VIEWING_SCHEDULED","LEAD_PROPERTY_VIEWING_UPDATED","FOLLOW_UP_SCHEDULED"]) assert.ok(data.activities.some(row=>row.kind===kind));
    });
  });
}
