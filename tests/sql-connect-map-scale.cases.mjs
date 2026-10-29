import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { before, describe, it } from "node:test";
import { fixture as f } from "./fixtures/sql-connect-fixtures.mjs";

const key = value => value.replaceAll("-", "").toLowerCase();

/**
 * Phase 5F scale: a generated dataset of 620 properties with one listing each,
 * inserted only into the isolated demo-estateos-test emulator. A unique
 * community keeps it separate from every other suite's rows.
 */
export const SCALE = {exact: 400, approximate: 200, hidden: 20, assignedToAgent: 30};

export function generateScaleDataset(suffix, ownerUid = "owner-a") {
  const community = `Scale Probe ${suffix}`;
  const total = SCALE.exact + SCALE.approximate + SCALE.hidden;
  const properties = [], listings = [];
  for (let index = 0; index < total; index++) {
    const mode = index < SCALE.exact ? "EXACT" : index < SCALE.exact + SCALE.approximate ? "APPROXIMATE" : "HIDDEN";
    // A 25 x 25 grid across Dubai, 25.00–25.24 N and 55.10–55.34 E.
    const latitude = Number((25.0 + (index % 25) * 0.01 + 0.0013).toFixed(6));
    const longitude = Number((55.1 + Math.floor(index / 25) * 0.01 + 0.0021).toFixed(6));
    const id = randomUUID();
    properties.push({
      organizationId: f.orgA, id, propertyReference: `SCALE-${index}-${suffix}`.slice(0, 80), propertyType: index % 3 ? "APARTMENT" : "VILLA",
      marketType: "SECONDARY", areaUnit: "SQFT", occupancyStatus: "VACANT", inventoryStatus: "AVAILABLE",
      emirate: "DUBAI", community, latitude, longitude, mapDisplayMode: mode, referencePriceMinor: String(100_000_000 + index * 100_000),
      assignedMembershipId: index < SCALE.assignedToAgent ? f.memberAgentA : null, createdByUid: ownerUid, updatedByUid: ownerUid,
    });
    listings.push({
      organizationId: f.orgA, id: randomUUID(), propertyId: id, listingReference: `SCALE-L-${index}-${suffix}`.slice(0, 80),
      listingPurpose: index % 4 ? "SALE" : "RENT", marketType: "SECONDARY", title: `Scale listing ${index}`, askingPriceMinor: String(120_000_000 + index * 100_000),
      currency: "AED", rentalPeriod: index % 4 ? null : "YEARLY", listingStatus: "ACTIVE",
      assignedMembershipId: index < SCALE.assignedToAgent ? f.memberAgentA : null, createdByUid: ownerUid, updatedByUid: ownerUid,
    });
  }
  return {community, properties, listings};
}

export async function insertScaleDataset(dc, dataset) {
  // Privileged fixture writes on the isolated emulator only (no impersonation).
  for (let start = 0; start < dataset.properties.length; start += 100) {
    await dc.executeGraphql("mutation InsertScaleProperties($data: [Property_Data!]!) { property_insertMany(data: $data) }", {variables: {data: dataset.properties.slice(start, start + 100)}});
  }
  for (let start = 0; start < dataset.listings.length; start += 100) {
    await dc.executeGraphql("mutation InsertScaleListings($data: [PropertyListing_Data!]!) { propertyListing_insertMany(data: $data) }", {variables: {data: dataset.listings.slice(start, start + 100)}});
  }
}

