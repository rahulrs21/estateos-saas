import assert from "node:assert/strict";
import { test } from "node:test";
import { ACTIONS, TRIGGERS, parseWorkflowDefinition, WorkflowDefinitionError } from "../src/modules/automations/definition";
import { evaluateCondition } from "../src/modules/automations/conditions";
import { WORKFLOW_TEMPLATES } from "../src/modules/automations/templates";
import { finalCallTrigger } from "../src/modules/communications/call-state";
import { meetingInputSchema, meetingLinkProblem, parseDecisions } from "../src/modules/communications/meetings";
import { agentReport, meetingTotals, type MetricCall, type MetricMeeting } from "../src/modules/communications/metrics";

test("finished calls start one workflow event; unanswered outgoing attempts start none", () => {
  assert.equal(finalCallTrigger("OUTBOUND", "COMPLETED"), "call.completed");
  assert.equal(finalCallTrigger("INBOUND", "COMPLETED"), "call.completed");
  assert.equal(finalCallTrigger("OUTBOUND", "FAILED"), "call.failed");
  assert.equal(finalCallTrigger("INBOUND", "NO_ANSWER"), "call.missed");
  assert.equal(finalCallTrigger("INBOUND", "BUSY"), "call.missed");
  assert.equal(finalCallTrigger("INBOUND", "CANCELLED"), "call.missed");
  assert.equal(finalCallTrigger("OUTBOUND", "NO_ANSWER"), null);
  assert.equal(finalCallTrigger("OUTBOUND", "BUSY"), null);
  assert.equal(finalCallTrigger("INBOUND", "RINGING"), null, "only final statuses");
});

test("meeting links: https on the provider's own hosts; no link for in-person or phone meetings", () => {
  assert.equal(meetingLinkProblem("GOOGLE_MEET", "https://meet.google.com/abc-defg-hij"), null);
  assert.equal(meetingLinkProblem("ZOOM", "https://us02web.zoom.us/j/123456789"), null);
  assert.equal(meetingLinkProblem("ZOOM", "https://zoom.us/j/1"), null);
  assert.equal(meetingLinkProblem("MICROSOFT_TEAMS", "https://teams.microsoft.com/l/meetup-join/x"), null);
  assert.equal(meetingLinkProblem("WEBEX", "https://example.webex.com/meet/agent"), null);
  assert.equal(meetingLinkProblem("OTHER", "https://video.example.com/room"), null);
  assert.match(meetingLinkProblem("GOOGLE_MEET", "http://meet.google.com/abc") ?? "", /https/);
  assert.match(meetingLinkProblem("ZOOM", "https://zoom.us.evil.example/j/1") ?? "", /not a Zoom link/);
  assert.match(meetingLinkProblem("GOOGLE_MEET", "https://meet.google.com.evil.example/x") ?? "", /not a Google Meet link/);
  assert.match(meetingLinkProblem("OTHER", "https://127.0.0.1/room") ?? "", /public/);
  assert.match(meetingLinkProblem("OTHER", "https://localhost/room") ?? "", /public/);
  assert.match(meetingLinkProblem("OTHER", "https://user:pass@video.example.com/") ?? "", /user name/);
  assert.match(meetingLinkProblem("OTHER", "javascript:alert(1)") ?? "", /https/);
  assert.match(meetingLinkProblem("ZOOM", null) ?? "", /Add the meeting link/);
  assert.equal(meetingLinkProblem("IN_PERSON", null), null);
  assert.match(meetingLinkProblem("PHONE", "https://zoom.us/j/1") ?? "", /no link/);
});

test("meeting details: end after start, at most 12 hours, no unknown fields", () => {
  const base = {title: "Consultation", provider: "IN_PERSON", startsAt: "2026-11-05T10:00:00+04:00", endsAt: "2026-11-05T11:00:00+04:00", location: "Office"};
  assert.equal(meetingInputSchema.safeParse(base).success, true);
  assert.equal(meetingInputSchema.safeParse({...base, endsAt: base.startsAt}).success, false);
  assert.equal(meetingInputSchema.safeParse({...base, endsAt: "2026-11-06T10:00:00+04:00"}).success, false);
  assert.equal(meetingInputSchema.safeParse({...base, provider: "ZOOM"}).success, false, "a video meeting needs its link");
  assert.equal(meetingInputSchema.safeParse({...base, organizationId: "x"}).success, false);
  assert.deepEqual(parseDecisions("not json"), {});
  assert.deepEqual(parseDecisions("[1]"), {});
});

