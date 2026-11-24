import assert from "node:assert/strict";
import test from "node:test";
import { enquiryFields, leadAdEnquiryFrom, leadBudget, leadEnquiryFrom, leadsHref, oldestActivityPlace, resolveLeadDateRange } from "../src/modules/leads/presentation";
import type { LeadFilters } from "../src/modules/leads/types";

const filters: LeadFilters = {
  search: "R&D + sales?status=WON#private", status: "QUALIFIED", branchId: "",
  assignedMembershipId: "10000000-0000-4000-8000-000000000001",
  sourceId: "10000000-0000-4000-8000-000000000002", priority: "HIGH", channel: "META_LEAD_AD", campaign: "Marina Launch",
  createdFrom: "2026-10-01", createdTo: "2026-10-20", range: "CUSTOM", sort: "FOLLOW_UP_ASC",
  view: "KANBAN", followUp: "UPCOMING", page: 3, pageSize: 25,
};

test("pagination and view links preserve filters while encoding search as data", () => {
  const url = new URL(leadsHref(filters, { page: 4 }), "https://estateos.example.test");
  assert.equal(url.pathname, "/leads");
  assert.equal(url.hash, "");
  assert.equal(url.searchParams.get("search"), filters.search);
  assert.deepEqual(url.searchParams.getAll("status"), ["QUALIFIED"]);
  for (const key of ["assignedMembershipId", "sourceId", "priority", "channel", "campaign", "createdFrom", "createdTo", "sort", "view", "followUp", "pageSize"] as const) {
    assert.equal(url.searchParams.get(key), String(filters[key]), `Preserve ${key}`);
  }
  assert.equal(url.searchParams.get("page"), "4");
});

test("view changes can reset page without mutating applied filters", () => {
  const url = new URL(leadsHref(filters, { view: "LIST", page: 1, search: "" }), "https://estateos.example.test");
  assert.equal(url.searchParams.get("view"), "LIST");
  assert.equal(url.searchParams.get("page"), "1");
  assert.equal(url.searchParams.has("search"), false);
  assert.equal(filters.page, 3);
  assert.equal(filters.view, "KANBAN");
  assert.equal(url.searchParams.get("priority"), "HIGH");
});

test("budget display distinguishes zero, open ranges and absent information", () => {
  assert.equal(leadBudget({ budgetMin: 0, budgetMax: null, currency: "AED" }), "From AED 0");
  assert.equal(leadBudget({ budgetMin: null, budgetMax: 0, currency: "USD" }), "Up to USD 0");
  assert.match(leadBudget({ budgetMin: 0, budgetMax: 1500000.25 }), /^AED 0 . 1,500,000\.25$/u);
  assert.equal(leadBudget({ budgetMin: null, budgetMax: null }), "Not specified");
});

test("a lead's oldest activity is read from the loaded page when it reaches the end, otherwise at one offset", () => {
  assert.equal(oldestActivityPlace({total: 3, page: 1, pageSize: 25, loaded: 3}), "LOADED");
  assert.equal(oldestActivityPlace({total: 30, page: 2, pageSize: 25, loaded: 5}), "LOADED", "the last page holds it");
  assert.deepEqual(oldestActivityPlace({total: 30, page: 1, pageSize: 25, loaded: 25}), {offset: 29}, "one more read for that entry only");
  assert.equal(oldestActivityPlace({total: 0, page: 1, pageSize: 25, loaded: 0}), null);
  assert.equal(oldestActivityPlace({total: 20000, page: 1, pageSize: 25, loaded: 25}), null, "past the query's offset limit");
});

test("only a website capture becomes the lead's enquiry; its message is trimmed and may be empty", () => {
  assert.deepEqual(leadEnquiryFrom({kind: "WEBSITE_LEAD_CAPTURED", note: "  Testing the form \n", createdAt: "2026-11-21T08:21:00Z"}), {message: "Testing the form", receivedAt: "2026-11-21T08:21:00Z"});
  assert.deepEqual(leadEnquiryFrom({kind: "WEBSITE_LEAD_CAPTURED", note: "  ", createdAt: "2026-11-21T08:21:00Z"}), {message: null, receivedAt: "2026-11-21T08:21:00Z"});
  assert.equal(leadEnquiryFrom({kind: "LEAD_CREATED", note: "Added by hand", createdAt: "2026-11-21T08:21:00Z"}), null, "a lead added by hand has no website enquiry");
  assert.equal(leadEnquiryFrom(null), null);
});

