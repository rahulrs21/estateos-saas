import assert from "node:assert/strict";
import { test } from "node:test";
import {
  assertActiveMembership,
  assertCanGrantMembershipRole,
  assertCanManageMembership,
  assertCanWriteLead,
  assertInvitationRecipient,
  assertOrganizationAdministrator,
  type ActiveMembership,
  type StoredMembership,
} from "../src/modules/organizations/server/permission-policy";
import { WorkspaceError, mapWorkspaceDataError } from "../src/modules/organizations/server/errors";
import { assertSafeDataConnectEnvironment } from "../src/modules/organizations/server/dataconnect-policy";
import { createInvitationSecret, hashInvitationToken, INVITATION_LIFETIME_MS } from "../src/modules/organizations/server/invitation-token";

const actor: ActiveMembership = {
  id: "owner-membership", organizationId: "org-a", userUid: "owner-uid",
  email: "owner@example.test", role: "OWNER", status: "ACTIVE",
};
const target: StoredMembership = {
  id: "target-membership", organizationId: "org-a", userUid: "target-uid",
  email: "agent@example.test", role: "AGENT", status: "PENDING",
};
const denies = (callback: () => unknown) => assert.throws(callback,
  (error: unknown) => error instanceof WorkspaceError && error.status === 403);

test("membership requires the verified UID and requested organization together", () => {
  assert.doesNotThrow(() => assertActiveMembership(actor, "org-a", "owner-uid"));
  denies(() => assertActiveMembership(actor, "org-b", "owner-uid"));
  denies(() => assertActiveMembership(actor, "org-a", "other-uid"));
  denies(() => assertActiveMembership(null, "org-a", "owner-uid"));
});

for (const status of ["INVITED", "PENDING", "SUSPENDED", "REVOKED", "REMOVED", "UNKNOWN"]) {
  test(`${status} membership never grants organization access`, () => {
    denies(() => assertActiveMembership({ ...actor, status }, "org-a", "owner-uid"));
  });
}

test("unknown future roles fail closed", () => {
  denies(() => assertActiveMembership({ ...actor, role: "SUPERUSER" }, "org-a", "owner-uid"));
});

test("OWNER may invite lower roles but cannot grant OWNER", () => {
  for (const role of ["ADMIN", "MANAGER", "AGENT"]) assert.doesNotThrow(() => assertCanGrantMembershipRole(actor, role));
  denies(() => assertCanGrantMembershipRole(actor, "OWNER"));
  denies(() => assertCanGrantMembershipRole(actor, "SUPERUSER"));
});

test("ADMIN may grant MANAGER/AGENT and cannot create peer administrators", () => {
  const admin = { ...actor, role: "ADMIN" as const };
  for (const role of ["MANAGER", "AGENT"]) assert.doesNotThrow(() => assertCanGrantMembershipRole(admin, role));
  denies(() => assertCanGrantMembershipRole(admin, "ADMIN"));
  denies(() => assertCanGrantMembershipRole(admin, "OWNER"));
});

for (const role of ["MANAGER", "AGENT"] as const) {
  test(`${role} cannot invite members or administer an organization`, () => {
    const member = { ...actor, role };
    for (const grant of ["OWNER", "ADMIN", "MANAGER", "AGENT"]) denies(() => assertCanGrantMembershipRole(member, grant));
    denies(() => assertOrganizationAdministrator(member));
  });
}

test("self invitations are rejected with case-insensitive email comparison", () => {
  denies(() => assertInvitationRecipient(actor, "OWNER@example.test"));
  assert.doesNotThrow(() => assertInvitationRecipient(actor, "other@example.test"));
});

test("membership approval requires a PENDING member of the same organization", () => {
  assert.doesNotThrow(() => assertCanManageMembership(actor, target, "PENDING"));
  denies(() => assertCanManageMembership(actor, { ...target, organizationId: "org-b" }, "PENDING"));
  denies(() => assertCanManageMembership(actor, { ...target, status: "INVITED" }, "PENDING"));
  denies(() => assertCanManageMembership(actor, null, "PENDING"));
});

