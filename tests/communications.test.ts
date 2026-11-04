import assert from "node:assert/strict";
import { test } from "node:test";
import { isAnswered, isConversation, isMissed, transition } from "../src/modules/communications/call-state";
import { DEFAULT_RULES, evaluateCall, localMoment, rulesFrom, type CallCheck, type PriorCall } from "../src/modules/communications/compliance";
import { CALL_OUTCOMES, SUPPRESSING_OUTCOMES, parseCallingCodes, suppresses } from "../src/modules/communications/model";
import { audioFacts, detectLanguage, parseTranscript, timestamp, TranscriptFormatError } from "../src/modules/communications/media";
import { callTotals, outcomeCounts, totalsByAgent, type MetricCall } from "../src/modules/communications/metrics";
import { destinationProblems, displayNumber, normalizeCallNumber, numbersNeedingUpdate, numbersOnRecord } from "../src/modules/communications/phone";

// Synthetic numbers and times only (no real customer data).
const NUMBER = "+971501234567";
// 2026-11-03 10:00 in Dubai (UTC+4, no daylight saving).
const dubai = (local: string) => new Date(`${local}+04:00`);

const check = (extra: Partial<CallCheck> = {}): CallCheck => ({
  direction: "OUTBOUND", callType: "FOLLOW_UP", at: dubai("2026-11-03T10:00:00"), number: NUMBER,
  rules: {...DEFAULT_RULES}, suppressions: [], priorCalls: [], ...extra,
});
const prior = (local: string, extra: Partial<PriorCall> = {}): PriorCall => ({
  startedAt: dubai(local).toISOString(), direction: "OUTBOUND", callType: "FOLLOW_UP", callStatus: "COMPLETED", answeredAt: dubai(local).toISOString(), ...extra,
});
const marketingRules = {...DEFAULT_RULES, telemarketingEnabled: true, telemarketingApprovalReference: "TDRA-TEST-001"};

test("call states only move forward and final states never change", () => {
  assert.deepEqual(transition("INITIATED", "RINGING"), {apply: true, next: "RINGING"});
  assert.deepEqual(transition("RINGING", "IN_PROGRESS"), {apply: true, next: "IN_PROGRESS"});
  assert.deepEqual(transition("IN_PROGRESS", "COMPLETED"), {apply: true, next: "COMPLETED"});
  assert.deepEqual(transition("RINGING", "COMPLETED"), {apply: true, next: "COMPLETED"}, "a provider may report only the final state");
  assert.deepEqual(transition("RINGING", "RINGING"), {apply: false, reason: "DUPLICATE"});
  assert.deepEqual(transition("IN_PROGRESS", "RINGING"), {apply: false, reason: "OUT_OF_ORDER"});
  assert.deepEqual(transition("COMPLETED", "FAILED"), {apply: false, reason: "FINAL"});
  assert.deepEqual(transition("NO_ANSWER", "IN_PROGRESS"), {apply: false, reason: "FINAL"});
  assert.deepEqual(transition("IN_PROGRESS", "NO_ANSWER"), {apply: false, reason: "NOT_ALLOWED"}, "an answered call cannot become unanswered");
});

test("answered, missed and conversation are separate facts", () => {
  assert.equal(isAnswered({callStatus: "NO_ANSWER", answeredAt: null}), false);
  assert.equal(isAnswered({callStatus: "COMPLETED", answeredAt: null}), true);
  assert.equal(isMissed({direction: "INBOUND", callStatus: "NO_ANSWER", answeredAt: null}), true);
  assert.equal(isMissed({direction: "OUTBOUND", callStatus: "NO_ANSWER", answeredAt: null}), false, "an unanswered outgoing call is an attempt, not a missed call");
  assert.equal(isMissed({direction: "INBOUND", callStatus: "RINGING", answeredAt: null}), false, "still ringing");
  assert.equal(isConversation({direction: "OUTBOUND", callStatus: "COMPLETED", answeredAt: "2026-11-03T06:00:00Z", outcome: null}), false, "answered without an outcome is not a recorded conversation");
  assert.equal(isConversation({direction: "OUTBOUND", callStatus: "COMPLETED", answeredAt: "2026-11-03T06:00:00Z", outcome: "INTERESTED"}), true);
  assert.equal(isConversation({direction: "OUTBOUND", callStatus: "COMPLETED", answeredAt: "2026-11-03T06:00:00Z", outcome: "WRONG_NUMBER"}), false);
  assert.equal(isConversation({direction: "OUTBOUND", callStatus: "NO_ANSWER", answeredAt: null, outcome: "INTERESTED"}), false, "a dial attempt is never a conversation");
});

