import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {before, describe, it} from "node:test";

// Registered inside the guarded, loopback-only integration harness. These
// profiles and companies are independent of the legacy permission fixtures.
export function registerCrmCases({sdk, run, forbidden, dc}) {
  describe("Phase 4A contact and lead aggregate", {concurrency:false},()=>{
    const suffix=randomUUID();
    const owner="crm-owner-"+suffix, ownerB="crm-owner-b-"+suffix;
    const agent="crm-agent-"+suffix, agent2="crm-agent-two-"+suffix, manager="crm-manager-"+suffix, suspended="crm-suspended-"+suffix;
    const memberAgent=randomUUID(), memberAgent2=randomUUID(), memberManager=randomUUID(), memberSuspended=randomUUID(), memberB=randomUUID();
    let org, orgB;
    const key=value=>value.replaceAll("-","").toLowerCase();
    const stage=(configuration,status)=>configuration.pipelines.find(p=>p.isDefault).pipelineStages_on_pipeline.find(s=>s.status===status).id;
    const contact=async(fullName="CRM buyer",extra={})=>(await run(sdk.createContact,owner,{organizationId:org,fullName,...extra})).contact.id;
    const lead=async(extra={})=>{
      const creator=key(extra.assignedMembershipId??"")===key(memberManager)?manager:owner;
      return (await run(sdk.createLead,creator,{organizationId:org,fullName:"CRM lead "+randomUUID(),...extra})).lead.id;
    };
    const details=async(id,uid=owner)=> (await run(sdk.getLead,uid,{organizationId:org,leadId:id})).lead;
    const history=async(id)=>run(sdk.getLeadCrmHistory,owner,{organizationId:org,leadId:id});
    before(async()=>{
      for(const uid of [owner,ownerB,agent,agent2,manager,suspended]) await run(sdk.upsertMyProfile,uid,{displayName:"Local CRM test"});
      org=(await run(sdk.createOrganization,owner,{name:"CRM company A",slug:"crm-a-"+suffix})).organization.id;
      orgB=(await run(sdk.createOrganization,ownerB,{name:"CRM company B",slug:"crm-b-"+suffix})).organization.id;
      // Deliberately privileged fixture setup, confined to the demo emulator.
      await dc.executeGraphql(`mutation SetupCrmMembers($a:UUID!,$b:UUID!,$agent:String!,$agent2:String!,$manager:String!,$suspended:String!,$ownerB:String!,$memberAgent:UUID!,$memberAgent2:UUID!,$memberManager:UUID!,$memberSuspended:UUID!,$memberB:UUID!){
        membership_insertMany(data:[
          {organizationId:$a,id:$memberAgent,userProfileUid:$agent,email:"local-agent@example.test",role:AGENT,status:ACTIVE}
          {organizationId:$a,id:$memberAgent2,userProfileUid:$agent2,email:"local-agent-two@example.test",role:AGENT,status:ACTIVE}
          {organizationId:$a,id:$memberManager,userProfileUid:$manager,email:"local-manager@example.test",role:MANAGER,status:ACTIVE}
          {organizationId:$a,id:$memberSuspended,userProfileUid:$suspended,email:"local-suspended@example.test",role:AGENT,status:SUSPENDED}
          {organizationId:$b,id:$memberB,userProfileUid:$ownerB,email:"local-second-member@example.test",role:AGENT,status:ACTIVE}
        ])
      }`,{variables:{a:org,b:orgB,agent,agent2,manager,suspended,ownerB:agent,memberAgent,memberAgent2,memberManager,memberSuspended,memberB}});
    });
    it("new company creation includes one complete default pipeline atomically",async()=>{
      const data=await run(sdk.getLeadConfiguration,owner,{organizationId:org});
      assert.equal(data.pipelines.filter(p=>p.isDefault).length,1);
      assert.deepEqual(data.pipelines[0].pipelineStages_on_pipeline.map(s=>s.name),["New","Contacted","Qualified","Viewing Scheduled","Viewing Completed","Negotiation","Won","Lost"]);
      assert.equal(data.leadSources[0].sourceType,"MANUAL");
      await forbidden(sdk.initializeLeadPipeline,owner,{organizationId:org});
      assert.equal((await run(sdk.getLeadConfiguration,owner,{organizationId:org})).pipelines.length,1);
    });
    it("an owner can load every empty CRM list dependency for a new company",async()=>{
      const configuration=await run(sdk.getLeadConfiguration,ownerB,{organizationId:orgB});
      assert.equal(configuration.pipelines.filter(row=>row.isDefault).length,1);
      const [branches,assignees,leads,metrics,contacts]=await Promise.all([
        run(sdk.listBranches,ownerB,{organizationId:orgB}),
        run(sdk.listLeadAssignees,ownerB,{organizationId:orgB,limit:100}),
        run(sdk.listLeads,ownerB,{organizationId:orgB}),
        run(sdk.getLeadMetrics,ownerB,{organizationId:orgB}),
        run(sdk.searchContacts,ownerB,{organizationId:orgB}),
      ]);
      assert.deepEqual(branches.branches,[]);
      assert.ok(assignees.memberships.every(row=>row.role==="AGENT"));
      assert.deepEqual(leads.leads,[]);
      assert.equal(metrics.total[0]?.count,0);
      assert.deepEqual(contacts.contacts,[]);
      assert.equal(contacts.total[0]?.count,0);
      const uiDefaultList=await run(sdk.listLeads,ownerB,{
        organizationId:orgB,limit:25,offset:0,activeOnly:true,
      });
      assert.deepEqual(uiDefaultList.leads,[]);
      assert.equal(uiDefaultList.total[0]?.count,0);
    });
    it("configures tenant-scoped active agents and rejects member rule changes",async()=>{
      const variables={organizationId:org,ruleId:randomUUID(),hasExistingRule:false,hasCursor:false,
        expectedUpdatedAt:new Date().toISOString(),enabled:true,mode:sdk.LeadDistributionMode.ROUND_ROBIN,
        branchId:null,projectId:null,skipUnavailable:true,businessHoursEnabled:false,timeZone:"Asia/Dubai",
        businessDaysMask:62,businessStart:"09:00",businessEnd:"18:00",reassignmentTimeoutMinutes:1440,
        eligibleAgentIds:[memberAgent,memberAgent2]};
      const saved=await run(sdk.saveLeadDistributionSettings,owner,variables);
      assert.ok(saved.createdRule);
      await forbidden(sdk.saveLeadDistributionSettings,agent,variables);
      await forbidden(sdk.getLeadDistributionPlan,agent,{organizationId:org});
      await forbidden(sdk.saveLeadDistributionSettings,owner,{...variables,organizationId:orgB});
      const plan=await run(sdk.getLeadDistributionPlan,owner,{organizationId:org});
      assert.deepEqual(new Set(plan.eligibleAgents.map(row=>key(row.id))),new Set([key(memberAgent),key(memberAgent2)]));
      assert.ok(plan.rule.cursor);
    });
    it("serializes concurrent round-robin arrivals, retries stale cursors and notifies selected agents",async()=>{
      const plan=await run(sdk.getLeadDistributionPlan,owner,{organizationId:org});
      const selected=plan.eligibleAgents.map(row=>row.id).sort((a,b)=>key(a).localeCompare(key(b)))[0];
      const cursor=plan.rule.cursor;
      const makeVariables=(name,leadId=randomUUID())=>({organizationId:org,leadId,fullName:name,
        assignedMembershipId:selected,hasAssignedMember:true,distributionRuleId:plan.rule.id,
        expectedCursorVersion:cursor.version,hasAutoAssignment:true,hasDistributionAttempt:true});
      const varsA=makeVariables("Concurrent auto route A"),varsB=makeVariables("Concurrent auto route B");
      const attempts=await Promise.allSettled([run(sdk.createLead,owner,varsA),run(sdk.createLead,owner,varsB)]);
      assert.equal(attempts.filter(result=>result.status==="fulfilled").length,1,"one stale cursor transaction must abort");
      assert.equal(attempts.filter(result=>result.status==="rejected").length,1);
      const failed=attempts[0].status==="rejected"?varsA:varsB;
      const fresh=await run(sdk.getLeadDistributionPlan,owner,{organizationId:org});
      const next=fresh.eligibleAgents.map(row=>row.id).sort((a,b)=>key(a).localeCompare(key(b)))
        .find(id=>key(id)!==key(fresh.rule.cursor.lastMembershipId));
      assert.ok(next);assert.notEqual(key(next),key(selected));
      const retried=await run(sdk.createLead,owner,{...failed,assignedMembershipId:next,distributionRuleId:fresh.rule.id,
        expectedCursorVersion:fresh.rule.cursor.version,hasAssignedMember:true});
      const successful=[...attempts.filter(result=>result.status==="fulfilled").map(result=>result.value),retried];
      const routed=await Promise.all(successful.map(result=>details(result.lead.id)));
      assert.deepEqual(new Set(routed.map(row=>key(row.assignedMembershipId))),new Set([key(memberAgent),key(memberAgent2)]));
      const after=await run(sdk.getLeadDistributionPlan,owner,{organizationId:org});
      assert.equal(after.rule.cursor.version,cursor.version+2);
      for(const uid of [agent,agent2]) {
        const inbox=await run(sdk.listInAppNotifications,uid,{organizationId:org,limit:50});
        assert.ok(inbox.notifications.some(item=>routed.some(row=>key(row.id)===key(item.lead?.id))));
      }
    });
    it("skips unavailable agents, leaves no-agent leads queued and notifies company administrators",async()=>{
      await run(sdk.setAgentAvailability,agent,{organizationId:org,status:sdk.AgentAvailabilityStatus.UNAVAILABLE,reason:"Integration test"});
      const plan=await run(sdk.getLeadDistributionPlan,owner,{organizationId:org});
      const selected=plan.eligibleAgents.find(row=>key(row.id)===key(memberAgent2));
      assert.ok(selected);
      const routed=await run(sdk.createLead,owner,{organizationId:org,leadId:randomUUID(),fullName:"Skip unavailable agent",
        assignedMembershipId:selected.id,hasAssignedMember:true,distributionRuleId:plan.rule.id,expectedCursorVersion:plan.rule.cursor.version,
        hasAutoAssignment:true,hasDistributionAttempt:true});
      assert.equal(key((await details(routed.lead.id)).assignedMembershipId),key(memberAgent2));
      await run(sdk.setAgentAvailability,agent2,{organizationId:org,status:sdk.AgentAvailabilityStatus.UNAVAILABLE,reason:"Integration test"});
      const noAgentPlan=await run(sdk.getLeadDistributionPlan,owner,{organizationId:org});
      assert.equal(noAgentPlan.eligibleAgents.length,2,"configured active agents remain visible when temporarily unavailable");
      const unassigned=await run(sdk.createLead,owner,{organizationId:org,leadId:randomUUID(),fullName:"Unassigned distribution queue",
        assignedMembershipId:null,hasAssignedMember:false,distributionRuleId:noAgentPlan.rule.id,
        expectedCursorVersion:noAgentPlan.rule.cursor.version,hasAutoAssignment:false,hasDistributionAttempt:true});
      assert.equal((await details(unassigned.lead.id)).assignedMembershipId,null);
      const adminInbox=await run(sdk.listInAppNotifications,owner,{organizationId:org,limit:50});
      assert.ok(adminInbox.notifications.some(item=>key(item.lead?.id)===key(unassigned.lead.id)&&item.type==="LEAD_UNASSIGNED"));
      const after=await run(sdk.getLeadDistributionPlan,owner,{organizationId:org});
      assert.equal(after.rule.cursor.version,noAgentPlan.rule.cursor.version,"an unassigned lead does not consume a rotation slot");
      await run(sdk.setAgentAvailability,agent,{organizationId:org,status:sdk.AgentAvailabilityStatus.AVAILABLE});
      await run(sdk.setAgentAvailability,agent2,{organizationId:org,status:sdk.AgentAvailabilityStatus.AVAILABLE});
    });
    it("lead creation stores initial notes and follow-ups with their audit trail atomically",async()=>{
      const due=new Date(Date.now()+86400000).toISOString();
      const result=await run(sdk.createLead,owner,{organizationId:org,fullName:"Atomic CRM editor",assignedMembershipId:memberAgent,
        initialNote:"Initial call requirements",initialFollowUpAt:due,initialFollowUpNote:"Call with options",hasInitialNote:true,hasInitialFollowUp:true});
      const row=await details(result.lead.id);
      assert.equal(Date.parse(row.followUpAt),Date.parse(due));
      const timeline=await history(row.id);
      assert.ok(timeline.activities.some(activity=>activity.kind==="LEAD_NOTE_ADDED"&&activity.note==="Initial call requirements"));
      assert.ok(timeline.activities.some(activity=>activity.kind==="FOLLOW_UP_SCHEDULED"));
      assert.equal(timeline.followUps.length,1);assert.equal(timeline.followUps[0].title,"Call with options");
      assert.equal(key(timeline.followUps[0].assignedUserId),key(memberAgent));
      const audits=await run(sdk.listAuditLogs,owner,{organizationId:org,limit:100});
      for(const action of ["LEAD_CREATED","LEAD_NOTE_ADDED","FOLLOW_UP_SCHEDULED"]) assert.ok(audits.auditLogs.some(a=>key(a.targetId)===key(row.id)&&a.action===action));
      const before=(await run(sdk.listLeads,owner,{organizationId:org})).total[0].count;
      for(const invalid of [{initialNote:"Missing include",hasInitialNote:false},{initialFollowUpAt:due,hasInitialFollowUp:false},{initialFollowUpAt:"2020-01-01T00:00:00Z",hasInitialFollowUp:true}]) {
        await forbidden(sdk.createLead,owner,{organizationId:org,fullName:"Invalid atomic editor",...invalid});
      }
      assert.equal((await run(sdk.listLeads,owner,{organizationId:org})).total[0].count,before);
      const contactId=await contact("Existing contact with timeline");
      const linked=await run(sdk.createLeadForContact,owner,{organizationId:org,contactId,initialNote:"Existing contact note",hasInitialNote:true,initialFollowUpAt:due,hasInitialFollowUp:true});
      assert.equal((await history(linked.lead.id)).followUps.length,1);
    });
    it("KPI counts exclude archived and unrelated leads for agents and managers",async()=>{
      const ids=[];
      for(const status of ["NEW","QUALIFIED","WON"]) {
        const id=await lead({assignedMembershipId:memberAgent});ids.push(id);
        if(status!=="NEW") await run(sdk.changeLeadStatus,owner,{organizationId:org,leadId:id,status});
      }
      await lead({assignedMembershipId:memberManager});
      const expected=await run(sdk.listLeads,agent,{organizationId:org});
      const metrics=await run(sdk.getLeadMetrics,agent,{organizationId:org});
      assert.equal(metrics.total[0].count,expected.total[0].count);
      for(const [alias,statuses] of [["newLeads",["NEW"]],["qualified",["QUALIFIED"]],["won",["WON","CONVERTED"]]]) {
        assert.equal(metrics[alias][0]?.count??0,expected.leads.filter(row=>statuses.includes(row.status)).length);
      }
      const managerRows=await run(sdk.listLeads,manager,{organizationId:org});
      assert.equal((await run(sdk.getLeadMetrics,manager,{organizationId:org})).total[0].count,managerRows.total[0].count);
      await run(sdk.archiveLead,owner,{organizationId:org,leadId:ids[0]});
      assert.equal((await run(sdk.getLeadMetrics,agent,{organizationId:org})).total[0].count,metrics.total[0].count-1);
      await forbidden(sdk.getLeadMetrics,ownerB,{organizationId:org});
      await forbidden(sdk.getLeadMetrics,null,{organizationId:org});
      await forbidden(sdk.getLeadMetrics,owner,{organizationId:org},{email_verified:false});
    });
    it("database sorting, date ranges and count pagination use identical scoped filters",async()=>{
      const prefix="Sort "+randomUUID()+" ";
      const configuration=await run(sdk.getLeadConfiguration,owner,{organizationId:org});
      const sourceId=configuration.leadSources[0].id;
      const ids=[];
      for(const name of ["C","A","B"]) ids.push(await lead({fullName:prefix+name,priority:"HIGH",sourceId,assignedMembershipId:memberAgent}));
      const setup=`mutation SetSortDates($org:UUID!,$a:UUID!,$b:UUID!,$c:UUID!){
        a:lead_update(key:{organizationId:$org,id:$a},data:{createdAt:"2025-01-01T23:59:59Z"})
        b:lead_update(key:{organizationId:$org,id:$b},data:{createdAt:"2025-01-02T00:00:00Z"})
        c:lead_update(key:{organizationId:$org,id:$c},data:{createdAt:"2025-01-02T23:59:59Z"})
      }`;
      await dc.executeGraphql(setup,{variables:{org,a:ids[0],b:ids[1],c:ids[2]}});
      const variables={organizationId:org,search:`%${prefix}%`,priority:"HIGH",sourceId,createdFrom:"2025-01-02T00:00:00Z",createdBefore:"2025-01-03T00:00:00Z",limit:1};
      const first=await run(sdk.listLeadsNameAsc,agent,variables),second=await run(sdk.listLeadsNameAsc,agent,{...variables,offset:1});
      assert.equal(first.total[0].count,2);assert.equal(first.leads[0].fullName,prefix+"A");assert.equal(second.leads[0].fullName,prefix+"B");
      const descending=await run(sdk.listLeadsNameDesc,owner,{...variables,limit:10});
      assert.deepEqual(descending.leads.map(row=>row.fullName),[prefix+"B",prefix+"A"]);
      const created=await run(sdk.listLeadsCreatedAsc,owner,{...variables,limit:10});
      assert.deepEqual(created.leads.map(row=>key(row.id)),[key(ids[1]),key(ids[2])]);
      const unrelated=await run(sdk.listLeads,manager,variables);assert.equal(unrelated.leads.length,0);assert.equal(unrelated.total[0]?.count??0,0);
      const filtered=await run(sdk.listLeads,owner,{...variables,priority:"URGENT"});assert.equal(filtered.total[0]?.count??0,0);
    });
    it("Kanban stage changes survive a fresh authorized database read",async()=>{
      const id=await lead({assignedMembershipId:memberAgent});
      const configuration=await run(sdk.getLeadConfiguration,owner,{organizationId:org});
      const target=stage(configuration,"CONTACTED");
      await run(sdk.moveLeadStage,agent,{organizationId:org,leadId:id,pipelineStageId:target});
      const reloaded=await run(sdk.listLeads,agent,{organizationId:org,pipelineStageId:target});
      assert.ok(reloaded.leads.some(row=>key(row.id)===key(id)&&row.status==="CONTACTED"));
      await forbidden(sdk.moveLeadStage,manager,{organizationId:org,leadId:id,pipelineStageId:target});
      await forbidden(sdk.moveLeadStage,ownerB,{organizationId:org,leadId:id,pipelineStageId:target});
      const timeline=await history(id);assert.ok(timeline.stages.some(row=>key(row.newStageId)===key(target)));
    });
    it("follow-up history has stable server pagination and cannot leak private records",async()=>{
      const id=await lead({assignedMembershipId:memberAgent});
      for(let index=0;index<3;index++) await run(sdk.scheduleLeadFollowUp,owner,{organizationId:org,leadId:id,followUpAt:new Date(Date.now()+(index+1)*86400000).toISOString(),title:"History page "+index,replaceExisting:false});
      const first=await run(sdk.listLeadFollowUps,agent,{organizationId:org,leadId:id,limit:2});
      const next=await run(sdk.listLeadFollowUps,agent,{organizationId:org,leadId:id,limit:2,offset:2});
      assert.equal(first.total[0].count,3);assert.equal(first.followUps.length,2);assert.equal(next.followUps.length,1);
      assert.notEqual(first.followUps[0].id,next.followUps[0].id);assert.ok(first.followUps[0].assignedUser.email);
      await forbidden(sdk.listLeadFollowUps,manager,{organizationId:org,leadId:id});
      await forbidden(sdk.listLeadFollowUps,ownerB,{organizationId:org,leadId:id});
      await forbidden(sdk.listLeadFollowUps,null,{organizationId:org,leadId:id});
    });
    it("creates a contact and multiple leads referencing the same contact",async()=>{
      const contactId=await contact("Shared CRM buyer",{email:"Sales+CRM@Example.TEST",phone:"+971501000001",normalizedPhone:"+971501000001"});
      const first=await run(sdk.createLeadForContact,owner,{organizationId:org,contactId});
      const second=await run(sdk.createLeadForContact,owner,{organizationId:org,contactId,transactionType:"RENT"});
      assert.notEqual(first.lead.id,second.lead.id);
      for(const id of [first.lead.id,second.lead.id]) {
        const row=await details(id);assert.equal(key(row.contactId),key(contactId));assert.equal(row.contact.fullName,"Shared CRM buyer");
        assert.ok(row.leadNumber);assert.equal(row.currency,"AED");assert.ok(row.pipelineStageId);
      }
    });
    it("contact search and duplicates are company-scoped and preserve independent records",async()=>{
      const email="Sales.Team+CRM@Example.TEST";
      const first=await contact("Duplicate candidate one",{email,phone:"+971501000002",normalizedPhone:"+971501000002"});
      const second=await contact("Duplicate candidate two",{email:email.toLowerCase(),alternatePhone:"+971501000002",normalizedAlternatePhone:"+971501000002"});
      assert.notEqual(first,second);
      const duplicates=await run(sdk.findDuplicateContacts,owner,{organizationId:org,email:email.toLowerCase(),phone:"+971501000002"});
      assert.equal(duplicates.contacts.length,2);
      const foreign=await run(sdk.findDuplicateContacts,ownerB,{organizationId:orgB,email:email.toLowerCase(),phone:"+971501000002"});
      assert.equal(foreign.contacts.length,0);
      const search=await run(sdk.searchContacts,owner,{organizationId:org,search:"%Duplicate candidate%",limit:1,offset:0});
      const next=await run(sdk.searchContacts,owner,{organizationId:org,search:"%Duplicate candidate%",limit:1,offset:1});
      assert.equal(search.total[0].count,2);assert.notEqual(search.contacts[0].id,next.contacts[0].id);
    });
    it("only owners and administrators can create company contacts",async()=>{
      await forbidden(sdk.createContact,agent,{organizationId:org,fullName:"Agent cannot create a shared contact"});
      await forbidden(sdk.createContact,manager,{organizationId:org,fullName:"Manager cannot create a shared contact"});
      const created=await run(sdk.createContact,owner,{organizationId:org,fullName:"Owner contact creation"});
      assert.ok(created.contact.id);
      assert.equal((await run(sdk.getContact,owner,{organizationId:org,contactId:created.contact.id})).contact.fullName,"Owner contact creation");
    });
    it("rejects foreign contacts, companies, inactive members and cross-company assignees",async()=>{
      const foreign=(await run(sdk.createContact,ownerB,{organizationId:orgB,fullName:"Foreign CRM buyer"})).contact.id;
      await forbidden(sdk.getContact,owner,{organizationId:org,contactId:foreign});
      await forbidden(sdk.updateContact,owner,{organizationId:org,contactId:foreign,fullName:"Hijacked"});
      await forbidden(sdk.createLeadForContact,owner,{organizationId:org,contactId:foreign});
      await forbidden(sdk.createLead,owner,{organizationId:org,fullName:"Rejected assignment",assignedMembershipId:memberB});
      await forbidden(sdk.searchContacts,owner,{organizationId:orgB});
      await forbidden(sdk.listLeads,owner,{organizationId:orgB});
      const id=await lead();await forbidden(sdk.getLead,ownerB,{organizationId:org,leadId:id});
      await forbidden(sdk.assignLead,owner,{organizationId:org,leadId:id,assignedMembershipId:memberB});
      await forbidden(sdk.assignLead,owner,{organizationId:org,leadId:id,assignedMembershipId:memberSuspended});
      await forbidden(sdk.assignLead,owner,{organizationId:org,leadId:id,assignedMembershipId:memberManager});
      await forbidden(sdk.assignLead,agent,{organizationId:org,leadId:id,assignedMembershipId:memberAgent2});
    });
    it("agents and managers have only assigned leads and no inferred team or branch permission",async()=>{
      const assigned=await lead({assignedMembershipId:memberAgent});
      const managed=await lead({assignedMembershipId:memberManager});
      const privateLead=await lead();
      assert.equal((await details(assigned,agent)).id,assigned);
      assert.equal((await details(managed,manager)).id,managed);
      for(const [uid,id]of[[agent,managed],[agent,privateLead],[manager,assigned],[manager,privateLead]]) {
        await forbidden(sdk.getLead,uid,{organizationId:org,leadId:id});
        await forbidden(sdk.getLeadCrmHistory,uid,{organizationId:org,leadId:id});
        await forbidden(sdk.addLeadNote,uid,{organizationId:org,leadId:id,note:"Unauthorized"});
      }
      const reassignment=await run(sdk.assignLead,manager,{organizationId:org,leadId:managed,assignedMembershipId:memberAgent,reason:"Manager rebalance"});
      assert.ok(reassignment.lead);
      assert.equal(key((await details(managed)).assignedMembershipId),key(memberAgent));
      await forbidden(sdk.createLead,manager,{organizationId:org,fullName:"Unassigned forbidden"});
      const own=await run(sdk.createLead,manager,{organizationId:org,fullName:"Assigned manager lead",assignedMembershipId:memberManager});
      assert.ok((await details(own.lead.id,manager)).id);
      const list=await run(sdk.listLeads,agent,{organizationId:org});
      assert.ok(list.leads.every(row=>key(row.assignedMembershipId)===key(memberAgent)));
    });
    it("contact discovery and duplicate warnings do not leak unrelated lead contacts",async()=>{
      const id=await lead({assignedMembershipId:memberManager,email:"private-crm@example.test"});
      const row=await details(id);
      await forbidden(sdk.getContact,agent,{organizationId:org,contactId:row.contactId});
      const matches=await run(sdk.findDuplicateContacts,agent,{organizationId:org,email:"private-crm@example.test"});
      assert.equal(matches.contacts.length,0);
    });
    it("contact edits synchronize compatibility fields without changing assignment",async()=>{
      const contactId=await contact();const created=await run(sdk.createLeadForContact,owner,{organizationId:org,contactId,assignedMembershipId:memberAgent});
      await run(sdk.updateContact,owner,{organizationId:org,contactId,fullName:"Updated CRM buyer",email:"Changed@Example.TEST"});
      const row=await details(created.lead.id);
      assert.equal(row.fullName,"Updated CRM buyer");assert.equal(row.contact.normalizedEmail,"changed@example.test");assert.equal(key(row.assignedMembershipId),key(memberAgent));
      await forbidden(sdk.updateContact,agent,{organizationId:org,contactId,fullName:"Unauthorized edit"});
      await run(sdk.updateContact,owner,{organizationId:org,contactId,fullName:"Full-record cleared email"});
      const cleared=await details(created.lead.id);
      assert.equal(cleared.contact.email,null);assert.equal(cleared.contact.normalizedEmail,null);assert.equal(cleared.email,null);
    });
    it("editing an unlinked legacy lead cannot mutate a different contact",async()=>{
      const contactId=await contact("Preserve unrelated legacy contact",{email:"preserve@example.test"});
      const id=randomUUID();
      await dc.insert("lead",{organizationId:org,id,fullName:"Legacy unlinked buyer",createdByUid:owner,updatedByUid:owner});
      await run(sdk.updateLead,owner,{organizationId:org,leadId:id,fullName:"Updated legacy buyer",status:"CONTACTED"});
      const unchanged=(await run(sdk.getContact,owner,{organizationId:org,contactId})).contact;
      assert.equal(unchanged.fullName,"Preserve unrelated legacy contact");assert.equal(unchanged.email,"preserve@example.test");
      assert.equal((await details(id)).contactId,null);
    });
    it("clearing nullable fields cannot bypass a shared private contact's edit restrictions",async()=>{
      const contactId=await contact("Shared private contact",{email:"shared-private@example.test",phone:"+971501000077"});
      const own=await run(sdk.createLeadForContact,owner,{organizationId:org,contactId,assignedMembershipId:memberAgent});
      await run(sdk.createLeadForContact,owner,{organizationId:org,contactId,assignedMembershipId:memberAgent2});
      await forbidden(sdk.updateLead,agent,{organizationId:org,leadId:own.lead.id,assignedMembershipId:memberAgent,fullName:"Shared private contact",status:"NEW",email:null,phone:null});
      const row=(await run(sdk.getContact,owner,{organizationId:org,contactId})).contact;
      assert.equal(row.email,"shared-private@example.test");assert.equal(row.phone,"+971501000077");
      await run(sdk.updateLead,agent,{organizationId:org,leadId:own.lead.id,assignedMembershipId:memberAgent,fullName:row.fullName,status:"CONTACTED",email:row.email,phone:row.phone,priority:"HIGH",recordAssignment:false});
      assert.equal((await details(own.lead.id)).priority,"HIGH");
    });
    it("stage moves validate pipeline and terminal state and append structured history",async()=>{
      const id=await lead();const config=await run(sdk.getLeadConfiguration,owner,{organizationId:org});
      const qualified=stage(config,"QUALIFIED"),won=stage(config,"WON"),fresh=stage(config,"NEW");
      await run(sdk.moveLeadStage,owner,{organizationId:org,leadId:id,pipelineStageId:qualified});
      await run(sdk.moveLeadStage,owner,{organizationId:org,leadId:id,pipelineStageId:won});
      await forbidden(sdk.moveLeadStage,owner,{organizationId:org,leadId:id,pipelineStageId:fresh});
      await forbidden(sdk.changeLeadStatus,owner,{organizationId:org,leadId:id,status:"NEW"});
      await forbidden(sdk.moveLeadStage,owner,{organizationId:org,leadId:id,pipelineStageId:randomUUID()});
      assert.equal((await details(id)).status,"WON");
      const events=(await history(id)).stages;
      assert.equal(events.length,3);assert.ok(events.some(e=>e.previousStageId && key(e.newStageId)===key(won)));
    });
    it("assignment changes have immutable history and retain organization constraints",async()=>{
      const id=await lead({assignedMembershipId:memberAgent});
      await run(sdk.assignLead,owner,{organizationId:org,leadId:id,assignedMembershipId:memberAgent2,reason:"Coverage change"});
      const events=(await history(id)).assignments;
      assert.equal(events.length,2);
      const changed=events.find(e=>e.assignmentType==="REASSIGNMENT");assert.equal(key(changed.previousAgentId),key(memberAgent));assert.equal(key(changed.newAgentId),key(memberAgent2));assert.equal(changed.assignedByUid,owner);assert.equal(changed.reason,"Coverage change");
      await forbidden(sdk.getLead,agent,{organizationId:org,leadId:id});
    });
    it("duplicate manual assignment requests use a stale-write guard and emit one history event",async()=>{
      const id=await lead({assignedMembershipId:memberAgent});
      const attempts=await Promise.allSettled([
        run(sdk.assignLead,owner,{organizationId:org,leadId:id,assignedMembershipId:memberAgent2,reason:"Concurrent request A"}),
        run(sdk.assignLead,owner,{organizationId:org,leadId:id,assignedMembershipId:memberAgent2,reason:"Concurrent request B"}),
      ]);
      assert.equal(attempts.filter(result=>result.status==="fulfilled").length,1);
      assert.equal(attempts.filter(result=>result.status==="rejected").length,1);
      assert.equal(key((await details(id)).assignedMembershipId),key(memberAgent2));
      const events=(await history(id)).assignments;
      assert.equal(events.length,2);
      const reassignment=events.find(event=>event.assignmentType==="REASSIGNMENT");
      assert.ok(reassignment.assignedAt);assert.ok(["Concurrent request A","Concurrent request B"].includes(reassignment.reason));
      assert.equal(reassignment.assignedByUid,owner);
    });
    it("closed leads require an explicit owner override for reassignment",async()=>{
      const id=await lead({assignedMembershipId:memberAgent});
      await run(sdk.changeLeadStatus,owner,{organizationId:org,leadId:id,status:"WON"});
      await forbidden(sdk.assignLead,owner,{organizationId:org,leadId:id,assignedMembershipId:memberAgent2});
      await forbidden(sdk.assignLead,manager,{organizationId:org,leadId:id,assignedMembershipId:memberAgent2,overrideClosed:true});
      await run(sdk.assignLead,owner,{organizationId:org,leadId:id,assignedMembershipId:memberAgent2,overrideClosed:true,reason:"Owner-approved closed lead override"});
      assert.equal(key((await details(id)).assignedMembershipId),key(memberAgent2));
    });
    it("stage references cannot cross pipelines and inactive pipelines reject writes",async()=>{
      const otherPipeline=randomUUID(), otherStage=randomUUID();
      await dc.insert("pipeline",{organizationId:org,id:otherPipeline,name:"Local custom pipeline",isDefault:false,isActive:true});
      await dc.insert("pipelineStage",{organizationId:org,pipelineId:otherPipeline,id:otherStage,name:"Local new stage",position:0,stageType:"OPEN",status:"NEW"});
      const id=await lead();
      await forbidden(sdk.moveLeadStage,owner,{organizationId:org,leadId:id,pipelineStageId:otherStage});
      await assert.rejects(()=>dc.executeGraphql('mutation WrongPipeline($org:UUID!,$id:UUID!,$stage:UUID!){lead_update(key:{organizationId:$org,id:$id},data:{pipelineStageId:$stage})}',{variables:{org,id,stage:otherStage}}));
      await dc.executeGraphql('mutation InactivatePipeline($org:UUID!,$id:UUID!){pipeline_update(key:{organizationId:$org,id:$id},data:{isActive:false})}',{variables:{org,id:otherPipeline}});
      await forbidden(sdk.createLead,owner,{organizationId:org,fullName:"Inactive pipeline probe",pipelineId:otherPipeline});
    });
    it("partial budget changes validate the resulting range and retain non-AED currency",async()=>{
      const id=await lead({budgetMin:100,budgetMax:200,currency:"USD",assignedMembershipId:memberAgent});
      const current=await details(id);
      await forbidden(sdk.updateLead,owner,{organizationId:org,leadId:id,fullName:current.fullName,status:"NEW",budgetMin:300});
      const afterFailure=await details(id);assert.equal(afterFailure.budgetMin,100);assert.equal(afterFailure.budgetMax,200);
      await run(sdk.updateLead,owner,{organizationId:org,leadId:id,fullName:current.fullName,status:"NEW",budgetMax:500,recordAssignment:false});
      const updated=await details(id);assert.equal(updated.currency,"USD");assert.equal(updated.budgetMax,500);assert.equal(key(updated.assignedMembershipId),key(memberAgent));
    });
    it("multiple follow-ups complete independently and maintain the next-due summary",async()=>{
      const id=await lead({assignedMembershipId:memberAgent});
      const early=new Date(Date.now()+86400000).toISOString(),later=new Date(Date.now()+2*86400000).toISOString();
      const first=await run(sdk.scheduleLeadFollowUp,agent,{organizationId:org,leadId:id,title:"First call",followUpAt:early,replaceExisting:false});
      const second=await run(sdk.scheduleLeadFollowUp,agent,{organizationId:org,leadId:id,title:"Second call",followUpAt:later,replaceExisting:false});
      assert.equal(Date.parse((await details(id)).followUpAt),Date.parse(early));
      await run(sdk.completeLeadFollowUp,agent,{organizationId:org,leadId:id,followUpId:first.followUp.id});
      assert.equal(Date.parse((await details(id)).followUpAt),Date.parse(later));
      await forbidden(sdk.completeLeadFollowUp,agent,{organizationId:org,leadId:id,followUpId:first.followUp.id});
      await run(sdk.completeLeadFollowUp,agent,{organizationId:org,leadId:id,followUpId:second.followUp.id});
      assert.equal((await details(id)).followUpAt,null);
      const rows=(await history(id)).followUps;assert.ok(rows.every(f=>f.status==="COMPLETED" && f.completedAt));
      await forbidden(sdk.scheduleLeadFollowUp,agent,{organizationId:org,leadId:id,followUpAt:early,assignedUserId:memberManager});
    });
    it("archive preserves records/history, cancels pending work, and denies subsequent writes",async()=>{
      const id=await lead({assignedMembershipId:memberAgent});
      await run(sdk.scheduleLeadFollowUp,agent,{organizationId:org,leadId:id,followUpAt:new Date(Date.now()+86400000).toISOString()});
      await forbidden(sdk.archiveLead,agent,{organizationId:org,leadId:id});
      await run(sdk.archiveLead,owner,{organizationId:org,leadId:id});
      assert.ok((await details(id)).archivedAt);
      const active=await run(sdk.listLeads,owner,{organizationId:org});assert.ok(!active.leads.some(row=>row.id===id));
      const archived=await run(sdk.listLeads,owner,{organizationId:org,activeOnly:false});assert.ok(archived.leads.some(row=>row.id===id));
      await forbidden(sdk.addLeadNote,owner,{organizationId:org,leadId:id,note:"Cannot modify archive"});
      assert.equal((await history(id)).followUps[0].status,"CANCELLED");
    });
    it("lead numbers remain unique under concurrent creation and lists paginate consistently",async()=>{
      const contactId=await contact("Concurrent buyer");
      const created=await Promise.all(Array.from({length:5},()=>run(sdk.createLeadForContact,owner,{organizationId:org,contactId,priority:"HIGH",transactionType:"INVEST"})));
      const rows=await Promise.all(created.map(result=>details(result.lead.id)));
      assert.equal(new Set(rows.map(row=>row.leadNumber)).size,5);
      const a=await run(sdk.listLeads,owner,{organizationId:org,contactId,priority:"HIGH",transactionType:"INVEST",limit:2,offset:0});
      const b=await run(sdk.listLeads,owner,{organizationId:org,contactId,priority:"HIGH",transactionType:"INVEST",limit:2,offset:2});
      assert.equal(a.total[0].count,5);assert.equal(new Set([...a.leads,...b.leads].map(row=>row.id)).size,4);
    });
    it("failed aggregate creation leaves no contact, lead, history or success audit",async()=>{
      const name="Rollback CRM "+randomUUID();
      const before=(await run(sdk.listAuditLogs,owner,{organizationId:org,limit:100})).auditLogs.length;
      await forbidden(sdk.createLead,owner,{organizationId:org,fullName:name,assignedMembershipId:memberB});
      assert.equal((await run(sdk.searchContacts,owner,{organizationId:org,search:`%${name}%`})).total[0].count,0);
      assert.equal((await run(sdk.listLeads,owner,{organizationId:org,search:`%${name}%`})).total[0].count,0);
      assert.equal((await run(sdk.listAuditLogs,owner,{organizationId:org,limit:100})).auditLogs.length,before);
    });
    it("PostgreSQL rejects a contact-to-lead relationship across organizations",async()=>{
      const contactId=(await run(sdk.createContact,ownerB,{organizationId:orgB,fullName:"Foreign FK probe"})).contact.id;
      await assert.rejects(()=>dc.executeGraphql(`mutation ForeignContact($org:UUID!,$contact:UUID!,$actor:String!){lead_insert(data:{organizationId:$org,contactId:$contact,fullName:"Rejected FK",createdByUid:$actor,updatedByUid:$actor})}`,{variables:{org,contact:contactId,actor:owner}}));
    });
    it("anonymous, unverified and forged-role requests cannot use CRM operations",async()=>{
      for(const [operation,variables]of[[sdk.searchContacts,{organizationId:org}],[sdk.getLeadConfiguration,{organizationId:org}],[sdk.createContact,{organizationId:org,fullName:"Denied"}]]) {
        await forbidden(operation,null,variables);await forbidden(operation,owner,variables,{email_verified:false});await forbidden(operation,"outsider",variables,{role:"OWNER",organizationId:org});
      }
    });
  });
}
