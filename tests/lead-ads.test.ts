import assert from "node:assert/strict";
import { test } from "node:test";
import {
  MetaPayloadError, classifyGraphError, leadMetadata, mapMetaLead, metaHandshake, metaSignature, parseBudget, parseFieldMapping,
  parseLeadgenWebhook, parseQuestions, parseTransactionType, verifyMetaSignature, type MetaLead,
} from "../src/modules/lead-ads/meta";

// Test secrets and fictional people only (+44 7700 900xxx, example.test). Nothing here contacts Meta.
const SECRET = "test-meta-app-secret-not-real-0001";
const PAGE = "1537430489447687";

const webhook = (changes: unknown[], object = "page") => JSON.stringify({object, entry: [{id: PAGE, time: 1_790_000_000, changes}]});
const leadgen = (value: Record<string, unknown>) => ({field: "leadgen", value: {page_id: PAGE, leadgen_id: "444555666777", form_id: "888999000111", ad_id: "123123123123", adgroup_id: "456456456456", created_time: 1_790_000_000, ...value}});

test("only Meta's signature over the exact body is accepted", () => {
  const body = webhook([leadgen({})]);
  const signature = metaSignature(body, SECRET);
  assert.equal(verifyMetaSignature(body, signature, SECRET), true);
  assert.equal(verifyMetaSignature(body + " ", signature, SECRET), false, "a changed body");
  assert.equal(verifyMetaSignature(body, metaSignature(body, SECRET + "x"), SECRET), false, "another secret");
  assert.equal(verifyMetaSignature(body, null, SECRET), false);
  assert.equal(verifyMetaSignature(body, "sha256=short", SECRET), false);
  assert.equal(verifyMetaSignature(body, signature, ""), false, "no secret configured");
});

test("the subscription check echoes the challenge only for the configured verify token", () => {
  const params = (mode: string, token: string, challenge: string) => new URLSearchParams({"hub.mode": mode, "hub.verify_token": token, "hub.challenge": challenge});
  assert.equal(metaHandshake(params("subscribe", "verify-token-0123456789", "1158201444"), "verify-token-0123456789"), "1158201444");
  assert.equal(metaHandshake(params("subscribe", "wrong-token-0123456789", "1158201444"), "verify-token-0123456789"), null);
  assert.equal(metaHandshake(params("unsubscribe", "verify-token-0123456789", "1158201444"), "verify-token-0123456789"), null);
  assert.equal(metaHandshake(params("subscribe", "verify-token-0123456789", "<script>"), "verify-token-0123456789"), null, "no markup is ever echoed");
  assert.equal(metaHandshake(params("subscribe", "", "1158201444"), ""), null, "no token configured");
});

test("webhook parsing keeps well-formed leadgen changes and ignores everything else", () => {
  const changes = parseLeadgenWebhook(webhook([
    leadgen({}),
    {field: "feed", value: {item: "post"}},
    leadgen({leadgen_id: "not-a-number"}),
    leadgen({leadgen_id: "777888999000", form_id: undefined, ad_id: null, created_time: "yesterday"}),
  ]));
  assert.deepEqual(changes, [
    {pageId: PAGE, leadgenId: "444555666777", formId: "888999000111", adId: "123123123123", adGroupId: "456456456456", createdAt: new Date(1_790_000_000_000).toISOString()},
    {pageId: PAGE, leadgenId: "777888999000", formId: null, adId: null, adGroupId: "456456456456", createdAt: null},
  ]);
  // The page ID falls back to the entry's ID.
  assert.equal(parseLeadgenWebhook(JSON.stringify({object: "page", entry: [{id: PAGE, changes: [{field: "leadgen", value: {leadgen_id: "444555666777"}}]}]}))[0].pageId, PAGE);
  assert.throws(() => parseLeadgenWebhook("not json"), MetaPayloadError);
  assert.throws(() => parseLeadgenWebhook(webhook([], "whatsapp_business_account")), MetaPayloadError);
  assert.throws(() => parseLeadgenWebhook(JSON.stringify({object: "page"})), MetaPayloadError);
});