test("the website enquiry lists every detail the form sent, in the form's order, without empty ones", () => {
  const fields = enquiryFields({fullName: "Form Visitor One", email: "visitor@example.test", phone: "+971500000009", propertyInterest: "Marina Heights", preferredLocation: " ",
    propertyType: "Apartment", transactionType: "BUY", budgetMin: 1_000_000, budgetMax: 1_500_000, currency: "AED", bedroomPreference: "2"});
  assert.deepEqual(fields.map(field => field.label), ["Full name", "Email address", "Phone number", "Property interest", "Property type", "Buy, rent or invest", "Budget", "Bedrooms"]);
  assert.equal(fields.find(field => field.label === "Budget")?.value, "AED 1,000,000 – 1,500,000");
  assert.equal(fields.find(field => field.label === "Buy, rent or invest")?.value, "Buy");
  assert.deepEqual(enquiryFields({fullName: "Only Name", email: null, phone: null}).map(field => field.label), ["Full name"], "no budget line when none was given");
});

test("created-date presets are Dubai calendar days, both included", () => {
  const custom = {createdFrom: "2026-01-05", createdTo: "2026-01-09"};
  // 21:30 UTC on 14 March is already 15 March in Dubai (UTC+4).
  const now = Date.parse("2026-03-14T21:30:00.000Z");
  assert.deepEqual(resolveLeadDateRange("TODAY", custom, now), {createdFrom: "2026-03-15", createdTo: "2026-03-15"});
  assert.deepEqual(resolveLeadDateRange("YESTERDAY", custom, now), {createdFrom: "2026-03-14", createdTo: "2026-03-14"});
  assert.deepEqual(resolveLeadDateRange("7D", custom, now), {createdFrom: "2026-03-09", createdTo: "2026-03-15"});
  assert.deepEqual(resolveLeadDateRange("30D", custom, now), {createdFrom: "2026-02-14", createdTo: "2026-03-15"});
  assert.deepEqual(resolveLeadDateRange("LAST_MONTH", custom, now), {createdFrom: "2026-02-01", createdTo: "2026-02-28"});
  assert.deepEqual(resolveLeadDateRange("LAST_MONTH", custom, Date.parse("2026-01-10T08:00:00.000Z")), {createdFrom: "2025-12-01", createdTo: "2025-12-31"});
  assert.deepEqual(resolveLeadDateRange("ALL", custom, now), {createdFrom: "", createdTo: ""});
  assert.deepEqual(resolveLeadDateRange("CUSTOM", custom, now), custom);
});

test("a preset range leaves its computed dates out of links; a custom range keeps them", () => {
  const preset = new URL(leadsHref({...filters, range: "7D"}), "https://estateos.example.test");
  assert.equal(preset.searchParams.get("range"), "7D");
  assert.equal(preset.searchParams.has("createdFrom"), false);
  assert.equal(preset.searchParams.has("createdTo"), false);
  const custom = new URL(leadsHref(filters, {range: "CUSTOM"}), "https://estateos.example.test");
  assert.equal(custom.searchParams.get("createdFrom"), "2026-10-01");
  assert.equal(custom.searchParams.get("createdTo"), "2026-10-20");
});

test("a Meta lead ad enquiry is read from the capture activity, defensively", () => {
  const createdAt = "2026-11-23T10:00:00.000Z";
  assert.equal(leadAdEnquiryFrom({kind: "LEAD_CREATED", metadata: {}, createdAt}), null);
  assert.equal(leadAdEnquiryFrom(null), null);
  const enquiry = leadAdEnquiryFrom({kind: "AD_LEAD_CAPTURED", createdAt, metadata: {
    platform: "instagram", isOrganic: false, pageName: "Estate OS test lead", formName: "Marina enquiries",
    leadgenId: "444555666777", formId: "888999000111", adId: "123123123123", adsetId: "not-an-id", campaignId: 42,
    metaCreatedAt: "2026-11-23T09:59:00+0000",
    answers: [{key: "what_is_your_budget?", label: "What is your budget?", value: " AED 2M "}, {key: "empty", label: "Empty", value: ""}, {key: 7, value: "x"}, {key: "no_label", value: "kept"}],
    consent: [{key: "marketing_optin", checked: true}, {key: "terms", checked: "yes"}, {checked: true}],
  }});
  assert.ok(enquiry);
  assert.equal(enquiry.platform, "instagram");
  assert.deepEqual(enquiry.answers, [{key: "what_is_your_budget?", label: "What is your budget?", value: "AED 2M"}, {key: "no_label", label: "no_label", value: "kept"}], "blank or malformed answers are dropped");
  assert.deepEqual(enquiry.consent, [{key: "marketing_optin", checked: true}, {key: "terms", checked: false}], "only a real true counts as ticked");
  assert.deepEqual(enquiry.ids, {leadgenId: "444555666777", formId: "888999000111", adId: "123123123123", adsetId: null, campaignId: null}, "only numeric Meta IDs are shown");
  assert.equal(enquiry.receivedAt, createdAt);
  // An unknown platform or missing metadata still gives a card, without guessing.
  const bare = leadAdEnquiryFrom({kind: "AD_LEAD_CAPTURED", createdAt, metadata: {platform: "messenger"}});
  assert.deepEqual({platform: bare?.platform, answers: bare?.answers.length, page: bare?.pageName}, {platform: null, answers: 0, page: null});
});
