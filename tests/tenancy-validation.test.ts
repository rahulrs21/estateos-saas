import assert from "node:assert/strict";
import { test } from "node:test";
import {
  acceptInvitationInputSchema, createOrganizationInputSchema, inviteMembershipInputSchema,
  membershipStatusInputSchema, paginationInputSchema, profileInputSchema, switchOrganizationInputSchema,
  validateInput,
} from "../src/modules/organizations/server/validation";
import { createLeadInputSchema, updateLeadInputSchema } from "../src/modules/leads/server/validation";
import { WorkspaceError } from "../src/modules/organizations/server/errors";

const id = "11111111-1111-4111-8111-111111111111";

test("organization inputs normalize names and slugs while rejecting role/owner injection", () => {
  assert.deepEqual(validateInput(createOrganizationInputSchema, { name: " EstateOS UAE ", slug: " estateos-uae " }),
    { name: "EstateOS UAE", slug: "estateos-uae" });
  assert.throws(() => validateInput(createOrganizationInputSchema, { name: "EstateOS", slug: "estateos", role: "OWNER" }), WorkspaceError);
  assert.throws(() => validateInput(createOrganizationInputSchema, { name: "EstateOS", slug: "estateos", ownerUid: "victim" }), WorkspaceError);
  for (const slug of ["--", "acme/uae", "two words", "éstate", "x".repeat(64)]) {
    assert.equal(createOrganizationInputSchema.safeParse({ name: "EstateOS", slug }).success, false);
  }
});

test("profile input cannot assign an active organization or identity", () => {
  assert.equal(profileInputSchema.safeParse({ displayName: "Agent", uid: "victim" }).success, false);
  assert.equal(profileInputSchema.safeParse({ displayName: "Agent", activeOrganizationId: id }).success, false);
});

test("company switching requires a UUID selector and rejects membership assertions", () => {
  assert.deepEqual(validateInput(switchOrganizationInputSchema, { organizationId: id }), { organizationId: id });
  assert.equal(switchOrganizationInputSchema.safeParse({ organizationId: "org-a" }).success, false);
  assert.equal(switchOrganizationInputSchema.safeParse({ organizationId: id, role: "OWNER" }).success, false);
});

test("SDK UUID wire values round-trip through company switching and lead reference inputs", () => {
  const wireId = id.replaceAll("-", "");
  assert.deepEqual(validateInput(switchOrganizationInputSchema, { organizationId: wireId }), { organizationId: id });
  assert.deepEqual(validateInput(createLeadInputSchema, { fullName: "Buyer", branchId: wireId, assignedMembershipId: wireId }),
    { fullName: "Buyer", branchId: id, assignedMembershipId: id });
  assert.equal(switchOrganizationInputSchema.safeParse({ organizationId: "g".repeat(32) }).success, false);
});

test("invitations allow only grantable roles and never accept client token digests or expiry", () => {
  assert.deepEqual(validateInput(inviteMembershipInputSchema, { email: "AGENT@example.test", role: "AGENT" }),
    { email: "agent@example.test", role: "AGENT" });
  for (const role of ["OWNER", "owner", "SUPERUSER", ""]) {
    assert.equal(inviteMembershipInputSchema.safeParse({ email: "agent@example.test", role }).success, false);
  }
  for (const injected of [{ tokenHash: "0".repeat(64) }, { expiresAt: "2099-01-01" }, { userUid: "victim" }, { status: "ACTIVE" }]) {
    assert.equal(inviteMembershipInputSchema.safeParse({ email: "agent@example.test", role: "AGENT", ...injected }).success, false);
  }
});

test("invitation acceptance takes a secret, never a caller-selected role or UID", () => {
  const valid = { organizationId: id, membershipId: id, token: "a".repeat(43) };
  assert.equal(acceptInvitationInputSchema.safeParse(valid).success, true);
  for (const injected of [{ role: "OWNER" }, { userUid: "victim" }, { status: "ACTIVE" }]) {
    assert.equal(acceptInvitationInputSchema.safeParse({ ...valid, ...injected }).success, false);
  }
  assert.equal(acceptInvitationInputSchema.safeParse({ ...valid, token: "short" }).success, false);
});

test("membership status input cannot self-activate or promote", () => {
  for (const status of ["ACTIVE", "PENDING", "INVITED", "OWNER"]) {
    assert.equal(membershipStatusInputSchema.safeParse({ membershipId: id, status }).success, false);
  }
  for (const status of ["SUSPENDED", "REVOKED"]) {
    assert.equal(membershipStatusInputSchema.safeParse({ membershipId: id, status }).success, true);
  }
});

test("lead inputs reject organization/actor injection and validate reference UUIDs", () => {
  assert.equal(createLeadInputSchema.safeParse({ fullName: "Prospective Buyer", branchId: id }).success, true);
  for (const injected of [{ organizationId: id }, { createdByUid: "victim" }, { role: "OWNER" }, { branchId: "org-b-branch" }]) {
    assert.equal(createLeadInputSchema.safeParse({ fullName: "Buyer", ...injected }).success, false);
  }
  assert.equal(createLeadInputSchema.safeParse({ fullName: "Buyer", email: "bad" }).success, false);
  assert.equal(createLeadInputSchema.safeParse({ fullName: "Buyer", phone: "javascript:123" }).success, false);
});

test("lead updates require an explicit recognized status and complete name", () => {
  assert.equal(updateLeadInputSchema.safeParse({ leadId: id, fullName: "Buyer", status: "QUALIFIED" }).success, true);
  assert.equal(updateLeadInputSchema.safeParse({ leadId: id, fullName: "Buyer", status: "ADMIN" }).success, false);
  assert.equal(updateLeadInputSchema.safeParse({ leadId: id, status: "NEW" }).success, false);
});

test("pagination is bounded and never accepts tenant selectors", () => {
  assert.deepEqual(validateInput(paginationInputSchema, {}), { limit: 50, offset: 0 });
  for (const input of [{ limit: 101 }, { limit: 0 }, { offset: -1 }, { offset: 10_001 }, { limit: 1.2 }, { organizationId: id }]) {
    assert.equal(paginationInputSchema.safeParse(input).success, false);
  }
});
