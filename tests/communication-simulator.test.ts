import assert from "node:assert/strict";
import { test } from "node:test";
import { statusChange, transition } from "../src/modules/communications/call-state";
import { CRITERIA, layerStatus } from "../src/modules/communications/dev/criteria";
import { devToolsEnabled } from "../src/modules/communications/dev/guard";
import { SCENARIOS, fictionalNumber } from "../src/modules/communications/dev/scenarios";

const local = {NODE_ENV: "development", ESTATEOS_DEV_TOOLS: "1", DATA_CONNECT_EMULATOR_HOST: "127.0.0.1:9399", GCLOUD_PROJECT: "demo-estateos"};

test("developer tools need every local condition, and production always wins", () => {
  assert.equal(devToolsEnabled(local), true);
  assert.equal(devToolsEnabled({...local, NODE_ENV: "test"}), true);
  assert.equal(devToolsEnabled({...local, NODE_ENV: "production"}), false, "production disables them whatever else is set");
  assert.equal(devToolsEnabled({...local, ESTATEOS_DEV_TOOLS: undefined}), false, "off unless explicitly enabled");
  assert.equal(devToolsEnabled({...local, ESTATEOS_DEV_TOOLS: "true"}), false, "only the exact value 1");
  assert.equal(devToolsEnabled({...local, DATA_CONNECT_EMULATOR_HOST: undefined}), false, "a hosted database never qualifies");
  assert.equal(devToolsEnabled({...local, DATA_CONNECT_EMULATOR_HOST: "10.0.0.5:9399"}), false, "only a loopback emulator");
  assert.equal(devToolsEnabled({...local, GCLOUD_PROJECT: "estateos-production"}), false, "only demo projects");
  assert.equal(devToolsEnabled({...local, GCLOUD_PROJECT: undefined}), false);
});

test("simulated events follow the provider state machine and status rule", () => {
  const call = {direction: "INBOUND" as const, startedAt: "2026-11-04T08:00:00.000Z", answeredAt: null};
  assert.deepEqual(statusChange(call, "RINGING", "2026-11-04T08:00:05.000Z", null), {answeredAt: null, endedAt: null, durationSeconds: null, trigger: null});
  const answered = statusChange(call, "IN_PROGRESS", "2026-11-04T08:00:10.000Z", null);
  assert.equal(answered.answeredAt, "2026-11-04T08:00:10.000Z");
  const completed = statusChange({...call, answeredAt: answered.answeredAt}, "COMPLETED", "2026-11-04T08:02:10.000Z", 120);
  assert.deepEqual(completed, {answeredAt: null, endedAt: "2026-11-04T08:02:10.000Z", durationSeconds: 120, trigger: "call.completed"});
  assert.equal(statusChange(call, "NO_ANSWER", "2026-11-04T08:00:30.000Z", null).trigger, "call.missed");
  assert.equal(statusChange({...call, direction: "OUTBOUND"}, "NO_ANSWER", "2026-11-04T08:00:30.000Z", null).trigger, null, "an unanswered outgoing attempt starts nothing");
  // Only the final status reported: answered at the end minus the talk time, never before the start.
  assert.equal(statusChange(call, "COMPLETED", "2026-11-04T08:01:00.000Z", 600).answeredAt, call.startedAt);
  // Every scenario is a valid path from INITIATED, and replaying its last event is a duplicate.
  for (const [key, scenario] of Object.entries(SCENARIOS)) {
    let status = "INITIATED" as Parameters<typeof transition>[0];
    for (const step of scenario.steps) {
      const decision = transition(status, step);
      assert.equal(decision.apply, true, `${key}: ${status} → ${step}`);
      status = step;
    }
    assert.deepEqual(transition(status, status), {apply: false, reason: "DUPLICATE"}, key);
  }
  assert.deepEqual(transition("COMPLETED", "RINGING"), {apply: false, reason: "FINAL"}, "a late event cannot reopen a call");
  assert.match(fictionalNumber(4242), /^\+447700900\d{3}$/, "only the reserved drama range");
});

test("the verification dashboard derives each layer from named test results", () => {
  assert.equal(CRITERIA.length, 11, "the original Phase 6F acceptance criteria");
  assert.ok(CRITERIA.every(criterion => criterion.layers.SIMULATED || criterion.layers.INTEGRATION));
  assert.ok(CRITERIA.filter(criterion => criterion.providerRequired).every(criterion => criterion.id === 7 || criterion.layers.REAL_PROVIDER), "provider-dependent criteria say what blocks them");
  const suites = [
    {id: "unit", status: "PASSED" as const, startedAt: "2026-11-04T08:00:00.000Z", tests: [{name: "meeting links: https", status: "PASSED" as const}]},
    {id: "browser", status: "FAILED" as const, startedAt: "2026-11-04T08:00:00.000Z", tests: [{name: "An agent schedules a meeting", status: "FAILED" as const}]},
  ];
  assert.equal(layerStatus([{suite: "unit", test: "meeting links"}], suites).status, "PASSED");
  assert.equal(layerStatus([{suite: "unit", test: "meeting links"}, {suite: "browser", test: "schedules a meeting"}], suites).status, "FAILED");
  assert.equal(layerStatus([{suite: "persistence", test: ""}], suites).status, "NOT_RUN", "a suite that did not run is never counted as passed");
  assert.equal(layerStatus([{suite: "unit", test: "does not exist"}], suites).status, "NOT_RUN");
  assert.equal(layerStatus(undefined, suites).status, "NOT_RUN");
});