test("numbers come from the record, normalized to E.164 with allowed calling codes only", () => {
  assert.equal(normalizeCallNumber("050 123 4567"), NUMBER);
  assert.equal(normalizeCallNumber("00971501234567"), NUMBER);
  assert.equal(normalizeCallNumber("12345"), null);
  assert.equal(normalizeCallNumber(null), null);
  assert.deepEqual(numbersOnRecord({phone: "050 123 4567", alternatePhone: "+971501234567"}), [NUMBER], "duplicates removed");
  assert.deepEqual(numbersOnRecord({normalizedPhone: NUMBER, normalizedAlternatePhone: "+447700900123"}), [NUMBER, "+447700900123"]);
  // The stored normalized number is what the database compares calls against: a phone on file without
  // it (saved in display form, for example "+44 7700 900049") is not offered, and is flagged instead.
  assert.deepEqual(numbersOnRecord({phone: "+44 7700 900049", normalizedPhone: null, alternatePhone: null, normalizedAlternatePhone: null}), []);
  assert.equal(numbersNeedingUpdate({phone: "+44 7700 900049", normalizedPhone: null, alternatePhone: null, normalizedAlternatePhone: null}), 1);
  assert.equal(numbersNeedingUpdate({phone: NUMBER, normalizedPhone: NUMBER, alternatePhone: null, normalizedAlternatePhone: null}), 0);
  assert.equal(numbersNeedingUpdate({phone: "050 123 4567"}), 0, "records without stored forms (a lead without a contact) are normalized on the fly");
  assert.deepEqual(destinationProblems(NUMBER, ["971"]), []);
  assert.deepEqual(destinationProblems("+447700900123", ["971"]), ["COUNTRY_NOT_ALLOWED"]);
  assert.deepEqual(destinationProblems("+9719001234567", ["971"]), ["PREMIUM_RATE_NUMBER"]);
  assert.deepEqual(destinationProblems(null, ["971"]), ["INVALID_NUMBER"]);
  assert.deepEqual(parseCallingCodes("971, 44,+1,abc"), ["971", "44"]);
  assert.equal(displayNumber(NUMBER), "+971 50 123 4567");
  assert.equal(displayNumber("+97143330000"), "+971 4 333 0000");
  assert.equal(displayNumber("+447700900123"), "+447700900123", "other countries are shown as stored");
});

test("do-not-call, rejected offer and wrong number outcomes suppress the number with the documented scope", () => {
  assert.deepEqual(CALL_OUTCOMES.filter(suppresses), ["WRONG_NUMBER", "DO_NOT_CALL_REQUESTED", "OFFER_REJECTED"]);
  assert.deepEqual(SUPPRESSING_OUTCOMES.DO_NOT_CALL_REQUESTED, {scope: "ALL", reason: "OPT_OUT"});
  assert.deepEqual(SUPPRESSING_OUTCOMES.OFFER_REJECTED, {scope: "MARKETING", reason: "OFFER_REJECTED"});
  assert.equal(suppresses(null), false);
});

test("a normal follow-up call inside calling hours has no issues; incoming calls are never checked", () => {
  assert.deepEqual(evaluateCall(check()), []);
  assert.deepEqual(evaluateCall(check({direction: "INBOUND", at: dubai("2026-11-03T23:30:00"), suppressions: [{scope: "ALL", reason: "OPT_OUT", createdAt: "2026-01-01T00:00:00Z"}]})), []);
});

