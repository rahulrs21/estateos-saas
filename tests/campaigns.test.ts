import assert from "node:assert/strict";
import { test } from "node:test";
import {
  addSpendSchema, campaignRows, campaignTotals, costPer, costs, createCampaignSchema, formatMoney, moneyInput, parseMoney, periodDays, proratedMinor, updateSpendSchema,
} from "../src/modules/campaigns/model";
import { costPerLeadLabel, sourceReport, sourceReportCsv, spendLabel, withSpend } from "../src/modules/lead-capture/source-report";

// Phase 7F.1: campaigns and cost per lead (docs/CAMPAIGNS_PLAN.md).

test("amounts are read as minor units, bounded, and shown in their own currency", () => {
  assert.equal(parseMoney("1,250.5"), 125050);
  assert.equal(parseMoney("1250"), 125000);
  assert.equal(parseMoney(" 0.07 "), 7);
  assert.equal(parseMoney(99.99), 9999);
  for (const bad of ["-5", "1.234", "1e5", "abc", "", "12345678901234", null, undefined]) assert.equal(parseMoney(bad), null, `refused: ${String(bad)}`);
  assert.equal(formatMoney(125000, "AED"), "AED 1,250");
  assert.equal(formatMoney(125050, "AED"), "AED 1,250.50");
  assert.equal(moneyInput(125050), "1250.50");
  assert.equal(moneyInput(125000), "1250");
  assert.equal(costPer(100000, 3), 33333);
  assert.equal(costPer(100000, 0), null, "no leads: no cost per lead");
});

test("a period's spend is counted by the share of its days inside the chosen dates", () => {
  assert.equal(periodDays("2026-11-01", "2026-11-30"), 30);
  assert.equal(periodDays("2026-11-05", "2026-11-05"), 1);
  assert.equal(periodDays("2026-11-05", "2026-11-04"), 0);
  assert.equal(proratedMinor(300000, "2026-11-01", "2026-11-30", "2026-11-01", "2026-11-10"), 100000, "10 of 30 days");
  assert.equal(proratedMinor(300000, "2026-11-01", "2026-11-30", "2026-10-01", "2026-12-31"), 300000, "all of it");
  assert.equal(proratedMinor(300000, "2026-11-01", "2026-11-30", "2026-12-01", "2026-12-31"), 0, "none of it");
  assert.equal(proratedMinor(310000, "2026-12-01", "2026-12-31", "2026-11-25", "2026-12-01"), 10000, "one day across a month boundary");
});

test("campaign and spend input is validated: names, dates in order, periods of up to a year, amounts and IDs", () => {
  const campaign = createCampaignSchema.parse({ name: " Marina Launch ", startsOn: "2026-11-01", endsOn: "", budget: "25,000", currency: "aed", metaCampaignId: "", notes: "" });
  assert.deepEqual({ name: campaign.name, endsOn: campaign.endsOn, budget: campaign.budget, currency: campaign.currency, meta: campaign.metaCampaignId, notes: campaign.notes, status: campaign.status },
    { name: "Marina Launch", endsOn: null, budget: 2500000, currency: "AED", meta: null, notes: null, status: "ACTIVE" });
  assert.equal(createCampaignSchema.safeParse({ name: "X", startsOn: "2026-11-10", endsOn: "2026-11-01" }).success, false, "ends before it starts");
  assert.equal(createCampaignSchema.safeParse({ name: "" }).success, false);
  assert.equal(createCampaignSchema.safeParse({ name: "X", metaCampaignId: "12ab" }).success, false, "platform IDs are digits");
  assert.equal(createCampaignSchema.safeParse({ name: "X", platform: "myspace" }).success, false);
  assert.equal(createCampaignSchema.safeParse({ name: "X", organizationId: "00000000-0000-4000-8000-000000000001" }).success, false, "no company from the browser");

  assert.equal(addSpendSchema.parse({ campaignKey: "marina launch", spentFrom: "2026-11-01", spentTo: "2026-11-30", amount: "3000" }).amount, 300000);
  assert.equal(addSpendSchema.safeParse({ spentFrom: "2026-11-01", spentTo: "2026-11-30", amount: "3000" }).success, false, "a campaign is required");
  assert.equal(addSpendSchema.safeParse({ campaignKey: "a", campaignId: "00000000-0000-4000-8000-000000000001", spentFrom: "2026-11-01", spentTo: "2026-11-30", amount: "1" }).success, false, "one campaign only");
  assert.equal(addSpendSchema.safeParse({ campaignKey: "a", spentFrom: "2026-11-30", spentTo: "2026-11-01", amount: "1" }).success, false, "period in order");
  assert.equal(addSpendSchema.safeParse({ campaignKey: "a", spentFrom: "2025-01-01", spentTo: "2026-11-01", amount: "1" }).success, false, "at most a year");
  assert.equal(updateSpendSchema.safeParse({ id: "00000000-0000-4000-8000-000000000001", spentFrom: "2026-11-01", spentTo: "2026-11-01", amount: "-1" }).success, false, "no negative spend");
});

