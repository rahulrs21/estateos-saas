import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { after, before, describe, it } from "node:test";
import { deleteApp, initializeApp } from "firebase-admin/app";
import { getDataConnect } from "firebase-admin/data-connect";
import * as sdk from "@dataconnect/admin-generated";
import { localDataConnect, seedLocalDatabase } from "../scripts/sql-connect-local.mjs";
import { fixture as f } from "./fixtures/sql-connect-fixtures.mjs";
import {registerCrmCases} from "./sql-connect-crm.cases.mjs";
import {registerCaptureCases} from "./sql-connect-capture.cases.mjs";
import {registerInventoryCases} from "./sql-connect-inventory.cases.mjs";
import {registerLeadPropertyCases} from "./sql-connect-lead-properties.cases.mjs";
import {registerPortalCases} from "./sql-connect-portals.cases.mjs";
import {registerMapCases} from "./sql-connect-maps.cases.mjs";
import {registerMapScaleCases} from "./sql-connect-map-scale.cases.mjs";
import {registerRateLimitCases} from "./sql-connect-rate-limit.cases.mjs";
import {registerListingCases} from "./sql-connect-listings.cases.mjs";
import {registerAiCases} from "./sql-connect-ai.cases.mjs";
import {registerAiContentCases} from "./sql-connect-ai-content.cases.mjs";
import {registerAiSalesCases} from "./sql-connect-ai-sales.cases.mjs";

// This harness refuses production, non-loopback hosts and non-demo project IDs.
// Only fixture setup and deliberate FK-constraint probes use privileged access.
const { app, dc } = localDataConnect();
const uuid = (value) => value.replaceAll("-", "").toLowerCase();

function options(uid, overrides = {}) {
  return uid === null
    ? { impersonate: { unauthenticated: true } }
    : { impersonate: { authClaims: {
        sub: uid, email: `${uid}@example.test`, email_verified: true,
        firebase: { sign_in_provider: "password" }, ...overrides,
      } } };
}

async function run(operation, uid, variables, overrides) {
  // Once an operation has optional variables, SDK options need an explicit
  // variables position; otherwise impersonation can be parsed as query input.
  if ((operation === sdk.createLead || operation === sdk.createLeadForContact) && variables && !Object.hasOwn(variables, "hasAssignedMember")) {
    variables = { ...variables, hasAssignedMember: variables.assignedMembershipId != null };
  }
  if (operation === sdk.updateLead && variables && !Object.hasOwn(variables, "recordAssignment")) {
    const current = await sdk.getLead(dc, { organizationId: variables.organizationId, leadId: variables.leadId }, options(uid, overrides));
    const currentAssignee = current.data.lead?.assignedMembershipId ?? null;
    const requestedAssignee = Object.hasOwn(variables, "assignedMembershipId")
      ? variables.assignedMembershipId ?? null
      : currentAssignee;
    variables = { ...variables, recordAssignment: currentAssignee !== requestedAssignee };
  }
  if ((operation === sdk.assignLead || operation === sdk.unassignLead) && variables && !Object.hasOwn(variables, "expectedWasUnassigned")) {
    const current = await sdk.getLead(dc, { organizationId: variables.organizationId, leadId: variables.leadId }, options(uid, overrides));
    const assignedMembershipId = current.data.lead?.assignedMembershipId ?? null;
    variables = { ...variables, expectedAssignedMembershipId: assignedMembershipId, expectedWasUnassigned: assignedMembershipId === null };
  }
  if (operation === sdk.listMyOrganizations && variables === undefined) variables = {};
  const result = variables === undefined
    ? await operation(dc, options(uid, overrides))
    : await operation(dc, variables, options(uid, overrides));
  return result.data;
}

function forbidden(operation, uid, variables, overrides) {
  return assert.rejects(() => run(operation, uid, variables, overrides));
}

