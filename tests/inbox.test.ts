import { metaCheckAdvice, routesAccountWebhooks } from "../src/modules/inbox/whatsapp-check";
import assert from "node:assert/strict";
import { test } from "node:test";
import { channelIdentity, identityMatchesContact, matchDecision, normalizeEmailIdentity, normalizePhoneIdentity } from "../src/modules/inbox/identity";
import { STATUS_ACTIONS, canAssign, isOptOutMessage, nextCursor, preview, serviceWindow } from "../src/modules/inbox/policy";

// Fictional identities only (+44 7700 900xxx is reserved for drama; example.test is a reserved domain).
test("identities are exact normalized phones and plain email addresses", () => {
  assert.equal(normalizePhoneIdentity("+44 7700 900123"), "+447700900123");
  assert.equal(normalizePhoneIdentity("050 123 4567"), "+971501234567");
  assert.equal(normalizePhoneIdentity("12345"), null);
  assert.equal(normalizeEmailIdentity("Layla Example <Layla@Example.TEST>"), "layla@example.test");
  assert.equal(normalizeEmailIdentity("not an email"), null);
  assert.equal(normalizeEmailIdentity("a@b"), null, "a domain needs a dot");
  assert.equal(normalizeEmailIdentity("<script>@x.test"), null);
  assert.deepEqual(channelIdentity("WHATSAPP", {phone: "+447700900123", email: "x@example.test"}), {kind: "PHONE", value: "+447700900123"});
  assert.deepEqual(channelIdentity("EMAIL", {phone: "+447700900123", email: "X@example.test"}), {kind: "EMAIL", value: "x@example.test"});
  assert.deepEqual(channelIdentity("WEBSITE", {phone: "+447700900123", email: null}), {kind: "PHONE", value: "+447700900123"});
  assert.equal(channelIdentity("WHATSAPP", {email: "x@example.test"}), null, "a WhatsApp sender needs a number");
});

test("matching never guesses: one contact links, several or none stay for a person", () => {
  assert.deepEqual(matchDecision([]), {status: "UNKNOWN"});
  assert.deepEqual(matchDecision([{id: "c1", leads: []}, {id: "c2", leads: []}]), {status: "AMBIGUOUS", candidates: 2});
  assert.deepEqual(matchDecision([{id: "c1", leads: [{id: "l1", assignedMembershipId: "m1"}]}, {id: "c1", leads: [{id: "l1", assignedMembershipId: "m1"}]}]),
    {status: "MATCHED", contactId: "c1", leadId: "l1", assignedMembershipId: "m1"}, "the same contact found by phone and email is one match");
  assert.deepEqual(matchDecision([{id: "c1", leads: [{id: "l1"}, {id: "l2"}]}]), {status: "MATCHED", contactId: "c1", leadId: null, assignedMembershipId: null}, "several leads: only the contact is linked");
  assert.equal(identityMatchesContact("+447700900123", {normalizedPhone: null, normalizedAlternatePhone: "+447700900123"}), true);
  assert.equal(identityMatchesContact("x@example.test", {normalizedEmail: "y@example.test"}), false);
});

test("assignment, status, opt-out and the WhatsApp service window follow the documented rules", () => {
  assert.equal(canAssign("MANAGER", {toSelf: false, unassign: true}), true);
  assert.equal(canAssign("AGENT", {toSelf: true, unassign: false}), true);
  assert.equal(canAssign("AGENT", {toSelf: false, unassign: false}), false, "agents cannot give conversations to others");
  assert.equal(canAssign("AGENT", {toSelf: false, unassign: true}), false);
  assert.ok(STATUS_ACTIONS.CLOSED.includes("OPEN") && STATUS_ACTIONS.RESOLVED.includes("OPEN"), "any conversation can be reopened");
  assert.equal(isOptOutMessage("STOP"), true);
  assert.equal(isOptOutMessage(" unsubscribe. "), true);
  assert.equal(isOptOutMessage("إلغاء"), true);
  assert.equal(isOptOutMessage("Please don't stop sending me listings"), false, "only a message that is the keyword");
  const now = Date.parse("2026-11-04T12:00:00Z");
  assert.equal(serviceWindow("2026-11-04T00:00:00Z", now).open, true);
  assert.equal(serviceWindow("2026-11-03T11:59:00Z", now).open, false, "more than 24 hours since the customer wrote");
  assert.equal(serviceWindow(null, now).open, false);
  assert.equal(preview("  Hello\n\nthere  "), "Hello there");
  assert.equal(preview("x".repeat(300)).length, 200);
});

test("cursors carry the last timestamp and the IDs already shown at that instant", () => {
  const rows = [{id: "a", at: "t3"}, {id: "b", at: "t2"}, {id: "c", at: "t2"}, {id: "d", at: "t1"}];
  assert.equal(nextCursor(rows, row => row.at, 4), null, "no further page");
  assert.deepEqual(nextCursor(rows, row => row.at, 3), {at: "t2", seen: ["b", "c"]});
});

// --- WhatsApp connection check: routing webhooks and plain advice ------------------------------------

test("Check connection routes a WhatsApp account's webhooks only on hosted servers", () => {
  assert.equal(routesAccountWebhooks({ESTATEOS_ENVIRONMENT: "staging"}), true);
  assert.equal(routesAccountWebhooks({ESTATEOS_ENVIRONMENT: "production"}), true);
  assert.equal(routesAccountWebhooks({ESTATEOS_ENVIRONMENT: "local"}), false, "local development keeps the Meta app's default webhook");
  assert.equal(routesAccountWebhooks({}), false);
  assert.equal(routesAccountWebhooks({ESTATEOS_ENVIRONMENT: "unknown"}), false, "an unknown environment never moves webhooks");
});

test("Meta's usual refusals come with plain advice", () => {
  assert.match(metaCheckAdvice("100", "account"), /Messaging accounts.*Assign people.*System users/);
  assert.match(metaCheckAdvice("100", "account"), /not the Phone number ID/);
  assert.match(metaCheckAdvice("100", "number"), /Phone number ID/);
  assert.match(metaCheckAdvice("190", "webhooks"), /new system user token/);
  assert.match(metaCheckAdvice("200", "webhooks"), /Full control/);
  assert.match(metaCheckAdvice("2200", "webhooks"), /verify token/);
  assert.equal(metaCheckAdvice("131042", "account"), "", "other codes keep Meta's own message only");
});
