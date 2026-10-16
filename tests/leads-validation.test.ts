import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createLeadSchema, updateLeadSchema, leadIdInputSchema, leadStatusInputSchema,
  leadAssignmentInputSchema, leadNoteInputSchema, leadFollowUpInputSchema,
  leadListInputSchema, leadPageFiltersSchema, escapeLeadSearch,
} from "../src/modules/leads/validation";

const id = "13000000-0000-4000-8000-000000000001";
const member = "11000000-0000-4000-8000-000000000004";

test("lead creation normalizes contact fields and accepts only valid reference identifiers", () => {
  assert.deepEqual(createLeadSchema.parse({
    fullName: " Local Buyer ", email: "BUYER@example.test", phone: "+971 50 100 0000",
    source: " Website ", assignedMembershipId: member.replaceAll("-", ""), branchId: null,
  }), {
    fullName: "Local Buyer", email: "buyer@example.test", phone: "+971 50 100 0000",
    source: "Website", assignedMembershipId: member, branchId: null,
  });
  for (const input of [
    { fullName: " " }, { fullName: "x".repeat(161) }, { email: "bad email" },
    { phone: "javascript:123" }, { branchId: "other-company" }, { assignedMembershipId: "owner" },
  ]) {
    assert.equal(createLeadSchema.safeParse({ fullName: "Local Buyer", ...input }).success, false);
  }
});

test("all lead operations reject client-supplied tenant, identity, membership and role authority", () => {
  const examples = [
    [createLeadSchema, { fullName: "Local Buyer" }],
    [updateLeadSchema, { leadId: id, fullName: "Local Buyer", status: "NEW" }],
    [leadIdInputSchema, { leadId: id }],
    [leadStatusInputSchema, { leadId: id, status: "CONTACTED" }],
    [leadAssignmentInputSchema, { leadId: id, assignedMembershipId: member }],
    [leadNoteInputSchema, { leadId: id, note: "Private note" }],
    [leadFollowUpInputSchema, { leadId: id, followUpAt: new Date(Date.now() + 86400000).toISOString() }],
    [leadListInputSchema, {}],
  ] as const;
  for (const [schema, valid] of examples) {
    assert.equal(schema.safeParse(valid).success, true);
    for (const injection of [
      { organizationId: id }, { userUid: "victim" }, { createdByUid: "victim" },
      { role: "OWNER" }, { membership: { status: "ACTIVE", role: "ADMIN" } },
      { options: { impersonate: { authClaims: { sub: "victim" } } } },
    ]) assert.equal(schema.safeParse({ ...valid, ...injection }).success, false);
  }
});

test("status input permits every defined pipeline stage and rejects unknown future values", () => {
  for (const status of ["NEW", "CONTACTED", "QUALIFIED", "LOST", "CONVERTED"]) {
    assert.equal(leadStatusInputSchema.safeParse({ leadId: id, status }).success, true);
    assert.equal(updateLeadSchema.safeParse({ leadId: id, fullName: "Local Buyer", status }).success, true);
  }
  for (const status of ["ADMIN", "new", "WON", "ARCHIVED", "", null, 1]) {
    assert.equal(leadStatusInputSchema.safeParse({ leadId: id, status }).success, false);
    assert.equal(updateLeadSchema.safeParse({ leadId: id, fullName: "Local Buyer", status }).success, false);
  }
});

test("assignment requires an explicit valid UUID or an explicit unassignment", () => {
  assert.deepEqual(leadAssignmentInputSchema.parse({ leadId: id.replaceAll("-", ""), assignedMembershipId: member }),
    { leadId: id, assignedMembershipId: member });
  assert.equal(leadAssignmentInputSchema.safeParse({ leadId: id, assignedMembershipId: null }).success, true);
  for (const assignedMembershipId of [undefined, "", "other-member", 1, { role: "ADMIN" }]) {
    assert.equal(leadAssignmentInputSchema.safeParse({ leadId: id, assignedMembershipId }).success, false);
  }
});

