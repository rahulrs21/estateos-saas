import assert from "node:assert/strict";
import { test } from "node:test";
import { assertActiveMembership, assertCanChangeMembershipRole, type ActiveMembership } from "../src/modules/organizations/server/permission-policy";
import { membershipRoleInputSchema, membershipStatusInputSchema } from "../src/modules/organizations/server/validation";
import { mapOrganizationCreationError, mapWorkspaceDataError, WorkspaceError } from "../src/modules/organizations/server/errors";

const owner: ActiveMembership = { id: "owner", organizationId: "company-a", userUid: "owner-uid", email: "owner@example.test", role: "OWNER", status: "ACTIVE" };
const target = { ...owner, id: "agent", userUid: "agent-uid", email: "agent@example.test", role: "AGENT" };

test("role changes require authority over both the target and proposed role", () => {
  assert.doesNotThrow(() => assertCanChangeMembershipRole(owner, target, "ADMIN"));
  for (const [actor, member, role] of [
    [{ ...owner, role: "AGENT" }, target, "ADMIN"],
    [owner, owner, "AGENT"],
    [owner, { ...target, role: "OWNER" }, "AGENT"],
    [owner, target, "OWNER"],
    [owner, { ...target, organizationId: "company-b" }, "ADMIN"],
    [{ ...owner, role: "ADMIN" }, target, "ADMIN"],
    [owner, { ...target, status: "REMOVED" }, "ADMIN"],
  ] as const) {
    assert.throws(() => assertCanChangeMembershipRole(actor as ActiveMembership, member, role), WorkspaceError);
  }
});

test("removed memberships never establish a selected-company context", () => {
  assert.throws(() => assertActiveMembership({ ...owner, status: "REMOVED" }, owner.organizationId, owner.userUid), WorkspaceError);
});

test("role and removal inputs reject authority injection and owner grants", () => {
  const membershipId = "10000000-0000-4000-8000-000000000001";
  assert.equal(membershipStatusInputSchema.safeParse({ membershipId, status: "REMOVED" }).success, true);
  assert.equal(membershipRoleInputSchema.safeParse({ membershipId, role: "MANAGER" }).success, true);
  for (const extra of [{ role: "OWNER" }, { organizationId: membershipId }, { actorUid: "owner-uid" }, { status: "ACTIVE" }]) {
    assert.equal(membershipRoleInputSchema.safeParse({ membershipId, role: "ADMIN", ...extra }).success, false);
  }
});

test("duplicate slugs have a safe conflict error while unrelated provider failures stay closed", () => {
  for (const failure of [
    { code: "data-connect/query-error", message: "ORGANIZATION_SLUG_TAKEN private tokenHash=secret" },
    { code: "data-connect/query-error", message: 'duplicate key value violates unique constraint "organization_slug_key"; private SQL' },
    { code: "data-connect/already-exists", message: "private SQL" },
  ]) {
    const safe = mapOrganizationCreationError(failure);
    assert.equal(safe.code, "ORGANIZATION_SLUG_TAKEN");
    assert.equal(safe.status, 409);
    assert.doesNotMatch(safe.message, /private|tokenHash|secret|SQL/);
  }
  assert.equal(mapOrganizationCreationError({ code: "data-connect/query-error", message: "different constraint" }).status, 403);
  assert.equal(mapOrganizationCreationError(new Error("provider offline")).status, 503);
});

test("a missing SQL Connect service or operation is a setup failure, not a missing company row", () => {
  const error = mapWorkspaceDataError({
    code: "data-connect/not-found",
    message: "private project/connector path; token=secret",
  });
  assert.equal(error.code, "SQL_CONNECT_NOT_CONFIGURED");
  assert.equal(error.status, 503);
  assert.doesNotMatch(error.message, /private|token|secret/);
  assert.equal(mapOrganizationCreationError({ code: "data-connect/not-found" }).status, 503);
});

test("explicit record-level missing errors and authorization denials keep their meaning", () => {
  const missing = new WorkspaceError("NOT_FOUND", 404, "This lead is unavailable.");
  assert.equal(mapWorkspaceDataError(missing), missing);
  assert.equal(mapWorkspaceDataError({ code: "data-connect/permission-denied" }).status, 403);
  assert.equal(mapWorkspaceDataError({ code: "data-connect/query-error" }).status, 403);
});
