import assert from "node:assert/strict";
import { test } from "node:test";
import { companyDetailsSchema } from "../src/modules/organizations/validation";
import { resolveCompanyWorkspace, companyWorkspaceDestination, companyOnboardingState } from "../src/modules/organizations/workspace-policy";
import { assertExpectedOrganization, parseWorkspaceJsonRequest } from "../src/lib/http/request-policy";
import { validateMutationRequest } from "../src/modules/auth/server/request-policy";

const a = "10000000-0000-4000-8000-000000000001";
const b = "20000000-0000-4000-8000-000000000001";
const valid = { name: "Agency", slug: "agency", emirate: "DUBAI", contactPhone: "+971 50 123 4567", companyEmail: "agency@example.test", companySize: "TWO_TO_TEN" };
const member = (id = a, overrides = {}) => ({
  organizationId: id, userProfileUid: "me", role: "AGENT", status: "ACTIVE",
  organization: { id, name: "Agency", slug: "agency" }, ...overrides,
});

test("onboarding requires complete company details and normalizes email and slug", () => {
  assert.deepEqual(companyDetailsSchema.parse({ ...valid, name: " Agency ", slug: " AGENCY ", companyEmail: " Agency@Example.test " }), valid);
  for (const key of Object.keys(valid)) {
    const input: Record<string, unknown> = { ...valid };
    delete input[key];
    assert.equal(companyDetailsSchema.safeParse(input).success, false);
  }
});
test("company details reject role, owner, organization and logo injections", () => {
  for (const injected of [{ role: "OWNER" }, { ownerUid: "victim" }, { organizationId: b }, { logoUrl: "https://untrusted.test/logo.svg" }, { status: "ACTIVE" }]) {
    assert.equal(companyDetailsSchema.safeParse({ ...valid, ...injected }).success, false);
  }
  for (const input of [{ emirate: "UNKNOWN" }, { companySize: "100000" }, { contactPhone: "javascript:123" }, { companyEmail: "wrong" }, { slug: "a/b" }]) {
    assert.equal(companyDetailsSchema.safeParse({ ...valid, ...input }).success, false);
  }
});
test("existing active members keep their workspace and are not sent to onboarding", () => {
  const workspace = resolveCompanyWorkspace("me", a.replaceAll("-", ""), [member()]);
  assert.equal(workspace.activeCompany?.id, a);
  assert.equal(companyWorkspaceDestination(workspace), null);
});

for (const role of ["OWNER", "ADMIN", "MANAGER", "AGENT"]) {
  test(`an active ${role} can open their company dashboard without platform privileges`, () => {
    const workspace = resolveCompanyWorkspace("me", a, [member(a, { role })]);
    assert.equal(workspace.activeCompany?.id, a);
    assert.equal(workspace.activeCompany?.role, role);
    assert.equal(companyWorkspaceDestination(workspace), null);
    // A foreign company selection never grants access, regardless of role.
    const foreign = resolveCompanyWorkspace("me", b, [member(a, { role })]);
    assert.equal(foreign.activeCompany, null);
    assert.equal(companyWorkspaceDestination(foreign), "/onboarding/company?select=1");
  });
}

test("invited users without a profile go to acceptance rather than company registration", () => {
  const workspace = resolveCompanyWorkspace("new-invitee", undefined, [], true);
  assert.equal(workspace.activeCompany, null);
  assert.deepEqual(workspace.companies, []);
  assert.equal(companyWorkspaceDestination(workspace), "/invite/accept");
  assert.deepEqual(companyOnboardingState(workspace, false), { view: "choose", redirect: "/invite/accept" });
});

test("ordinary sign-in never requires a new company and creation requires explicit intent", () => {
  const workspace = resolveCompanyWorkspace("new", null, []);
  assert.deepEqual(companyOnboardingState(workspace, false), { view: "choose", redirect: null });
  assert.deepEqual(companyOnboardingState(workspace, true), { view: "create", redirect: null });
  assert.deepEqual(companyOnboardingState(resolveCompanyWorkspace("new", null, [], true), true), { view: "create", redirect: null });
});

test("pending invitations never manufacture access and existing companies retain priority", () => {
  const rows = [member(a, { status: "INVITED", userProfileUid: null })];
  const pending = resolveCompanyWorkspace("me", a, rows, true);
  assert.equal(pending.activeCompany, null);
  assert.equal(companyWorkspaceDestination(pending), "/invite/accept");
  const active = resolveCompanyWorkspace("me", a, [member()], true);
  assert.equal(companyWorkspaceDestination(active), null);
  assert.deepEqual(companyOnboardingState(active, false), { view: "choose", redirect: "/workspace/dashboard" });
  const unselected = resolveCompanyWorkspace("me", null, [member()], true);
  assert.equal(companyWorkspaceDestination(unselected), "/onboarding/company?select=1");
  assert.deepEqual(companyOnboardingState(unselected, false), { view: "select", redirect: null });
});
test("a stale or foreign preference does not establish a company", () => {
  const workspace = resolveCompanyWorkspace("me", b, [member()]);
  assert.equal(workspace.activeCompany, null);
  assert.equal(companyWorkspaceDestination(workspace), "/onboarding/company?select=1");
  assert.equal(companyWorkspaceDestination(resolveCompanyWorkspace("new", null, [])), "/onboarding/company");
});
test("workspace choices exclude other identities, nonactive states and mismatched tenants", () => {
  const rows = [
    member(), member(b),
    ...["INVITED", "PENDING", "SUSPENDED", "REMOVED", "REVOKED"].map(status => member(a, { status })),
    member(a, { userProfileUid: "other" }), member(a, { role: "PLATFORM_ADMIN" }),
    member(a, { organization: { id: b, name: "Foreign", slug: "foreign" } }),
  ];
  const result = resolveCompanyWorkspace("me", b, rows);
  assert.equal(result.companies.length, 2);
  assert.equal(result.activeCompany?.id, b);
});
test("settings changes reject a stale company selection even when membership exists elsewhere", () => {
  assert.doesNotThrow(() => assertExpectedOrganization(a, a));
  assert.throws(() => assertExpectedOrganization(a, b), { code: "ORGANIZATION_CHANGED", status: 409 });
  assert.throws(() => assertExpectedOrganization(null, a), { status: 400 });
});
test("company HTTP input uses bounded JSON and exact-origin CSRF validation", async () => {
  const origin = "https://estateos.test";
  const csrf = "a".repeat(43);
  const request = (body: string, extra: Record<string, string> = {}) => new Request(origin + "/api/organizations", {
    method: "POST", headers: { origin, "content-type": "application/json", "x-csrf-token": csrf, ...extra }, body,
  });
  validateMutationRequest(request(JSON.stringify(valid)), { origin, csrfToken: csrf });
  assert.deepEqual(await parseWorkspaceJsonRequest(request(JSON.stringify(valid))), valid);
  const rejectedHeaders: Record<string, string>[] = [{ origin: "https://evil.test" }, { "x-csrf-token": "b".repeat(43) }, { "sec-fetch-site": "cross-site" }];
  for (const headers of rejectedHeaders) {
    assert.throws(() => validateMutationRequest(request("{}", headers), { origin, csrfToken: csrf }), { status: 403 });
  }
  await assert.rejects(() => parseWorkspaceJsonRequest(request("[]")), { status: 400 });
  await assert.rejects(() => parseWorkspaceJsonRequest(request("x".repeat(17000))), { status: 413 });
});
