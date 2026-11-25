import assert from "node:assert/strict";
import { test } from "node:test";
import { campaignKey, cleanClickId, inferPlatform, metaCampaignKey, urlParts, websiteAttribution } from "../src/modules/lead-capture/attribution";
import { touchFromLocation } from "../src/modules/lead-capture/first-touch";
import { defaultCaptureFields, parsePublicSubmission } from "../src/modules/lead-capture/validation";
import { formPublicIdFrom } from "../src/modules/websites/form-embed";

// Phase 7E: lead source attribution (docs/LEAD_ATTRIBUTION_PLAN.md). Fictional sites and IDs only.

test("URLs keep only their host and path, never the query, fragment or credentials", () => {
  assert.deepEqual(urlParts("https://user:pass@Homes.Example/dubai/marina?email=a@b.test#form"), {host: "homes.example", path: "/dubai/marina"});
  assert.deepEqual(urlParts("javascript:alert(1)"), {host: null, path: null});
  assert.deepEqual(urlParts("not a url"), {host: null, path: null});
  assert.deepEqual(urlParts(null), {host: null, path: null});
});

test("click IDs must look like click IDs", () => {
  assert.equal(cleanClickId("Cj0KCQiA_example-123"), "Cj0KCQiA_example-123");
  assert.equal(cleanClickId("<script>"), null);
  assert.equal(cleanClickId("a b"), null);
  assert.equal(cleanClickId("x".repeat(300)), null);
});

test("campaign names group regardless of case, underscores and hyphens", () => {
  assert.equal(campaignKey("Marina_Launch"), "marina launch");
  assert.equal(campaignKey("  marina-launch "), "marina launch");
  assert.equal(campaignKey("MARINA  LAUNCH"), "marina launch");
  assert.equal(campaignKey(""), null);
  assert.equal(metaCampaignKey("Off-plan Q4", "120200000000001"), "off plan q4");
  assert.equal(metaCampaignKey(null, "120200000000001"), "meta campaign 120200000000001", "a Meta campaign without a name groups by its ID");
});

test("the platform comes from click IDs first, then utm_source, then the referring site", () => {
  assert.equal(inferPlatform({gclid: "abc123", utmSource: "facebook"}), "google", "a click ID wins");
  assert.equal(inferPlatform({fbclid: "abc123"}), "meta");
  assert.equal(inferPlatform({ttclid: "abc123"}), "tiktok");
  assert.equal(inferPlatform({utmSource: "Instagram"}), "meta");
  assert.equal(inferPlatform({utmSource: "google"}), "google");
  assert.equal(inferPlatform({utmSource: "snapchat"}), "snapchat");
  assert.equal(inferPlatform({utmSource: "newsletter"}), "referral");
  assert.equal(inferPlatform({referrerHost: "www.google.com"}), "organic", "a search engine without a click ID is organic search");
  assert.equal(inferPlatform({referrerHost: "l.facebook.com"}), "meta");
  assert.equal(inferPlatform({referrerHost: "propertyfinder.ae"}), "referral");
  assert.equal(inferPlatform({}), "direct");
});

test("a website enquiry's attribution is cleaned and complete", () => {
  const record = websiteAttribution("LANDING_PAGE", {
    utmSource: " google ", utmMedium: "cpc", utmCampaign: "Marina_Launch\n", gclid: "Cj0KCQ_test", fbclid: "<bad>",
    referrer: "https://www.google.com/search?q=private", landingPageUrl: "https://homes.example/marina?utm_source=google",
  });
  assert.deepEqual(record, {
    channel: "LANDING_PAGE", platform: "google", campaignKey: "marina launch",
    utmSource: "google", utmMedium: "cpc", utmCampaign: "Marina_Launch", utmContent: null, utmTerm: null,
    gclid: "Cj0KCQ_test", fbclid: null, ttclid: null,
    landingHost: "homes.example", landingPath: "/marina", referrerHost: "www.google.com",
  });
  // The agency's own site referring to its own form is not a source.
  assert.equal(websiteAttribution("WEBSITE_FORM", {referrer: "https://homes.example/contact", landingPageUrl: "https://homes.example/marina"}).referrerHost, null);
});