test("opt-outs apply to every call; marketing opt-outs only to marketing calls; later opt-outs do not flag earlier calls", () => {
  const optOut = {scope: "ALL" as const, reason: "OPT_OUT" as const, createdAt: dubai("2026-11-01T09:00:00").toISOString()};
  assert.deepEqual(evaluateCall(check({suppressions: [optOut]})), ["NUMBER_SUPPRESSED"]);
  const rejected = {scope: "MARKETING" as const, reason: "OFFER_REJECTED" as const, createdAt: dubai("2026-11-01T09:00:00").toISOString()};
  assert.deepEqual(evaluateCall(check({suppressions: [rejected]})), [], "a service follow-up is still allowed");
  assert.ok(evaluateCall(check({callType: "MARKETING", rules: marketingRules, suppressions: [rejected]})).includes("MARKETING_SUPPRESSED"));
  const later = {...optOut, createdAt: dubai("2026-11-03T12:00:00").toISOString()};
  assert.deepEqual(evaluateCall(check({suppressions: [later]})), [], "a manual log of a call before the opt-out is not flagged");
});

test("calling hours use the company timezone", () => {
  assert.deepEqual(evaluateCall(check({at: dubai("2026-11-03T07:59:00")})), ["OUTSIDE_CALLING_HOURS"]);
  assert.deepEqual(evaluateCall(check({at: dubai("2026-11-03T21:00:00")})), ["OUTSIDE_CALLING_HOURS"], "the end time is exclusive");
  assert.deepEqual(localMoment(new Date("2026-11-03T04:30:00Z"), "Asia/Dubai"), {date: "2026-11-03", time: "08:30"});
  assert.deepEqual(localMoment(new Date("2026-11-03T04:30:00Z"), "Not/AZone"), {date: "2026-11-03", time: "08:30"}, "an invalid timezone falls back to Dubai");
});

test("marketing calls need the TDRA approval and stay within 09:00-18:00", () => {
  assert.deepEqual(evaluateCall(check({callType: "MARKETING"})), ["TELEMARKETING_NOT_ENABLED"]);
  assert.deepEqual(evaluateCall(check({callType: "MARKETING", rules: {...DEFAULT_RULES, telemarketingEnabled: true, telemarketingApprovalReference: null}})), ["TELEMARKETING_NOT_ENABLED"]);
  assert.deepEqual(evaluateCall(check({callType: "MARKETING", rules: marketingRules})), []);
  assert.deepEqual(evaluateCall(check({callType: "MARKETING", rules: marketingRules, at: dubai("2026-11-03T18:30:00")})), ["OUTSIDE_MARKETING_HOURS"], "inside company hours but after 18:00");
  assert.deepEqual(evaluateCall(check({callType: "MARKETING", rules: marketingRules, at: dubai("2026-11-03T08:30:00")})), ["OUTSIDE_MARKETING_HOURS"]);
});

test("frequency limits count earlier calls by any agent on the same local day and week", () => {
  const twoToday = [prior("2026-11-03T08:10:00"), prior("2026-11-03T09:00:00")];
  assert.deepEqual(evaluateCall(check({priorCalls: twoToday})), [], "two earlier calls, limit three");
  assert.deepEqual(evaluateCall(check({priorCalls: [...twoToday, prior("2026-11-03T09:30:00")]})), ["CONTACT_DAILY_LIMIT"]);
  assert.deepEqual(evaluateCall(check({priorCalls: [prior("2026-11-02T23:30:00"), prior("2026-11-02T22:00:00"), prior("2026-11-02T21:00:00")]})), [], "yesterday in Dubai does not count");
  assert.deepEqual(evaluateCall(check({priorCalls: [prior("2026-11-03T11:00:00"), prior("2026-11-03T12:00:00"), prior("2026-11-03T13:00:00")]})), [], "later calls do not count for an earlier manual log");
  assert.deepEqual(evaluateCall(check({callId: "call-1", priorCalls: [{...prior("2026-11-03T09:00:00"), id: "call-1"}, prior("2026-11-03T09:10:00"), prior("2026-11-03T09:20:00")]})), [], "the call itself is excluded");

  const marketing = (local: string, answered: boolean) => prior(local, {callType: "MARKETING", callStatus: answered ? "COMPLETED" : "NO_ANSWER", answeredAt: answered ? dubai(local).toISOString() : null});
  assert.deepEqual(evaluateCall(check({callType: "MARKETING", rules: marketingRules, priorCalls: [marketing("2026-11-03T09:15:00", false)]})), ["MARKETING_DAILY_LIMIT"]);
  assert.deepEqual(evaluateCall(check({callType: "MARKETING", rules: marketingRules, priorCalls: [marketing("2026-10-30T10:00:00", false)]})), [], "one unanswered call this week");
  assert.deepEqual(evaluateCall(check({callType: "MARKETING", rules: marketingRules, priorCalls: [marketing("2026-10-30T10:00:00", false), marketing("2026-11-01T10:00:00", false)]})), ["MARKETING_UNANSWERED_LIMIT"]);
  assert.deepEqual(evaluateCall(check({callType: "MARKETING", rules: marketingRules, priorCalls: [marketing("2026-10-27T09:00:00", false), marketing("2026-11-01T10:00:00", false)]})), [], "older than 7 days");
  assert.deepEqual(evaluateCall(check({callType: "MARKETING", rules: marketingRules, priorCalls: [marketing("2026-10-30T10:00:00", true), marketing("2026-11-01T10:00:00", false)]})), [], "answered calls are not unanswered attempts");
});

