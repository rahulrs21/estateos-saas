import assert from "node:assert/strict";
import { test } from "node:test";
import {
  calendarDate, classifyDue, dashboardSections, fillVolumeSeries, orderStages, parseDashboardRange, rangeDates, taskAgenda, toSection, topAgents,
} from "../src/modules/dashboard/dashboard-model";

// Dashboard rules (src/modules/dashboard/dashboard-model.ts). Fictional names and IDs only.

test("the reporting range accepts only the offered periods and defaults to 30 days", () => {
  assert.equal(parseDashboardRange("7d"), "7d");
  assert.equal(parseDashboardRange("90d"), "90d");
  assert.equal(parseDashboardRange(["7d", "90d"]), "7d");
  for (const raw of [undefined, "", "365d", "toString", "__proto__", 7, null]) assert.equal(parseDashboardRange(raw), "30d");
});

test("ranges end today, include today, and use weekly buckets for 90 days", () => {
  assert.deepEqual(rangeDates("7d", "2026-11-25"), {from: "2026-11-19", to: "2026-11-25", bucket: "day"});
  assert.deepEqual(rangeDates("30d", "2026-03-01"), {from: "2026-01-31", to: "2026-03-01", bucket: "day"});
  assert.equal(rangeDates("90d", "2026-11-25").bucket, "week");
});

test("calendar dates follow Dubai time, not UTC", () => {
  assert.equal(calendarDate(new Date("2026-11-24T20:30:00Z")), "2026-11-25");
  assert.equal(calendarDate(new Date("2026-11-24T19:59:59Z")), "2026-11-24");
});

test("daily series are zero-filled across the whole range", () => {
  const series = fillVolumeSeries([{label: "2026-11-20", bucket: "2026-11-20", count: 3}, {label: "2026-11-22", count: 1}], "2026-11-19", "2026-11-23", "day");
  assert.deepEqual(series, [
    {date: "2026-11-19", count: 0}, {date: "2026-11-20", count: 3}, {date: "2026-11-21", count: 0},
    {date: "2026-11-22", count: 1}, {date: "2026-11-23", count: 0},
  ]);
});

test("weekly series start on the Monday PostgreSQL's date_trunc uses", () => {
  // 2026-11-19 is a Thursday; its week starts Monday 2026-11-16.
  const series = fillVolumeSeries([{label: "2026-11-16", count: 2}, {label: "2026-11-23", count: 5}], "2026-11-19", "2026-11-25", "week");
  assert.deepEqual(series, [{date: "2026-11-16", count: 2}, {date: "2026-11-23", count: 5}]);
});

test("stages follow the configured pipeline order, unknown stages last by count", () => {
  const rows = [{label: "Won", count: 2}, {label: "NEW", count: 9}, {label: "New enquiry", count: 5}, {label: "Viewing", count: 7}, {label: "LOST", count: 9}];
  assert.deepEqual(orderStages(rows, ["New enquiry", "Viewing", "Won"]).map(row => row.label), ["New enquiry", "Viewing", "Won", "LOST", "NEW"]);
});

test("the agent leaderboard ranks by leads, breaks ties by name and reports unassigned separately", () => {
  const result = topAgents([
    {label: "Unassigned", count: 12}, {label: "Omar", count: 4}, {label: "Aisha", count: 4},
    {label: "Bilal", count: 9}, {label: "Dana", count: 1}, {label: "Farah", count: 2},
  ], 3);
  assert.deepEqual(result.agents.map(row => row.label), ["Bilal", "Aisha", "Omar"]);
  assert.equal(result.others, 2);
  assert.equal(result.unassigned, 12);
});

test("due dates are classified around Dubai midnight", () => {
  const now = new Date("2026-11-25T10:00:00Z"); // 14:00 in Dubai
  assert.equal(classifyDue("2026-11-25T09:59:00Z", now), "OVERDUE");
  assert.equal(classifyDue("2026-11-25T19:59:00Z", now), "TODAY"); // 23:59 Dubai
  assert.equal(classifyDue("2026-11-25T20:00:00Z", now), "THIS_WEEK"); // 00:00 Dubai, next day
  assert.equal(classifyDue("2026-12-02T19:59:00Z", now), "THIS_WEEK"); // seventh day, Dubai
  assert.equal(classifyDue("2026-12-02T20:00:00Z", now), "LATER");
  assert.equal(classifyDue("not a date", now), "OVERDUE");
});

test("the task agenda merges follow-ups and work tasks soonest first, with counts and links", () => {
  const now = new Date("2026-11-25T10:00:00Z");
  const agenda = taskAgenda(
    [{id: "f1", title: "Call back", dueAt: "2026-11-26T06:00:00Z", leadId: "lead-1", lead: {fullName: "Test Lead"}}],
    [
      {id: "w1", title: "Check listing photos", dueAt: "2026-11-24T06:00:00Z", listingId: "listing-1", listing: {title: "Marina flat", listingReference: "L-1"}},
      {id: "w2", title: "Team review", dueAt: "2026-11-25T12:00:00Z"},
    ],
    now, 100,
  );
  assert.deepEqual(agenda.items.map(item => [item.id, item.due, item.href]), [
    ["w-w1", "OVERDUE", "/listings/listing-1"],
    ["w-w2", "TODAY", null],
    ["f-f1", "THIS_WEEK", "/leads/lead-1"],
  ]);
  assert.equal(agenda.overdue, 1);
  assert.equal(agenda.dueToday, 1);
  assert.equal(agenda.dueNext7Days, 2);
  assert.equal(agenda.truncated, false);
  assert.equal(taskAgenda([], [{id: "w", title: "t", dueAt: "2026-11-26T06:00:00Z"}], now, 1).truncated, true);
});

test("sections follow the role rules: managers get no inventory, only company-wide roles see the leaderboard", () => {
  assert.deepEqual(dashboardSections("OWNER"), {inventory: true, map: true, leaderboard: true, leadScope: "COMPANY"});
  assert.deepEqual(dashboardSections("ADMIN"), {inventory: true, map: true, leaderboard: true, leadScope: "COMPANY"});
  assert.deepEqual(dashboardSections("AGENT"), {inventory: true, map: true, leaderboard: false, leadScope: "ASSIGNED_TO_YOU"});
  assert.deepEqual(dashboardSections("MANAGER"), {inventory: false, map: false, leaderboard: false, leadScope: "ASSIGNED_TO_YOU"});
  assert.deepEqual(dashboardSections("UNKNOWN"), {inventory: true, map: true, leaderboard: false, leadScope: "ASSIGNED_TO_YOU"});
});

test("a failed section shows a safe message, never the raw error", () => {
  const safe = (reason: unknown) => reason instanceof RangeError ? reason.message : null;
  assert.deepEqual(toSection({status: "fulfilled", value: 3}, safe, "Failed."), {status: "ok", data: 3});
  assert.deepEqual(toSection({status: "rejected", reason: new RangeError("Choose a shorter period.")}, safe, "Failed."), {status: "error", message: "Choose a shorter period."});
  assert.deepEqual(toSection({status: "rejected", reason: new Error("connection string postgres://secret")}, safe, "Failed."), {status: "error", message: "Failed."});
});