const lead = (fields: Record<string, string | string[]>, extra: Partial<MetaLead> = {}): MetaLead => ({
  id: "444555666777", form_id: "888999000111", platform: "ig", is_organic: false,
  field_data: Object.entries(fields).map(([name, value]) => ({name, values: Array.isArray(value) ? value : [value]})), ...extra,
});

test("standard questions fill the name, email and phone", () => {
  const mapped = mapMetaLead(lead({full_name: "  Aisha   Rahman ", email: "Aisha.Rahman@Example.TEST", phone_number: "+44 7700 900123"}));
  assert.ok(mapped);
  assert.equal(mapped.fullName, "Aisha Rahman");
  assert.equal(mapped.email, "Aisha.Rahman@example.test");
  assert.equal(mapped.normalizedEmail, "aisha.rahman@example.test");
  assert.equal(mapped.normalizedPhone, "+447700900123");
  // A UAE mobile in local form gets its country code.
  assert.equal(mapMetaLead(lead({full_name: "Omar Haddad", phone_number: "050 123 4567"}))?.normalizedPhone, "+971501234567");
  // First and last name when there is no full name; the email's name when there is neither.
  assert.equal(mapMetaLead(lead({first_name: "Priya", last_name: "Nair", email: "p@example.test"}))?.fullName, "Priya Nair");
  assert.equal(mapMetaLead(lead({email: "james.carter@example.test"}))?.fullName, "james.carter");
});

test("a lead with no email and no phone is not imported", () => {
  assert.equal(mapMetaLead(lead({full_name: "No Contact", city: "Dubai"})), null);
  assert.equal(mapMetaLead(lead({full_name: "Bad Email", email: "not-an-email"})), null);
});

test("custom answers fill mapped fields, or fields their question clearly names, and every answer is kept with its label", () => {
  const questions = parseQuestions([
    {key: "what_is_your_budget?", label: "What is your budget?", type: "CUSTOM"},
    {key: "preferred_community", label: "Preferred community", type: "CUSTOM"},
    {key: "full_name", label: "Full name", type: "FULL_NAME"},
    {key: "", label: "broken"},
  ]);
  assert.equal(questions.length, 3);
  const mapped = mapMetaLead(lead({
    full_name: "Layla Mansour", email: "layla@example.test",
    "what_is_your_budget?": "AED 1.5M - 2M", preferred_community: "Dubai Marina", "how_many_bedrooms?": "2",
    "are_you_looking_to_buy_or_rent?": "Buy", "property_type": "Apartment", timeline: ["Within 3 months"],
  }), {questions});
  assert.ok(mapped);
  assert.equal(mapped.budgetMin, 1_500_000);
  assert.equal(mapped.budgetMax, 2_000_000);
  assert.equal(mapped.preferredLocation, "Dubai Marina");
  assert.equal(mapped.bedroomPreference, "2");
  assert.equal(mapped.transactionType, "BUY");
  assert.equal(mapped.propertyType, "Apartment");
  assert.deepEqual(mapped.answers.find(answer => answer.key === "what_is_your_budget?"), {key: "what_is_your_budget?", label: "What is your budget?", value: "AED 1.5M - 2M"});
  assert.equal(mapped.answers.find(answer => answer.key === "timeline")?.label, "Timeline", "an unlisted question gets a readable label");

  // An explicit mapping wins over a guess.
  const explicit = mapMetaLead(lead({full_name: "Chen Wei", email: "chen@example.test", area: "JVC", where_exactly: "Downtown"}), {mapping: parseFieldMapping({preferredLocation: "where_exactly", unknown: "x"})});
  assert.equal(explicit?.preferredLocation, "Downtown");
  // Meta's standard "city" fills the location when nothing else does.
  assert.equal(mapMetaLead(lead({full_name: "Sara Kapoor", email: "sara@example.test", city: "Abu Dhabi"}))?.preferredLocation, "Abu Dhabi");
});

