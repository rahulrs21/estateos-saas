import assert from "node:assert/strict";
import test from "node:test";
import { leadBudget, leadsHref } from "../src/modules/leads/presentation";
import type { LeadFilters } from "../src/modules/leads/types";

const filters: LeadFilters = {
  search: "R&D + sales?status=WON#private", status: "QUALIFIED", branchId: "",
  assignedMembershipId: "10000000-0000-4000-8000-000000000001",
  sourceId: "10000000-0000-4000-8000-000000000002", priority: "HIGH",
  createdFrom: "2026-10-01", createdTo: "2026-10-20", sort: "FOLLOW_UP_ASC",
  view: "KANBAN", followUp: "UPCOMING", page: 3, pageSize: 25,
};

test("pagination and view links preserve filters while encoding search as data", () => {
  const url = new URL(leadsHref(filters, { page: 4 }), "https://estateos.example.test");
  assert.equal(url.pathname, "/leads");
  assert.equal(url.hash, "");
  assert.equal(url.searchParams.get("search"), filters.search);
  assert.deepEqual(url.searchParams.getAll("status"), ["QUALIFIED"]);
  for (const key of ["assignedMembershipId", "sourceId", "priority", "createdFrom", "createdTo", "sort", "view", "followUp", "pageSize"] as const) {
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