test("the first touch is read from the page, or from the host page an embedded form was given", () => {
  const direct = touchFromLocation("https://estateos.example/forms/abc?utm_source=facebook&utm_campaign=Launch&fbclid=IwAR_test&email=private@x.test", "https://l.facebook.com/");
  assert.deepEqual(direct, {utmSource: "facebook", utmCampaign: "Launch", fbclid: "IwAR_test", landingPageUrl: "https://estateos.example/forms/abc", referrer: "https://l.facebook.com/"});
  const embedded = touchFromLocation("https://estateos.example/forms/abc?utm_source=google&gclid=Cj0_test&eo_page=https%3A%2F%2Fhomes.example%2Fmarina&eo_ref=https%3A%2F%2Fwww.google.com%2F", "https://homes.example/");
  assert.equal(embedded.landingPageUrl, "https://homes.example/marina", "the agency's own page, given by the embed script");
  assert.equal(embedded.referrer, "https://www.google.com/", "the host page's referrer, not the host page");
  assert.equal(embedded.gclid, "Cj0_test");
  assert.equal(touchFromLocation("https://estateos.example/forms/abc?eo_page=javascript:alert(1)", "").landingPageUrl, "https://estateos.example/forms/abc");
});

test("a public submission accepts click IDs and keeps only the referrer's host", () => {
  const result = parsePublicSubmission(defaultCaptureFields, {
    fields: {FULL_NAME: "Aisha Rahman", EMAIL: "aisha@example.test", PHONE: ""}, consent: true, elapsedMs: 5000,
    attribution: {utmSource: "google", gclid: "Cj0KCQ_test", fbclid: "<script>", referrer: "https://www.google.com/search?q=aisha+rahman"},
  });
  assert.ok(result);
  assert.equal(result.attribution.gclid, "Cj0KCQ_test");
  assert.equal(result.attribution.fbclid, undefined, "an invalid click ID is dropped, never the enquiry");
  assert.equal(result.attribution.referrer, "https://www.google.com/", "the search terms are not kept");
});

test("the new embed code is still recognised when pasted into the page editor", () => {
  const id = "A".repeat(40);
  const snippet = `<div data-estateos-form data-src="https://estateos.example/forms/${id}" data-title="Marina enquiries" data-height="720"></div>\n<script src="https://estateos.example/embed/lead-form.js" async></script>`;
  assert.equal(formPublicIdFrom(snippet), id);
});

// Phase 7E.3: campaign names for the Campaign filter, the form's suggestions and the list.
test("each campaign is offered once, by its newest name, in name order", async () => {
  const {campaignLabel, campaignOptions, LEAD_CHANNELS, LEAD_CHANNEL_LABELS} = await import("../src/modules/lead-capture/attribution");
  assert.equal(campaignLabel({campaignKey: "marina launch", metaCampaignName: "Marina Launch (Meta)", utmCampaign: "Marina_Launch"}), "Marina Launch (Meta)", "Meta's campaign name first");
  assert.equal(campaignLabel({campaignKey: "marina launch", utmCampaign: "Marina_Launch"}), "Marina_Launch", "then the UTM or typed name");
  assert.equal(campaignLabel({campaignKey: "meta ad 123", metaAdName: "Marina 2-bed"}), "Marina 2-bed", "then the ad's name");
  assert.equal(campaignLabel({campaignKey: "spring"}), "spring");
  assert.equal(campaignLabel({}), null);
  assert.deepEqual(campaignOptions([
    {campaignKey: "marina launch", utmCampaign: "Marina Launch Q4"}, {campaignKey: "marina launch", utmCampaign: "marina_launch"},
    {campaignKey: null, utmCampaign: "ignored"}, {campaignKey: "creek view", metaCampaignName: "Creek View"},
  ]), [{key: "creek view", label: "Creek View"}, {key: "marina launch", label: "Marina Launch Q4"}]);
  assert.equal(campaignOptions(Array.from({length: 150}, (_, index) => ({campaignKey: `c${index}`})), 100).length, 100, "bounded");
  assert.ok(LEAD_CHANNELS.every(channel => LEAD_CHANNEL_LABELS[channel]), "every channel has a label");
});