test("budgets and buy/rent answers are read from free text", () => {
  assert.deepEqual(parseBudget("AED 1,200,000"), {min: null, max: 1_200_000});
  assert.deepEqual(parseBudget("800k - 1.2M"), {min: 800_000, max: 1_200_000});
  assert.deepEqual(parseBudget("2 million to 3 million"), {min: 2_000_000, max: 3_000_000});
  assert.deepEqual(parseBudget("flexible"), {min: null, max: null});
  assert.deepEqual(parseBudget("2 bedrooms"), {min: null, max: null}, "small numbers are not budgets");
  assert.equal(parseTransactionType("I want to rent"), "RENT");
  assert.equal(parseTransactionType("Investment / ROI"), "INVEST");
  assert.equal(parseTransactionType("Buy"), "BUY");
  assert.equal(parseTransactionType("Not sure"), null);
});

test("answers and consent are bounded and cleaned", () => {
  const mapped = mapMetaLead(lead({full_name: "Elena\u0000 Petrova", email: "elena@example.test", note: "x".repeat(5000)}, {
    custom_disclaimer_responses: [{checkbox_key: "marketing_optin", is_checked: "1"}, {checkbox_key: "terms", is_checked: ""}, {is_checked: "1"}],
  }));
  assert.ok(mapped);
  assert.equal(mapped.fullName, "Elena Petrova");
  assert.equal(mapped.answers.find(answer => answer.key === "note")?.value.length, 1000);
  assert.deepEqual(mapped.consent, [{key: "marketing_optin", checked: true}, {key: "terms", checked: false}]);
});

test("Graph API failures are retried, need a new sign-in, or are given up", () => {
  assert.equal(classifyGraphError(400, {code: 190}), "RECONNECT", "expired or revoked token");
  assert.equal(classifyGraphError(403, {code: 200}), "RECONNECT", "missing permission");
  assert.equal(classifyGraphError(400, {code: 4}), "RETRY", "rate limited");
  assert.equal(classifyGraphError(400, {code: 80001}), "RETRY", "Page rate limit");
  assert.equal(classifyGraphError(503, null), "RETRY");
  assert.equal(classifyGraphError(0, null), "RETRY", "network failure");
  assert.equal(classifyGraphError(400, {code: 100}), "GIVE_UP", "the lead does not exist");
  assert.equal(classifyGraphError(404, null), "GIVE_UP");
});

test("the activity metadata keeps the answers and ad IDs, never the token", () => {
  const source = lead({full_name: "Yusuf Demir", email: "yusuf@example.test"}, {ad_id: "123123123123", adset_id: "456456456456", campaign_id: "789789789789", created_time: "2026-11-23T10:00:00+0000"});
  const mapped = mapMetaLead(source);
  assert.ok(mapped);
  const metadata = leadMetadata({lead: source, mapped, pageId: PAGE, pageName: "Estate OS test lead", formName: "Marina enquiries", origin: "WEBHOOK"});
  assert.equal(metadata.platform, "instagram");
  assert.equal(metadata.campaignId, "789789789789");
  assert.equal(metadata.formName, "Marina enquiries");
  assert.equal(metadata.answers.length, 2);
  assert.equal(JSON.stringify(metadata).includes("token"), false);
});

test("answers never overflow the lead's columns: Meta's testing tool sends placeholder text as the phone", () => {
  const mapped = mapMetaLead(lead({
    full_name: "<test lead: dummy data for full_name>", email: "test@fb.com",
    phone_number: "<test lead: dummy data for phone_number>", city: "x".repeat(400),
  }));
  assert.ok(mapped);
  assert.equal(mapped.phone, null, "not a phone number, so the phone field stays empty");
  assert.equal(mapped.normalizedPhone, null);
  assert.equal(mapped.answers.find(answer => answer.key === "phone_number")?.value, "<test lead: dummy data for phone_number>", "the raw answer is kept");
  assert.equal(mapped.preferredLocation?.length, 160);
  assert.equal(mapped.fullName, "<test lead: dummy data for full_name>");
  // A number that cannot be normalized but looks like one, and fits, is kept as given.
  assert.equal(mapMetaLead(lead({full_name: "Local Number", phone_number: "1234 5678"}))?.phone, "1234 5678");
  // Placeholder phone and no email: nothing to reach the person with.
  assert.equal(mapMetaLead(lead({full_name: "Only Placeholder", phone_number: "<test lead: dummy data for phone_number>"})), null);
});
