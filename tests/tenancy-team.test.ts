import assert from "node:assert/strict";
import { test } from "node:test";
import { invitationLifetimeMs, createInvitationSecret, hashInvitationToken } from "../src/modules/organizations/server/invitation-token";
import { invitationEmailConfiguration, deliverInvitation } from "../src/modules/organizations/server/email-delivery";
import { invitationLink, parseInvitationFragment, parseInvitationUrl } from "../src/modules/organizations/invitation-link";
import { teamInviteSchema, teamPageSchema, invitationPageSchema, invitationActionSchema, teamSearchPattern, teamRoleSchema, teamSuspensionSchema } from "../src/modules/organizations/team-validation";
import { assertInvitationCanBeCreated, canReinviteRecipient } from "../src/modules/organizations/server/invitation-policy";

const id = "10000000-0000-4000-8000-000000000001";
const secret = createInvitationSecret(new Date("2026-10-01T00:00:00Z"));
const invite = { organizationId: id, membershipId: id, token: secret.token };
const email = { to: "invited@example.test", companyName: "<script>Agency</script>", url: invitationLink("https://estateos.test", invite), expiresAt: secret.expiresAt };

test("a pending invitation gives actionable reissue guidance without waiting for acceptance", () => {
  assert.throws(() => assertInvitationCanBeCreated({ status: "INVITED", invitation_on_membership: { status: "PENDING" } }), (error: unknown) => {
    const safe = error as { status: number; code: string; message: string };
    assert.equal(safe.status, 409);
    assert.equal(safe.code, "INVITATION_PENDING");
    assert.match(safe.message, /Reissue/);
    assert.match(safe.message, /invite other colleagues now/);
    return true;
  });
});
test("an unused email can be invited and existing members cannot acquire duplicate reservations", () => {
  assert.doesNotThrow(() => assertInvitationCanBeCreated(null));
  assert.doesNotThrow(() => assertInvitationCanBeCreated(undefined));
  for (const status of ["ACTIVE", "SUSPENDED", "PENDING", "REMOVED", "REVOKED", "INVITED"]) {
    assert.throws(() => assertInvitationCanBeCreated({ status }), { code: "MEMBERSHIP_EXISTS", status: 409 });
  }
  assert.throws(() => assertInvitationCanBeCreated({ status: "INVITED", invitation_on_membership: { status: "REVOKED" } }), { code: "MEMBERSHIP_EXISTS" });
});

test("a revoked reservation points to re-invitation without deleting its audit history", () => {
  assert.throws(() => assertInvitationCanBeCreated({ status: "REMOVED", invitation_on_membership: { status: "REVOKED" } }), (error: unknown) => {
    const safe = error as { status: number; code: string; message: string };
    assert.equal(safe.status, 409);
    assert.equal(safe.code, "INVITATION_REVOKED");
    assert.match(safe.message, /Re-invite/);
    return true;
  });
});

test("only revoked never-accepted reservations are eligible for re-invitation", () => {
  const row = { status: "REVOKED", role: "AGENT", membership: { status: "REMOVED", role: "AGENT", userProfileUid: null } };
  assert.equal(canReinviteRecipient(row), true);
  for (const extra of [{ status: "PENDING" }, { status: "ACCEPTED" }, { role: "ADMIN" }, { role: "OWNER" }, { acceptedAt: "2026-01-01T00:00:00Z" }, { acceptedByUid: "registered-user" }]) {
    assert.equal(canReinviteRecipient({ ...row, ...extra }), false);
  }
  for (const extra of [{ status: "ACTIVE" }, { status: "SUSPENDED" }, { status: "INVITED" }, { role: "OWNER" }, { userProfileUid: "registered-user" }, { acceptedAt: "2026-01-01T00:00:00Z" }, { approvedAt: "2026-01-01T00:00:00Z" }]) {
    assert.equal(canReinviteRecipient({ ...row, membership: { ...row.membership, ...extra } }), false);
  }
});

test("re-invitation input cannot replace recipient, company, issuer, status or role", () => {
  assert.deepEqual(invitationActionSchema.parse({ membershipId: id }), { membershipId: id });
  for (const extra of [{ email: "other@example.test" }, { organizationId: id }, { role: "OWNER" }, { actorUid: "owner" }, { status: "ACTIVE" }, { tokenHash: secret.tokenHash }]) {
    assert.equal(invitationActionSchema.safeParse({ membershipId: id, ...extra }).success, false);
  }
});