describe("SQL Connect tenant and authorization integration", { concurrency: false }, () => {
  registerCrmCases({sdk,run,forbidden,dc});
  registerCaptureCases({sdk,run,forbidden,dc});
  registerInventoryCases({sdk,run,forbidden,dc});
  registerLeadPropertyCases({sdk,run,forbidden,dc});
  registerPortalCases({sdk,run,forbidden,dc});
  registerMapCases({sdk,run,forbidden,dc});
  registerMapScaleCases({sdk,run,forbidden,dc});
  registerRateLimitCases({sdk,run,forbidden,dc});
  registerListingCases({sdk,run,forbidden,dc});
  registerAiCases({sdk,run,forbidden,dc});
  registerAiContentCases({sdk,run,forbidden,dc});
  registerAiSalesCases({sdk,run,forbidden,dc});
  before(async () => { await seedLocalDatabase(dc); });
  after(async () => { await deleteApp(app); });

  it("new verified identities have no profile or memberships rather than a backend 404", async () => {
    const uid = "not-onboarded-" + randomUUID();
    assert.equal((await run(sdk.getMyProfile, uid)).userProfile, null);
    assert.deepEqual((await run(sdk.listMyOrganizations, uid)).memberships, []);
  });

  it("local SQL Connect accepts the project routing used with an existing Firebase login", async () => {
    const localApp = initializeApp({ projectId: "estateos-local-routing-check" }, "estateos-route-probe");
    try {
      const localDc = getDataConnect(sdk.connectorConfig, localApp);
      const uid = "routing-" + randomUUID();
      const profile = await sdk.getMyProfile(localDc, options(uid));
      const companies = await sdk.listMyOrganizations(localDc, {}, options(uid));
      assert.equal(profile.data.userProfile, null);
      assert.deepEqual(companies.data.memberships, []);
    } finally { await deleteApp(localApp); }
  });

  it("a missing stored connector returns a resource error without fabricating memberships", async () => {
    // Admin caches DataConnect instances by service/location, so use an isolated
    // app rather than accidentally reusing the already-configured connector.
    const isolated = initializeApp({ projectId: "demo-estateos" }, "estateos-missing-connector");
    try {
      const missing = getDataConnect({ ...sdk.connectorConfig, connector: "not-installed-" + randomUUID() }, isolated);
      await assert.rejects(
        () => missing.executeQuery("ListMyOrganizations", {}, options("not-onboarded")),
        error => error.code === "data-connect/not-found",
      );
    } finally { await deleteApp(isolated); }
  });

  for (const [name, operation, variables] of [
    ["profile", sdk.getMyProfile, undefined],
    ["organization list", sdk.listMyOrganizations, undefined],
    ["organization context", sdk.getOrganizationContext, { organizationId: f.orgA }],
    ["branches", sdk.listBranches, { organizationId: f.orgA }],
    ["memberships", sdk.listMemberships, { organizationId: f.orgA }],
    ["leads", sdk.listLeads, { organizationId: f.orgA }],
    ["lead detail", sdk.getLead, { organizationId: f.orgA, leadId: f.leadA }],
    ["activity", sdk.listActivities, { organizationId: f.orgA }],
  ]) {
    it(`rejects anonymous ${name} access`, async () => {
      await forbidden(operation, null, variables);
    });
    it(`rejects unverified ${name} access`, async () => {
      await forbidden(operation, "owner-a", variables, { email_verified: false });
    });
  }

  it("uses verified identity for profile reads", async () => {
    const result = await run(sdk.getMyProfile, "agent-a");
    assert.equal(result.userProfile.uid, "agent-a");
  });

  it("lists only active memberships for the authenticated identity", async () => {
    const a = await run(sdk.listMyOrganizations, "owner-a");
    assert.deepEqual(a.memberships.map(m => uuid(m.organizationId)), [uuid(f.orgA)]);
    const shared = await run(sdk.listMyOrganizations, "shared-agent");
    assert.deepEqual(new Set(shared.memberships.map(m => uuid(m.organizationId))), new Set([uuid(f.orgA), uuid(f.orgB)]));
  });

  for (const uid of ["invited-user", "pending-user", "suspended-user", "revoked-user", "outsider", "owner-b"]) {
    it(`denies organization A context and data to ${uid}`, async () => {
      await forbidden(sdk.getOrganizationContext, uid, { organizationId: f.orgA });
      await forbidden(sdk.listLeads, uid, { organizationId: f.orgA });
      await forbidden(sdk.listBranches, uid, { organizationId: f.orgA });
      const mine = await run(sdk.listMyOrganizations, uid);
      assert.ok(mine.memberships.every(m => uuid(m.organizationId) !== uuid(f.orgA)));
    });
  }

  it("rejects forged organization and owner claims", async () => {
    await forbidden(sdk.getOrganizationContext, "outsider", { organizationId: f.orgA }, { role: "OWNER", organizationId: f.orgA });
    await forbidden(sdk.listMemberships, "agent-a", { organizationId: f.orgA }, { role: "OWNER" });
  });

  it("filters tenant lists and rejects foreign-tenant detail keys", async () => {
    const result = await run(sdk.listLeads, "owner-a", { organizationId: f.orgA });
    assert.ok(result.leads.length > 0);
    assert.ok(result.leads.every(lead => uuid(lead.organizationId) === uuid(f.orgA)));
    await forbidden(sdk.getLead, "owner-a", { organizationId: f.orgA, leadId: f.leadB });
    await forbidden(sdk.getLead, "owner-a", { organizationId: f.orgB, leadId: f.leadB });
  });

  it("lets agents access only leads assigned to their own active membership", async () => {
    const own = await run(sdk.getLead, "agent-a", { organizationId: f.orgA, leadId: f.leadA });
    assert.equal(uuid(own.lead.assignedMembershipId), uuid(f.memberAgentA));
    await forbidden(sdk.getLead, "shared-agent", { organizationId: f.orgA, leadId: f.leadA });
    const others = await run(sdk.listLeads, "shared-agent", { organizationId: f.orgA });
    assert.equal(others.leads.length, 0);
  });

  it("rejects oversized or negative pagination at the connector boundary", async () => {
    for (const vars of [{ limit: 0 }, { limit: 101 }, { offset: -1 }, { offset: 10001 }]) {
      await forbidden(sdk.listLeads, "owner-a", { organizationId: f.orgA, ...vars });
    }
  });

  it("does not disclose invitation token hashes in membership lists", async () => {
    const result = await run(sdk.listMemberships, "owner-a", { organizationId: f.orgA });
    assert.ok(result.memberships.some(m => m.status === "INVITED"));
    assert.ok(result.memberships.every(m => !("invitationTokenHash" in m)));
  });

  it("PostgreSQL rejects a cross-organization branch foreign key", async () => {
    await assert.rejects(() => dc.insert("lead", {
      organizationId: f.orgA, id: randomUUID(), fullName: "Rejected FK probe",
      branchId: f.branchB, createdByUid: "owner-a", updatedByUid: "owner-a",
    }), /foreign key|constraint/i);
  });

  it("PostgreSQL rejects a cross-organization membership foreign key", async () => {
    await assert.rejects(() => dc.insert("lead", {
      organizationId: f.orgB, id: randomUUID(), fullName: "Rejected FK probe",
      assignedMembershipId: f.memberAgentA, createdByUid: "owner-b", updatedByUid: "owner-b",
    }), /foreign key|constraint/i);
  });

  it("PostgreSQL rejects a cross-organization activity-to-lead foreign key", async () => {
    await assert.rejects(() => dc.insert("activity", {
      organizationId: f.orgA, id: randomUUID(), actorUid: "owner-a",
      kind: "LEAD_UPDATED", leadId: f.leadB,
    }), /foreign key|constraint/i);
  });

  it("creates an organization, authorized owner and audit event atomically", async () => {
    const uid = `new-owner-${randomUUID()}`;
    await run(sdk.upsertMyProfile, uid, { displayName: "Local New Owner" });
    const result = await run(sdk.createOrganization, uid, { name: "Local New Organization", slug: `local-${randomUUID()}` });
    const organizationId = result.organization.id;
    const context = await run(sdk.getOrganizationContext, uid, { organizationId });
    assert.equal(context.ownMembership.role, "OWNER");
    assert.equal(context.ownMembership.status, "ACTIVE");
    assert.equal(context.ownMembership.userProfileUid, uid);
    const profile = await run(sdk.getMyProfile, uid);
    assert.equal(uuid(profile.userProfile.activeOrganizationId), uuid(organizationId));
    const audit = await run(sdk.listActivities, uid, { organizationId });
    assert.equal(audit.activities.length, 1);
    assert.equal(audit.activities[0].kind, "ORGANIZATION_CREATED");
    assert.equal(audit.activities[0].actorUid, uid);
  });

  it("requires a profile before owner bootstrap and rolls back failed creation", async () => {
    const uid = `no-profile-${randomUUID()}`;
    const slug = `local-${randomUUID()}`;
    await forbidden(sdk.createOrganization, uid, { name: "Local Rejected Organization", slug });
    const result = await dc.executeGraphql("query Probe($slug: String!) { organizations(where: {slug: {eq: $slug}}) { id } }", { variables: { slug } });
    assert.equal(result.data.organizations.length, 0);
  });

  it("rejects duplicate organization slugs without adding owner or audit records", async () => {
    const before = await run(sdk.listMyOrganizations, "owner-a");
    await forbidden(sdk.createOrganization, "owner-a", { name: "Local Duplicate", slug: "local-agency-a" });
    const after = await run(sdk.listMyOrganizations, "owner-a");
    assert.deepEqual(after, before);
  });

  it("preserves profile creation time when updating the same authenticated profile", async () => {
    await run(sdk.switchOrganization, "owner-a", { organizationId: f.orgA });
    const selectedBefore = await run(sdk.getMyProfile, "owner-a");
    await run(sdk.upsertMyProfile, "owner-a", { displayName: "Updated Local Owner" });
    const selectedAfter = await run(sdk.getMyProfile, "owner-a");
    assert.equal(selectedAfter.userProfile.activeOrganizationId, selectedBefore.userProfile.activeOrganizationId);
    assert.equal(selectedAfter.userProfile.createdAt, selectedBefore.userProfile.createdAt);
    const before = await run(sdk.getMyProfile, "outsider");
    await run(sdk.upsertMyProfile, "outsider", { displayName: "Updated Local Outsider" });
    const after = await run(sdk.getMyProfile, "outsider");
    assert.equal(after.userProfile.uid, "outsider");
    assert.equal(after.userProfile.createdAt, before.userProfile.createdAt);
  });

  it("switches companies only after checking active membership and audits the switch", async () => {
    for (const organizationId of [f.orgA, f.orgB]) {
      await run(sdk.switchOrganization, "shared-agent", { organizationId });
      const profile = await run(sdk.getMyProfile, "shared-agent");
      assert.equal(uuid(profile.userProfile.activeOrganizationId), uuid(organizationId));
    }
    const before = await run(sdk.getMyProfile, "shared-agent");
    await forbidden(sdk.switchOrganization, "shared-agent", { organizationId: randomUUID() });
    const after = await run(sdk.getMyProfile, "shared-agent");
    assert.deepEqual(after, before);
    const audit = await run(sdk.listActivities, "owner-b", { organizationId: f.orgB });
    assert.ok(audit.activities.some(e => e.kind === "ORGANIZATION_SWITCHED" && e.actorUid === "shared-agent"));
  });

  for (const [uid, role] of [["agent-a", "AGENT"], ["manager-a", "AGENT"], ["admin-a", "ADMIN"], ["owner-a", "OWNER"]]) {
    it(`rejects unauthorized ${role} invitation by ${uid}`, async () => {
      await forbidden(sdk.inviteMembership, uid, {
        organizationId: f.orgA, email: `local-${randomUUID()}@example.test`, role,
        tokenHash: "b".repeat(64), expiresAt: new Date(Date.now() + 3600000).toISOString(),
      });
    });
  }

  it("rejects self invitations, excessive expiry and malformed token hashes", async () => {
    const valid = { organizationId: f.orgA, email: "local-invite@example.test", role: "AGENT", tokenHash: "b".repeat(64), expiresAt: new Date(Date.now() + 3600000).toISOString() };
    for (const invalid of [{ email: "owner-a@example.test" }, { tokenHash: "weak" }, { expiresAt: "2099-01-01T00:00:00Z" }]) {
      await forbidden(sdk.inviteMembership, "owner-a", { ...valid, ...invalid });
    }
  });

  it("binds atomic active membership to verified email, token and single-use state", async () => {
    const input = { organizationId: f.orgA, membershipId: f.memberInvitedA, tokenHash: "a".repeat(64) };
    await forbidden(sdk.acceptInvitation, "outsider", input);
    await forbidden(sdk.acceptInvitation, "invited-user", { ...input, tokenHash: "b".repeat(64) });
    await forbidden(sdk.acceptInvitation, "invited-user", input, { email_verified: false });
    // A concurrent replay must not consume the invitation twice or emit two events.
    const attempts = await Promise.allSettled([
      run(sdk.acceptInvitation, "invited-user", input),
      run(sdk.acceptInvitation, "invited-user", input),
    ]);
    assert.equal(attempts.filter(r => r.status === "fulfilled").length, 1);
    assert.equal(attempts.filter(r => r.status === "rejected").length, 1);
    await forbidden(sdk.acceptInvitation, "invited-user", input);
    await forbidden(sdk.approveMembership, "invited-user", { organizationId: f.orgA, membershipId: f.memberInvitedA });
    const members = await run(sdk.listMemberships, "owner-a", { organizationId: f.orgA });
    assert.equal(members.memberships.find(m => uuid(m.id) === uuid(f.memberInvitedA)).status, "ACTIVE");
    await forbidden(sdk.approveMembership, "owner-a", { organizationId: f.orgA, membershipId: f.memberInvitedA });
    const context = await run(sdk.getOrganizationContext, "invited-user", { organizationId: f.orgA });
    assert.equal(context.ownMembership.role, "AGENT");
    assert.equal(context.ownMembership.status, "ACTIVE");
    const audit = await run(sdk.listActivities, "owner-a", { organizationId: f.orgA });
    assert.equal(audit.activities.filter(e => e.kind === "INVITATION_ACCEPTED" && uuid(e.targetId) === uuid(f.memberInvitedA)).length, 1);
  });

  it("requires an owner-issued invitation for active administrator membership", async () => {
    const uid = `local-admin-${randomUUID()}`;
    await run(sdk.upsertMyProfile, uid, { displayName: "Local Invited Admin" });
    const invite = await run(sdk.inviteMembership, "owner-a", {
      organizationId: f.orgA, email: `${uid}@example.test`, role: "ADMIN",
      tokenHash: "c".repeat(64), expiresAt: new Date(Date.now() + 3600000).toISOString(),
    });
    const membershipId = invite.membership.id;
    await run(sdk.acceptInvitation, uid, { organizationId: f.orgA, membershipId, tokenHash: "c".repeat(64) });
    await forbidden(sdk.approveMembership, "admin-a", { organizationId: f.orgA, membershipId });
    await forbidden(sdk.approveMembership, "owner-a", { organizationId: f.orgA, membershipId });
    assert.equal((await run(sdk.getOrganizationContext, uid, { organizationId: f.orgA })).ownMembership.role, "ADMIN");
  });

  it("lets an administrator issue an agent invitation without granting ownership", async () => {
    const uid = `local-agent-${randomUUID()}`;
    await run(sdk.upsertMyProfile, uid, { displayName: "Local Invited Agent" });
    const invite = await run(sdk.inviteMembership, "admin-a", {
      organizationId: f.orgA, email: `${uid}@example.test`, role: "AGENT",
      tokenHash: "d".repeat(64), expiresAt: new Date(Date.now() + 3600000).toISOString(),
    });
    const membershipId = invite.membership.id;
    await run(sdk.acceptInvitation, uid, { organizationId: f.orgA, membershipId, tokenHash: "d".repeat(64) });
    await forbidden(sdk.approveMembership, "admin-a", { organizationId: f.orgA, membershipId });
    assert.equal((await run(sdk.getOrganizationContext, uid, { organizationId: f.orgA })).ownMembership.role, "AGENT");
  });

  it("rejects expired invitations and duplicate organization/user memberships", async () => {
    const uid = `local-expired-${randomUUID()}`;
    const membershipId = randomUUID();
    await run(sdk.upsertMyProfile, uid, { displayName: "Local Expired Invite" });
    await dc.insert("membership", { organizationId: f.orgA, id: membershipId, email: `${uid}@example.test`, role: "AGENT", status: "INVITED", invitationTokenHash: "e".repeat(64), invitationExpiresAt: "2020-01-01T00:00:00Z" });
    await forbidden(sdk.acceptInvitation, uid, { organizationId: f.orgA, membershipId, tokenHash: "e".repeat(64) });
    await assert.rejects(() => dc.insert("membership", { organizationId: f.orgA, id: randomUUID(), userProfileUid: "agent-a", email: "duplicate-local@example.test", role: "AGENT", status: "ACTIVE" }));
  });

  it("protects owner membership, self status and administrator hierarchy", async () => {
    const input = { organizationId: f.orgA, membershipId: f.memberOwnerA, status: "REVOKED" };
    for (const uid of ["owner-a", "admin-a", "agent-a"]) await forbidden(sdk.setMembershipStatus, uid, input);
    await forbidden(sdk.setMembershipStatus, "admin-a", { ...input, membershipId: f.memberAdminA });
    await forbidden(sdk.setMembershipStatus, "owner-a", { ...input, membershipId: f.memberAgentA, status: "ACTIVE" });
  });

  it("revocation invalidates an existing active-company preference immediately", async () => {
    await run(sdk.switchOrganization, "invited-user", { organizationId: f.orgA });
    await run(sdk.setMembershipStatus, "admin-a", { organizationId: f.orgA, membershipId: f.memberInvitedA, status: "REVOKED" });
    const profile = await run(sdk.getMyProfile, "invited-user");
    assert.equal(uuid(profile.userProfile.activeOrganizationId), uuid(f.orgA));
    await forbidden(sdk.getOrganizationContext, "invited-user", { organizationId: f.orgA });
    await forbidden(sdk.listLeads, "invited-user", { organizationId: f.orgA });
    await forbidden(sdk.switchOrganization, "invited-user", { organizationId: f.orgA });
  });

  it("permits branch creation only for active organization administrators", async () => {
    await run(sdk.createBranch, "admin-a", { organizationId: f.orgA, name: `Local Branch ${randomUUID()}` });
    await forbidden(sdk.createBranch, "manager-a", { organizationId: f.orgA, name: "Local Rejected Branch" });
    await forbidden(sdk.createBranch, "owner-b", { organizationId: f.orgA, name: "Local Rejected Branch" });
  });

  it("enforces lead write scope, assignee state and atomic audit events", async () => {
    const input = { organizationId: f.orgA, fullName: "Local Created Lead", branchId: f.branchA, assignedMembershipId: f.memberAgentA };
    const created = await run(sdk.createLead, "agent-a", input);
    const leadId = created.lead.id;
    const update = { ...input, leadId, fullName: "Local Updated Lead", status: "CONTACTED" };
    await run(sdk.updateLead, "agent-a", update);
    await forbidden(sdk.updateLead, "shared-agent", { ...update, assignedMembershipId: f.memberSharedA });
    await forbidden(sdk.updateLead, "agent-a", { ...update, assignedMembershipId: f.memberSharedA });
    await forbidden(sdk.createLead, "agent-a", { ...input, assignedMembershipId: f.memberSharedA });
    await forbidden(sdk.createLead, "owner-a", { ...input, assignedMembershipId: f.memberPendingA });
    await forbidden(sdk.createLead, "owner-a", { ...input, branchId: f.branchB });
    await forbidden(sdk.createLead, "owner-b", input);
    const record = await run(sdk.getLead, "owner-a", { organizationId: f.orgA, leadId });
    assert.equal(record.lead.fullName, "Local Updated Lead");
    assert.equal(record.lead.status, "CONTACTED");
    const audit = await run(sdk.listActivities, "owner-a", { organizationId: f.orgA });
    const events = audit.activities.filter(e => e.leadId && uuid(e.leadId) === uuid(leadId));
    assert.deepEqual(new Set(events.map(e => e.kind)), new Set(["LEAD_CREATED", "LEAD_ASSIGNED", "LEAD_UPDATED"]));
    assert.equal(events.length, 3);
    assert.ok(events.every(e => e.actorUid === "agent-a"));
  });

  it("limits managers to creating self-assigned leads without inventing team scope", async () => {
    await forbidden(sdk.createLead, "manager-a", {organizationId:f.orgA,fullName:"Rejected unassigned manager lead"});
    const result = await run(sdk.createLead, "manager-a", { organizationId: f.orgA, fullName: "Local Unassigned Lead", assignedMembershipId: f.memberManagerA });
    const detail = await run(sdk.getLead, "manager-a", { organizationId: f.orgA, leadId: result.lead.id });
    assert.equal(uuid(detail.lead.assignedMembershipId), uuid(f.memberManagerA));
    assert.equal(detail.lead.branchId ?? null, null);
    await forbidden(sdk.getLead, "agent-a", { organizationId: f.orgA, leadId: result.lead.id });
  });

  it("rejects non-password sign-in and forged profile authorization fields", async () => {
    await forbidden(sdk.getOrganizationContext, "owner-a", { organizationId: f.orgA }, { firebase: { sign_in_provider: "anonymous" } });
    await forbidden(sdk.upsertMyProfile, "outsider", { displayName: "Local Forgery Probe", uid: "owner-a", role: "OWNER", activeOrganizationId: f.orgA });
    const profile = await run(sdk.getMyProfile, "outsider");
    assert.equal(profile.userProfile.uid, "outsider");
    assert.equal(profile.userProfile.activeOrganizationId ?? null, null);
    await forbidden(sdk.getOrganizationContext, "outsider", { organizationId: f.orgA });
  });

  for (const [name, operation, variables] of [
    ["profile update", sdk.upsertMyProfile, { displayName: "Rejected Local Mutation" }],
    ["owner bootstrap", sdk.createOrganization, { name: "Rejected Local Organization", slug: "local-rejected-owner" }],
    ["company switch", sdk.switchOrganization, { organizationId: f.orgA }],
    ["branch creation", sdk.createBranch, { organizationId: f.orgA, name: "Rejected Local Branch" }],
    ["invitation", sdk.inviteMembership, { organizationId: f.orgA, email: "rejected-local@example.test", role: "AGENT", tokenHash: "f".repeat(64), expiresAt: new Date(Date.now() + 3600000).toISOString() }],
    ["invitation acceptance", sdk.acceptInvitation, { organizationId: f.orgA, membershipId: f.memberInvitedA, tokenHash: "a".repeat(64) }],
    ["approval", sdk.approveMembership, { organizationId: f.orgA, membershipId: f.memberPendingA }],
    ["membership change", sdk.setMembershipStatus, { organizationId: f.orgA, membershipId: f.memberAgentA, status: "REVOKED" }],
    ["lead creation", sdk.createLead, { organizationId: f.orgA, fullName: "Rejected Local Lead" }],
    ["lead update", sdk.updateLead, { organizationId: f.orgA, leadId: f.leadA, fullName: "Rejected Local Lead", status: "CONTACTED" }],
  ]) {
    it(`rejects anonymous ${name}`, async () => { await forbidden(operation, null, variables); });
    it(`rejects unverified ${name}`, async () => { await forbidden(operation, "owner-a", variables, { email_verified: false }); });
  }

  // Exercise the stored operations through the generated SDK, not an in-memory
  // policy facsimile. These additions run after the foundation lifecycle tests.
  const leadOperationCases = (organizationId, leadId) => [
    ["read", sdk.getLead, { organizationId, leadId }],
    ["timeline", sdk.listLeadActivities, { organizationId, leadId }],
    ["edit", sdk.updateLead, { organizationId, leadId, fullName: "Rejected Private Edit", status: "CONTACTED", assignedMembershipId: f.memberAgentA }],
    ["note", sdk.addLeadNote, { organizationId, leadId, note: "Rejected private note" }],
    ["status", sdk.changeLeadStatus, { organizationId, leadId, status: "QUALIFIED" }],
    ["assignment", sdk.assignLead, { organizationId, leadId, assignedMembershipId: f.memberAgentA }],
    ["follow-up scheduling", sdk.scheduleLeadFollowUp, { organizationId, leadId, followUpAt: new Date(Date.now() + 86400000).toISOString(), followUpNote: "Rejected private follow-up" }],
    ["follow-up completion", sdk.completeLeadFollowUp, { organizationId, leadId }],
  ];

  for (const [name, operation, input] of leadOperationCases(f.orgA, f.leadB)) {
    it(`prevents company A ${name} of a company B lead through a forged local key`, async () => {
      await forbidden(operation, "owner-a", input);
    });
  }

  for (const [name, operation, input] of leadOperationCases(f.orgB, f.leadB)) {
    it(`prevents company A ${name} after changing the organization selector to company B`, async () => {
      await forbidden(operation, "owner-a", input);
    });
  }

  for (const [name, operation, input] of leadOperationCases(f.orgA, f.leadA)) {
    it(`prevents another agent's private lead ${name} even with a forged self-assignment`, async () => {
      const attempt = name === "edit" || name === "assignment"
        ? { ...input, assignedMembershipId: f.memberSharedA }
        : input;
      await forbidden(operation, "shared-agent", attempt);
    });
  }

  it("denies every lead operation to an agent on an unassigned private lead", async () => {
    const created = await run(sdk.createLead, "owner-a", { organizationId: f.orgA, fullName: "Local Private Unassigned Probe" });
    for (const [name, operation, input] of leadOperationCases(f.orgA, created.lead.id)) {
      await assert.rejects(() => run(operation, "agent-a", input), undefined, `unassigned private lead: ${name}`);
    }
    const detail = await run(sdk.getLead, "owner-a", { organizationId: f.orgA, leadId: created.lead.id });
    assert.equal(detail.lead.fullName, "Local Private Unassigned Probe");
    assert.equal(detail.lead.assignedMembershipId ?? null, null);
    const timeline = await run(sdk.listLeadActivities, "owner-a", { organizationId: f.orgA, leadId: created.lead.id });
    assert.deepEqual(timeline.activities.map(event => event.kind), ["LEAD_CREATED"]);
  });

  it("keeps company B lead details and activity unchanged after forbidden cross-tenant operations", async () => {
    const detail = await run(sdk.getLead, "owner-b", { organizationId: f.orgB, leadId: f.leadB });
    assert.equal(detail.lead.fullName, "Local Test Lead B");
    assert.equal(detail.lead.status, "NEW");
    assert.equal(detail.lead.followUpAt ?? null, null);
    const timeline = await run(sdk.listLeadActivities, "owner-b", { organizationId: f.orgB, leadId: f.leadB });
    assert.equal(timeline.activities.length, 0);
  });

  it("denies lead operations immediately to pending, suspended and revoked memberships", async () => {
    for (const uid of ["pending-user", "suspended-user", "revoked-user"]) {
      for (const [name, operation, input] of leadOperationCases(f.orgA, f.leadA)) {
        await assert.rejects(() => run(operation, uid, input), undefined, `${uid}: ${name}`);
      }
      await forbidden(sdk.listLeadAssignees, uid, { organizationId: f.orgA });
    }
  });

  it("allows managers to maintain their assigned leads and read their private timeline", async () => {
    const created = await run(sdk.createLead, "manager-a", {
      organizationId: f.orgA, fullName: "Local Manager Workflow Probe", assignedMembershipId: f.memberManagerA,
    });
    const key = { organizationId: f.orgA, leadId: created.lead.id };
    const due = new Date(Date.now() + 7 * 86400000).toISOString();
    await run(sdk.addLeadNote, "manager-a", { ...key, note: "Local manager private workflow note" });
    await run(sdk.changeLeadStatus, "manager-a", { ...key, status: "QUALIFIED" });
    await run(sdk.scheduleLeadFollowUp, "manager-a", { ...key, followUpAt: due, followUpNote: "Local manager scheduled follow-up" });
    const scheduled = await run(sdk.getLead, "manager-a", key);
    assert.equal(scheduled.lead.status, "QUALIFIED");
    assert.equal(uuid(scheduled.lead.assignedMembershipId), uuid(f.memberManagerA));
    assert.equal(new Date(scheduled.lead.followUpAt).getTime(), new Date(due).getTime());
    assert.equal(scheduled.lead.followUpNote, "Local manager scheduled follow-up");
    await run(sdk.completeLeadFollowUp, "manager-a", key);
    const completed = await run(sdk.getLead, "manager-a", key);
    assert.equal(completed.lead.followUpAt ?? null, null);
    assert.equal(completed.lead.followUpNote ?? null, null);
    await forbidden(sdk.completeLeadFollowUp, "manager-a", key);
    const timeline = await run(sdk.listLeadActivities, "manager-a", key);
    assert.deepEqual(new Set(timeline.activities.map(event => event.kind)), new Set([
      "LEAD_CREATED", "LEAD_NOTE_ADDED", "LEAD_STATUS_CHANGED", "FOLLOW_UP_SCHEDULED", "FOLLOW_UP_COMPLETED",
    ]));
    assert.equal(timeline.activities.length, 5);
    const note = timeline.activities.find(event => event.kind === "LEAD_NOTE_ADDED");
    assert.equal(note.note, "Local manager private workflow note");
    assert.ok(timeline.activities.every(event => uuid(event.organizationId ?? f.orgA) === uuid(f.orgA) && uuid(event.leadId) === uuid(key.leadId)));
    assert.ok(timeline.activities.filter(event => event.kind !== "LEAD_CREATED").every(event => event.actorUid === "manager-a"));
    const pageOne = await run(sdk.listLeadActivities, "manager-a", { ...key, limit: 2, offset: 0 });
    const pageTwo = await run(sdk.listLeadActivities, "manager-a", { ...key, limit: 2, offset: 2 });
    const pastLast = await run(sdk.listLeadActivities, "manager-a", { ...key, limit: 2, offset: 5 });
    assert.equal(pageOne.total[0].count, 5);
    assert.equal(pageTwo.total[0].count, 5);
    assert.equal(new Set([...pageOne.activities, ...pageTwo.activities].map(event => uuid(event.id))).size, 4);
    assert.equal(pastLast.activities.length, 0);
    assert.equal(pastLast.total[0].count, 5);
    // Reassignment removes the previous assignee's access to contact data and notes.
    await forbidden(sdk.getLead, "agent-a", key);
    await forbidden(sdk.listLeadActivities, "agent-a", key);
    await run(sdk.assignLead, "manager-a", {...key,assignedMembershipId:f.memberSharedA,reason:"Manager coverage reassignment"});
    await forbidden(sdk.getLead, "manager-a", key);
    assert.equal((await run(sdk.listLeadActivities, "shared-agent", key)).activities.length, 6);
  });

  it("permits an agent to annotate and follow up only their currently assigned lead", async () => {
    const created = await run(sdk.createLead, "agent-a", {
      organizationId: f.orgA, fullName: "Local Agent Workflow Probe", assignedMembershipId: f.memberAgentA,
    });
    const key = { organizationId: f.orgA, leadId: created.lead.id };
    await run(sdk.addLeadNote, "agent-a", { ...key, note: "Local agent note" });
    await run(sdk.changeLeadStatus, "agent-a", { ...key, status: "CONTACTED" });
    await run(sdk.scheduleLeadFollowUp, "agent-a", { ...key, followUpAt: new Date(Date.now() + 86400000).toISOString() });
    await run(sdk.completeLeadFollowUp, "agent-a", key);
    await forbidden(sdk.assignLead, "agent-a", { ...key, assignedMembershipId: f.memberSharedA });
    await forbidden(sdk.assignLead, "agent-a", { ...key, assignedMembershipId: f.memberAgentA });
    const timeline = await run(sdk.listLeadActivities, "agent-a", key);
    assert.equal(timeline.activities.length, 5);
    assert.ok(timeline.activities.every(event => event.actorUid === "agent-a"));
  });

  it("persists real contact edits and explicit clearing without overwriting a scheduled follow-up", async () => {
    const created = await run(sdk.createLead, "owner-a", {
      organizationId: f.orgA, fullName: "Local Contact Edit Probe", email: "local-edit@example.test",
      phone: "+971 50 100 0099", source: "Local source", branchId: f.branchA, assignedMembershipId: f.memberAgentA,
    });
    const key = { organizationId: f.orgA, leadId: created.lead.id };
    const initial = await run(sdk.getLead, "owner-a", key);
    const due = new Date(Date.now() + 86400000).toISOString();
    await run(sdk.scheduleLeadFollowUp, "owner-a", { ...key, followUpAt: due, followUpNote: "Preserve this schedule" });
    await run(sdk.updateLead, "owner-a", {
      ...key, fullName: "Local Updated Contact", status: "CONTACTED", email: null, phone: null, source: null,
      branchId: null, assignedMembershipId: null,
    });
    const updated = await run(sdk.getLead, "owner-a", key);
    assert.equal(updated.lead.fullName, "Local Updated Contact");
    assert.equal(updated.lead.status, "CONTACTED");
    for (const field of ["email", "phone", "source", "branchId", "assignedMembershipId"]) assert.equal(updated.lead[field] ?? null, null);
    assert.equal(updated.lead.createdAt, initial.lead.createdAt);
    assert.equal(new Date(updated.lead.followUpAt).getTime(), new Date(due).getTime());
    assert.equal(updated.lead.followUpNote, "Preserve this schedule");
    assert.equal(updated.lead.updatedByUid, "owner-a");
    await forbidden(sdk.getLead, "agent-a", key);
  });

  it("replaces a follow-up and clears an omitted prior note while retaining both timeline events", async () => {
    const created = await run(sdk.createLead, "owner-a", { organizationId: f.orgA, fullName: "Local Reschedule Probe" });
    const key = { organizationId: f.orgA, leadId: created.lead.id };
    const firstDue = new Date(Date.now() + 86400000).toISOString();
    const secondDue = new Date(Date.now() + 2 * 86400000).toISOString();
    await run(sdk.scheduleLeadFollowUp, "owner-a", { ...key, followUpAt: firstDue, followUpNote: "Previous schedule note" });
    await run(sdk.scheduleLeadFollowUp, "owner-a", { ...key, followUpAt: secondDue });
    const updated = await run(sdk.getLead, "owner-a", key);
    assert.equal(new Date(updated.lead.followUpAt).getTime(), new Date(secondDue).getTime());
    assert.equal(updated.lead.followUpNote ?? null, null);
    const timeline = await run(sdk.listLeadActivities, "owner-a", key);
    const schedules = timeline.activities.filter(event => event.kind === "FOLLOW_UP_SCHEDULED");
    assert.equal(schedules.length, 2);
    assert.ok(schedules.some(event => event.note === "Previous schedule note"));
    assert.ok(schedules.some(event => event.note == null));
    assert.deepEqual(new Set(schedules.map(event => new Date(event.metadata.followUpAt).getTime())),
      new Set([new Date(firstDue).getTime(), new Date(secondDue).getTime()]));
  });

  for (const [label, assignedMembershipId] of [
    ["pending", f.memberPendingA], ["suspended", f.memberSuspendedA], ["revoked", f.memberRevokedA],
    ["foreign-company", "21000000-0000-4000-8000-000000000002"], ["nonexistent", "99000000-0000-4000-8000-000000000001"],
  ]) {
    it(`rejects ${label} lead assignees without changing the record or creating an activity`, async () => {
      const key = { organizationId: f.orgA, leadId: f.leadA };
      const before = await run(sdk.getLead, "owner-a", key);
      const eventsBefore = await run(sdk.listLeadActivities, "owner-a", key);
      await forbidden(sdk.assignLead, "owner-a", { ...key, assignedMembershipId });
      await forbidden(sdk.updateLead, "owner-a", { ...key, fullName: "Rejected Invalid Assignee", status: "NEW", assignedMembershipId });
      const after = await run(sdk.getLead, "owner-a", key);
      assert.deepEqual(after, before);
      assert.deepEqual(await run(sdk.listLeadActivities, "owner-a", key), eventsBefore);
    });
  }

  it("rejects unknown status values at the actual stored-operation boundary", async () => {
    const key = { organizationId: f.orgA, leadId: f.leadA };
    const before = await run(sdk.getLead, "owner-a", key);
    const timelineBefore = await run(sdk.listLeadActivities, "owner-a", key);
    for (const status of ["ADMIN", "won", "ARCHIVED", ""]) {
      await forbidden(sdk.changeLeadStatus, "owner-a", { ...key, status });
      await forbidden(sdk.updateLead, "owner-a", { ...key, fullName: "Rejected Invalid Status", status, assignedMembershipId: f.memberAgentA });
    }
    assert.deepEqual(await run(sdk.getLead, "owner-a", key), before);
    assert.deepEqual(await run(sdk.listLeadActivities, "owner-a", key), timelineBefore);
  });

  it("rejects empty/oversized notes and invalid follow-up dates without success events", async () => {
    const key = { organizationId: f.orgA, leadId: f.leadA };
    const timelineBefore = await run(sdk.listLeadActivities, "owner-a", key);
    for (const note of ["", "x".repeat(4001)]) await forbidden(sdk.addLeadNote, "owner-a", { ...key, note });
    for (const followUpAt of ["2020-01-01T00:00:00Z", new Date(Date.now() + 367 * 86400000).toISOString(), "not-a-timestamp"]) {
      await forbidden(sdk.scheduleLeadFollowUp, "owner-a", { ...key, followUpAt });
    }
    assert.deepEqual(await run(sdk.listLeadActivities, "owner-a", key), timelineBefore);
  });

  it("limits assignee choices to active registered members of the permitted organization", async () => {
    const incompleteMemberId = randomUUID();
    await dc.insert("membership", {
      organizationId: f.orgA, id: incompleteMemberId, email: `local-unregistered-${randomUUID()}@example.test`,
      role: "AGENT", status: "ACTIVE",
    });
    await forbidden(sdk.assignLead, "owner-a", { organizationId: f.orgA, leadId: f.leadA, assignedMembershipId: incompleteMemberId });
    const manager = await run(sdk.listLeadAssignees, "manager-a", { organizationId: f.orgA });
    const managerAssigneeIds = new Set(manager.memberships.map(member=>uuid(member.id)));
    assert.ok(managerAssigneeIds.has(uuid(f.memberAgentA)));
    assert.ok(managerAssigneeIds.has(uuid(f.memberSharedA)));
    assert.ok(manager.memberships.every(member=>member.role === "AGENT" && member.userProfile?.uid));
    const administrators = await run(sdk.listLeadAssignees, "owner-a", {organizationId:f.orgA});
    const ids = administrators.memberships.map(member => uuid(member.id));
    assert.ok(ids.includes(uuid(f.memberAgentA)));
    assert.ok(ids.includes(uuid(f.memberSharedA)));
    for (const id of [f.memberPendingA, f.memberSuspendedA, f.memberRevokedA, f.memberInvitedA, incompleteMemberId, "21000000-0000-4000-8000-000000000002"]) {
      assert.ok(!ids.includes(uuid(id)));
    }
    assert.ok(manager.memberships.every(member => member.userProfile?.uid));
    const agent = await run(sdk.listLeadAssignees, "agent-a", { organizationId: f.orgA });
    assert.deepEqual(agent.memberships.map(member => uuid(member.id)), [uuid(f.memberAgentA)]);
    await forbidden(sdk.listLeadAssignees, "owner-b", { organizationId: f.orgA });
  });

  it("applies search, filters, counts and stable pagination to actual authorized SQL records", async () => {
    const marker = `Local SQL Search ${randomUUID()}`;
    const expected = [];
    for (let index = 0; index < 5; index++) {
      const created = await run(sdk.createLead, "owner-a", {
        organizationId: f.orgA, fullName: `${marker} ${index}`, email: `local-search-${index}@example.test`,
        phone: `+971 50 100 00${index}`, source: "Local integration search", branchId: f.branchA,
        assignedMembershipId: index < 4 ? f.memberAgentA : f.memberSharedA,
      });
      if (index < 4) {
        await run(sdk.changeLeadStatus, "owner-a", { organizationId: f.orgA, leadId: created.lead.id, status: "CONTACTED" });
        await run(sdk.scheduleLeadFollowUp, "owner-a", { organizationId: f.orgA, leadId: created.lead.id, followUpAt: new Date(Date.now() + 2 * 86400000).toISOString() });
        expected.push(uuid(created.lead.id));
      }
    }
    const filters = {
      organizationId: f.orgA, search: `%${marker}%`, status: "CONTACTED", assignedMembershipId: f.memberAgentA,
      branchId: f.branchA, followUpAfter: new Date(Date.now() + 86400000).toISOString(),
      followUpBefore: new Date(Date.now() + 3 * 86400000).toISOString(), limit: 2,
    };
    const first = await run(sdk.listLeads, "owner-a", { ...filters, offset: 0 });
    const repeated = await run(sdk.listLeads, "owner-a", { ...filters, offset: 0 });
    const second = await run(sdk.listLeads, "owner-a", { ...filters, offset: 2 });
    const pastLast = await run(sdk.listLeads, "owner-a", { ...filters, offset: 4 });
    assert.deepEqual(repeated, first);
    assert.equal(first.total[0].count, 4);
    assert.equal(second.total[0].count, 4);
    assert.equal(first.leads.length, 2);
    assert.equal(second.leads.length, 2);
    assert.equal(pastLast.leads.length, 0);
    assert.equal(pastLast.total[0].count, 4);
    assert.deepEqual(new Set([...first.leads, ...second.leads].map(lead => uuid(lead.id))), new Set(expected));
    const agent = await run(sdk.listLeads, "agent-a", { organizationId: f.orgA, search: `%${marker}%` });
    assert.equal(agent.leads.length, 4);
    assert.equal(agent.total[0].count, 4);
    const shared = await run(sdk.listLeads, "shared-agent", { organizationId: f.orgA, search: `%${marker}%`, assignedMembershipId: f.memberAgentA });
    assert.equal(shared.leads.length, 0);
    assert.equal(shared.total[0].count, 0);
    const email = await run(sdk.listLeads, "owner-a", { organizationId: f.orgA, search: "%local-search-4@example.test%" });
    assert.equal(email.leads.length, 1);
    const phone = await run(sdk.listLeads, "owner-a", { organizationId: f.orgA, search: "%+971 50 100 004%" });
    assert.equal(phone.leads.length, 1);
    const otherCompany = await run(sdk.listLeads, "owner-b", { organizationId: f.orgB, search: `%${marker}%` });
    assert.equal(otherCompany.total[0].count, 0);
    assert.equal(otherCompany.leads.length, 0);
    const caseInsensitive = await run(sdk.listLeads, "owner-a", { organizationId: f.orgA, search: `%${marker.toLowerCase()}%` });
    assert.equal(caseInsensitive.leads.length, 5);
    assert.equal(caseInsensitive.total[0].count, 5);
    const unfiltered = await run(sdk.listLeads, "owner-a", { organizationId: f.orgA, limit: 100 });
    assert.ok(unfiltered.leads.length >= 5);
    assert.ok(unfiltered.total[0].count >= unfiltered.leads.length);
    assert.ok(unfiltered.leads.every(lead => uuid(lead.organizationId) === uuid(f.orgA)));
  });

  it("treats escaped user search wildcards literally in the SQL stored query", async () => {
    const marker = `Local Wildcard ${randomUUID()}`;
    const literal = await run(sdk.createLead, "owner-a", { organizationId: f.orgA, fullName: `${marker} 50%_ literal` });
    await run(sdk.createLead, "owner-a", { organizationId: f.orgA, fullName: `${marker} 50zz literal` });
    const result = await run(sdk.listLeads, "owner-a", { organizationId: f.orgA, search: `%${marker} 50\\%\\_ literal%` });
    assert.deepEqual(result.leads.map(lead => uuid(lead.id)), [uuid(literal.lead.id)]);
    assert.equal(result.total[0].count, 1);
  });

  it("keeps identical lead UUIDs in different companies isolated through detail, writes and notes", async () => {
    // Composite keys deliberately permit the same bare UUID in two tenants.
    await dc.insert("lead", {
      organizationId: f.orgA, id: f.leadB, fullName: "Local Company A UUID Collision Probe",
      assignedMembershipId: f.memberAgentA, createdByUid: "owner-a", updatedByUid: "owner-a",
    });
    const keyA = { organizationId: f.orgA, leadId: f.leadB };
    const keyB = { organizationId: f.orgB, leadId: f.leadB };
    const beforeB = await run(sdk.getLead, "owner-b", keyB);
    const timelineBeforeB = await run(sdk.listLeadActivities, "owner-b", keyB);
    const detailA = await run(sdk.getLead, "owner-a", keyA);
    assert.equal(detailA.lead.fullName, "Local Company A UUID Collision Probe");
    assert.equal(uuid(detailA.lead.organizationId), uuid(f.orgA));
    await run(sdk.changeLeadStatus, "owner-a", { ...keyA, status: "QUALIFIED" });
    await run(sdk.addLeadNote, "owner-a", { ...keyA, note: "Private company A collision note" });
    assert.deepEqual(await run(sdk.getLead, "owner-b", keyB), beforeB);
    assert.deepEqual(await run(sdk.listLeadActivities, "owner-b", keyB), timelineBeforeB);
    const timelineA = await run(sdk.listLeadActivities, "agent-a", keyA);
    assert.equal(timelineA.activities.length, 2);
    assert.ok(timelineA.activities.some(event => event.note === "Private company A collision note"));
    await forbidden(sdk.getLead, "owner-a", keyB);
    await forbidden(sdk.listLeadActivities, "owner-a", keyB);
  });

  for (const [name, operation, variables] of [
    ...leadOperationCases(f.orgA, f.leadA).filter(([name]) => !["read", "edit"].includes(name)),
    ["assignee choices", sdk.listLeadAssignees, { organizationId: f.orgA }],
  ]) {
    it(`rejects anonymous lead ${name} operations`, async () => { await forbidden(operation, null, variables); });
    it(`rejects unverified lead ${name} operations`, async () => { await forbidden(operation, "owner-a", variables, { email_verified: false }); });
  }

  describe("Phase 3A invitations and independent audit foundation", { concurrency: false }, () => {
    before(async () => { await seedLocalDatabase(dc); });

    async function invitedMember(role = "AGENT") {
      const uid = `phase3-${randomUUID()}`;
      const tokenHash = randomUUID().replaceAll("-", "") + randomUUID().replaceAll("-", "");
      await run(sdk.upsertMyProfile, uid, { displayName: "Local Phase 3 Member" });
      const result = await run(sdk.inviteMembership, "owner-a", {
        organizationId: f.orgA, email: `${uid}@example.test`, role, tokenHash,
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
      });
      return { uid, tokenHash, membershipId: result.membership.id, invitationId: result.invitation.id };
    }

    async function activeMember(role = "AGENT") {
      const member = await invitedMember(role);
      await run(sdk.acceptInvitation, member.uid, { organizationId: f.orgA, membershipId: member.membershipId, tokenHash: member.tokenHash });

      return member;
    }

    for (const [label, operation] of [["audit", sdk.listAuditLogs], ["invitation", sdk.listInvitations]]) {
      for (const uid of [null, "agent-a", "manager-a", "owner-b", "outsider", "removed-user"]) {
        it(`denies company A ${label} access to ${uid ?? "anonymous"}`, async () => {
          await forbidden(operation, uid, { organizationId: f.orgA });
        });
      }
      it(`denies unverified ${label} access despite owner membership`, async () => {
        await forbidden(operation, "owner-a", { organizationId: f.orgA }, { email_verified: false });
      });
    }

    it("creates the company, fixed owner, selection and independent audit event atomically", async () => {
      const uid = `phase3-owner-${randomUUID()}`;
      await run(sdk.upsertMyProfile, uid, { displayName: "Local Phase 3 Owner" });
      const result = await run(sdk.createOrganization, uid, { name: "Phase 3 Local Company", slug: `phase3-${randomUUID()}` });
      const organizationId = result.organization.id;
      const context = await run(sdk.getOrganizationContext, uid, { organizationId });
      assert.equal(context.ownMembership.userProfileUid, uid);
      assert.equal(context.ownMembership.role, "OWNER");
      assert.equal(context.ownMembership.status, "ACTIVE");
      const audit = await run(sdk.listAuditLogs, uid, { organizationId });
      assert.equal(audit.auditLogs.length, 1);
      assert.equal(audit.auditLogs[0].actorUid, uid);
      assert.equal(audit.auditLogs[0].action, "ORGANIZATION_CREATED");
      assert.equal(audit.auditLogs[0].targetType, "ORGANIZATION");
      assert.equal(uuid(audit.auditLogs[0].targetId), uuid(organizationId));
    });

    it("rolls back earlier company/owner/profile/timeline writes when the final audit FK fails", async () => {
      const source = await readFile(new URL("../dataconnect/connector/mutations.gql", import.meta.url), "utf8");
      const start = source.indexOf("mutation CreateOrganization(");
      const end = source.indexOf("\nmutation ", start + 1);
      const original = source.slice(start, end);
      // Emulator-only fault probe derived from the real operation. No fault
      // parameter or unrestricted mutation is added to the deployed connector.
      const probe = original.replace("mutation CreateOrganization(", "mutation RollbackCompanyProbe(").replace(
        'auditLog_insert(data: { organizationId_expr: "response.organization.id", actorUid_expr: "auth.uid"',
        'auditLog_insert(data: { organizationId_expr: "response.organization.id", actorUid: "missing-phase3-audit-actor"',
      );
      assert.notEqual(probe, original);
      assert.ok(probe.includes('actorUid: "missing-phase3-audit-actor"'));
      const slug = `rollback-${randomUUID()}`;
      const before = await run(sdk.getMyProfile, "owner-a");
      await assert.rejects(() => dc.executeGraphql(probe, {
        ...options("owner-a"), operationName: "RollbackCompanyProbe", variables: { name: "Rejected Local Company", slug },
      }), /foreign key|violates.*constraint/i);
      const result = await dc.executeGraphql(`query Probe($slug: String!) {
        organizations(where: { slug: { eq: $slug } }) { id }
        memberships(where: { organization: { slug: { eq: $slug } } }) { id }
        activities(where: { organization: { slug: { eq: $slug } } }) { id }
        auditLogs(where: { organization: { slug: { eq: $slug } } }) { id }
      }`, { variables: { slug } });
      assert.deepEqual(result.data, { organizations: [], memberships: [], activities: [], auditLogs: [] });
      assert.deepEqual(await run(sdk.getMyProfile, "owner-a"), before);
    });

    it("a concurrent duplicate slug creates exactly one owner and one audit record", async () => {
      const uids = [`slug-a-${randomUUID()}`, `slug-b-${randomUUID()}`];
      for (const uid of uids) await run(sdk.upsertMyProfile, uid, { displayName: "Local Slug Owner" });
      const slug = `race-${randomUUID()}`;
      const attempts = await Promise.allSettled(uids.map(uid => run(sdk.createOrganization, uid, { name: "Local Concurrent Company", slug })));
      assert.equal(attempts.filter(item => item.status === "fulfilled").length, 1);
      assert.equal(attempts.filter(item => item.status === "rejected").length, 1);
      const winnerIndex = attempts.findIndex(item => item.status === "fulfilled");
      const organizationId = attempts[winnerIndex].value.organization.id;
      const owners = await run(sdk.listMemberships, uids[winnerIndex], { organizationId });
      assert.equal(owners.memberships.length, 1);
      assert.equal((await run(sdk.listAuditLogs, uids[winnerIndex], { organizationId })).auditLogs.length, 1);
      assert.equal((await run(sdk.getMyProfile, uids[1 - winnerIndex])).userProfile.activeOrganizationId, null);
    });

    it("invitation records never return their digest and are consumed only once", async () => {
      const member = await invitedMember();
      const list = await run(sdk.listInvitations, "owner-a", { organizationId: f.orgA, limit: 100 });
      const invitation = list.invitations.find(row => uuid(row.id) === uuid(member.invitationId));
      assert.equal(invitation.status, "PENDING");
      assert.ok(!("tokenHash" in invitation));
      const variables = { organizationId: f.orgA, membershipId: member.membershipId, tokenHash: member.tokenHash };
      const results = await Promise.allSettled([run(sdk.acceptInvitation, member.uid, variables), run(sdk.acceptInvitation, member.uid, variables)]);
      assert.equal(results.filter(result => result.status === "fulfilled").length, 1);
      await forbidden(sdk.acceptInvitation, member.uid, variables);
      const after = await run(sdk.listInvitations, "owner-a", { organizationId: f.orgA, limit: 100 });
      assert.equal(after.invitations.find(row => uuid(row.id) === uuid(member.invitationId)).status, "ACCEPTED");
      const audit = await run(sdk.listAuditLogs, "owner-a", { organizationId: f.orgA, limit: 100 });
      assert.equal(audit.auditLogs.filter(row => row.action === "INVITATION_ACCEPTED" && uuid(row.targetId) === uuid(member.membershipId)).length, 1);
      assert.ok(!JSON.stringify(audit).includes(member.tokenHash));
    });

    it("expired invitation rows cannot be accepted or consume a membership", async () => {
      const member = await invitedMember();
      await dc.executeGraphql('mutation Expire($organizationId: UUID!, $id: UUID!) { invitation_update(key: {organizationId: $organizationId, id: $id}, data: {expiresAt: "2020-01-01T00:00:00Z"}) }', {
        variables: { organizationId: f.orgA, id: member.invitationId },
      });
      await forbidden(sdk.acceptInvitation, member.uid, { organizationId: f.orgA, membershipId: member.membershipId, tokenHash: member.tokenHash });
      const list = await run(sdk.listMemberships, "owner-a", { organizationId: f.orgA });
      assert.equal(list.memberships.find(row => uuid(row.id) === uuid(member.membershipId)).status, "INVITED");
    });

    it("removing an invitation membership revokes its separate invitation", async () => {
      const member = await invitedMember();
      await run(sdk.setMembershipStatus, "owner-a", { organizationId: f.orgA, membershipId: member.membershipId, status: "REMOVED" });
      await forbidden(sdk.acceptInvitation, member.uid, { organizationId: f.orgA, membershipId: member.membershipId, tokenHash: member.tokenHash });
      const list = await run(sdk.listInvitations, "owner-a", { organizationId: f.orgA, limit: 100 });
      assert.equal(list.invitations.find(row => uuid(row.id) === uuid(member.invitationId)).status, "REVOKED");
    });

    it("legacy membership digests alone cannot authorize acceptance", async () => {
      const uid = `legacy-${randomUUID()}`;
      const membershipId = randomUUID();
      const tokenHash = "f".repeat(64);
      await run(sdk.upsertMyProfile, uid, { displayName: "Local Legacy Invite" });
      await dc.insert("membership", { organizationId: f.orgA, id: membershipId, email: `${uid}@example.test`, role: "AGENT", status: "INVITED", invitationTokenHash: tokenHash, invitationExpiresAt: new Date(Date.now() + 3600000).toISOString() });
      await forbidden(sdk.acceptInvitation, uid, { organizationId: f.orgA, membershipId, tokenHash });
    });

    it("agents cannot promote themselves and rejected writes add no audit records", async () => {
      const before = await run(sdk.listAuditLogs, "owner-a", { organizationId: f.orgA, limit: 100 });
      await forbidden(sdk.setMembershipRole, "agent-a", { organizationId: f.orgA, membershipId: f.memberAgentA, role: "ADMIN" }, { role: "OWNER" });
      await forbidden(sdk.setMembershipRole, "owner-a", { organizationId: f.orgA, membershipId: f.memberAgentA, role: "OWNER" });
      assert.deepEqual(await run(sdk.listAuditLogs, "owner-a", { organizationId: f.orgA, limit: 100 }), before);
      assert.equal((await run(sdk.getOrganizationContext, "agent-a", { organizationId: f.orgA })).ownMembership.role, "AGENT");
    });

    it("authorized lower-role changes are audited while admin peers and foreign companies remain protected", async () => {
      const member = await activeMember();
      await run(sdk.setMembershipRole, "admin-a", { organizationId: f.orgA, membershipId: member.membershipId, role: "MANAGER" });
      assert.equal((await run(sdk.getOrganizationContext, member.uid, { organizationId: f.orgA })).ownMembership.role, "MANAGER");
      await forbidden(sdk.setMembershipRole, "admin-a", { organizationId: f.orgA, membershipId: member.membershipId, role: "ADMIN" });
      await run(sdk.setMembershipRole, "owner-a", { organizationId: f.orgA, membershipId: member.membershipId, role: "ADMIN" });
      await forbidden(sdk.setMembershipRole, "admin-a", { organizationId: f.orgA, membershipId: member.membershipId, role: "AGENT" });
      await forbidden(sdk.setMembershipRole, "owner-b", { organizationId: f.orgA, membershipId: member.membershipId, role: "AGENT" });
      const audit = await run(sdk.listAuditLogs, "owner-a", { organizationId: f.orgA, limit: 100 });
      assert.equal(audit.auditLogs.filter(row => row.action === "MEMBERSHIP_ROLE_CHANGED" && uuid(row.targetId) === uuid(member.membershipId)).length, 2);
    });

    it("removal immediately blocks company switching and current membership access", async () => {
      const member = await activeMember();
      await run(sdk.switchOrganization, member.uid, { organizationId: f.orgA });
      await run(sdk.setMembershipStatus, "owner-a", { organizationId: f.orgA, membershipId: member.membershipId, status: "REMOVED" });
      await forbidden(sdk.getOrganizationContext, member.uid, { organizationId: f.orgA });
      await forbidden(sdk.switchOrganization, member.uid, { organizationId: f.orgA });
      await forbidden(sdk.listBranches, member.uid, { organizationId: f.orgA });
      const mine = await run(sdk.listMyOrganizations, member.uid);
      assert.equal(mine.memberships.length, 0);
    });

    it("concurrent owner promotion and administrator removal cannot modify a newly protected peer", async () => {
      const member = await activeMember();
      const attempts = await Promise.allSettled([
        run(sdk.setMembershipRole, "owner-a", { organizationId: f.orgA, membershipId: member.membershipId, role: "ADMIN" }),
        run(sdk.setMembershipStatus, "admin-a", { organizationId: f.orgA, membershipId: member.membershipId, status: "REMOVED" }),
      ]);
      assert.equal(attempts.filter(result => result.status === "fulfilled").length, 1);
      const members = await run(sdk.listMemberships, "owner-a", { organizationId: f.orgA });
      const target = members.memberships.find(row => uuid(row.id) === uuid(member.membershipId));
      assert.ok(target.role !== "ADMIN" || target.status === "ACTIVE");
    });

    it("the last active owner cannot be removed, suspended or demoted, even concurrently", async () => {
      const before = await run(sdk.listAuditLogs, "owner-a", { organizationId: f.orgA, limit: 100 });
      const results = await Promise.allSettled([
        run(sdk.setMembershipStatus, "owner-a", { organizationId: f.orgA, membershipId: f.memberOwnerA, status: "REMOVED" }),
        run(sdk.setMembershipStatus, "admin-a", { organizationId: f.orgA, membershipId: f.memberOwnerA, status: "SUSPENDED" }),
        run(sdk.setMembershipRole, "admin-a", { organizationId: f.orgA, membershipId: f.memberOwnerA, role: "AGENT" }),
      ]);
      assert.ok(results.every(result => result.status === "rejected"));
      assert.equal((await run(sdk.getOrganizationContext, "owner-a", { organizationId: f.orgA })).ownMembership.role, "OWNER");
      assert.deepEqual(await run(sdk.listAuditLogs, "owner-a", { organizationId: f.orgA, limit: 100 }), before);
    });

    it("database keys prevent duplicate user membership and foreign invitation links", async () => {
      await assert.rejects(() => dc.insert("membership", { organizationId: f.orgA, id: randomUUID(), userProfileUid: "agent-a", email: "another-email@example.test", role: "AGENT", status: "ACTIVE" }));
      await assert.rejects(() => dc.insert("invitation", { organizationId: f.orgB, id: randomUUID(), membershipId: f.memberAgentA, email: "local-invalid@example.test", role: "AGENT", tokenHash: "1".repeat(64), invitedByUid: "owner-b", expiresAt: new Date(Date.now() + 3600000).toISOString() }));
    });

    it("lead notes remain separate from security audit metadata", async () => {
      const note = "Tenant-private note must not enter audit metadata";
      await run(sdk.addLeadNote, "agent-a", { organizationId: f.orgA, leadId: f.leadA, note });
      const audit = await run(sdk.listAuditLogs, "owner-a", { organizationId: f.orgA, limit: 100 });
      assert.ok(audit.auditLogs.some(row => row.action === "LEAD_NOTE_ADDED" && row.actorUid === "agent-a"));
      assert.ok(!JSON.stringify(audit).includes(note));
    });
  });

  describe("company onboarding and settings", { concurrency: false }, () => {
    before(async () => { await seedLocalDatabase(dc); });
    const details = { name: "Onboarded Agency", slug: "onboarded-agency", emirate: "DUBAI", contactPhone: "+971 50 123 4567", companyEmail: "company@example.test", companySize: "TWO_TO_TEN" };

    it("persists company details with a fixed active owner and authorized selection", async () => {
      const uid = "onboarded-user";
      await run(sdk.upsertMyProfile, uid, { displayName: "New Owner" });
      const result = await run(sdk.createOrganization, uid, details);
      const id = result.organization.id;
      const context = await run(sdk.getOrganizationContext, uid, { organizationId: id });
      for (const key of Object.keys(details)) assert.equal(context.organization[key], details[key]);
      assert.equal(context.ownMembership.role, "OWNER");
      assert.equal(context.ownMembership.status, "ACTIVE");
      assert.equal(context.ownMembership.userProfileUid, uid);
      assert.equal(uuid((await run(sdk.getMyProfile, uid)).userProfile.activeOrganizationId), uuid(id));
      await forbidden(sdk.getOrganizationContext, "owner-a", { organizationId: id });
      const audit = await run(sdk.listAuditLogs, uid, { organizationId: id });
      assert.equal(audit.auditLogs[0].action, "ORGANIZATION_CREATED");
    });

    it("keeps legacy companies readable with missing optional company details", async () => {
      const result = await run(sdk.getOrganizationContext, "agent-a", { organizationId: f.orgA });
      assert.equal(result.organization.emirate, null);
      assert.equal(result.organization.companyEmail, null);
    });

    it("allows owners and administrators to update their company with transactional audit", async () => {
      for (const uid of ["owner-a", "admin-a"]) {
        const input = { ...details, slug: "updated-agency-a", name: uid + " Agency", organizationId: f.orgA };
        await run(sdk.updateOrganization, uid, input);
        const result = await run(sdk.getOrganizationContext, "agent-a", { organizationId: f.orgA });
        assert.equal(result.organization.name, input.name);
        assert.equal(result.organization.companySize, "TWO_TO_TEN");
        const audit = await run(sdk.listAuditLogs, "owner-a", { organizationId: f.orgA });
        assert.ok(audit.auditLogs.some(row => row.action === "ORGANIZATION_UPDATED" && row.actorUid === uid));
        assert.ok(!JSON.stringify(audit).includes(details.contactPhone));
        assert.ok(!JSON.stringify(audit).includes(details.companyEmail));
      }
    });

    for (const uid of [null, "agent-a", "manager-a", "owner-b", "outsider", "suspended-user", "removed-user"]) {
      it("denies company settings changes by " + uid, async () => {
        const before = await run(sdk.getOrganizationContext, "owner-a", { organizationId: f.orgA });
        const audit = await run(sdk.listAuditLogs, "owner-a", { organizationId: f.orgA });
        await forbidden(sdk.updateOrganization, uid, { ...details, slug: "not-authorized", organizationId: f.orgA }, { role: "OWNER" });
        assert.deepEqual(await run(sdk.getOrganizationContext, "owner-a", { organizationId: f.orgA }), before);
        assert.deepEqual(await run(sdk.listAuditLogs, "owner-a", { organizationId: f.orgA }), audit);
      });
    }

    it("rejects unverified updates and invalid company details at the connector", async () => {
      await forbidden(sdk.updateOrganization, "owner-a", { ...details, organizationId: f.orgA }, { email_verified: false });
      for (const changed of [{ contactPhone: "bad" }, { companyEmail: "bad" }, { emirate: "UNKNOWN" }, { companySize: "UNKNOWN" }, { slug: "a/b" }]) {
        await forbidden(sdk.updateOrganization, "owner-a", { ...details, organizationId: f.orgA, ...changed });
      }
    });

    it("duplicate settings slugs roll back edits and audit writes", async () => {
      const orgB = await run(sdk.getOrganizationContext, "owner-b", { organizationId: f.orgB });
      const before = await run(sdk.getOrganizationContext, "owner-a", { organizationId: f.orgA });
      const audit = await run(sdk.listAuditLogs, "owner-a", { organizationId: f.orgA });
      await forbidden(sdk.updateOrganization, "owner-a", { ...details, slug: orgB.organization.slug, organizationId: f.orgA });
      assert.deepEqual(await run(sdk.getOrganizationContext, "owner-a", { organizationId: f.orgA }), before);
      assert.deepEqual(await run(sdk.listAuditLogs, "owner-a", { organizationId: f.orgA }), audit);
    });

    it("company switching checks membership and never follows forged role claims", async () => {
      for (const organizationId of [f.orgA, f.orgB]) {
        await run(sdk.switchOrganization, "shared-agent", { organizationId });
        const selection = await run(sdk.getMyProfile, "shared-agent");
        assert.equal(uuid(selection.userProfile.activeOrganizationId), uuid(organizationId));
        assert.equal((await run(sdk.getOrganizationContext, "shared-agent", { organizationId })).ownMembership.role, "AGENT");
      }
      await forbidden(sdk.switchOrganization, "owner-a", { organizationId: f.orgB }, { role: "OWNER" });
      await forbidden(sdk.updateOrganization, "shared-agent", { ...details, organizationId: f.orgB });
      for (const variables of [{ offset: -1 }, { limit: 101 }, { offset: 10001 }]) await forbidden(sdk.listMyOrganizations, "shared-agent", variables);
      const page = await run(sdk.listMyOrganizations, "shared-agent", { limit: 1, offset: 1 });
      assert.equal(page.memberships.length, 1);
    });
  });

  describe("team management and secure invitations", { concurrency: false }, () => {
    before(async () => { await seedLocalDatabase(dc); });
    const newHash = () => randomUUID().replaceAll("-", "") + randomUUID().replaceAll("-", "");
    async function issue(creator = "owner-a", role = "AGENT", withProfile = true) {
      const uid = "team-" + randomUUID();
      const email = uid + "@example.test";
      const tokenHash = newHash();
      if (withProfile) await run(sdk.upsertMyProfile, uid, { displayName: "Local Team Member" });
      const created = await run(sdk.inviteMembership, creator, { organizationId: f.orgA, email, role, tokenHash, expiresAt: new Date(Date.now() + 3600000).toISOString() });
      return { uid, email, tokenHash, membershipId: created.membership.id, invitationId: created.invitation.id };
    }
    const accept = member => run(sdk.acceptInvitation, member.uid, { organizationId: f.orgA, membershipId: member.membershipId, tokenHash: member.tokenHash });
    async function age(member, field = "updatedAt") {
      await dc.executeGraphql('mutation Age($organizationId: UUID!, $id: UUID!) { invitation_update(key: { organizationId: $organizationId, id: $id }, data: { ' + field + ': "2020-01-01T00:00:00Z" }) }', { variables: { organizationId: f.orgA, id: member.invitationId } });
    }
    async function invitation(member) {
      const result = await run(sdk.listInvitations, "owner-a", { organizationId: f.orgA, limit: 100 });
      return result.invitations.find(row => uuid(row.id) === uuid(member.invitationId));
    }

    for (const uid of [null, "agent-a", "manager-a", "owner-b", "outsider", "suspended-user", "removed-user"]) {
      it("rejects team list and count access for " + uid, async () => {
        await forbidden(sdk.listTeamMembers, uid, { organizationId: f.orgA }, { role: "OWNER" });
      });
    }
    it("search, count and pagination share the same tenant restrictions", async () => {
      const result = await run(sdk.listTeamMembers, "admin-a", { organizationId: f.orgA, search: "agent-a@example.test", limit: 1 });
      assert.equal(result.memberships.length, 1);
      assert.equal(result.memberships[0].email, "agent-a@example.test");
      assert.equal(result.total[0].count, 1);
      const next = await run(sdk.listTeamMembers, "admin-a", { organizationId: f.orgA, search: "agent-a@example.test", limit: 1, offset: 1 });
      assert.equal(next.memberships.length, 0);
      assert.equal(next.total[0].count, 1);
      for (const extra of [{ limit: 101 }, { offset: -1 }, { search: "x".repeat(243) }]) await forbidden(sdk.listTeamMembers, "owner-a", { organizationId: f.orgA, ...extra });
    });
    it("normal sign-in discovers only the verified recipient's pending invitation before a profile exists", async () => {
      const member = await issue("owner-a", "AGENT", false);
      const result = await run(sdk.getMyPendingInvitations, member.uid);
      const row = result.invitations.find(item => uuid(item.id) === uuid(member.invitationId));
      assert.ok(row);
      assert.deepEqual(Object.keys(row).sort(), ["expiresAt", "id", "organization", "role"]);
      assert.deepEqual(Object.keys(row.organization), ["name"]);
      assert.equal(row.role, "AGENT");
      assert.equal(row.organization.name, (await run(sdk.getOrganizationContext, "owner-a", { organizationId: f.orgA })).organization.name);
      assert.equal((await run(sdk.getMyProfile, member.uid)).userProfile, null);
      assert.deepEqual((await run(sdk.listMyOrganizations, member.uid)).memberships, []);
      await forbidden(sdk.getOrganizationContext, member.uid, { organizationId: f.orgA });
      for (const uid of ["owner-a", "owner-b", "agent-a", "outsider"]) {
        const other = await run(sdk.getMyPendingInvitations, uid, undefined, { role: "OWNER", organizationId: f.orgA });
        assert.ok(other.invitations.every(item => uuid(item.id) !== uuid(member.invitationId)));
      }
      await forbidden(sdk.getMyPendingInvitations, null);
      await forbidden(sdk.getMyPendingInvitations, member.uid, undefined, { email_verified: false });
      await forbidden(sdk.getMyPendingInvitations, member.uid, undefined, { firebase: { sign_in_provider: "anonymous" } });
      const uppercase = await run(sdk.getMyPendingInvitations, member.uid, undefined, { email: member.email.toUpperCase() });
      assert.ok(uppercase.invitations.some(item => uuid(item.id) === uuid(member.invitationId)));
      await accept(member);
      assert.ok((await run(sdk.getMyPendingInvitations, member.uid)).invitations.every(item => uuid(item.id) !== uuid(member.invitationId)));
      assert.equal((await run(sdk.listMyOrganizations, member.uid)).memberships[0].role, "AGENT");
    });
    it("discovery includes expired invitations for reissue guidance and excludes revoked invitations", async () => {
      const member = await issue("owner-a", "AGENT", false);
      await age(member, "expiresAt");
      assert.ok((await run(sdk.getMyPendingInvitations, member.uid)).invitations.some(item => uuid(item.id) === uuid(member.invitationId)));
      await assert.rejects(() => accept(member));
      await run(sdk.revokeInvitation, "owner-a", { organizationId: f.orgA, membershipId: member.membershipId });
      assert.ok((await run(sdk.getMyPendingInvitations, member.uid)).invitations.every(item => uuid(item.id) !== uuid(member.invitationId)));
      assert.equal((await run(sdk.getMyProfile, member.uid)).userProfile, null);
    });
    it("a newly registered recipient can accept without a SQL profile or company onboarding", async () => {
      const member = await issue("owner-a", "AGENT", false);
      assert.equal((await run(sdk.getMyProfile, member.uid)).userProfile, null);
      const attempts = await Promise.allSettled([accept(member), accept(member)]);
      assert.equal(attempts.filter(result => result.status === "fulfilled").length, 1);
      const profile = (await run(sdk.getMyProfile, member.uid)).userProfile;
      assert.equal(profile.uid, member.uid);
      assert.equal(profile.email, member.email);
      assert.equal(uuid(profile.activeOrganizationId), uuid(f.orgA));
      const context = await run(sdk.getOrganizationContext, member.uid, { organizationId: f.orgA });
      assert.equal(context.ownMembership.status, "ACTIVE");
      assert.equal(context.ownMembership.role, "AGENT");
      await forbidden(sdk.getOrganizationContext, member.uid, { organizationId: f.orgB });
      await forbidden(sdk.setMembershipRole, member.uid, { organizationId: f.orgA, membershipId: member.membershipId, role: "OWNER" });
      assert.equal((await invitation(member)).status, "ACCEPTED");
      await assert.rejects(() => accept(member));
    });
    it("fresh recipients get their session display name without overwriting an existing profile name", async () => {
      const fresh = await issue("owner-a", "AGENT", false);
      await run(sdk.acceptInvitation, fresh.uid, { organizationId: f.orgA, membershipId: fresh.membershipId, tokenHash: fresh.tokenHash, displayName: "New Local Colleague" });
      assert.equal((await run(sdk.getMyProfile, fresh.uid)).userProfile.displayName, "New Local Colleague");
      const existing = await issue();
      await run(sdk.acceptInvitation, existing.uid, { organizationId: f.orgA, membershipId: existing.membershipId, tokenHash: existing.tokenHash, displayName: "Replacement must be ignored" });
      assert.equal((await run(sdk.getMyProfile, existing.uid)).userProfile.displayName, "Local Team Member");
    });
    it("invalid invitations do not create profiles, select companies or append acceptance audits", async () => {
      const member = await issue("owner-a", "AGENT", false);
      const outsider = "fresh-wrong-email-" + randomUUID();
      await forbidden(sdk.acceptInvitation, outsider, { organizationId: f.orgA, membershipId: member.membershipId, tokenHash: member.tokenHash });
      await forbidden(sdk.acceptInvitation, member.uid, { organizationId: f.orgA, membershipId: member.membershipId, tokenHash: newHash() });
      await forbidden(sdk.acceptInvitation, member.uid, { organizationId: f.orgB, membershipId: member.membershipId, tokenHash: member.tokenHash });
      await forbidden(sdk.acceptInvitation, member.uid, { organizationId: f.orgA, membershipId: member.membershipId, tokenHash: member.tokenHash }, { email_verified: false });
      for (const displayName of ["", "x".repeat(121)]) await forbidden(sdk.acceptInvitation, member.uid, { organizationId: f.orgA, membershipId: member.membershipId, tokenHash: member.tokenHash, displayName });
      await age(member, "expiresAt");
      await assert.rejects(() => accept(member));
      assert.equal((await run(sdk.getMyProfile, member.uid)).userProfile, null);
      assert.equal((await run(sdk.getMyProfile, outsider)).userProfile, null);
      assert.equal((await invitation(member)).status, "PENDING");
      const result = await dc.executeGraphql('query Probe($organizationId: UUID!, $id: UUID!) { membership(key: {organizationId: $organizationId, id: $id}) { status userProfileUid } auditLogs(where: {organizationId: {eq: $organizationId}, targetId: {eq: $id}, action: {eq: INVITATION_ACCEPTED}}) { id } }', { variables: { organizationId: f.orgA, id: member.membershipId } });
      assert.equal(result.data.membership.status, "INVITED");
      assert.equal(result.data.membership.userProfileUid, null);
      assert.deepEqual(result.data.auditLogs, []);
    });
    it("an owner can invite multiple unregistered colleagues while earlier invitations are pending", async () => {
      const first = await issue("owner-a", "AGENT", false);
      const second = await issue("owner-a", "AGENT", false);
      assert.equal((await invitation(first)).status, "PENDING");
      assert.equal((await invitation(second)).status, "PENDING");
      const variables = { organizationId: f.orgA, email: first.email };
      const lookup = await run(sdk.getTeamMembershipByEmail, "owner-a", variables);
      assert.deepEqual(lookup.membership, { status: "INVITED", invitation_on_membership: { status: "PENDING" } });
      assert.equal((await run(sdk.getTeamMembershipByEmail, "owner-b", { ...variables, organizationId: f.orgB })).membership, null);
      for (const uid of [null, "agent-a", "manager-a", "owner-b", first.uid, "outsider", "suspended-user"]) await forbidden(sdk.getTeamMembershipByEmail, uid, variables);
      await forbidden(sdk.getTeamMembershipByEmail, "owner-a", variables, { email_verified: false });
      await forbidden(sdk.inviteMembership, "owner-a", { ...variables, role: "AGENT", tokenHash: newHash(), expiresAt: new Date(Date.now() + 3600000).toISOString() });
      assert.equal((await run(sdk.listInvitations, "owner-a", { organizationId: f.orgA, search: first.email })).total[0].count, 1);
      await accept(first);
      await accept(second);
    });
    it("acceptance atomically activates and selects the company", async () => {
      const member = await issue();
      await accept(member);
      const context = await run(sdk.getOrganizationContext, member.uid, { organizationId: f.orgA });
      assert.equal(context.ownMembership.status, "ACTIVE");
      assert.equal(context.ownMembership.role, "AGENT");
      const profile = await run(sdk.getMyProfile, member.uid);
      assert.equal(uuid(profile.userProfile.activeOrganizationId), uuid(f.orgA));
      assert.equal((await invitation(member)).status, "ACCEPTED");
      await assert.rejects(() => accept(member));
    });
    it("duplicate email invitations commit once under concurrency", async () => {
      const email = "duplicate-" + randomUUID() + "@example.test";
      const results = await Promise.allSettled([1, 2].map(() => run(sdk.inviteMembership, "owner-a", { organizationId: f.orgA, email, role: "AGENT", tokenHash: newHash(), expiresAt: new Date(Date.now() + 3600000).toISOString() })));
      assert.equal(results.filter(row => row.status === "fulfilled").length, 1);
      const list = await run(sdk.listInvitations, "owner-a", { organizationId: f.orgA, search: email });
      assert.equal(list.total[0].count, 1);
    });
    it("duplicate user membership rolls back token consumption", async () => {
      const member = await issue();
      const before = (await run(sdk.getMyProfile, "agent-a")).userProfile;
      await forbidden(sdk.acceptInvitation, "agent-a", { organizationId: f.orgA, membershipId: member.membershipId, tokenHash: member.tokenHash }, { email: member.email });
      assert.equal((await invitation(member)).status, "PENDING");
      assert.deepEqual((await run(sdk.getMyProfile, "agent-a")).userProfile, before);
    });
    it("expired tokens, wrong emails and unverified sessions do not activate membership", async () => {
      const member = await issue();
      await forbidden(sdk.acceptInvitation, "outsider", { organizationId: f.orgA, membershipId: member.membershipId, tokenHash: member.tokenHash });
      await forbidden(sdk.acceptInvitation, member.uid, { organizationId: f.orgA, membershipId: member.membershipId, tokenHash: member.tokenHash }, { email_verified: false });
      await age(member, "expiresAt");
      await assert.rejects(() => accept(member));
      assert.equal((await invitation(member)).status, "PENDING");
      assert.equal((await run(sdk.listMyOrganizations, member.uid)).memberships.length, 0);
    });
    it("revocation invalidates a link and reserves no active membership", async () => {
      const member = await issue();
      await forbidden(sdk.revokeInvitation, "owner-b", { organizationId: f.orgA, membershipId: member.membershipId });
      await run(sdk.revokeInvitation, "owner-a", { organizationId: f.orgA, membershipId: member.membershipId });
      assert.equal((await invitation(member)).status, "REVOKED");
      await assert.rejects(() => accept(member));
      await forbidden(sdk.revokeInvitation, "owner-a", { organizationId: f.orgA, membershipId: member.membershipId });
    });
    it("reissue rotates the digest, enforces cooldown and invalidates the old link", async () => {
      const member = await issue();
      const tokenHash = newHash();
      const variables = { organizationId: f.orgA, membershipId: member.membershipId, tokenHash, expiresAt: new Date(Date.now() + 3600000).toISOString() };
      await forbidden(sdk.reissueInvitation, "owner-a", variables);
      await age(member);
      await forbidden(sdk.reissueInvitation, "owner-b", variables);
      await run(sdk.reissueInvitation, "admin-a", variables);
      await assert.rejects(() => accept(member));
      await accept({ ...member, tokenHash });
      assert.equal((await invitation(member)).status, "ACCEPTED");
      await forbidden(sdk.reissueInvitation, "owner-a", { ...variables, tokenHash: newHash() });
    });
    it("a revoked unaccepted recipient can be re-invited without deleting rows or revocation history", async () => {
      const member = await issue("owner-a", "AGENT", false);
      await sdk.recordInvitationDelivery(dc, { organizationId: f.orgA, membershipId: member.membershipId, actorUid: "owner-a", tokenHash: member.tokenHash, outcome: "PREVIEW" });
      await run(sdk.revokeInvitation, "owner-a", { organizationId: f.orgA, membershipId: member.membershipId });
      await assert.rejects(() => accept(member));
      const variables = { organizationId: f.orgA, membershipId: member.membershipId, tokenHash: newHash(), expiresAt: new Date(Date.now() + 7200000).toISOString() };
      await forbidden(sdk.reinviteRevokedInvitation, "owner-a", variables); // One-minute cooldown.
      await age(member);
      await forbidden(sdk.reinviteRevokedInvitation, "owner-a", { ...variables, tokenHash: member.tokenHash });
      await run(sdk.reinviteRevokedInvitation, "owner-a", variables);
      const row = await invitation(member);
      assert.equal(uuid(row.id), uuid(member.invitationId));
      assert.equal(uuid(row.membershipId), uuid(member.membershipId));
      assert.equal(row.status, "PENDING");
      assert.equal(row.revokedAt, null);
      assert.equal(row.deliveryStatus, "NOT_SENT");
      assert.equal(row.deliveryUpdatedAt, null);
      assert.equal(new Date(row.expiresAt).getTime(), new Date(variables.expiresAt).getTime());
      assert.equal(row.membership.status, "INVITED");
      assert.equal(row.membership.userProfileUid, null);
      assert.equal(row.membership.role, "AGENT");
      assert.ok(!JSON.stringify(row).includes(variables.tokenHash));
      assert.deepEqual((await run(sdk.listMyOrganizations, member.uid)).memberships, []);
      await assert.rejects(() => accept(member));
      const audit = await run(sdk.listAuditLogs, "owner-a", { organizationId: f.orgA, limit: 100 });
      assert.ok(audit.auditLogs.some(event => event.action === "INVITATION_REVOKED" && uuid(event.targetId) === uuid(member.invitationId)));
      const renewed = audit.auditLogs.filter(event => event.action === "INVITATION_REISSUED" && uuid(event.targetId) === uuid(member.invitationId));
      assert.equal(renewed.length, 1);
      assert.deepEqual(renewed[0].metadata, { previousStatus: "REVOKED", status: "PENDING" });
      await assert.rejects(() => sdk.recordInvitationDelivery(dc, { organizationId: f.orgA, membershipId: member.membershipId, actorUid: "owner-a", tokenHash: member.tokenHash, outcome: "ACCEPTED" }));
      await accept({ ...member, tokenHash: variables.tokenHash });
      const companies = (await run(sdk.listMyOrganizations, member.uid)).memberships;
      assert.equal(companies.length, 1);
      assert.equal(companies[0].role, "AGENT");
      await assert.rejects(() => accept({ ...member, tokenHash: variables.tokenHash }));
      await forbidden(sdk.getOrganizationContext, member.uid, { organizationId: f.orgB });
    });
    it("re-invitation rejects anonymous, unverified, unrelated and lower-privilege actors", async () => {
      const member = await issue();
      await run(sdk.revokeInvitation, "owner-a", { organizationId: f.orgA, membershipId: member.membershipId });
      await age(member);
      const variables = { organizationId: f.orgA, membershipId: member.membershipId, tokenHash: newHash(), expiresAt: new Date(Date.now() + 3600000).toISOString() };
      for (const uid of [null, "owner-b", "agent-a", "manager-a", "outsider", "suspended-user", member.uid]) await forbidden(sdk.reinviteRevokedInvitation, uid, variables, { role: "OWNER" });
      await forbidden(sdk.reinviteRevokedInvitation, "owner-a", variables, { email_verified: false });
      await forbidden(sdk.reinviteRevokedInvitation, "owner-a", { ...variables, organizationId: f.orgB });
      for (const extra of [{ tokenHash: "invalid" }, { expiresAt: "2020-01-01T00:00:00Z" }, { expiresAt: new Date(Date.now() + 8 * 86400000).toISOString() }]) await forbidden(sdk.reinviteRevokedInvitation, "owner-a", { ...variables, ...extra });
      assert.equal((await invitation(member)).status, "REVOKED");
      assert.equal((await invitation(member)).membership.status, "REMOVED");
      await run(sdk.reinviteRevokedInvitation, "admin-a", variables);
      await accept({ ...member, tokenHash: variables.tokenHash });
    });
    it("only an owner may re-invite an ADMIN and mismatched stored roles roll back", async () => {
      const member = await issue("owner-a", "ADMIN");
      await run(sdk.revokeInvitation, "owner-a", { organizationId: f.orgA, membershipId: member.membershipId });
      await age(member);
      const variables = { organizationId: f.orgA, membershipId: member.membershipId, tokenHash: newHash(), expiresAt: new Date(Date.now() + 3600000).toISOString() };
      await forbidden(sdk.reinviteRevokedInvitation, "admin-a", variables);
      await dc.executeGraphql('mutation Tamper($organizationId: UUID!, $id: UUID!) { membership_update(key: {organizationId: $organizationId, id: $id}, data: { role: AGENT }) }', { variables: { organizationId: f.orgA, id: member.membershipId } });
      await forbidden(sdk.reinviteRevokedInvitation, "owner-a", variables);
      assert.equal((await invitation(member)).status, "REVOKED");
      await dc.executeGraphql('mutation Restore($organizationId: UUID!, $id: UUID!) { membership_update(key: {organizationId: $organizationId, id: $id}, data: { role: ADMIN }) }', { variables: { organizationId: f.orgA, id: member.membershipId } });
      await run(sdk.reinviteRevokedInvitation, "owner-a", variables);
      await accept({ ...member, tokenHash: variables.tokenHash });
      assert.equal((await run(sdk.getOrganizationContext, member.uid, { organizationId: f.orgA })).ownMembership.role, "ADMIN");
    });
    it("concurrent re-invitations commit only one new token and one membership reservation", async () => {
      const member = await issue();
      await run(sdk.revokeInvitation, "owner-a", { organizationId: f.orgA, membershipId: member.membershipId });
      await age(member);
      const tokens = [newHash(), newHash()];
      const attempts = await Promise.allSettled(tokens.map(tokenHash => run(sdk.reinviteRevokedInvitation, "owner-a", { organizationId: f.orgA, membershipId: member.membershipId, tokenHash, expiresAt: new Date(Date.now() + 3600000).toISOString() })));
      assert.equal(attempts.filter(result => result.status === "fulfilled").length, 1);
      const winner = attempts.findIndex(result => result.status === "fulfilled");
      await assert.rejects(() => accept(member));
      await assert.rejects(() => accept({ ...member, tokenHash: tokens[1 - winner] }));
      await accept({ ...member, tokenHash: tokens[winner] });
      assert.equal((await run(sdk.listMyOrganizations, member.uid)).memberships.length, 1);
      assert.equal((await run(sdk.listInvitations, "owner-a", { organizationId: f.orgA, search: member.email })).total[0].count, 1);
    });
    it("re-invitation cannot restore an accepted and subsequently removed member", async () => {
      const member = await issue();
      await age(member);
      const variables = { organizationId: f.orgA, membershipId: member.membershipId, tokenHash: newHash(), expiresAt: new Date(Date.now() + 3600000).toISOString() };
      await forbidden(sdk.reinviteRevokedInvitation, "owner-a", variables); // Still PENDING.
      await accept(member);
      await run(sdk.setMembershipStatus, "owner-a", { organizationId: f.orgA, membershipId: member.membershipId, status: "REMOVED" });
      await forbidden(sdk.reinviteRevokedInvitation, "owner-a", variables);
      const row = await invitation(member);
      assert.equal(row.status, "ACCEPTED");
      assert.equal(row.membership.status, "REMOVED");
      assert.equal(row.membership.userProfileUid, member.uid);
      assert.deepEqual((await run(sdk.listMyOrganizations, member.uid)).memberships, []);
    });
    it("a duplicate token digest rolls back re-invitation without changing the revoked reservation", async () => {
      const member = await issue();
      await run(sdk.revokeInvitation, "owner-a", { organizationId: f.orgA, membershipId: member.membershipId });
      await age(member);
      const before = await invitation(member);
      const other = await issue();
      await forbidden(sdk.reinviteRevokedInvitation, "owner-a", { organizationId: f.orgA, membershipId: member.membershipId, tokenHash: other.tokenHash, expiresAt: new Date(Date.now() + 3600000).toISOString() });
      const after = await invitation(member);
      assert.deepEqual(after, before);
      const audit = await run(sdk.listAuditLogs, "owner-a", { organizationId: f.orgA, limit: 100 });
      assert.ok(!audit.auditLogs.some(event => event.action === "INVITATION_REISSUED" && uuid(event.targetId) === uuid(member.invitationId)));
    });
    it("administrators cannot reissue or revoke administrator invitations", async () => {
      const member = await issue("owner-a", "ADMIN");
      await age(member);
      await forbidden(sdk.revokeInvitation, "admin-a", { organizationId: f.orgA, membershipId: member.membershipId });
      await forbidden(sdk.reissueInvitation, "admin-a", { organizationId: f.orgA, membershipId: member.membershipId, tokenHash: newHash(), expiresAt: new Date(Date.now() + 3600000).toISOString() });
      await accept(member);
      assert.equal((await run(sdk.getOrganizationContext, member.uid, { organizationId: f.orgA })).ownMembership.role, "ADMIN");
    });
    it("a suspended or demoted issuer cannot grant access through an old invitation", async () => {
      const admin = await issue("owner-a", "ADMIN");
      await accept(admin);
      const member = await issue(admin.uid);
      await run(sdk.setMembershipRole, "owner-a", { organizationId: f.orgA, membershipId: admin.membershipId, role: "MANAGER" });
      await assert.rejects(() => accept(member));
      assert.equal((await invitation(member)).status, "PENDING");
    });
    it("mismatched stored invitation roles cannot escalate membership", async () => {
      const member = await issue();
      await dc.executeGraphql('mutation Tamper($organizationId: UUID!, $id: UUID!) { invitation_update(key: {organizationId: $organizationId, id: $id}, data: { role: ADMIN }) }', { variables: { organizationId: f.orgA, id: member.invitationId } });
      await assert.rejects(() => accept(member));
      assert.equal((await run(sdk.listMyOrganizations, member.uid)).memberships.length, 0);
    });
    it("accept and revoke races have only one committed outcome", async () => {
      const member = await issue();
      const attempts = await Promise.allSettled([accept(member), run(sdk.revokeInvitation, "owner-a", { organizationId: f.orgA, membershipId: member.membershipId })]);
      assert.equal(attempts.filter(row => row.status === "fulfilled").length, 1);
      const row = await invitation(member);
      const companies = await run(sdk.listMyOrganizations, member.uid);
      assert.equal(companies.memberships.length, row.status === "ACCEPTED" ? 1 : 0);
    });
    it("delivery receipts cannot be forged using Firebase user claims", async () => {
      const member = await issue();
      const variables = { organizationId: f.orgA, membershipId: member.membershipId, actorUid: "owner-a", tokenHash: member.tokenHash, outcome: "ACCEPTED" };
      for (const uid of [null, "owner-a", "admin-a", "agent-a", "owner-b"]) await forbidden(sdk.recordInvitationDelivery, uid, variables, { admin: true, role: "OWNER" });
      assert.equal((await invitation(member)).deliveryStatus, "NOT_SENT");
      await sdk.recordInvitationDelivery(dc, variables);
      assert.equal((await invitation(member)).deliveryStatus, "ACCEPTED");
      const audit = await run(sdk.listAuditLogs, "owner-a", { organizationId: f.orgA, limit: 100 });
      assert.ok(audit.auditLogs.some(row => row.action === "INVITATION_DELIVERY_ACCEPTED" && uuid(row.targetId) === uuid(member.invitationId)));
      assert.ok(!JSON.stringify(audit).includes(member.tokenHash));
    });
    it("privileged delivery receipts still enforce actor, organization and digest binding", async () => {
      const member = await issue();
      const variables = { organizationId: f.orgA, membershipId: member.membershipId, actorUid: "owner-a", tokenHash: member.tokenHash, outcome: "PREVIEW" };
      for (const extra of [{ actorUid: "owner-b" }, { organizationId: f.orgB }, { tokenHash: newHash() }, { outcome: "NOT_SENT" }]) await assert.rejects(() => sdk.recordInvitationDelivery(dc, { ...variables, ...extra }));
      assert.equal((await invitation(member)).deliveryStatus, "NOT_SENT");
    });
    it("the last owner remains protected from role changes and suspension", async () => {
      for (const uid of ["owner-a", "admin-a"]) {
        await forbidden(sdk.setMembershipRole, uid, { organizationId: f.orgA, membershipId: f.memberOwnerA, role: "AGENT" });
        await forbidden(sdk.setMembershipStatus, uid, { organizationId: f.orgA, membershipId: f.memberOwnerA, status: "SUSPENDED" });
      }
    });
  });
});