test("notes require meaningful bounded text without accepting a forged actor or audit kind", () => {
  assert.deepEqual(leadNoteInputSchema.parse({ leadId: id, note: " Follow up next week. " }),
    { leadId: id, note: "Follow up next week." });
  assert.equal(leadNoteInputSchema.safeParse({ leadId: id, note: "x".repeat(4000) }).success, true);
  for (const note of ["", " \n ", "x".repeat(4001), null]) {
    assert.equal(leadNoteInputSchema.safeParse({ leadId: id, note }).success, false);
  }
  assert.equal(leadNoteInputSchema.safeParse({ leadId: id, note: "Private note", actorUid: "victim" }).success, false);
  assert.equal(leadNoteInputSchema.safeParse({ leadId: id, note: "Private note", kind: "MEMBERSHIP_APPROVED" }).success, false);
});

test("follow-up requires an unambiguous future timestamp within one year and a bounded optional note", () => {
  const due = new Date(Date.now() + 86400000).toISOString();
  assert.deepEqual(leadFollowUpInputSchema.parse({ leadId: id, followUpAt: due, followUpNote: " Call buyer " }),
    { leadId: id, followUpAt: due, followUpNote: "Call buyer" });
  for (const followUpAt of [
    "2020-01-01T00:00:00Z", "not-a-date", "2026-12-01", "2026-12-01T10:00:00",
    new Date(Date.now() + 366 * 86400000).toISOString(), null,
  ]) assert.equal(leadFollowUpInputSchema.safeParse({ leadId: id, followUpAt }).success, false);
  assert.equal(leadFollowUpInputSchema.safeParse({ leadId: id, followUpAt: due, followUpNote: "x".repeat(501) }).success, false);
});

test("lead list validation bounds pagination and rejects invalid status or filter selectors", () => {
  assert.deepEqual(leadListInputSchema.parse({}), { search: "", followUp: "ALL", limit: 50, offset: 0 });
  assert.equal(leadListInputSchema.safeParse({ search: " Local buyer ", status: "NEW", branchId: id, assignedMembershipId: member, followUp: "OVERDUE", limit: 100, offset: 10000 }).success, true);
  for (const input of [
    { limit: 0 }, { limit: 101 }, { limit: "25" }, { limit: 1.5 }, { offset: -1 }, { offset: 10001 },
    { search: "x".repeat(121) }, { status: "OWNER" }, { branchId: "bad" },
    { assignedMembershipId: "bad" }, { followUp: "PRIVATE" }, { organizationId: id },
  ]) assert.equal(leadListInputSchema.safeParse(input).success, false);
});

test("URL pagination rejects invalid or excessive pages while retaining explicit empty filters", () => {
  assert.deepEqual(leadPageFiltersSchema.parse({ page: "2", pageSize: "25" }), {
    search: "", status: "", branchId: "", assignedMembershipId: "", followUp: "ALL", page: 2, pageSize: 25,
  });
  assert.equal(leadPageFiltersSchema.safeParse({ page: "401", pageSize: "25" }).success, true);
  for (const input of [
    { page: "0" }, { page: "abc" }, { page: "1.5" }, { page: "402" },
    { page: "202", pageSize: "50" }, { pageSize: "500" }, { status: "SUPERUSER" },
  ]) assert.equal(leadPageFiltersSchema.safeParse(input).success, false);
});

test("search escapes SQL LIKE wildcard characters as literal user text", () => {
  assert.equal(escapeLeadSearch(""), undefined);
  assert.equal(escapeLeadSearch("Buyer"), "%Buyer%");
  assert.equal(escapeLeadSearch("50%_share\\folder"), "%50\\%\\_share\\\\folder%");
  assert.equal(escapeLeadSearch("' OR true --"), "%' OR true --%");
});
