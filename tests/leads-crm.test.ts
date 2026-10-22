import assert from "node:assert/strict";
import {test} from "node:test";
import {normalizeEmail, normalizePhone} from "../src/modules/leads/normalization";
import {createContactSchema, updateContactSchema, duplicateContactSchema, createFollowUpSchema, normalizedContact, moveLeadStageSchema} from "../src/modules/leads/crm-validation";
import {createLeadSchema, updateLeadSchema, leadListInputSchema} from "../src/modules/leads/validation";
import {parseLeadApiQuery} from "../src/modules/leads/server/api-query";
import {assertCanWriteLead, type ActiveMembership} from "../src/modules/organizations/server/permission-policy";

const contactId="50000000-0000-4000-8000-000000000001";
test("contact normalization preserves email mailbox semantics and plus tags",()=>{
  assert.equal(normalizeEmail(" Sales.Team+UAE@EXAMPLE.TEST "),"Sales.Team+UAE@example.test");
  const parsed=createContactSchema.parse({fullName:" Local Buyer ",email:" Sales.Team+UAE@EXAMPLE.TEST "});
  assert.equal(parsed.email,"Sales.Team+UAE@example.test");
  assert.equal(parsed.fullName,"Local Buyer");
});
for(const [input,expected]of [["+971 (50) 100-0000","+971501000000"],["00971 50 100 0000","+971501000000"],["050 100 0000","+971501000000"],["04 123 4567","+97141234567"]]) {
  test(`normalizes recognized phone format ${input}`,()=>assert.equal(normalizePhone(input).normalizedPhone,expected));
}
test("ambiguous phone numbers remain explicit and produce a warning",()=>{
  const result=normalizePhone("555 1234");
  assert.equal(result.phone,"555 1234");assert.equal(result.normalizedPhone,null);assert.ok(result.warning);
  const prepared=normalizedContact(createContactSchema.parse({fullName:"Buyer",phone:"555 1234"}));
  assert.equal(prepared.warnings.length,1);
});
for(const injected of [{organizationId:contactId},{role:"OWNER"},{createdByUid:"victim"},{normalizedPhone:"+971500000000"},{id:contactId}]) {
  test(`contact inputs reject authority or normalized-value injection ${Object.keys(injected)[0]}`,()=>{
    assert.equal(createContactSchema.safeParse({fullName:"Buyer",...injected}).success,false);
    assert.equal(updateContactSchema.safeParse({fullName:"Buyer",contactId,...injected}).success,false);
  });
}
test("one contact may be selected for multiple independently created leads",()=>{
  assert.equal(createLeadSchema.safeParse({contactId}).success,true);
  assert.equal(createLeadSchema.safeParse({}).success,false);
  assert.equal(duplicateContactSchema.safeParse({}).success,false);
});
test("CRM lead validation rejects invalid budgets, leaves future project references scalar and rejects unmodeled properties",()=>{
  for(const extra of [{budgetMin:500,budgetMax:499},{budgetMin:-1},{budgetMax:Infinity},{budgetMin:1.005},{propertyId:contactId}]) assert.equal(createLeadSchema.safeParse({contactId,...extra}).success,false);
  assert.equal(createLeadSchema.safeParse({contactId,projectId:contactId}).success,true);
  assert.equal(createLeadSchema.safeParse({contactId,budgetMin:10.5,budgetMax:200,currency:" aed ",transactionType:"BUY"}).success,true);
  assert.equal(updateLeadSchema.safeParse({leadId:contactId,fullName:"Buyer",status:"NEW",contactId}).success,false);
});
test("pipeline and follow-up identifiers cannot carry tenant or actor assertions",()=>{
  assert.equal(moveLeadStageSchema.safeParse({leadId:contactId,pipelineStageId:contactId}).success,true);
  assert.equal(moveLeadStageSchema.safeParse({leadId:contactId,pipelineStageId:contactId,organizationId:contactId}).success,false);
  const dueAt=new Date(Date.now()+86400000).toISOString();
  assert.equal(createFollowUpSchema.safeParse({leadId:contactId,title:"Call buyer",dueAt,assignedUserId:contactId}).success,true);
  for(const extra of [{dueAt:"2020-01-01T00:00:00Z"},{dueAt:"2030-01-01T12:00:00"},{actorId:contactId},{status:"COMPLETED"}]) assert.equal(createFollowUpSchema.safeParse({leadId:contactId,title:"Call buyer",dueAt,...extra}).success,false);
});
test("API pagination is bounded, strict, and cannot mix page and offset modes",()=>{
  assert.equal(parseLeadApiQuery({page:"2",pageSize:"25"}).offset,25);
  assert.equal(parseLeadApiQuery({limit:"10",offset:"20",pipelineId:contactId,archive:"ARCHIVED"}).limit,10);
  for(const input of [{page:"2",offset:"1"},{page:"-1"},{offset:"10001"},{limit:"101"},{organizationId:contactId},{archive:"DELETED"},{search:["one","two"]}]) assert.throws(()=>parseLeadApiQuery(input));
  assert.equal(leadListInputSchema.parse({}).archive,"ACTIVE");
});
for(const role of ["MANAGER","AGENT"] as const) {
  test(`${role} has no inferred organization-wide or branch scope`,()=>{
    const actor:ActiveMembership={id:contactId,organizationId:contactId,userUid:"local-user",email:"local@example.test",role,status:"ACTIVE"};
    assert.doesNotThrow(()=>assertCanWriteLead(actor,contactId));
    assert.throws(()=>assertCanWriteLead(actor,null));
    assert.throws(()=>assertCanWriteLead(actor,"50000000-0000-4000-8000-000000000002"));
  });
}