test("stored settings fill gaps with the safe defaults", () => {
  assert.deepEqual(rulesFrom(null), DEFAULT_RULES);
  const rules = rulesFrom({telemarketingEnabled: true, telemarketingApprovalReference: "TDRA-1", maxCallsPerContactPerDay: null});
  assert.equal(rules.telemarketingEnabled, true);
  assert.equal(rules.maxCallsPerContactPerDay, 3, "a null required value keeps the default");
  assert.equal(DEFAULT_RULES.recordingEnabled, false);
  assert.equal(DEFAULT_RULES.aiAnalysisEnabled, false);
  assert.equal(DEFAULT_RULES.telemarketingEnabled, false);
  assert.equal(DEFAULT_RULES.liveCallingAttestedAt, null);
});

test("metrics keep attempts, answered calls, missed calls, conversations and outcomes apart", () => {
  const call = (extra: Partial<MetricCall>): MetricCall => ({direction: "OUTBOUND", callStatus: "COMPLETED", answeredAt: "2026-11-03T06:00:00Z", outcome: null, durationSeconds: 60, agentId: "a", agentName: "Agent A", ...extra});
  const calls = [
    call({outcome: "INTERESTED", durationSeconds: 120}),
    call({outcome: null, durationSeconds: 60}),
    call({callStatus: "NO_ANSWER", answeredAt: null, durationSeconds: 0}),
    call({callStatus: "BUSY", answeredAt: null, durationSeconds: 0, agentId: "b", agentName: "Agent B"}),
    call({direction: "INBOUND", callStatus: "NO_ANSWER", answeredAt: null, durationSeconds: 0}),
    call({direction: "INBOUND", outcome: "WRONG_NUMBER", durationSeconds: 30}),
    call({callStatus: "RINGING", answeredAt: null, durationSeconds: 0}),
  ];
  const totals = callTotals(calls);
  assert.deepEqual({...totals}, {attempts: 4, answered: 2, unanswered: 2, incoming: 2, incomingAnswered: 1, missed: 1, conversations: 1, averageAnsweredSeconds: 70, inProgress: 1});
  assert.equal(outcomeCounts(calls).find(item => item.outcome === "INTERESTED")?.count, 1);
  assert.equal(outcomeCounts([call({callStatus: "NO_ANSWER", answeredAt: null, outcome: "INTERESTED"})]).find(item => item.outcome === "INTERESTED")?.count, 0, "an outcome on an unanswered call is not counted");
  const agents = totalsByAgent(calls);
  assert.deepEqual(agents.map(row => [row.agentName, row.attempts, row.answered]), [["Agent A", 3, 2], ["Agent B", 1, 0]]);
  assert.equal(callTotals([]).averageAnsweredSeconds, null);
});
/** A silent PCM WAV of the given length (synthetic test recording). */
function wav(seconds: number, sampleRate = 8000) {
  const dataSize = seconds * sampleRate * 2;
  const bytes = new Uint8Array(44 + dataSize);
  const view = new DataView(bytes.buffer);
  const text = (at: number, value: string) => [...value].forEach((char, index) => view.setUint8(at + index, char.charCodeAt(0)));
  text(0, "RIFF"); view.setUint32(4, 36 + dataSize, true); text(8, "WAVE"); text(12, "fmt "); view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); view.setUint16(22, 1, true); view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true); view.setUint16(34, 16, true); text(36, "data"); view.setUint32(40, dataSize, true);
  return bytes;
}
/** MPEG-1 Layer III frames at 128 kbps, 44.1 kHz (417 bytes, 1152 samples each), optionally after an ID3 tag. */
function mp3(frames: number, id3 = false) {
  const tag = id3 ? [0x49, 0x44, 0x33, 3, 0, 0, 0, 0, 0, 4, 0, 0, 0, 0] : [];
  const bytes = new Uint8Array(tag.length + frames * 417);
  bytes.set(tag);
  for (let index = 0; index < frames; index++) bytes.set([0xff, 0xfb, 0x90, 0x64], tag.length + index * 417);
  return bytes;
}