test("self approval and modification are rejected by member key, UID or email", () => {
  denies(() => assertCanManageMembership(actor, { ...target, id: actor.id }, "PENDING"));
  denies(() => assertCanManageMembership(actor, { ...target, userUid: actor.userUid }, "PENDING"));
  denies(() => assertCanManageMembership(actor, { ...target, email: actor.email.toUpperCase() }, "PENDING"));
});

test("membership status changes cannot target OWNER or an ADMIN peer", () => {
  denies(() => assertCanManageMembership(actor, { ...target, role: "OWNER" }));
  denies(() => assertCanManageMembership({ ...actor, role: "ADMIN" }, { ...target, role: "ADMIN" }));
});

test("agents may write only leads assigned to their own active membership", () => {
  const agent = { ...actor, role: "AGENT" as const };
  assert.doesNotThrow(() => assertCanWriteLead(agent, agent.id));
  denies(() => assertCanWriteLead(agent, "other-member"));
  denies(() => assertCanWriteLead(agent, null));
  assert.doesNotThrow(() => assertCanWriteLead(actor, null));
});

test("membership checks compare UUID wire and dashed forms without broadening tenant access", () => {
  const organizationId = "10000000-0000-4000-8000-000000000001";
  const membershipId = "20000000-0000-4000-8000-000000000001";
  const member = { ...actor, id: membershipId.replaceAll("-", ""), organizationId: organizationId.replaceAll("-", "") };
  assert.doesNotThrow(() => assertActiveMembership(member, organizationId, actor.userUid));
  denies(() => assertActiveMembership(member, "10000000-0000-4000-8000-000000000002", actor.userUid));
  assert.doesNotThrow(() => assertCanWriteLead({ ...member, role: "AGENT" }, membershipId));
  denies(() => assertCanManageMembership(member, { ...target, organizationId, id: membershipId }, "PENDING"));
});

test("invitation tokens use independent 256-bit secrets and only store digests", () => {
  const now = new Date("2026-10-01T00:00:00.000Z");
  const first = createInvitationSecret(now);
  const second = createInvitationSecret(now);
  assert.match(first.token, /^[A-Za-z0-9_-]{43}$/);
  assert.match(first.tokenHash, /^[a-f0-9]{64}$/);
  assert.notEqual(first.token, second.token);
  assert.notEqual(first.tokenHash, second.tokenHash);
  assert.equal(first.tokenHash, hashInvitationToken(first.token));
  assert.equal(new Date(first.expiresAt).getTime() - now.getTime(), INVITATION_LIFETIME_MS);
});

test("production refuses any SQL Connect emulator override", () => {
  assert.throws(() => assertSafeDataConnectEnvironment({ nodeEnv: "production", emulatorHost: "127.0.0.1:9399" }),
    (error: unknown) => error instanceof WorkspaceError && error.code === "UNSAFE_CONFIGURATION");
  assert.doesNotThrow(() => assertSafeDataConnectEnvironment({ nodeEnv: "production" }));
});

for (const host of ["127.0.0.1:9399", "localhost:9399", "[::1]:9399"]) {
  test(`development permits the local emulator ${host}`, () => {
    assert.doesNotThrow(() => assertSafeDataConnectEnvironment({ nodeEnv: "test", emulatorHost: host }));
  });
}

for (const host of ["example.com:9399", "127.0.0.1", "localhost:9399/path", "localhost:9399?x=1", "user:pass@localhost:9399", "http://localhost:9399"]) {
  test(`unsafe emulator address ${host} is rejected`, () => {
    assert.throws(() => assertSafeDataConnectEnvironment({ nodeEnv: "development", emulatorHost: host }), WorkspaceError);
  });
}

test("data errors never expose provider details or invitation secrets", () => {
  const error = mapWorkspaceDataError({ code: "data-connect/query-error", message: "private SQL tokenHash=secret" });
  assert.equal(error.status, 403);
  assert.doesNotMatch(error.message, /SQL|tokenHash|secret/);
  assert.equal(mapWorkspaceDataError(new Error("credential material")).status, 503);
  assert.equal(mapWorkspaceDataError({ code: "data-connect/aborted" }).status, 409);
  assert.equal(mapWorkspaceDataError({ code: "data-connect/unauthenticated" }).status, 401);
});