test("invitation lifetime is configurable within the database's seven-day cap", () => {
  assert.equal(invitationLifetimeMs(undefined), 168 * 3600000);
  assert.equal(invitationLifetimeMs("24"), 24 * 3600000);
  for (const value of ["0", "169", "-1", "1.5", "NaN", "24 hours"]) assert.throws(() => invitationLifetimeMs(value));
  const token = createInvitationSecret(new Date("2026-10-01T00:00:00Z"), invitationLifetimeMs("1"));
  assert.equal(token.expiresAt, "2026-10-01T01:00:00.000Z");
  assert.notEqual(token.token, token.tokenHash);
  assert.equal(hashInvitationToken(token.token), token.tokenHash);
});
test("invitation secrets use fragments and reject malformed or duplicate authority fields", () => {
  const url = new URL(email.url);
  assert.equal(url.pathname, "/invite/accept");
  assert.equal(url.search, "");
  assert.deepEqual(parseInvitationFragment(url.hash), invite);
  for (const hash of ["", "#token=invalid", url.hash + "&role=OWNER", url.hash + "&token=" + secret.token, url.hash + "&__proto__=bad"]) assert.equal(parseInvitationFragment(hash), null);
});

test("an invitee can resume a complete invitation link without following another origin", () => {
  assert.deepEqual(parseInvitationUrl(email.url, "https://estateos.test"), invite);
  for (const value of [email.url.replace("estateos.test", "evil.test"), email.url.replace("/invite/accept", "/onboarding/company"), email.url.replace("#", "?"), email.url.replace("https://", "https://user:password@"), email.url + "&role=OWNER", "/invite/accept", "not a URL"]) {
    assert.equal(parseInvitationUrl(value, "https://estateos.test"), null);
  }
});
test("team inputs reject role escalation, identity injection and unrelated company selectors", () => {
  assert.deepEqual(teamInviteSchema.parse({ email: " Agent@Example.test ", role: "AGENT" }), { email: "agent@example.test", role: "AGENT" });
  for (const extra of [{ role: "OWNER" }, { role: "PLATFORM_ADMIN" }, { organizationId: id }, { userUid: "victim" }, { tokenHash: secret.tokenHash }]) {
    assert.equal(teamInviteSchema.safeParse({ email: email.to, role: "AGENT", ...extra }).success, false);
  }
  assert.equal(teamRoleSchema.safeParse({ membershipId: id, role: "OWNER" }).success, false);
  assert.equal(teamSuspensionSchema.safeParse({ membershipId: id, status: "ACTIVE" }).success, false);
  for (const value of [{ page: 0 }, { page: 402 }, { search: "a".repeat(121) }, { status: "OWNER" }, { role: "ADMIN" }]) assert.equal(teamPageSchema.safeParse(value).success, false);
  assert.equal(invitationPageSchema.safeParse({ status: "ACCEPTED" }).success, true);
  assert.equal(teamSearchPattern("50%_\\name"), "%50\\%\\_\\\\name%");
});
test("unconfigured email uses an explicit development preview and fails closed elsewhere", async () => {
  const configuration = invitationEmailConfiguration({ nodeEnv: "development" });
  let sent = false;
  const result = await deliverInvitation(configuration, email, async () => { sent = true; throw new Error("must not run"); });
  assert.equal(sent, false);
  assert.equal(result.mode, "preview");
  assert.match(result.message, /No email was sent/);
  assert.equal(result.previewUrl, email.url);
  for (const nodeEnv of ["production", "test", undefined]) assert.throws(() => invitationEmailConfiguration({ nodeEnv }), { status: 503 });
  assert.throws(() => invitationEmailConfiguration({ nodeEnv: "production", provider: "resend", apiKey: "sensitive-key", from: "bad\r\nheader" }));
});
test("provider acceptance is recorded only after a successful receipt and does not expose the link", async () => {
  const configuration = invitationEmailConfiguration({ nodeEnv: "production", provider: "resend", apiKey: "sensitive-key", from: "team@example.test" });
  let called = false;
  const result = await deliverInvitation(configuration, email, async (url, options) => {
    called = true;
    assert.equal(url, "https://api.resend.com/emails");
    assert.equal(options?.redirect, "error");
    const body = JSON.parse(String(options?.body));
    assert.equal(body.to[0], email.to);
    assert.match(body.html, /&lt;script&gt;/);
    assert.ok(!body.html.includes("<script>"));
    assert.ok(body.text.includes(secret.token));
    return Response.json({ id: "provider-receipt" }, { status: 200 });
  });
  assert.equal(called, true);
  assert.equal(result.mode, "accepted");
  assert.equal(result.previewUrl, undefined);
  assert.ok(!JSON.stringify(result).includes(secret.token));
});
for (const outcome of ["rejected", "timeout", "malformed"] as const) test("email " + outcome + " never reports success or leaks provider secrets", async () => {
  const configuration = invitationEmailConfiguration({ nodeEnv: "production", provider: "resend", apiKey: "sensitive-key", from: "team@example.test" });
  const result = await deliverInvitation(configuration, email, async () => {
    if (outcome === "timeout") throw new Error("sensitive-key token=" + secret.token);
    return Response.json(outcome === "malformed" ? {} : { error: "sensitive-key token=" + secret.token }, { status: outcome === "rejected" ? 403 : 200 });
  });
  assert.equal(result.mode, "failed");
  assert.equal(result.previewUrl, undefined);
  assert.doesNotMatch(JSON.stringify(result), /sensitive-key/);
  assert.ok(!JSON.stringify(result).includes(secret.token));
});