export function registerMapScaleCases({ sdk, run, forbidden, dc }) {
  describe("Phase 5F map scale, viewport queries and pagination", { concurrency: false }, () => {
    const dataset = generateScaleDataset(randomUUID());
    const {community} = dataset;
    const mappedCount = SCALE.exact + SCALE.approximate;
    const total = mappedCount + SCALE.hidden;
    const count = rows => rows[0]?._count ?? 0;
    before(async () => { await insertScaleDataset(dc, dataset); });

    it("reports honest counts and caps a page at the requested limit", async () => {
      const data = await run(sdk.listPropertyListingMapPins, "owner-a", {organizationId: f.orgA, community, limit: 500});
      assert.equal(data.propertyListings.length, 500);
      assert.equal(count(data.mapped), mappedCount, "HIDDEN rows are never counted as mapped");
      assert.equal(count(data.mappedAll), mappedCount);
      assert.equal(count(data.total), total);
      assert.ok(data.propertyListings.every(row => row.property.mapDisplayMode !== "HIDDEN"));
    });

    it("pages through every mapped listing with offset, without gaps or duplicates", async () => {
      const seen = new Set();
      for (let offset = 0; offset < mappedCount; offset += 250) {
        const page = await run(sdk.listPropertyListingMapPins, "owner-a", {organizationId: f.orgA, community, limit: 250, offset});
        for (const row of page.propertyListings) {
          assert.equal(seen.has(key(row.id)), false, "no listing appears on two pages");
          seen.add(key(row.id));
        }
      }
      assert.equal(seen.size, mappedCount);
      const expected = new Set(dataset.listings.filter((_, index) => dataset.properties[index].mapDisplayMode !== "HIDDEN").map(row => key(row.id)));
      assert.deepEqual(seen, expected);
    });

    it("filters rows and the mapped count by the visible bounds on the server", async () => {
      const bounds = {south: 25.05, north: 25.1, west: 55.15, east: 55.2};
      const inside = dataset.properties.filter(row => row.mapDisplayMode !== "HIDDEN"
        && row.latitude >= bounds.south && row.latitude <= bounds.north && row.longitude >= bounds.west && row.longitude <= bounds.east);
      assert.ok(inside.length > 0 && inside.length < mappedCount);
      const data = await run(sdk.listPropertyMapPins, "owner-a", {organizationId: f.orgA, community, limit: 1000, ...bounds});
      assert.equal(data.properties.length, inside.length);
      assert.equal(count(data.mapped), inside.length);
      assert.equal(count(data.mappedAll), mappedCount, "mappedAll ignores the viewport");
      for (const row of data.properties) {
        assert.ok(row.latitude >= bounds.south && row.latitude <= bounds.north && row.longitude >= bounds.west && row.longitude <= bounds.east);
      }
    });

    it("combines viewport, price and type filters", async () => {
      const bounds = {south: 25.0, north: 25.12, west: 55.1, east: 55.25};
      const min = 150_000_000, max = 160_000_000;
      const expected = dataset.listings.filter((listing, index) => {
        const property = dataset.properties[index];
        return property.mapDisplayMode !== "HIDDEN" && property.propertyType === "APARTMENT"
          && Number(listing.askingPriceMinor) >= min && Number(listing.askingPriceMinor) <= max
          && property.latitude >= bounds.south && property.latitude <= bounds.north && property.longitude >= bounds.west && property.longitude <= bounds.east;
      });
      const data = await run(sdk.listPropertyListingMapPins, "owner-a", {
        organizationId: f.orgA, community, limit: 1000, propertyType: sdk.PropertyType.APARTMENT,
        minimumPriceMinor: String(min), maximumPriceMinor: String(max), ...bounds,
      });
      assert.deepEqual(new Set(data.propertyListings.map(row => key(row.id))), new Set(expected.map(row => key(row.id))));
    });

    it("keeps agents to their assigned listings inside any viewport", async () => {
      const data = await run(sdk.listAssignedPropertyListingMapPins, "agent-a", {
        organizationId: f.orgA, assignedMembershipId: f.memberAgentA, community, limit: 1000, south: 24, north: 26, west: 54, east: 56,
      });
      const assigned = dataset.listings.filter((_, index) => index < SCALE.assignedToAgent && dataset.properties[index].mapDisplayMode !== "HIDDEN");
      assert.deepEqual(new Set(data.propertyListings.map(row => key(row.id))), new Set(assigned.map(row => key(row.id))));
      await forbidden(sdk.listPropertyListingMapPins, "agent-a", {organizationId: f.orgA, community, limit: 10});
      await forbidden(sdk.listAssignedPropertyListingMapPins, "agent-a", {organizationId: f.orgA, assignedMembershipId: f.memberAdminA, community, limit: 10});
    });

    it("never returns one company's pins to another company", async () => {
      await forbidden(sdk.listPropertyListingMapPins, "owner-b", {organizationId: f.orgA, community, limit: 10});
      await forbidden(sdk.listPropertyMapPins, "owner-b", {organizationId: f.orgA, community, limit: 10});
      const own = await run(sdk.listPropertyListingMapPins, "owner-b", {organizationId: f.orgB, community, limit: 10});
      assert.equal(own.propertyListings.length, 0);
      assert.equal(count(own.total), 0);
    });

    it("rejects page sizes above 1000 and offsets above 20000", async () => {
      await forbidden(sdk.listPropertyListingMapPins, "owner-a", {organizationId: f.orgA, community, limit: 1001});
      await forbidden(sdk.listPropertyListingMapPins, "owner-a", {organizationId: f.orgA, community, limit: 10, offset: 20001});
    });
  });
}
