import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";
import { deleteApp } from "firebase-admin/app";
import * as sdk from "@dataconnect/admin-generated";
import { localDataConnect, seedLocalDatabase } from "../scripts/sql-connect-local.mjs";
import { fixture as f } from "./fixtures/sql-connect-fixtures.mjs";

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
  const result = variables === undefined
    ? await operation(dc, options(uid, overrides))
    : await operation(dc, variables, options(uid, overrides));
  return result.data;
}

function forbidden(operation, uid, variables, overrides) {
  return assert.rejects(() => run(operation, uid, variables, overrides));
}

describe("SQL Connect tenant and authorization integration", { concurrency: false }, () => {
  before(async () => { await seedLocalDatabase(dc); });
  after(async () => { await deleteApp(app); });

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

  it("binds invitation acceptance to verified email, token, state and approval", async () => {
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
    await forbidden(sdk.getOrganizationContext, "invited-user", { organizationId: f.orgA });
    await forbidden(sdk.approveMembership, "invited-user", { organizationId: f.orgA, membershipId: f.memberInvitedA });
    const members = await run(sdk.listMemberships, "owner-a", { organizationId: f.orgA });
    assert.equal(members.memberships.find(m => uuid(m.id) === uuid(f.memberInvitedA)).status, "PENDING");
    await run(sdk.approveMembership, "owner-a", { organizationId: f.orgA, membershipId: f.memberInvitedA });
    const context = await run(sdk.getOrganizationContext, "invited-user", { organizationId: f.orgA });
    assert.equal(context.ownMembership.role, "AGENT");
    assert.equal(context.ownMembership.status, "ACTIVE");
    const audit = await run(sdk.listActivities, "owner-a", { organizationId: f.orgA });
    assert.equal(audit.activities.filter(e => e.kind === "INVITATION_ACCEPTED" && uuid(e.targetId) === uuid(f.memberInvitedA)).length, 1);
  });

  it("requires an owner to approve administrator membership", async () => {
    const uid = `local-admin-${randomUUID()}`;
    await run(sdk.upsertMyProfile, uid, { displayName: "Local Invited Admin" });
    const invite = await run(sdk.inviteMembership, "owner-a", {
      organizationId: f.orgA, email: `${uid}@example.test`, role: "ADMIN",
      tokenHash: "c".repeat(64), expiresAt: new Date(Date.now() + 3600000).toISOString(),
    });
    const membershipId = invite.membership.id;
    await run(sdk.acceptInvitation, uid, { organizationId: f.orgA, membershipId, tokenHash: "c".repeat(64) });
    await forbidden(sdk.approveMembership, "admin-a", { organizationId: f.orgA, membershipId });
    await run(sdk.approveMembership, "owner-a", { organizationId: f.orgA, membershipId });
    assert.equal((await run(sdk.getOrganizationContext, uid, { organizationId: f.orgA })).ownMembership.role, "ADMIN");
  });

  it("lets an admin invite and approve an agent but never grant ownership", async () => {
    const uid = `local-agent-${randomUUID()}`;
    await run(sdk.upsertMyProfile, uid, { displayName: "Local Invited Agent" });
    const invite = await run(sdk.inviteMembership, "admin-a", {
      organizationId: f.orgA, email: `${uid}@example.test`, role: "AGENT",
      tokenHash: "d".repeat(64), expiresAt: new Date(Date.now() + 3600000).toISOString(),
    });
    const membershipId = invite.membership.id;
    await run(sdk.acceptInvitation, uid, { organizationId: f.orgA, membershipId, tokenHash: "d".repeat(64) });
    await run(sdk.approveMembership, "admin-a", { organizationId: f.orgA, membershipId });
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
    assert.deepEqual(new Set(events.map(e => e.kind)), new Set(["LEAD_CREATED", "LEAD_UPDATED"]));
    assert.equal(events.length, 2);
    assert.ok(events.every(e => e.actorUid === "agent-a"));
  });

  it("permits managers to create unassigned leads without a branch", async () => {
    const result = await run(sdk.createLead, "manager-a", { organizationId: f.orgA, fullName: "Local Unassigned Lead" });
    const detail = await run(sdk.getLead, "manager-a", { organizationId: f.orgA, leadId: result.lead.id });
    assert.equal(detail.lead.assignedMembershipId ?? null, null);
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
    const created = await run(sdk.createLead, "manager-a", { organizationId: f.orgA, fullName: "Local Private Unassigned Probe" });
    for (const [name, operation, input] of leadOperationCases(f.orgA, created.lead.id)) {
      await assert.rejects(() => run(operation, "agent-a", input), undefined, `unassigned private lead: ${name}`);
    }
    const detail = await run(sdk.getLead, "manager-a", { organizationId: f.orgA, leadId: created.lead.id });
    assert.equal(detail.lead.fullName, "Local Private Unassigned Probe");
    assert.equal(detail.lead.assignedMembershipId ?? null, null);
    const timeline = await run(sdk.listLeadActivities, "manager-a", { organizationId: f.orgA, leadId: created.lead.id });
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

  it("allows managers to maintain permitted organization leads and read their private timeline", async () => {
    const created = await run(sdk.createLead, "owner-a", {
      organizationId: f.orgA, fullName: "Local Manager Workflow Probe", assignedMembershipId: f.memberAgentA,
    });
    const key = { organizationId: f.orgA, leadId: created.lead.id };
    const due = new Date(Date.now() + 7 * 86400000).toISOString();
    await run(sdk.addLeadNote, "manager-a", { ...key, note: "Local manager private workflow note" });
    await run(sdk.changeLeadStatus, "manager-a", { ...key, status: "QUALIFIED" });
    await run(sdk.assignLead, "manager-a", { ...key, assignedMembershipId: f.memberSharedA });
    await run(sdk.scheduleLeadFollowUp, "manager-a", { ...key, followUpAt: due, followUpNote: "Local manager scheduled follow-up" });
    const scheduled = await run(sdk.getLead, "manager-a", key);
    assert.equal(scheduled.lead.status, "QUALIFIED");
    assert.equal(uuid(scheduled.lead.assignedMembershipId), uuid(f.memberSharedA));
    assert.equal(new Date(scheduled.lead.followUpAt).getTime(), new Date(due).getTime());
    assert.equal(scheduled.lead.followUpNote, "Local manager scheduled follow-up");
    await run(sdk.completeLeadFollowUp, "manager-a", key);
    const completed = await run(sdk.getLead, "manager-a", key);
    assert.equal(completed.lead.followUpAt ?? null, null);
    assert.equal(completed.lead.followUpNote ?? null, null);
    await forbidden(sdk.completeLeadFollowUp, "manager-a", key);
    const timeline = await run(sdk.listLeadActivities, "manager-a", key);
    assert.deepEqual(new Set(timeline.activities.map(event => event.kind)), new Set([
      "LEAD_CREATED", "LEAD_NOTE_ADDED", "LEAD_STATUS_CHANGED", "LEAD_ASSIGNED", "FOLLOW_UP_SCHEDULED", "FOLLOW_UP_COMPLETED",
    ]));
    assert.equal(timeline.activities.length, 6);
    const note = timeline.activities.find(event => event.kind === "LEAD_NOTE_ADDED");
    assert.equal(note.note, "Local manager private workflow note");
    assert.ok(timeline.activities.every(event => uuid(event.organizationId ?? f.orgA) === uuid(f.orgA) && uuid(event.leadId) === uuid(key.leadId)));
    assert.ok(timeline.activities.filter(event => event.kind !== "LEAD_CREATED").every(event => event.actorUid === "manager-a"));
    const pageOne = await run(sdk.listLeadActivities, "manager-a", { ...key, limit: 2, offset: 0 });
    const pageTwo = await run(sdk.listLeadActivities, "manager-a", { ...key, limit: 2, offset: 2 });
    const pastLast = await run(sdk.listLeadActivities, "manager-a", { ...key, limit: 2, offset: 6 });
    assert.equal(pageOne.total[0].count, 6);
    assert.equal(pageTwo.total[0].count, 6);
    assert.equal(new Set([...pageOne.activities, ...pageTwo.activities].map(event => uuid(event.id))).size, 4);
    assert.equal(pastLast.activities.length, 0);
    assert.equal(pastLast.total[0].count, 6);
    // Reassignment removes the previous assignee's access to contact data and notes.
    await forbidden(sdk.getLead, "agent-a", key);
    await forbidden(sdk.listLeadActivities, "agent-a", key);
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
    const initial = await run(sdk.getLead, "manager-a", key);
    const due = new Date(Date.now() + 86400000).toISOString();
    await run(sdk.scheduleLeadFollowUp, "manager-a", { ...key, followUpAt: due, followUpNote: "Preserve this schedule" });
    await run(sdk.updateLead, "manager-a", {
      ...key, fullName: "Local Updated Contact", status: "CONTACTED", email: null, phone: null, source: null,
      branchId: null, assignedMembershipId: null,
    });
    const updated = await run(sdk.getLead, "manager-a", key);
    assert.equal(updated.lead.fullName, "Local Updated Contact");
    assert.equal(updated.lead.status, "CONTACTED");
    for (const field of ["email", "phone", "source", "branchId", "assignedMembershipId"]) assert.equal(updated.lead[field] ?? null, null);
    assert.equal(updated.lead.createdAt, initial.lead.createdAt);
    assert.equal(new Date(updated.lead.followUpAt).getTime(), new Date(due).getTime());
    assert.equal(updated.lead.followUpNote, "Preserve this schedule");
    assert.equal(updated.lead.updatedByUid, "manager-a");
    await forbidden(sdk.getLead, "agent-a", key);
  });

  it("replaces a follow-up and clears an omitted prior note while retaining both timeline events", async () => {
    const created = await run(sdk.createLead, "owner-a", { organizationId: f.orgA, fullName: "Local Reschedule Probe" });
    const key = { organizationId: f.orgA, leadId: created.lead.id };
    const firstDue = new Date(Date.now() + 86400000).toISOString();
    const secondDue = new Date(Date.now() + 2 * 86400000).toISOString();
    await run(sdk.scheduleLeadFollowUp, "manager-a", { ...key, followUpAt: firstDue, followUpNote: "Previous schedule note" });
    await run(sdk.scheduleLeadFollowUp, "manager-a", { ...key, followUpAt: secondDue });
    const updated = await run(sdk.getLead, "manager-a", key);
    assert.equal(new Date(updated.lead.followUpAt).getTime(), new Date(secondDue).getTime());
    assert.equal(updated.lead.followUpNote ?? null, null);
    const timeline = await run(sdk.listLeadActivities, "manager-a", key);
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
    const ids = manager.memberships.map(member => uuid(member.id));
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
    const first = await run(sdk.listLeads, "manager-a", { ...filters, offset: 0 });
    const repeated = await run(sdk.listLeads, "manager-a", { ...filters, offset: 0 });
    const second = await run(sdk.listLeads, "manager-a", { ...filters, offset: 2 });
    const pastLast = await run(sdk.listLeads, "manager-a", { ...filters, offset: 4 });
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
    const email = await run(sdk.listLeads, "manager-a", { organizationId: f.orgA, search: "%local-search-4@example.test%" });
    assert.equal(email.leads.length, 1);
    const phone = await run(sdk.listLeads, "manager-a", { organizationId: f.orgA, search: "%+971 50 100 004%" });
    assert.equal(phone.leads.length, 1);
    const otherCompany = await run(sdk.listLeads, "owner-b", { organizationId: f.orgB, search: `%${marker}%` });
    assert.equal(otherCompany.total[0].count, 0);
    assert.equal(otherCompany.leads.length, 0);
    const caseInsensitive = await run(sdk.listLeads, "manager-a", { organizationId: f.orgA, search: `%${marker.toLowerCase()}%` });
    assert.equal(caseInsensitive.leads.length, 5);
    assert.equal(caseInsensitive.total[0].count, 5);
    const unfiltered = await run(sdk.listLeads, "manager-a", { organizationId: f.orgA, limit: 100 });
    assert.ok(unfiltered.leads.length >= 5);
    assert.ok(unfiltered.total[0].count >= unfiltered.leads.length);
    assert.ok(unfiltered.leads.every(lead => uuid(lead.organizationId) === uuid(f.orgA)));
  });

  it("treats escaped user search wildcards literally in the SQL stored query", async () => {
    const marker = `Local Wildcard ${randomUUID()}`;
    const literal = await run(sdk.createLead, "owner-a", { organizationId: f.orgA, fullName: `${marker} 50%_ literal` });
    await run(sdk.createLead, "owner-a", { organizationId: f.orgA, fullName: `${marker} 50zz literal` });
    const result = await run(sdk.listLeads, "manager-a", { organizationId: f.orgA, search: `%${marker} 50\\%\\_ literal%` });
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
});
