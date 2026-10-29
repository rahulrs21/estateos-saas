import assert from "node:assert/strict";
import { test } from "node:test";
import { leadPropertyViewingSchema, updateLeadPropertyViewingSchema } from "../src/modules/leads/property-validation";

const id = "10000000-0000-4000-8000-000000000001";
const tomorrow = () => new Date(Date.now() + 86400000).toISOString();
const update = {leadId: id, viewingId: id, status: "SCHEDULED", expectedUpdatedAt: new Date().toISOString(), assignedMembershipId: id, customerConfirmation: "CONFIRMED"};

test("scheduling requires an assignee and defaults customer confirmation to pending", () => {
  assert.equal(leadPropertyViewingSchema.safeParse({leadId: id, propertyId: id, scheduledAt: tomorrow()}).success, false);
  const parsed = leadPropertyViewingSchema.parse({leadId: id, propertyId: id, scheduledAt: tomorrow(), assignedMembershipId: id});
  assert.equal(parsed.customerConfirmation, "PENDING");
  assert.equal(leadPropertyViewingSchema.safeParse({leadId: id, propertyId: id, scheduledAt: tomorrow(), assignedMembershipId: id, customerConfirmation: "MAYBE"}).success, false);
});

test("viewing inputs reject caller-supplied tenant authority", () => {
  assert.equal(leadPropertyViewingSchema.safeParse({leadId: id, propertyId: id, scheduledAt: tomorrow(), assignedMembershipId: id, organizationId: id}).success, false);
  assert.equal(updateLeadPropertyViewingSchema.safeParse({...update, organizationId: id}).success, false);
  assert.equal(updateLeadPropertyViewingSchema.safeParse({...update, role: "OWNER"}).success, false);
});

test("an outcome is accepted only for completed viewings", () => {
  assert.equal(updateLeadPropertyViewingSchema.safeParse({...update, outcome: "POSITIVE"}).success, false);
  assert.equal(updateLeadPropertyViewingSchema.safeParse({...update, status: "CANCELLED", outcome: "NO_SHOW"}).success, false);
  assert.equal(updateLeadPropertyViewingSchema.safeParse({...update, status: "COMPLETED", outcome: "POSITIVE"}).success, true);
  assert.equal(updateLeadPropertyViewingSchema.safeParse({...update, status: "COMPLETED", outcome: "EXCELLENT"}).success, false);
});

test("follow-up tasks require a terminal transition, a title and a due date within a year", () => {
  const followUp = {title: "Call about the offer", dueAt: tomorrow()};
  assert.equal(updateLeadPropertyViewingSchema.safeParse({...update, followUp}).success, false);
  assert.equal(updateLeadPropertyViewingSchema.safeParse({...update, status: "COMPLETED", followUp}).success, true);
  assert.equal(updateLeadPropertyViewingSchema.safeParse({...update, status: "CANCELLED", followUp}).success, true);
  for (const invalid of [{...followUp, title: "  "}, {...followUp, dueAt: new Date(Date.now() - 1000).toISOString()}, {...followUp, dueAt: new Date(Date.now() + 366 * 86400000).toISOString()}, {...followUp, assignedUserId: id}]) {
    assert.equal(updateLeadPropertyViewingSchema.safeParse({...update, status: "COMPLETED", followUp: invalid}).success, false);
  }
});