test("rows keep each campaign's spend by currency, totals never add currencies together, and cost per lead needs one currency", () => {
  const rows = campaignRows(
    [{ key: "marina launch", id: "c1", name: "Marina Launch", platform: "meta", status: "ACTIVE", leads: "4", qualified: 2, won: 1, currency: "AED", budget_minor: "2500000" },
      { key: "creek view", id: null, name: null, label: "Creek View", lead_platform: "google", channel: "WEBSITE_FORM", status: null, leads: 2, qualified: 0, won: 0 },
      { key: "", leads: 9 }],
    [{ key: "marina launch", currency: "AED", amount_minor: "100000" }, { key: "creek view", currency: "AED", amount_minor: "20000" }, { key: "creek view", currency: "USD", amount_minor: "5000" }],
  );
  assert.deepEqual(rows.map(row => [row.key, row.name, row.platform, row.status, row.budgetMinor, row.spend.length]),
    [["marina launch", "Marina Launch", "meta", "ACTIVE", 2500000, 1], ["creek view", "Creek View", "google", null, null, 2]], "a campaign found only in leads takes its newest name and platform");
  assert.deepEqual(costs(rows[0]), { currency: "AED", perLead: 25000, perQualified: 50000, perWon: 100000 });
  assert.deepEqual(costs(rows[1]), { currency: null, perLead: null, perQualified: null, perWon: null }, "two currencies: no single cost");
  assert.deepEqual(campaignTotals(rows), { leads: 6, qualified: 2, won: 1, spend: [{ currency: "AED", amountMinor: 120000 }, { currency: "USD", amountMinor: 5000 }] });
});

test("the source report shows spend and cost per lead only when given spend, in the table and the CSV", () => {
  const base = sourceReport([{ channel: "MANUAL", leads: 4, qualified: 2, won: 1 }], [{ key: "marina launch", label: "Marina Launch", channel: "MANUAL", channels: 1, leads: 4, qualified: 2, won: 1 }]);
  assert.equal(withSpend(base, null), base, "no spend for members who may not see it");
  const report = withSpend(base, new Map([["marina launch", [{ currency: "AED", amountMinor: 100000 }]]]));
  assert.equal(report.spendShown, true);
  assert.equal(spendLabel(report.campaigns[0].spend), "AED 1,000");
  assert.equal(costPerLeadLabel(report.campaigns[0]), "AED 250");
  assert.equal(costPerLeadLabel({ ...report.campaigns[0], spend: [{ currency: "AED", amountMinor: 1 }, { currency: "USD", amountMinor: 1 }] }), "", "not across currencies");
  const csv = sourceReportCsv(report, { from: "2026-11-01", to: "2026-11-30", timeZone: "Asia/Dubai", scope: "All company leads" });
  assert.match(csv, /\r\nCampaign,Campaign key,Channel,Leads,Qualified,Won,Qualified %,Won %,Spend,Cost per lead\r\n/);
  assert.match(csv, /\r\nMarina Launch,marina launch,Added by hand,4,2,1,50,25,"AED 1,000",AED 250\r\n/);
  assert.doesNotMatch(sourceReportCsv(base, { from: "2026-11-01", to: "2026-11-30", timeZone: "Asia/Dubai", scope: "Leads assigned to you" }), /Spend/, "no spend columns without spend");
});