test("reports keep attempts, answered calls, conversations and meetings apart per agent", () => {
  const call = (agentId: string, patch: Partial<MetricCall>): MetricCall => ({direction: "OUTBOUND", callStatus: "COMPLETED", answeredAt: "2026-11-01T08:00:00Z", outcome: null, durationSeconds: 60, agentId, agentName: agentId, ...patch});
  const calls = [
    call("a", {outcome: "INTERESTED"}), call("a", {callStatus: "NO_ANSWER", answeredAt: null, durationSeconds: 0}), call("a", {outcome: "VIEWING_REQUESTED"}),
    call("b", {direction: "INBOUND", callStatus: "NO_ANSWER", answeredAt: null, durationSeconds: 0}),
  ];
  const meetings: MetricMeeting[] = [{status: "COMPLETED", organizerId: "a", organizerName: "a"}, {status: "NO_SHOW", organizerId: "c", organizerName: "Carol"}];
  const rows = agentReport(calls, meetings);
  const a = rows.find(row => row.agentId === "a")!;
  assert.equal(a.attempts, 3);
  assert.equal(a.answered, 2);
  assert.equal(a.answerRate, 67);
  assert.equal(a.conversations, 2);
  assert.equal(a.interested, 1);
  assert.equal(a.viewingRequested, 1);
  assert.equal(a.meetings.held, 1);
  const b = rows.find(row => row.agentId === "b")!;
  assert.equal(b.missed, 1);
  assert.equal(b.answerRate, null, "no outgoing attempts, no rate");
  assert.ok(rows.some(row => row.agentId === "c" && row.meetings.noShow === 1 && row.attempts === 0), "meeting-only organizers are listed");
  assert.deepEqual(meetingTotals(meetings), {scheduled: 0, held: 1, noShow: 1, cancelled: 0});
});

test("communication triggers act on calls and meetings, with lead facts through the record", () => {
  for (const trigger of ["call.started", "call.completed", "call.missed", "call.failed", "call.summary_ready"] as const) {
    assert.equal(TRIGGERS[trigger].target, "CALL");
    assert.ok("call.outcome" in TRIGGERS[trigger].facts && "lead.status" in TRIGGERS[trigger].facts, trigger);
  }
  assert.equal(TRIGGERS["meeting.completed"].target, "MEETING");
  assert.deepEqual(ACTIONS["call.summarize"].targets, ["CALL"]);
  assert.equal(ACTIONS["call.summarize"].ai, true);
  assert.equal(ACTIONS["call.summarize"].risk, "LOW");
  assert.ok(!ACTIONS["lead.distribute"].targets.includes("CALL"), "calls never reassign leads");
  const definition = (trigger: string, steps: unknown[]) => ({schemaVersion: 1, name: "Test workflow", trigger, steps});
  assert.throws(() => parseWorkflowDefinition(definition("meeting.completed", [{id: "s", type: "call.summarize"}])), WorkflowDefinitionError, "summaries only for calls");
  assert.throws(() => parseWorkflowDefinition(definition("call.summary_ready", [{id: "s", type: "call.summarize"}])), /cannot summarise the call again/);
  assert.throws(() => parseWorkflowDefinition({...definition("call.missed", [{id: "s", type: "notification.create", audience: "ASSIGNEE", title: "x", message: "y"}]), conditions: {field: "call.outcome", operator: "eq", value: "SOLD"}}), /not one of/, "outcomes are allowlisted");
  assert.throws(() => parseWorkflowDefinition({...definition("call.missed", [{id: "s", type: "notification.create", audience: "ASSIGNEE", title: "x", message: "y"}]), conditions: {field: "call.notes", operator: "contains", value: "x"}}), /not available/, "no call notes in conditions");
  const missed = parseWorkflowDefinition({...definition("call.missed", [{id: "s", type: "notification.create", audience: "ASSIGNEE", title: "Missed", message: "Call back"}]), conditions: {field: "call.type", operator: "ne", value: "MARKETING"}});
  assert.equal(evaluateCondition(missed.conditions, {"call.type": "INBOUND_ENQUIRY"}, new Date()), true);
});

test("templates G-I: missed calls, call summaries and meeting follow-ups use only internal, low-risk steps", () => {
  const byKey = Object.fromEntries(WORKFLOW_TEMPLATES.map(template => [template.key, parseWorkflowDefinition(template.definition)]));
  assert.equal(byKey.G.trigger, "call.missed");
  assert.deepEqual(byKey.G.steps.map(step => step.type), ["task.create", "notification.create"]);
  assert.equal(byKey.H.trigger, "call.completed");
  assert.ok(byKey.H.steps.some(step => step.type === "call.summarize"));
  assert.equal(byKey.I.trigger, "meeting.completed");
  assert.deepEqual(byKey.I.steps.map(step => step.type), ["task.create"]);
});
