import assert from "node:assert/strict";
import { test } from "node:test";
import { buildDistributionPlan, isWithinBusinessHours, selectNextDistributionAgent, type DistributionAgent, type DistributionRulePolicy } from "../src/modules/leads/distribution/policy";

const a = "10000000-0000-4000-8000-000000000001";
const b = "10000000-0000-4000-8000-000000000002";
const c = "10000000-0000-4000-8000-000000000003";
const agents: DistributionAgent[] = [
  { id: b, role: "AGENT", status: "ACTIVE", userProfileUid: "b" },
  { id: a, role: "AGENT", status: "ACTIVE", userProfileUid: "a" },
  { id: c, role: "AGENT", status: "ACTIVE", userProfileUid: "c" },
];
const rule: DistributionRulePolicy = {
  enabled: true, mode: "ROUND_ROBIN", branchId: null, projectId: null,
  skipUnavailable: true, businessHoursEnabled: false, timeZone: "Asia/Dubai",
  businessDaysMask: 62, businessStart: "09:00", businessEnd: "18:00",
};

test("round robin sorts membership IDs for a deterministic, fair rotation", () => {
  assert.deepEqual([
    selectNextDistributionAgent(agents, null, true)?.id,
    selectNextDistributionAgent(agents, a, true)?.id,
    selectNextDistributionAgent(agents, b, true)?.id,
    selectNextDistributionAgent(agents, c, true)?.id,
  ], [a, b, c, a]);
});

test("round robin excludes suspended, unregistered and unavailable agents", () => {
  const candidates = [
    ...agents,
    { id: "10000000-0000-4000-8000-000000000004", role: "AGENT", status: "SUSPENDED", userProfileUid: "d" },
    { id: "10000000-0000-4000-8000-000000000005", role: "AGENT", status: "ACTIVE", userProfileUid: null },
  ];
  const unavailable = candidates.map((agent) => agent.id === a
    ? { ...agent, availability: { status: "UNAVAILABLE", unavailableUntil: "2026-10-22T00:00:00.000Z" } }
    : agent);
  assert.equal(selectNextDistributionAgent(unavailable, null, true, new Date("2026-10-21T08:00:00.000Z"))?.id, b);
  assert.equal(selectNextDistributionAgent(unavailable, null, false, new Date("2026-10-21T08:00:00.000Z"))?.id, a);
});

test("rule branch and project constraints are tenant-local match conditions", () => {
  assert.equal(buildDistributionPlan({ rule: { ...rule, branchId: b, projectId: c }, lead: { branchId: b, projectId: c }, agents, lastMembershipId: null }).reason, "ASSIGNED");
  assert.deepEqual(buildDistributionPlan({ rule: { ...rule, branchId: b }, lead: { branchId: c }, agents, lastMembershipId: null }), { attempted: false, reason: "SCOPE_MISMATCH" });
});

test("business hours respect configured UAE-local weekdays and boundaries", () => {
  const working = { ...rule, businessHoursEnabled: true };
  assert.equal(isWithinBusinessHours(working, new Date("2026-10-19T06:00:00.000Z")), true); // Monday 10:00 Dubai
  assert.equal(isWithinBusinessHours(working, new Date("2026-10-19T14:00:00.000Z")), false); // Monday 18:00 Dubai
  assert.equal(isWithinBusinessHours(working, new Date("2026-10-18T06:00:00.000Z")), false); // Sunday
});

test("no eligible agent or invalid timezone leaves the lead unassigned", () => {
  assert.deepEqual(buildDistributionPlan({ rule, lead: {}, agents: [], lastMembershipId: null }), { attempted: true, membershipId: null, reason: "NO_ELIGIBLE_AGENT" });
  assert.equal(isWithinBusinessHours({ ...rule, businessHoursEnabled: true, timeZone: "Not/AZone" }, new Date()), false);
});
