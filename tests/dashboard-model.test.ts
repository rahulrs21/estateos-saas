import assert from "node:assert/strict";
import { test } from "node:test";
import {
  activityLabel, calendarDate, classifyDue, dashboardSections, fillVolumeSeries, firstName, greetingFor, orderStages, parseDashboardRange, periodChange,
  previousRange, rangeDates, relativeTime, shareSlices, taskAgenda, toSection, topAgents, zonedHour,
} from "../src/modules/dashboard/dashboard-model";

// Dashboard rules (src/modules/dashboard/dashboard-model.ts). Fictional names and IDs only.

test("the reporting range accepts only the offered periods and defaults to 30 days", () => {
  assert.equal(parseDashboardRange("7d"), "7d");
  assert.equal(parseDashboardRange("90d"), "90d");
  assert.equal(parseDashboardRange("1y"), "1y");
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

test("the 1-year range uses monthly buckets that start on the first of the month", () => {
  assert.deepEqual(rangeDates("1y", "2026-11-26"), {from: "2025-11-27", to: "2026-11-26", bucket: "month"});
  const series = fillVolumeSeries([{label: "2025-11-01", count: 4}, {label: "2026-11-01", count: 9}], "2025-11-27", "2026-11-26", "month");
  assert.equal(series.length, 13);
  assert.deepEqual(series[0], {date: "2025-11-01", count: 4});
  assert.deepEqual(series[1], {date: "2025-12-01", count: 0});
  assert.deepEqual(series.at(-1), {date: "2026-11-01", count: 9});
});

test("the previous period is the same length and ends the day before", () => {
  assert.deepEqual(previousRange("2026-10-28", "30d"), {from: "2026-09-28", to: "2026-10-27"});
  assert.deepEqual(previousRange("2026-11-20", "7d"), {from: "2026-11-13", to: "2026-11-19"});
});

test("period change is rounded, signed by direction, and honest about empty periods", () => {
  assert.deepEqual(periodChange(58, 50), {direction: "up", percent: 16});
  assert.deepEqual(periodChange(40, 50), {direction: "down", percent: 20});
  assert.deepEqual(periodChange(50, 50), {direction: "flat", percent: 0});
  assert.deepEqual(periodChange(3, 0), {direction: "new"});
  assert.equal(periodChange(0, 0), null);
});

test("the greeting follows the Dubai hour", () => {
  assert.equal(zonedHour(new Date("2026-11-26T03:00:00Z")), 7);
  assert.equal(greetingFor(7), "Good morning");
  assert.equal(greetingFor(12), "Good afternoon");
  assert.equal(greetingFor(17), "Good evening");
  assert.equal(greetingFor(2), "Good evening");
  assert.equal(firstName("Rahul Raghunanda"), "Rahul");
  assert.equal(firstName("someone@example.test"), null);
  assert.equal(firstName("  "), null);
});

test("donut slices keep the largest sources and fold the rest into Other", () => {
  const result = shareSlices([
    {label: "Added by hand", count: 50}, {label: "Meta lead ad", count: 4}, {label: "Landing page", count: 2},
    {label: "Website form", count: 1}, {label: "WhatsApp", count: 1}, {label: "Email", count: 1}, {label: "Portal", count: 0},
  ]);
  assert.equal(result.total, 59);
  assert.deepEqual(result.slices.map(slice => slice.label), ["Added by hand", "Meta lead ad", "Landing page", "Email", "Other"]);
  assert.equal(result.slices.at(-1)?.count, 2);
  assert.equal(result.slices[0].percent, 85);
  assert.deepEqual(shareSlices([{label: "A", count: 0}]), {total: 0, slices: []});
});

test("activity rows get a plain label and an icon family", () => {
  assert.deepEqual(activityLabel("LEAD_STATUS_CHANGED", {status: "NEGOTIATION"}), {title: "Lead moved to negotiation", tone: "stage"});
  assert.deepEqual(activityLabel("LEAD_STATUS_CHANGED", null), {title: "Lead stage changed", tone: "stage"});
  assert.equal(activityLabel("WEBSITE_LEAD_CAPTURED").tone, "lead");
  assert.equal(activityLabel("FOLLOW_UP_COMPLETED").title, "Follow-up completed");
  assert.deepEqual(activityLabel("SOMETHING_NEW"), {title: "Lead activity", tone: "other"});
  const now = new Date("2026-11-26T12:00:00Z");
  assert.equal(relativeTime("2026-11-26T11:59:30Z", now), "just now");
  assert.equal(relativeTime("2026-11-26T11:48:00Z", now), "12 min ago");
  assert.equal(relativeTime("2026-11-26T09:00:00Z", now), "3 h ago");
  assert.equal(relativeTime("2026-11-24T12:00:00Z", now), "2 days ago");
  assert.equal(relativeTime("2026-11-01T12:00:00Z", now), "1 Nov");
});
