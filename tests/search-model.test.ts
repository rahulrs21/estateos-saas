import assert from "node:assert/strict";
import { test } from "node:test";
import { combineSearchGroups, humanizeStatus, searchQuerySchema, subtitle } from "../src/modules/search/search-model";

// Global search rules (src/modules/search/search-model.ts). Fictional records only.

test("queries are trimmed and must be 2–80 characters", () => {
  assert.deepEqual(searchQuerySchema.parse({q: "  marina "}), {q: "marina"});
  assert.equal(searchQuerySchema.safeParse({q: " a "}).success, false);
  assert.equal(searchQuerySchema.safeParse({q: "x".repeat(81)}).success, false);
  assert.equal(searchQuerySchema.safeParse({q: "ok", extra: "1"}).success, false);
  assert.equal(searchQuerySchema.safeParse({}).success, false);
});

test("groups keep a fixed order, drop empty groups and report refused lookups without failing", () => {
  const item = (id: string) => ({id, title: id, subtitle: "", href: `/x/${id}`});
  const result = combineSearchGroups("ma", {
    listings: {status: "fulfilled", value: [item("l1")]},
    leads: {status: "fulfilled", value: [item("a"), item("b"), item("c"), item("d"), item("e"), item("f")]},
    contacts: {status: "fulfilled", value: []},
    properties: {status: "rejected", reason: new Error("FORBIDDEN")},
  });
  assert.deepEqual(result.groups.map(group => group.key), ["leads", "listings"]);
  assert.equal(result.groups[0].items.length, 5);
  assert.deepEqual(result.unavailable, ["properties"]);
  assert.equal(result.query, "ma");
});

test("subtitles and statuses read as plain text", () => {
  assert.equal(humanizeStatus("VIEWING_SCHEDULED"), "Viewing scheduled");
  assert.equal(humanizeStatus(null), "");
  assert.equal(subtitle("Qualified", null, " ", "a@b.test"), "Qualified · a@b.test");
});