// Phase 7E.4: "Where leads come from" rows, rates and the CSV download.
test("the source report keeps known channels, totals them, and writes a CSV a spreadsheet cannot run", async () => {
  const {csvCell, rate, sourceReport, sourceReportCsv} = await import("../src/modules/lead-capture/source-report");
  const report = sourceReport(
    [{channel: "META_LEAD_AD", leads: "12", qualified: 5, won: 2}, {channel: "UNRECORDED", leads: 3, qualified: 0, won: 0}, {channel: "DROP TABLE", leads: 9}, {channel: "MANUAL", leads: -4}],
    [{key: "marina launch", label: "=HYPERLINK(\"http://x.test\")", channel: "META_LEAD_AD", channels: 1, leads: 7, qualified: 3, won: 1}, {key: "", leads: 2}, {key: "mixed", label: null, channel: "WHATSAPP_AD", channels: "2", leads: 2}],
  );
  assert.deepEqual(report.channels.map(row => [row.channel, row.label, row.leads]), [["META_LEAD_AD", "Meta lead ad", 12], ["UNRECORDED", "Not recorded", 3], ["MANUAL", "Added by hand", 0]], "unknown channels are dropped, counts never negative");
  assert.deepEqual(report.total, {leads: 15, qualified: 5, won: 2});
  assert.deepEqual(report.campaigns.map(row => [row.key, row.label, row.channelLabel]), [["marina launch", "=HYPERLINK(\"http://x.test\")", "Meta lead ad"], ["mixed", "mixed", "Several channels"]]);
  assert.equal(rate(5, 12), 41.7);
  assert.equal(rate(1, 0), 0);
  assert.equal(csvCell("=1+1"), "'=1+1");
  assert.equal(csvCell("-2"), "'-2");
  assert.equal(csvCell(-2), "-2", "numbers are written as numbers");
  assert.equal(csvCell('Marina, "Launch"'), '"Marina, ""Launch"""', "commas and quotes are quoted");
  const csv = sourceReportCsv(report, {from: "2026-11-01", to: "2026-11-24", timeZone: "Asia/Dubai", scope: "All company leads"});
  assert.ok(csv.startsWith("﻿Where leads come from\r\n"));
  assert.match(csv, /\r\nMeta lead ad,12,5,2,41\.7,16\.7\r\n/);
  assert.match(csv, /\r\nTotal,15,5,2,33\.3,13\.3\r\n/);
  assert.match(csv, /\r\n"'=HYPERLINK\(""http:\/\/x\.test""\)",marina launch,Meta lead ad,7,3,1,42\.9,14\.3\r\n/, "a formula in a campaign name is neutralised");
});

// Phase 7E.5: what filling older leads' sources would do.
test("the fill preview keeps known channels with leads, and totals them", async () => {
  const {backfillPreview} = await import("../src/modules/lead-capture/source-report");
  assert.deepEqual(backfillPreview([{channel: "MANUAL", leads: "7"}, {channel: "WEBSITE_FORM", leads: 2}, {channel: "UNRECORDED", leads: 4}, {channel: "META_LEAD_AD", leads: 0}, null]),
    {total: 9, channels: [{channel: "MANUAL", label: "Added by hand", leads: 7}, {channel: "WEBSITE_FORM", label: "Website form", leads: 2}]});
  assert.deepEqual(backfillPreview(undefined), {total: 0, channels: []});
});