test("recordings are recognised by their contents with their real duration", () => {
  assert.deepEqual(audioFacts(wav(3)), {contentType: "audio/wav", extension: "wav", durationSeconds: 3});
  const facts = audioFacts(mp3(383));
  assert.equal(facts?.contentType, "audio/mpeg");
  assert.equal(facts?.durationSeconds, 10, "383 frames x 1152 samples / 44100 Hz");
  assert.equal(audioFacts(mp3(383, true))?.durationSeconds, 10, "an ID3 tag is skipped");
  assert.equal(audioFacts(new TextEncoder().encode("<html>not audio</html>".padEnd(100, " "))), null);
  assert.equal(audioFacts(new Uint8Array([0x89, 0x50, 0x4e, 0x47, ...new Array(60).fill(0)])), null, "a PNG is not a recording");
  const float = wav(1); new DataView(float.buffer).setUint16(20, 3, true);
  assert.equal(audioFacts(float), null, "only PCM WAV");
});

test("transcripts from WebVTT, SRT and text become segments; markup is removed; limits apply", () => {
  const vtt = parseTranscript("WEBVTT\n\n1\n00:00:01.000 --> 00:00:04.500\n<v Agent>Good morning, this is a synthetic call.\n\n00:00:05.000 --> 00:00:09.000\n<v Customer>I am looking for a <b>two-bedroom</b> apartment.\n");
  assert.equal(vtt.format, "VTT");
  assert.deepEqual(vtt.segments[0], {id: 1, startSeconds: 1, endSeconds: 4.5, speaker: "Agent", text: "Good morning, this is a synthetic call."});
  assert.equal(vtt.segments[1].text, "I am looking for a two-bedroom apartment.");
  const srt = parseTranscript("1\n00:00:01,000 --> 00:00:03,000\nCustomer: Budget around two million.\n\n2\n00:01:02,500 --> 00:01:05,000\nAgent: Noted.\n");
  assert.equal(srt.format, "SRT");
  assert.deepEqual([srt.segments[0].speaker, srt.segments[0].text, srt.segments[1].startSeconds], ["Customer", "Budget around two million.", 62.5]);
  const plain = parseTranscript("Agent: Hello\n\nCustomer: مرحبا، أبحث عن شقة\n");
  assert.equal(plain.hasTimestamps, false);
  assert.equal(plain.segments[1].speaker, "Customer");
  assert.throws(() => parseTranscript("WEBVTT\n\nno timings here\n"), TranscriptFormatError);
  assert.throws(() => parseTranscript("   \n\n"), TranscriptFormatError);
  assert.throws(() => parseTranscript("x".repeat(1024 * 1024 + 1)), TranscriptFormatError);
  assert.equal(timestamp(62.5), "1:02");
  assert.equal(timestamp(3725), "1:02:05");
});

test("language detection is an estimate between English, Arabic and mixed", () => {
  assert.equal(detectLanguage("I am looking for a two bedroom apartment in Dubai Marina"), "en");
  assert.equal(detectLanguage("أبحث عن شقة بغرفتي نوم في دبي مارينا قريبة من المترو"), "ar");
  assert.equal(detectLanguage("I am looking for شقة بغرفتي نوم in Dubai Marina قريبة من المترو"), "mixed");
  assert.equal(detectLanguage("ok 123"), "unknown");
});